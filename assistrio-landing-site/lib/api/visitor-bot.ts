import { tryGetPublicApiBaseUrl } from "@/lib/utils/env";
import type {
  PvVisitorBotBasicInsightsResponse,
  PvVisitorBotLeadsSummaryResponse,
  PvVisitorBotSummaryResponse,
} from "@/types/api";
import { readJsonOrThrow } from "@/lib/api/http";

/**
 * **PV-safe bot summary reads** — `POST /api/public/visitor-bot/*` only.
 * Do not use for internal dashboards; do not call `/api/track` or `/api/user/analytics` from landing PV flows.
 *
 * @see ai-platform-backend/docs/ANALYTICS_BOUNDARIES.md
 * @see ai-platform-backend/docs/PV_SAFE_PUBLIC_APIS.md
 */

function postJson(path: string, body: Record<string, string>) {
  const base = tryGetPublicApiBaseUrl();
  if (!base) {
    throw new Error("Missing NEXT_PUBLIC_ASSISTRIO_API_BASE_URL");
  }
  return fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
}

export async function fetchPvVisitorBotSummary(
  platformVisitorId: string,
  botId: string,
): Promise<PvVisitorBotSummaryResponse> {
  const res = await postJson("/api/public/visitor-bot/summary", { platformVisitorId, botId });
  return readJsonOrThrow<PvVisitorBotSummaryResponse>(res);
}

export async function fetchPvVisitorBotBasicInsights(
  platformVisitorId: string,
  botId: string,
): Promise<PvVisitorBotBasicInsightsResponse> {
  const res = await postJson("/api/public/visitor-bot/basic-insights", { platformVisitorId, botId });
  return readJsonOrThrow<PvVisitorBotBasicInsightsResponse>(res);
}

export async function fetchPvVisitorBotLeadsSummary(
  platformVisitorId: string,
  botId: string,
): Promise<PvVisitorBotLeadsSummaryResponse> {
  const res = await postJson("/api/public/visitor-bot/leads-summary", { platformVisitorId, botId });
  return readJsonOrThrow<PvVisitorBotLeadsSummaryResponse>(res);
}
