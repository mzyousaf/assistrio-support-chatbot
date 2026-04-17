import { DataPageLayout } from '../layout/workspace-layout';

export function UsagePage() {
  return (
    <DataPageLayout
      title="Usage"
      description="Message volume and credits will appear here once metering is connected."
      containerSize="standard"
    >
      <section
        className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-[var(--shadow-card)]"
        aria-labelledby="usage-preview-heading"
      >
        <h2 id="usage-preview-heading" className="mb-2 mt-0 text-base font-semibold tracking-tight text-slate-900">
          Workspace activity
        </h2>
        <p className="m-0 text-[0.875rem] leading-[1.5] text-slate-400">
          When billing and quotas are connected, you&apos;ll see per-assistant usage, limits, and history in this view.
        </p>
      </section>
    </DataPageLayout>
  );
}
