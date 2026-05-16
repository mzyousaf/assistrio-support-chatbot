import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage, Types } from 'mongoose';
import { Conversation } from '../models';
import { BotsService } from '../bots/bots.service';
import type { LeadFieldType } from '../models/bot.schema';
import {
  PREVIEW_STARTED_FROM_VALUES,
  alignBucketStart,
  bucketKeyIso,
  buildStartedFromMatchClause,
  enumerateBucketStarts,
  mongoDateTruncUnit,
  normalizeConversationStartedFrom,
  sortStartedFromKeys,
  startedFromLabel,
  type ConversationStartedFromKey,
  type CustomerChatsGranularity,
} from './customer-chats-analytics.util';
import {
  parseCustomerLeadsAnalyticsQuery,
  type CustomerLeadsAnalyticsQueryInput,
  type ParsedCustomerLeadsAnalyticsQuery,
} from './customer-leads-analytics.util';
import {
  mongoLeadCompleteExpr,
  parseLeadCompletenessConfigFromBot,
} from './customer-leads-analytics-completeness.util';

export type CustomerLeadsAnalyticsResponse = {
  range: {
    from: string;
    to: string;
    granularity: CustomerChatsGranularity;
  };
  summary: {
    totalConversations: number;
    totalLeads: number;
    completeLeads: number;
    partialLeads: number;
    leadCompletionRate: number | null;
    conversionRate: number | null;
    totalCapturedFields: number;
    averageFieldsPerLead: number | null;
  };
  timeSeries: Array<{
    date: string;
    conversations: number;
    leads: number;
    completeLeads: number;
    partialLeads: number;
    conversionRate: number | null;
    leadCompletionRate: number | null;
  }>;
  startedFromBreakdown: Array<{
    key: ConversationStartedFromKey;
    label: string;
    conversations: number;
    leads: number;
    conversionRate: number | null;
  }>;
  locationBreakdown: {
    countries: Array<{
      country: string | null;
      countryCode: string | null;
      leads: number;
      conversations: number;
    }>;
    cities: Array<{
      city: string | null;
      countryCode: string | null;
      leads: number;
      conversations: number;
    }>;
  };
  fieldCaptureBreakdown: Array<{
    fieldKey: string;
    label: string;
    type: LeadFieldType | 'unknown';
    capturedCount: number;
    fieldStatus: 'active' | 'inactive' | 'deleted';
    /** @deprecated Prefer fieldStatus; retained for backward-compatible API consumers. */
    archived?: boolean;
  }>;
};

function conversationLeadQualifyExpr(): Record<string, unknown> {
  return {
    $or: [
      { $eq: ['$hasLead', true] },
      {
        $gt: [
          {
            $size: {
              $filter: {
                input: { $objectToArray: { $ifNull: ['$capturedLeadData', {}] } },
                as: 'pair',
                cond: { $gt: [{ $strLenCP: { $ifNull: ['$$pair.v', ''] } }, 0] },
              },
            },
          },
          0,
        ],
      },
    ],
  };
}

function leadAttributionDateExpr(): Record<string, unknown> {
  return {
    $ifNull: ['$leadCapturedAt', { $ifNull: ['$lastActivityAt', '$createdAt'] }],
  };
}

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

function toBucketMap(
  rows: Array<{ _id: Date; n: number }>,
  granularity: CustomerChatsGranularity,
): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) {
    m.set(bucketKeyIso(alignBucketStart(r._id, granularity)), r.n);
  }
  return m;
}

function toLeadQualityBucketMap(
  rows: Array<{ _id: Date; leads: number; completeLeads: number }>,
  granularity: CustomerChatsGranularity,
): Map<string, { leads: number; completeLeads: number }> {
  const m = new Map<string, { leads: number; completeLeads: number }>();
  for (const r of rows) {
    m.set(bucketKeyIso(alignBucketStart(r._id, granularity)), {
      leads: r.leads,
      completeLeads: r.completeLeads,
    });
  }
  return m;
}

function round4(n: number | null): number | null {
  if (n == null || !Number.isFinite(n)) return null;
  return Math.round(n * 10_000) / 10_000;
}

function conversionRate(conv: number, leads: number): number | null {
  if (conv <= 0) return null;
  return round4(Math.min(1, leads / conv));
}

function leadCompletionRatio(leads: number, completeLeads: number): number | null {
  if (leads <= 0) return null;
  return round4(Math.min(1, completeLeads / leads));
}

function uniqKeys<T extends string>(keys: T[]): T[] {
  return [...new Set(keys)];
}

function startedFromGroupId(): Record<string, unknown> {
  return {
    $switch: {
      branches: [
        { case: { $eq: ['$startedFrom', 'playground_preview'] }, then: 'playground_preview' },
        { case: { $eq: ['$startedFrom', 'shared_preview'] }, then: 'shared_preview' },
        { case: { $eq: ['$startedFrom', 'runtime_widget'] }, then: 'runtime_widget' },
        { case: { $eq: ['$startedFrom', 'runtime_iframe'] }, then: 'runtime_iframe' },
      ],
      default: 'unknown',
    },
  };
}

function humanizeFieldKey(key: string): string {
  const s = String(key ?? '').trim();
  if (!s) return 'Unknown';
  return s
    .replace(/[_-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function mergeCountryLeads(
  convRows: Array<{ country: string | null; countryCode: string | null; conversations: number }>,
  leadRows: Array<{ country: string | null; countryCode: string | null; leads: number }>,
): Array<{
  country: string | null;
  countryCode: string | null;
  leads: number;
  conversations: number;
}> {
  const keyOf = (cc: string | null, c: string | null) => `${cc ?? ''}\u0000${c ?? ''}`;
  const out = new Map<
    string,
    { country: string | null; countryCode: string | null; leads: number; conversations: number }
  >();
  for (const r of convRows) {
    const k = keyOf(r.countryCode, r.country);
    out.set(k, {
      country: r.country,
      countryCode: r.countryCode,
      conversations: r.conversations,
      leads: 0,
    });
  }
  for (const r of leadRows) {
    const k = keyOf(r.countryCode, r.country);
    const cur = out.get(k) ?? {
      country: r.country,
      countryCode: r.countryCode,
      conversations: 0,
      leads: 0,
    };
    cur.leads = r.leads;
    out.set(k, cur);
  }
  return [...out.values()].sort((a, b) => b.leads + b.conversations - (a.leads + a.conversations));
}

function mergeCityLeads(
  convRows: Array<{ city: string | null; countryCode: string | null; conversations: number }>,
  leadRows: Array<{ city: string | null; countryCode: string | null; leads: number }>,
): Array<{
  city: string | null;
  countryCode: string | null;
  leads: number;
  conversations: number;
}> {
  const keyOf = (city: string | null, cc: string | null) => `${city ?? ''}\u0000${cc ?? ''}`;
  const out = new Map<
    string,
    { city: string | null; countryCode: string | null; leads: number; conversations: number }
  >();
  for (const r of convRows) {
    const k = keyOf(r.city, r.countryCode);
    out.set(k, {
      city: r.city,
      countryCode: r.countryCode,
      conversations: r.conversations,
      leads: 0,
    });
  }
  for (const r of leadRows) {
    const k = keyOf(r.city, r.countryCode);
    const cur = out.get(k) ?? {
      city: r.city,
      countryCode: r.countryCode,
      conversations: 0,
      leads: 0,
    };
    cur.leads = r.leads;
    out.set(k, cur);
  }
  return [...out.values()].sort((a, b) => b.leads + b.conversations - (a.leads + a.conversations));
}

@Injectable()
export class CustomerLeadsAnalyticsService {
  constructor(
    @InjectModel(Conversation.name) private readonly conversationModel: Model<Conversation>,
    private readonly botsService: BotsService,
  ) {}

  async get(botId: string, queryIn: CustomerLeadsAnalyticsQueryInput): Promise<CustomerLeadsAnalyticsResponse> {
    const q = parseCustomerLeadsAnalyticsQuery(queryIn);
    const oid = new Types.ObjectId(botId);
    const convMatch = this.buildConversationMatch(oid, q);

    const bot = await this.botsService.findOne(botId);
    const completenessCfg = parseLeadCompletenessConfigFromBot(bot as Record<string, unknown> | null);
    const completeExpr = mongoLeadCompleteExpr(completenessCfg);

    const [
      totalConversations,
      leadQualityTotals,
      totalCapturedFields,
      tsConversations,
      tsLeadQuality,
      sfConv,
      sfLeads,
      locCountriesConv,
      locCountriesLeads,
      locCitiesConv,
      locCitiesLeads,
      fieldRows,
    ] = await Promise.all([
      this.conversationModel.countDocuments(convMatch),
      this.aggregateLeadQualityTotals(convMatch, completeExpr),
      this.aggregateTotalCapturedFields(convMatch),
      this.aggregateConversationTimeSeries(convMatch, q.granularity),
      this.aggregateLeadQualityTimeSeries(convMatch, q.granularity, { from: q.from, to: q.to }, completeExpr),
      this.aggregateStartedFromConversations(convMatch),
      this.aggregateStartedFromLeads(convMatch),
      this.aggregateLocationCountriesConversations(convMatch),
      this.aggregateLocationCountriesLeads(convMatch),
      this.aggregateLocationCitiesConversations(convMatch),
      this.aggregateLocationCitiesLeads(convMatch),
      this.aggregateFieldCaptureKeys(convMatch),
    ]);

    const totalLeads = leadQualityTotals.totalLeads;
    const completeLeads = Math.min(leadQualityTotals.completeLeads, totalLeads);
    const partialLeads = Math.max(0, totalLeads - completeLeads);

    const fieldMeta = this.buildFieldMetaMap(bot);

    const bucketStarts = enumerateBucketStarts(q.from, q.to, q.granularity);
    const timeSeries = bucketStarts.map((bucketStart) => {
      const key = bucketKeyIso(bucketStart);
      const conv = tsConversations.get(key) ?? 0;
      const lq = tsLeadQuality.get(key) ?? { leads: 0, completeLeads: 0 };
      const leads = lq.leads;
      const complete = Math.min(lq.completeLeads, leads);
      const partial = Math.max(0, leads - complete);
      return {
        date: key,
        conversations: conv,
        leads,
        completeLeads: complete,
        partialLeads: partial,
        conversionRate: conversionRate(conv, leads),
        leadCompletionRate: leadCompletionRatio(leads, complete),
      };
    });

    const startedFromKeys = sortStartedFromKeys(
      uniqKeys([...sfConv.keys(), ...sfLeads.keys()]) as ConversationStartedFromKey[],
    );
    const startedFromBreakdown = startedFromKeys.map((key) => {
      const conv = sfConv.get(key) ?? 0;
      const leads = sfLeads.get(key) ?? 0;
      return {
        key,
        label: startedFromLabel(key),
        conversations: conv,
        leads,
        conversionRate: conversionRate(conv, leads),
      };
    });

    const fieldCaptureBreakdown = fieldRows
      .map((r) => {
        const key = String(r._id);
        const meta = fieldMeta.get(key);
        const fieldStatus = this.resolveFieldCaptureFieldStatus(bot, key);
        return {
          fieldKey: key,
          label: meta?.label ?? humanizeFieldKey(key),
          type: (meta?.type ?? 'unknown') as LeadFieldType | 'unknown',
          capturedCount: r.capturedCount,
          fieldStatus,
          ...(fieldStatus !== 'active' ? { archived: true } : {}),
        };
      })
      .sort((a, b) => b.capturedCount - a.capturedCount);

    return {
      range: {
        from: q.from.toISOString(),
        to: q.to.toISOString(),
        granularity: q.granularity,
      },
      summary: {
        totalConversations,
        totalLeads,
        completeLeads,
        partialLeads,
        leadCompletionRate: leadCompletionRatio(totalLeads, completeLeads),
        conversionRate: conversionRate(totalConversations, totalLeads),
        totalCapturedFields,
        averageFieldsPerLead: totalLeads > 0 ? round4(totalCapturedFields / totalLeads) : null,
      },
      timeSeries,
      startedFromBreakdown,
      locationBreakdown: {
        countries: mergeCountryLeads(locCountriesConv, locCountriesLeads).slice(0, 40),
        cities: mergeCityLeads(locCitiesConv, locCitiesLeads).slice(0, 40),
      },
      fieldCaptureBreakdown,
    };
  }

  private buildFieldMetaMap(
    bot: Record<string, unknown> | null,
  ): Map<string, { label: string; type: LeadFieldType }> {
    const m = new Map<string, { label: string; type: LeadFieldType }>();
    const lc = bot?.leadCapture as { fields?: Array<{ key?: string; label?: string; type?: LeadFieldType; disabled?: boolean }> } | undefined;
    for (const f of lc?.fields ?? []) {
      if (!f) continue;
      const k = String(f.key ?? '').trim();
      if (!k) continue;
      const label = String(f.label ?? '').trim() || humanizeFieldKey(k);
      const type: LeadFieldType = f.type ?? 'text';
      m.set(k, { label, type });
    }
    return m;
  }

  /**
   * Active: configured field + capture on + not disabled.
   * Inactive: still configured but capture off, field disabled, or globally inactive.
   * Deleted: key not on bot anymore but appears in historical captures for the range.
   */
  private resolveFieldCaptureFieldStatus(
    bot: Record<string, unknown> | null,
    fieldKey: string,
  ): 'active' | 'inactive' | 'deleted' {
    const lc = bot?.leadCapture as {
      enabled?: boolean;
      fields?: Array<{ key?: string; disabled?: boolean }>;
    } | undefined;
    const fields = Array.isArray(lc?.fields) ? lc!.fields! : [];
    const fk = String(fieldKey ?? '').trim();
    const cfgRow = fields.find((f) => String(f?.key ?? '').trim() === fk);
    if (!cfgRow) return 'deleted';
    const captureGloballyOn =
      typeof lc?.enabled === 'boolean' ? lc.enabled : fields.length > 0;
    if (!captureGloballyOn || cfgRow.disabled === true) return 'inactive';
    return 'active';
  }

  private buildConversationMatch(
    botId: Types.ObjectId,
    q: ParsedCustomerLeadsAnalyticsQuery,
  ): Record<string, unknown> {
    const and: Record<string, unknown>[] = [
      { botId },
      { createdAt: { $gte: q.from, $lte: q.to } },
    ];
    if (!q.includePreview) {
      and.push({ startedFrom: { $nin: [...PREVIEW_STARTED_FROM_VALUES] } });
    }
    if (q.startedFrom?.length) {
      and.push(buildStartedFromMatchClause('startedFrom', q.startedFrom));
    }
    if (q.countryCode) {
      and.push({ 'location.countryCode': q.countryCode });
    }
    return { $and: and };
  }

  private async aggregateTotalCapturedFields(convMatch: Record<string, unknown>): Promise<number> {
    const pipeline: PipelineStage[] = [
      { $match: convMatch },
      { $match: { $expr: conversationLeadQualifyExpr() } },
      {
        $project: {
          fc: {
            $size: {
              $filter: {
                input: { $objectToArray: { $ifNull: ['$capturedLeadData', {}] } },
                as: 'pair',
                cond: { $gt: [{ $strLenCP: { $ifNull: ['$$pair.v', ''] } }, 0] },
              },
            },
          },
        },
      },
      {
        $group: {
          _id: null,
          t: { $sum: '$fc' },
        },
      },
    ];
    const rows = await this.conversationModel.aggregate<{ t: number }>(pipeline);
    return rows[0]?.t ?? 0;
  }

  private async aggregateConversationTimeSeries(
    convMatch: Record<string, unknown>,
    granularity: CustomerChatsGranularity,
  ): Promise<Map<string, number>> {
    const pipeline: PipelineStage[] = [
      { $match: convMatch },
      {
        $group: {
          _id: dateTruncStage('createdAt', granularity),
          n: { $sum: 1 },
        },
      },
    ];
    const rows = await this.conversationModel.aggregate<{ _id: Date; n: number }>(pipeline);
    return toBucketMap(rows, granularity);
  }

  private async aggregateLeadQualityTotals(
    convMatch: Record<string, unknown>,
    completeExpr: Record<string, unknown>,
  ): Promise<{ totalLeads: number; completeLeads: number }> {
    const pipeline: PipelineStage[] = [
      { $match: convMatch },
      { $match: { $expr: conversationLeadQualifyExpr() } },
      {
        $group: {
          _id: null,
          totalLeads: { $sum: 1 },
          completeLeads: {
            $sum: {
              $cond: [{ $eq: [completeExpr, true] }, 1, 0],
            },
          },
        },
      },
    ];
    const rows = await this.conversationModel.aggregate<{ totalLeads: number; completeLeads: number }>(pipeline);
    const row = rows[0];
    return {
      totalLeads: row?.totalLeads ?? 0,
      completeLeads: row?.completeLeads ?? 0,
    };
  }

  private async aggregateLeadQualityTimeSeries(
    convMatch: Record<string, unknown>,
    granularity: CustomerChatsGranularity,
    range: { from: Date; to: Date },
    completeExpr: Record<string, unknown>,
  ): Promise<Map<string, { leads: number; completeLeads: number }>> {
    const pipeline: PipelineStage[] = [
      { $match: convMatch },
      { $match: { $expr: conversationLeadQualifyExpr() } },
      {
        $set: {
          _leadAt: leadAttributionDateExpr(),
        },
      },
      {
        $match: {
          _leadAt: { $gte: range.from, $lte: range.to },
        },
      },
      {
        $group: {
          _id: dateTruncStage('_leadAt', granularity),
          leads: { $sum: 1 },
          completeLeads: {
            $sum: {
              $cond: [{ $eq: [completeExpr, true] }, 1, 0],
            },
          },
        },
      },
    ];
    const rows = await this.conversationModel.aggregate<{ _id: Date; leads: number; completeLeads: number }>(
      pipeline,
    );
    return toLeadQualityBucketMap(rows, granularity);
  }

  private async aggregateStartedFromConversations(
    convMatch: Record<string, unknown>,
  ): Promise<Map<ConversationStartedFromKey, number>> {
    const pipeline: PipelineStage[] = [
      { $match: convMatch },
      {
        $group: {
          _id: startedFromGroupId(),
          n: { $sum: 1 },
        },
      },
    ];
    const rows = await this.conversationModel.aggregate<{ _id: string; n: number }>(pipeline);
    const m = new Map<ConversationStartedFromKey, number>();
    for (const r of rows) {
      const k = normalizeConversationStartedFrom(r._id);
      m.set(k, (m.get(k) ?? 0) + r.n);
    }
    return m;
  }

  private async aggregateStartedFromLeads(
    convMatch: Record<string, unknown>,
  ): Promise<Map<ConversationStartedFromKey, number>> {
    const pipeline: PipelineStage[] = [
      { $match: convMatch },
      { $match: { $expr: conversationLeadQualifyExpr() } },
      {
        $group: {
          _id: startedFromGroupId(),
          n: { $sum: 1 },
        },
      },
    ];
    const rows = await this.conversationModel.aggregate<{ _id: string; n: number }>(pipeline);
    const m = new Map<ConversationStartedFromKey, number>();
    for (const r of rows) {
      const k = normalizeConversationStartedFrom(r._id);
      m.set(k, (m.get(k) ?? 0) + r.n);
    }
    return m;
  }

  private async aggregateLocationCountriesConversations(
    convMatch: Record<string, unknown>,
  ): Promise<Array<{ country: string | null; countryCode: string | null; conversations: number }>> {
    const pipeline: PipelineStage[] = [
      { $match: convMatch },
      {
        $group: {
          _id: {
            cc: '$location.countryCode',
            c: '$location.country',
          },
          conversations: { $sum: 1 },
        },
      },
      { $sort: { conversations: -1 } },
      { $limit: 80 },
    ];
    const rows = await this.conversationModel.aggregate<{
      _id: { cc?: string | null; c?: string | null };
      conversations: number;
    }>(pipeline);
    return rows.map((r) => ({
      country: r._id.c ?? null,
      countryCode: r._id.cc ?? null,
      conversations: r.conversations,
    }));
  }

  private async aggregateLocationCountriesLeads(
    convMatch: Record<string, unknown>,
  ): Promise<Array<{ country: string | null; countryCode: string | null; leads: number }>> {
    const pipeline: PipelineStage[] = [
      { $match: convMatch },
      { $match: { $expr: conversationLeadQualifyExpr() } },
      {
        $group: {
          _id: {
            cc: '$location.countryCode',
            c: '$location.country',
          },
          leads: { $sum: 1 },
        },
      },
      { $sort: { leads: -1 } },
      { $limit: 80 },
    ];
    const rows = await this.conversationModel.aggregate<{
      _id: { cc?: string | null; c?: string | null };
      leads: number;
    }>(pipeline);
    return rows.map((r) => ({
      country: r._id.c ?? null,
      countryCode: r._id.cc ?? null,
      leads: r.leads,
    }));
  }

  private async aggregateLocationCitiesConversations(
    convMatch: Record<string, unknown>,
  ): Promise<Array<{ city: string | null; countryCode: string | null; conversations: number }>> {
    const pipeline: PipelineStage[] = [
      { $match: convMatch },
      {
        $group: {
          _id: {
            city: '$location.city',
            cc: '$location.countryCode',
          },
          conversations: { $sum: 1 },
        },
      },
      { $sort: { conversations: -1 } },
      { $limit: 80 },
    ];
    const rows = await this.conversationModel.aggregate<{
      _id: { city?: string | null; cc?: string | null };
      conversations: number;
    }>(pipeline);
    return rows.map((r) => ({
      city: r._id.city ?? null,
      countryCode: r._id.cc ?? null,
      conversations: r.conversations,
    }));
  }

  private async aggregateLocationCitiesLeads(
    convMatch: Record<string, unknown>,
  ): Promise<Array<{ city: string | null; countryCode: string | null; leads: number }>> {
    const pipeline: PipelineStage[] = [
      { $match: convMatch },
      { $match: { $expr: conversationLeadQualifyExpr() } },
      {
        $group: {
          _id: {
            city: '$location.city',
            cc: '$location.countryCode',
          },
          leads: { $sum: 1 },
        },
      },
      { $sort: { leads: -1 } },
      { $limit: 80 },
    ];
    const rows = await this.conversationModel.aggregate<{
      _id: { city?: string | null; cc?: string | null };
      leads: number;
    }>(pipeline);
    return rows.map((r) => ({
      city: r._id.city ?? null,
      countryCode: r._id.cc ?? null,
      leads: r.leads,
    }));
  }

  private async aggregateFieldCaptureKeys(
    convMatch: Record<string, unknown>,
  ): Promise<Array<{ _id: string; capturedCount: number }>> {
    const pipeline: PipelineStage[] = [
      { $match: convMatch },
      { $match: { $expr: conversationLeadQualifyExpr() } },
      {
        $project: {
          pairs: {
            $filter: {
              input: { $objectToArray: { $ifNull: ['$capturedLeadData', {}] } },
              as: 'p',
              cond: { $gt: [{ $strLenCP: { $ifNull: ['$$p.v', ''] } }, 0] },
            },
          },
        },
      },
      { $unwind: '$pairs' },
      {
        $group: {
          _id: '$pairs.k',
          capturedCount: { $sum: 1 },
        },
      },
      { $sort: { capturedCount: -1 } },
      { $limit: 80 },
    ];
    return this.conversationModel.aggregate(pipeline);
  }
}
