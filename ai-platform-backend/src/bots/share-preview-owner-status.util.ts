import { sharePreviewExpiresAtMs, sharePreviewTokenHashLooksSet } from './share-preview-policy.util';

export type OwnerShareLinkStatus =
  | 'not_created'
  | 'active'
  | 'disabled'
  | 'expired'
  | 'revoked'
  | 'missing';

export function shareChatTokenRevokedAtSet(sc: Record<string, unknown>): boolean {
  const t = sc.tokenRevokedAt;
  return t instanceof Date || (typeof t === 'string' && t.trim() !== '');
}

/**
 * Owner-facing status for Share Agent Preview (customer app modal).
 */
export function computeOwnerShareLinkStatus(sc: Record<string, unknown> | undefined | null): OwnerShareLinkStatus {
  if (!sc || typeof sc !== 'object') return 'not_created';
  const slug = typeof sc.slug === 'string' ? sc.slug.trim().toLowerCase() : '';
  if (!slug) return 'not_created';

  if (shareChatTokenRevokedAtSet(sc)) {
    return 'revoked';
  }

  const hashOk = sharePreviewTokenHashLooksSet(typeof sc.tokenHash === 'string' ? sc.tokenHash : '');
  if (!hashOk) return 'missing';

  const expMs = sharePreviewExpiresAtMs({ expiresAt: sc.expiresAt });
  if (expMs == null) return 'missing';
  if (expMs <= Date.now()) return 'expired';
  if (sc.enabled !== true) return 'disabled';
  return 'active';
}
