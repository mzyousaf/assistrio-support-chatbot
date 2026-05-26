import type { ParsedOverviewDateRange } from '../analytics/analytics-date-range.util';

export type AnalyticsHistoryWindowMetadata = {
  analyticsWindowApplied: boolean;
  analyticsHistoryDays: number;
  effectiveFrom: string;
  requestedFrom?: string;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function earliestAllowedAnalyticsFrom(now: Date, analyticsHistoryDays: number): Date {
  const days = Math.max(1, Math.floor(analyticsHistoryDays));
  return new Date(now.getTime() - days * MS_PER_DAY);
}

export function clampParsedOverviewDateRangeToAnalyticsHistory(
  parsed: ParsedOverviewDateRange,
  analyticsHistoryDays: number | null | undefined,
  now: Date = new Date(),
): { range: ParsedOverviewDateRange; window: AnalyticsHistoryWindowMetadata | null } {
  if (analyticsHistoryDays == null) {
    return { range: parsed, window: null };
  }

  const days = Math.max(1, Math.floor(analyticsHistoryDays));
  const earliest = earliestAllowedAnalyticsFrom(now, days);
  if (parsed.from.getTime() >= earliest.getTime()) {
    return { range: parsed, window: null };
  }

  const requestedFrom = parsed.from.toISOString();
  const effectiveFromDate = earliest;
  const nextTo =
    parsed.to.getTime() < effectiveFromDate.getTime() ? new Date(effectiveFromDate) : parsed.to;

  return {
    range: {
      from: effectiveFromDate,
      to: nextTo,
      label: parsed.label,
    },
    window: {
      analyticsWindowApplied: true,
      analyticsHistoryDays: days,
      effectiveFrom: effectiveFromDate.toISOString(),
      requestedFrom,
    },
  };
}

export function clampIsoDateFromToAnalyticsHistory(
  dateFrom: string | null | undefined,
  analyticsHistoryDays: number | null | undefined,
  now: Date = new Date(),
): { dateFrom: string | null; window: AnalyticsHistoryWindowMetadata | null } {
  const raw = typeof dateFrom === 'string' ? dateFrom.trim() : '';
  if (!raw || analyticsHistoryDays == null) {
    return { dateFrom: raw || null, window: null };
  }

  const parsed = new Date(raw);
  if (!Number.isFinite(parsed.getTime())) {
    return { dateFrom: raw, window: null };
  }

  const days = Math.max(1, Math.floor(analyticsHistoryDays));
  const earliest = earliestAllowedAnalyticsFrom(now, days);
  if (parsed.getTime() >= earliest.getTime()) {
    return { dateFrom: raw, window: null };
  }

  return {
    dateFrom: earliest.toISOString(),
    window: {
      analyticsWindowApplied: true,
      analyticsHistoryDays: days,
      effectiveFrom: earliest.toISOString(),
      requestedFrom: parsed.toISOString(),
    },
  };
}

export function clampParsedAnalyticsQueryDates<T extends { from: Date; to: Date }>(
  parsed: T,
  analyticsHistoryDays: number | null | undefined,
  now: Date = new Date(),
): { parsed: T; window: AnalyticsHistoryWindowMetadata | null } {
  const { range, window } = clampParsedOverviewDateRangeToAnalyticsHistory(
    { from: parsed.from, to: parsed.to, label: 'Custom range' },
    analyticsHistoryDays,
    now,
  );
  return {
    parsed: { ...parsed, from: range.from, to: range.to },
    window,
  };
}

export function attachAnalyticsWindowMetadata<T extends Record<string, unknown>>(
  response: T,
  window: AnalyticsHistoryWindowMetadata | null | undefined,
): T & { analyticsWindow?: AnalyticsHistoryWindowMetadata } {
  if (!window) return response;
  return { ...response, analyticsWindow: window };
}
