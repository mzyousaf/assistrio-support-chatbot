"use client";

/**
 * Launch aid: CORS vs embed-domain distinction for customer-site runtime (no redesign — informational only).
 * @see docs/RUNTIME_DEPLOYMENT.md
 */
export function RuntimeDeployCallout({ context }: { context: "trial-snippet" | "showcase" }) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/90 px-4 py-3 text-sm text-[var(--foreground-muted)]">
      <p className="font-medium text-slate-800">Customer-site runtime checklist</p>
      <ul className="mt-2 list-inside list-disc space-y-1.5 text-xs leading-relaxed">
        <li>
          <strong className="text-slate-700">CORS:</strong> The API must allow the{" "}
          <strong className="text-slate-700">exact page origin</strong> (scheme + host + port) in{" "}
          <code className="rounded bg-white px-1 text-[11px]">CORS_EXTRA_ORIGINS</code>. Marketing on{" "}
          <code className="rounded bg-white px-1 text-[11px]">*.assistrio.com</code> is covered by default; arbitrary
          customer domains are not.
        </li>
        <li>
          <strong className="text-slate-700">Embed rules:</strong> The bot must allow this hostname (trial{" "}
          <code className="rounded bg-white px-1 text-[11px]">allowedDomain</code>
          {context === "showcase"
            ? ", showcase allowedDomains, or register-website for your stable id"
            : ""}
          ). This is separate from CORS.
        </li>
        <li>
          If the chat never loads and DevTools shows a <strong className="text-slate-700">CORS</strong> error, the
          request never reached init — fix origins on the API first. If you get an HTTP <strong className="text-slate-700">403</strong>{" "}
          with JSON, read <code className="rounded bg-white px-1 text-[11px]">errorCode</code> and{" "}
          <code className="rounded bg-white px-1 text-[11px]">deploymentHint</code> from the API.
        </li>
      </ul>
      {origin ? (
        <p className="mt-3 border-t border-slate-200/80 pt-3 text-xs">
          This page&apos;s origin (for CORS allowlisting):{" "}
          <code className="break-all rounded bg-white px-1 font-mono text-[11px] text-slate-800">{origin}</code>
        </p>
      ) : null}
    </div>
  );
}
