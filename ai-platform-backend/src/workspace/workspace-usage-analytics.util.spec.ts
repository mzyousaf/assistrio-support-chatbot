import {
  allocateCreditsToPools,
  enumerateUtcDaysInclusive,
  parseWorkspaceUsageAnalyticsQuery,
} from './workspace-usage-analytics.util';

describe('workspace-usage-analytics.util', () => {
  it('enumerates UTC days inclusively', () => {
    expect(enumerateUtcDaysInclusive('2026-05-01', '2026-05-03')).toEqual([
      '2026-05-01',
      '2026-05-02',
      '2026-05-03',
    ]);
  });

  it('allocates monthly credits before top-up credits', () => {
    expect(allocateCreditsToPools(30, 50)).toEqual({
      monthlyCreditsUsed: 30,
      topUpCreditsUsed: 0,
    });
    expect(allocateCreditsToPools(25, 20)).toEqual({
      monthlyCreditsUsed: 20,
      topUpCreditsUsed: 5,
    });
  });

  it('parses botIds from comma-separated query', () => {
    expect(
      parseWorkspaceUsageAnalyticsQuery({
        startDate: '2026-05-01',
        endDate: '2026-05-07',
        botIds: 'a,b, c',
      }),
    ).toEqual({
      startDate: '2026-05-01',
      endDate: '2026-05-07',
      botIds: ['a', 'b', 'c'],
    });
  });
});
