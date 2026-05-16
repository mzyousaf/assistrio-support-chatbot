/**
 * Normalize `parentOrigin` sent from the Assistrio iframe page (full URL or origin string).
 */
export function normalizeIframeParentOriginInput(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  if (!t) return null;
  try {
    const u = new URL(t.includes('://') ? t : `https://${t}`);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.origin;
  } catch {
    return null;
  }
}

/**
 * When `Referer` is present, its origin must match `parentOrigin` (defense in depth).
 */
export function refererMatchesParentOrigin(referer: string | undefined, parentOrigin: string): boolean {
  if (!referer?.trim()) return true;
  try {
    return new URL(referer.trim()).origin === parentOrigin;
  } catch {
    return false;
  }
}
