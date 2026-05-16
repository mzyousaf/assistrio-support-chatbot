import type { CustomerChatsAnalyticsRange } from '@/api/types';

/** Compact date span for chart headers (no times — range boundaries only). */
export function formatSentimentAnalyticsRangeCaption(range: CustomerChatsAnalyticsRange): string {
  const from = new Date(range.from);
  const to = new Date(range.to);
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime())) return '';
  const dOpts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
  return `${from.toLocaleDateString(undefined, dOpts)} – ${to.toLocaleDateString(undefined, dOpts)}`;
}
