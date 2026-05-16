import { tryGetPublicApiBaseUrl } from "@/lib/utils/env";
import type { PublicBotListItem } from "@/types/bot";

/**
 * Browser-safe `GET /api/public/bots` — same data as server `fetchPublicShowcaseBots`, for flows that run client-side.
 */
export async function fetchPublicShowcaseBotsClient(): Promise<PublicBotListItem[]> {
  const base = tryGetPublicApiBaseUrl();
  if (!base) {
    throw new Error("Missing NEXT_PUBLIC_ASSISTRIO_API_BASE_URL");
  }
  const res = await fetch(`${base}/api/public/bots`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Public showcase AI Agent list failed: ${res.status}`);
  }
  return res.json() as Promise<PublicBotListItem[]>;
}
