/** Optional public support URL (e.g. https://assistrio.com/contact). */
export function getSupportUrl(): string | null {
  const url = (import.meta.env.VITE_SUPPORT_URL ?? '').trim();
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return url;
  } catch {
    return null;
  }
}
