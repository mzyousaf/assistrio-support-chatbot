import {
  clampIsoDateFromToAnalyticsHistory,
  clampParsedOverviewDateRangeToAnalyticsHistory,
  earliestAllowedAnalyticsFrom,
} from './analytics-entitlement-window.util';
import type { ParsedOverviewDateRange } from '../analytics/analytics-date-range.util';

describe('analytics-entitlement-window.util', () => {
  const now = new Date('2026-05-24T12:00:00.000Z');

  it('does not clamp when analyticsHistoryDays is null', () => {
    const parsed: ParsedOverviewDateRange = {
      from: new Date('2020-01-01T00:00:00.000Z'),
      to: now,
      label: 'Custom range',
    };
    const out = clampParsedOverviewDateRangeToAnalyticsHistory(parsed, null, now);
    expect(out.range.from).toEqual(parsed.from);
    expect(out.window).toBeNull();
  });

  it('clamps Free plan ranges older than 7 days', () => {
    const parsed: ParsedOverviewDateRange = {
      from: new Date('2026-01-01T00:00:00.000Z'),
      to: now,
      label: 'Custom range',
    };
    const out = clampParsedOverviewDateRangeToAnalyticsHistory(parsed, 7, now);
    expect(out.window).toMatchObject({
      analyticsWindowApplied: true,
      analyticsHistoryDays: 7,
      requestedFrom: parsed.from.toISOString(),
    });
    expect(out.range.from).toEqual(earliestAllowedAnalyticsFrom(now, 7));
  });

  it('leaves in-window ranges unchanged for Free', () => {
    const parsed: ParsedOverviewDateRange = {
      from: new Date('2026-05-20T00:00:00.000Z'),
      to: now,
      label: 'Last 7 days',
    };
    const out = clampParsedOverviewDateRangeToAnalyticsHistory(parsed, 7, now);
    expect(out.range.from).toEqual(parsed.from);
    expect(out.window).toBeNull();
  });

  it('clamps list dateFrom for Free', () => {
    const out = clampIsoDateFromToAnalyticsHistory('2026-01-01T00:00:00.000Z', 7, now);
    expect(out.window?.analyticsWindowApplied).toBe(true);
    expect(out.dateFrom).toBe(earliestAllowedAnalyticsFrom(now, 7).toISOString());
  });
});
