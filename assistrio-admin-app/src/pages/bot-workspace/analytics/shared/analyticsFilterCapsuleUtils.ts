import type { AdminChatsAnalyticsStartedFromKey } from '@/api/types';
import type { ChatsAnalyticsDatePreset } from '@/lib/chatsAnalyticsQuery';
import { localYmd } from '@/lib/chatsAnalyticsQuery';
import { customYmdRangeIsValid } from '@/lib/analyticsQueryDates';

export type StandardDateControlValues = {
  preset: ChatsAnalyticsDatePreset;
  customFrom: string;
  customTo: string;
  includePreview: boolean;
  /** Empty = all widget channels (default). Selected keys are OR‑ed in API `startedFrom`. */
  startedFromKeys: AdminChatsAnalyticsStartedFromKey[];
};

export const ANALYTICS_DATE_PRESET_OPTIONS: { id: ChatsAnalyticsDatePreset; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: '7d', label: 'Last 7 days' },
  { id: '30d', label: 'Last 30 days' },
  { id: '90d', label: 'Last 90 days' },
  { id: 'custom', label: 'Custom range' },
];

export function formatAnalyticsYmdChip(ymd: string): string {
  const t = ymd.trim();
  if (!t) return '';
  const d = new Date(`${t}T12:00:00`);
  if (!Number.isFinite(d.getTime())) return t;
  try {
    return d.toLocaleDateString(undefined, { dateStyle: 'medium' });
  } catch {
    return t;
  }
}

export function analyticsDateRangeValueLabel(params: {
  preset: ChatsAnalyticsDatePreset;
  customFrom: string;
  customTo: string;
}): string {
  if (params.preset === 'custom') {
    const a = params.customFrom.trim();
    const b = params.customTo.trim();
    if (a && b && customYmdRangeIsValid(a, b)) {
      return `${formatAnalyticsYmdChip(a)} – ${formatAnalyticsYmdChip(b)}`;
    }
    if (a || b) return 'Custom range';
    return 'Custom range';
  }
  return ANALYTICS_DATE_PRESET_OPTIONS.find((p) => p.id === params.preset)?.label ?? params.preset;
}

export function seedCustomRangeIfEmpty(): { customFrom: string; customTo: string } {
  const to = new Date();
  const from = new Date(to.getTime() - 30 * 86400000);
  return { customFrom: localYmd(from), customTo: localYmd(to) };
}
