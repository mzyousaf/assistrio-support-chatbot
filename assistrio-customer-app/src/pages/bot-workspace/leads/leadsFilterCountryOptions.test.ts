import { describe, expect, it } from 'vitest';
import { formatCountryCodeWithNameLabel, getLeadsFilterCountryOptions } from './leadsFilterCountryOptions';

describe('formatCountryCodeWithNameLabel', () => {
  it('returns empty for invalid input', () => {
    expect(formatCountryCodeWithNameLabel('')).toBe('');
    expect(formatCountryCodeWithNameLabel('Z')).toBe('');
  });

  it('includes alpha-2 in the label', () => {
    const s = formatCountryCodeWithNameLabel('us');
    expect(s.toLowerCase()).toContain('us');
    expect(s).toMatch(/\([A-Z]{2}\)/);
  });
});

describe('getLeadsFilterCountryOptions', () => {
  it('includes extra alpha-2 codes not already in the base list', () => {
    const opts = getLeadsFilterCountryOptions(['ZZ']);
    expect(opts.some((o) => o.code === 'ZZ')).toBe(true);
  });

  it('deduplicates extras', () => {
    const opts = getLeadsFilterCountryOptions(['US', 'US']);
    expect(opts.filter((o) => o.code === 'US').length).toBe(1);
  });
});
