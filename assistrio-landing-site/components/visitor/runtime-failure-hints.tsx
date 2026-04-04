"use client";

import { RUNTIME_FAILURE_LAYERS } from "@/lib/embed/runtime-failure-layers";

type Props = {
  /** "compact" = short intro + link-style bullets; "full" = table-like list */
  variant?: "compact" | "full";
};

/**
 * Read-only triage list: CORS vs CDN vs API body — no network probes.
 */
export function RuntimeFailureHints({ variant = "compact" }: Props) {
  if (variant === "compact") {
    return (
      <div className="mt-3 rounded-lg border border-slate-200/90 bg-slate-50/80 px-3 py-2.5 text-xs leading-relaxed text-[var(--foreground-muted)]">
        <p className="font-medium text-slate-800">If chat still does not load</p>
        <ul className="mt-2 list-inside list-disc space-y-1.5">
          <li>
            <strong className="text-slate-700">CORS:</strong> DevTools shows a CORS error and <strong>no</strong> JSON from
            the API → add this page&apos;s origin to <code className="rounded bg-white px-1">CORS_EXTRA_ORIGINS</code>.
          </li>
          <li>
            <strong className="text-slate-700">Domain / allowlist:</strong> Init returns <strong>403</strong> with{" "}
            <code className="rounded bg-white px-1">errorCode</code> → fix allowedDomains / registered URL / trial hostname
            (see widget error text and <code className="rounded bg-white px-1">deploymentHint</code>).
          </li>
          <li>
            <strong className="text-slate-700">Script:</strong> JS/CSS request failed → CDN or env URL issue, not init.
          </li>
          <li>
            <strong className="text-slate-700">Rate limit:</strong> HTTP <strong>429</strong> with JSON (often{" "}
            <code className="rounded bg-white px-1">RATE_LIMITED</code>) — wait and retry; not a CORS failure. Behind a
            proxy, TRUST_PROXY must be set so limits are per real client IP.
          </li>
        </ul>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200/90 bg-slate-50/80 px-3 py-3 text-xs leading-relaxed text-[var(--foreground-muted)]">
      <p className="font-medium text-slate-800">Which layer failed?</p>
      <ul className="mt-2 space-y-2">
        {RUNTIME_FAILURE_LAYERS.map((layer) => (
          <li key={layer.id}>
            <span className="font-medium uppercase tracking-wide text-slate-600">{layer.id}</span> — {layer.symptom}{" "}
            <span className="text-slate-600">→ {layer.fixHint}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
