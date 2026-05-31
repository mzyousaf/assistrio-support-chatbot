import { cn } from '@/lib/utils';

function SkeletonBone({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded bg-slate-200/80', className)} aria-hidden />;
}

function UsageMetricCardSkeleton(props: {
  titleWidth?: string;
  withBadge?: boolean;
  withHelper?: boolean;
}) {
  return (
    <article className="flex h-full flex-col rounded-xl border border-slate-200/90 bg-white shadow-[var(--shadow-card)]">
      <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <SkeletonBone className="h-8 w-8 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <SkeletonBone className={cn('h-3.5', props.titleWidth ?? 'w-28')} />
              {props.withBadge ? <SkeletonBone className="h-3.5 w-12 rounded-full" /> : null}
            </div>
            <SkeletonBone className="h-3 w-36 max-w-full" />
            {props.withHelper ? <SkeletonBone className="h-3 w-52 max-w-full" /> : null}
          </div>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-2">
            <SkeletonBone className="h-7 w-16" />
            <SkeletonBone className="h-2.5 w-24 max-w-full" />
          </div>
          <SkeletonBone className="h-12 w-12 shrink-0 rounded-full" />
        </div>
      </div>
    </article>
  );
}

function UsageSectionHeaderSkeleton(props: { withHeaderAction?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
      <div className="min-w-0 flex-1 space-y-2">
        <SkeletonBone className="h-4 w-28" />
        <SkeletonBone className="h-3 w-52 max-w-full" />
      </div>
      {props.withHeaderAction ? (
        <SkeletonBone className="h-7 w-[8.5rem] shrink-0 rounded-full" />
      ) : null}
    </div>
  );
}

function UsageTrendSectionSkeleton() {
  return (
    <section
      className="flex flex-col rounded-xl border border-slate-200/90 bg-white shadow-[var(--shadow-card)]"
      aria-hidden
      data-testid="usage-trend-skeleton"
    >
      <UsageSectionHeaderSkeleton withHeaderAction />
      <div className="px-5 py-4">
        <SkeletonBone className="h-[280px] w-full rounded-lg sm:h-[300px]" />
      </div>
    </section>
  );
}

function UsageAgentCreditsPanelSkeleton() {
  return (
    <section
      className="flex h-full flex-col rounded-xl border border-slate-200/90 bg-white shadow-[var(--shadow-card)]"
      aria-hidden
      data-testid="usage-agent-credits-skeleton"
    >
      <UsageSectionHeaderSkeleton />
      <div className="relative flex min-h-[280px] flex-1 items-center justify-center px-5 py-4 sm:min-h-[300px]">
        <div className="absolute right-5 top-4 space-y-1.5 sm:max-w-[42%]">
          <SkeletonBone className="h-3 w-28" />
          <SkeletonBone className="h-2.5 w-16" />
        </div>
        <SkeletonBone className="h-[240px] w-[240px] shrink-0 rounded-full sm:h-[260px] sm:w-[260px]" />
      </div>
    </section>
  );
}

function UsageKnowledgeRowSkeleton() {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <SkeletonBone className="h-8 w-8 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <SkeletonBone className="h-3.5 w-28 max-w-full" />
          <SkeletonBone className="h-3 w-8 shrink-0" />
        </div>
        <SkeletonBone className="h-3 w-36 max-w-full" />
        <SkeletonBone className="h-1.5 w-full rounded-full" />
      </div>
    </div>
  );
}

function UsageKnowledgePanelSkeleton(props: { rows?: number }) {
  const rows = props.rows ?? 2;
  return (
    <section
      className="flex h-full flex-col rounded-xl border border-slate-200/90 bg-white shadow-[var(--shadow-card)]"
      aria-hidden
      data-testid="usage-knowledge-skeleton"
    >
      <UsageSectionHeaderSkeleton />
      <div className="divide-y divide-slate-100 px-5 py-2">
        {Array.from({ length: rows }).map((_, index) => (
          <UsageKnowledgeRowSkeleton key={index} />
        ))}
      </div>
    </section>
  );
}

function UsageAddonCardSkeleton() {
  return (
    <article
      className="w-full rounded-xl border border-slate-200/90 bg-white p-5 shadow-[var(--shadow-card)]"
      aria-hidden
    >
      <div className="flex min-w-0 items-start gap-3">
        <SkeletonBone className="h-9 w-9 shrink-0 rounded-lg" />
        <SkeletonBone className="mt-1 h-4 w-40 max-w-full" />
      </div>
      <SkeletonBone className="mt-4 h-4 w-48 max-w-full" />
      <SkeletonBone className="mt-3 h-4 w-28" />
      <SkeletonBone className="mt-2 h-4 w-full max-w-md" />
    </article>
  );
}

function UsageAddonsSectionSkeleton({ rows = 2 }: { rows?: number }) {
  return (
    <section className="space-y-3" aria-hidden data-testid="usage-addons-skeleton">
      <div className="space-y-2">
        <SkeletonBone className="h-4 w-32" />
        <SkeletonBone className="h-3 w-56 max-w-full" />
      </div>
      <div className="flex flex-col gap-3">
        {Array.from({ length: rows }).map((_, index) => (
          <UsageAddonCardSkeleton key={index} />
        ))}
      </div>
    </section>
  );
}

type Props = {
  /** When true, includes a Top-up credits metric card skeleton (4 cards total). */
  showTopUpMetricCard?: boolean;
  addonRows?: number;
  knowledgeRows?: number;
};

export function UsagePageSkeleton({
  showTopUpMetricCard = false,
  addonRows = 2,
  knowledgeRows = 2,
}: Props) {
  const metricGridClass = showTopUpMetricCard
    ? 'grid gap-4 sm:grid-cols-2 xl:grid-cols-4'
    : 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3';

  return (
    <div className="flex flex-col gap-6 pb-12" aria-busy="true" aria-label="Loading usage">
      <section aria-hidden data-testid="usage-metric-cards-skeleton">
        <div className={metricGridClass}>
          <UsageMetricCardSkeleton titleWidth="w-32" withHelper />
          {showTopUpMetricCard ? (
            <UsageMetricCardSkeleton titleWidth="w-24" withBadge />
          ) : null}
          <UsageMetricCardSkeleton titleWidth="w-16" />
          <UsageMetricCardSkeleton titleWidth="w-20" />
        </div>
      </section>

      <UsageTrendSectionSkeleton />

      <div
        className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-stretch"
        data-testid="usage-agent-usage-row-skeleton"
      >
        <UsageAgentCreditsPanelSkeleton />
        <UsageKnowledgePanelSkeleton rows={knowledgeRows} />
      </div>

      <UsageAddonsSectionSkeleton rows={addonRows} />
    </div>
  );
}
