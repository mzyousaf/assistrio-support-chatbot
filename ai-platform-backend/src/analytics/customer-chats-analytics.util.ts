import { BadRequestException } from '@nestjs/common';
import type { PipelineStage } from 'mongoose';
import {
  DEFAULT_OVERVIEW_RANGE_DAYS,
  MAX_OVERVIEW_RANGE_MS,
  parseOverviewDateRange,
} from './analytics-date-range.util';

export type CustomerChatsGranularity = 'hour' | 'day' | 'week' | 'month';

export type ConversationStartedFromKey =
  | 'playground_preview'
  | 'shared_preview'
  | 'runtime_widget'
  | 'runtime_iframe'
  | 'unknown';

export type MessageTypeBreakdownKey =
  | 'text'
  | 'voice'
  | 'dictation'
  | 'attachment'
  | 'suggested_question'
  | 'unknown';

export const PREVIEW_STARTED_FROM_VALUES = ['playground_preview', 'shared_preview'] as const;

export type CustomerChatsAnalyticsQueryInput = {
  from?: string;
  to?: string;
  granularity?: string;
  includePreview?: string;
  startedFrom?: string;
  countryCode?: string;
  deviceType?: string;
};

export type ParsedCustomerChatsAnalyticsQuery = {
  from: Date;
  to: Date;
  granularity: CustomerChatsGranularity;
  includePreview: boolean;
  /** When set, conversations must match one of these `startedFrom` keys (OR). */
  startedFrom?: ConversationStartedFromKey[];
  countryCode?: string;
  deviceType?: string;
};

const GRANULARITY_SET = new Set<string>(['hour', 'day', 'week', 'month']);

const STARTED_FROM_SET = new Set<string>([
  'playground_preview',
  'shared_preview',
  'runtime_widget',
  'runtime_iframe',
  'unknown',
]);

/**
 * Parses `startedFrom` query param: a single key or comma-separated keys (OR semantics).
 */
export function parseStartedFromQueryParam(
  rawInput?: string,
): ConversationStartedFromKey[] | undefined {
  const raw = rawInput?.trim().toLowerCase();
  if (!raw) return undefined;
  const tokens = raw.split(',').map((p) => p.trim()).filter(Boolean);
  if (!tokens.length) return undefined;
  const out: ConversationStartedFromKey[] = [];
  const seen = new Set<string>();
  for (const t of tokens) {
    if (!STARTED_FROM_SET.has(t)) {
      throw new BadRequestException({
        error: 'Invalid startedFrom filter.',
        errorCode: 'INVALID_STARTED_FROM',
      });
    }
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t as ConversationStartedFromKey);
  }
  return out.length ? out : undefined;
}

export type StartedFromMatchOptions = {
  /** When true, match explicit `unknown` string on the field (sentiment conversation filters use this). */
  includeExplicitUnknownString?: boolean;
};

/**
 * Mongo match condition for a single `startedFrom` field (conversation root, lookup alias, or metadata).
 */
export function buildStartedFromMatchClause(
  fieldPath: string,
  keys: ConversationStartedFromKey[],
  options?: StartedFromMatchOptions,
): Record<string, unknown> {
  const incUnkStr = Boolean(options?.includeExplicitUnknownString);
  const hasUnknown = keys.includes('unknown');
  const known = keys.filter((k): k is Exclude<ConversationStartedFromKey, 'unknown'> => k !== 'unknown');

  const unknownBranches: Record<string, unknown>[] = [
    { [fieldPath]: { $exists: false } },
    { [fieldPath]: null },
    { [fieldPath]: '' },
  ];
  if (incUnkStr) {
    unknownBranches.push({ [fieldPath]: 'unknown' });
  }

  if (hasUnknown && known.length === 0) {
    return { $or: unknownBranches };
  }
  if (!hasUnknown) {
    if (known.length === 1) {
      return { [fieldPath]: known[0] };
    }
    return { [fieldPath]: { $in: known } };
  }
  return {
    $or: [
      ...unknownBranches,
      ...(known.length === 1 ? [{ [fieldPath]: known[0] }] : [{ [fieldPath]: { $in: known } }]),
    ],
  };
}

/**
 * Applies startedFrom to pipelines that merge conditions into `matchParts` (overwrites
 * a prior `fieldPath` constraint such as preview `$nin`) or adds an `$or` `$match` stage.
 */
export function applyStartedFromToMessageLookup(
  matchParts: Record<string, unknown>,
  stages: PipelineStage[],
  fieldPath: string,
  keys: ConversationStartedFromKey[] | undefined,
  options?: StartedFromMatchOptions,
): void {
  if (!keys?.length) return;
  const clause = buildStartedFromMatchClause(fieldPath, keys, options);
  if ('$or' in clause) {
    stages.push({ $match: clause });
  } else {
    Object.assign(matchParts, clause);
  }
}

export function parseCustomerChatsAnalyticsQuery(
  input: CustomerChatsAnalyticsQueryInput,
): ParsedCustomerChatsAnalyticsQuery {
  const { from, to } = parseOverviewDateRange({ from: input.from, to: input.to });

  const gRaw = input.granularity?.trim().toLowerCase();
  const granularity = (gRaw && gRaw.length > 0 ? gRaw : 'day') as CustomerChatsGranularity;
  if (!GRANULARITY_SET.has(granularity)) {
    throw new BadRequestException({
      error: 'Invalid granularity. Use hour, day, week, or month.',
      errorCode: 'INVALID_GRANULARITY',
    });
  }

  const ipRaw = input.includePreview?.trim().toLowerCase();
  const includePreview = ipRaw !== 'false' && ipRaw !== '0';

  const startedFrom = parseStartedFromQueryParam(input.startedFrom);

  let countryCode: string | undefined;
  const ccRaw = input.countryCode?.trim();
  if (ccRaw) {
    countryCode = ccRaw.toUpperCase();
  }

  let deviceType: string | undefined;
  const dtRaw = input.deviceType?.trim().toLowerCase();
  if (dtRaw) {
    deviceType = dtRaw;
  }

  return { from, to, granularity, includePreview, startedFrom, countryCode, deviceType };
}

export function startedFromLabel(key: string): string {
  switch (key) {
    case 'playground_preview':
      return 'Playground Preview';
    case 'shared_preview':
      return 'Shared Preview';
    case 'runtime_widget':
      return 'Runtime Widget';
    case 'runtime_iframe':
      return 'Runtime IFrame';
    case 'unknown':
      return 'Unknown';
    default:
      return 'Unknown';
  }
}

export function messageTypeLabel(key: MessageTypeBreakdownKey): string {
  switch (key) {
    case 'text':
      return 'Text';
    case 'voice':
      return 'Voice';
    case 'dictation':
      return 'Dictation';
    case 'attachment':
      return 'Attachments';
    case 'suggested_question':
      return 'Suggested Questions';
    case 'unknown':
      return 'Unknown';
  }
}

/** Normalize Conversation.startedFrom for grouping (missing → unknown). */
export function normalizeConversationStartedFrom(
  v: string | null | undefined,
): ConversationStartedFromKey {
  const s = String(v ?? '').trim();
  if (!s) return 'unknown';
  if (STARTED_FROM_SET.has(s) && s !== 'unknown') {
    return s as ConversationStartedFromKey;
  }
  return 'unknown';
}

export function isPreviewStartedFromKey(key: string | null | undefined): boolean {
  const k = String(key ?? '').trim();
  return k === 'playground_preview' || k === 'shared_preview';
}

/**
 * Map UsageLedger.usageType → {@link MessageTypeBreakdownKey} for credit grouping.
 * Assistant / STT credits roll into categories that match common billing intuition.
 */
export function ledgerUsageTypeToMessageTypeKey(usageType: string): MessageTypeBreakdownKey {
  switch (usageType) {
    case 'text_message':
    case 'quick_reply_message':
      return 'text';
    case 'voice_message':
    case 'stt_seconds':
      return 'voice';
    case 'dictation_message':
      return 'dictation';
    case 'attachment_message':
      return 'attachment';
    case 'suggested_question_message':
      return 'suggested_question';
    case 'unknown_message':
    case 'assistant_reply':
    case 'unknown':
    default:
      return 'unknown';
  }
}

/** Normalize Message.inputType for user-message counting. */
export function normalizeUserMessageInputType(
  inputType: string | null | undefined,
): MessageTypeBreakdownKey {
  const s = String(inputType ?? '').trim();
  if (!s || s === 'unknown') return 'unknown';
  if (s === 'text' || s === 'quick_reply') return 'text';
  if (s === 'voice') return 'voice';
  if (s === 'dictation') return 'dictation';
  if (s === 'attachment') return 'attachment';
  if (s === 'suggested_question') return 'suggested_question';
  return 'unknown';
}

export type MongoDateTruncUnit = 'hour' | 'day' | 'week' | 'month';

export function mongoDateTruncUnit(granularity: CustomerChatsGranularity): MongoDateTruncUnit {
  return granularity;
}

/** UTC start of the clock hour containing `d`. */
export function utcHourStart(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), 0, 0, 0),
  );
}

/** UTC start of calendar day. */
export function utcDayStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Monday 00:00 UTC for the ISO week containing `d`. */
export function utcMondayStart(d: Date): Date {
  const day = d.getUTCDay();
  const daysSinceMon = (day + 6) % 7;
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - daysSinceMon),
  );
}

export function utcMonthStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

export function alignBucketStart(d: Date, granularity: CustomerChatsGranularity): Date {
  if (granularity === 'hour') return utcHourStart(d);
  if (granularity === 'day') return utcDayStart(d);
  if (granularity === 'week') return utcMondayStart(d);
  return utcMonthStart(d);
}

export function advanceBucketStart(
  d: Date,
  granularity: CustomerChatsGranularity,
): Date {
  if (granularity === 'hour') {
    return new Date(d.getTime() + 60 * 60 * 1000);
  }
  if (granularity === 'day') {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1));
  }
  if (granularity === 'week') {
    const next = new Date(d.getTime());
    next.setUTCDate(next.getUTCDate() + 7);
    return next;
  }
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
}

/**
 * Inclusive bucket starts from aligned `from` through aligned `to` (UTC).
 */
export function enumerateBucketStarts(
  from: Date,
  to: Date,
  granularity: CustomerChatsGranularity,
): Date[] {
  const out: Date[] = [];
  let cur = alignBucketStart(from, granularity);
  const end = alignBucketStart(to, granularity);
  const maxBuckets =
    granularity === 'hour'
      ? Math.ceil(MAX_OVERVIEW_RANGE_MS / (60 * 60 * 1000)) + 4
      : granularity === 'day'
        ? Math.ceil(MAX_OVERVIEW_RANGE_MS / (24 * 60 * 60 * 1000)) + 2
        : granularity === 'week'
          ? Math.ceil(MAX_OVERVIEW_RANGE_MS / (7 * 24 * 60 * 60 * 1000)) + 4
          : 450;
  let guard = 0;
  while (cur <= end && guard++ < maxBuckets) {
    out.push(new Date(cur));
    const next = advanceBucketStart(cur, granularity);
    if (+next === +cur) break;
    cur = next;
  }
  return out;
}

export function bucketKeyIso(d: Date): string {
  return d.toISOString();
}

const MESSAGE_TYPE_ORDER: MessageTypeBreakdownKey[] = [
  'text',
  'voice',
  'dictation',
  'attachment',
  'suggested_question',
  'unknown',
];

const STARTED_FROM_ORDER: ConversationStartedFromKey[] = [
  'playground_preview',
  'shared_preview',
  'runtime_widget',
  'runtime_iframe',
  'unknown',
];

export function sortMessageTypeKeys(keys: MessageTypeBreakdownKey[]): MessageTypeBreakdownKey[] {
  const set = new Set(keys);
  return MESSAGE_TYPE_ORDER.filter((k) => set.has(k));
}

export function sortStartedFromKeys(
  keys: ConversationStartedFromKey[],
): ConversationStartedFromKey[] {
  const set = new Set(keys);
  return STARTED_FROM_ORDER.filter((k) => set.has(k));
}

export const ANALYTICS_UNKNOWN_PAGE_LABEL = 'Unknown page';

export const TOP_PAGES_BREAKDOWN_LIMIT = 20;

/** Mongo `$group._id` expression for canonical Conversation.startedFrom keys. */
export function startedFromGroupId(field = '$startedFrom'): Record<string, unknown> {
  return {
    $switch: {
      branches: [
        { case: { $eq: [field, 'playground_preview'] }, then: 'playground_preview' },
        { case: { $eq: [field, 'shared_preview'] }, then: 'shared_preview' },
        { case: { $eq: [field, 'runtime_widget'] }, then: 'runtime_widget' },
        { case: { $eq: [field, 'runtime_iframe'] }, then: 'runtime_iframe' },
      ],
      default: 'unknown',
    },
  };
}

/**
 * Normalize visitor page URL for analytics breakdown (host + pathname only).
 * Strips query, hash, and trailing slash (except root).
 */
export function normalizeAnalyticsPageUrl(raw?: string | null): {
  page: string;
  pageLabel: string;
} {
  const t = String(raw ?? '').trim();
  if (!t) {
    return { page: ANALYTICS_UNKNOWN_PAGE_LABEL, pageLabel: ANALYTICS_UNKNOWN_PAGE_LABEL };
  }
  const href = /^https?:\/\//i.test(t) ? t : `https://${t}`;
  try {
    const u = new URL(href);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      return { page: ANALYTICS_UNKNOWN_PAGE_LABEL, pageLabel: ANALYTICS_UNKNOWN_PAGE_LABEL };
    }
    let pathname = u.pathname || '/';
    if (pathname.length > 1 && pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1);
    }
    const pageLabel = pathname === '/' ? u.host : `${u.host}${pathname}`;
    return { page: pageLabel, pageLabel };
  } catch {
    return { page: ANALYTICS_UNKNOWN_PAGE_LABEL, pageLabel: ANALYTICS_UNKNOWN_PAGE_LABEL };
  }
}

/** Host-only origin for analytics (no path, query, or hash). */
export function normalizeAnalyticsWebsiteOrigin(raw?: string | null): string | null {
  const t = String(raw ?? '').trim();
  if (!t) return null;
  const href = /^https?:\/\//i.test(t) ? t : `https://${t}`;
  try {
    const u = new URL(href);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.hostname || null;
  } catch {
    return null;
  }
}

export { DEFAULT_OVERVIEW_RANGE_DAYS, MAX_OVERVIEW_RANGE_MS };
