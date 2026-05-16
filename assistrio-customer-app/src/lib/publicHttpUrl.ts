/** True when `raw` is an absolute http(s) URL (excludes javascript:, data:, etc.). */
export function isPublicHttpUrl(raw: string | null | undefined): boolean {
  const s = typeof raw === 'string' ? raw.trim() : '';
  if (!s) return false;
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}
