import type { Metadata } from "next";

/** Site-wide default — knowledge base, lead capture, branding, analytics (product positioning). */
export const SITE_DEFAULT_DESCRIPTION =
  "Launch AI Support Agents on your website with knowledge base, lead capture, branding, and analytics.";

/** Relative path to the default OG image route (see `app/opengraph-image.tsx`). */
export const DEFAULT_OG_IMAGE_PATH = "/opengraph-image" as const;

export const DEFAULT_OG_IMAGE_SIZE = { width: 1200, height: 630 } as const;

/**
 * Production-ready metadata for static marketing routes: title, description, Open Graph, Twitter.
 * Relies on root `metadataBase` for resolving relative image URLs.
 */
export function marketingPageMetadata(opts: {
  /** Segment title before ` · Assistrio` (root `title.template`) */
  title: string;
  description: string;
  /** Optional canonical path, e.g. `/gallery` */
  path?: `/${string}`;
}): Metadata {
  const { title, description, path } = opts;

  return {
    title,
    description,
    alternates: path ? { canonical: path } : undefined,
    openGraph: {
      type: "website",
      siteName: "Assistrio",
      title: `${title} · Assistrio`,
      description,
      ...(path ? { url: path } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} · Assistrio`,
      description,
    },
  };
}

/**
 * Build absolute URL for an image when the API returns an http(s) URL; otherwise return undefined (use default OG).
 */
export function absoluteOgImageUrl(imageUrl: string | undefined | null): string | undefined {
  if (!imageUrl?.trim()) return undefined;
  const t = imageUrl.trim();
  try {
    const u = new URL(t);
    if (u.protocol === "http:" || u.protocol === "https:") return u.href;
  } catch {
    /* ignore */
  }
  return undefined;
}
