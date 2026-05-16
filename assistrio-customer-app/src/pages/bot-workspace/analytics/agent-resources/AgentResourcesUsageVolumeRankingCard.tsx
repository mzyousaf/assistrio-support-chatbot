import { cn } from '@/lib/utils';
import type { AgentResourcesUsageSeriesId } from './agentResourcesUsageTrendTheme';

export type AgentResourcesUsageVolumeFormula =
  | { kind: 'total'; credits: string }
  | {
      kind: 'usage';
      quantity: string;
      noun: 'messages' | 'sessions';
      unitCost: string;
      credits: string;
    };

export type AgentResourcesUsageVolumeRow = {
  id: AgentResourcesUsageSeriesId;
  label: string;
  color: string;
  /** Raw total for visibility / toggles (credits). */
  magnitude: number;
  /** Calculation phrase for assistive tech & tooltips. */
  detailLine: string;
  formula: AgentResourcesUsageVolumeFormula;
};

type Props = {
  rows: AgentResourcesUsageVolumeRow[];
  hiddenSeriesIds: string[];
  onToggleSeries: (id: AgentResourcesUsageSeriesId) => void;
  /** Dense layout when nested beside charts; height follows row content (no fixed scroll viewport). */
  embedded?: boolean;
};

export function AgentResourcesUsageVolumeRankingCard({
  rows,
  hiddenSeriesIds,
  onToggleSeries,
  embedded = false,
}: Props) {
  if (!rows.length) {
    return (
      <div
        className={cn(
          'rounded-lg border border-dashed border-slate-200/90 bg-slate-50/40 px-4 py-6 text-center text-sm text-slate-500',
          embedded && 'py-5',
        )}
      >
        No usage for this range.
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <ul
        className={cn(
          'm-0 flex list-none flex-col gap-1.5 p-0',
          embedded ? 'mt-0 gap-1 space-y-0 py-0.5 pr-0.5' : 'gap-1.5',
        )}
      >
        {rows.map((row) => {
          const hidden = hiddenSeriesIds.includes(row.id);
          const isTotal = row.id === 'totalCreditsUsed';
          return (
            <li key={row.id} className={cn(isTotal && 'mt-2 border-t border-slate-200/90 pt-2')}>
              <button
                type="button"
                onClick={() => onToggleSeries(row.id)}
                aria-pressed={!hidden}
                aria-label={`${row.label}: ${row.detailLine}`}
                className={cn(
                  embedded
                    ? 'flex h-[35px] max-h-[35px] w-full min-w-0 flex-row items-center gap-0 overflow-hidden rounded-lg border border-transparent px-2 py-0 text-left outline-none transition-colors duration-200 hover:border-slate-200 hover:bg-white active:bg-slate-100'
                    : 'grid w-full min-w-0 grid-cols-1 items-center gap-x-4 gap-y-1.5 text-left outline-none transition-all duration-200 sm:grid-cols-[minmax(0,auto)_minmax(0,1fr)] sm:items-center',
                  !embedded &&
                    cn(
                      'rounded-xl border px-2.5 py-2',
                      'focus-visible:ring-2 focus-visible:ring-teal-500/25 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50/90',
                      isTotal
                        ? cn(
                            'border-teal-200/65 bg-teal-50/50 shadow-sm shadow-teal-900/[0.04]',
                            'hover:border-teal-300/85 hover:bg-teal-50/80',
                            'active:bg-teal-100/55',
                            hidden && 'opacity-45 saturate-[0.65]',
                          )
                        : cn(
                            'border-slate-200/40 bg-white/80 hover:border-slate-200 hover:bg-white',
                            'active:bg-slate-50/95',
                            hidden && 'opacity-45',
                          ),
                    ),
                  embedded && 'focus-visible:ring-2 focus-visible:ring-teal-500/25',
                  embedded && hidden && 'opacity-55',
                )}
              >
                <div
                  className={cn(
                    'flex min-w-0 items-center',
                    embedded ? 'max-w-[min(100%,11rem)] shrink-0 gap-1.5' : 'gap-2 sm:shrink-0',
                  )}
                >
                  <span
                    className={cn(
                      'shrink-0 rounded-full ring-2 ring-white',
                      !embedded && 'drop-shadow-sm',
                      embedded ? 'h-2 w-2 ring-white' : isTotal ? 'h-2.5 w-2.5 ring-teal-100/90' : 'h-2 w-2',
                      embedded && hidden && 'opacity-55',
                    )}
                    style={{ backgroundColor: row.color }}
                    aria-hidden
                  />
                  <span
                    className={cn(
                      'min-w-0 truncate font-semibold leading-snug text-slate-900',
                      embedded ? 'text-xs leading-none' : 'text-[11px] sm:text-xs sm:whitespace-normal',
                      embedded && hidden && 'text-slate-400',
                    )}
                  >
                    {row.label}
                  </span>
                </div>

                <div
                  className={cn(
                    embedded ? 'min-w-0 flex-1 overflow-hidden text-right' : 'min-w-0 sm:justify-self-end sm:text-right',
                    !embedded && 'text-[10px] tabular-nums sm:text-[11px]',
                    !embedded && !isTotal && 'max-sm:w-full max-sm:pl-6',
                    embedded && hidden && 'text-slate-400',
                  )}
                >
                  {embedded ? (
                    <span className="block min-w-0 truncate font-semibold tabular-nums text-xs leading-none text-slate-900">
                      {row.detailLine}
                    </span>
                  ) : row.formula.kind === 'total' ? (
                    <span className="inline-flex flex-wrap items-baseline justify-end gap-x-1 gap-y-0.5 tabular-nums sm:flex-nowrap sm:gap-x-1.5">
                      <span className="font-normal leading-none text-slate-400 select-none" aria-hidden>
                        =
                      </span>
                      <span className="font-semibold leading-none text-slate-900">{row.formula.credits}</span>
                    </span>
                  ) : (
                    <span className="inline-flex flex-wrap items-baseline justify-end gap-x-1 gap-y-px tabular-nums text-slate-800 sm:flex-nowrap sm:gap-x-1.5">
                      <span className="font-semibold text-slate-900">{row.formula.quantity}</span>
                      <span className="font-normal text-slate-600">{row.formula.noun}</span>
                      <span className="font-normal text-slate-400 select-none">x</span>
                      <span className="font-semibold text-slate-800">{row.formula.unitCost}</span>
                      <span className="font-normal text-slate-400 select-none">=</span>
                      <span className="font-semibold text-slate-900">{row.formula.credits}</span>
                    </span>
                  )}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
