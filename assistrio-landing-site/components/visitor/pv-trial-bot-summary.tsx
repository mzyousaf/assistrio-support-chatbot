"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchPvVisitorBotBasicInsights,
  fetchPvVisitorBotLeadsSummary,
  fetchPvVisitorBotSummary,
} from "@/lib/api/visitor-bot";
import { tryGetPublicApiBaseUrl } from "@/lib/utils/env";
import {
  AssistrioApiError,
  type PvVisitorBotBasicInsightsResponse,
  type PvVisitorBotLeadsSummaryResponse,
  type PvVisitorBotSummaryResponse,
} from "@/types/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Props = {
  platformVisitorId: string;
  botId: string;
  /** Show refresh control (default true). */
  showRefresh?: boolean;
  /** Long hint above refresh — off when the parent already explains the block (e.g. trial success). */
  showHeaderHint?: boolean;
};

type OkState = {
  kind: "ok";
  summary: PvVisitorBotSummaryResponse;
  insights: PvVisitorBotBasicInsightsResponse | null;
  leads: PvVisitorBotLeadsSummaryResponse | null;
  partialErrors: string[];
  refreshError?: string | null;
};

type LoadState =
  | { kind: "loading" }
  | { kind: "no_api" }
  | { kind: "error"; message: string }
  | OkState;

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function SectionTitle({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div className="mb-4">
      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-slate-500">{kicker}</p>
      <h3 className="mt-1 font-[family-name:var(--font-display)] text-base font-semibold text-slate-900 sm:text-[1.05rem]">
        {title}
      </h3>
    </div>
  );
}

function UsageRow({
  title,
  subtitle,
  bucket,
}: {
  title: string;
  subtitle: string;
  bucket: { limit: number; used: number; remaining: number };
}) {
  const remainingPct =
    bucket.limit > 0 ? Math.min(100, Math.round((bucket.remaining / bucket.limit) * 100)) : 0;
  return (
    <div className="border-b border-[var(--border-default)] pb-5 last:border-0 last:pb-0">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-900">{title}</p>
          <p className="mt-0.5 text-xs leading-snug text-[var(--foreground-muted)]">{subtitle}</p>
        </div>
        <p className="shrink-0 text-left text-sm tabular-nums text-slate-800 sm:text-right">
          <span className="font-semibold text-[var(--brand-teal-dark)]">{bucket.remaining}</span>
          <span className="text-[var(--foreground-muted)]"> left</span>
          <span className="mt-0.5 block text-xs font-normal text-[var(--foreground-muted)]">
            {bucket.used} / {bucket.limit} used
          </span>
        </p>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-[var(--brand-teal)] transition-[width] duration-300"
          style={{ width: `${remainingPct}%` }}
        />
      </div>
    </div>
  );
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
      <path d="M21 21v-5h-5" />
    </svg>
  );
}

/**
 * Limited, PV-safe snapshot for an owned trial bot — only
 * `POST /api/public/visitor-bot/summary`, `basic-insights`, `leads-summary`.
 */
export function PvTrialBotSummary({ platformVisitorId, botId, showRefresh = true, showHeaderHint = true }: Props) {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [refreshing, setRefreshing] = useState(false);
  const lastOkRef = useRef<OkState | null>(null);

  const runFetch = useCallback(
    async (mode: "initial" | "refresh") => {
      if (!platformVisitorId?.trim() || !botId?.trim()) return;

      if (!tryGetPublicApiBaseUrl()) {
        setState({ kind: "no_api" });
        return;
      }

      const isRefresh = mode === "refresh";
      if (isRefresh) {
        setRefreshing(true);
        if (lastOkRef.current) {
          setState({ ...lastOkRef.current, refreshError: null });
        }
      } else {
        lastOkRef.current = null;
        setState({ kind: "loading" });
      }

      const [r1, r2, r3] = await Promise.allSettled([
        fetchPvVisitorBotSummary(platformVisitorId, botId),
        fetchPvVisitorBotBasicInsights(platformVisitorId, botId),
        fetchPvVisitorBotLeadsSummary(platformVisitorId, botId),
      ]);

      if (r1.status === "rejected") {
        const msg =
          r1.reason instanceof AssistrioApiError
            ? r1.reason.message
            : r1.reason instanceof Error
              ? r1.reason.message
              : "Could not load summary.";
        if (isRefresh && lastOkRef.current) {
          setState({ ...lastOkRef.current, refreshError: msg });
          setRefreshing(false);
          return;
        }
        setState({ kind: "error", message: msg });
        setRefreshing(false);
        return;
      }

      const summary = r1.value;
      let insights: PvVisitorBotBasicInsightsResponse | null = null;
      let leads: PvVisitorBotLeadsSummaryResponse | null = null;
      const partialErrors: string[] = [];

      if (r2.status === "fulfilled") {
        insights = r2.value;
      } else {
        partialErrors.push(
          r2.reason instanceof Error ? r2.reason.message : "Activity could not be loaded.",
        );
      }
      if (r3.status === "fulfilled") {
        leads = r3.value;
      } else {
        partialErrors.push(r3.reason instanceof Error ? r3.reason.message : "Leads could not be loaded.");
      }

      const next: OkState = {
        kind: "ok",
        summary,
        insights,
        leads,
        partialErrors,
        refreshError: null,
      };
      lastOkRef.current = next;
      setState(next);
      setRefreshing(false);
    },
    [platformVisitorId, botId],
  );

  useEffect(() => {
    void runFetch("initial");
  }, [runFetch]);

  if (state.kind === "loading") {
    return (
      <Card className="border-[var(--border-default)] bg-white p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="h-5 w-40 animate-pulse rounded bg-slate-200" />
          <div className="h-9 w-28 animate-pulse rounded-[var(--radius-md)] bg-slate-100" />
        </div>
        <div className="mt-6 space-y-4">
          <div className="h-28 animate-pulse rounded-[var(--radius-lg)] bg-slate-100" />
          <div className="h-36 animate-pulse rounded-[var(--radius-lg)] bg-slate-100" />
        </div>
      </Card>
    );
  }

  if (state.kind === "no_api") {
    return (
      <Card className="border-amber-200/90 bg-amber-50/60 p-5">
        <p className="text-sm font-semibold text-amber-950">Can&apos;t reach the API</p>
        <p className="mt-2 text-sm leading-relaxed text-amber-900/90">
          Set <code className="rounded bg-white px-1 text-xs">NEXT_PUBLIC_ASSISTRIO_API_BASE_URL</code> in this site&apos;s
          env so we can load your summary.
        </p>
      </Card>
    );
  }

  if (state.kind === "error") {
    return (
      <Card className="border-red-200/90 bg-red-50/60 p-5">
        <p className="text-sm font-semibold text-red-900">Summary didn&apos;t load</p>
        <p className="mt-2 text-sm text-red-800/90">{state.message}</p>
        <Button type="button" variant="secondary" className="mt-4" onClick={() => void runFetch("initial")}>
          Try again
        </Button>
      </Card>
    );
  }

  const { summary, insights, leads, partialErrors, refreshError } = state;
  const b = summary.bot;
  const u = summary.usage;

  return (
    <div className="space-y-4 sm:space-y-5">
      {showRefresh ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {showHeaderHint ? (
            <p className="text-xs text-[var(--foreground-muted)]">
              Read-only numbers from your bot and saved id.{" "}
              <span className="text-slate-600">Update</span> pulls the latest without reloading the page.
            </p>
          ) : (
            <span className="text-xs text-[var(--foreground-muted)] sm:min-h-[2.25rem] sm:py-2">
              Latest from the API — use update anytime.
            </span>
          )}
          <Button
            type="button"
            variant="secondary"
            className="w-full shrink-0 sm:w-auto"
            disabled={refreshing}
            onClick={() => void runFetch("refresh")}
            aria-busy={refreshing}
          >
            <span className="inline-flex items-center gap-2">
              <RefreshIcon className={refreshing ? "animate-spin text-[var(--brand-teal-dark)]" : "text-slate-600"} />
              {refreshing ? "Updating…" : "Update numbers"}
            </span>
          </Button>
        </div>
      ) : null}

      {refreshError ? (
        <div className="rounded-[var(--radius-lg)] border border-amber-200/90 bg-amber-50/80 px-4 py-3 text-sm text-amber-950">
          <p className="font-medium">Update didn&apos;t finish</p>
          <p className="mt-1 text-xs text-amber-900/90">{refreshError}</p>
          <p className="mt-2 text-xs text-amber-900/85">Showing the last numbers we loaded.</p>
        </div>
      ) : null}

      <div className={refreshing ? "pointer-events-none opacity-[0.72] transition-opacity duration-200" : ""}>
        {partialErrors.length > 0 ? (
          <div className="rounded-[var(--radius-lg)] border border-amber-200/90 bg-amber-50/70 px-4 py-3 text-sm text-amber-950">
            <p className="font-medium">Some parts didn&apos;t load</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-amber-900/90">
              {partialErrors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <Card className="border-[var(--border-teal-soft)] bg-gradient-to-b from-white to-slate-50/60 p-5 ring-1 ring-[var(--brand-teal)]/10 sm:p-6">
          <SectionTitle kicker="Bot" title={b.name} />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-xs font-medium text-slate-700">
              {b.status}
            </span>
            <span className="text-xs text-[var(--foreground-muted)]">Visitor trial bot</span>
          </div>
          <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
            <div className="min-w-0">
              <dt className="text-xs font-medium text-slate-500">Slug</dt>
              <dd className="mt-0.5 break-all font-mono text-sm text-slate-800">{b.slug}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">Created</dt>
              <dd className="mt-0.5 text-slate-800">{formatWhen(b.createdAt)}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium text-slate-500">Where runtime is allowed</dt>
              <dd className="mt-0.5 text-slate-800">
                {b.allowedDomains.length > 0 ? b.allowedDomains.join(", ") : b.allowedDomain || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">Lead capture</dt>
              <dd className="mt-0.5 text-slate-800">{b.leadCaptureEnabled ? "On" : "Off"}</dd>
            </div>
          </dl>
        </Card>

        <Card className="border-[var(--border-default)] bg-white p-5 sm:p-6">
          <SectionTitle kicker="Usage" title="Quotas for this saved id" />
          <p className="mb-5 text-xs leading-relaxed text-[var(--foreground-muted)]">
            Preview = tests in Assistrio; trial runtime = this bot on your allowlisted site; showcase = shared pool for
            gallery demos.
          </p>
          <div className="space-y-5">
            <UsageRow
              title="Preview"
              subtitle="Drafts and tests inside Assistrio — not your public site."
              bucket={u.preview}
            />
            <UsageRow
              title="Trial runtime"
              subtitle="Messages on this bot, tied to your id."
              bucket={u.trialRuntime}
            />
            <UsageRow
              title="Showcase demos"
              subtitle="When you try gallery bots as runtime demos."
              bucket={u.showcaseRuntime}
            />
          </div>
        </Card>

        {insights ? (
          <Card className="border-[var(--border-default)] bg-white p-5 sm:p-6">
            <SectionTitle kicker="Activity" title="Chats & messages" />
            <p className="mb-5 text-xs leading-relaxed text-[var(--foreground-muted)]">
              Counts for your saved id on this bot — not a full export.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[var(--radius-md)] border border-slate-100 bg-slate-50/90 px-4 py-3">
                <p className="text-xs font-medium text-slate-500">Conversations</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{insights.conversationCount}</p>
              </div>
              <div className="rounded-[var(--radius-md)] border border-slate-100 bg-slate-50/90 px-4 py-3">
                <p className="text-xs font-medium text-slate-500">Messages</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{insights.messageCount}</p>
              </div>
              <div className="rounded-[var(--radius-md)] border border-slate-100 bg-slate-50/90 px-4 py-3 sm:col-span-2">
                <p className="text-xs font-medium text-slate-500">Latest activity</p>
                <p className="mt-1 text-sm text-slate-800">{formatWhen(insights.lastActivityAt)}</p>
              </div>
            </div>
          </Card>
        ) : null}

        {leads ? (
          <Card className="border-[var(--border-default)] bg-white p-5 sm:p-6">
            <SectionTitle kicker="Leads" title="Totals only" />
            <p className="mb-5 text-xs leading-relaxed text-[var(--foreground-muted)]">
              No names or emails shown here — counts only.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[var(--radius-md)] border border-slate-100 bg-slate-50/90 px-4 py-3">
                <p className="text-xs font-medium text-slate-500">Conversations with a lead</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">
                  {leads.conversationsWithCapturedLeads}
                </p>
              </div>
              <div className="rounded-[var(--radius-md)] border border-slate-100 bg-slate-50/90 px-4 py-3">
                <p className="text-xs font-medium text-slate-500">Fields saved (total)</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">
                  {leads.totalLeadFieldsCaptured}
                </p>
              </div>
            </div>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
