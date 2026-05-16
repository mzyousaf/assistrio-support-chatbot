import { MAIN_TOPIC_SUBTOPICS, type TopicTaxonomyId } from './topic-sentiment-classification.taxonomy';

/** Flattened allowed sub-topic ids (same id may be valid under multiple mains). */
export const ALL_SUBTOPIC_IDS: readonly string[] = [...new Set(Object.values(MAIN_TOPIC_SUBTOPICS).flat())];

export const SUBTOPIC_ID_SET = new Set(ALL_SUBTOPIC_IDS);

export function isSubTopicUnderMain(sub: string, main: TopicTaxonomyId): boolean {
  const list = MAIN_TOPIC_SUBTOPICS[main];
  return Boolean(sub && list?.includes(sub));
}

export function isSubTopicValidForMains(sub: string, mains: readonly TopicTaxonomyId[]): boolean {
  return mains.some((m) => isSubTopicUnderMain(sub, m));
}

export function normalizeSubTopicToken(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.trim().toLowerCase().replace(/\s+/g, '_');
}

/** Returns the token only if it is a known sub-topic id for the given main. */
export function narrowPrimarySubTopic(raw: unknown, primary: TopicTaxonomyId): string | undefined {
  const s = normalizeSubTopicToken(raw);
  if (!s || !SUBTOPIC_ID_SET.has(s)) return undefined;
  if (!isSubTopicUnderMain(s, primary)) return undefined;
  return s;
}

/**
 * Deduped sub-topic labels: each must appear under at least one main in `mains`.
 * Preserves first-seen order; caps at `max`.
 */
export function narrowSubTopicLabelArray(
  raw: unknown,
  mains: readonly TopicTaxonomyId[],
  max: number,
): string[] {
  if (!mains.length || max <= 0) return [];
  const arr = Array.isArray(raw) ? raw : [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of arr) {
    const s = normalizeSubTopicToken(x);
    if (!s || !SUBTOPIC_ID_SET.has(s) || seen.has(s)) continue;
    if (!isSubTopicValidForMains(s, mains)) continue;
    seen.add(s);
    out.push(s);
    if (out.length >= max) break;
  }
  return out;
}
