import { CHART } from '@/pages/bot-workspace/analytics/shared/analyticsChartTheme';

/** Teal-forward donut palette aligned with analytics widget source charts. */
export const USAGE_SLICE_COLORS = ['#0d9488', '#14b8a6', '#2dd4bf', '#5eead4', '#94a3b8'] as const;

export const USAGE_CHART = CHART;

export const USAGE_CHART_TOOLTIP_CLASS =
  'rounded-lg border border-slate-200/90 bg-white px-3 py-2 text-xs shadow-[0_8px_24px_-8px_rgba(15,23,42,0.08)]';

export function usageSliceColor(index: number): string {
  return USAGE_SLICE_COLORS[index % USAGE_SLICE_COLORS.length] ?? USAGE_SLICE_COLORS[0];
}
