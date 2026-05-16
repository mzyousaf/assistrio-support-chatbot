import { HttpException } from '@nestjs/common';
import { assertSharePreviewPolicy } from './share-preview-policy.util';
import { generateSharePreviewPlainToken, hashSharePreviewToken } from './share-preview-token.util';

function expectCode(fn: () => void, code: string) {
  try {
    fn();
    throw new Error('expected HttpException');
  } catch (e) {
    expect(e).toBeInstanceOf(HttpException);
    const r = (e as HttpException).getResponse() as { errorCode?: string };
    expect(r.errorCode).toBe(code);
  }
}

describe('assertSharePreviewPolicy', () => {
  const slug = 'sc-abc';
  const token = generateSharePreviewPlainToken();
  const hash = hashSharePreviewToken(token);
  const future = new Date(Date.now() + 86_400_000);

  const baseRow = (): Record<string, unknown> => ({
    status: 'published',
    shareChat: {
      enabled: true,
      slug,
      tokenHash: hash,
      expiresAt: future,
    },
  });

  it('succeeds for draft with valid token and future expiry', () => {
    const row = { ...baseRow(), status: 'draft' };
    expect(() => assertSharePreviewPolicy(row, slug, token)).not.toThrow();
  });

  it('succeeds for published with valid token', () => {
    expect(() => assertSharePreviewPolicy(baseRow(), slug, token)).not.toThrow();
  });

  it('SHARE_NOT_FOUND when row null', () => {
    expectCode(() => assertSharePreviewPolicy(null, slug, token), 'SHARE_NOT_FOUND');
  });

  it('SHARE_PREVIEW_DISABLED when not enabled (old token must not work)', () => {
    const row = baseRow();
    (row.shareChat as { enabled: boolean }).enabled = false;
    expectCode(() => assertSharePreviewPolicy(row, slug, token), 'SHARE_PREVIEW_DISABLED');
  });

  it('SHARE_PREVIEW_REGENERATE_REQUIRED when no token hash', () => {
    const row = baseRow();
    (row.shareChat as { tokenHash: string | null }).tokenHash = '';
    expectCode(() => assertSharePreviewPolicy(row, slug, token), 'SHARE_PREVIEW_REGENERATE_REQUIRED');
  });

  it('SHARE_PREVIEW_EXPIRED when expiry missing', () => {
    const row = baseRow();
    delete (row.shareChat as { expiresAt?: Date }).expiresAt;
    expectCode(() => assertSharePreviewPolicy(row, slug, token), 'SHARE_PREVIEW_EXPIRED');
  });

  it('SHARE_PREVIEW_EXPIRED when expiry in past', () => {
    const row = baseRow();
    (row.shareChat as { expiresAt: Date }).expiresAt = new Date(Date.now() - 1000);
    expectCode(() => assertSharePreviewPolicy(row, slug, token), 'SHARE_PREVIEW_EXPIRED');
  });

  it('SHARE_TOKEN_REQUIRED when token missing', () => {
    expectCode(() => assertSharePreviewPolicy(baseRow(), slug, undefined), 'SHARE_TOKEN_REQUIRED');
  });

  it('SHARE_TOKEN_INVALID when token wrong', () => {
    expectCode(() => assertSharePreviewPolicy(baseRow(), slug, 'wrong'), 'SHARE_TOKEN_INVALID');
  });

  it('SHARE_NOT_FOUND when stored slug does not match URL slug', () => {
    const row = baseRow();
    (row.shareChat as { slug: string }).slug = 'other-slug';
    expectCode(() => assertSharePreviewPolicy(row, slug, token), 'SHARE_NOT_FOUND');
  });

  it('SHARE_PREVIEW_REGENERATE_REQUIRED when tokenHash is null', () => {
    const row = baseRow();
    (row.shareChat as { tokenHash: string | null }).tokenHash = null as unknown as string;
    expectCode(() => assertSharePreviewPolicy(row, slug, token), 'SHARE_PREVIEW_REGENERATE_REQUIRED');
  });

  it('SHARE_PREVIEW_REVOKED when tokenRevokedAt is set', () => {
    const row = baseRow();
    (row.shareChat as { tokenRevokedAt: Date }).tokenRevokedAt = new Date();
    expectCode(() => assertSharePreviewPolicy(row, slug, token), 'SHARE_PREVIEW_REVOKED');
  });
});
