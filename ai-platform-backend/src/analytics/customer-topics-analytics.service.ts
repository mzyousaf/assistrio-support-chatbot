import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage, Types } from 'mongoose';
import { Conversation, Message } from '../models';
import {
  TOPIC_LABELS,
  type TopicTaxonomyId,
} from './topic-sentiment-classification.constants';
import {
  PREVIEW_STARTED_FROM_VALUES,
  alignBucketStart,
  bucketKeyIso,
  enumerateBucketStarts,
  mongoDateTruncUnit,
  type CustomerChatsGranularity,
} from './customer-chats-analytics.util';
import {
  conversationPrimaryTopicNormExpr,
  messageTopicTagsExpr,
  primaryOnlyMessageTopicTagsExpr,
} from './customer-topics-analytics.topic-tags';
import {
  parseCustomerTopicsAnalyticsQuery,
  TOPIC_ANALYTICS_KEYS,
  type CustomerTopicsAnalyticsQueryInput,
  type ParsedCustomerTopicsAnalyticsQuery,
} from './customer-topics-analytics.util';
import {
  computeFastestGrowingTopics,
  type FastestGrowingTopicItem,
} from './customer-topics-analytics.fastest-growing';

export type CustomerTopicsAnalyticsTimeSeriesPoint = {
  date: string;
  classifiedMessages: number;
  unclassifiedMessages: number;
} & Record<TopicTaxonomyId, number>;

/** Unique conversations per topic per time bucket (conversation primary topic). */
export type CustomerTopicsAnalyticsConversationTopicSeriesPoint = {
  date: string;
} & Record<TopicTaxonomyId, number>;

export type TopicBreakdownByMessageRow = {
  topic: TopicTaxonomyId;
  label: string;
  messages: number;
  conversations: number;
  percentage: number;
};

export type TopicBreakdownByConversationRow = {
  topic: TopicTaxonomyId;
  label: string;
  conversations: number;
  percentage: number;
};

/** Per-topic user-message sentiment counts (one message with multiple tags increments each tag). */
export type TopicSentimentBreakdownRow = {
  topic: TopicTaxonomyId;
  label: string;
  totalMessages: number;
  positive: number;
  neutral: number;
  negative: number;
  mixed: number;
  unknown: number;
};

export type CustomerTopicsAnalyticsResponse = {
  range: {
    from: string;
    to: string;
    granularity: CustomerChatsGranularity;
  };
  summary: {
    totalUserMessages: number;
    classifiedMessages: number;
    unclassifiedMessages: number;
    conversationsWithTopics: number;
    topTopic: TopicTaxonomyId | null;
    topicCoverageRate: number;
  };
  /** @deprecated Use topicMessageTimeSeries */
  timeSeries: CustomerTopicsAnalyticsTimeSeriesPoint[];
  /** @deprecated Use topicConversationTimeSeries */
  conversationTopicSeries: CustomerTopicsAnalyticsConversationTopicSeriesPoint[];
  /** @deprecated Use topicBreakdownByMessages */
  topicBreakdown: TopicBreakdownByMessageRow[];
  /** @deprecated Use fastestGrowingByMessages */
  fastestGrowingTopics: FastestGrowingTopicItem[];

  topicBreakdownByMessages: TopicBreakdownByMessageRow[];
  topicBreakdownByConversations: TopicBreakdownByConversationRow[];
  topicMessageTimeSeries: CustomerTopicsAnalyticsTimeSeriesPoint[];
  topicConversationTimeSeries: CustomerTopicsAnalyticsConversationTopicSeriesPoint[];
  fastestGrowingByMessages: FastestGrowingTopicItem[];
  fastestGrowingByConversations: FastestGrowingTopicItem[];
  topicSentimentBreakdown: TopicSentimentBreakdownRow[];
};

const TOPIC_IDS_MONGO_LITERAL = [...TOPIC_ANALYTICS_KEYS];

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

function alignBucketDate(d: Date, granularity: CustomerChatsGranularity): Date {
  return alignBucketStart(d, granularity);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function previousEqualRange(from: Date, to: Date): { prevFrom: Date; prevTo: Date } | null {
  const span = to.getTime() - from.getTime();
  if (!Number.isFinite(span) || span <= 0) return null;
  const prevTo = new Date(from.getTime() - 1);
  const prevFrom = new Date(prevTo.getTime() - span);
  return { prevFrom, prevTo };
}

function isTaxonomyTopicId(id: string): id is TopicTaxonomyId {
  return (TOPIC_ANALYTICS_KEYS as readonly string[]).includes(id);
}

function labelForTopicId(id: TopicTaxonomyId): string {
  return TOPIC_LABELS[id] ?? id;
}

function messageTopicTagsExprForScope(scope: 'all' | 'primary'): Record<string, unknown> {
  return scope === 'primary' ? primaryOnlyMessageTopicTagsExpr : messageTopicTagsExpr;
}

@Injectable()
export class CustomerTopicsAnalyticsService {
  constructor(
    @InjectModel(Message.name) private readonly messageModel: Model<Message>,
    @InjectModel(Conversation.name) private readonly conversationModel: Model<Conversation>,
  ) {}

  async get(botId: string, queryIn: CustomerTopicsAnalyticsQueryInput): Promise<CustomerTopicsAnalyticsResponse> {
    const q = parseCustomerTopicsAnalyticsQuery(queryIn);
    const oid = new Types.ObjectId(botId);
    const messageTopicTagsResolved = messageTopicTagsExprForScope(q.messageTopicScope);

    const messageRow = await this.runMessageTopicsAggregate(oid, q, messageTopicTagsResolved);
    const conversationRow = await this.runConversationTopicsAggregate(oid, q);

    const topicMsgMap = this.mapTopicIntMap(messageRow.topicBreakdownCombined, 'messages');
    const topicConvFromMessagesMap = this.mapTopicIntMap(messageRow.topicBreakdownCombined, 'conversations');

    const topicConvPrimaryMap = this.mapConversationBreakdown(conversationRow.topicBreakdownRows);

    const totalUserMessages = Math.trunc(messageRow.summary?.[0]?.totalUserMessages ?? 0);
    const classifiedMessages = Math.trunc(messageRow.summary?.[0]?.classifiedMessages ?? 0);
    const unclassifiedMessages = Math.max(0, totalUserMessages - classifiedMessages);
    const conversationsWithTopics = Math.trunc(messageRow.convoWithTopics?.[0]?.n ?? 0);

    let topTopic: TopicTaxonomyId | null = null;
    let topN = -1;
    for (const t of TOPIC_ANALYTICS_KEYS) {
      const n = topicMsgMap.get(t) ?? 0;
      if (n > topN) {
        topN = n;
        topTopic = t;
      } else if (n === topN && n > 0 && topTopic && t.localeCompare(topTopic) < 0) {
        topTopic = t;
      }
    }
    if (topN <= 0) topTopic = null;

    const topicCoverageRate =
      totalUserMessages > 0 ? Math.round((classifiedMessages / totalUserMessages) * 10_000) / 10_000 : 0;

    let totalMentions = 0;
    for (const t of TOPIC_ANALYTICS_KEYS) {
      totalMentions += topicMsgMap.get(t) ?? 0;
    }

    const topicBreakdownByMessages: TopicBreakdownByMessageRow[] = TOPIC_ANALYTICS_KEYS.filter(
      (topic) => (topicMsgMap.get(topic) ?? 0) > 0 || (topicConvFromMessagesMap.get(topic) ?? 0) > 0,
    ).map((topic) => {
      const messages = topicMsgMap.get(topic) ?? 0;
      const conversations = topicConvFromMessagesMap.get(topic) ?? 0;
      const percentage =
        totalMentions > 0 && messages > 0 ? round1((messages / totalMentions) * 100) : 0;
      return {
        topic,
        label: labelForTopicId(topic),
        messages,
        conversations,
        percentage,
      };
    });

    topicBreakdownByMessages.sort(
      (a, b) =>
        b.messages - a.messages ||
        b.conversations - a.conversations ||
        a.topic.localeCompare(b.topic),
    );

    const totalPrimaryConv = Math.trunc(conversationRow.totalWithPrimary?.[0]?.n ?? 0);
    const topicBreakdownByConversations: TopicBreakdownByConversationRow[] = TOPIC_ANALYTICS_KEYS.filter(
      (topic) => (topicConvPrimaryMap.get(topic) ?? 0) > 0,
    ).map((topic) => {
      const conversations = topicConvPrimaryMap.get(topic) ?? 0;
      const percentage =
        totalPrimaryConv > 0 ? round1((conversations / totalPrimaryConv) * 100) : 0;
      return {
        topic,
        label: labelForTopicId(topic),
        conversations,
        percentage,
      };
    });
    topicBreakdownByConversations.sort(
      (a, b) => b.conversations - a.conversations || a.topic.localeCompare(b.topic),
    );

    const topicSentimentBreakdown: TopicSentimentBreakdownRow[] = (messageRow.topicSentimentAgg ?? [])
      .map((r) => {
        const topicRaw = String(r._id ?? '');
        if (!isTaxonomyTopicId(topicRaw)) return null;
        const positive = Math.max(0, Math.trunc(Number(r.positive ?? 0)));
        const neutral = Math.max(0, Math.trunc(Number(r.neutral ?? 0)));
        const negative = Math.max(0, Math.trunc(Number(r.negative ?? 0)));
        const mixed = Math.max(0, Math.trunc(Number(r.mixed ?? 0)));
        const unknown = Math.max(0, Math.trunc(Number(r.unknown ?? 0)));
        const totalMessages = positive + neutral + negative + mixed + unknown;
        if (totalMessages <= 0) return null;
        return {
          topic: topicRaw,
          label: labelForTopicId(topicRaw),
          totalMessages,
          positive,
          neutral,
          negative,
          mixed,
          unknown,
        };
      })
      .filter((x): x is TopicSentimentBreakdownRow => x != null)
      .sort((a, b) => b.totalMessages - a.totalMessages || a.topic.localeCompare(b.topic));

    const bucketStarts = enumerateBucketStarts(q.from, q.to, q.granularity);
    const zeros = Object.fromEntries(TOPIC_ANALYTICS_KEYS.map((t) => [t, 0])) as Record<
      TopicTaxonomyId,
      number
    >;

    const bucketClassified = new Map<string, { classifiedMessages: number; unclassifiedMessages: number }>();
    for (const r of messageRow.bucketTotals ?? []) {
      const key = bucketKeyIso(alignBucketDate(r._id, q.granularity));
      bucketClassified.set(key, {
        classifiedMessages: Math.trunc(r.classifiedMessages ?? 0),
        unclassifiedMessages: Math.trunc(r.unclassifiedMessages ?? 0),
      });
    }

    const mentionByBucket = new Map<string, Record<TopicTaxonomyId, number>>();
    for (const r of messageRow.mentionBuckets ?? []) {
      const b = r._id?.bucket;
      const topicRaw = r._id?.topic;
      if (!(b instanceof Date) || typeof topicRaw !== 'string' || !isTaxonomyTopicId(topicRaw)) continue;
      const key = bucketKeyIso(alignBucketDate(b, q.granularity));
      const cur = mentionByBucket.get(key) ?? { ...zeros };
      cur[topicRaw] = Math.trunc(r.messages ?? 0);
      mentionByBucket.set(key, cur);
    }

    const convPrimaryByBucket = new Map<string, Record<TopicTaxonomyId, number>>();
    for (const r of conversationRow.bucketRows ?? []) {
      const b = r._id?.bucket;
      const topicRaw = r._id?.topic;
      if (!(b instanceof Date) || typeof topicRaw !== 'string' || !isTaxonomyTopicId(topicRaw)) continue;
      const key = bucketKeyIso(alignBucketDate(b, q.granularity));
      const cur = convPrimaryByBucket.get(key) ?? { ...zeros };
      cur[topicRaw] = Math.trunc(r.conversations ?? 0);
      convPrimaryByBucket.set(key, cur);
    }

    const topicMessageTimeSeries: CustomerTopicsAnalyticsTimeSeriesPoint[] = bucketStarts.map((bucketStart) => {
      const key = bucketKeyIso(bucketStart);
      const cls = bucketClassified.get(key);
      const topics = mentionByBucket.get(key) ?? zeros;
      return {
        date: key,
        classifiedMessages: cls?.classifiedMessages ?? 0,
        unclassifiedMessages: cls?.unclassifiedMessages ?? 0,
        ...Object.fromEntries(TOPIC_ANALYTICS_KEYS.map((t) => [t, topics[t] ?? 0])) as Record<
          TopicTaxonomyId,
          number
        >,
      };
    });

    const topicConversationTimeSeries: CustomerTopicsAnalyticsConversationTopicSeriesPoint[] =
      bucketStarts.map((bucketStart) => {
        const key = bucketKeyIso(bucketStart);
        const topics = convPrimaryByBucket.get(key) ?? zeros;
        return {
          date: key,
          ...Object.fromEntries(TOPIC_ANALYTICS_KEYS.map((t) => [t, topics[t] ?? 0])) as Record<
            TopicTaxonomyId,
            number
          >,
        };
      });

    let fastestGrowingByMessages: FastestGrowingTopicItem[] = [];
    let fastestGrowingByConversations: FastestGrowingTopicItem[] = [];
    const prevWindow = previousEqualRange(q.from, q.to);
    if (prevWindow) {
      const prevMsg = await this.aggregateMessageTopicBreakdownMaps(
        oid,
        prevWindow.prevFrom,
        prevWindow.prevTo,
        q,
        messageTopicTagsResolved,
      );
      const prevConv = await this.aggregateConversationTopicBreakdownMaps(
        oid,
        prevWindow.prevFrom,
        prevWindow.prevTo,
        q,
      );

      fastestGrowingByMessages = computeFastestGrowingTopics(
        'messages',
        TOPIC_ANALYTICS_KEYS,
        labelForTopicId,
        topicMsgMap,
        topicConvFromMessagesMap,
        prevMsg.topicMsgMap,
        prevMsg.topicConvFromMessagesMap,
        10,
      );

      fastestGrowingByConversations = computeFastestGrowingTopics(
        'conversations',
        TOPIC_ANALYTICS_KEYS,
        labelForTopicId,
        new Map(),
        topicConvPrimaryMap,
        new Map(),
        prevConv,
        10,
      );
    }

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
        conversationsWithTopics,
        topTopic,
        topicCoverageRate,
      },
      topicBreakdownByMessages,
      topicBreakdownByConversations,
      topicMessageTimeSeries,
      topicConversationTimeSeries,
      fastestGrowingByMessages,
      fastestGrowingByConversations,
      topicSentimentBreakdown,
      timeSeries: topicMessageTimeSeries,
      conversationTopicSeries: topicConversationTimeSeries,
      topicBreakdown: topicBreakdownByMessages,
      fastestGrowingTopics: fastestGrowingByMessages,
    };
  }

  private mapTopicIntMap(
    rows: Array<{ _id: string; messages?: number; conversations?: number }> | undefined,
    field: 'messages' | 'conversations',
  ): Map<string, number> {
    const m = new Map<string, number>();
    for (const r of rows ?? []) {
      const k = String(r._id ?? '');
      if (!isTaxonomyTopicId(k)) continue;
      const v = Math.trunc((field === 'messages' ? r.messages : r.conversations) ?? 0);
      m.set(k, v);
    }
    return m;
  }

  private mapConversationBreakdown(rows: Array<{ _id: string; conversations?: number }> | undefined): Map<
    string,
    number
  > {
    const m = new Map<string, number>();
    for (const r of rows ?? []) {
      const k = String(r._id ?? '');
      if (!isTaxonomyTopicId(k)) continue;
      m.set(k, Math.trunc(r.conversations ?? 0));
    }
    return m;
  }

  private async runMessageTopicsAggregate(
    oid: Types.ObjectId,
    q: ParsedCustomerTopicsAnalyticsQuery,
    messageTopicTagsResolved: Record<string, unknown>,
  ): Promise<{
    summary: Array<{ totalUserMessages?: number; classifiedMessages?: number }>;
    convoWithTopics: Array<{ n?: number }>;
    bucketTotals: Array<{ _id: Date; classifiedMessages: number; unclassifiedMessages: number }>;
    mentionBuckets: Array<{ _id: { bucket: Date; topic: string }; messages: number }>;
    topicBreakdownCombined: Array<{ _id: string; messages: number; conversations: number }>;
    topicSentimentAgg: Array<{
      _id: string;
      positive?: number;
      neutral?: number;
      negative?: number;
      mixed?: number;
      unknown?: number;
    }>;
  }> {
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
          messageTopicTags: messageTopicTagsResolved,
        },
      },
      {
        $addFields: {
          isClassified: { $gt: [{ $size: { $ifNull: ['$messageTopicTags', []] } }, 0] },
        },
      },
    ];

    if (q.topic) {
      pipeline.push({ $match: { messageTopicTags: q.topic } });
    }

    pipeline.push({
      $facet: {
        summary: [
          {
            $group: {
              _id: null,
              totalUserMessages: { $sum: 1 },
              classifiedMessages: { $sum: { $cond: ['$isClassified', 1, 0] } },
            },
          },
        ],
        convoWithTopics: [
          {
            $match: {
              $expr: { $gt: [{ $size: { $ifNull: ['$messageTopicTags', []] } }, 0] },
            },
          },
          { $group: { _id: '$conversationId' } },
          { $count: 'n' },
        ],
        bucketTotals: [
          {
            $group: {
              _id: '$bucket',
              classifiedMessages: { $sum: { $cond: ['$isClassified', 1, 0] } },
              unclassifiedMessages: { $sum: { $cond: ['$isClassified', 0, 1] } },
            },
          },
        ],
        mentionBuckets: [
          {
            $match: {
              $expr: { $gt: [{ $size: { $ifNull: ['$messageTopicTags', []] } }, 0] },
            },
          },
          { $unwind: '$messageTopicTags' },
          {
            $group: {
              _id: { bucket: '$bucket', topic: '$messageTopicTags' },
              messages: { $sum: 1 },
            },
          },
        ],
        topicBreakdownCombined: [
          {
            $match: {
              $expr: { $gt: [{ $size: { $ifNull: ['$messageTopicTags', []] } }, 0] },
            },
          },
          { $unwind: '$messageTopicTags' },
          {
            $group: {
              _id: '$messageTopicTags',
              messages: { $sum: 1 },
              convIds: { $addToSet: '$conversationId' },
            },
          },
          {
            $project: {
              _id: 1,
              messages: 1,
              conversations: { $size: '$convIds' },
            },
          },
        ],
        topicSentimentAgg: [
          {
            $match: {
              $expr: { $gt: [{ $size: { $ifNull: ['$messageTopicTags', []] } }, 0] },
            },
          },
          {
            $addFields: {
              sentNorm: {
                $let: {
                  vars: {
                    lb: {
                      $toLower: {
                        $trim: { input: { $toString: { $ifNull: ['$sentiment.label', ''] } } },
                      },
                    },
                  },
                  in: {
                    $switch: {
                      branches: [
                        { case: { $eq: ['$$lb', 'positive'] }, then: 'positive' },
                        { case: { $eq: ['$$lb', 'neutral'] }, then: 'neutral' },
                        { case: { $eq: ['$$lb', 'negative'] }, then: 'negative' },
                        { case: { $eq: ['$$lb', 'mixed'] }, then: 'mixed' },
                        { case: { $eq: ['$$lb', 'unknown'] }, then: 'unknown' },
                      ],
                      default: 'unknown',
                    },
                  },
                },
              },
            },
          },
          { $unwind: '$messageTopicTags' },
          {
            $group: {
              _id: '$messageTopicTags',
              positive: { $sum: { $cond: [{ $eq: ['$sentNorm', 'positive'] }, 1, 0] } },
              neutral: { $sum: { $cond: [{ $eq: ['$sentNorm', 'neutral'] }, 1, 0] } },
              negative: { $sum: { $cond: [{ $eq: ['$sentNorm', 'negative'] }, 1, 0] } },
              mixed: { $sum: { $cond: [{ $eq: ['$sentNorm', 'mixed'] }, 1, 0] } },
              unknown: { $sum: { $cond: [{ $eq: ['$sentNorm', 'unknown'] }, 1, 0] } },
            },
          },
        ],
      },
    });

    const rows = await this.messageModel.aggregate<{
      summary: Array<{ totalUserMessages?: number; classifiedMessages?: number }>;
      convoWithTopics: Array<{ n?: number }>;
      bucketTotals: Array<{
        _id: Date;
        classifiedMessages: number;
        unclassifiedMessages: number;
      }>;
      mentionBuckets: Array<{ _id: { bucket: Date; topic: string }; messages: number }>;
      topicBreakdownCombined: Array<{ _id: string; messages: number; conversations: number }>;
      topicSentimentAgg: Array<{
        _id: string;
        positive?: number;
        neutral?: number;
        negative?: number;
        mixed?: number;
        unknown?: number;
      }>;
    }>(pipeline);

    return (
      rows[0] ?? {
        summary: [],
        convoWithTopics: [],
        bucketTotals: [],
        mentionBuckets: [],
        topicBreakdownCombined: [],
        topicSentimentAgg: [],
      }
    );
  }

  private async runConversationTopicsAggregate(
    oid: Types.ObjectId,
    q: ParsedCustomerTopicsAnalyticsQuery,
  ): Promise<{
    topicBreakdownRows: Array<{ _id: string; conversations: number }>;
    bucketRows: Array<{ _id: { bucket: Date; topic: string }; conversations: number }>;
    totalWithPrimary: Array<{ n?: number }>;
  }> {
    const pipeline = this.conversationTopicsPipeline(oid, q.from, q.to, q);
    const rows = await this.conversationModel.aggregate<{
      topicBreakdownRows: Array<{ _id: string; conversations: number }>;
      bucketRows: Array<{ _id: { bucket: Date; topic: string }; conversations: number }>;
      totalWithPrimary: Array<{ n?: number }>;
    }>(pipeline);

    return (
      rows[0] ?? {
        topicBreakdownRows: [],
        bucketRows: [],
        totalWithPrimary: [],
      }
    );
  }

  private conversationTopicsPipeline(
    oid: Types.ObjectId,
    from: Date,
    to: Date,
    q: ParsedCustomerTopicsAnalyticsQuery,
  ): PipelineStage[] {
    const stages: PipelineStage[] = [
      { $match: { botId: oid } },
      {
        $addFields: {
          __convAt: { $ifNull: ['$startedAt', '$createdAt'] },
        },
      },
      {
        $match: {
          __convAt: { $gte: from, $lte: to },
        },
      },
    ];

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

    stages.push({
      $addFields: {
        bucket: dateTruncStage('__convAt', q.granularity),
        primaryTopicNorm: conversationPrimaryTopicNormExpr,
      },
    });

    stages.push({
      $match: {
        $expr: {
          $and: [
            { $ne: ['$primaryTopicNorm', null] },
            { $in: ['$primaryTopicNorm', TOPIC_IDS_MONGO_LITERAL] },
          ],
        },
      },
    });

    if (q.topic) {
      stages.push({
        $match: {
          $expr: { $eq: ['$primaryTopicNorm', q.topic] },
        },
      });
    }

    stages.push({
      $facet: {
        topicBreakdownRows: [
          {
            $group: {
              _id: '$primaryTopicNorm',
              conversations: { $sum: 1 },
            },
          },
        ],
        bucketRows: [
          {
            $group: {
              _id: { bucket: '$bucket', topic: '$primaryTopicNorm' },
              conversations: { $sum: 1 },
            },
          },
        ],
        totalWithPrimary: [{ $count: 'n' }],
      },
    });

    return stages;
  }

  private async aggregateMessageTopicBreakdownMaps(
    oid: Types.ObjectId,
    from: Date,
    to: Date,
    q: ParsedCustomerTopicsAnalyticsQuery,
    messageTopicTagsResolved: Record<string, unknown>,
  ): Promise<{ topicMsgMap: Map<string, number>; topicConvFromMessagesMap: Map<string, number> }> {
    const pipeline: PipelineStage[] = [
      {
        $match: {
          botId: oid,
          role: 'user',
          createdAt: { $gte: from, $lte: to },
        },
      },
      ...this.messageLookupPipeline(q),
      {
        $addFields: {
          messageTopicTags: messageTopicTagsResolved,
        },
      },
    ];

    if (q.topic) {
      pipeline.push({ $match: { messageTopicTags: q.topic } });
    }

    pipeline.push({
      $facet: {
        topicBreakdownCombined: [
          {
            $match: {
              $expr: { $gt: [{ $size: { $ifNull: ['$messageTopicTags', []] } }, 0] },
            },
          },
          { $unwind: '$messageTopicTags' },
          {
            $group: {
              _id: '$messageTopicTags',
              messages: { $sum: 1 },
              convIds: { $addToSet: '$conversationId' },
            },
          },
          {
            $project: {
              _id: 1,
              messages: 1,
              conversations: { $size: '$convIds' },
            },
          },
        ],
      },
    });

    const rows = await this.messageModel.aggregate<{
      topicBreakdownCombined: Array<{ _id: string; messages: number; conversations: number }>;
    }>(pipeline);

    const row = rows[0] ?? { topicBreakdownCombined: [] };
    return {
      topicMsgMap: this.mapTopicIntMap(row.topicBreakdownCombined, 'messages'),
      topicConvFromMessagesMap: this.mapTopicIntMap(row.topicBreakdownCombined, 'conversations'),
    };
  }

  private async aggregateConversationTopicBreakdownMaps(
    oid: Types.ObjectId,
    from: Date,
    to: Date,
    q: ParsedCustomerTopicsAnalyticsQuery,
  ): Promise<Map<string, number>> {
    const pipeline = this.conversationTopicsPipeline(oid, from, to, q);
    const rows = await this.conversationModel.aggregate<{
      topicBreakdownRows: Array<{ _id: string; conversations: number }>;
    }>(pipeline);
    const row = rows[0] ?? { topicBreakdownRows: [] };
    return this.mapConversationBreakdown(row.topicBreakdownRows);
  }

  private messageLookupPipeline(q: ParsedCustomerTopicsAnalyticsQuery): PipelineStage[] {
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
