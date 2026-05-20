import { cn } from '@/lib/utils';
import { cardClass } from './knowledgeViewTypes';
import { ws as styles } from '../workspace';

function PulseBar({ className }: { className?: string }) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-slate-200/75', className)}
      aria-hidden
    />
  );
}

/** Matches Overview layout: auto-train card + two-column grid + reply-priority card. */
export function KnowledgeOverviewSkeleton() {
  const shellCard = cn(cardClass, 'rounded-xl border-slate-200/80');
  return (
    <div
      className={cn(styles.workspaceEditorCardGap, 'min-h-0 w-full min-w-0 flex-1')}
      aria-busy
      aria-label="Loading overview"
    >
      <section className={cn(shellCard, 'p-5 sm:p-6')}>
        <div className="flex gap-3">
          <PulseBar className="h-10 w-10 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <PulseBar className="h-5 w-36" />
              <PulseBar className="h-7 w-24 rounded-full" />
            </div>
            <PulseBar className="h-4 w-full max-w-xl" />
            <PulseBar className="h-4 w-full max-w-lg" />
          </div>
        </div>
        <div className="mt-5 border-t border-slate-100 pt-5">
          <PulseBar className="h-4 w-28" />
          <PulseBar className="mt-2 h-6 w-56" />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:items-stretch">
        <section className={cn(shellCard, 'flex min-h-[14rem] flex-col')}>
          <div className="border-b border-slate-100 p-5 sm:p-6">
            <div className="flex gap-3">
              <PulseBar className="h-10 w-10 shrink-0 rounded-xl" />
              <div className="min-w-0 flex-1 space-y-2">
                <PulseBar className="h-5 w-40" />
                <PulseBar className="h-3.5 w-full max-w-sm" />
              </div>
            </div>
          </div>
          <div className="flex flex-1 flex-col divide-y divide-slate-100 p-0">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center justify-between gap-4 px-5 py-3.5 sm:px-6">
                <PulseBar className="h-4 w-32" />
                <PulseBar className="h-5 w-16" />
              </div>
            ))}
          </div>
        </section>

        <section className={cn(shellCard, 'flex min-h-[14rem] flex-col p-5 sm:p-6')}>
          <div className="flex gap-3">
            <PulseBar className="h-10 w-10 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1 space-y-2">
              <PulseBar className="h-5 w-44" />
              <PulseBar className="h-3.5 w-full max-w-md" />
            </div>
          </div>
          <div className="mt-6 space-y-4">
            <PulseBar className="h-3 w-full" />
            <PulseBar className="h-10 w-full rounded-lg" />
            <PulseBar className="h-2.5 w-full rounded-full" />
          </div>
        </section>
      </div>

      <section className={cn(shellCard, 'p-5 sm:p-6')}>
        <div className="min-w-0 flex-1 space-y-2">
          <PulseBar className="h-5 w-44" />
          <PulseBar className="h-3.5 w-full max-w-xl" />
        </div>
        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-2xl border border-slate-200 bg-white p-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                  <PulseBar className="h-4 w-32" />
                  <PulseBar className="h-4 w-20 rounded-md" />
                </div>
                <PulseBar className="h-2.5 w-2.5 rounded-full" />
              </div>
              <PulseBar className="mt-3 h-3.5 w-full max-w-sm" />
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-2xl border border-slate-200/90 bg-slate-50/40 p-3 sm:p-4">
          <div className="space-y-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5"
              >
                <PulseBar className="h-4 w-44" />
                <PulseBar className="h-4 w-full max-w-xs" />
                <PulseBar className="ml-auto h-7 w-7 rounded-md" />
              </div>
            ))}
          </div>
          <PulseBar className="mt-3 h-8 w-36 rounded-md" />
        </div>
      </section>
    </div>
  );
}

/** Table-shaped skeleton inside the documents card (filters + grid columns). */
export function KnowledgeDocumentsTableSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <div className="w-full min-w-0" aria-busy aria-label="Loading documents">
      <div className="border-b border-slate-100 px-4 py-3 sm:px-5">
        <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            <PulseBar className="h-9 w-[7.5rem] rounded-full" />
            <PulseBar className="h-9 w-[8.25rem] rounded-full" />
            <PulseBar className="h-9 w-[7rem] rounded-full" />
          </div>
          <PulseBar className="h-10 w-full max-w-md rounded-lg lg:w-80" />
        </div>
      </div>
      <div className="overflow-x-auto">
        <div className="w-full min-w-[56rem] border-collapse py-3">
          <div className="flex border-b border-slate-200 bg-slate-50/80 py-2.5 pl-4 pr-2 sm:pl-5 sm:pr-3">
            <PulseBar className="mr-2 h-4 w-4 shrink-0 rounded" />
            <PulseBar className="h-4 flex-1 max-w-[28%]" />
            <PulseBar className="mx-4 h-4 w-28" />
            <PulseBar className="h-4 w-24" />
            <PulseBar className="mx-4 h-4 w-20" />
            <PulseBar className="h-4 w-36" />
          </div>
          {Array.from({ length: rows }, (_, i) => (
            <div
              key={i}
              className="flex items-center gap-2 border-b border-slate-100 py-3 pl-4 pr-2 sm:pl-5 sm:pr-3"
            >
              <PulseBar className="h-4 w-4 shrink-0 rounded" />
              <PulseBar className="h-4 flex-1 max-w-[30%]" />
              <PulseBar className="h-6 w-24 rounded-full" />
              <PulseBar className="h-4 w-16" />
              <PulseBar className="h-7 w-14 shrink-0 rounded-md" />
              <PulseBar className="h-6 w-28 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
