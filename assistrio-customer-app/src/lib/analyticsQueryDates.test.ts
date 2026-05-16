import { describe, expect, it } from 'vitest';
import { customYmdRangeIsValid } from './analyticsQueryDates';

describe('customYmdRangeIsValid', () => {
  it('accepts same-day range', () => {
    expect(customYmdRangeIsValid('2026-01-10', '2026-01-10')).toBe(true);
  });

  it('rejects inverted range', () => {
    expect(customYmdRangeIsValid('2026-01-12', '2026-01-10')).toBe(false);
  });

  it('rejects malformed input', () => {
    expect(customYmdRangeIsValid('nope', '2026-01-10')).toBe(false);
  });
});
