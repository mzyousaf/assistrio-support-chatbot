import "server-only";

import { getPublicApiBaseUrl } from "@/lib/utils/env";
import type { PublicBotDetail, PublicBotListItem } from "@/types/bot";

/**
 * Server-only: `GET /api/public/bots` — public showcase AI Agents for marketing gallery (no API key).
 */
export async function fetchPublicShowcaseBots(): Promise<PublicBotListItem[]> {
  const base = getPublicApiBaseUrl();
  const res = await fetch(`${base}/api/public/bots`, {
    next: { revalidate: 60 },
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Public showcase AI Agent list failed: ${res.status}`);
  }
  return res.json() as Promise<PublicBotListItem[]>;
}

/**
 * Server-only: `GET /api/public/bots/:slug` — public detail for a showcase slug.
 */
export async function fetchPublicBotBySlug(slug: string): Promise<PublicBotDetail | null> {
  const base = getPublicApiBaseUrl();
  const encoded = encodeURIComponent(slug);
  const res = await fetch(`${base}/api/public/bots/${encoded}`, {
    next: { revalidate: 60 },
    headers: { Accept: "application/json" },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Public AI Agent detail failed: ${res.status}`);
  }
  return res.json() as Promise<PublicBotDetail>;
}
