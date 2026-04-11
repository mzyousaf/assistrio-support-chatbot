import { proxyJsonPostToNest } from "@/lib/server/proxy-json-to-nest";

export const runtime = "nodejs";

/** Proxies to Nest `POST /api/analytics/track` with `X-API-Key` (browser uses same-origin only). */
export async function POST(request: Request) {
  return proxyJsonPostToNest("/api/analytics/track", request);
}
