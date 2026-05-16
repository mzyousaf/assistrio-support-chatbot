import { describe, expect, it } from 'vitest';
import { isPublicHttpUrl } from './publicHttpUrl';

describe('isPublicHttpUrl', () => {
  it('accepts http and https', () => {
    expect(isPublicHttpUrl('https://example.com/path')).toBe(true);
    expect(isPublicHttpUrl('http://a.co')).toBe(true);
  });

  it('rejects other schemes and junk', () => {
    expect(isPublicHttpUrl('javascript:alert(1)')).toBe(false);
    expect(isPublicHttpUrl('data:text/plain,hi')).toBe(false);
    expect(isPublicHttpUrl('not a url')).toBe(false);
    expect(isPublicHttpUrl('')).toBe(false);
  });
});
