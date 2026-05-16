import { describe, expect, it } from 'vitest';
import {
  formatAnalyticsGranularityViewCaption,
  resolveAnalyticsGranularity,
} from './analyticsGranularity';

describe('resolveAnalyticsGranularity', () => {
  it('uses hour for same-day and ≤24h spans', () => {
    expect(resolveAnalyticsGranularity('2026-05-14T00:00:00.000Z', '2026-05-14T23:59:59.999Z')).toBe('hour');
    expect(resolveAnalyticsGranularity('2026-05-14T10:00:00.000Z', '2026-05-15T09:59:59.999Z')).toBe('hour');
  });

  it('uses day for spans above 24h through 31 days', () => {
    expect(resolveAnalyticsGranularity('2026-05-14T00:00:00.000Z', '2026-05-15T10:00:00.000Z')).toBe('day');
    expect(resolveAnalyticsGranularity('2026-01-01T00:00:00.000Z', '2026-01-10T00:00:00.000Z')).toBe('day');
    expect(resolveAnalyticsGranularity('2026-01-01T00:00:00.000Z', '2026-02-01T00:00:00.000Z')).toBe('day');
  });

  it('uses week for spans in (31d, 120d]', () => {
    expect(resolveAnalyticsGranularity('2026-01-01T00:00:00.000Z', '2026-03-01T00:00:00.000Z')).toBe('week');
    expect(resolveAnalyticsGranularity('2026-01-01T00:00:00.000Z', '2026-04-01T00:00:00.000Z')).toBe('week');
  });

  it('uses month for spans beyond 120 days', () => {
    expect(resolveAnalyticsGranularity('2026-01-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z')).toBe('month');
  });

  it('returns day for invalid ISO', () => {
    expect(resolveAnalyticsGranularity('bad', '2026-01-02T00:00:00.000Z')).toBe('day');
  });
});

describe('formatAnalyticsGranularityViewCaption', () => {
  it('prefixes View:', () => {
    expect(formatAnalyticsGranularityViewCaption('hour')).toBe('View: Hourly');
    expect(formatAnalyticsGranularityViewCaption('day')).toBe('View: Daily');
  });
});
