/** Square brand mark (logo icon) in `public/`. Placed before `logo-text.png` in headers. */
export const SITE_LOGO_MARK = "/logo-192x192.png";
export const SITE_LOGO_MARK_PX = { width: 192, height: 192 } as const;

/** Typographic wordmark PNG in `public/` (placed after the square mark). */
export const SITE_LOGO_TEXT = "/logo-text.png";
export const SITE_LOGO_TEXT_PX = { width: 3955, height: 731 } as const;

/** Square app icon for `metadata.apple` — not the wide wordmark. */
export const SITE_APPLE_TOUCH_ICON = "/apple-touch-icon.png";

/** Canonical site origin for absolute Open Graph / Twitter image URLs. Set `NEXT_PUBLIC_LANDING_SITE_URL` in production. */
export function getMetadataBaseUrl(): URL {
  const explicit = process.env.NEXT_PUBLIC_LANDING_SITE_URL?.trim();
  if (explicit) {
    const base = explicit.endsWith("/") ? explicit.slice(0, -1) : explicit;
    return new URL(base);
  }
  if (process.env.VERCEL_URL) {
    return new URL(`https://${process.env.VERCEL_URL}`);
  }
  return new URL("http://localhost:3000");
}
