import clsx from "clsx";
import type { HTMLAttributes } from "react";

import { Card } from "@/components/ui/Card";

type SkeletonProps = HTMLAttributes<HTMLDivElement>;

/** Base pulse block — use for bars, circles, table cells, cards. */
export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={clsx(
        "animate-pulse rounded-md bg-slate-200/90 dark:bg-slate-700/75",
        className,
      )}
      {...props}
    />
  );
}

/** Short label line (titles, breadcrumbs). */
export function SkeletonLine({ className, ...props }: SkeletonProps) {
  return <Skeleton className={clsx("h-4 w-full max-w-[14rem]", className)} {...props} />;
}

/** Paragraph-style lines. */
export function SkeletonTextBlock({ lines = 3, className }: { lines?: number; className?: string }) {
  const widths = ["w-full", "w-[92%]", "w-[70%]"] as const;
  return (
    <div className={clsx("space-y-2.5", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={clsx("h-3.5", widths[i % widths.length])} />
      ))}
    </div>
  );
}

/** Dashboard-style stat cards. */
export function SkeletonMetricCards({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-slate-200/80 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/40"
        >
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="mt-3 h-9 w-16" />
        </div>
      ))}
    </div>
  );
}

type SkeletonTableProps = {
  rows?: number;
  cols?: number;
  showHeader?: boolean;
};

/** `<tr>` rows only — use inside an existing `<tbody>` next to real headers. */
export function SkeletonTableRows({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, ri) => (
        <tr key={ri}>
          {Array.from({ length: cols }).map((_, ci) => (
            <td key={ci} className="px-4 py-3">
              <Skeleton className={clsx("h-3.5", ci === 0 ? "w-[min(100%,12rem)]" : "w-20")} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function SkeletonDataTable({ rows = 6, cols = 5, showHeader = true }: SkeletonTableProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200/80 dark:border-slate-800">
      <table className="min-w-full text-left text-sm">
        {showHeader ? (
          <thead className="bg-slate-50 dark:bg-slate-800/80">
            <tr>
              {Array.from({ length: cols }).map((_, i) => (
                <th key={i} className="px-4 py-3">
                  <Skeleton className="h-3 w-20" />
                </th>
              ))}
            </tr>
          </thead>
        ) : null}
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          <SkeletonTableRows rows={rows} cols={cols} />
        </tbody>
      </table>
    </div>
  );
}

/** Agent workspace main column while bot / form data loads. */
export function AgentWorkspaceMainSkeleton() {
  return (
    <div className="flex min-h-[50vh] min-w-0 flex-1 flex-col gap-4 bg-[#f4fbfb] dark:bg-gray-950">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/70 pb-4 dark:border-slate-800">
        <div className="min-w-0 space-y-2">
          <Skeleton className="h-6 w-48 max-w-[min(100%,20rem)]" />
          <Skeleton className="h-3 w-32" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24 rounded-md" />
          <Skeleton className="h-9 w-28 rounded-md" />
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_minmax(0,320px)]">
        <div className="space-y-4 rounded-xl border border-slate-200/80 bg-white p-5 dark:border-slate-800 dark:bg-slate-900/30">
          <Skeleton className="h-5 w-40" />
          <SkeletonTextBlock lines={4} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-24 rounded-lg" />
            <Skeleton className="h-24 rounded-lg" />
          </div>
          <SkeletonTextBlock lines={3} />
        </div>
        <div className="hidden space-y-3 rounded-xl border border-slate-200/80 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/30 lg:block">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="aspect-[4/5] w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}

/** Simple shell content placeholder (settings, small pages). */
export function SkeletonFormFields({ fields = 4 }: { fields?: number }) {
  return (
    <div className="max-w-xl space-y-6">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
      ))}
    </div>
  );
}

export function DashboardPageSkeleton() {
  return (
    <div className="space-y-6">
      <Card>
        <Skeleton className="h-6 w-64 max-w-full" />
        <Skeleton className="mt-3 h-4 w-full max-w-lg" />
      </Card>
      <Card title="Quick Links">
        <div className="grid gap-2 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-11 rounded-lg" />
          ))}
        </div>
      </Card>
    </div>
  );
}

export function AnalyticsPageSkeleton() {
  return (
    <div className="space-y-6">
      <SkeletonMetricCards count={3} />
      <section className="space-y-3">
        <Skeleton className="h-7 w-40" />
        <SkeletonDataTable rows={8} cols={5} />
      </section>
    </div>
  );
}

export function VisitorDetailPageSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card title="Profile">
        <SkeletonTextBlock lines={6} />
      </Card>
      <div className="md:col-span-2 space-y-4">
        <Skeleton className="h-6 w-48" />
        <SkeletonDataTable rows={10} cols={5} />
      </div>
    </div>
  );
}

/** Minimal line for route redirects / tiny loading surfaces. */
export function InlineRedirectSkeleton() {
  return (
    <div className="flex items-center gap-2 py-1">
      <Skeleton className="h-4 w-36" />
    </div>
  );
}
