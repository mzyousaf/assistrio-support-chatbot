import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type AnalyticsKpiItem = {
  label: string;
  hint: string;
  value: string;
  Icon: LucideIcon;
};

type Props = {
  items: AnalyticsKpiItem[];
  columnsClassName: string;
  /** Extra classes on each KPI tile (e.g. hover transitions). */
  itemClassName?: string;
};

export function AnalyticsKpiGrid({ items, columnsClassName, itemClassName }: Props) {
  return (
    <div className={cn('grid gap-3', columnsClassName)}>
      {items.map((c) => (
        <div
          key={c.label}
          className={cn(
            'rounded-[0.625rem] border border-slate-100 bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-4',
            itemClassName,
          )}
        >
          <div className="mb-2 flex items-start justify-between gap-2">
            <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.04em] text-slate-400">{c.label}</p>
            <c.Icon className="size-4 shrink-0 text-teal-600/70" strokeWidth={1.75} aria-hidden />
          </div>
          <p className="m-0 text-lg font-semibold tabular-nums tracking-tight text-slate-900 sm:text-xl">{c.value}</p>
          <p className="mt-1 mb-0 text-[11px] leading-snug text-slate-500 sm:text-xs">{c.hint}</p>
        </div>
      ))}
    </div>
  );
}
