import { computeOwnerShareLinkStatus } from './share-preview-owner-status.util';
import { generateSharePreviewPlainToken, hashSharePreviewToken } from './share-preview-token.util';

describe('computeOwnerShareLinkStatus', () => {
  const slug = 'my-agent';
  const token = generateSharePreviewPlainToken();
  const hash = hashSharePreviewToken(token);
  const future = new Date(Date.now() + 86_400_000);

  it('not_created when no slug', () => {
    expect(computeOwnerShareLinkStatus({ enabled: true, slug: '', tokenHash: hash, expiresAt: future })).toBe(
      'not_created',
    );
    expect(computeOwnerShareLinkStatus(undefined)).toBe('not_created');
  });

  it('revoked when tokenRevokedAt set', () => {
    expect(
      computeOwnerShareLinkStatus({
        enabled: false,
        slug,
        tokenRevokedAt: new Date(),
      }),
    ).toBe('revoked');
  });

  it('missing when hash not set', () => {
    expect(
      computeOwnerShareLinkStatus({
        enabled: true,
        slug,
        tokenHash: '',
        expiresAt: future,
      }),
    ).toBe('missing');
  });

  it('expired when past expiresAt', () => {
    expect(
      computeOwnerShareLinkStatus({
        enabled: true,
        slug,
        tokenHash: hash,
        expiresAt: new Date(Date.now() - 1000),
      }),
    ).toBe('expired');
  });

  it('disabled when enabled false and valid token', () => {
    expect(
      computeOwnerShareLinkStatus({
        enabled: false,
        slug,
        tokenHash: hash,
        expiresAt: future,
      }),
    ).toBe('disabled');
  });

  it('active when enabled and valid', () => {
    expect(
      computeOwnerShareLinkStatus({
        enabled: true,
        slug,
        tokenHash: hash,
        expiresAt: future,
      }),
    ).toBe('active');
  });
});
