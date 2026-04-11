import type { PublicVisitorQuotaSummaryResponse } from "@/types/api";
import { readJsonOrThrow } from "@/lib/api/http";

/**
 * **PV-safe quota read** — same-origin `POST /api/public/visitor-quota/summary` (Next adds `X-API-Key` upstream).
 */
export async function fetchPublicVisitorQuotaSummary(
  platformVisitorId: string,
): Promise<PublicVisitorQuotaSummaryResponse> {
  const res = await fetch("/api/public/visitor-quota/summary", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ platformVisitorId }),
  });
  return readJsonOrThrow<PublicVisitorQuotaSummaryResponse>(res);
}
