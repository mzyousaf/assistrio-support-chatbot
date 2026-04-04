import { getPublicApiBaseUrl } from "@/lib/utils/env";
import type { TrialCreateRequest, TrialCreateResponse } from "@/types/api";
import { readJsonOrThrow } from "@/lib/api/http";

/**
 * Browser-safe: `POST /api/trial/bots` — creates a visitor-owned trial bot (rate-limited server-side).
 */
export async function createTrialBot(body: TrialCreateRequest): Promise<TrialCreateResponse> {
  const base = getPublicApiBaseUrl();
  const res = await fetch(`${base}/api/trial/bots`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  return readJsonOrThrow<TrialCreateResponse>(res);
}
