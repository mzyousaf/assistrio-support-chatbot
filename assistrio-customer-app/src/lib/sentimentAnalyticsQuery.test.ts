import { describe, expect, it } from 'vitest';
import {
  SENTIMENT_ANALYTICS_DEFAULTS,
  buildSentimentAnalyticsApiParams,
  sentimentAnalyticsQueryIncludesPreviewFlag,
} from './sentimentAnalyticsQuery';

describe('buildSentimentAnalyticsApiParams', () => {
  it('maps sentiment and startedFrom when set', () => {
    const p = buildSentimentAnalyticsApiParams({
      ...SENTIMENT_ANALYTICS_DEFAULTS,
      sentiment: 'negative',
      startedFromKeys: ['shared_preview'],
    });
    expect(p.sentiment).toBe('negative');
    expect(p.startedFrom).toBe('shared_preview');
  });

  it('omits sentiment when empty', () => {
    const p = buildSentimentAnalyticsApiParams({
      ...SENTIMENT_ANALYTICS_DEFAULTS,
      sentiment: '',
    });
    expect(p.sentiment).toBeUndefined();
  });

  it('tracks includePreview false', () => {
    const p = buildSentimentAnalyticsApiParams({
      ...SENTIMENT_ANALYTICS_DEFAULTS,
      includePreview: false,
    });
    expect(sentimentAnalyticsQueryIncludesPreviewFlag(p)).toBe(true);
  });

  it('defaults metric mode to messages', () => {
    expect(SENTIMENT_ANALYTICS_DEFAULTS.metricMode).toBe('messages');
  });
});
