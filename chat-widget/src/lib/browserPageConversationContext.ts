/** Max length aligned with backend conversation origin URL caps. */
const MAX_URL_LEN = 2048;

function capUrl(value: string): string {
  return value.slice(0, MAX_URL_LEN);
}

/** Safe browser page fields for conversationOrigin (no query tokens in persisted URLs when server sanitizes). */
export function readBrowserPageContext(): {
  pageUrl: string;
  websiteOrigin: string;
  referrer: string;
} | undefined {
  if (typeof window === 'undefined' || typeof document === 'undefined') return undefined;
  try {
    const pageUrl = capUrl(String(window.location.href ?? ''));
    const websiteOrigin = String(window.location.origin ?? '').slice(0, 300);
    const referrer = capUrl(String(document.referrer ?? ''));
    if (!websiteOrigin && !pageUrl) return undefined;
    return { pageUrl, websiteOrigin, referrer };
  } catch {
    return undefined;
  }
}
