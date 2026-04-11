import type { PublicBotListItem } from "@/types/bot";

/**
 * Browser-safe list — calls same-origin `GET /api/public/bots` (Next proxy adds `X-API-Key` upstream).
 */
export async function fetchPublicShowcaseBotsClient(): Promise<PublicBotListItem[]> {
  const res = await fetch("/api/public/bots", {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Public showcase AI Agent list failed: ${res.status}`);
  }
  return res.json() as Promise<PublicBotListItem[]>;
}
