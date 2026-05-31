import { describe, expect, it } from 'vitest';
import { chartTitleForViewMode, mapUsageTrendToChartPoints } from '@/pages/usage/UsageCreditsTrendChart';

describe('UsageCreditsTrendChart helpers', () => {
  it('uses view-specific chart titles', () => {
    expect(chartTitleForViewMode('trend')).toBe('AI Credits Usage Trends');
    expect(chartTitleForViewMode('heights')).toBe('AI Credits Usage Heights');
  });

  it('maps analytics trend rows for chart display', () => {
    expect(
      mapUsageTrendToChartPoints([
        {
          date: '2026-05-01',
          totalCreditsUsed: 12,
          monthlyCreditsUsed: 10,
          topUpCreditsUsed: 2,
        },
      ]),
    ).toEqual([
      expect.objectContaining({
        date: '2026-05-01',
        totalCreditsUsed: 12,
        monthlyCreditsUsed: 10,
        topUpCreditsUsed: 2,
      }),
    ]);
  });
});
