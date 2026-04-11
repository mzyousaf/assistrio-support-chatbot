import type { TrialCreateRequest, TrialCreateResponse } from "@/types/api";
import { readJsonOrThrow } from "@/lib/api/http";

/**
 * Browser-safe: same-origin `POST /api/trial/bots` (Next adds `X-API-Key` upstream).
 */
export async function createTrialBot(body: TrialCreateRequest): Promise<TrialCreateResponse> {
  const res = await fetch("/api/trial/bots", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  return readJsonOrThrow<TrialCreateResponse>(res);
}
