"use client";

/**
 * Internal (admin) analytics dashboard — authenticated GET /api/user/analytics/* (overview, bots/summary, leads/summary).
 * Do not reuse for public landing pages or PV-safe bot summaries; those use different APIs.
 */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import AdminShell from "@/components/admin/AdminShell";
import { Card } from "@/components/ui/Card";
import { AnalyticsPageSkeleton } from "@/components/ui/Skeleton";
import {
  fetchInternalAnalyticsOverview,
  fetchInternalBotsSummary,
  fetchInternalLeadsSummary,
  fetchLegacyAnalyticsFeed,
  getDateRangeForPreset,
  type LegacyAnalyticsEventRow,
} from "@/lib/internal-analytics-api";
import type {
  InternalAnalyticsDatePreset,
  InternalBotsSummaryResponse,
  InternalLeadsSummaryResponse,
  InternalAnalyticsOverviewResponse,
} from "@/types/internal-analytics";
import { AnalyticsDateRangeToolbar } from "@/components/analytics/AnalyticsDateRangeToolbar";
import { AnalyticsStatCard } from "@/components/analytics/AnalyticsStatCard";
import { AnalyticsBotsTable } from "@/components/analytics/AnalyticsBotsTable";
import { AnalyticsLeadsSummarySection } from "@/components/analytics/AnalyticsLeadsSummarySection";

function formatEventTime(value: unknown): string {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function formatOverviewRange(fromIso: string, toIso: string): string {
  const from = new Date(fromIso);
  const to = new Date(toIso);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return `${fromIso} — ${toIso}`;
  }
  const opts: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" };
  return `${from.toLocaleString(undefined, opts)} — ${to.toLocaleString(undefined, opts)}`;
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
        {description ? <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</p> : null}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{children}</div>
    </section>
  );
}

function SectionBlock({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
        {description ? <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function CaveatList({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="list-disc space-y-1 pl-5 text-xs text-amber-900/90 dark:text-amber-100/90">
      {items.map((c, i) => (
        <li key={i}>{c}</li>
      ))}
    </ul>
  );
}

export function InternalAnalyticsOverview({
  authLoading,
  isAuthenticated,
}: {
  authLoading: boolean;
  isAuthenticated: boolean;
}) {
  const [preset, setPreset] = useState<InternalAnalyticsDatePreset>("30d");
  const [overview, setOverview] = useState<InternalAnalyticsOverviewResponse | null>(null);
  const [botsSummary, setBotsSummary] = useState<InternalBotsSummaryResponse | null>(null);
  const [leadsSummary, setLeadsSummary] = useState<InternalLeadsSummaryResponse | null>(null);

  const [rangeLoading, setRangeLoading] = useState(false);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [botsError, setBotsError] = useState<string | null>(null);
  const [leadsError, setLeadsError] = useState<string | null>(null);

  const [recentEvents, setRecentEvents] = useState<LegacyAnalyticsEventRow[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedError, setFeedError] = useState<string | null>(null);

  const loadRangeMetrics = useCallback(async () => {
    const { from, to } = getDateRangeForPreset(preset);
    setRangeLoading(true);
    setOverviewError(null);
    setBotsError(null);
    setLeadsError(null);
    const [r1, r2, r3] = await Promise.allSettled([
      fetchInternalAnalyticsOverview(from, to),
      fetchInternalBotsSummary(from, to),
      fetchInternalLeadsSummary(from, to),
    ]);

    if (r1.status === "fulfilled") {
      setOverview(r1.value);
    } else {
      setOverview(null);
      setOverviewError(r1.reason instanceof Error ? r1.reason.message : "Failed to load overview.");
    }
    if (r2.status === "fulfilled") {
      setBotsSummary(r2.value);
    } else {
      setBotsSummary(null);
      setBotsError(r2.reason instanceof Error ? r2.reason.message : "Failed to load bot summary.");
    }
    if (r3.status === "fulfilled") {
      setLeadsSummary(r3.value);
    } else {
      setLeadsSummary(null);
      setLeadsError(r3.reason instanceof Error ? r3.reason.message : "Failed to load leads summary.");
    }
    setRangeLoading(false);
  }, [preset]);

  useEffect(() => {
    if (!isAuthenticated) return;
    void loadRangeMetrics();
  }, [isAuthenticated, loadRangeMetrics]);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    setFeedLoading(true);
    setFeedError(null);
    fetchLegacyAnalyticsFeed()
      .then((data) => {
        if (cancelled) return;
        setRecentEvents(data.recentEvents ?? []);
      })
      .catch((e) => {
        if (cancelled) return;
        setFeedError(e instanceof Error ? e.message : "Failed to load recent events.");
        setRecentEvents([]);
      })
      .finally(() => {
        if (!cancelled) setFeedLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  const rangeLabel = useMemo(() => {
    if (rangeLoading && !overview && !botsSummary && !leadsSummary) return "Loading range…";
    const r = overview?.range ?? botsSummary?.range ?? leadsSummary?.range;
    if (r) return formatOverviewRange(r.from, r.to);
    const { from, to } = getDateRangeForPreset(preset);
    return formatOverviewRange(from.toISOString(), to.toISOString());
  }, [rangeLoading, overview, botsSummary, leadsSummary, preset]);

  const hasAnyRangeData = Boolean(overview || botsSummary || leadsSummary);
  const showInitialSkeleton = rangeLoading && !hasAnyRangeData;

  if (authLoading || !isAuthenticated) {
    return (
      <AdminShell
        title="Overview"
        subtitle="Internal workspace traffic and engagement metrics (authenticated session)."
      >
        <AnalyticsPageSkeleton />
      </AdminShell>
    );
  }

  return (
    <AdminShell
      title="Overview"
      subtitle="Internal workspace traffic and engagement metrics (authenticated session)."
      toolbar={
        <AnalyticsDateRangeToolbar
          activePreset={preset}
          onPresetChange={setPreset}
          rangeLabel={rangeLabel}
          disabled={rangeLoading}
        />
      }
    >
      {rangeLoading && hasAnyRangeData ? (
        <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">Updating metrics for the selected range…</p>
      ) : null}

      {(overviewError || botsError || leadsError) && (
        <div className="mb-6 space-y-3">
          {overviewError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
              <p className="font-medium">Overview</p>
              <p className="mt-1 opacity-90">{overviewError}</p>
            </div>
          ) : null}
          {botsError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
              <p className="font-medium">Bot summary</p>
              <p className="mt-1 opacity-90">{botsError}</p>
            </div>
          ) : null}
          {leadsError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
              <p className="font-medium">Leads summary</p>
              <p className="mt-1 opacity-90">{leadsError}</p>
            </div>
          ) : null}
          <button
            type="button"
            className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
            onClick={() => void loadRangeMetrics()}
          >
            Retry failed sections
          </button>
        </div>
      )}

      {showInitialSkeleton ? (
        <AnalyticsPageSkeleton />
      ) : (
        <div className="space-y-10">
          {overview ? (
            <>
              {overview.caveats.length > 0 ? (
                <Card className="border-amber-200/80 bg-amber-50/80 dark:border-amber-900/50 dark:bg-amber-950/30">
                  <h3 className="text-sm font-semibold text-amber-950 dark:text-amber-100">Caveats (overview)</h3>
                  <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-amber-950/90 dark:text-amber-100/90">
                    {overview.caveats.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </Card>
              ) : null}

              <Section
                title="Funnel & acquisition"
                description="Visitor events in the selected window (from tracked landing/trial funnel)."
              >
                <AnalyticsStatCard label="Total visitor events" value={overview.overview.totalVisitorEvents} />
                <AnalyticsStatCard label="Page views" value={overview.overview.pageViews} />
                <AnalyticsStatCard label="CTA clicks" value={overview.overview.ctaClicks} />
                <AnalyticsStatCard label="Demos opened" value={overview.overview.demoOpened} />
                <AnalyticsStatCard label="Trial create started" value={overview.overview.trialCreateStarted} />
                <AnalyticsStatCard label="Trial create succeeded" value={overview.overview.trialCreateSucceeded} />
                <AnalyticsStatCard label="Trial bots created" value={overview.overview.trialBotsCreated} />
              </Section>

              <Section title="Runtime usage" description="Messages and conversations in the selected window.">
                <AnalyticsStatCard
                  label="Showcase runtime user messages"
                  value={overview.messages.showcaseRuntimeUserMessages}
                />
                <AnalyticsStatCard label="Trial runtime user messages" value={overview.messages.trialRuntimeUserMessages} />
                <AnalyticsStatCard label="Total messages" value={overview.messages.totalMessages} />
                <AnalyticsStatCard label="Total conversations" value={overview.messages.totalConversations} />
              </Section>

              <Section title="Inventory & leads" description="Bots and lead capture (see caveats for scope).">
                <AnalyticsStatCard label="Visitor-owned bots created" value={overview.bots.visitorOwnedBotsCreated} />
                <AnalyticsStatCard
                  label="Showcase bots active"
                  value={overview.bots.showcaseBotsActive}
                  hint="Point-in-time published showcase bots (not range-scoped)."
                />
                <AnalyticsStatCard
                  label="Conversations with captured leads"
                  value={overview.leads.conversationsWithCapturedLeads}
                />
              </Section>
            </>
          ) : null}

          {botsSummary ? (
            <SectionBlock
              title="Bots (active in range)"
              description="Per-bot message and conversation volume for the selected window — sorted by messages, then conversations. Links go to agent conversations (internal workspace)."
            >
              <CaveatList items={botsSummary.caveats} />
              <AnalyticsBotsTable bots={botsSummary.bots} truncated={botsSummary.truncated} />
            </SectionBlock>
          ) : null}

          {leadsSummary ? (
            <SectionBlock
              title="Lead capture (range)"
              description="Aggregated lead metrics — counts only; raw field values stay in conversation records."
            >
              <CaveatList items={leadsSummary.caveats} />
              <AnalyticsLeadsSummarySection data={leadsSummary} />
            </SectionBlock>
          ) : null}
        </div>
      )}

      <section className="mt-12 space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Recent visitor events</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Latest rows from the legacy activity feed (lifetime snapshot endpoint — separate from the overview aggregates
              above).
            </p>
          </div>
          {feedLoading ? <span className="text-xs text-slate-500">Loading…</span> : null}
        </div>
        {feedError ? (
          <p className="text-sm text-amber-700 dark:text-amber-300">{feedError}</p>
        ) : null}
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                <tr>
                  <th className="px-4 py-3 font-medium uppercase tracking-wide text-xs">Time</th>
                  <th className="px-4 py-3 font-medium uppercase tracking-wide text-xs">Visitor ID</th>
                  <th className="px-4 py-3 font-medium uppercase tracking-wide text-xs">Type</th>
                  <th className="px-4 py-3 font-medium uppercase tracking-wide text-xs">Path</th>
                  <th className="px-4 py-3 font-medium uppercase tracking-wide text-xs">Bot slug</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-gray-800 dark:divide-gray-800 dark:text-gray-200">
                {recentEvents.map((event) => (
                  <tr
                    key={String(event._id)}
                    className="transition-colors hover:bg-gray-50/80 dark:hover:bg-gray-800/40"
                  >
                    <td className="px-4 py-3">{formatEventTime(event.createdAt)}</td>
                    <td className="px-4 py-3">{event.platformVisitorId ?? "-"}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200">
                        {event.type || "-"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{event.path || "-"}</td>
                    <td className="px-4 py-3">{event.botSlug || "-"}</td>
                  </tr>
                ))}
                {!feedLoading && recentEvents.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-gray-500 dark:text-gray-400" colSpan={5}>
                      No recent events found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Card>
      </section>
    </AdminShell>
  );
}
