export type KnowledgeMessageSourceType =
  | 'document'
  | 'faq'
  | 'note'
  | 'datasheet'
  | 'suggestion'
  | 'website'
  | 'manual_text'
  | 'unknown';

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

