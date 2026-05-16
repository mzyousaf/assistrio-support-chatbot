import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage, Types } from 'mongoose';
import { Conversation, Message } from '../models';
import {
  PREVIEW_STARTED_FROM_VALUES,
  alignBucketStart,
  bucketKeyIso,
  enumerateBucketStarts,
  mongoDateTruncUnit,
  normalizeConversationStartedFrom,
  sortStartedFromKeys,
  startedFromLabel,
  type ConversationStartedFromKey,
  type CustomerChatsGranularity,
} from './customer-chats-analytics.util';
import {
  parseCustomerSentimentAnalyticsQuery,
  SENTIMENT_ANALYTICS_DISPLAY_LABELS,
  SENTIMENT_ANALYTICS_KEYS,
  type CustomerSentimentAnalyticsQueryInput,
  type ParsedCustomerSentimentAnalyticsQuery,
} from './customer-sentiment-analytics.util';
import type { SentimentLabel } from './topic-sentiment-classification.constants';

export type CustomerSentimentAnalyticsResponse = {
  range: {
    from: string;
    to: string;
    granularity: CustomerChatsGranularity;
  };
  summary: {
    totalUserMessages: number;
    classifiedMessages: number;
    unclassifiedMessages: number;
    sentimentCoverageRate: number;
    averageSentimentScore: number | null;
    dominantSentiment: SentimentLabel | null;
    negativeMessages: number;
    mixedMessages: number;
    /** Distinct conversations with at least one user message in range (after filters). */
    totalConversations: number;
    /** Distinct conversations with at least one classified user message in range. */
    classifiedConversations: number;
    /** Distinct conversations with no classified user message in range (subset of totalConversations). */
    unclassifiedConversations: number;
    negativeConversations: number;
    mixedConversations: number;
  };
  timeSeries: Array<{
    date: string;
    classifiedMessages: number;
    unclassifiedMessages: number;
    positive: number;
    neutral: number;
    negative: number;
    mixed: number;
    unknown: number;
    averageSentimentScore: number | null;
  }>;
  /**
   * Per time bucket: distinct chats that started in the bucket (startedAt in range), counted once
   * with one sentiment label for the whole thread (mixed when multiple labels appear).
   */
  conversationTimeSeries: Array<{
    date: string;
    classifiedConversations: number;
    unclassifiedConversations: number;
    positive: number;
    neutral: number;
    negative: number;
    mixed: number;
    unknown: number;
    averageSentimentScore: number | null;
  }>;
  sentimentBreakdown: Array<{
    sentiment: SentimentLabel;
    label: string;
    messages: number;
    conversations: number;
    percentage: number;
    averageScore: number | null;
  }>;
  startedFromBreakdown: Array<{
    startedFrom: ConversationStartedFromKey;
    label: string;
    messages: number;
    conversations: number;
    averageScore: number | null;
  }>;
};

function dateTruncStage(
  dateField: string,
  granularity: CustomerChatsGranularity,
): Record<string, unknown> {
  const unit = mongoDateTruncUnit(granularity);
  const base: Record<string, unknown> = {
    date: `$${dateField}`,
    unit,
    timezone: 'UTC',
  };
  if (unit === 'week') {
    base.startOfWeek = 'monday';
  }
  return { $dateTrunc: base };
}

function startedFromKeyExpr(): Record<string, unknown> {
  return {
    $switch: {
      branches: [
        { case: { $eq: ['$_conv.startedFrom', 'playground_preview'] }, then: 'playground_preview' },
        { case: { $eq: ['$_conv.startedFrom', 'shared_preview'] }, then: 'shared_preview' },
        { case: { $eq: ['$_conv.startedFrom', 'runtime_widget'] }, then: 'runtime_widget' },
        { case: { $eq: ['$_conv.startedFrom', 'runtime_iframe'] }, then: 'runtime_iframe' },
      ],
      default: 'unknown',
    },
  };
}

function sentimentLabelStringExpr(labelField: string): Record<string, unknown> {
  return {
    $trim: { input: { $toString: { $ifNull: [labelField, ''] } } },
  };
}

function isSentimentClassifiedOnLabelField(labelField: string): Record<string, unknown> {
  return {
    $gt: [{ $strLenCP: sentimentLabelStringExpr(labelField) }, 0],
  };
}

function isSentimentClassifiedExpr(): Record<string, unknown> {
  return isSentimentClassifiedOnLabelField('$sentiment.label');
}

function sentimentNormOnLabelField(labelField: string): Record<string, unknown> {
  const labelStr = sentimentLabelStringExpr(labelField);
  const branches = SENTIMENT_ANALYTICS_KEYS.map((id) => ({
    case: { $eq: [labelStr, id] },
    then: id,
  }));
  return {
    $cond: [
      isSentimentClassifiedOnLabelField(labelField),
      { $switch: { branches, default: 'unknown' } },
      null,
    ],
  };
}

function sentimentNormExpr(): Record<string, unknown> {
  return sentimentNormOnLabelField('$sentiment.label');
}

function finiteScoreOnField(scoreField: string): Record<string, unknown> {
  return {
    $cond: [
      {
        $in: [{ $type: scoreField }, ['double', 'int', 'long', 'decimal']],
      },
      { $toDouble: scoreField },
      null,
    ],
  };
}

function finiteScoreExpr(): Record<string, unknown> {
  return finiteScoreOnField('$sentiment.score');
}

function hasFiniteScoreExpr(): Record<string, unknown> {
  return {
    $and: [{ $ne: ['$finiteScore', null] }, { $eq: ['$finiteScore', '$finiteScore'] }],
  };
}

function sentimentCountSum(s: SentimentLabel): Record<string, unknown> {
  return {
    $sum: { $cond: [{ $eq: ['$sentimentNorm', s] }, 1, 0] },
  };
}

function alignBucketDate(d: Date, granularity: CustomerChatsGranularity): Date {
  return alignBucketStart(d, granularity);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function finiteAverage(sum: number, count: number): number | null {
  if (!count || !Number.isFinite(sum)) return null;
  const v = sum / count;
  return Number.isFinite(v) ? v : null;
}

type ConversationFacetRow = {
  conversationSentimentBreakdown: Array<{ _id: string; conversations: number }>;
  conversationCounts: Array<{
    totalConversations?: number;
    classifiedConversations?: number;
    unclassifiedConversations?: number;
  }>;
  conversationTimeSeriesSentiment: Array<{
    _id: { bucket: Date; s: string };
    conversations?: number;
  }>;
  conversationTimeSeriesClassified: Array<{
    _id: Date;
    classifiedConversations?: number;
    scoreSum?: number;
    scoreCount?: number;
  }>;
  conversationTimeSeriesUnclassified: Array<{
    _id: Date;
    unclassifiedConversations?: number;
  }>;
};

@Injectable()
export class CustomerSentimentAnalyticsService {
  constructor(
    @InjectModel(Message.name) private readonly messageModel: Model<Message>,
    @InjectModel(Conversation.name) private readonly conversationModel: Model<Conversation>,
  ) {}

  async get(
    botId: string,
    queryIn: CustomerSentimentAnalyticsQueryInput,
  ): Promise<CustomerSentimentAnalyticsResponse> {
    const q = parseCustomerSentimentAnalyticsQuery(queryIn);
    const oid = new Types.ObjectId(botId);

    const sentimentSums: Record<string, Record<string, unknown>> = {};
    for (const s of SENTIMENT_ANALYTICS_KEYS) {
      sentimentSums[s] = sentimentCountSum(s);
    }

    const pipeline: PipelineStage[] = [
      {
        $match: {
          botId: oid,
          role: 'user',
          createdAt: { $gte: q.from, $lte: q.to },
        },
      },
      ...this.messageLookupPipeline(q),
      {
        $addFields: {
          bucket: dateTruncStage('createdAt', q.granularity),
          isClassified: isSentimentClassifiedExpr(),
          sentimentNorm: sentimentNormExpr(),
          startedFromKey: startedFromKeyExpr(),
          finiteScore: finiteScoreExpr(),
        },
      },
    ];

    if (q.sentiment) {
      pipeline.push({ $match: { sentimentNorm: q.sentiment } });
    }

    pipeline.push({
      $facet: {
        summary: [
          {
            $group: {
              _id: null,
              totalUserMessages: { $sum: 1 },
              classifiedMessages: { $sum: { $cond: ['$isClassified', 1, 0] } },
              scoreSum: {
                $sum: { $cond: [hasFiniteScoreExpr(), '$finiteScore', 0] },
              },
              scoreCount: {
                $sum: { $cond: [hasFiniteScoreExpr(), 1, 0] },
              },
              negativeMessages: {
                $sum: { $cond: [{ $eq: ['$sentimentNorm', 'negative'] }, 1, 0] },
              },
              mixedMessages: {
                $sum: { $cond: [{ $eq: ['$sentimentNorm', 'mixed'] }, 1, 0] },
              },
            },
          },
        ],
        timeSeries: [
          {
            $group: {
              _id: '$bucket',
              classifiedMessages: { $sum: { $cond: ['$isClassified', 1, 0] } },
              unclassifiedMessages: { $sum: { $cond: ['$isClassified', 0, 1] } },
              scoreSum: {
                $sum: { $cond: [hasFiniteScoreExpr(), '$finiteScore', 0] },
              },
              scoreCount: {
                $sum: { $cond: [hasFiniteScoreExpr(), 1, 0] },
              },
              ...sentimentSums,
            },
          },
        ],
        sentimentBreakdown: [
          { $match: { isClassified: true, sentimentNorm: { $ne: null } } },
          {
            $group: {
              _id: '$sentimentNorm',
              messages: { $sum: 1 },
              convIds: { $addToSet: '$conversationId' },
              scoreSum: {
                $sum: { $cond: [hasFiniteScoreExpr(), '$finiteScore', 0] },
              },
              scoreCount: {
                $sum: { $cond: [hasFiniteScoreExpr(), 1, 0] },
              },
            },
          },
          {
            $project: {
              _id: 1,
              messages: 1,
              conversations: { $size: '$convIds' },
              scoreSum: 1,
              scoreCount: 1,
            },
          },
        ],
        startedFromBreakdown: [
          {
            $group: {
              _id: '$startedFromKey',
              messages: { $sum: 1 },
              convIds: { $addToSet: '$conversationId' },
              scoreSum: {
                $sum: { $cond: [hasFiniteScoreExpr(), '$finiteScore', 0] },
              },
              scoreCount: {
                $sum: { $cond: [hasFiniteScoreExpr(), 1, 0] },
              },
            },
          },
          {
            $project: {
              startedFrom: '$_id',
              messages: 1,
              conversations: { $size: '$convIds' },
              scoreSum: 1,
              scoreCount: 1,
            },
          },
        ],
      },
    });

    const [rows, convRows] = await Promise.all([
      this.messageModel.aggregate<{
      summary: Array<{
        totalUserMessages?: number;
        classifiedMessages?: number;
        scoreSum?: number;
        scoreCount?: number;
        negativeMessages?: number;
        mixedMessages?: number;
      }>;
      timeSeries: Array<
        {
          _id: Date;
          classifiedMessages?: number;
          unclassifiedMessages?: number;
          scoreSum?: number;
          scoreCount?: number;
        } & Partial<Record<SentimentLabel, number>>
      >;
      sentimentBreakdown: Array<{
        _id: string;
        messages: number;
        conversations: number;
        scoreSum: number;
        scoreCount: number;
      }>;
      startedFromBreakdown: Array<{
        startedFrom: string;
        messages: number;
        conversations: number;
        scoreSum: number;
        scoreCount: number;
      }>;
    }>(pipeline),
      this.aggregateConversationMetrics(oid, q),
    ]);

    const row = rows[0] ?? {
      summary: [],
      timeSeries: [],
      sentimentBreakdown: [],
      startedFromBreakdown: [],
    };

    const convRow: ConversationFacetRow = convRows[0] ?? {
      conversationSentimentBreakdown: [],
      conversationCounts: [],
      conversationTimeSeriesSentiment: [],
      conversationTimeSeriesClassified: [],
      conversationTimeSeriesUnclassified: [],
    };

    const summaryRow = row.summary?.[0];
    const totalUserMessages = Math.trunc(summaryRow?.totalUserMessages ?? 0);
    const classifiedMessages = Math.trunc(summaryRow?.classifiedMessages ?? 0);
    const unclassifiedMessages = Math.max(0, totalUserMessages - classifiedMessages);
    const negativeMessages = Math.trunc(summaryRow?.negativeMessages ?? 0);
    const mixedMessages = Math.trunc(summaryRow?.mixedMessages ?? 0);
    const sentimentCoverageRate =
      totalUserMessages > 0 ? Math.round((classifiedMessages / totalUserMessages) * 10_000) / 10_000 : 0;
    const averageSentimentScore = finiteAverage(
      Number(summaryRow?.scoreSum ?? 0),
      Math.trunc(summaryRow?.scoreCount ?? 0),
    );

    const senMsgMap = new Map<string, number>();
    const senScoreSum = new Map<string, number>();
    const senScoreCount = new Map<string, number>();
    for (const r of row.sentimentBreakdown ?? []) {
      const k = String(r._id ?? '');
      senMsgMap.set(k, Math.trunc(r.messages ?? 0));
      senScoreSum.set(k, Number(r.scoreSum ?? 0));
      senScoreCount.set(k, Math.trunc(r.scoreCount ?? 0));
    }

    const senConvMap = new Map<string, number>();
    for (const r of convRow.conversationSentimentBreakdown ?? []) {
      const k = String(r._id ?? '');
      senConvMap.set(k, Math.trunc(r.conversations ?? 0));
    }

    const convCountRow = convRow.conversationCounts?.[0];
    const totalConversations = Math.trunc(convCountRow?.totalConversations ?? 0);
    const classifiedConversations = Math.trunc(convCountRow?.classifiedConversations ?? 0);
    const unclassifiedConversations = Math.trunc(convCountRow?.unclassifiedConversations ?? 0);
    const negativeConversations = Math.trunc(senConvMap.get('negative') ?? 0);
    const mixedConversations = Math.trunc(senConvMap.get('mixed') ?? 0);

    let dominantSentiment: SentimentLabel | null = null;
    let topN = -1;
    for (const s of SENTIMENT_ANALYTICS_KEYS) {
      const n = senMsgMap.get(s) ?? 0;
      if (n > topN) {
        topN = n;
        dominantSentiment = s;
      } else if (n === topN && n > 0 && dominantSentiment && s.localeCompare(dominantSentiment) < 0) {
        dominantSentiment = s;
      }
    }
    if (topN <= 0) dominantSentiment = null;

    const sentimentBreakdown: CustomerSentimentAnalyticsResponse['sentimentBreakdown'] =
      SENTIMENT_ANALYTICS_KEYS.map((sentiment) => {
        const messages = senMsgMap.get(sentiment) ?? 0;
        const conversations = senConvMap.get(sentiment) ?? 0;
        const percentage =
          classifiedMessages > 0 ? round1((messages / classifiedMessages) * 100) : 0;
        const averageScore = finiteAverage(
          senScoreSum.get(sentiment) ?? 0,
          senScoreCount.get(sentiment) ?? 0,
        );
        return {
          sentiment,
          label: SENTIMENT_ANALYTICS_DISPLAY_LABELS[sentiment],
          messages,
          conversations,
          percentage,
          averageScore,
        };
      });

    sentimentBreakdown.sort(
      (a, b) => b.messages - a.messages || a.sentiment.localeCompare(b.sentiment),
    );

    const sfRows = row.startedFromBreakdown ?? [];
    const sfMap = new Map<
      string,
      { messages: number; conversations: number; scoreSum: number; scoreCount: number }
    >();
    for (const s of sfRows) {
      const k = normalizeConversationStartedFrom(s.startedFrom);
      const cur = sfMap.get(k) ?? { messages: 0, conversations: 0, scoreSum: 0, scoreCount: 0 };
      cur.messages += Math.trunc(s.messages ?? 0);
      cur.conversations += Math.trunc(s.conversations ?? 0);
      cur.scoreSum += Number(s.scoreSum ?? 0);
      cur.scoreCount += Math.trunc(s.scoreCount ?? 0);
      sfMap.set(k, cur);
    }
    const startedFromKeys = sortStartedFromKeys([...sfMap.keys()] as ConversationStartedFromKey[]);
    const startedFromBreakdown = startedFromKeys.map((startedFrom) => {
      const rec = sfMap.get(startedFrom)!;
      return {
        startedFrom,
        label: startedFromLabel(startedFrom),
        messages: rec.messages,
        conversations: rec.conversations,
        averageScore: finiteAverage(rec.scoreSum, rec.scoreCount),
      };
    });

    const tsMap = new Map<
      string,
      {
        classifiedMessages: number;
        unclassifiedMessages: number;
        scoreSum: number;
        scoreCount: number;
      } & Record<SentimentLabel, number>
    >();
    for (const r of row.timeSeries ?? []) {
      const key = bucketKeyIso(alignBucketDate(r._id, q.granularity));
      const o = {} as {
        classifiedMessages: number;
        unclassifiedMessages: number;
        scoreSum: number;
        scoreCount: number;
      } & Record<SentimentLabel, number>;
      o.classifiedMessages = Math.trunc(r.classifiedMessages ?? 0);
      o.unclassifiedMessages = Math.trunc(r.unclassifiedMessages ?? 0);
      o.scoreSum = Number(r.scoreSum ?? 0);
      o.scoreCount = Math.trunc(r.scoreCount ?? 0);
      for (const s of SENTIMENT_ANALYTICS_KEYS) {
        const v = (r as unknown as Record<string, unknown>)[s];
        o[s] = Math.trunc(typeof v === 'number' ? v : Number(v) || 0);
      }
      tsMap.set(key, o);
    }

    const bucketStarts = enumerateBucketStarts(q.from, q.to, q.granularity);
    const zeros = Object.fromEntries(SENTIMENT_ANALYTICS_KEYS.map((s) => [s, 0])) as Record<
      SentimentLabel,
      number
    >;
    const timeSeries: CustomerSentimentAnalyticsResponse['timeSeries'] = bucketStarts.map((bucketStart) => {
      const key = bucketKeyIso(bucketStart);
      const d = tsMap.get(key);
      if (!d) {
        return {
          date: key,
          classifiedMessages: 0,
          unclassifiedMessages: 0,
          averageSentimentScore: null,
          ...zeros,
        };
      }
      return {
        date: key,
        classifiedMessages: d.classifiedMessages,
        unclassifiedMessages: d.unclassifiedMessages,
        averageSentimentScore: finiteAverage(d.scoreSum, d.scoreCount),
        ...Object.fromEntries(SENTIMENT_ANALYTICS_KEYS.map((s) => [s, d[s] ?? 0])) as Record<
          SentimentLabel,
          number
        >,
      };
    });

    const convTsInner = convRow.conversationTimeSeriesSentiment;
    const convSentimentByKey = new Map<string, Partial<Record<SentimentLabel, number>>>();
    const convClassifiedByKey = new Map<
      string,
      { classifiedConversations: number; scoreSum: number; scoreCount: number }
    >();
    const convUnclassifiedByKey = new Map<string, number>();
    for (const r of convTsInner ?? []) {
      const b = r._id?.bucket;
      const s = r._id?.s;
      if (!(b instanceof Date) || typeof s !== 'string') continue;
      const key = bucketKeyIso(alignBucketDate(b, q.granularity));
      const cur = convSentimentByKey.get(key) ?? { ...zeros };
      const label = s as SentimentLabel;
      if ((SENTIMENT_ANALYTICS_KEYS as readonly string[]).includes(s)) {
        cur[s as SentimentLabel] = Math.trunc(r.conversations ?? 0);
      }
      convSentimentByKey.set(key, cur);
    }
    for (const r of convRow.conversationTimeSeriesClassified ?? []) {
      const b = r._id;
      if (!(b instanceof Date)) continue;
      const key = bucketKeyIso(alignBucketDate(b, q.granularity));
      convClassifiedByKey.set(key, {
        classifiedConversations: Math.trunc(r.classifiedConversations ?? 0),
        scoreSum: Number(r.scoreSum ?? 0),
        scoreCount: Math.trunc(r.scoreCount ?? 0),
      });
    }
    for (const r of convRow.conversationTimeSeriesUnclassified ?? []) {
      const b = r._id;
      if (!(b instanceof Date)) continue;
      const key = bucketKeyIso(alignBucketDate(b, q.granularity));
      convUnclassifiedByKey.set(key, Math.trunc(r.unclassifiedConversations ?? 0));
    }

    const conversationTimeSeries: CustomerSentimentAnalyticsResponse['conversationTimeSeries'] =
      bucketStarts.map((bucketStart) => {
        const key = bucketKeyIso(bucketStart);
        const stacks = convSentimentByKey.get(key) ?? { ...zeros };
        const cls = convClassifiedByKey.get(key);
        const uncl = convUnclassifiedByKey.get(key) ?? 0;
        return {
          date: key,
          classifiedConversations: cls?.classifiedConversations ?? 0,
          unclassifiedConversations: uncl,
          averageSentimentScore: finiteAverage(cls?.scoreSum ?? 0, cls?.scoreCount ?? 0),
          ...Object.fromEntries(SENTIMENT_ANALYTICS_KEYS.map((s) => [s, stacks[s] ?? 0])) as Record<
            SentimentLabel,
            number
          >,
        };
      });

    return {
      range: {
        from: q.from.toISOString(),
        to: q.to.toISOString(),
        granularity: q.granularity,
      },
      summary: {
        totalUserMessages,
        classifiedMessages,
        unclassifiedMessages,
        sentimentCoverageRate,
        averageSentimentScore,
        dominantSentiment,
        negativeMessages,
        mixedMessages,
        totalConversations,
        classifiedConversations,
        unclassifiedConversations,
        negativeConversations,
        mixedConversations,
      },
      timeSeries,
      conversationTimeSeries,
      sentimentBreakdown,
      startedFromBreakdown,
    };
  }

  private async aggregateConversationMetrics(
    oid: Types.ObjectId,
    q: ParsedCustomerSentimentAnalyticsQuery,
  ): Promise<ConversationFacetRow[]> {
    const msgLabel = '$_msgs.sentiment.label';
    const msgScore = '$_msgs.sentiment.score';
    const pipeline: PipelineStage[] = [
      { $match: { botId: oid } },
      {
        $addFields: {
          __convAt: { $ifNull: ['$startedAt', '$createdAt'] },
        },
      },
      {
        $match: {
          __convAt: { $gte: q.from, $lte: q.to },
        },
      },
      ...this.conversationFilterStages(q),
      {
        $addFields: {
          bucket: dateTruncStage('__convAt', q.granularity),
        },
      },
      {
        $lookup: {
          from: 'messages',
          let: { cid: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [{ $eq: ['$conversationId', '$$cid'] }, { $eq: ['$role', 'user'] }],
                },
              },
            },
            {
              $project: {
                sentiment: 1,
              },
            },
          ],
          as: '_msgs',
        },
      },
      { $unwind: { path: '$_msgs', preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          __isClassified: isSentimentClassifiedOnLabelField(msgLabel),
          __msgNorm: sentimentNormOnLabelField(msgLabel),
          __msgScore: finiteScoreOnField(msgScore),
        },
      },
      {
        $group: {
          _id: '$_id',
          bucket: { $first: '$bucket' },
          norms: {
            $addToSet: {
              $cond: [{ $ne: ['$__msgNorm', null] }, '$__msgNorm', '$$REMOVE'],
            },
          },
          hasClassified: { $max: { $cond: ['$__isClassified', 1, 0] } },
          scoreSum: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ['$__msgScore', null] },
                    { $eq: ['$__msgScore', '$__msgScore'] },
                  ],
                },
                '$__msgScore',
                0,
              ],
            },
          },
          scoreCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ['$__msgScore', null] },
                    { $eq: ['$__msgScore', '$__msgScore'] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
      {
        $addFields: {
          assigned: {
            $cond: [
              { $eq: ['$hasClassified', 0] },
              null,
              {
                $cond: [
                  { $lte: [{ $size: '$norms' }, 1] },
                  { $arrayElemAt: ['$norms', 0] },
                  'mixed',
                ],
              },
            ],
          },
        },
      },
    ];

    if (q.sentiment) {
      pipeline.push({ $match: { assigned: q.sentiment } });
    }

    pipeline.push({
      $facet: {
        conversationSentimentBreakdown: [
          { $match: { assigned: { $ne: null } } },
          {
            $group: {
              _id: '$assigned',
              conversations: { $sum: 1 },
            },
          },
        ],
        conversationCounts: [
          {
            $group: {
              _id: null,
              totalConversations: { $sum: 1 },
              classifiedConversations: {
                $sum: { $cond: [{ $eq: ['$hasClassified', 1] }, 1, 0] },
              },
              unclassifiedConversations: {
                $sum: { $cond: [{ $eq: ['$hasClassified', 0] }, 1, 0] },
              },
            },
          },
        ],
        conversationTimeSeriesSentiment: [
          { $match: { assigned: { $ne: null } } },
          {
            $group: {
              _id: { bucket: '$bucket', s: '$assigned' },
              conversations: { $sum: 1 },
            },
          },
        ],
        conversationTimeSeriesClassified: [
          { $match: { hasClassified: 1 } },
          {
            $group: {
              _id: '$bucket',
              classifiedConversations: { $sum: 1 },
              scoreSum: { $sum: '$scoreSum' },
              scoreCount: { $sum: '$scoreCount' },
            },
          },
        ],
        conversationTimeSeriesUnclassified: [
          { $match: { hasClassified: 0 } },
          {
            $group: {
              _id: '$bucket',
              unclassifiedConversations: { $sum: 1 },
            },
          },
        ],
      },
    });

    return this.conversationModel.aggregate<ConversationFacetRow>(pipeline);
  }

  private conversationFilterStages(q: ParsedCustomerSentimentAnalyticsQuery): PipelineStage[] {
    const stages: PipelineStage[] = [];
    if (!q.includePreview) {
      stages.push({
        $match: {
          $or: [
            { startedFrom: { $exists: false } },
            { startedFrom: null },
            { startedFrom: { $nin: [...PREVIEW_STARTED_FROM_VALUES] } },
          ],
        },
      });
    }
    if (q.startedFrom) {
      if (q.startedFrom === 'unknown') {
        stages.push({
          $match: {
            $or: [
              { startedFrom: { $exists: false } },
              { startedFrom: null },
              { startedFrom: '' },
              { startedFrom: 'unknown' },
            ],
          },
        });
      } else {
        stages.push({ $match: { startedFrom: q.startedFrom } });
      }
    }
    return stages;
  }

  private messageLookupPipeline(q: ParsedCustomerSentimentAnalyticsQuery): PipelineStage[] {
    const stages: PipelineStage[] = [
      {
        $lookup: {
          from: 'conversations',
          localField: 'conversationId',
          foreignField: '_id',
          as: '_conv',
        },
      },
      { $unwind: { path: '$_conv', preserveNullAndEmptyArrays: false } },
    ];

    const matchParts: Record<string, unknown> = {};
    if (!q.includePreview) {
      matchParts['_conv.startedFrom'] = { $nin: [...PREVIEW_STARTED_FROM_VALUES] };
    }
    if (q.startedFrom) {
      if (q.startedFrom === 'unknown') {
        stages.push({
          $match: {
            $or: [
              { '_conv.startedFrom': { $exists: false } },
              { '_conv.startedFrom': null },
              { '_conv.startedFrom': '' },
            ],
          },
        });
      } else {
        matchParts['_conv.startedFrom'] = q.startedFrom;
      }
    }
    if (Object.keys(matchParts).length > 0) {
      stages.push({ $match: matchParts });
    }
    return stages;
  }
}
