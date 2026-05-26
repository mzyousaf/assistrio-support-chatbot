import type { ChatsAnalyticsDatePreset } from '@/lib/chatsAnalyticsQuery';
import { localYmd } from '@/lib/chatsAnalyticsQuery';
import type { AnalyticsHistoryWindowMetadata } from '@/api/types';

export function isAnalyticsDatePresetAllowed(
  preset: ChatsAnalyticsDatePreset,
  maxHistoryDays: number | null | undefined,
): boolean {
  if (maxHistoryDays == null) return true;
  const maxDays = Math.max(1, Math.floor(maxHistoryDays));
  if (preset === 'today' || preset === '7d') return true;
  if (preset === '30d') return maxDays >= 30;
  if (preset === '90d') return maxDays >= 90;
  return true;
}

export function filterAnalyticsDatePresetsForHistoryLimit(
  presets: Array<{ id: ChatsAnalyticsDatePreset; label: string }>,
  maxHistoryDays: number | null | undefined,
): Array<{ id: ChatsAnalyticsDatePreset; label: string; disabled?: boolean }> {
  return presets.map((preset) => ({
    ...preset,
    disabled: !isAnalyticsDatePresetAllowed(preset.id, maxHistoryDays),
  }));
}

export function minAnalyticsCustomFromYmd(maxHistoryDays: number | null | undefined): string | undefined {
  if (maxHistoryDays == null) return undefined;
  const days = Math.max(1, Math.floor(maxHistoryDays));
  const min = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return localYmd(min);
}

export function shouldShowAnalyticsWindowClampedNote(
  analyticsWindow?: AnalyticsHistoryWindowMetadata | null,
): boolean {
  return analyticsWindow?.analyticsWindowApplied === true;
}
