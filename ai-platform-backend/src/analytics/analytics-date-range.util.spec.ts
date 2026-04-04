import { BadRequestException } from '@nestjs/common';
import {
  DEFAULT_OVERVIEW_RANGE_DAYS,
  MAX_OVERVIEW_RANGE_MS,
  parseOverviewDateRange,
} from './analytics-date-range.util';

describe('parseOverviewDateRange', () => {
  it('defaults to last N days when params omitted', () => {
    const before = Date.now();
    const r = parseOverviewDateRange({});
    expect(r.label).toContain(String(DEFAULT_OVERVIEW_RANGE_DAYS));
    expect(r.to.getTime() - r.from.getTime()).toBeGreaterThan(
      (DEFAULT_OVERVIEW_RANGE_DAYS - 1) * 24 * 60 * 60 * 1000,
    );
    expect(r.to.getTime()).toBeGreaterThanOrEqual(before - 2000);
  });

  it('parses custom from and to', () => {
    const r = parseOverviewDateRange({
      from: '2026-01-01T00:00:00.000Z',
      to: '2026-01-02T00:00:00.000Z',
    });
    expect(r.label).toBe('Custom range');
    expect(r.from.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(r.to.toISOString()).toBe('2026-01-02T00:00:00.000Z');
  });

  it('swaps inverted range', () => {
    const r = parseOverviewDateRange({
      from: '2026-01-10T00:00:00.000Z',
      to: '2026-01-01T00:00:00.000Z',
    });
    expect(r.from.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(r.to.toISOString()).toBe('2026-01-10T00:00:00.000Z');
  });

  it('rejects range wider than max', () => {
    const from = new Date('2020-01-01T00:00:00.000Z');
    const to = new Date(from.getTime() + MAX_OVERVIEW_RANGE_MS + 24 * 60 * 60 * 1000);
    expect(() =>
      parseOverviewDateRange({
        from: from.toISOString(),
        to: to.toISOString(),
      }),
    ).toThrow(BadRequestException);
  });
});
