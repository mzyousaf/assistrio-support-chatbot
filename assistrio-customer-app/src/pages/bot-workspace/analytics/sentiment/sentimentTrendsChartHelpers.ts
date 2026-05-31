import type { CustomerSentimentBreakdownItem } from '@/api/types';
import type { SentimentMetricMode } from '@/lib/sentimentAnalyticsQuery';
import { formatAnalyticsInteger } from '@/lib/analyticsFormat';
import { CHART } from '../shared/analyticsChartTheme';
import { SENTIMENT_CHART_COLORS } from './sentimentChartTheme';

/** Human-readable count line for stacked sentiment tooltips (tested). */
export function formatSentimentOverTimeTooltipCount(
  count: number,
  unit: 'messages' | 'chats' = 'messages',
): string {
  const n = formatAnalyticsInteger(count);
  return unit === 'chats' ? `${n} distinct chats` : `${n} user messages`;
}

export type SentimentChartStyle = 'bar' | 'trend' | 'distribution';

/** Card / modal title for the sentiment trends chart (matches selected view). */
export function sentimentTrendChartTitle(chartStyle: SentimentChartStyle): string {
  switch (chartStyle) {
    case 'bar':
      return 'Sentiment Heights';
    case 'trend':
      return 'Sentiment Trends';
    case 'distribution':
      return 'Sentiment Distribution';
  }
}

export type SentimentRankingRow = {
  id: string;
  label: string;
  count: number;
  pctOfTotal: number | null;
};

/** Stable series order for sentiment trends charts (classified labels only; no unclassified). */
export const SENTIMENT_CHART_SERIES_ORDER = ['positive', 'neutral', 'negative', 'mixed', 'unknown'] as const;

export function buildSentimentRankingRows(
  breakdown: CustomerSentimentBreakdownItem[],
  metricMode: SentimentMetricMode = 'messages',
): {
  rows: SentimentRankingRow[];
  seriesOrder: readonly string[];
} {
  const fromApi: SentimentRankingRow[] = breakdown.map((r) => ({
    id: r.sentiment,
    label: r.label,
    count: Math.max(
      0,
      Math.trunc(metricMode === 'messages' ? r.messages : r.conversations),
    ),
    pctOfTotal: null,
  }));
  const total = fromApi.reduce((s, r) => s + r.count, 0);
  const withPct = fromApi.map((r) => ({
    ...r,
    pctOfTotal: total > 0 ? (r.count / total) * 100 : null,
  }));
  const rows = [...withPct].sort((a, b) => b.count - a.count);
  return { rows, seriesOrder: SENTIMENT_CHART_SERIES_ORDER };
}

export function colorForSentimentSeries(id: string): string {
  if (id === 'unclassified') return CHART.slate300;
  const k = id as keyof typeof SENTIMENT_CHART_COLORS;
  return SENTIMENT_CHART_COLORS[k] ?? CHART.slate400;
}
