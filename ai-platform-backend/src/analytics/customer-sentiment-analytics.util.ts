import { BadRequestException } from '@nestjs/common';
import {
  SENTIMENT_LABEL_SET,
  SENTIMENT_LABELS,
  type SentimentLabel,
} from './topic-sentiment-classification.constants';
import {
  parseCustomerChatsAnalyticsQuery,
  type CustomerChatsAnalyticsQueryInput,
  type ParsedCustomerChatsAnalyticsQuery,
} from './customer-chats-analytics.util';

export type CustomerSentimentAnalyticsQueryInput = {
  from?: string;
  to?: string;
  granularity?: string;
  includePreview?: string;
  startedFrom?: string;
  sentiment?: string;
};

export type ParsedCustomerSentimentAnalyticsQuery = ParsedCustomerChatsAnalyticsQuery & {
  sentiment?: SentimentLabel;
};

/** Customer-visible labels for the sentiment analytics API (not the classifier). */
export const SENTIMENT_ANALYTICS_DISPLAY_LABELS: Record<SentimentLabel, string> = {
  positive: 'Positive',
  neutral: 'Neutral',
  negative: 'Negative',
  mixed: 'Mixed',
  unknown: 'Unknown',
};

export function parseCustomerSentimentAnalyticsQuery(
  input: CustomerSentimentAnalyticsQueryInput,
): ParsedCustomerSentimentAnalyticsQuery {
  const base = parseCustomerChatsAnalyticsQuery({
    from: input.from,
    to: input.to,
    granularity: input.granularity,
    includePreview: input.includePreview,
    startedFrom: input.startedFrom,
  } satisfies CustomerChatsAnalyticsQueryInput);

  let sentiment: SentimentLabel | undefined;
  const sr = input.sentiment?.trim().toLowerCase();
  if (sr) {
    if (!SENTIMENT_LABEL_SET.has(sr)) {
      throw new BadRequestException({
        error: 'Invalid sentiment filter.',
        errorCode: 'INVALID_SENTIMENT_FILTER',
      });
    }
    sentiment = sr as SentimentLabel;
  }

  return { ...base, sentiment };
}

export const SENTIMENT_ANALYTICS_KEYS: readonly SentimentLabel[] = SENTIMENT_LABELS;
