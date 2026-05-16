/**
 * Illustrative dashboard UI — fallback when no screenshot asset is configured or load fails.
 */
export function HomeDashboardMock() {
  return (
    <div className="grid gap-0 lg:grid-cols-[11rem_minmax(0,1fr)]">
      <div className="hidden border-r border-[var(--border-default)] bg-white/90 p-4 lg:block">
        <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-400">Workspace</p>
        <ul className="mt-3 space-y-1 text-sm text-slate-600">
          <li className="rounded-md bg-[var(--brand-teal-subtle)]/60 px-2 py-1.5 font-medium text-[var(--brand-teal-dark)]">
            AI Agents
          </li>
          <li className="rounded-md px-2 py-1.5">Knowledge</li>
          <li className="rounded-md px-2 py-1.5">Preview</li>
          <li className="rounded-md px-2 py-1.5">Analytics</li>
          <li className="rounded-md px-2 py-1.5">Settings</li>
        </ul>
      </div>
      <div className="bg-gradient-to-br from-white to-slate-50/90 p-5 sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-slate-900">AI Support Agent · Production</p>
            <p className="mt-1 text-xs text-[var(--foreground-muted)]">Published · last edit 2h ago · preview draft saved</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-[var(--border-default)] bg-white px-3 py-1 text-xs font-medium text-slate-600">
              Preview
            </span>
            <span className="rounded-full bg-[var(--brand-teal)] px-3 py-1 text-xs font-semibold text-white shadow-sm">
              Live
            </span>
          </div>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            { label: "Grounded replies", value: "24h", hint: "Widget sessions" },
            { label: "Sources synced", value: "12", hint: "Docs & URLs" },
            { label: "Escalations", value: "Low", hint: "Policy-based" },
          ].map((m) => (
            <div
              key={m.label}
              className="rounded-[var(--radius-lg)] border border-white/80 bg-white/95 p-4 shadow-[0_8px_24px_-6px_rgba(15,23,42,0.08),0_2px_6px_-2px_rgba(13,148,136,0.06)] ring-1 ring-slate-900/[0.04]"
            >
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{m.label}</p>
              <p className="mt-2 font-[family-name:var(--font-display)] text-2xl font-semibold text-slate-900">{m.value}</p>
              <p className="mt-1 text-xs text-[var(--foreground-muted)]">{m.hint}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 rounded-[var(--radius-lg)] border border-dashed border-[var(--border-default)] bg-slate-50/80 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Activity</p>
          <ul className="mt-3 space-y-2.5 text-sm text-[var(--foreground-muted)]">
            <li className="flex justify-between gap-4 border-b border-slate-100/80 pb-2">
              <span>Knowledge sync</span>
              <span className="shrink-0 rounded bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">Complete</span>
            </li>
            <li className="flex justify-between gap-4 border-b border-slate-100/80 pb-2">
              <span>Preview session</span>
              <span className="shrink-0 text-slate-400">Assistrio host</span>
            </li>
            <li className="flex justify-between gap-4">
              <span>Runtime embed</span>
              <span className="shrink-0 font-medium text-[var(--brand-teal-dark)]">Customer origin</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
