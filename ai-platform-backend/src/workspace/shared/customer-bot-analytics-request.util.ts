import { parseOverviewDateRange } from '../../analytics/analytics-date-range.util';
import {
  attachAnalyticsWindowMetadata,
  clampParsedOverviewDateRangeToAnalyticsHistory,
  type AnalyticsHistoryWindowMetadata,
} from '../../entitlements/analytics-entitlement-window.util';

export function clampCustomerAnalyticsQueryDates(
  from: string | undefined,
  to: string | undefined,
  analyticsHistoryDays: number | null | undefined,
): {
  from: string | undefined;
  to: string | undefined;
  window: AnalyticsHistoryWindowMetadata | null;
} {
  const parsed = parseOverviewDateRange({ from, to });
  const { range, window } = clampParsedOverviewDateRangeToAnalyticsHistory(parsed, analyticsHistoryDays);
  return {
    from: range.from.toISOString(),
    to: range.to.toISOString(),
    window,
  };
}

export function withAnalyticsWindowMetadata<T extends Record<string, unknown>>(
  body: T,
  window: AnalyticsHistoryWindowMetadata | null,
): T & { analyticsWindow?: AnalyticsHistoryWindowMetadata } {
  return attachAnalyticsWindowMetadata(body, window);
}
