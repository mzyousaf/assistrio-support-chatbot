"use client";

/**
 * Launch aid: CORS vs embed allowed-website rules for customer-site runtime (informational).
 * @see docs/RUNTIME_DEPLOYMENT.md
 */
export function RuntimeDeployCallout() {
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/90 px-4 py-3 text-sm text-[var(--foreground-muted)]">
      <p className="font-medium text-slate-800">Customer-site runtime checklist</p>
      <ul className="mt-2 list-inside list-disc space-y-1.5 text-xs leading-relaxed">
        <li>
          <strong className="text-slate-700">CORS:</strong> Runtime browser routes (e.g.{" "}
          <code className="rounded bg-white px-1 text-[11px]">/api/widget/init</code>,{" "}
          <code className="rounded bg-white px-1 text-[11px]">/api/chat/*</code>) reflect a valid HTTPS{" "}
          <code className="rounded bg-white px-1 text-[11px]">Origin</code> automatically. Strict routes (preview, gallery
          listing, app APIs) only allow <code className="rounded bg-white px-1 text-[11px]">assistrio.com</code> /{" "}
          <code className="rounded bg-white px-1 text-[11px]">*.assistrio.com</code> in production (loopback in dev). See{" "}
          <code className="rounded bg-white px-1 text-[11px]">ai-platform-backend/docs/CORS.md</code>.
        </li>
        <li>
          <strong className="text-slate-700">Embed rules:</strong> This page&apos;s origin must exactly match an{" "}
          <strong className="text-slate-700">active</strong> allowed origin on the AI Agent (
          <code className="rounded bg-white px-1 text-[11px]">allowedOrigins</code> in the product). Separate from CORS.
        </li>
        <li>
          If the chat never loads and DevTools shows a <strong className="text-slate-700">CORS</strong> error, the
          request never reached init — check HTTPS, path class (see CORS doc), and proxies forwarding{" "}
          <code className="rounded bg-white px-1 text-[11px]">Origin</code>. If you get an HTTP{" "}
          <strong className="text-slate-700">403</strong>{" "}
          with JSON, read <code className="rounded bg-white px-1 text-[11px]">errorCode</code> and{" "}
          <code className="rounded bg-white px-1 text-[11px]">deploymentHint</code> from the API.
        </li>
      </ul>
      {origin ? (
        <p className="mt-3 border-t border-slate-200/80 pt-3 text-xs">
          This page&apos;s origin (for debugging CORS / embed rules):{" "}
          <code className="break-all rounded bg-white px-1 font-mono text-[11px] text-slate-800">{origin}</code>
        </p>
      ) : null}
    </div>
  );
}
