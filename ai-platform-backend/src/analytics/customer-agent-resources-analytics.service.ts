import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage, Types } from 'mongoose';
import type { ChatMessageCreditRuleKey } from '../chat/chat-credit-rules.constant';
import { Message } from '../models';
import {
  PREVIEW_STARTED_FROM_VALUES,
  alignBucketStart,
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
  knowledgeSourceTypeLabel,
  normalizeKnowledgeSourceTypeForBreakdown,
  safeKnowledgeSourceUrlForAnalytics,
  sortKnowledgeSourceTypeKeys,
  type KnowledgeMessageSourceType,
} from './customer-knowledge-sources-analytics.util';
import { roundUsageCredits, CustomerUsageAnalyticsService } from './customer-usage-analytics.service';
import type { CustomerUsageAnalyticsResponse } from './customer-usage-analytics.service';
import {
  buildCustomerUsageCreditRulesPayload,
  buildUsageComponentDisplayRowsFromAccumulator,
  emptyComponentAccumulator,
  sumBillableUsageComponentCredits,
  type ComponentBreakdownAccumulator,
  type UsageComponentDisplayRowDto,
} from './customer-usage-credit-breakdown-lines.util';

export type UsageCreditRuleRow = {
  usageType: ChatMessageCreditRuleKey;
  label: string;
  credits: number;
  enabled: boolean;
  /** True when credits for this modality count toward message `creditCost` / rollup totals */
  billable: boolean;
  /** When false, analytic splits treat charged credits from this modality as 0 while still exposing `credits` for UX. */
  includeInTotalCredits: boolean;
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

function buildUsageCreditRulesForResponse(): UsageCreditRuleRow[] {
  return buildCustomerUsageCreditRulesPayload().map((r) => ({
    usageType: r.key as ChatMessageCreditRuleKey,
    label: r.label,
    credits: r.credits,
    enabled: r.enabled,
    billable: r.billable,
    includeInTotalCredits: r.includeInTotalCredits,
  }));
}

function componentAccumulatorFromBreakdownSummary(
  cs: CustomerUsageAnalyticsResponse['componentBreakdownSummary'],
): ComponentBreakdownAccumulator {
  const acc = emptyComponentAccumulator();
  acc.textMessages = cs.textMessages;
  acc.voiceMessages = cs.voiceMessages;
  acc.dictationSessions = cs.dictationSessions;
  acc.suggestedQuestionMessages = cs.suggestedQuestionMessages;
  acc.attachmentMessages = cs.attachmentMessages;
  acc.quickReplyMessages = cs.quickReplyMessages;
  acc.unknownMessages = cs.unknownMessages;
  return acc;
}

function componentAccumulatorFromBreakdownTsRow(
  row: CustomerUsageAnalyticsResponse['componentBreakdownTimeSeries'][number],
): ComponentBreakdownAccumulator {
  const acc = emptyComponentAccumulator();
  acc.textMessages = row.textMessages;
  acc.voiceMessages = row.voiceMessages;
  acc.dictationSessions = row.dictationSessions;
  acc.suggestedQuestionMessages = row.suggestedQuestionMessages;
  acc.attachmentMessages = row.attachmentMessages;
  acc.quickReplyMessages = row.quickReplyMessages;
  acc.unknownMessages = row.unknownMessages;
  return acc;
}

function attributedCreditsForKey(
  rows: UsageComponentDisplayRowDto[],
  key: ChatMessageCreditRuleKey,
): number {
  return roundUsageCredits(rows.find((r) => r.key === key)?.creditsUsed ?? 0);
}

export type CustomerAgentResourcesAnalyticsResponse = {
  range: {
    from: string;
    to: string;
    granularity: CustomerChatsGranularity;
    includePreview: boolean;
    startedFrom?: string;
  };
  usage: {
    summary: {
      totalCreditsUsed: number;
      /** Ledger rollup from usage analytics; may differ from `totalCreditsUsed` when breakdown is recomputed. */
      ledgerCreditsTotal: number;
      /** One coherent row per non-zero breakdown component (`count × creditsEach = creditsUsed`). */
      componentRows: UsageComponentDisplayRowDto[];
      textMessages: number;
      voiceMessages: number;
      voiceDictationSessions: number;
      /** Deprecated split — suggested_question breakdown counts are merged into `textMessages` (`0` here). */
      suggestedQuestionMessages: number;
      averageCreditsPerMessage: number | null;
      /** Credits from persisted `text_message` breakdown rows only. */
      textCreditsAttributed: number;
      voiceCreditsAttributed: number;
      dictationCreditsAttributed: number;
      suggestedQuestionCreditsAttributed: number;
    };
    creditRules: UsageCreditRuleRow[];
    timeSeries: Array<{
      date: string;
      totalCreditsUsed: number;
      textMessages: number;
      voiceMessages: number;
      voiceDictationSessions: number;
      suggestedQuestionMessages: number;
      textCreditsAttributed: number;
      voiceCreditsAttributed: number;
      dictationCreditsAttributed: number;
      suggestedQuestionCreditsAttributed: number;
    }>;
  };
  knowledgeBase: {
    summary: {
      messagesWithSources: number;
      messagesWithoutSources: number;
      primarySourceUses: number;
      uniquePrimarySources: number;
      topPrimarySource: {
        knowledgeBaseItemId: string | null;
        sourceTitle: string | null;
        sourceType: KnowledgeMessageSourceType;
        primarySourceUses: number;
      } | null;
      averagePrimarySourceScore: number | null;
    };
    timeSeries: Array<
      Record<string, unknown> & {
        date: string;
        messagesWithSources: number;
      }
    >;
    sourceTypeBreakdown: Array<{
      sourceType: KnowledgeMessageSourceType;
      label: string;
      primarySourceUses: number;
      averageScore: number | null;
    }>;
    topPrimarySources: Array<{
      knowledgeBaseItemId: string | null;
      sourceTitle: string | null;
      sourceType: KnowledgeMessageSourceType;
      sourceUrl: string | null;
      primarySourceUses: number;
      assistantMessages: number;
      averageScore: number | null;
      lastUsedAt: string | null;
    }>;
  };
};

function roundScore(n: number | null): number | null {
  if (n == null || !Number.isFinite(n)) return null;
  return Math.round(n * 10_000) / 10_000;
}

/** Raw sourceType helper (invalid DB values sanitized in the next aggregation stage). */
function primaryNormalizedTypeCandidateExpr(): Record<string, unknown> {
  return {
    $cond: [
      {
        $or: [
          { $eq: [{ $type: '$primarySourceElem.sourceType' }, 'missing'] },
          { $eq: ['$primarySourceElem.sourceType', null] },
          { $eq: ['$primarySourceElem.sourceType', ''] },
        ],
      },
      'unknown',
      '$primarySourceElem.sourceType',
    ],
  };
}

const KNOWN_PRIMARY_TYPES_FOR_MONGO: KnowledgeMessageSourceType[] = [
  'document',
  'faq',
  'note',
  'datasheet',
  'website',
  'suggestion',
  'manual_text',
  'unknown',
];

function boundedPrimaryTypeExpr(): Record<string, unknown> {
  return {
    $cond: [
      { $in: ['$primaryTypeCandidate', [...KNOWN_PRIMARY_TYPES_FOR_MONGO]] },
      '$primaryTypeCandidate',
      'unknown',
    ],
  };
}

function primaryExistsExpr(): Record<string, unknown> {
  return { $gt: [{ $size: '$sourcesArr' }, 0] };
}

function countPrimaryType(t: KnowledgeMessageSourceType): Record<string, unknown> {
  return {
    $sum: {
      $cond: [{ $eq: [`$normalizedPrimaryType`, t] }, 1, 0],
    },
  };
}

function topPrimaryKeyExpr(): Record<string, unknown> {
  return {
    $cond: [
      { $ne: ['$primarySourceElem.knowledgeBaseItemId', null] },
      { $concat: ['id:', { $toString: '$primarySourceElem.knowledgeBaseItemId' }] },
      {
        $concat: ['t:', { $toString: '$normalizedPrimaryType' }, ':', { $toString: '$primaryTitleKey' }],
      },
    ],
  };
}

@Injectable()
export class CustomerAgentResourcesAnalyticsService {
  constructor(
    private readonly customerUsageAnalyticsService: CustomerUsageAnalyticsService,
    @InjectModel(Message.name) private readonly messageModel: Model<Message>,
  ) {}

  async get(
    botId: string,
    queryIn: CustomerAgentResourcesAnalyticsQueryInput,
  ): Promise<CustomerAgentResourcesAnalyticsResponse> {
    const q = parseCustomerAgentResourcesAnalyticsQuery(queryIn);
    const oid = new Types.ObjectId(botId);

    const [usage, summaryRow, uniquePrimary, tsRows, typeRows, topRows] = await Promise.all([
      this.customerUsageAnalyticsService.get(botId, {
        from: q.from.toISOString(),
        to: q.to.toISOString(),
        granularity: q.granularity,
        includePreview: q.includePreview ? 'true' : 'false',
        startedFrom: q.startedFrom,
      }),
      this.aggregatePrimaryKnowledgeSummary(oid, q),
      this.aggregateUniquePrimarySources(oid, q),
      this.aggregatePrimaryKnowledgeTimeSeries(oid, q),
      this.aggregatePrimarySourceTypeBreakdown(oid, q),
      this.aggregateTopPrimarySources(oid, q),
    ]);

    const cs = usage.componentBreakdownSummary;
    const compByDate = new Map(usage.componentBreakdownTimeSeries.map((c) => [c.date, c]));

    const usageTimeSeries = usage.timeSeries.map((row) => {
      const comp = compByDate.get(row.date);
      const accSnap = comp
        ? componentAccumulatorFromBreakdownTsRow(comp)
        : emptyComponentAccumulator();
      const bucketRows = buildUsageComponentDisplayRowsFromAccumulator(accSnap);
      const coherentTotal = roundUsageCredits(sumBillableUsageComponentCredits(bucketRows));

      return {
        date: row.date,
        totalCreditsUsed: coherentTotal,
        textMessages: Math.trunc(accSnap.textMessages ?? 0),
        voiceMessages: Math.trunc(accSnap.voiceMessages ?? 0),
        voiceDictationSessions: Math.trunc(accSnap.dictationSessions ?? 0),
        suggestedQuestionMessages: Math.trunc(accSnap.suggestedQuestionMessages ?? 0),
        textCreditsAttributed: attributedCreditsForKey(bucketRows, 'text_message'),
        voiceCreditsAttributed: attributedCreditsForKey(bucketRows, 'voice_message'),
        dictationCreditsAttributed: attributedCreditsForKey(bucketRows, 'dictation_session'),
        suggestedQuestionCreditsAttributed: attributedCreditsForKey(
          bucketRows,
          'suggested_question_message',
        ),
      };
    });

    const summaryLedgerTotal = roundUsageCredits(Number(usage.summary.totalCreditsUsed ?? 0));
    const summaryAcc = componentAccumulatorFromBreakdownSummary(cs);
    const summaryRows = buildUsageComponentDisplayRowsFromAccumulator(summaryAcc);
    const breakdownTotal = roundUsageCredits(sumBillableUsageComponentCredits(summaryRows));
    const typeKeysSorted = sortKnowledgeSourceTypeKeys(
      typeRows.map((r) => normalizeKnowledgeSourceTypeForBreakdown(String(r._id))),
    );

    const sourceTypeBreakdown = typeKeysSorted.map((k) => {
      const row = typeRows.find(
        (x) => normalizeKnowledgeSourceTypeForBreakdown(String(x._id)) === k,
      );
      const scoreN = row?.scoreN ?? 0;
      const scoreSum = row?.scoreSum ?? 0;
      return {
        sourceType: k,
        label: knowledgeSourceTypeLabel(k),
        primarySourceUses: row?.primarySourceUses ?? 0,
        averageScore: scoreN > 0 ? roundScore(scoreSum / scoreN) : null,
      };
    });

    const bucketStarts = enumerateBucketStarts(q.from, q.to, q.granularity);
    const tsMap = new Map(
      tsRows.map((r) => [bucketKeyIso(alignBucketStart(r._id, q.granularity)), r]),
    );

    const typeFields: KnowledgeMessageSourceType[] = [
      'document',
      'faq',
      'note',
      'datasheet',
      'website',
      'suggestion',
      'manual_text',
      'unknown',
    ];

    const knowledgeTimeSeries: CustomerAgentResourcesAnalyticsResponse['knowledgeBase']['timeSeries'] =
      bucketStarts.map((bucketStart) => {
        const key = bucketKeyIso(bucketStart);
        const row = tsMap.get(key);
        const out: Record<string, unknown> = {
          date: key,
          messagesWithSources: row?.messagesWithSources ?? 0,
        };
        for (const t of typeFields) {
          const k = row?.[t] as number | undefined;
          out[t] = typeof k === 'number' ? k : 0;
        }
        return out as Record<string, unknown> & { date: string; messagesWithSources: number };
      });

    const topPrimarySources = topRows.map((r) => ({
      knowledgeBaseItemId:
        r.knowledgeBaseItemId instanceof Types.ObjectId
          ? r.knowledgeBaseItemId.toString()
          : r.knowledgeBaseItemId != null
            ? String(r.knowledgeBaseItemId)
            : null,
      sourceTitle: r.sourceTitleTrim?.trim() ? r.sourceTitleTrim.trim().slice(0, 512) : null,
      sourceType: normalizeKnowledgeSourceTypeForBreakdown(r.sourceTypeRaw),
      sourceUrl: safeKnowledgeSourceUrlForAnalytics(r.sourceUrlRaw),
      primarySourceUses: r.primarySourceUses,
      assistantMessages: r.assistantMessages,
      averageScore: r.scoreN > 0 ? roundScore(r.scoreSum / r.scoreN) : null,
      lastUsedAt: r.lastUsedAt ? new Date(r.lastUsedAt).toISOString() : null,
    }));

    const topPrimary = topPrimarySources.length > 0 ? topPrimarySources[0]! : null;
    const messagesWithSources = summaryRow?.messagesWithSources ?? 0;
    const messagesWithoutSources = summaryRow?.messagesWithoutSources ?? 0;
    const scoreSumPri = summaryRow?.scoreSumPrimary ?? 0;
    const scoreNPri = summaryRow?.scoreNPrimary ?? 0;

    return {
      range: {
        from: q.from.toISOString(),
        to: q.to.toISOString(),
        granularity: q.granularity,
        includePreview: q.includePreview,
        ...(q.startedFrom ? { startedFrom: q.startedFrom } : {}),
      },
      usage: {
        summary: {
          totalCreditsUsed: breakdownTotal,
          ledgerCreditsTotal: summaryLedgerTotal,
          componentRows: summaryRows,
          textMessages: cs.textMessages,
          voiceMessages: cs.voiceMessages,
          voiceDictationSessions: cs.dictationSessions,
          suggestedQuestionMessages: cs.suggestedQuestionMessages,
          averageCreditsPerMessage: usage.summary.averageCreditsPerMessage,
          textCreditsAttributed: attributedCreditsForKey(summaryRows, 'text_message'),
          voiceCreditsAttributed: attributedCreditsForKey(summaryRows, 'voice_message'),
          dictationCreditsAttributed: attributedCreditsForKey(summaryRows, 'dictation_session'),
          suggestedQuestionCreditsAttributed: attributedCreditsForKey(
            summaryRows,
            'suggested_question_message',
          ),
        },
        creditRules: buildUsageCreditRulesForResponse(),
        timeSeries: usageTimeSeries,
      },
      knowledgeBase: {
        summary: {
          messagesWithSources,
          messagesWithoutSources,
          primarySourceUses: messagesWithSources,
          uniquePrimarySources: uniquePrimary?.n ?? 0,
          topPrimarySource: topPrimary
            ? {
                knowledgeBaseItemId: topPrimary.knowledgeBaseItemId,
                sourceTitle: topPrimary.sourceTitle,
                sourceType: topPrimary.sourceType,
                primarySourceUses: topPrimary.primarySourceUses,
              }
            : null,
          averagePrimarySourceScore: scoreNPri > 0 ? roundScore(scoreSumPri / scoreNPri) : null,
        },
        timeSeries: knowledgeTimeSeries,
        sourceTypeBreakdown,
        topPrimarySources,
      },
    };
  }

  private assistantStages(
    botId: Types.ObjectId,
    q: ParsedCustomerAgentResourcesAnalyticsQuery,
  ): PipelineStage[] {
    const stages: PipelineStage[] = [
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
        primaryTypeCandidate: primaryNormalizedTypeCandidateExpr(),
      },
    });
    stages.push({
      $addFields: {
        normalizedPrimaryType: boundedPrimaryTypeExpr(),
        primaryExists: primaryExistsExpr(),
        primaryTitleKey: {
          $cond: [
            { $eq: [{ $type: '$primarySourceElem.sourceTitle' }, 'string'] },
            '$primarySourceElem.sourceTitle',
            '',
          ],
        },
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

    return stages;
  }

  private async aggregatePrimaryKnowledgeSummary(
    botId: Types.ObjectId,
    q: ParsedCustomerAgentResourcesAnalyticsQuery,
  ): Promise<{
    messagesWithSources: number;
    messagesWithoutSources: number;
    scoreSumPrimary: number;
    scoreNPrimary: number;
  } | null> {
    const pipeline: PipelineStage[] = [
      ...this.assistantStages(botId, q),
      {
        $group: {
          _id: null,
          messagesWithSources: { $sum: { $cond: ['$primaryExists', 1, 0] } },
          messagesWithoutSources: { $sum: { $cond: ['$primaryExists', 0, 1] } },
          scoreSumPrimary: {
            $sum: {
              $cond: [{ $ne: ['$scorePrimaryNumeric', null] }, '$scorePrimaryNumeric', 0],
            },
          },
          scoreNPrimary: {
            $sum: {
              $cond: [{ $ne: ['$scorePrimaryNumeric', null] }, 1, 0],
            },
          },
        },
      },
    ];
    const rows = await this.messageModel
      .aggregate<{
        messagesWithSources: number;
        messagesWithoutSources: number;
        scoreSumPrimary: number;
        scoreNPrimary: number;
      }>(pipeline)
      .exec();
    return rows[0] ?? null;
  }

  private async aggregateUniquePrimarySources(
    botId: Types.ObjectId,
    q: ParsedCustomerAgentResourcesAnalyticsQuery,
  ): Promise<{ n: number } | null> {
    const pipeline: PipelineStage[] = [
      ...this.assistantStages(botId, q),
      { $match: { $expr: { $eq: ['$primaryExists', true] } } },
      { $group: { _id: topPrimaryKeyExpr() } },
      { $count: 'n' },
    ];
    const rows = await this.messageModel.aggregate<{ n: number }>(pipeline).exec();
    return rows[0] ?? { n: 0 };
  }

  private async aggregatePrimaryKnowledgeTimeSeries(
    botId: Types.ObjectId,
    q: ParsedCustomerAgentResourcesAnalyticsQuery,
  ): Promise<Array<Record<string, unknown> & { _id: Date; messagesWithSources: number }>> {
    const pipeline: PipelineStage[] = [
      ...this.assistantStages(botId, q),
      {
        $addFields: {
          bucket: dateTruncStage('createdAt', q.granularity),
        },
      },
      {
        $group: {
          _id: '$bucket',
          messagesWithSources: {
            $sum: { $cond: ['$primaryExists', 1, 0] },
          },
          document: countPrimaryType('document'),
          faq: countPrimaryType('faq'),
          note: countPrimaryType('note'),
          datasheet: countPrimaryType('datasheet'),
          website: countPrimaryType('website'),
          suggestion: countPrimaryType('suggestion'),
          manual_text: countPrimaryType('manual_text'),
          unknown: countPrimaryType('unknown'),
        },
      } as PipelineStage,
    ];
    return this.messageModel
      .aggregate<Record<string, unknown> & { _id: Date; messagesWithSources: number }>(pipeline)
      .exec();
  }

  private async aggregatePrimarySourceTypeBreakdown(
    botId: Types.ObjectId,
    q: ParsedCustomerAgentResourcesAnalyticsQuery,
  ): Promise<Array<{ _id: string; primarySourceUses: number; scoreSum: number; scoreN: number }>> {
    const pipeline: PipelineStage[] = [
      ...this.assistantStages(botId, q),
      { $match: { $expr: { $eq: ['$primaryExists', true] } } },
      {
        $group: {
          _id: '$normalizedPrimaryType',
          primarySourceUses: { $sum: 1 },
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
    ];
    return this.messageModel
      .aggregate<{ _id: string; primarySourceUses: number; scoreSum: number; scoreN: number }>(pipeline)
      .exec();
  }

  private async aggregateTopPrimarySources(
    botId: Types.ObjectId,
    q: ParsedCustomerAgentResourcesAnalyticsQuery,
  ): Promise<
    Array<{
      primarySourceUses: number;
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
      ...this.assistantStages(botId, q),
      { $match: { $expr: { $eq: ['$primaryExists', true] } } },
      {
        $group: {
          _id: topPrimaryKeyExpr(),
          primarySourceUses: { $sum: 1 },
          knowledgeBaseItemId: { $first: '$primarySourceElem.knowledgeBaseItemId' },
          sourceTitleTrim: { $first: '$primarySourceElem.sourceTitle' },
          sourceTypeRaw: { $first: '$primarySourceElem.sourceType' },
          sourceUrlRaw: { $first: '$primarySourceElem.sourceUrl' },
          assistantMsgIds: { $addToSet: '$_id' },
          lastUsedAt: { $max: '$createdAt' },
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
      { $sort: { primarySourceUses: -1 } },
      { $limit: 25 },
      {
        $project: {
          _id: 0,
          primarySourceUses: 1,
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
    return this.messageModel
      .aggregate<{
        primarySourceUses: number;
        knowledgeBaseItemId: Types.ObjectId | null;
        sourceTitleTrim: string | null;
        sourceTypeRaw: string | null;
        sourceUrlRaw: string | null;
        scoreSum: number;
        scoreN: number;
        lastUsedAt: Date | null;
        assistantMessages: number;
      }>(pipeline)
      .exec();
  }
}
