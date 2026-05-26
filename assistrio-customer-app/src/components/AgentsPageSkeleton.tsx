import { cn } from '@/lib/utils';

function SkeletonBone({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded bg-slate-200/80', className)} aria-hidden />;
}

function AgentCardSkeleton() {
  return (
    <article
      className="flex h-full flex-col rounded-2xl bg-white shadow-[var(--shadow-card)]"
      style={{ border: '1px solid var(--border-soft)' }}
      aria-hidden
    >
      <div className="flex items-start gap-3 px-4 pb-0 pt-4">
        <SkeletonBone className="h-10 w-10 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1 space-y-2">
          <SkeletonBone className="h-3.5 w-32 max-w-full" />
          <SkeletonBone className="h-3 w-24 max-w-full" />
        </div>
        <SkeletonBone className="mt-0.5 h-5 w-14 shrink-0 rounded-full" />
        <SkeletonBone className="h-7 w-7 shrink-0 rounded-md" />
      </div>

      <div className="flex flex-wrap gap-1.5 px-4 pt-3">
        <SkeletonBone className="h-5 w-16 rounded-md" />
        <SkeletonBone className="h-5 w-20 rounded-md" />
      </div>

      <div className="flex-1 px-4 pb-3 pt-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <SkeletonBone className="h-3 w-10" />
          <SkeletonBone className="h-3 w-10" />
          <SkeletonBone className="h-3 w-16" />
        </div>
        <div className="mt-2 flex flex-wrap gap-3">
          <SkeletonBone className="h-3 w-20" />
          <SkeletonBone className="h-3 w-24" />
        </div>
      </div>

      <div className="flex items-center border-t border-slate-100 px-4 py-2">
        <SkeletonBone className="h-3 w-28" />
        <div className="min-w-0 flex-1" />
        <SkeletonBone className="h-6 w-14 rounded-md" />
      </div>
    </article>
  );
}

type Props = {
  cards?: number;
};

export function AgentsPageSkeleton({ cards = 6 }: Props) {
  return (
    <section className="mt-1" aria-busy="true" aria-label="Loading agents">
      <div className="mb-5 flex justify-end" aria-hidden>
        <SkeletonBone className="h-4 w-16" />
      </div>

      <ul className="m-0 grid list-none grid-cols-1 gap-5 p-0 md:grid-cols-2 2xl:grid-cols-3">
        {Array.from({ length: cards }).map((_, index) => (
          <li key={index}>
            <AgentCardSkeleton />
          </li>
        ))}
      </ul>
    </section>
  );
}
