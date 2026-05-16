import { HttpException, HttpStatus } from '@nestjs/common';
import { verifySharePreviewToken } from './share-preview-token.util';

export function sharePreviewTokenHashLooksSet(raw: unknown): boolean {
  return typeof raw === 'string' && /^[0-9a-f]{64}$/i.test(raw.trim());
}

export function sharePreviewExpiresAtMs(sc: { expiresAt?: unknown }): number | null {
  const exp = sc.expiresAt;
  if (exp == null) return null;
  if (exp instanceof Date) {
    const t = exp.getTime();
    return Number.isFinite(t) ? t : null;
  }
  if (typeof exp === 'string' && exp.trim()) {
    const t = new Date(exp.trim()).getTime();
    return Number.isFinite(t) ? t : null;
  }
  return null;
}

/**
 * Validates Assistrio-hosted share preview access (init/chat/list/messages).
 * Draft, published, public, and private bots share the same rules.
 */
export function assertSharePreviewPolicy(
  row: Record<string, unknown> | null,
  slugParam: string,
  shareToken: string | undefined,
): asserts row is Record<string, unknown> {
  if (!row) {
    throw new HttpException(
      { error: 'Share preview is not available', status: 'error', errorCode: 'SHARE_NOT_FOUND' },
      HttpStatus.NOT_FOUND,
    );
  }

  const sc = (row.shareChat ?? {}) as {
    enabled?: boolean;
    slug?: string;
    tokenHash?: string;
    expiresAt?: unknown;
    tokenRevokedAt?: unknown;
  };

  const slug = String(sc.slug ?? '').trim().toLowerCase();
  const want = String(slugParam ?? '').trim().toLowerCase();
  if (!slug || slug !== want) {
    throw new HttpException(
      { error: 'Share preview is not available', status: 'error', errorCode: 'SHARE_NOT_FOUND' },
      HttpStatus.NOT_FOUND,
    );
  }

  if (sc.enabled !== true) {
    throw new HttpException(
      { error: 'Share preview is disabled', status: 'error', errorCode: 'SHARE_PREVIEW_DISABLED' },
      HttpStatus.FORBIDDEN,
    );
  }

  const revokedAt = sc.tokenRevokedAt;
  if (revokedAt instanceof Date || (typeof revokedAt === 'string' && revokedAt.trim() !== '')) {
    throw new HttpException(
      { error: 'Share preview link was revoked', status: 'error', errorCode: 'SHARE_PREVIEW_REVOKED' },
      HttpStatus.FORBIDDEN,
    );
  }

  const hash = typeof sc.tokenHash === 'string' ? sc.tokenHash.trim() : '';
  if (!sharePreviewTokenHashLooksSet(hash)) {
    throw new HttpException(
      {
        error: 'Share preview must be regenerated in the workspace',
        status: 'error',
        errorCode: 'SHARE_PREVIEW_REGENERATE_REQUIRED',
      },
      HttpStatus.FORBIDDEN,
    );
  }

  const expMs = sharePreviewExpiresAtMs({ expiresAt: sc.expiresAt });
  if (expMs == null) {
    throw new HttpException(
      { error: 'Share preview has expired', status: 'error', errorCode: 'SHARE_PREVIEW_EXPIRED' },
      HttpStatus.FORBIDDEN,
    );
  }
  if (expMs <= Date.now()) {
    throw new HttpException(
      { error: 'Share preview has expired', status: 'error', errorCode: 'SHARE_PREVIEW_EXPIRED' },
      HttpStatus.FORBIDDEN,
    );
  }

  const token = typeof shareToken === 'string' ? shareToken.trim() : '';
  if (!token) {
    throw new HttpException(
      { error: 'Share token is required', status: 'error', errorCode: 'SHARE_TOKEN_REQUIRED' },
      HttpStatus.FORBIDDEN,
    );
  }

  if (!verifySharePreviewToken(hash, token)) {
    throw new HttpException(
      { error: 'Invalid share token', status: 'error', errorCode: 'SHARE_TOKEN_INVALID' },
      HttpStatus.FORBIDDEN,
    );
  }
}
