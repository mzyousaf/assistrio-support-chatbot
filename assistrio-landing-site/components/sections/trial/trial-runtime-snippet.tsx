"use client";

import { useMemo } from "react";
import { buildTrialRuntimeEmbedSnippet } from "@/lib/trial/build-trial-runtime-snippet";
import { getAssistrioWidgetCdnUrls } from "@/lib/widget/cdn-urls";
import { tryGetPublicApiBaseUrl } from "@/lib/utils/env";
import { CopyCodeBlock } from "@/components/ui/copy-code-block";
import { RuntimeDeployCallout } from "@/components/visitor/runtime-deploy-callout";
import type { TrialCreateResponse } from "@/types/api";

type Props = {
  trial: TrialCreateResponse;
};

/**
 * Copyable **runtime** embed only — loads CDN CSS/JS and sets `AssistrioChatConfig` with `mode: "runtime"`.
 * Host page must be served on the **allowed domain** you configured; the widget sends `embedOrigin` automatically.
 */
export function TrialRuntimeSnippet({ trial }: Props) {
  const snippet = useMemo(() => {
    const api = tryGetPublicApiBaseUrl();
    if (!api) return null;
    const { js, css } = getAssistrioWidgetCdnUrls();
    return buildTrialRuntimeEmbedSnippet({
      cssUrl: css,
      jsUrl: js,
      apiBaseUrl: api,
      botId: trial.bot.id,
      accessKey: trial.bot.accessKey,
      platformVisitorId: trial.platformVisitorId,
    });
  }, [trial]);

  if (!snippet) {
    return (
      <div className="rounded-[var(--radius-xl)] border border-amber-200/90 bg-amber-50/90 px-4 py-3 text-sm text-amber-950 shadow-[var(--shadow-xs)]">
        Set <code className="rounded bg-white px-1">NEXT_PUBLIC_ASSISTRIO_API_BASE_URL</code> to generate a snippet with
        your API origin.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-[var(--radius-lg)] border border-[var(--border-teal-soft)] bg-[var(--brand-teal-subtle)]/35 px-3 py-2.5 text-xs leading-relaxed text-[var(--foreground-muted)]">
        <strong className="font-medium text-slate-800">Snippet vs this browser:</strong> The HTML below sets{" "}
        <code className="rounded bg-white px-1">platformVisitorId</code> inside{" "}
        <code className="rounded bg-white px-1">AssistrioChatConfig</code>. Your <strong className="font-medium text-slate-800">live site</strong>{" "}
        will use that value for init — it does not read this landing page&apos;s saved id. If you reconnect on the
        marketing site with a <em>different</em> id, quota/trial UI here may not match the id embedded on your site until
        you align them or update the snippet.
      </div>
      <p className="text-sm leading-relaxed text-[var(--foreground-muted)]">
        Place near the end of <code className="rounded bg-slate-100 px-1 text-xs">&lt;body&gt;</code> on pages served at a
        URL whose <strong className="font-medium text-slate-800">hostname</strong> matches your trial allowlist (saved as{" "}
        <strong className="font-medium text-slate-800">{trial.allowedDomain}</strong>). The browser sends{" "}
        <code className="rounded bg-slate-100 px-1 text-xs">Origin: &lt;full origin&gt;</code> on init —{" "}
        <strong className="font-medium text-slate-800">scheme, host, and port</strong> must match how users reach the
        page (e.g. <code className="rounded bg-slate-100 px-1 text-xs">https</code> vs <code className="rounded bg-slate-100 px-1 text-xs">http</code>, or{" "}
        <code className="rounded bg-slate-100 px-1 text-xs">:3000</code>).
      </p>
      <CopyCodeBlock label="Runtime embed (HTML)" code={snippet} />
      <div className="rounded-[var(--radius-xl)] border border-[var(--border-default)] bg-white px-4 py-3 text-xs leading-relaxed text-[var(--foreground-muted)] shadow-[var(--shadow-xs)]">
        <p className="font-medium text-slate-800">After you paste and deploy</p>
        <ol className="mt-2 list-inside list-decimal space-y-1.5">
          <li>
            Reuse the <strong className="font-medium text-slate-700">same</strong>{" "}
            <code className="rounded bg-slate-100 px-1">platformVisitorId</code> everywhere you want the same trial
            ownership and quota (copy from this page or reconnect on another device).
          </li>
          <li>
            On the API, add your site&apos;s <strong className="font-medium text-slate-700">exact</strong> page origin to{" "}
            <code className="rounded bg-slate-100 px-1">CORS_EXTRA_ORIGINS</code> if the site is not on{" "}
            <code className="rounded bg-slate-100 px-1">*.assistrio.com</code>.
          </li>
          <li>
            Open the live page, hard-refresh, and confirm <code className="rounded bg-slate-100 px-1">/api/widget/init</code> in
            Network — CORS failure (no JSON) vs 403 with <code className="rounded bg-slate-100 px-1">errorCode</code>.
          </li>
        </ol>
      </div>
      <p className="text-xs text-[var(--foreground-muted)]">
        <strong className="font-medium text-slate-700">Not preview:</strong> this snippet is <strong className="font-medium text-slate-700">runtime</strong> only.{" "}
        <strong className="font-medium text-slate-700">Not in HTML:</strong>{" "}
        <code className="rounded bg-slate-100 px-1">secretKey</code> or{" "}
        <code className="rounded bg-slate-100 px-1">chatVisitorId</code> — the widget creates chat sessions locally.
      </p>
      <div className="mt-2">
        <RuntimeDeployCallout context="trial-snippet" />
      </div>
    </div>
  );
}
