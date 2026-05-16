import type { CustomerChatsAnalyticsGranularity } from '@/api/types';

const MS_PER_DAY = 86_400_000;

/**
 * Chart/API granularity from the selected time span (matches customer analytics product rules).
 * - ≤ 24h → hour
 * - > 24h and ≤ 31 days → day
 * - > 31 days and ≤ 120 days → week
 * - > 120 days → month
 */
export function resolveAnalyticsGranularity(fromIso: string, toIso: string): CustomerChatsAnalyticsGranularity {
  const from = new Date(fromIso);
  const to = new Date(toIso);
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime())) return 'day';
  const spanMs = Math.max(0, to.getTime() - from.getTime());
  if (spanMs <= MS_PER_DAY) return 'hour';
  if (spanMs <= 31 * MS_PER_DAY) return 'day';
  if (spanMs <= 120 * MS_PER_DAY) return 'week';
  return 'month';
}

const VIEW_LABELS: Record<CustomerChatsAnalyticsGranularity, string> = {
  hour: 'Hourly',
  day: 'Daily',
  week: 'Weekly',
  month: 'Monthly',
};

/** Read-only UI line, e.g. `View: Hourly`. */
export function formatAnalyticsGranularityViewCaption(g: CustomerChatsAnalyticsGranularity): string {
  return `View: ${VIEW_LABELS[g] ?? g}`;
}
