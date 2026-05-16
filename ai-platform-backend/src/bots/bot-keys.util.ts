import { randomBytes } from 'crypto';

function toUrlSafeBase64(bytes: Buffer): string {
  return bytes
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function generatePrefixedKey(prefix: string, size = 24): string {
  return `${prefix}${toUrlSafeBase64(randomBytes(size))}`;
}

/** Public bot access identifier (safe to share with widget/admin clients). */
export function generateBotAccessKey(): string {
  return generatePrefixedKey('pk_');
}

/** Private bot secret credential (must never be exposed in public APIs). */
export function generateBotSecretKey(): string {
  return generatePrefixedKey('sk_');
}
