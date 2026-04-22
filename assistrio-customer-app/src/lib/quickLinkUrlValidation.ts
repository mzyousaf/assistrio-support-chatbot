/**
 * Validates quick-link destinations for the customer editor.
 * Allows `http:` / `https:` / `mailto:` / `tel:` URLs, or site-relative paths starting with `/`.
 */
export function isValidQuickLinkUrl(raw: string): boolean {
  const s = raw.trim();
  if (!s) return false;

  if (s.startsWith('/')) {
    if (/\s/.test(s)) return false;
    return s.length >= 1;
  }

  try {
    const u = new URL(s);
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(u.protocol);
  } catch {
    return false;
  }
}
