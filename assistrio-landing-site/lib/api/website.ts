import type { RegisterShowcaseWebsiteRequest, RegisterShowcaseWebsiteResponse } from "@/types/api";
import { readJsonOrThrow } from "@/lib/api/http";

/**
 * Same-origin `POST /api/widget/register-website` (Next adds `X-API-Key` upstream).
 */
export async function registerShowcaseWebsite(
  body: RegisterShowcaseWebsiteRequest,
): Promise<RegisterShowcaseWebsiteResponse> {
  const res = await fetch("/api/widget/register-website", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  return readJsonOrThrow<RegisterShowcaseWebsiteResponse>(res);
}
