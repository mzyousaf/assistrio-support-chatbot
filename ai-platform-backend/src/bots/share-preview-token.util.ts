import { createHash, randomBytes, timingSafeEqual } from 'crypto';

/** URL-safe token returned once to the customer; only SHA-256 hex is stored on the bot. */
export function generateSharePreviewPlainToken(): string {
  return randomBytes(24).toString('base64url');
}

export function hashSharePreviewToken(plain: string): string {
  return createHash('sha256').update(String(plain).trim(), 'utf8').digest('hex');
}

/** Constant-time compare of stored hex hash vs hash of presented token. */
export function verifySharePreviewToken(storedHashHex: string | undefined, plainToken: string | undefined): boolean {
  const h = String(storedHashHex ?? '').trim().toLowerCase();
  const t = String(plainToken ?? '').trim();
  if (!h || !/^[0-9a-f]{64}$/.test(h)) return false;
  if (!t) return false;
  const computed = hashSharePreviewToken(t);
  try {
    const a = Buffer.from(h, 'hex');
    const b = Buffer.from(computed, 'hex');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
