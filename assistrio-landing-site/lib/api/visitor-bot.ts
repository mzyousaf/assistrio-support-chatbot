import type {
  PvVisitorBotBasicInsightsResponse,
  PvVisitorBotLeadsSummaryResponse,
  PvVisitorBotSummaryResponse,
} from "@/types/api";
import { readJsonOrThrow } from "@/lib/api/http";

/**
 * **PV-safe bot summary reads** — same-origin proxies add `X-API-Key` upstream.
 */

function postJson(path: string, body: Record<string, string>) {
  return fetch(path, {
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
