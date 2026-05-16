/** Runtime embed session cookie: one per bot so multiple widgets on one API origin do not clobber each other. */
export const EMBED_SESSION_COOKIE_PREFIX = 'ar_embed_' as const;

export const EMBED_SESSION_MAX_AGE_SEC = 15 * 60;

export function embedSessionCookieName(botId: string): string {
  const id = String(botId ?? '').trim();
  if (!/^[a-f0-9]{24}$/i.test(id)) {
    return `${EMBED_SESSION_COOKIE_PREFIX}${encodeURIComponent(id).replace(/%/g, '_')}`;
  }
  return `${EMBED_SESSION_COOKIE_PREFIX}${id}`;
}

export function parseCookieHeader(cookieHeader: string | undefined, name: string): string | undefined {
  if (!cookieHeader?.trim()) return undefined;
  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const k = part.slice(0, idx).trim();
    if (k !== name) continue;
    const v = part.slice(idx + 1).trim();
    try {
      return decodeURIComponent(v);
    } catch {
      return v;
    }
  }
  return undefined;
}

/**
 * Cross-site embed needs `SameSite=None; Secure` in production. In development, `Lax` without `Secure`
 * works for same-origin API paths; cross-origin localhost API may not send cookies (keys fallback).
 */
export function buildEmbedSessionSetCookieHeader(
  name: string,
  token: string,
  opts: { secure: boolean; sameSiteNone: boolean },
): string {
  const segments = [
    `${name}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    `Max-Age=${EMBED_SESSION_MAX_AGE_SEC}`,
  ];
  if (opts.sameSiteNone && opts.secure) {
    segments.push('SameSite=None', 'Secure');
  } else {
    segments.push('SameSite=Lax');
  }
  return segments.join('; ');
}
