import type { CustomerSentimentLabelId } from '@/api/types';
import { CHART } from '../shared/analyticsChartTheme';

export const SENTIMENT_STACK_ORDER: readonly CustomerSentimentLabelId[] = [
  'positive',
  'neutral',
  'negative',
  'mixed',
  'unknown',
] as const;

export const SENTIMENT_DISPLAY_FALLBACK: Record<CustomerSentimentLabelId, string> = {
  positive: 'Positive',
  neutral: 'Neutral',
  negative: 'Negative',
  mixed: 'Mixed',
  unknown: 'Unknown',
};

/** Mixed: warm amber shifting into violet for a readable “mixed signal” cue. */
export const SENTIMENT_MIXED_VISUAL = '#a855f7';

export const SENTIMENT_CHART_COLORS: Record<CustomerSentimentLabelId, string> = {
  positive: CHART.teal600,
  neutral: CHART.slate400,
  negative: CHART.rose400,
  mixed: SENTIMENT_MIXED_VISUAL,
  unknown: CHART.slate300,
};
