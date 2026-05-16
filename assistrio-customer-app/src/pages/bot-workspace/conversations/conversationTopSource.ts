import type { CustomerConversationMessageSource } from '@/api/types';

function scoreOrNegInf(score: number | undefined): number {
  return typeof score === 'number' && Number.isFinite(score) ? score : Number.NEGATIVE_INFINITY;
}

export function sortSourcesByMatchScoreDesc(
  sources: CustomerConversationMessageSource[],
): CustomerConversationMessageSource[] {
  return [...sources].sort((a, b) => scoreOrNegInf(b.score) - scoreOrNegInf(a.score));
}

export function pickTopMatchedSource(
  sources: CustomerConversationMessageSource[],
): CustomerConversationMessageSource | null {
  if (!sources.length) return null;
  return sortSourcesByMatchScoreDesc(sources)[0] ?? null;
}

export function sourcesOtherThanTop(
  sorted: CustomerConversationMessageSource[],
  top: CustomerConversationMessageSource | null,
): CustomerConversationMessageSource[] {
  if (!sorted.length) return [];
  if (!top) return sorted.slice(1);
  const i = sorted.indexOf(top);
  if (i === -1) return sorted.filter((s) => s !== top);
  return [...sorted.slice(0, i), ...sorted.slice(i + 1)];
}
