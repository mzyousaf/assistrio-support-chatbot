import { BadRequestException } from '@nestjs/common';
import {
  DEFAULT_OVERVIEW_RANGE_DAYS,
  parseOverviewDateRange,
} from './analytics-date-range.util';
import type { CustomerChatsGranularity } from './customer-chats-analytics.util';

export type KnowledgeMessageSourceType =
  | 'document'
  | 'faq'
  | 'note'
  | 'datasheet'
  | 'suggestion'
  | 'website'
  | 'manual_text'
  | 'unknown';

export type CustomerKnowledgeSourcesAnalyticsQueryInput = {
  from?: string;
  to?: string;
  granularity?: string;
  sourceType?: string;
  includePreview?: string;
};

export type ParsedCustomerKnowledgeSourcesAnalyticsQuery = {
  from: Date;
  to: Date;
  granularity: CustomerChatsGranularity;
  includePreview: boolean;
  sourceType?: KnowledgeMessageSourceType;
};

const GRANULARITY_SET = new Set<string>(['hour', 'day', 'week', 'month']);

const SOURCE_TYPE_SET = new Set<string>([
  'document',
  'faq',
  'note',
  'datasheet',
  'suggestion',
  'website',
  'manual_text',
  'unknown',
]);

const SOURCE_TYPE_ORDER: KnowledgeMessageSourceType[] = [
  'document',
  'faq',
  'note',
  'datasheet',
  'website',
  'suggestion',
  'manual_text',
  'unknown',
];

export function parseCustomerKnowledgeSourcesAnalyticsQuery(
  input: CustomerKnowledgeSourcesAnalyticsQueryInput,
): ParsedCustomerKnowledgeSourcesAnalyticsQuery {
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

  let sourceType: KnowledgeMessageSourceType | undefined;
  const stRaw = input.sourceType?.trim().toLowerCase();
  if (stRaw) {
    if (!SOURCE_TYPE_SET.has(stRaw)) {
      throw new BadRequestException({
        error: 'Invalid sourceType filter.',
        errorCode: 'INVALID_SOURCE_TYPE',
      });
    }
    sourceType = stRaw as KnowledgeMessageSourceType;
  }

  return { from, to, granularity, includePreview, sourceType };
}

export function knowledgeSourceTypeLabel(t: KnowledgeMessageSourceType): string {
  switch (t) {
    case 'document':
      return 'Document';
    case 'faq':
      return 'FAQ';
    case 'note':
      return 'Note';
    case 'datasheet':
      return 'Datasheet';
    case 'suggestion':
      return 'Suggestion';
    case 'website':
      return 'Website';
    case 'manual_text':
      return 'Manual text';
    case 'unknown':
    default:
      return 'Unknown';
  }
}

export function normalizeKnowledgeSourceTypeForBreakdown(
  raw: string | null | undefined,
): KnowledgeMessageSourceType {
  const s = String(raw ?? '').trim();
  if (!s || !SOURCE_TYPE_SET.has(s)) return 'unknown';
  return s as KnowledgeMessageSourceType;
}

export function sortKnowledgeSourceTypeKeys(
  keys: KnowledgeMessageSourceType[],
): KnowledgeMessageSourceType[] {
  const set = new Set(keys);
  return SOURCE_TYPE_ORDER.filter((k) => set.has(k));
}

/**
 * Customer analytics: only expose http(s) URLs (never s3://, file://, or other schemes).
 */
export function safeKnowledgeSourceUrlForAnalytics(raw: string | undefined | null): string | null {
  const t = String(raw ?? '').trim();
  if (!t) return null;
  const lower = t.toLowerCase();
  if (lower.startsWith('s3://') || lower.startsWith('file://') || lower.startsWith('ftp://')) {
    return null;
  }
  try {
    const u = new URL(t);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return t;
  } catch {
    return null;
  }
}

export function divideOrNull(sum: number, count: number): number | null {
  if (!Number.isFinite(sum) || !Number.isFinite(count) || count <= 0) return null;
  return sum / count;
}

export { DEFAULT_OVERVIEW_RANGE_DAYS };
