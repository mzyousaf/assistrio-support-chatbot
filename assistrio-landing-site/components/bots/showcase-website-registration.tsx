"use client";

import { useEffect, useState } from "react";
import { usePlatformVisitorId } from "@/hooks/usePlatformVisitorId";
import { registerShowcaseWebsite } from "@/lib/api/website";
import { tryGetPublicApiBaseUrl } from "@/lib/utils/env";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AssistrioApiError } from "@/types/api";

type Props = {
  botId: string;
  accessKey: string;
};

/**
 * `POST /api/widget/register-website` — ties your **hostname** (from pasted URL or hostname) to your current
 * `platformVisitorId` for this showcase bot so the embed may run there. It does **not** verify DNS ownership; it
 * records intent for the backend allowlist. **Quota and ownership** still follow `platformVisitorId`, not the hostname
 * alone.
 */
export function ShowcaseWebsiteRegistration({ botId, accessKey }: Props) {
  const { platformVisitorId, status } = usePlatformVisitorId();
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  /** Normalized hostname returned by the API (stored value). */
  const [registeredHostname, setRegisteredHostname] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorHint, setErrorHint] = useState<string | null>(null);
  const [errorRetryAfter, setErrorRetryAfter] = useState<number | null>(null);
  const [apiOk, setApiOk] = useState<boolean | null>(null);

  useEffect(() => {
    setApiOk(!!tryGetPublicApiBaseUrl());
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setErrorHint(null);
    setErrorRetryAfter(null);
    if (!platformVisitorId || status !== "ready") {
      setError("Stable identity not ready yet.");
      return;
    }
    const websiteUrl = url.trim();
    if (!websiteUrl) {
      setError("Enter your website or base URL.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await registerShowcaseWebsite({
        botId,
        accessKey,
        platformVisitorId,
        websiteUrl,
      });
      const stored =
        res.platformVisitorWebsiteAllowlist?.find((e) => e.platformVisitorId === platformVisitorId)?.websiteUrl ?? null;
      setRegisteredHostname(stored);
      setSuccess(true);
    } catch (err) {
      if (err instanceof AssistrioApiError) {
        setError(err.message + (err.errorCode ? ` (${err.errorCode})` : ""));
        setErrorHint(err.deploymentHint ?? null);
        setErrorRetryAfter(
          err.status === 429 && err.retryAfterSeconds != null ? err.retryAfterSeconds : null,
        );
      } else {
        setError(err instanceof Error ? err.message : "Registration failed");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (apiOk === null) {
    return (
      <Card className="animate-pulse border-slate-200">
        <div className="h-24 rounded-lg bg-slate-100" />
      </Card>
    );
  }

  if (!apiOk) {
    return (
      <Card className="border-slate-200">
        <p className="text-sm text-[var(--foreground-muted)]">
          Configure <code className="rounded bg-slate-100 px-1 text-xs">NEXT_PUBLIC_ASSISTRIO_API_BASE_URL</code> to
          register a website for embed.
        </p>
      </Card>
    );
  }

  if (success) {
    return (
      <Card className="border-emerald-200/80 bg-emerald-50/50">
        <p className="text-sm font-semibold text-emerald-900">Website registered</p>
        <p className="mt-2 text-sm leading-relaxed text-emerald-950/90">
          The backend stored this <strong className="font-medium text-emerald-950">hostname + your stable id</strong> so
          embed init can match your page&apos;s hostname to the allowlist. This does{" "}
          <strong className="font-medium">not</strong> verify DNS or prove you own the website — it only records intent
          for authorization.
        </p>
        {registeredHostname ? (
          <p className="mt-2 text-xs text-emerald-950/85">
            Stored hostname: <code className="break-all rounded bg-white/90 px-1 font-mono">{registeredHostname}</code>
          </p>
        ) : null}
        <div className="mt-4 border-t border-emerald-200/80 pt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-900">Next steps</p>
          <ol className="mt-2 list-inside list-decimal space-y-2 text-sm text-emerald-950/90">
            <li>
              On the API deployment, ensure <code className="rounded bg-white px-1 text-[11px]">CORS_EXTRA_ORIGINS</code>{" "}
              includes the <strong className="font-medium">exact</strong> origin where the widget runs (scheme + host +
              port your browser sends). Without this, the browser blocks the request before init — no JSON error body.
            </li>
            <li>
              Open your site on that origin (any path), hard-refresh, and load the widget. The page{" "}
              <strong className="font-medium">hostname</strong> must match{" "}
              {registeredHostname ? (
                <code className="rounded bg-white px-1 text-[11px]">{registeredHostname}</code>
              ) : (
                "the hostname you registered"
              )}{" "}
              for this <code className="rounded bg-white px-1 text-[11px]">platformVisitorId</code>.
            </li>
            <li>
              If the launcher still errors: check DevTools → Network for <code className="rounded bg-white px-1 text-[11px]">/api/widget/init</code> — CORS
              (blocked, no JSON) vs 403 with <code className="rounded bg-white px-1 text-[11px]">errorCode</code> /{" "}
              <code className="rounded bg-white px-1 text-[11px]">deploymentHint</code>. See{" "}
              <code className="rounded bg-white px-1 text-[11px]">docs/RUNTIME_DEPLOYMENT.md</code> in the repo.
            </li>
          </ol>
        </div>
        <p className="mt-3 text-xs text-emerald-950/80">
          If init still returns <code className="rounded bg-white px-1">PLATFORM_VISITOR_WEBSITE_ORIGIN_MISMATCH</code>, the
          page hostname does not match the stored hostname — adjust registration or fix which site loads the widget.
        </p>
      </Card>
    );
  }

  return (
    <Card className="border-[var(--border-default)] bg-gradient-to-b from-white to-slate-50/40">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Register for embed</p>
      <h3 className="mt-1 font-[family-name:var(--font-display)] text-lg font-semibold text-slate-900">
        Website or base URL
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-[var(--foreground-muted)]">
        Use this when the widget should run on <strong className="font-medium text-slate-800">your</strong> site (not only
        Assistrio demo hosts). Paste a <strong className="font-medium text-slate-800">URL or hostname</strong> — we store
        only the hostname. We record <code className="rounded bg-slate-100 px-1 text-xs">platformVisitorId</code> + that
        hostname so init can tie <strong className="font-medium text-slate-800">this visitor</strong> to{" "}
        <strong className="font-medium text-slate-800">this host</strong>. CORS on the API must still allow your page
        origin separately.
      </p>
      <form onSubmit={onSubmit} className="mt-5 space-y-3">
        <div>
          <label htmlFor="websiteUrl" className="block text-sm font-medium text-slate-800">
            Website or base URL
          </label>
          <input
            id="websiteUrl"
            name="websiteUrl"
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.example.com/support or www.example.com"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-[var(--brand-teal)] focus:ring-2"
            autoComplete="off"
          />
        </div>
        <Button type="submit" disabled={submitting || status !== "ready"}>
          {submitting ? "Registering…" : "Register for my stable id"}
        </Button>
      </form>
      {error ? (
        <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          <p>{error}</p>
          {errorRetryAfter != null ? (
            <p className="mt-2 text-xs font-normal text-red-900/90">
              Suggested wait before retry: ~{errorRetryAfter}s.
            </p>
          ) : null}
          {errorHint ? <p className="mt-2 text-xs font-normal text-red-900/90">{errorHint}</p> : null}
        </div>
      ) : null}
    </Card>
  );
}
