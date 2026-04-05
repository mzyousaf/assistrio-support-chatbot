"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { usePlatformVisitorId } from "@/hooks/usePlatformVisitorId";
import { useTrackEvent } from "@/hooks/useTrackEvent";
import { createTrialBot } from "@/lib/api/trial";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TrialSuccessPanel } from "@/components/sections/trial/trial-success-panel";
import { savePvLastTrialBotRef } from "@/lib/identity/pv-last-trial-bot";
import { AssistrioApiError } from "@/types/api";
import type { TrialCreateResponse } from "@/types/api";

type TrialFormProps = {
  /** Fires once when a trial bot is created — parent may collapse setup steps. */
  onTrialCreated?: () => void;
  /** Fires when success handoff is cleared (e.g. id mismatch) — parent should show setup steps again. */
  onTrialHandoffLost?: () => void;
  /** When set, the hostname field is omitted and this value is used for allowlisting (e.g. step-based flow). */
  hostnameOverride?: string;
  /** Hide the website input block — use with `hostnameOverride` from a parent step. */
  hideHostnameField?: boolean;
  /** Anchor for reconnect hint when query param was rejected (default `#reconnect`). */
  reconnectHintHref?: string;
  /** Optional id for the create step heading — supports focus management in step flows. */
  stepHeadingId?: string;
};

export function TrialForm({
  onTrialCreated,
  onTrialHandoffLost,
  hostnameOverride,
  hideHostnameField = false,
  reconnectHintHref = "#reconnect",
  stepHeadingId,
}: TrialFormProps) {
  const reduceMotion = useReducedMotion();
  const { platformVisitorId, status, queryParamRejected } = usePlatformVisitorId();
  const { track } = useTrackEvent();
  const [hostname, setHostname] = useState("");
  const [pageHost, setPageHost] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<TrialCreateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorHint, setErrorHint] = useState<string | null>(null);
  const [errorRetryAfter, setErrorRetryAfter] = useState<number | null>(null);

  useEffect(() => {
    setPageHost(window.location.hostname);
  }, []);

  useEffect(() => {
    if (!success) return;
    if (!platformVisitorId || success.platformVisitorId !== platformVisitorId) {
      setSuccess(null);
      onTrialHandoffLost?.();
    }
  }, [success, platformVisitorId, onTrialHandoffLost]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setErrorHint(null);
    setErrorRetryAfter(null);
    if (!platformVisitorId || status !== "ready") {
      setError("Identity not ready yet.");
      return;
    }
    const fromParent = hostnameOverride?.trim() ?? "";
    const allowedDomain =
      fromParent ||
      hostname.trim() ||
      (typeof window !== "undefined" ? window.location.hostname : "");
    if (!allowedDomain) {
      setError("Enter the allowed website (URL or hostname) where the widget will run.");
      return;
    }
    track("trial_create_started", { allowedDomain });
    setSubmitting(true);
    try {
      const res = await createTrialBot({
        platformVisitorId,
        allowedDomain,
      });
      track(
        "trial_create_succeeded",
        { allowedDomain, slug: res.bot.slug },
        { botId: res.bot.id },
      );
      track("trial_bot_created", { slug: res.bot.slug }, { botId: res.bot.id });
      savePvLastTrialBotRef(platformVisitorId, res.bot.id);
      setSuccess(res);
      onTrialCreated?.();
    } catch (err) {
      if (err instanceof AssistrioApiError) {
        setError(err.message + (err.errorCode ? ` (${err.errorCode})` : ""));
        setErrorHint(err.deploymentHint ?? null);
        setErrorRetryAfter(
          err.status === 429 && err.retryAfterSeconds != null ? err.retryAfterSeconds : null,
        );
      } else {
        setError(err instanceof Error ? err.message : "Request failed");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{
          duration: reduceMotion ? 0.2 : 0.3,
          ease: [0.22, 1, 0.36, 1],
        }}
      >
        <TrialSuccessPanel trial={success} />
      </motion.div>
    );
  }

  return (
    <Card className="border-[var(--border-teal-soft)] bg-gradient-to-b from-white to-slate-50/40 ring-1 ring-[var(--brand-teal)]/8">
      {queryParamRejected ? (
        <p className="mb-5 rounded-[var(--radius-lg)] border border-amber-200/90 bg-amber-50/80 px-3 py-2.5 text-sm text-amber-950 shadow-[var(--shadow-xs)]">
          The <code className="rounded bg-white px-1 text-xs">platformVisitorId</code> in the URL was not valid — this
          browser generated a new id. Paste a saved id under{" "}
          <a href={reconnectHintHref} className="font-medium text-amber-950 underline decoration-amber-900/30 underline-offset-2">
            Identity &amp; reconnect
          </a>{" "}
          to align with your previous Explore session or gallery demos.
        </p>
      ) : null}
      <p className="text-eyebrow">Create</p>
      <h3
        id={stepHeadingId}
        tabIndex={stepHeadingId ? -1 : undefined}
        className="mt-2 font-[family-name:var(--font-display)] text-xl font-semibold text-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-teal)]/35 focus-visible:ring-offset-2"
      >
        Evaluation bot & allowed website
      </h3>
      {!hideHostnameField ? (
        <p className="mt-2 text-sm leading-relaxed text-[var(--foreground-muted)]">
          Ownership attaches to the <strong className="font-medium text-slate-800">stable id</strong> shown above. Runtime
          chat is allowed only on the allowed website (hostname) we store from your URL; owner preview stays in Assistrio UIs —
          not on your public site from this snippet.
        </p>
      ) : (
        <p className="mt-2 text-sm leading-relaxed text-[var(--foreground-muted)]">
          You&apos;re creating an evaluation bot for{" "}
          <strong className="font-medium text-slate-900">{hostnameOverride?.trim() || "your site"}</strong>. Owner preview
          stays in Assistrio product surfaces.
        </p>
      )}
      <div className="mt-4 rounded-[var(--radius-lg)] border border-slate-200/90 bg-slate-50/80 px-3 py-2.5 text-xs leading-relaxed text-[var(--foreground-muted)]">
        <strong className="font-medium text-slate-700">Preview vs runtime:</strong> this step only sets which{" "}
        <strong className="font-medium text-slate-800">allowed website</strong> may run your Explore bot at runtime.
      </div>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        {!hideHostnameField ? (
          <div>
            <label htmlFor="allowedDomain" className="block text-sm font-medium text-slate-800">
              Allowed website (URL or hostname)
            </label>
            <input
              id="allowedDomain"
              name="allowedDomain"
              value={hostname}
              onChange={(e) => setHostname(e.target.value)}
              placeholder="e.g. https://www.example.com/app or www.example.com"
              className="mt-1.5 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-white px-3 py-2.5 text-sm outline-none transition-shadow focus:border-[var(--border-teal-soft)] focus:ring-2 focus:ring-[var(--brand-teal)]/25"
              autoComplete="off"
            />
            <p className="mt-1.5 text-xs leading-relaxed text-[var(--foreground-muted)]">
              Paste your allowed website as a URL or hostname — we store only the hostname (e.g.{" "}
              <span className="font-mono text-[11px]">https://www.example.com/path</span> →{" "}
              <span className="font-mono text-[11px]">www.example.com</span>). Leave blank to use this page&apos;s hostname
              {pageHost ? ` (${pageHost})` : ""}.
            </p>
          </div>
        ) : null}
        <div className="space-y-3">
          <AnimatePresence>
            {submitting ? (
              <motion.div
                key="creating"
                role="status"
                aria-live="polite"
                aria-busy="true"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{
                  duration: reduceMotion ? 0.15 : 0.28,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-teal-soft)] bg-[var(--brand-teal-subtle)]/30"
              >
                <div className="relative h-2 w-full overflow-hidden bg-slate-200/80">
                  <motion.div
                    className="h-full bg-gradient-to-r from-[var(--brand-teal)] via-teal-300 to-[var(--brand-teal)]"
                    initial={{ width: reduceMotion ? "55%" : "12%" }}
                    animate={
                      reduceMotion
                        ? { width: "55%" }
                        : { width: ["12%", "92%", "55%", "100%"] }
                    }
                    transition={
                      reduceMotion
                        ? { duration: 0.35, ease: [0.22, 1, 0.36, 1] }
                        : { duration: 2.8, ease: "easeInOut", repeat: Infinity }
                    }
                  />
                </div>
                <p className="px-3 py-2.5 text-xs font-medium text-[var(--brand-teal-dark)]">
                  Creating your bot — saving your allowed website…
                </p>
              </motion.div>
            ) : null}
          </AnimatePresence>
          <motion.span
            className="inline-flex w-full sm:w-auto"
            {...(reduceMotion ? {} : { whileTap: { scale: 0.98 } })}
          >
            <Button
              type="submit"
              disabled={submitting || status !== "ready"}
              className={submitting ? undefined : "flow-primary-cta flow-primary-cta-pulse w-full sm:w-auto"}
              aria-busy={submitting}
            >
              {submitting ? "Creating your bot, please wait" : "Create bot"}
            </Button>
          </motion.span>
        </div>
      </form>
      {error ? (
        <div
          className="mt-5 rounded-[var(--radius-lg)] border border-red-200/90 bg-red-50/90 px-3 py-2.5 text-sm text-red-800 shadow-[var(--shadow-xs)]"
          role="alert"
        >
          <p>{error}</p>
          {errorRetryAfter != null ? (
            <p className="mt-2 text-xs font-normal text-red-900/90">
              Suggested wait before retry: ~{errorRetryAfter}s (rate limit per IP as the API sees it).
            </p>
          ) : null}
          {errorHint ? <p className="mt-2 text-xs font-normal text-red-900/90">{errorHint}</p> : null}
        </div>
      ) : null}
    </Card>
  );
}
