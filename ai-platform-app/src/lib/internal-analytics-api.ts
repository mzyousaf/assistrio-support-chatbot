/**
 * Internal (authenticated) analytics API helpers for the admin app.
 * Uses session-backed `GET /api/user/analytics/*` — **never** import these from the landing site or PV flows.
 *
 * @see ai-platform-backend/docs/ANALYTICS_BOUNDARIES.md
 */

import { apiFetch } from "@/lib/api";
import type {
  InternalAnalyticsDatePreset,
  InternalBotsSummaryResponse,
  InternalLeadsSummaryResponse,
  InternalAnalyticsOverviewResponse,
} from "@/types/internal-analytics";

/** Query string for `from` / `to` (ISO) on internal analytics routes. */
export function buildInternalAnalyticsRangeQuery(from: Date, to: Date): string {
  return new URLSearchParams({
    from: from.toISOString(),
    to: to.toISOString(),
  }).toString();
}

export function getDateRangeForPreset(
  preset: InternalAnalyticsDatePreset,
  now: Date = new Date(),
): { from: Date; to: Date } {
  const to = new Date(now);
  const days = preset === "7d" ? 7 : preset === "30d" ? 30 : 90;
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
  return { from, to };
}

export async function fetchInternalAnalyticsOverview(
  from: Date,
  to: Date,
): Promise<InternalAnalyticsOverviewResponse> {
  const qs = buildInternalAnalyticsRangeQuery(from, to);
  const res = await apiFetch(`/api/user/analytics/overview?${qs}`);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Failed to load analytics overview (${res.status})`);
  }
  return res.json() as Promise<InternalAnalyticsOverviewResponse>;
}

export async function fetchInternalBotsSummary(
  from: Date,
  to: Date,
): Promise<InternalBotsSummaryResponse> {
  const qs = buildInternalAnalyticsRangeQuery(from, to);
  const res = await apiFetch(`/api/user/analytics/bots/summary?${qs}`);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Failed to load bot summary (${res.status})`);
  }
  return res.json() as Promise<InternalBotsSummaryResponse>;
}

export async function fetchInternalLeadsSummary(
  from: Date,
  to: Date,
): Promise<InternalLeadsSummaryResponse> {
  const qs = buildInternalAnalyticsRangeQuery(from, to);
  const res = await apiFetch(`/api/user/analytics/leads/summary?${qs}`);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Failed to load leads summary (${res.status})`);
  }
  return res.json() as Promise<InternalLeadsSummaryResponse>;
}

/** Lifetime snapshot + recent visitor events (supplementary feed; not the overview aggregates). */
export type LegacyAnalyticsFeedResponse = {
  metrics?: Array<{ label: string; value: number }>;
  recentEvents?: LegacyAnalyticsEventRow[];
};

export type LegacyAnalyticsEventRow = {
  _id: string;
  platformVisitorId?: string | null;
  type?: string;
  path?: string;
  botSlug?: string;
  createdAt?: string | null;
};

export async function fetchLegacyAnalyticsFeed(): Promise<LegacyAnalyticsFeedResponse> {
  const res = await apiFetch("/api/user/analytics");
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Failed to load activity feed (${res.status})`);
  }
  return res.json() as Promise<LegacyAnalyticsFeedResponse>;
}
