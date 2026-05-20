import type { AdminSentimentLabelId } from '@/api/types';

export const SENTIMENT_STACK_ORDER: readonly AdminSentimentLabelId[] = [
  'positive',
  'neutral',
  'negative',
  'mixed',
  'unknown',
] as const;

export const SENTIMENT_DISPLAY_FALLBACK: Record<AdminSentimentLabelId, string> = {
  positive: 'Positive',
  neutral: 'Neutral',
  negative: 'Negative',
  mixed: 'Mixed',
  unknown: 'Unknown',
};
