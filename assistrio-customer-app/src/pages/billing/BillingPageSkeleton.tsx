import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

function SkeletonBone({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded bg-slate-200/80', className)} aria-hidden />;
}

function BillingSectionCardSkeleton(props: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'rounded-2xl border border-slate-200/90 bg-white shadow-[var(--shadow-card)]',
        props.className,
      )}
      aria-hidden
    >
      {props.children}
    </section>
  );
}

function BillingSectionHeaderSkeleton(props: {
  withSubtitle?: boolean;
  withAction?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1 space-y-2">
        <SkeletonBone className="h-4 w-40 max-w-full" />
        {props.withSubtitle ? <SkeletonBone className="h-3.5 w-56 max-w-full" /> : null}
      </div>
      {props.withAction ? (
        <SkeletonBone className="h-7 w-36 shrink-0 rounded-[var(--ui-radius)]" />
      ) : null}
    </div>
  );
}

function PlanPanelSkeleton(props: { tinted?: boolean }) {
  return (
    <div
      className={cn(
        'rounded-xl border p-4',
        props.tinted
          ? 'border-teal-200/45 bg-[color-mix(in_srgb,var(--teal-50)_88%,white_12%)]'
          : 'border-slate-200/70 bg-slate-50/40',
      )}
    >
      <SkeletonBone className="h-2.5 w-20" />
      <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-1.5">
          <SkeletonBone className="h-6 w-28 max-w-full" />
          <SkeletonBone className="h-4 w-16" />
        </div>
        <SkeletonBone className="h-7 w-[5.5rem] shrink-0 rounded-[var(--ui-radius)]" />
      </div>
      <div className="mt-4 space-y-2">
        <SkeletonBone className="h-3.5 w-24" />
        <SkeletonBone className="h-3.5 w-full max-w-[14rem]" />
        <SkeletonBone className="h-3 w-full max-w-xs" />
      </div>
    </div>
  );
}

function BillingAddonRowSkeleton() {
  return (
    <div className="rounded-xl border border-slate-200/70 bg-slate-50/30 p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <SkeletonBone className="h-4 w-36 max-w-full" />
          <SkeletonBone className="h-3.5 w-20" />
        </div>
        <SkeletonBone className="h-7 w-24 shrink-0 rounded-[var(--ui-radius)]" />
      </div>
      <SkeletonBone className="mt-3 h-3 w-44 max-w-full" />
      <SkeletonBone className="mt-2 h-3.5 w-full max-w-md" />
    </div>
  );
}

function SubscriptionOverviewSkeleton() {
  return (
    <BillingSectionCardSkeleton>
      <div className="flex flex-col gap-5 p-5">
        <SkeletonBone className="h-4 w-44" />

        <div className="grid gap-6 border-t border-slate-200/80 pt-6 lg:grid-cols-2 lg:gap-8">
          <PlanPanelSkeleton tinted />
          <div className="border-t border-slate-200/80 pt-6 lg:border-t-0 lg:border-l lg:pl-8 lg:pt-0">
            <PlanPanelSkeleton />
          </div>
        </div>

        <div className="border-t border-slate-200/80 pt-6">
          <div className="mb-4 space-y-2">
            <SkeletonBone className="h-2.5 w-14" />
            <SkeletonBone className="h-3 w-full max-w-sm" />
          </div>
          <div className="flex flex-col gap-3">
            <div className="grid gap-3 lg:grid-cols-2">
              <BillingAddonRowSkeleton />
              <BillingAddonRowSkeleton />
            </div>
            <BillingAddonRowSkeleton />
          </div>
        </div>
      </div>
    </BillingSectionCardSkeleton>
  );
}

function PaymentMethodSkeleton() {
  return (
    <BillingSectionCardSkeleton>
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <SkeletonBone className="h-4 w-32" />
          <SkeletonBone className="h-3.5 w-64 max-w-full" />
        </div>
        <SkeletonBone className="h-7 w-44 shrink-0 rounded-[var(--ui-radius)]" />
      </div>
    </BillingSectionCardSkeleton>
  );
}

function BillingDetailsSkeleton() {
  return (
    <BillingSectionCardSkeleton>
      <div className="flex flex-col gap-4 p-5">
        <BillingSectionHeaderSkeleton withSubtitle withAction />
        <div className="rounded-lg border border-slate-200/60 bg-slate-50/30 p-3.5">
          <div className="space-y-3">
            <SkeletonBone className="h-4 w-40 max-w-full" />
            <SkeletonBone className="h-3.5 w-52 max-w-full" />
            <div className="space-y-2 border-t border-slate-200/70 pt-3">
              <SkeletonBone className="h-2.5 w-24" />
              <SkeletonBone className="h-3.5 w-full max-w-xs" />
              <SkeletonBone className="h-3.5 w-32 max-w-full" />
            </div>
          </div>
        </div>
      </div>
    </BillingSectionCardSkeleton>
  );
}

function InvoiceHistorySkeleton() {
  return (
    <BillingSectionCardSkeleton className="overflow-x-auto">
      <div className="flex flex-col gap-4 p-5">
        <BillingSectionHeaderSkeleton withSubtitle withAction />
        <div className="overflow-hidden rounded-lg border border-slate-200/80">
          <div className="grid grid-cols-5 gap-3 border-b border-slate-200/80 px-3 py-2.5">
            {Array.from({ length: 5 }).map((_, index) => (
              <SkeletonBone key={index} className="h-2.5 w-full max-w-[3.5rem]" />
            ))}
          </div>
          {Array.from({ length: 4 }).map((_, rowIndex) => (
            <div
              key={rowIndex}
              className="grid grid-cols-5 items-center gap-3 border-b border-slate-100/80 px-3 py-3 last:border-b-0"
            >
              <SkeletonBone className="h-3 w-16" />
              <div className="space-y-1.5">
                <SkeletonBone className="h-3 w-full max-w-[5.5rem]" />
                <SkeletonBone className="h-2.5 w-full max-w-[4rem]" />
              </div>
              <SkeletonBone className="h-3 w-12" />
              <SkeletonBone className="h-4 w-10 rounded" />
              <SkeletonBone className="h-3 w-20 justify-self-start" />
            </div>
          ))}
        </div>
      </div>
    </BillingSectionCardSkeleton>
  );
}

function CancelSubscriptionSkeleton() {
  return (
    <BillingSectionCardSkeleton className="overflow-hidden">
      <div className="border-l-[3px] border-l-rose-200/80 bg-gradient-to-r from-rose-50/35 via-white to-white">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1 space-y-2">
            <SkeletonBone className="h-4 w-36" />
            <SkeletonBone className="h-3.5 w-full max-w-md" />
          </div>
          <SkeletonBone className="h-7 w-36 shrink-0 rounded-[var(--ui-radius)]" />
        </div>
      </div>
    </BillingSectionCardSkeleton>
  );
}

export function BillingPageSkeleton() {
  return (
    <div className="flex flex-col gap-5 pb-12" aria-busy="true" aria-label="Loading billing">
      <SubscriptionOverviewSkeleton />
      <PaymentMethodSkeleton />
      <BillingDetailsSkeleton />
      <InvoiceHistorySkeleton />
      <CancelSubscriptionSkeleton />
    </div>
  );
}
