import { describe, expect, it } from 'vitest';
import {
  buildUsageAnalyticsQueryParams,
  computeUsageAnalyticsDateRange,
  lastUtcDaysRange,
} from '@/lib/usageAnalyticsQuery';

describe('usageAnalyticsQuery', () => {
  it('builds last 7 days range by default', () => {
    const now = new Date('2026-05-31T12:00:00.000Z');
    expect(lastUtcDaysRange(7, now)).toEqual({
      startDate: '2026-05-25',
      endDate: '2026-05-31',
    });
  });

  it('uses current billing period preset', () => {
    const range = computeUsageAnalyticsDateRange(
      { preset: 'billing_period', customFrom: '', customTo: '' },
      {
        start: '2026-05-01T00:00:00.000Z',
        end: '2026-06-01T00:00:00.000Z',
      },
    );
    expect(range).toEqual({ startDate: '2026-05-01', endDate: '2026-06-01' });
  });

  it('includes botIds only when agents are selected', () => {
    expect(
      buildUsageAnalyticsQueryParams({
        date: { preset: '7d', customFrom: '', customTo: '' },
        agentIds: [],
      }),
    ).toEqual({
      startDate: expect.any(String),
      endDate: expect.any(String),
    });

    expect(
      buildUsageAnalyticsQueryParams({
        date: { preset: '7d', customFrom: '', customTo: '' },
        agentIds: ['bot-1', 'bot-2'],
      }).botIds,
    ).toBe('bot-1,bot-2');
  });
});
