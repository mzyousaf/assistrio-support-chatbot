"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Info } from "lucide-react";
import { fetchPublicVisitorQuotaSummary } from "@/lib/api/quota";
import { tryGetPublicApiBaseUrl } from "@/lib/utils/env";
import { AssistrioApiError, type PublicVisitorQuotaSummaryResponse } from "@/types/api";

type LoadState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "no_api" }
  | { kind: "error"; message: string }
  | { kind: "ok"; data: PublicVisitorQuotaSummaryResponse };

function MiniBar({ pct }: { pct: number }) {
  return (
    <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-slate-200/90">
      <div className="h-full rounded-full bg-[var(--brand-teal)] transition-[width]" style={{ width: `${pct}%` }} />
    </div>
  );
}

type Props = {
  platformVisitorId: string;
};

/**
 * Sidebar usage only — preview + trial runtime buckets. Shown for all trial dashboard sessions.
 */
export function TrialWorkspaceQuotaCard({ platformVisitorId }: Props) {
  const [state, setState] = useState<LoadState>({ kind: "idle" });

  useEffect(() => {
    if (!platformVisitorId.trim()) {
      setState({ kind: "error", message: "No workspace id." });
      return;
    }

    const base = tryGetPublicApiBaseUrl();
    if (!base) {
      setState({ kind: "no_api" });
      return;
    }

    let cancelled = false;
    setState({ kind: "loading" });

    (async () => {
      try {
        const data = await fetchPublicVisitorQuotaSummary(platformVisitorId.trim());
        if (!cancelled) setState({ kind: "ok", data });
      } catch (e) {
        if (cancelled) return;
        if (e instanceof AssistrioApiError) {
          setState({ kind: "error", message: e.message });
          return;
        }
        setState({ kind: "error", message: e instanceof Error ? e.message : "Could not load usage." });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [platformVisitorId]);

  const row = (label: string, bucket: { limit: number; used: number; remaining: number }) => {
    const pct = bucket.limit > 0 ? Math.min(100, Math.round((bucket.remaining / bucket.limit) * 100)) : 0;
    return (
      <div className="border-b border-slate-100/80 pb-2 last:border-0 last:pb-0">
        <div className="flex items-baseline justify-between gap-1">
          <p className="text-[11px] font-medium text-slate-700">{label}</p>
          <p className="shrink-0 text-[10px] tabular-nums text-slate-600">
            <span className="font-semibold text-[var(--brand-teal-dark)]">{bucket.remaining}</span> left
          </p>
        </div>
        <MiniBar pct={pct} />
        <p className="mt-0.5 text-[9px] tabular-nums text-slate-400">
          {bucket.used}/{bucket.limit} used
        </p>
      </div>
    );
  };

  let body: ReactNode;
  if (state.kind === "idle" || state.kind === "loading") {
    body = <div className="h-6 animate-pulse rounded bg-slate-100" />;
  } else if (state.kind === "no_api") {
    body = <p className="text-[10px] leading-snug text-amber-900/90">Usage unavailable (API not configured).</p>;
  } else if (state.kind === "error") {
    body = <p className="text-[10px] leading-snug text-red-800/90">{state.message}</p>;
  } else {
    const q = state.data.quotas;
    body = (
      <div className="mt-2 space-y-2">
        {row("Preview", q.preview)}
        {row("Runtime", q.trialRuntime)}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200/80 bg-slate-50/50 px-2.5 py-2">
      <div className="flex items-center gap-1.5">
        <span
          className="inline-flex shrink-0"
          title="Message allowances: Assistrio-hosted preview vs. your allowed site with the trial embed."
        >
          <Info className="h-3.5 w-3.5 text-slate-400" strokeWidth={2} aria-hidden />
        </span>
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Usage</p>
      </div>
      {body}
    </div>
  );
}
