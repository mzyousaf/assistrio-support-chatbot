import { getPublicApiBaseUrl } from "@/lib/utils/env";
import type { RegisterShowcaseWebsiteRequest, RegisterShowcaseWebsiteResponse } from "@/types/api";
import { readJsonOrThrow } from "@/lib/api/http";

/**
 * Showcase-only: `POST /api/widget/register-website` — requires embed keys + `platformVisitorId` + site URL or hostname.
 * The backend persists **hostname only** on the allowlist row. Not used for trial bots (`WEBSITE_REGISTER_TRIAL_NOT_SUPPORTED`).
 */
export async function registerShowcaseWebsite(
  body: RegisterShowcaseWebsiteRequest,
): Promise<RegisterShowcaseWebsiteResponse> {
  const base = getPublicApiBaseUrl();
  const res = await fetch(`${base}/api/widget/register-website`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  return readJsonOrThrow<RegisterShowcaseWebsiteResponse>(res);
}
