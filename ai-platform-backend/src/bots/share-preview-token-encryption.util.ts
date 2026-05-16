import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const ALGO = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KDF_SALT = 'assistrio-share-preview-token-v1';

let cachedKey: Buffer | null = null;

/** @internal */
export function resetSharePreviewEncryptionKeyCacheForTests(): void {
  cachedKey = null;
}

function deriveKey(secret: string): Buffer {
  return scryptSync(secret, KDF_SALT, 32);
}

/**
 * Loads AES-256-GCM key from `SHARE_PREVIEW_TOKEN_ENCRYPTION_SECRET`.
 * In `development` / `test`, falls back to a dev-only constant if unset.
 * In production, requires a secret of at least 32 characters.
 */
export function getSharePreviewTokenEncryptionKey(): Buffer {
  if (cachedKey) return cachedKey;
  const raw = process.env.SHARE_PREVIEW_TOKEN_ENCRYPTION_SECRET?.trim() ?? '';
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const relaxed = nodeEnv === 'development' || nodeEnv === 'test';

  if (!raw) {
    if (!relaxed) {
      throw new Error(
        'SHARE_PREVIEW_TOKEN_ENCRYPTION_SECRET is required in production/staging to encrypt share preview tokens.',
      );
    }
    cachedKey = deriveKey('__dev_only_share_preview_encryption_secret_min_32_chars__');
    return cachedKey;
  }

  if (!relaxed && raw.length < 32) {
    throw new Error('SHARE_PREVIEW_TOKEN_ENCRYPTION_SECRET must be at least 32 characters outside development/test.');
  }

  cachedKey = deriveKey(raw);
  return cachedKey;
}

/** Encrypt plain preview token for persistence (never store plaintext). */
export function encryptSharePreviewTokenForStorage(plainToken: string, key: Buffer = getSharePreviewTokenEncryptionKey()): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(String(plainToken).trim(), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64url');
}

/** Decrypt stored blob; returns null if invalid or tampered. */
export function decryptSharePreviewTokenFromStorage(
  stored: string,
  key: Buffer = getSharePreviewTokenEncryptionKey(),
): string | null {
  try {
    const buf = Buffer.from(String(stored).trim(), 'base64url');
    if (buf.length < IV_LENGTH + AUTH_TAG_LENGTH + 1) return null;
    const iv = buf.subarray(0, IV_LENGTH);
    const tag = buf.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const enc = buf.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
    const decipher = createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8').trim();
    return plain || null;
  } catch {
    return null;
  }
}
