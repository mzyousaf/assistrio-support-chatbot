/**
 * Unit tests for retrieval helpers: lexicalScore, normalizeSourceExcerpt.
 */

import { lexicalScore, normalizeSourceExcerpt, SOURCE_EXCERPT_MAX_CHARS } from './retrieval-helpers';

describe('lexicalScore', () => {
  it('returns 0 for empty', () => {
    expect(lexicalScore('', 'hello')).toBe(0);
    expect(lexicalScore('hi', '')).toBe(0);
  });

  it('returns higher when query tokens appear in chunk', () => {
    expect(lexicalScore('pricing plan', 'our pricing plan is simple')).toBeGreaterThan(0);
    expect(lexicalScore('xyz', 'hello world')).toBe(0);
  });
});

describe('normalizeSourceExcerpt', () => {
  it('trims and collapses whitespace', () => {
    expect(normalizeSourceExcerpt('  hello   world  ')).toBe('hello world');
  });

  it('caps at maxChars with ellipsis', () => {
    const long = 'a'.repeat(500);
    const out = normalizeSourceExcerpt(long, 100);
    expect(out.length).toBeLessThanOrEqual(101);
    expect(out.endsWith('…')).toBe(true);
  });

  it('uses default SOURCE_EXCERPT_MAX_CHARS when not provided', () => {
    const long = 'a'.repeat(1000);
    const out = normalizeSourceExcerpt(long);
    expect(out.length).toBeLessThanOrEqual(SOURCE_EXCERPT_MAX_CHARS + 2);
  });
});
