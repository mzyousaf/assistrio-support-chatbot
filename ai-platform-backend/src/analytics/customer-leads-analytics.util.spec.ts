import { BadRequestException } from '@nestjs/common';
import { DEFAULT_OVERVIEW_RANGE_DAYS, parseCustomerLeadsAnalyticsQuery } from './customer-leads-analytics.util';

describe('parseCustomerLeadsAnalyticsQuery', () => {
  it('defaults to last 30 days, day granularity, includePreview true', () => {
    const before = Date.now();
    const q = parseCustomerLeadsAnalyticsQuery({});
    const after = Date.now();
    expect(q.granularity).toBe('day');
    expect(q.includePreview).toBe(true);
    const span = q.to.getTime() - q.from.getTime();
    expect(span).toBeGreaterThanOrEqual(DEFAULT_OVERVIEW_RANGE_DAYS * 24 * 60 * 60 * 1000 - 2000);
    expect(span).toBeLessThanOrEqual(DEFAULT_OVERVIEW_RANGE_DAYS * 24 * 60 * 60 * 1000 + (after - before) + 2000);
  });

  it('parses includePreview=false and countryCode', () => {
    const q = parseCustomerLeadsAnalyticsQuery({
      from: '2026-01-01T00:00:00.000Z',
      to: '2026-01-02T00:00:00.000Z',
      includePreview: 'false',
      countryCode: 'de',
    });
    expect(q.includePreview).toBe(false);
    expect(q.countryCode).toBe('DE');
  });

  it('throws on invalid granularity', () => {
    expect(() =>
      parseCustomerLeadsAnalyticsQuery({
        from: '2026-01-01T00:00:00.000Z',
        to: '2026-01-02T00:00:00.000Z',
        granularity: 'nanoseconds',
      }),
    ).toThrow(BadRequestException);
  });
});
