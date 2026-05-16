import type {
  CustomerChatsAnalyticsGranularity,
  CustomerChatsAnalyticsStartedFromKey,
  CustomerSentimentAnalyticsParams,
  CustomerSentimentAnalyticsResponse,
  CustomerSentimentAnalyticsTimeSeriesPoint,
  CustomerSentimentLabelId,
} from '@/api/types';
import { resolveAnalyticsGranularity } from '@/lib/analyticsGranularity';
import {
  computeDateRangeFromAnalyticsPreset,
  localYmd,
  type ChatsAnalyticsDatePreset,
} from '@/lib/chatsAnalyticsQuery';

export type { ChatsAnalyticsDatePreset };

/** Message-level vs distinct-chat views (same API payload; charts pick the matching series). */
export type SentimentMetricMode = 'messages' | 'conversations';

export type SentimentAnalyticsUiState = {
  preset: ChatsAnalyticsDatePreset;
  customFrom: string;
  customTo: string;
  includePreview: boolean;
  startedFrom: '' | CustomerChatsAnalyticsStartedFromKey;
  sentiment: '' | CustomerSentimentLabelId;
  metricMode: SentimentMetricMode;
};

export const SENTIMENT_ANALYTICS_DEFAULTS: SentimentAnalyticsUiState = {
  preset: '7d',
  customFrom: '',
  customTo: '',
  includePreview: true,
  startedFrom: '',
  sentiment: '',
  metricMode: 'messages',
};

/** Map API conversation buckets to the same point shape message charts expect. */
export function sentimentChartTimeSeriesPoints(
  data: CustomerSentimentAnalyticsResponse,
  mode: SentimentMetricMode,
): CustomerSentimentAnalyticsTimeSeriesPoint[] {
  if (mode === 'messages') return data.timeSeries;
  const conv = data.conversationTimeSeries;
  if (!conv?.length) return data.timeSeries;
  return conv.map((p) => ({
    date: p.date,
    classifiedMessages: p.classifiedConversations,
    unclassifiedMessages: p.unclassifiedConversations,
    positive: p.positive,
    neutral: p.neutral,
    negative: p.negative,
    mixed: p.mixed,
    unknown: p.unknown,
    averageSentimentScore: p.averageSentimentScore,
  }));
}

export function buildSentimentAnalyticsApiParams(
  state: SentimentAnalyticsUiState,
): CustomerSentimentAnalyticsParams {
  const { from, to } = computeDateRangeFromAnalyticsPreset(state, { invalidCustomFallbackLastDays: 7 });
  const granularity: CustomerChatsAnalyticsGranularity = resolveAnalyticsGranularity(from, to);

  const params: CustomerSentimentAnalyticsParams = {
    from,
    to,
    granularity,
    includePreview: state.includePreview,
  };
  if (state.startedFrom) params.startedFrom = state.startedFrom;
  if (state.sentiment) params.sentiment = state.sentiment;
  return params;
}

export function sentimentAnalyticsQueryIncludesPreviewFlag(
  params: CustomerSentimentAnalyticsParams,
): boolean {
  return params.includePreview === false;
}

export { localYmd };
