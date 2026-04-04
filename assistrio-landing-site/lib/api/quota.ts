import { getPublicApiBaseUrl } from "@/lib/utils/env";
import type { PublicVisitorQuotaSummaryResponse } from "@/types/api";
import { readJsonOrThrow } from "@/lib/api/http";

/**
 * **PV-safe quota read** — `POST /api/public/visitor-quota/summary` only.
 * Do not add calls to `/api/user/analytics` or `/api/analytics/track` here (see `ai-platform-backend/docs/ANALYTICS_BOUNDARIES.md`).
 *
 * Rate-limited; knowing the id is sufficient to read — treat ids as private.
 */
export async function fetchPublicVisitorQuotaSummary(
  platformVisitorId: string,
): Promise<PublicVisitorQuotaSummaryResponse> {
  const base = getPublicApiBaseUrl();
  const res = await fetch(`${base}/api/public/visitor-quota/summary`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ platformVisitorId }),
  });
  return readJsonOrThrow<PublicVisitorQuotaSummaryResponse>(res);
}
