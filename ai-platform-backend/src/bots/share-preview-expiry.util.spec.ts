import {
  SHARE_PREVIEW_ALLOWED_EXPIRES_HOURS,
  assertAllowedSharePreviewExpiresInHours,
  sharePreviewExpiryDateFromHours,
} from './share-preview-expiry.util';

describe('share-preview-expiry.util', () => {
  it('accepts all allowed hour values', () => {
    for (const h of SHARE_PREVIEW_ALLOWED_EXPIRES_HOURS) {
      expect(assertAllowedSharePreviewExpiresInHours(h)).toBe(h);
    }
  });

  it('rejects invalid hours', () => {
    expect(() => assertAllowedSharePreviewExpiresInHours(7)).toThrow();
    expect(() => assertAllowedSharePreviewExpiresInHours('24')).toThrow();
  });

  it('sharePreviewExpiryDateFromHours adds wall-clock hours', () => {
    const from = new Date('2026-05-10T12:00:00.000Z');
    const d = sharePreviewExpiryDateFromHours(24, from);
    expect(d.toISOString()).toBe('2026-05-11T12:00:00.000Z');
  });
});
