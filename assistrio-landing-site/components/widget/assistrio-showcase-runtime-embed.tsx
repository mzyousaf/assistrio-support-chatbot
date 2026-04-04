"use client";

import { useEffect, useState } from "react";
import { mountAssistrioRuntimeFromCdn, unmountAssistrioRuntimeFromCdn } from "@/lib/widget/cdn-mount";
import { tryGetPublicApiBaseUrl } from "@/lib/utils/env";
import { Card } from "@/components/ui/card";
import { RuntimeFailureHints } from "@/components/visitor/runtime-failure-hints";

type Props = {
  botId: string;
  accessKey: string;
  platformVisitorId: string | null;
  identityReady: boolean;
};

type Phase = "waiting_identity" | "blocked" | "loading" | "ready" | "script_error";

/**
 * **Showcase runtime only** — loads CDN `assistrio-chat.js`, sets `mode: "runtime"`, passes `platformVisitorId`.
 * Chat threads are created inside the widget (not by the landing app).
 */
export function AssistrioShowcaseRuntimeEmbed({ botId, accessKey, platformVisitorId, identityReady }: Props) {
  const [phase, setPhase] = useState<Phase>("waiting_identity");

  useEffect(() => {
    if (!identityReady || !platformVisitorId) {
      setPhase("waiting_identity");
      return;
    }

    const apiBase = tryGetPublicApiBaseUrl();
    if (!apiBase || !accessKey || !botId) {
      setPhase("blocked");
      return;
    }

    let cancelled = false;
    setPhase("loading");

    mountAssistrioRuntimeFromCdn(
      {
        mode: "runtime",
        botId,
        apiBaseUrl: apiBase,
        accessKey,
        platformVisitorId,
        embedOrigin: window.location.origin,
      },
      {
        onScriptError: () => {
          if (!cancelled) setPhase("script_error");
        },
        onMounted: () => {
          if (!cancelled) setPhase("ready");
        },
      },
    );

    return () => {
      cancelled = true;
      unmountAssistrioRuntimeFromCdn();
    };
  }, [botId, accessKey, platformVisitorId, identityReady]);

  if (phase === "waiting_identity") {
    return (
      <Card className="border-[var(--border-default)] bg-slate-50/40">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Widget</p>
        <h3 className="mt-1 font-[family-name:var(--font-display)] text-lg font-semibold text-slate-900">Runtime demo</h3>
        <div className="mt-4 flex min-h-[120px] items-center justify-center rounded-[var(--radius-xl)] border border-dashed border-[var(--border-default)] bg-white/80">
          <p className="text-sm text-[var(--foreground-muted)]">Preparing your stable id…</p>
        </div>
      </Card>
    );
  }

  if (phase === "blocked") {
    const api = tryGetPublicApiBaseUrl();
    const reason = !api
      ? "missing_api"
      : !accessKey || !botId
        ? "missing_embed_keys"
        : "missing_identity";
    return (
      <Card className="border-amber-200/90 bg-amber-50/60">
        <p className="text-sm font-semibold text-amber-950">Runtime embed unavailable</p>
        <p className="mt-2 text-sm text-amber-900/90">
          {reason === "missing_api"
            ? "Set NEXT_PUBLIC_ASSISTRIO_API_BASE_URL at build time so the browser can call the API."
            : reason === "missing_embed_keys"
              ? "Missing bot id or access key from the public API response — cannot mount the widget."
              : "Stable identity not ready — wait for platformVisitorId, or use Reconnect on the homepage / trial page."}
        </p>
        <p className="mt-2 text-xs text-amber-900/85">
          These are <strong className="font-medium">configuration</strong> issues on this page — not CORS or domain
          allowlist yet (the widget script never started).
        </p>
      </Card>
    );
  }

  if (phase === "script_error") {
    return (
      <Card className="border-red-200/90 bg-red-50/60">
        <p className="text-sm font-semibold text-red-900">Could not load widget script</p>
        <p className="mt-2 text-sm text-red-800/90">
          The <code className="rounded bg-white px-1 text-xs">assistrio-chat.js</code> request failed before any API call.
          Check <code className="rounded bg-white px-1 text-xs">NEXT_PUBLIC_ASSISTRIO_WIDGET_*</code>, ad blockers, and
          the Network tab. This is <strong className="font-medium">not</strong> a CORS error on{" "}
          <code className="rounded bg-white px-1 text-xs">/api/widget/init</code> (that only happens after the script
          loads).
        </p>
      </Card>
    );
  }

  return (
    <Card className="border-[var(--border-teal-soft)] bg-white ring-1 ring-[var(--brand-teal)]/10">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--brand-teal-dark)]">Run here now</p>
      <h3 className="mt-1 font-[family-name:var(--font-display)] text-lg font-semibold text-slate-900">Runtime demo</h3>
      <p className="mt-2 text-sm leading-relaxed text-[var(--foreground-muted)]">
        The chat widget mounts as a <strong className="font-medium text-slate-800">floating launcher</strong> on this
        page. It uses your saved <code className="rounded bg-slate-100 px-1 text-xs">platformVisitorId</code> and this
        bot&apos;s public access key — showcase demo messages share one quota pool per id.
      </p>
      {phase === "loading" ? (
        <div className="mt-6 flex min-h-[140px] items-center justify-center rounded-[var(--radius-xl)] border border-dashed border-[var(--border-teal-soft)] bg-[var(--brand-teal-subtle)]/20">
          <p className="text-sm font-medium text-[var(--brand-teal-dark)]">Loading widget…</p>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          <div className="rounded-[var(--radius-lg)] border border-emerald-200/90 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-900">
            Widget script loaded and mount ran. Look for the floating launcher. If opening chat shows an error, read the
            message — it may include a <code className="rounded bg-white px-1 text-xs">deploymentHint</code> from the API.
            Init failures are often <strong className="font-medium">CORS</strong> (no JSON) or{" "}
            <strong className="font-medium">403</strong> allowlist / identity (JSON with <code className="rounded bg-white px-1 text-xs">errorCode</code>
            ).
          </div>
          <RuntimeFailureHints variant="compact" />
        </div>
      )}
    </Card>
  );
}
