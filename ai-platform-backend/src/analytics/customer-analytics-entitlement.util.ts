import {
  attachAnalyticsWindowMetadata,
  clampParsedAnalyticsQueryDates,
  type AnalyticsHistoryWindowMetadata,
} from '../entitlements/analytics-entitlement-window.util';

export type CustomerAnalyticsGetOptions = {
  analyticsHistoryDays?: number | null;
};

export function applyAnalyticsHistoryToParsedQuery<T extends { from: Date; to: Date }>(
  parsed: T,
  options?: CustomerAnalyticsGetOptions,
): { parsed: T; window: AnalyticsHistoryWindowMetadata | null } {
  return clampParsedAnalyticsQueryDates(parsed, options?.analyticsHistoryDays);
}

export { attachAnalyticsWindowMetadata };
