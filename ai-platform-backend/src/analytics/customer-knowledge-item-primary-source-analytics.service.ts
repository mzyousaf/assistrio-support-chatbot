import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage, Types } from 'mongoose';
import { Message } from '../models';
import type { KnowledgeBaseItemSourceType } from '../models/knowledge-base-item.schema';
import { KnowledgeBaseItemService } from '../knowledge/knowledge-base-item.service';
import {
  PREVIEW_STARTED_FROM_VALUES,
  alignBucketStart,
  applyStartedFromToMessageLookup,
  bucketKeyIso,
  enumerateBucketStarts,
  mongoDateTruncUnit,
  type CustomerChatsGranularity,
} from './customer-chats-analytics.util';
import { assistantPrimarySourceElementExpr } from './customer-agent-resources-primary-source.util';
import {
  type CustomerAgentResourcesAnalyticsQueryInput,
  parseCustomerAgentResourcesAnalyticsQuery,
  type ParsedCustomerAgentResourcesAnalyticsQuery,
} from './customer-agent-resources-analytics.util';
import {
  normalizeKnowledgeSourceTypeForBreakdown,
  safeKnowledgeSourceUrlForAnalytics,
  type KnowledgeMessageSourceType,
} from './customer-knowledge-sources-analytics.util';

function dateTruncStage(dateField: string, granularity: CustomerChatsGranularity): Record<string, unknown> {
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

function kbSchemaSourceTypeToAnalyticsRaw(t: KnowledgeBaseItemSourceType | string | undefined): string {
  const x = String(t ?? '').trim().toLowerCase();
  if (x === 'table') return 'datasheet';
  if (x === 'url' || x === 'html') return 'website';
  return x;
}

export type CustomerKnowledgeItemPrimarySourceAnalyticsSourceDto = {
  knowledgeBaseItemId: string;
  sourceTitle: string | null;
  sourceType: KnowledgeMessageSourceType;
  safeUrl: string | null;
};

export type CustomerKnowledgeItemPrimarySourceAnalyticsSummaryDto = {
  primarySourceUses: number;
  conversations: number;
  averagePrimarySourceScore: number | null;
  lastUsedAt: string | null;
};

export type CustomerKnowledgeItemPrimarySourceAnalyticsTimePointDto = {
  date: string;
  primarySourceUses: number;
  conversations: number;
  averageScore: number | null;
};

export type CustomerKnowledgeItemPrimarySourceAnalyticsResponseDto = {
  source: CustomerKnowledgeItemPrimarySourceAnalyticsSourceDto;
  summary: CustomerKnowledgeItemPrimarySourceAnalyticsSummaryDto;
  timeSeries: CustomerKnowledgeItemPrimarySourceAnalyticsTimePointDto[];
};

@Injectable()
export class CustomerKnowledgeItemPrimarySourceAnalyticsService {
  constructor(
    @InjectModel(Message.name) private readonly messageModel: Model<Message>,
    private readonly knowledgeBaseItemService: KnowledgeBaseItemService,
  ) {}

  async get(
    botId: string,
    itemId: string,
    queryIn: CustomerAgentResourcesAnalyticsQueryInput,
  ): Promise<CustomerKnowledgeItemPrimarySourceAnalyticsResponseDto> {
    if (!Types.ObjectId.isValid(botId)) {
      throw new BadRequestException({ error: 'Invalid AI Agent id', errorCode: 'INVALID_BOT_ID' });
    }
    if (!Types.ObjectId.isValid(itemId)) {
      throw new BadRequestException({ error: 'Invalid knowledge item id', errorCode: 'INVALID_KB_ITEM_ID' });
    }

    const botOid = new Types.ObjectId(botId);
    const itemOid = new Types.ObjectId(itemId);
    const q = parseCustomerAgentResourcesAnalyticsQuery(queryIn);

    const row = await this.knowledgeBaseItemService.findKnowledgeItemById(itemId);
    if (!row || String(row.botId) !== String(botOid)) {
      throw new NotFoundException({ error: 'Knowledge item not found', errorCode: 'KB_ITEM_NOT_FOUND' });
    }

    const titleTrim = typeof row.title === 'string' && row.title.trim() ? row.title.trim().slice(0, 512) : null;
    const rawUrlCandidates = [
      typeof row.fileMeta?.url === 'string' ? row.fileMeta.url.trim() : '',
      typeof row.source?.url === 'string' ? row.source.url.trim() : '',
    ].filter(Boolean);
    let safeUrl: string | null = null;
    for (const u of rawUrlCandidates) {
      safeUrl = safeKnowledgeSourceUrlForAnalytics(u);
      if (safeUrl) break;
    }

    const source: CustomerKnowledgeItemPrimarySourceAnalyticsSourceDto = {
      knowledgeBaseItemId: itemOid.toString(),
      sourceTitle: titleTrim,
      sourceType: normalizeKnowledgeSourceTypeForBreakdown(kbSchemaSourceTypeToAnalyticsRaw(row.sourceType)),
      safeUrl,
    };

    const [summaryRow, tsRows] = await Promise.all([
      this.aggregateSummary(botOid, itemOid, q),
      this.aggregateTimeSeries(botOid, itemOid, q),
    ]);

    const primarySourceUses = Math.max(0, Math.trunc(summaryRow?.primarySourceUses ?? 0));
    const conversations = Math.max(0, Math.trunc(summaryRow?.conversations ?? 0));
    const scoreSum = summaryRow?.scoreSum ?? 0;
    const scoreN = summaryRow?.scoreN ?? 0;
    const lastUsedAt =
      summaryRow?.lastUsedAt instanceof Date && Number.isFinite(summaryRow.lastUsedAt.getTime())
        ? summaryRow.lastUsedAt.toISOString()
        : null;

    const bucketStarts = enumerateBucketStarts(q.from, q.to, q.granularity);
    const tsMap = new Map(tsRows.map((r) => [bucketKeyIso(alignBucketStart(r._id, q.granularity)), r]));

    const timeSeries: CustomerKnowledgeItemPrimarySourceAnalyticsTimePointDto[] = bucketStarts.map((bucketStart) => {
      const key = bucketKeyIso(bucketStart);
      const tr = tsMap.get(key);
      const uses = Math.max(0, Math.trunc(tr?.primarySourceUses ?? 0));
      const conv = Math.max(0, Math.trunc(tr?.conversations ?? 0));
      const tsScoreN = tr?.scoreN ?? 0;
      const tsScoreSum = tr?.scoreSum ?? 0;
      return {
        date: key,
        primarySourceUses: uses,
        conversations: conv,
        averageScore: tsScoreN > 0 ? roundScore(tsScoreSum / tsScoreN) : null,
      };
    });

    return {
      source,
      summary: {
        primarySourceUses,
        conversations,
        averagePrimarySourceScore: scoreN > 0 ? roundScore(scoreSum / scoreN) : null,
        lastUsedAt,
      },
      timeSeries,
    };
  }

  private baseStages(botOid: Types.ObjectId, itemOid: Types.ObjectId, q: ParsedCustomerAgentResourcesAnalyticsQuery): PipelineStage[] {
    const stages: PipelineStage[] = [
      {
        $match: {
          botId: botOid,
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
    ];

    const matchParts: Record<string, unknown> = {};
    if (!q.includePreview) {
      matchParts['_conv.startedFrom'] = { $nin: [...PREVIEW_STARTED_FROM_VALUES] };
    }
    applyStartedFromToMessageLookup(matchParts, stages, '_conv.startedFrom', q.startedFrom);
    if (Object.keys(matchParts).length > 0) {
      stages.push({ $match: matchParts });
    }

    stages.push({
      $addFields: {
        sourcesArr: { $ifNull: ['$sources', []] },
      },
    });
    stages.push({
      $addFields: {
        primarySourceElem: assistantPrimarySourceElementExpr(),
      },
    });
    stages.push({
      $addFields: {
        scorePrimaryNumeric: {
          $cond: [
            {
              $and: [
                { $ne: ['$primarySourceElem', null] },
                { $ne: ['$primarySourceElem.score', null] },
                {
                  $in: [{ $type: '$primarySourceElem.score' }, ['double', 'int', 'long', 'decimal']],
                },
              ],
            },
            { $toDouble: '$primarySourceElem.score' },
            null,
          ],
        },
      },
    });
    stages.push({
      $match: {
        $expr: {
          $and: [
            { $ne: ['$primarySourceElem', null] },
            { $eq: ['$primarySourceElem.knowledgeBaseItemId', itemOid] },
          ],
        },
      },
    });

    return stages;
  }

  private async aggregateSummary(
    botOid: Types.ObjectId,
    itemOid: Types.ObjectId,
    q: ParsedCustomerAgentResourcesAnalyticsQuery,
  ): Promise<{
    primarySourceUses: number;
    conversations: number;
    scoreSum: number;
    scoreN: number;
    lastUsedAt: Date | null;
  } | null> {
    const pipeline: PipelineStage[] = [
      ...this.baseStages(botOid, itemOid, q),
      {
        $group: {
          _id: null,
          primarySourceUses: { $sum: 1 },
          conversationIds: { $addToSet: '$conversationId' },
          scoreSum: {
            $sum: {
              $cond: [{ $ne: ['$scorePrimaryNumeric', null] }, '$scorePrimaryNumeric', 0],
            },
          },
          scoreN: {
            $sum: {
              $cond: [{ $ne: ['$scorePrimaryNumeric', null] }, 1, 0],
            },
          },
          lastUsedAt: { $max: '$createdAt' },
        },
      },
      {
        $project: {
          _id: 0,
          primarySourceUses: 1,
          conversations: { $size: '$conversationIds' },
          scoreSum: 1,
          scoreN: 1,
          lastUsedAt: 1,
        },
      },
    ];

    const rows = await this.messageModel
      .aggregate<{
        primarySourceUses: number;
        conversations: number;
        scoreSum: number;
        scoreN: number;
        lastUsedAt: Date | null;
      }>(pipeline)
      .exec();
    return rows[0] ?? null;
  }

  private async aggregateTimeSeries(
    botOid: Types.ObjectId,
    itemOid: Types.ObjectId,
    q: ParsedCustomerAgentResourcesAnalyticsQuery,
  ): Promise<
    Array<{
      _id: Date;
      primarySourceUses: number;
      conversations: number;
      scoreSum: number;
      scoreN: number;
    }>
  > {
    const pipeline: PipelineStage[] = [
      ...this.baseStages(botOid, itemOid, q),
      {
        $addFields: {
          bucket: dateTruncStage('createdAt', q.granularity),
        },
      },
      {
        $group: {
          _id: '$bucket',
          primarySourceUses: { $sum: 1 },
          conversationIds: { $addToSet: '$conversationId' },
          scoreSum: {
            $sum: {
              $cond: [{ $ne: ['$scorePrimaryNumeric', null] }, '$scorePrimaryNumeric', 0],
            },
          },
          scoreN: {
            $sum: {
              $cond: [{ $ne: ['$scorePrimaryNumeric', null] }, 1, 0],
            },
          },
        },
      },
      {
        $project: {
          _id: 1,
          primarySourceUses: 1,
          conversations: { $size: '$conversationIds' },
          scoreSum: 1,
          scoreN: 1,
        },
      },
    ];

    return this.messageModel
      .aggregate<{
        _id: Date;
        primarySourceUses: number;
        conversations: number;
        scoreSum: number;
        scoreN: number;
      }>(pipeline)
      .exec();
  }
}
