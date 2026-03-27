import { timingSafeEqual } from 'crypto';

export type RuntimeVisibility = 'public' | 'private';

export interface RuntimeAccessBotShape {
  status?: string;
  visibility?: RuntimeVisibility;
  accessKey?: string;
  secretKey?: string;
}

export interface RuntimeAccessCredentials {
  accessKey?: string;
  secretKey?: string;
}

export type RuntimeAccessValidationResult =
  | { ok: true }
  | { ok: false; reason: 'unpublished' | 'missing_access_key' | 'invalid_access_key' | 'missing_secret_key' | 'invalid_secret_key' };

function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

/** Shared external runtime validation for widget init/chat endpoints. */
export function validateRuntimeBotAccess(
  bot: RuntimeAccessBotShape,
  creds: RuntimeAccessCredentials,
): RuntimeAccessValidationResult {
  // External runtime is only for published bots.
  if (bot.status !== 'published') {
    return { ok: false, reason: 'unpublished' };
  }

  const accessKey = String(creds.accessKey ?? '').trim();
  const storedAccessKey = String(bot.accessKey ?? '').trim();
  if (!accessKey) return { ok: false, reason: 'missing_access_key' };
  if (!storedAccessKey || !safeEqual(accessKey, storedAccessKey)) {
    return { ok: false, reason: 'invalid_access_key' };
  }

  const visibility: RuntimeVisibility = bot.visibility === 'private' ? 'private' : 'public';
  if (visibility === 'private') {
    const secretKey = String(creds.secretKey ?? '').trim();
    const storedSecretKey = String(bot.secretKey ?? '').trim();
    if (!secretKey) return { ok: false, reason: 'missing_secret_key' };
    if (!storedSecretKey || !safeEqual(secretKey, storedSecretKey)) {
      return { ok: false, reason: 'invalid_secret_key' };
    }
  }

  return { ok: true };
}
