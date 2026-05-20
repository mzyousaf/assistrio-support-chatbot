import type {
  CustomerChatsAnalyticsStartedFromBreakdownItem,
  CustomerChatsAnalyticsStartedFromKey,
} from '@/api/types';
import { widgetStartedFromUiLabel } from '@/pages/bot-workspace/analytics/shared/AnalyticsInsightsFilterBars';

/** Friendly, stable labels — never expose raw API keys in UI. */
export function friendlyWidgetSourceLabel(key: CustomerChatsAnalyticsStartedFromKey): string {
  return widgetStartedFromUiLabel(key);
}

export type WidgetSourceNormalizedRow = CustomerChatsAnalyticsStartedFromBreakdownItem & {
  friendlyLabel: string;
};

export function normalizeWidgetSourceRows(
  rows: CustomerChatsAnalyticsStartedFromBreakdownItem[],
): WidgetSourceNormalizedRow[] {
  return rows.map((r) => ({
    ...r,
    friendlyLabel: friendlyWidgetSourceLabel(r.key),
  }));
}

/** Conversations desc; unknown source always last. */
export function sortWidgetSourceRows(rows: WidgetSourceNormalizedRow[]): WidgetSourceNormalizedRow[] {
  const copy = [...rows];
  copy.sort((a, b) => {
    const aUn = a.key === 'unknown' ? 1 : 0;
    const bUn = b.key === 'unknown' ? 1 : 0;
    if (aUn !== bUn) return aUn - bUn;
    return b.conversations - a.conversations || b.messages - a.messages;
  });
  return copy;
}

export function hasWidgetSourceSignal(rows: CustomerChatsAnalyticsStartedFromBreakdownItem[]): boolean {
  return rows.some((r) => r.conversations > 0 || r.messages > 0);
}
