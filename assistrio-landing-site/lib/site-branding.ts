/**
 * Logo assets in `public/` — `logo-{width}x{height}.png`.
 * Use `sm` in nav/footer; `lg` for Open Graph / social until a dedicated 1200×630 art exists.
 */
export const SITE_LOGO = {
  sm: "/logo-180x180.png",
  md: "/logo-192x192.png",
  lg: "/logo-512x512.png",
  /** Horizontal wordmark — use instead of the “Assistrio” text next to the mark. */
  wordmark: "/logo-text.png",
} as const;

/** Pixel size of `wordmark` PNG (~5.4∶1) — pass to `next/image` width/height for correct layout. */
export const SITE_LOGO_WORDMARK_PX = { width: 3955, height: 731 } as const;

/** Canonical site origin for absolute Open Graph / Twitter image URLs. Set `NEXT_PUBLIC_SITE_URL` in production. */
export function getMetadataBaseUrl(): URL {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) {
    const base = explicit.endsWith("/") ? explicit.slice(0, -1) : explicit;
    return new URL(base);
  }
  if (process.env.VERCEL_URL) {
    return new URL(`https://${process.env.VERCEL_URL}`);
  }
  return new URL("http://localhost:3000");
}
