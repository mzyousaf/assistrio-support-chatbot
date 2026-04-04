"use client";

import { useEffect, useState } from "react";
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
};

export function TrialForm({ onTrialCreated, onTrialHandoffLost }: TrialFormProps) {
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
    const allowedDomain = hostname.trim() || (typeof window !== "undefined" ? window.location.hostname : "");
    if (!allowedDomain) {
      setError("Enter your website or hostname where the widget will run.");
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
    return <TrialSuccessPanel trial={success} />;
  }

  return (
    <Card className="border-[var(--border-teal-soft)] bg-gradient-to-b from-white to-slate-50/40 ring-1 ring-[var(--brand-teal)]/8">
      {queryParamRejected ? (
        <p className="mb-5 rounded-[var(--radius-lg)] border border-amber-200/90 bg-amber-50/80 px-3 py-2.5 text-sm text-amber-950 shadow-[var(--shadow-xs)]">
          The <code className="rounded bg-white px-1 text-xs">platformVisitorId</code> in the URL was not valid — this
          browser generated a new id. Paste a saved id under{" "}
          <a href="#reconnect" className="font-medium text-amber-950 underline decoration-amber-900/30 underline-offset-2">
            Identity &amp; reconnect
          </a>{" "}
          to align with your previous trial or demos.
        </p>
      ) : null}
      <p className="text-eyebrow">Create</p>
      <h3 className="mt-2 font-[family-name:var(--font-display)] text-xl font-semibold text-slate-900">Trial bot &amp; website</h3>
      <p className="mt-2 text-sm leading-relaxed text-[var(--foreground-muted)]">
        Ownership attaches to the <strong className="font-medium text-slate-800">stable id</strong> shown above. Runtime
        chat is allowed only on the hostname we store from your URL or hostname; owner preview stays in Assistrio UIs —
        not on your public site from this snippet.
      </p>
      <div className="mt-4 rounded-[var(--radius-lg)] border border-slate-200/90 bg-slate-50/80 px-3 py-2.5 text-xs leading-relaxed text-[var(--foreground-muted)]">
        <strong className="font-medium text-slate-700">Preview vs runtime:</strong> this form only configures{" "}
        <strong className="font-medium text-slate-800">runtime</strong> allowlisting for your trial bot. Draft preview
        remains inside Assistrio product surfaces.
      </div>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="allowedDomain" className="block text-sm font-medium text-slate-800">
            Website or base URL
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
          <p className="mt-1.5 text-xs text-[var(--foreground-muted)]">
            Paste your site URL or hostname — we store only the hostname (e.g.{" "}
            <span className="font-mono text-[11px]">https://www.example.com/path</span> →{" "}
            <span className="font-mono text-[11px]">www.example.com</span>). Leave blank to use this page&apos;s hostname
            {pageHost ? ` (${pageHost})` : ""}.
          </p>
        </div>
        <Button type="submit" disabled={submitting || status !== "ready"}>
          {submitting ? "Creating…" : "Create trial bot"}
        </Button>
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
