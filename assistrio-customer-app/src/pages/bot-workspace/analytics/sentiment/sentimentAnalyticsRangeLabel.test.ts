import { describe, expect, it } from 'vitest';
import { formatSentimentAnalyticsRangeCaption } from './sentimentAnalyticsRangeLabel';

describe('formatSentimentAnalyticsRangeCaption', () => {
  it('returns a compact from–to span for valid ISO bounds', () => {
    const s = formatSentimentAnalyticsRangeCaption({
      from: '2024-06-01T00:00:00.000Z',
      to: '2024-06-07T00:00:00.000Z',
      granularity: 'day',
    });
    expect(s).toMatch(/Jun/);
    expect(s).toContain('–');
    expect(s.length).toBeGreaterThan(8);
  });

  it('returns empty string for invalid dates', () => {
    expect(
      formatSentimentAnalyticsRangeCaption({
        from: 'not-a-date',
        to: '2024-06-07T00:00:00.000Z',
        granularity: 'day',
      }),
    ).toBe('');
  });
});
