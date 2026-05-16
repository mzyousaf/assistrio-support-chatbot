import type { LucideIcon } from 'lucide-react';
import { Info } from 'lucide-react';
import { Fragment } from 'react';
import type { ReactNode } from 'react';
import { Tooltip } from '@/components/ui';
import { cn } from '@/lib/utils';

export type AnalyticsKpiItem = {
  label: string;
  /** Muted sublabel directly under `label` (e.g. unit: "Credits"). */
  labelSubtext?: ReactNode;
  /** Primary metric display string */
  value: string;
  /** Optional decorative icon (omit for text-only tiles). */
  Icon?: LucideIcon;
  /** Rendered after the value on the same row as `headerInline` (e.g. sentiment face meter). */
  valueAddon?: ReactNode;
  /** Optional `data-testid` on the value paragraph when using `headerInline`. */
  valueTestId?: string;
  /** Optional subtitle under the value (legacy KPI tiles). */
  hint?: string;
  /** Portal tooltip next to the label — replaces visible hint when used alone. */
  infoTooltip?: string;
  /** Full-width block below the header/value section (e.g. sparkline). */
  footer?: ReactNode;
  /** Top row: label + info left; value and optional icon right; footer below (e.g. sparkline). */
  headerInline?: boolean;
  /**
   * With `headerInline`, replaces the default value column (`value`, `valueAddon`, `Icon`).
   * Use for composite trailing UI (e.g. sentiment tag).
   */
  headerTrailingSlot?: ReactNode;
  /**
   * Hover/focus the whole tile (full width within the grid) to show calculation or extra detail.
   * Uses the shared portal {@link Tooltip} like the label info icon — `fullWidth` for grid cells.
   */
  tileTooltip?: ReactNode;
  /** Extra panel classes when `tileTooltip` is set (e.g. wider `max-w`). */
  tileTooltipPanelClassName?: string;
  /** Overrides default muted KPI label (`text-slate-400`). */
  labelClassName?: string;
  /** Overrides default KPI unit sublabel (e.g. drop `pointer-events-none`). */
  labelSubtextClassName?: string;
};

type Props = {
  items: AnalyticsKpiItem[];
  columnsClassName: string;
  /** Extra classes on each KPI tile (e.g. hover transitions). */
  itemClassName?: string;
};

const kpiValueClass =
  'm-0 text-2xl font-semibold tabular-nums tracking-tight text-slate-900 sm:text-3xl';

function KpiInfoTrigger({ text }: { text: string }) {
  return (
    <Tooltip content={<span>{text}</span>} side="top">
      <button
        type="button"
        className="inline-flex shrink-0 rounded p-0.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/25"
        aria-label="About this metric"
      >
        <Info className="size-3.5" strokeWidth={2} aria-hidden />
      </button>
    </Tooltip>
  );
}

export function AnalyticsKpiGrid({ items, columnsClassName, itemClassName }: Props) {
  return (
    <div className={cn('grid gap-3 items-stretch', columnsClassName)}>
      {items.map((c) => {
        const tile = (
          <div
            className={cn(
              'flex min-h-0 w-full min-w-0 flex-col rounded-[0.625rem] border border-slate-100 bg-white px-3 pb-3 pt-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:px-4 sm:pb-4 sm:pt-2.5',
              c.tileTooltip && 'cursor-help transition-shadow hover:border-slate-200/90 hover:shadow-[0_2px_6px_rgba(15,23,42,0.06)]',
              itemClassName,
            )}
          >
            {c.headerInline ? (
              <>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <div className="flex min-w-0 items-center gap-1">
                      <p
                        className={cn(
                          'm-0 text-[11px] font-semibold uppercase tracking-[0.04em] text-slate-400',
                          c.labelClassName,
                        )}
                      >
                        {c.label}
                      </p>
                      {c.infoTooltip ? <KpiInfoTrigger text={c.infoTooltip} /> : null}
                    </div>
                    {c.labelSubtext ? (
                      <p
                        className={cn(
                          'm-0 text-[10px] font-normal leading-snug tracking-normal normal-case text-slate-400/65 select-none pointer-events-none sm:text-[11px]',
                          c.labelSubtextClassName,
                        )}
                      >
                        {c.labelSubtext}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex min-w-0 shrink-0 items-center gap-1.5">
                    {c.headerTrailingSlot ? (
                      c.headerTrailingSlot
                    ) : (
                      <>
                        <p className={kpiValueClass} data-testid={c.valueTestId}>
                          {c.value}
                        </p>
                        {c.valueAddon}
                        {c.Icon ? (
                          <c.Icon className="size-4 shrink-0 text-teal-600/70" strokeWidth={1.75} aria-hidden />
                        ) : null}
                      </>
                    )}
                  </div>
                </div>
                {c.footer ? <div className="mt-7 min-w-0 flex-1">{c.footer}</div> : null}
              </>
            ) : (
              <>
                <div
                  className={cn(
                    'mb-2 flex items-start gap-2',
                    c.Icon ? 'justify-between' : '',
                  )}
                >
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <div className="flex min-w-0 items-center gap-1">
                      <p
                        className={cn(
                          'm-0 text-[11px] font-semibold uppercase tracking-[0.04em] text-slate-400',
                          c.labelClassName,
                        )}
                      >
                        {c.label}
                      </p>
                      {c.infoTooltip ? <KpiInfoTrigger text={c.infoTooltip} /> : null}
                    </div>
                    {c.labelSubtext ? (
                      <p
                        className={cn(
                          'm-0 text-[10px] font-normal leading-snug tracking-normal normal-case text-slate-400/65 select-none pointer-events-none sm:text-[11px]',
                          c.labelSubtextClassName,
                        )}
                      >
                        {c.labelSubtext}
                      </p>
                    ) : null}
                  </div>
                  {c.Icon ? (
                    <c.Icon className="size-4 shrink-0 text-teal-600/70" strokeWidth={1.75} aria-hidden />
                  ) : null}
                </div>
                <p className={kpiValueClass}>{c.value}</p>
                {c.hint ? (
                  <p className="mt-1 mb-0 text-[11px] leading-snug text-slate-500 sm:text-xs">{c.hint}</p>
                ) : null}
                {c.footer ? <div className="mt-7 min-w-0">{c.footer}</div> : null}
              </>
            )}
          </div>
        );

        return c.tileTooltip ? (
          <Tooltip
            key={c.label}
            content={c.tileTooltip}
            fullWidth
            side="bottom"
            panelClassName={cn(
              'max-w-[min(22rem,calc(100vw-24px))] whitespace-normal px-3 py-2 text-left tracking-normal',
              c.tileTooltipPanelClassName,
            )}
          >
            {tile}
          </Tooltip>
        ) : (
          <Fragment key={c.label}>{tile}</Fragment>
        );
      })}
    </div>
  );
}
