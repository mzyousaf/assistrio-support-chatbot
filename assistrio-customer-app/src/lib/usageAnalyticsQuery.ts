import { isoRangeForLocalDateInputs } from '@/lib/chatsAnalyticsQuery';
import { customYmdRangeIsValid } from '@/lib/analyticsQueryDates';

export type UsageDatePreset = '7d' | '30d' | '90d' | 'billing_period' | 'custom';

export type UsageDateFilterValues = {
  preset: UsageDatePreset;
  customFrom: string;
  customTo: string;
};

export const USAGE_DATE_FILTER_DEFAULTS: UsageDateFilterValues = {
  preset: '7d',
  customFrom: '',
  customTo: '',
};

export const USAGE_DATE_PRESET_OPTIONS: { id: UsageDatePreset; label: string }[] = [
  { id: '7d', label: 'Last 7 days' },
  { id: '30d', label: 'Last 30 days' },
  { id: '90d', label: 'Last 90 days' },
  { id: 'custom', label: 'Custom range' },
];

export function utcYmdFromDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function utcYmdFromIso(iso: string | null | undefined): string | null {
  if (!iso?.trim()) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return utcYmdFromDate(d);
}

export function lastUtcDaysRange(days: number, now: Date = new Date()): { startDate: string; endDate: string } {
  const safeDays = Math.max(1, Math.floor(days));
  const endDate = utcYmdFromDate(now);
  const start = new Date(now.getTime() - (safeDays - 1) * 24 * 60 * 60 * 1000);
  return { startDate: utcYmdFromDate(start), endDate };
}

export function computeUsageAnalyticsDateRange(
  date: UsageDateFilterValues,
  billingPeriod?: { start: string; end: string } | null,
  now: Date = new Date(),
): { startDate: string; endDate: string } {
  if (date.preset === 'billing_period') {
    const startDate = utcYmdFromIso(billingPeriod?.start);
    const endDate = utcYmdFromIso(billingPeriod?.end);
    if (startDate && endDate) return { startDate, endDate };
    return lastUtcDaysRange(7, now);
  }

  if (date.preset === 'custom') {
    const range = isoRangeForLocalDateInputs(date.customFrom, date.customTo);
    if (range && customYmdRangeIsValid(date.customFrom, date.customTo)) {
      return {
        startDate: utcYmdFromDate(new Date(range.from)),
        endDate: utcYmdFromDate(new Date(range.to)),
      };
    }
    return lastUtcDaysRange(7, now);
  }

  const days = date.preset === '90d' ? 90 : date.preset === '30d' ? 30 : 7;
  return lastUtcDaysRange(days, now);
}

export function usageDateRangeValueLabel(date: UsageDateFilterValues): string {
  if (date.preset === 'custom') {
    const a = date.customFrom.trim();
    const b = date.customTo.trim();
    if (a && b && customYmdRangeIsValid(a, b)) return `${a} – ${b}`;
    return 'Custom range';
  }
  if (date.preset === 'billing_period') {
    return 'Last 7 days';
  }
  return USAGE_DATE_PRESET_OPTIONS.find((opt) => opt.id === date.preset)?.label ?? date.preset;
}

export function usageDateRangeMatchesDefault(
  date: UsageDateFilterValues,
  defaults: UsageDateFilterValues = USAGE_DATE_FILTER_DEFAULTS,
): boolean {
  return (
    date.preset === defaults.preset &&
    date.customFrom.trim() === defaults.customFrom.trim() &&
    date.customTo.trim() === defaults.customTo.trim()
  );
}

export function buildUsageAnalyticsQueryParams(input: {
  date: UsageDateFilterValues;
  agentIds: string[];
  billingPeriod?: { start: string; end: string } | null;
}): { startDate: string; endDate: string; botIds?: string } {
  const { startDate, endDate } = computeUsageAnalyticsDateRange(input.date, input.billingPeriod);
  const botIds = input.agentIds.filter(Boolean);
  return {
    startDate,
    endDate,
    ...(botIds.length > 0 ? { botIds: botIds.join(',') } : {}),
  };
}
