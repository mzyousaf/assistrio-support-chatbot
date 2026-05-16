import { cn } from '@/lib/utils';
import { formatAnalyticsInteger } from '@/lib/analyticsFormat';

export type KbSourceRankingRow = {
  id: string;
  label: string;
  count: number;
  pctOfTotal: number | null;
  color: string;
};

type Props = {
  rankingRows: KbSourceRankingRow[];
  hiddenSeriesIds: string[];
  onToggleSeries: (id: string) => void;
  embedded?: boolean;
};

function formatPctParen(pct: number | null): string | null {
  if (pct == null || !Number.isFinite(pct)) return null;
  const s = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(pct);
  return `(${s}%)`;
}

export function KbSourceTypeRankingCard({
  rankingRows,
  hiddenSeriesIds,
  onToggleSeries,
  embedded = false,
}: Props) {
  if (!rankingRows.length) {
    return (
      <div
        className={cn(
          'rounded-lg border border-dashed border-slate-200/90 bg-slate-50/40 px-4 py-8 text-center text-sm text-slate-500',
          embedded && 'flex min-h-0 flex-1 flex-col items-center justify-center',
        )}
      >
        No source-type breakdown for this range.
      </div>
    );
  }

  return (
    <div className={cn('min-w-0', embedded && 'flex min-h-0 flex-1 flex-col')}>
      <ul
        className={cn(
          'list-none p-0',
          embedded
            ? 'mt-0 min-h-0 flex-1 space-y-1 overflow-y-auto overflow-x-hidden overscroll-y-contain py-0.5 pr-0.5 [scrollbar-gutter:stable]'
            : 'mt-4 max-h-[420px] space-y-1 overflow-y-auto',
        )}
      >
        {rankingRows.map((row) => {
          const hidden = hiddenSeriesIds.includes(row.id);
          const pctParen = formatPctParen(row.pctOfTotal);
          const countStr = formatAnalyticsInteger(row.count);
          const ariaPct =
            row.pctOfTotal != null && Number.isFinite(row.pctOfTotal)
              ? `, ${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(row.pctOfTotal)}%`
              : '';
          const ariaLabel = `${row.label}: ${countStr} primary citations${ariaPct}`;
          return (
            <li key={row.id}>
              <button
                type="button"
                onClick={() => onToggleSeries(row.id)}
                aria-pressed={!hidden}
                aria-label={ariaLabel}
                className={cn(
                  'flex w-full min-w-0 rounded-md border border-transparent text-left transition-colors duration-200',
                  embedded
                    ? 'h-[35px] min-h-[35px] flex-row items-center gap-0 rounded-lg px-2 py-0'
                    : 'flex-col gap-0.5 rounded-lg px-2.5 py-2',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/25',
                  embedded
                    ? 'hover:border-slate-200 hover:bg-white active:bg-slate-100'
                    : 'hover:border-slate-200/90 hover:bg-white/90 active:bg-slate-100/80',
                  !embedded && hidden && 'opacity-45',
                )}
              >
                <div className={cn('flex min-w-0 items-center gap-1.5', embedded && 'min-h-0 flex-1')}>
                  <span
                    className={cn(
                      'shrink-0 rounded-full ring-2 ring-white',
                      embedded ? 'h-2 w-2' : 'mt-0.5 h-2 w-2',
                      embedded && hidden && 'opacity-55',
                    )}
                    style={{ backgroundColor: row.color }}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        'm-0 truncate font-semibold text-slate-900',
                        embedded ? 'text-xs leading-none' : 'text-sm leading-snug',
                        embedded && hidden && 'text-slate-400',
                      )}
                    >
                      {row.label}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p
                      className={cn(
                        'm-0 font-semibold tabular-nums text-slate-900',
                        embedded ? 'text-xs leading-none' : 'text-sm',
                        embedded && hidden && 'text-slate-400',
                      )}
                    >
                      {countStr}
                      {pctParen ? (
                        <span
                          className={cn(
                            'font-semibold tabular-nums text-teal-700/90',
                            embedded ? 'text-[11px] tabular-nums sm:text-xs' : 'text-xs',
                            embedded && hidden && '!text-slate-400',
                          )}
                        >
                          {' '}
                          {pctParen}
                        </span>
                      ) : null}
                    </p>
                  </div>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
