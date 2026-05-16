import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage, Types } from 'mongoose';
import { Message } from '../models';
import {
  PREVIEW_STARTED_FROM_VALUES,
  alignBucketStart,
  bucketKeyIso,
  enumerateBucketStarts,
  mongoDateTruncUnit,
  type CustomerChatsGranularity,
} from './customer-chats-analytics.util';
import {
  divideOrNull,
  knowledgeSourceTypeLabel,
  normalizeKnowledgeSourceTypeForBreakdown,
  parseCustomerKnowledgeSourcesAnalyticsQuery,
  safeKnowledgeSourceUrlForAnalytics,
  sortKnowledgeSourceTypeKeys,
  type CustomerKnowledgeSourcesAnalyticsQueryInput,
  type KnowledgeMessageSourceType,
  type ParsedCustomerKnowledgeSourcesAnalyticsQuery,
} from './customer-knowledge-sources-analytics.util';

export type CustomerKnowledgeSourcesAnalyticsResponse = {
  range: {
    from: string;
    to: string;
    granularity: CustomerChatsGranularity;
  };
  summary: {
    totalAssistantMessages: number;
    messagesWithSources: number;
    messagesWithoutSources: number;
    totalSourceUses: number;
    uniqueSourcesUsed: number;
    averageSourcesPerAnswer: number | null;
    averageSourceMatchScore: number | null;
    fallbackAnswers: number;
  };
  timeSeries: Array<{
    date: string;
    assistantMessages: number;
    messagesWithSources: number;
    messagesWithoutSources: number;
    sourceUses: number;
    averageSourceMatchScore: number | null;
  }>;
  sourceTypeBreakdown: Array<{
    sourceType: KnowledgeMessageSourceType;
    label: string;
    sourceUses: number;
    uniqueSources: number;
    assistantMessages: number;
    averageScore: number | null;
  }>;
  topSources: Array<{
    knowledgeBaseItemId: string | null;
    sourceTitle: string | null;
    sourceType: KnowledgeMessageSourceType;
    sourceUrl: string | null;
    sourceUses: number;
    assistantMessages: number;
    averageScore: number | null;
    lastUsedAt: string | null;
  }>;
  noSourceBreakdown: {
    messagesWithoutSources: number;
    fallbackAnswers: number;
  };
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

function roundScore(n: number | null): number | null {
  if (n == null || !Number.isFinite(n)) return null;
  return Math.round(n * 10_000) / 10_000;
}

function roundMetric(n: number | null): number | null {
  if (n == null || !Number.isFinite(n)) return null;
  return Math.round(n * 10_000) / 10_000;
}

@Injectable()
export class CustomerKnowledgeSourcesAnalyticsService {
  constructor(@InjectModel(Message.name) private readonly messageModel: Model<Message>) {}

  async get(
    botId: string,
    queryIn: CustomerKnowledgeSourcesAnalyticsQueryInput,
  ): Promise<CustomerKnowledgeSourcesAnalyticsResponse> {
    const q = parseCustomerKnowledgeSourcesAnalyticsQuery(queryIn);
    const oid = new Types.ObjectId(botId);

    const [summaryRow, uniqueRow, tsRows, typeRows, topRows] = await Promise.all([
      this.aggregateSummary(oid, q),
      this.aggregateUniqueSources(oid, q),
      this.aggregateTimeSeries(oid, q),
      this.aggregateSourceTypeBreakdown(oid, q),
      this.aggregateTopSources(oid, q),
    ]);

    const totalAssistantMessages = summaryRow?.totalAssistantMessages ?? 0;
    const messagesWithSources = summaryRow?.messagesWithSources ?? 0;
    const messagesWithoutSources = summaryRow?.messagesWithoutSources ?? 0;
    const totalSourceUses = summaryRow?.totalSourceUses ?? 0;
    const fallbackAnswers = summaryRow?.fallbackAnswers ?? 0;
    const scoreSumAll = summaryRow?.scoreSumAll ?? 0;
    const scoreCountAll = summaryRow?.scoreCountAll ?? 0;

    const uniqueSourcesUsed = uniqueRow?.n ?? 0;
    const averageSourcesPerAnswer = divideOrNull(totalSourceUses, totalAssistantMessages);
    const averageSourceMatchScore =
      scoreCountAll > 0 ? roundScore(scoreSumAll / scoreCountAll) : null;

    const typeKeys = sortKnowledgeSourceTypeKeys(
      typeRows.map((r) => normalizeKnowledgeSourceTypeForBreakdown(String(r._id))),
    );
    const sourceTypeBreakdown = typeKeys.map((k) => {
      const row = typeRows.find((x) => normalizeKnowledgeSourceTypeForBreakdown(String(x._id)) === k);
      const scoreN = row?.scoreN ?? 0;
      const scoreSum = row?.scoreSum ?? 0;
      return {
        sourceType: k,
        label: knowledgeSourceTypeLabel(k),
        sourceUses: row?.sourceUses ?? 0,
        uniqueSources: row?.uniqueSources ?? 0,
        assistantMessages: row?.assistantMessages ?? 0,
        averageScore: scoreN > 0 ? roundScore(scoreSum / scoreN) : null,
      };
    });

    const bucketStarts = enumerateBucketStarts(q.from, q.to, q.granularity);
    const tsMap = new Map(
      tsRows.map((r) => [bucketKeyIso(alignBucketStart(r._id, q.granularity)), r]),
    );

    const timeSeries = bucketStarts.map((bucketStart) => {
      const key = bucketKeyIso(bucketStart);
      const row = tsMap.get(key);
      const sn = row?.scoreN ?? 0;
      const ss = row?.scoreSum ?? 0;
      return {
        date: key,
        assistantMessages: row?.assistantMessages ?? 0,
        messagesWithSources: row?.messagesWithSources ?? 0,
        messagesWithoutSources: row?.messagesWithoutSources ?? 0,
        sourceUses: row?.sourceUses ?? 0,
        averageSourceMatchScore: sn > 0 ? roundScore(ss / sn) : null,
      };
    });

    const topSources = topRows.map((r) => ({
      knowledgeBaseItemId:
        r.knowledgeBaseItemId instanceof Types.ObjectId
          ? r.knowledgeBaseItemId.toString()
          : r.knowledgeBaseItemId != null
            ? String(r.knowledgeBaseItemId)
            : null,
      sourceTitle: r.sourceTitleTrim?.trim() ? r.sourceTitleTrim.trim().slice(0, 512) : null,
      sourceType: normalizeKnowledgeSourceTypeForBreakdown(r.sourceTypeRaw),
      sourceUrl: safeKnowledgeSourceUrlForAnalytics(r.sourceUrlRaw),
      sourceUses: r.sourceUses,
      assistantMessages: r.assistantMessages,
      averageScore: r.scoreN > 0 ? roundScore(r.scoreSum / r.scoreN) : null,
      lastUsedAt: r.lastUsedAt ? new Date(r.lastUsedAt).toISOString() : null,
    }));

    return {
      range: {
        from: q.from.toISOString(),
        to: q.to.toISOString(),
        granularity: q.granularity,
      },
      summary: {
        totalAssistantMessages,
        messagesWithSources,
        messagesWithoutSources,
        totalSourceUses,
        uniqueSourcesUsed,
        averageSourcesPerAnswer: roundMetric(averageSourcesPerAnswer),
        averageSourceMatchScore,
        fallbackAnswers,
      },
      timeSeries,
      sourceTypeBreakdown,
      topSources,
      noSourceBreakdown: {
        messagesWithoutSources,
        fallbackAnswers,
      },
    };
  }

  private sourcesForUsesExpr(q: ParsedCustomerKnowledgeSourcesAnalyticsQuery): Record<string, unknown> {
    const arr: Record<string, unknown> = { $ifNull: ['$sources', []] };
    if (!q.sourceType) {
      return arr;
    }
    if (q.sourceType === 'unknown') {
      return {
        $filter: {
          input: arr,
          as: 's',
          cond: {
            $or: [
              { $eq: [{ $type: '$$s.sourceType' }, 'missing'] },
              { $eq: ['$$s.sourceType', null] },
              { $eq: ['$$s.sourceType', ''] },
              { $eq: ['$$s.sourceType', 'unknown'] },
            ],
          },
        },
      };
    }
    return {
      $filter: {
        input: arr,
        as: 's',
        cond: { $eq: ['$$s.sourceType', q.sourceType] },
      },
    };
  }

  private assistantBaseStages(
    botId: Types.ObjectId,
    q: ParsedCustomerKnowledgeSourcesAnalyticsQuery,
  ): PipelineStage[] {
    return [
      {
        $match: {
          botId,
          role: 'assistant',
          createdAt: { $gte: q.from, $lte: q.to },
        },
      },
      {
        $lookup: {
          from: 'conversations',
          localField: 'conversationId',
          foreignField: '_id',
          as: '_conv',
        },
      },
      { $unwind: { path: '$_conv', preserveNullAndEmptyArrays: false } },
      ...(q.includePreview
        ? []
        : [
            {
              $match: {
                '_conv.startedFrom': { $nin: [...PREVIEW_STARTED_FROM_VALUES] },
              },
            } as PipelineStage,
          ]),
    ];
  }

  private enrichForFilteredUsesStages(
    q: ParsedCustomerKnowledgeSourcesAnalyticsQuery,
  ): PipelineStage[] {
    const expr = this.sourcesForUsesExpr(q);
    return [
      {
        $addFields: {
          sourcesForUses: expr,
          sourcesArr: { $ifNull: ['$sources', []] },
          hasAnySource: { $gt: [{ $size: { $ifNull: ['$sources', []] } }, 0] },
        },
      },
      {
        $addFields: {
          usesCount: { $size: '$sourcesForUses' },
          scoreSum: {
            $reduce: {
              input: '$sourcesForUses',
              initialValue: 0,
              in: {
                $add: [
                  '$$value',
                  {
                    $cond: [
                      {
                        $and: [
                          { $ne: ['$$this.score', null] },
                          {
                            $in: [{ $type: '$$this.score' }, ['double', 'int', 'long', 'decimal']],
                          },
                        ],
                      },
                      { $toDouble: '$$this.score' },
                      0,
                    ],
                  },
                ],
              },
            },
          },
          scoreCount: {
            $reduce: {
              input: '$sourcesForUses',
              initialValue: 0,
              in: {
                $add: [
                  '$$value',
                  {
                    $cond: [
                      {
                        $and: [
                          { $ne: ['$$this.score', null] },
                          {
                            $in: [{ $type: '$$this.score' }, ['double', 'int', 'long', 'decimal']],
                          },
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                ],
              },
            },
          },
        },
      },
    ];
  }

  private async aggregateSummary(
    botId: Types.ObjectId,
    q: ParsedCustomerKnowledgeSourcesAnalyticsQuery,
  ): Promise<{
    totalAssistantMessages: number;
    messagesWithSources: number;
    messagesWithoutSources: number;
    totalSourceUses: number;
    fallbackAnswers: number;
    scoreSumAll: number;
    scoreCountAll: number;
  } | null> {
    const pipeline: PipelineStage[] = [
      ...this.assistantBaseStages(botId, q),
      ...this.enrichForFilteredUsesStages(q),
      {
        $group: {
          _id: null,
          totalAssistantMessages: { $sum: 1 },
          messagesWithSources: { $sum: { $cond: ['$hasAnySource', 1, 0] } },
          messagesWithoutSources: { $sum: { $cond: ['$hasAnySource', 0, 1] } },
          totalSourceUses: { $sum: '$usesCount' },
          fallbackAnswers: { $sum: { $cond: [{ $eq: ['$aiMeta.fallbackUsed', true] }, 1, 0] } },
          scoreSumAll: { $sum: '$scoreSum' },
          scoreCountAll: { $sum: '$scoreCount' },
        },
      },
    ];
    const rows = await this.messageModel.aggregate<{
      totalAssistantMessages: number;
      messagesWithSources: number;
      messagesWithoutSources: number;
      totalSourceUses: number;
      fallbackAnswers: number;
      scoreSumAll: number;
      scoreCountAll: number;
    }>(pipeline);
    return rows[0] ?? null;
  }

  private topSourceKeyExpr(): Record<string, unknown> {
    return {
      $cond: [
        { $ne: ['$sourcesForUses.knowledgeBaseItemId', null] },
        { $concat: ['id:', { $toString: '$sourcesForUses.knowledgeBaseItemId' }] },
        {
          $concat: [
            't:',
            { $ifNull: ['$sourcesForUses.sourceType', 'unknown'] },
            ':',
            { $ifNull: ['$sourcesForUses.sourceTitle', ''] },
          ],
        },
      ],
    };
  }

  private async aggregateUniqueSources(
    botId: Types.ObjectId,
    q: ParsedCustomerKnowledgeSourcesAnalyticsQuery,
  ): Promise<{ n: number } | null> {
    const pipeline: PipelineStage[] = [
      ...this.assistantBaseStages(botId, q),
      ...this.enrichForFilteredUsesStages(q),
      { $match: { usesCount: { $gt: 0 } } },
      { $unwind: '$sourcesForUses' },
      { $group: { _id: this.topSourceKeyExpr() } },
      { $count: 'n' },
    ];
    const rows = await this.messageModel.aggregate<{ n: number }>(pipeline);
    return rows[0] ?? { n: 0 };
  }

  private async aggregateTimeSeries(
    botId: Types.ObjectId,
    q: ParsedCustomerKnowledgeSourcesAnalyticsQuery,
  ): Promise<
    Array<{
      _id: Date;
      assistantMessages: number;
      messagesWithSources: number;
      messagesWithoutSources: number;
      sourceUses: number;
      scoreSum: number;
      scoreN: number;
    }>
  > {
    const pipeline: PipelineStage[] = [
      ...this.assistantBaseStages(botId, q),
      ...this.enrichForFilteredUsesStages(q),
      {
        $addFields: {
          bucket: dateTruncStage('createdAt', q.granularity),
        },
      },
      {
        $group: {
          _id: '$bucket',
          assistantMessages: { $sum: 1 },
          messagesWithSources: { $sum: { $cond: ['$hasAnySource', 1, 0] } },
          messagesWithoutSources: { $sum: { $cond: ['$hasAnySource', 0, 1] } },
          sourceUses: { $sum: '$usesCount' },
          scoreSum: { $sum: '$scoreSum' },
          scoreN: { $sum: '$scoreCount' },
        },
      },
    ];
    return this.messageModel.aggregate(pipeline);
  }

  private breakdownKeyExpr(): Record<string, unknown> {
    return {
      $cond: [
        { $ne: ['$sourcesArr.knowledgeBaseItemId', null] },
        { $concat: ['id:', { $toString: '$sourcesArr.knowledgeBaseItemId' }] },
        {
          $concat: [
            't:',
            { $ifNull: ['$sourcesArr.sourceType', 'unknown'] },
            ':',
            { $ifNull: ['$sourcesArr.sourceTitle', ''] },
          ],
        },
      ],
    };
  }

  private async aggregateSourceTypeBreakdown(
    botId: Types.ObjectId,
    q: ParsedCustomerKnowledgeSourcesAnalyticsQuery,
  ): Promise<
    Array<{
      _id: string;
      sourceUses: number;
      uniqueSources: number;
      assistantMessages: number;
      scoreSum: number;
      scoreN: number;
    }>
  > {
    const pipeline: PipelineStage[] = [
      ...this.assistantBaseStages(botId, q),
      {
        $addFields: {
          sourcesArr: { $ifNull: ['$sources', []] },
        },
      },
      { $match: { $expr: { $gt: [{ $size: '$sourcesArr' }, 0] } } },
      { $unwind: '$sourcesArr' },
      {
        $addFields: {
          breakdownType: {
            $cond: [
              {
                $or: [
                  { $eq: [{ $type: '$sourcesArr.sourceType' }, 'missing'] },
                  { $eq: ['$sourcesArr.sourceType', null] },
                  { $eq: ['$sourcesArr.sourceType', ''] },
                ],
              },
              'unknown',
              '$sourcesArr.sourceType',
            ],
          },
          _breakdownUniq: this.breakdownKeyExpr(),
        },
      },
      {
        $group: {
          _id: '$breakdownType',
          sourceUses: { $sum: 1 },
          uniqKeys: { $addToSet: '$_breakdownUniq' },
          assistantMsgIds: { $addToSet: '$_id' },
          scoreSum: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ['$sourcesArr.score', null] },
                    {
                      $in: [{ $type: '$sourcesArr.score' }, ['double', 'int', 'long', 'decimal']],
                    },
                  ],
                },
                { $toDouble: '$sourcesArr.score' },
                0,
              ],
            },
          },
          scoreN: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ['$sourcesArr.score', null] },
                    {
                      $in: [{ $type: '$sourcesArr.score' }, ['double', 'int', 'long', 'decimal']],
                    },
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
        $project: {
          _id: 1,
          sourceUses: 1,
          uniqueSources: { $size: '$uniqKeys' },
          assistantMessages: { $size: '$assistantMsgIds' },
          scoreSum: 1,
          scoreN: 1,
        },
      },
    ];
    return this.messageModel.aggregate(pipeline);
  }

  private async aggregateTopSources(
    botId: Types.ObjectId,
    q: ParsedCustomerKnowledgeSourcesAnalyticsQuery,
  ): Promise<
    Array<{
      sourceUses: number;
      knowledgeBaseItemId: Types.ObjectId | null;
      sourceTitleTrim: string | null;
      sourceTypeRaw: string | null;
      sourceUrlRaw: string | null;
      scoreSum: number;
      scoreN: number;
      lastUsedAt: Date | null;
      assistantMessages: number;
    }>
  > {
    const pipeline: PipelineStage[] = [
      ...this.assistantBaseStages(botId, q),
      ...this.enrichForFilteredUsesStages(q),
      { $match: { usesCount: { $gt: 0 } } },
      { $unwind: '$sourcesForUses' },
      {
        $group: {
          _id: this.topSourceKeyExpr(),
          sourceUses: { $sum: 1 },
          knowledgeBaseItemId: { $first: '$sourcesForUses.knowledgeBaseItemId' },
          sourceTitleTrim: { $first: '$sourcesForUses.sourceTitle' },
          sourceTypeRaw: { $first: '$sourcesForUses.sourceType' },
          sourceUrlRaw: { $first: '$sourcesForUses.sourceUrl' },
          lastUsedAt: {
            $max: { $ifNull: ['$sourcesForUses.usedAt', '$createdAt'] },
          },
          assistantMsgIds: { $addToSet: '$_id' },
          scoreSum: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ['$sourcesForUses.score', null] },
                    {
                      $in: [
                        { $type: '$sourcesForUses.score' },
                        ['double', 'int', 'long', 'decimal'],
                      ],
                    },
                  ],
                },
                { $toDouble: '$sourcesForUses.score' },
                0,
              ],
            },
          },
          scoreN: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ['$sourcesForUses.score', null] },
                    {
                      $in: [
                        { $type: '$sourcesForUses.score' },
                        ['double', 'int', 'long', 'decimal'],
                      ],
                    },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
      { $sort: { sourceUses: -1 } },
      { $limit: 50 },
      {
        $project: {
          _id: 0,
          sourceUses: 1,
          knowledgeBaseItemId: 1,
          sourceTitleTrim: 1,
          sourceTypeRaw: 1,
          sourceUrlRaw: 1,
          scoreSum: 1,
          scoreN: 1,
          lastUsedAt: 1,
          assistantMessages: { $size: '$assistantMsgIds' },
        },
      },
    ];
    return this.messageModel.aggregate(pipeline);
  }
}
