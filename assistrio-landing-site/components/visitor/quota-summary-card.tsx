"use client";

import { useEffect, useState } from "react";
import { fetchPublicVisitorQuotaSummary } from "@/lib/api/quota";
import { usePlatformVisitorId } from "@/hooks/usePlatformVisitorId";
import { tryGetPublicApiBaseUrl } from "@/lib/utils/env";
import { AssistrioApiError, type PublicVisitorQuotaSummaryResponse } from "@/types/api";
import { Card } from "@/components/ui/card";

type LoadState =
  | { kind: "loading" }
  | { kind: "no_api" }
  | { kind: "error"; message: string; detail?: string }
  | { kind: "ok"; data: PublicVisitorQuotaSummaryResponse };

/**
 * Read-only usage for the current anonymous `platformVisitorId` (shared quota for showcase demos).
 * Backed by `POST /api/public/visitor-quota/summary`.
 */
export function QuotaSummaryCard() {
  const { platformVisitorId, status } = usePlatformVisitorId();
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  useEffect(() => {
    if (status !== "ready" || !platformVisitorId) return;

    const base = tryGetPublicApiBaseUrl();
    if (!base) {
      setState({ kind: "no_api" });
      return;
    }

    let cancelled = false;
    setState({ kind: "loading" });

    (async () => {
      try {
        const data = await fetchPublicVisitorQuotaSummary(platformVisitorId);
        if (!cancelled) setState({ kind: "ok", data });
      } catch (e) {
        if (cancelled) return;
        if (e instanceof AssistrioApiError) {
          const parts: string[] = [];
          if (e.status === 429 && e.retryAfterSeconds != null) {
            parts.push(`Wait ~${e.retryAfterSeconds}s before retrying.`);
          }
          if (e.deploymentHint) parts.push(e.deploymentHint);
          setState({
            kind: "error",
            message: e.message,
            detail: parts.length ? parts.join(" ") : undefined,
          });
          return;
        }
        const msg = e instanceof Error ? e.message : "Could not load usage";
        setState({ kind: "error", message: msg });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [platformVisitorId, status]);

  if (status === "loading" || state.kind === "loading") {
    return (
      <Card className="border-[var(--border-default)] bg-white">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Usage</p>
        <p className="mt-1 text-sm font-semibold text-slate-900">Loading buckets…</p>
        <div className="mt-4 space-y-3">
          <div className="h-10 animate-pulse rounded-[var(--radius-md)] bg-slate-100" />
          <div className="h-10 animate-pulse rounded-[var(--radius-md)] bg-slate-100" />
          <div className="h-10 animate-pulse rounded-[var(--radius-md)] bg-slate-100" />
        </div>
      </Card>
    );
  }

  if (state.kind === "no_api") {
    return (
      <Card className="border-amber-200/90 bg-amber-50/60">
        <p className="text-sm font-semibold text-amber-950">Usage unavailable</p>
        <p className="mt-2 text-sm text-amber-900/90">
          Set <code className="rounded bg-white px-1 text-xs">NEXT_PUBLIC_ASSISTRIO_API_BASE_URL</code> to load quota
          from the API.
        </p>
      </Card>
    );
  }

  if (state.kind === "error") {
    return (
      <Card className="border-red-200/90 bg-red-50/60">
        <p className="text-sm font-semibold text-red-900">Could not load usage</p>
        <p className="mt-2 text-sm text-red-800/90">{state.message}</p>
        {state.detail ? (
          <p className="mt-2 text-xs leading-relaxed text-red-900/85">{state.detail}</p>
        ) : null}
      </Card>
    );
  }

  const q = state.data.quotas;

  function Row({
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
        <div className="flex items-baseline justify-between gap-2">
          <div>
            <p className="text-sm font-medium text-slate-900">{title}</p>
            <p className="text-xs text-[var(--foreground-muted)]">{subtitle}</p>
          </div>
          <p className="shrink-0 text-right text-sm tabular-nums text-slate-800">
            <span className="font-semibold text-[var(--brand-teal-dark)]">{bucket.remaining}</span>
            <span className="text-[var(--foreground-muted)]"> left</span>
            <span className="block text-xs font-normal text-[var(--foreground-muted)]">
              {bucket.used} / {bucket.limit} used
            </span>
          </p>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-[var(--brand-teal)] transition-[width]"
            style={{ width: `${remainingPct}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <Card className="border-[var(--border-default)] bg-gradient-to-b from-white to-slate-50/70 ring-1 ring-slate-900/[0.03]">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Usage</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">Anonymous quota buckets</p>
      <p className="mt-2 text-xs leading-relaxed text-[var(--foreground-muted)]">
        Limits for this browser&apos;s saved id. Preview, Explore runtime on your AI Support Agent, and gallery live examples use separate
        buckets; the gallery draws from a shared showcase pool for all public demos combined.
      </p>
      <div className="mt-6 space-y-5">
        <Row
          title="Preview"
          subtitle="Assistrio-hosted preview only — not your production site."
          bucket={q.preview}
        />
        <Row
          title="Explore runtime"
          subtitle="Messages on your evaluation AI Support Agent on the allowed website you configured."
          bucket={q.trialRuntime}
        />
        <Row
          title="Live examples (gallery)"
          subtitle="Shared pool when browsing public showcase AI Agents as runtime demos."
          bucket={q.showcaseRuntime}
        />
      </div>
    </Card>
  );
}
