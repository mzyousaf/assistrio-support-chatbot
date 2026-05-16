/**
 * FAQ KB rows are keyed by `faqMeta.faqIndex`. Duplicate Mongo docs with the same index (races,
 * legacy writes, or map collisions in upsert) inflate workspace lists and cause extra rows on save.
 */

export type FaqKbLeanForDedupe = {
  _id: unknown;
  faqMeta?: { faqIndex?: number };
  lastContentUpdatedAt?: Date;
  createdAt?: Date;
};

function itemTimeMs(it: FaqKbLeanForDedupe): number {
  if (it.lastContentUpdatedAt instanceof Date) return it.lastContentUpdatedAt.getTime();
  if (it.createdAt instanceof Date) return it.createdAt.getTime();
  return 0;
}

function isNewer(a: FaqKbLeanForDedupe, b: FaqKbLeanForDedupe): boolean {
  const d = itemTimeMs(a) - itemTimeMs(b);
  if (d !== 0) return d > 0;
  return String(a._id) > String(b._id);
}

/**
 * One canonical row per non-negative `faqMeta.faqIndex`, ordered by index ascending; then rows
 * without an index (legacy), ordered by recency.
 */
export function dedupeFaqKnowledgeItemsForOrderedRead<T extends FaqKbLeanForDedupe>(items: readonly T[]): T[] {
  const withIdx: T[] = [];
  const noIdx: T[] = [];
  for (const it of items) {
    const idx = it.faqMeta?.faqIndex;
    if (typeof idx === 'number' && Number.isFinite(idx) && idx >= 0) withIdx.push(it);
    else noIdx.push(it);
  }
  const byKey = new Map<number, T>();
  for (const it of withIdx) {
    const k = it.faqMeta!.faqIndex!;
    const prev = byKey.get(k);
    if (!prev || isNewer(it, prev)) byKey.set(k, it);
  }
  const sortedIdx = [...byKey.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v);
  noIdx.sort((a, b) => {
    const d = itemTimeMs(a) - itemTimeMs(b);
    if (d !== 0) return d;
    return String(a._id).localeCompare(String(b._id));
  });
  return [...sortedIdx, ...noIdx];
}

/** `_id`s of duplicate live rows to drop (same `faqMeta.faqIndex`, loser = older / lower _id tiebreak). */
export function faqKnowledgeDuplicateIndexIds<T extends FaqKbLeanForDedupe>(items: readonly T[]): unknown[] {
  const withIdx: T[] = [];
  for (const it of items) {
    const idx = it.faqMeta?.faqIndex;
    if (typeof idx === 'number' && Number.isFinite(idx) && idx >= 0) withIdx.push(it);
  }
  const groups = new Map<number, T[]>();
  for (const it of withIdx) {
    const k = it.faqMeta!.faqIndex!;
    const g = groups.get(k) ?? [];
    g.push(it);
    groups.set(k, g);
  }
  const losers: unknown[] = [];
  for (const [, group] of groups) {
    if (group.length <= 1) continue;
    const sorted = [...group].sort((a, b) => {
      const d = itemTimeMs(b) - itemTimeMs(a);
      if (d !== 0) return d;
      return String(b._id).localeCompare(String(a._id));
    });
    for (let i = 1; i < sorted.length; i++) losers.push(sorted[i]!._id);
  }
  return losers;
}
