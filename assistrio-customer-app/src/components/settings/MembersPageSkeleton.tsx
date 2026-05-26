import { Card, CardBody, CardHeader } from '@/components/ui';
import { cn } from '@/lib/utils';

function SkeletonBone({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded bg-slate-200/80', className)} aria-hidden />;
}

function SeatUsageCardSkeleton(props: { withMeter?: boolean }) {
  return (
    <Card className="h-full border-slate-200/90 shadow-[var(--shadow-card)]">
      <CardBody className="flex h-full flex-col gap-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <SkeletonBone className="h-3 w-20" />
          {props.withMeter ? <SkeletonBone className="h-5 w-10 rounded-md" /> : null}
        </div>
        {props.withMeter ? (
          <SkeletonBone className="h-1.5 w-full rounded-full" />
        ) : (
          <SkeletonBone className="h-7 w-10" />
        )}
      </CardBody>
    </Card>
  );
}

function StatCardSkeleton() {
  return (
    <div className="h-full rounded-xl border border-slate-200/80 bg-white px-4 py-3.5 shadow-[var(--shadow-xs)]">
      <SkeletonBone className="h-3 w-24" />
      <SkeletonBone className="mt-3 h-7 w-8" />
    </div>
  );
}

function TableRowSkeleton() {
  return (
    <tr className="border-b border-slate-100 last:border-b-0">
      <td className="py-3 pr-3 align-middle">
        <div className="flex min-w-0 items-center gap-2.5">
          <SkeletonBone className="h-8 w-8 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <SkeletonBone className="h-3.5 w-28 max-w-full" />
            <SkeletonBone className="h-3 w-36 max-w-full" />
          </div>
        </div>
      </td>
      <td className="py-3 pr-3 align-middle">
        <SkeletonBone className="h-5 w-14 rounded-full" />
      </td>
      <td className="py-3 pr-3 align-middle">
        <SkeletonBone className="h-7 w-[6.5rem] rounded-[var(--ui-radius)]" />
      </td>
      <td className="hidden py-3 pr-3 align-middle lg:table-cell">
        <SkeletonBone className="h-3 w-24" />
      </td>
      <td className="py-3 pr-3 align-middle">
        <SkeletonBone className="h-3 w-20" />
      </td>
      <td className="py-3 text-right align-middle">
        <div className="inline-flex justify-end gap-1">
          <SkeletonBone className="h-7 w-7 rounded-[var(--ui-radius)]" />
          <SkeletonBone className="h-7 w-7 rounded-[var(--ui-radius)]" />
        </div>
      </td>
    </tr>
  );
}

function MobilePersonCardSkeleton() {
  return (
    <div className="rounded-lg border border-slate-200/90 bg-white p-3 shadow-[var(--shadow-xs)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <SkeletonBone className="h-8 w-8 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <SkeletonBone className="h-3.5 w-28 max-w-full" />
            <SkeletonBone className="h-3 w-36 max-w-full" />
          </div>
        </div>
        <div className="flex shrink-0 gap-1">
          <SkeletonBone className="h-7 w-7 rounded-[var(--ui-radius)]" />
          <SkeletonBone className="h-7 w-7 rounded-[var(--ui-radius)]" />
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-3">
        <SkeletonBone className="h-3 w-12" />
        <SkeletonBone className="h-3 w-10" />
        <SkeletonBone className="h-5 w-14 rounded-full" />
        <SkeletonBone className="h-7 w-[6.5rem] rounded-[var(--ui-radius)]" />
        <SkeletonBone className="col-span-2 h-3 w-32" />
        <SkeletonBone className="col-span-2 h-3 w-24" />
      </div>
    </div>
  );
}

type Props = {
  tableRows?: number;
  mobileRows?: number;
};

export function MembersPageSkeleton({ tableRows = 4, mobileRows = 3 }: Props) {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading members">
      <section aria-hidden>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <SeatUsageCardSkeleton withMeter />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
      </section>

      <Card className="border-slate-200/90 shadow-[var(--shadow-card)]">
        <CardHeader className="flex flex-row items-start justify-between gap-3 py-4">
          <div className="min-w-0 flex-1 space-y-2">
            <SkeletonBone className="h-5 w-24" />
            <SkeletonBone className="h-3.5 w-56 max-w-full" />
          </div>
          <SkeletonBone className="h-4 w-16 shrink-0" />
        </CardHeader>

        <CardBody className="space-y-4 pb-4 pt-0">
          <div className="hidden md:block">
            <table className="mt-3 w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-100">
                  {['Person', 'Status', 'Role', 'Agent access', 'Joined / invited', 'Actions'].map((label) => (
                    <th
                      key={label}
                      className={cn(
                        'pb-2.5 pr-3 font-medium',
                        label === 'Agent access' && 'hidden lg:table-cell',
                        label === 'Actions' && 'text-right',
                      )}
                    >
                      <SkeletonBone
                        className={cn(
                          'h-3',
                          label === 'Person' && 'w-12',
                          label === 'Status' && 'w-10',
                          label === 'Role' && 'w-8',
                          label === 'Agent access' && 'hidden w-20 lg:inline-block',
                          label === 'Joined / invited' && 'w-24',
                          label === 'Actions' && 'ml-auto w-12',
                        )}
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: tableRows }).map((_, index) => (
                  <TableRowSkeleton key={index} />
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {Array.from({ length: mobileRows }).map((_, index) => (
              <MobilePersonCardSkeleton key={index} />
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
