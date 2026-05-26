import { clampCustomerAnalyticsQueryDates } from './shared/customer-bot-analytics-request.util';

describe('customer-bot-analytics-request.util', () => {
  const now = new Date('2026-05-24T12:00:00.000Z');

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(now);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('clamps Free analytics query to 7-day window with metadata', () => {
    const out = clampCustomerAnalyticsQueryDates('2026-01-01T00:00:00.000Z', undefined, 7);
    expect(out.window).toMatchObject({
      analyticsWindowApplied: true,
      analyticsHistoryDays: 7,
      requestedFrom: '2026-01-01T00:00:00.000Z',
    });
    expect(new Date(out.from!).getTime()).toBeGreaterThan(new Date('2026-01-01T00:00:00.000Z').getTime());
  });

  it('does not clamp Starter/Pro unlimited history', () => {
    const out = clampCustomerAnalyticsQueryDates('2026-01-01T00:00:00.000Z', undefined, null);
    expect(out.window).toBeNull();
  });
});
