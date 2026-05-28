import { cn } from '@/lib/utils';

function SkeletonBone({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded bg-slate-200/80', className)} aria-hidden />;
}

function PlanPricingCardSkeleton() {
  return (
    <article
      className="relative flex h-full flex-col rounded-2xl border border-slate-200/90 bg-white p-6 shadow-[var(--shadow-card)]"
      aria-hidden
    >
      <SkeletonBone className="absolute right-0 top-0 h-6 w-24 rounded-bl-xl rounded-tr-2xl" />

      <div className="pr-14 text-left">
        <div className="flex min-h-11 items-start gap-3">
          <SkeletonBone className="h-[22px] w-[22px] shrink-0 rounded-md" />
          <SkeletonBone className="h-5 w-24 max-w-full" />
        </div>

        <div className="mt-3 space-y-2">
          <SkeletonBone className="h-8 w-28" />
          <SkeletonBone className="h-3.5 w-36 max-w-full" />
        </div>
      </div>

      <SkeletonBone className="mt-4 h-10 w-full rounded-lg" />

      <div className="mt-6 flex-1 border-t border-slate-100 pt-5">
        <SkeletonBone className="h-3.5 w-16" />
        <ul className="m-0 mt-3 list-none space-y-2.5 p-0">
          {Array.from({ length: 5 }).map((_, index) => (
            <li key={index} className="flex items-start gap-2">
              <SkeletonBone className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded-full" />
              <SkeletonBone className="h-3.5 w-full max-w-[13rem]" />
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}

function PlanComparisonTableSkeleton(props: { featureRows?: number; groupCount?: number }) {
  const featureRows = props.featureRows ?? 4;
  const groupCount = props.groupCount ?? 2;

  return (
    <div
      className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-[var(--shadow-card)]"
      aria-hidden
    >
      <div className="overflow-x-auto overscroll-x-contain">
        <div className="min-w-[520px]">
          <div className="grid grid-cols-4 border-b-2 border-slate-200/80 px-4 py-3">
            <SkeletonBone className="h-4 w-16" />
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="flex justify-center">
                <SkeletonBone className="h-4 w-14" />
              </div>
            ))}
          </div>

          {Array.from({ length: groupCount }).map((_, groupIndex) => (
            <div key={groupIndex}>
              <div className="border-y border-slate-100 bg-slate-50/80 px-5 py-2.5">
                <SkeletonBone className="h-3 w-28" />
              </div>
              {Array.from({ length: featureRows }).map((__, rowIndex) => (
                <div
                  key={rowIndex}
                  className="grid grid-cols-4 items-center gap-2 border-b border-slate-100/80 px-4 py-2.5 last:border-b-0"
                >
                  <SkeletonBone className="h-3.5 w-full max-w-[7.5rem]" />
                  {Array.from({ length: 3 }).map((___, cellIndex) => (
                    <div key={cellIndex} className="flex justify-center">
                      <SkeletonBone className="h-3.5 w-8" />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PlanComparisonSectionSkeleton() {
  return (
    <section className="space-y-3" aria-hidden>
      <div className="mx-auto max-w-2xl space-y-2 text-center">
        <SkeletonBone className="mx-auto h-5 w-52 max-w-full" />
        <SkeletonBone className="mx-auto h-4 w-64 max-w-full" />
      </div>
      <PlanComparisonTableSkeleton />
    </section>
  );
}

function PlanAddonRowSkeleton() {
  return (
    <article
      className="w-full rounded-xl border border-slate-200/90 bg-white p-5 shadow-[var(--shadow-card)]"
      aria-hidden
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <SkeletonBone className="h-9 w-9 shrink-0 rounded-lg" />
          <SkeletonBone className="mt-1 h-4 w-40 max-w-full" />
        </div>
        <SkeletonBone className="h-8 w-52 max-w-full rounded-lg" />
      </div>
      <SkeletonBone className="mt-3 h-4 w-36 max-w-full" />
      <SkeletonBone className="mt-2 h-4 w-full max-w-md" />
      <SkeletonBone className="mt-2 h-4 w-full max-w-sm" />
      <div className="mt-5 flex items-center gap-2.5 border-t border-slate-100 pt-4">
        <SkeletonBone className="h-5 w-9 rounded-full" />
        <SkeletonBone className="h-4 w-16" />
      </div>
    </article>
  );
}

function PlanAddonsSectionSkeleton(props: { rows?: number }) {
  const rows = props.rows ?? 3;

  return (
    <section className="space-y-3 border-t border-slate-200/80 pt-10" aria-hidden>
      <div className="space-y-2">
        <SkeletonBone className="h-5 w-20" />
        <SkeletonBone className="h-4 w-56 max-w-full" />
      </div>
      <div className="flex flex-col gap-3">
        {Array.from({ length: rows }).map((_, index) => (
          <PlanAddonRowSkeleton key={index} />
        ))}
      </div>
    </section>
  );
}

type Props = {
  addonRows?: number;
};

export function PlansPageSkeleton({ addonRows = 3 }: Props) {
  return (
    <div className="flex flex-col gap-10 pb-12" aria-busy="true" aria-label="Loading plans">
      <section aria-hidden>
        <div className="grid gap-5 lg:grid-cols-3 lg:items-stretch">
          {Array.from({ length: 3 }).map((_, index) => (
            <PlanPricingCardSkeleton key={index} />
          ))}
        </div>
      </section>

      <PlanComparisonSectionSkeleton />
      <PlanAddonsSectionSkeleton rows={addonRows} />
    </div>
  );
}
