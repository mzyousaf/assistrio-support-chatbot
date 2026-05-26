import type { AnalyticsHistoryWindowMetadata } from '../../entitlements/analytics-entitlement-window.util';

export function workspaceIdFromBotRecord(bot: Record<string, unknown>): string {
  const raw = bot.workspaceId;
  if (raw == null) return '';
  const id = String(raw).trim();
  return id || '';
}

export type CustomerAnalyticsResponseWithWindow = {
  analyticsWindow?: AnalyticsHistoryWindowMetadata;
};
