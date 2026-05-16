"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { mountAssistrioRuntimeFromCdn, unmountAssistrioRuntimeFromCdn } from "@/lib/widget/cdn-mount";
import { tryGetPublicApiBaseUrl } from "@/lib/utils/env";
import { Card } from "@/components/ui/card";
import { RuntimeFailureHints } from "@/components/visitor/runtime-failure-hints";
import { reducedEaseTransition } from "@/lib/motion/reduced-motion";

type Props = {
  botId: string;
  accessKey: string;
};

type Phase = "blocked" | "loading" | "ready" | "script_error";

const spring = { type: "spring", stiffness: 380, damping: 32 } as const;

/**
 * Loads CDN `assistrio-chat.js` with `mode: "runtime"`, access key, and `embedOrigin: window.location.origin`.
 */
export function AssistrioShowcaseRuntimeEmbed({ botId, accessKey }: Props) {
  const [phase, setPhase] = useState<Phase>("loading");
  const reduceMotion = useReducedMotion();

  useEffect(() => {
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
        embedOrigin: typeof window !== "undefined" ? window.location.origin : "",
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
  }, [botId, accessKey]);

  const loadTransition = reduceMotion ? reducedEaseTransition : { duration: 0.25, ease: [0.22, 1, 0.36, 1] as const };
  const readyTransition = reduceMotion ? reducedEaseTransition : spring;

  if (phase === "blocked") {
    const reason = !tryGetPublicApiBaseUrl() ? "missing_api" : !accessKey || !botId ? "missing_embed_keys" : "unknown";
    return (
      <Card className="border-amber-200/90 bg-amber-50/60">
        <p className="text-sm font-semibold text-amber-950">Runtime embed unavailable</p>
        <p className="mt-2 text-sm text-amber-900/90">
          {reason === "missing_api"
            ? "Set NEXT_PUBLIC_ASSISTRIO_API_BASE_URL at build time so the browser can call the API."
            : reason === "missing_embed_keys"
              ? "Missing AI Agent id or access key from the public API response — cannot mount the widget."
              : "Could not start the widget."}
        </p>
        <p className="mt-2 text-xs text-amber-900/85">
          These are <strong className="font-medium">configuration</strong> issues on this page — not CORS or allowed
          origin rules yet (the widget script may not have started).
        </p>
      </Card>
    );
  }

  if (phase === "script_error") {
    return (
      <div role="alert">
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
      </div>
    );
  }

  return (
    <Card className="border-[var(--border-teal-soft)] bg-white ring-1 ring-[var(--brand-teal)]/10">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--brand-teal-dark)]">Run here now</p>
      <h3 className="mt-1 font-[family-name:var(--font-display)] text-lg font-semibold text-slate-900">Runtime demo</h3>
      <p className="mt-2 text-sm leading-relaxed text-[var(--foreground-muted)]">
        The chat widget mounts as a <strong className="font-medium text-slate-800">floating launcher</strong> on this
        page. It uses this agent&apos;s access key; the API allows this page only if this origin is listed on the agent
        as an active allowed origin (exact match).
      </p>
      <AnimatePresence mode="wait">
        {phase === "loading" ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduceMotion ? 0 : -6 }}
            transition={loadTransition}
            className="mt-6 space-y-4"
            role="status"
            aria-live="polite"
          >
            <div className="relative min-h-[160px] overflow-hidden rounded-[var(--radius-xl)] border border-dashed border-[var(--border-teal-soft)] bg-[var(--brand-teal-subtle)]/25">
              {reduceMotion ? null : <div className="absolute inset-0 assistrio-shimmer-line opacity-80" />}
              <div className="relative flex h-full min-h-[160px] flex-col justify-between p-5">
                <div className="space-y-2">
                  <div className="h-3 w-[40%] max-w-[10rem] rounded assistrio-skeleton" />
                  <div className="h-3 w-[72%] rounded assistrio-skeleton opacity-90" />
                  <div className="h-3 w-[55%] rounded assistrio-skeleton opacity-80" />
                </div>
                <div className="flex items-end justify-between gap-3">
                  {!reduceMotion ? (
                    <div className="flex gap-1.5 typing-dots" aria-hidden>
                      <span className="h-2 w-2 rounded-full bg-[var(--brand-teal)]" />
                      <span className="h-2 w-2 rounded-full bg-[var(--brand-teal)]" />
                      <span className="h-2 w-2 rounded-full bg-[var(--brand-teal)]" />
                    </div>
                  ) : null}
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--brand-teal-dark)]">
                    Opening widget…
                  </p>
                </div>
              </div>
            </div>
            <div className="flex justify-end">
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand-teal)] text-lg text-white shadow-lg${reduceMotion ? "" : " launcher-pulse"}`}
                aria-hidden
              >
                {String.fromCodePoint(0x1f4ac)}
              </div>
            </div>
            <p className="sr-only">Loading chat widget script.</p>
          </motion.div>
        ) : (
          <motion.div
            key="ready"
            initial={{ opacity: 0, y: reduceMotion ? 0 : 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={readyTransition}
            className="mt-6 space-y-4"
            role="status"
            aria-live="polite"
          >
            <p className="sr-only">Widget loaded. Look for the floating chat launcher on this page.</p>
            <div className="rounded-[var(--radius-lg)] border border-emerald-200/90 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-900">
              Widget script loaded and mount ran. Look for the floating launcher. If opening chat shows an error, read
              the message — it may include a <code className="rounded bg-white px-1 text-xs">deploymentHint</code> from
              the API. Init failures are often <strong className="font-medium">CORS</strong> (no JSON) or{" "}
              <strong className="font-medium">403</strong> when this page&apos;s origin is not an active allowed origin (
              <code className="rounded bg-white px-1 text-xs">errorCode</code>
              ).
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-slate-50/60 px-4 py-3">
              <p className="text-xs font-medium text-slate-600">Live launcher</p>
              <div
                className={`flex h-11 w-11 items-center justify-center rounded-full bg-[var(--brand-teal)] text-base text-white shadow-md${reduceMotion ? "" : " launcher-pulse"}`}
                aria-hidden
              >
                {String.fromCodePoint(0x1f4ac)}
              </div>
            </div>
            <RuntimeFailureHints variant="compact" />
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
