import { cn } from '@/lib/utils';
import { formatAnalyticsInteger } from '@/lib/analyticsFormat';
import { colorForSentimentSeries, type SentimentRankingRow } from './sentimentTrendsChartHelpers';

type Props = {
  rankingRows: SentimentRankingRow[];
  hiddenSeriesIds: string[];
  onToggleSeries: (id: string) => void;
  embedded?: boolean;
  rankingListClassName?: string;
  compactRows?: boolean;
  /** Aria / phrasing for counts in ranking rows. */
  countUnit?: 'messages' | 'chats';
};

function formatPctParen(pct: number | null): string | null {
  if (pct == null || !Number.isFinite(pct)) return null;
  const s = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(pct);
  return `(${s}%)`;
}

export function SentimentLabelRankingCard({
  rankingRows,
  hiddenSeriesIds,
  onToggleSeries,
  embedded = false,
  rankingListClassName,
  compactRows = false,
  countUnit = 'messages',
}: Props) {
  if (!rankingRows.length) {
    return (
      <div
        className={cn(
          'rounded-lg border border-dashed border-slate-200/90 bg-slate-50/40 px-4 py-8 text-center text-sm text-slate-500',
          embedded && 'flex min-h-0 flex-1 flex-col items-center justify-center',
        )}
      >
        No sentiment breakdown for this range.
      </div>
    );
  }

  const modalCompactRows = compactRows && !embedded;

  return (
    <div className={cn('min-w-0', embedded && 'flex min-h-0 flex-1 flex-col', !embedded && 'min-h-0')}>
      <ul
        className={cn(
          'list-none p-0',
          embedded
            ? 'mt-0 min-h-0 flex-1 space-y-1 overflow-y-auto overflow-x-hidden overscroll-y-contain py-0.5 pr-0.5 [scrollbar-gutter:stable]'
            : compactRows
              ? cn('mt-2 space-y-0 overflow-y-auto overflow-x-hidden', rankingListClassName)
              : rankingListClassName != null
                ? cn('mt-4 space-y-1', rankingListClassName)
                : 'mt-4 max-h-[min(420px,55vh)] space-y-1 overflow-y-auto',
        )}
      >
        {rankingRows.map((row) => {
          const hidden = hiddenSeriesIds.includes(row.id);
          const dotColor = colorForSentimentSeries(row.id);
          const pctParen = formatPctParen(row.pctOfTotal);
          const countStr = formatAnalyticsInteger(row.count);
          const ariaPct =
            row.pctOfTotal != null && Number.isFinite(row.pctOfTotal)
              ? `, ${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(row.pctOfTotal)}%`
              : '';
          const unitPhrase = countUnit === 'chats' ? 'distinct chats' : 'user messages';
          const ariaLabel = `${row.label}: ${countStr} ${unitPhrase}${ariaPct}`;
          return (
            <li key={row.id}>
              <button
                type="button"
                onClick={() => onToggleSeries(row.id)}
                aria-pressed={!hidden}
                aria-label={ariaLabel}
                className={cn(
                  'flex w-full min-w-0 flex-col rounded-md border border-transparent text-left transition-colors duration-200',
                  embedded
                    ? 'gap-0 rounded-lg px-2 py-2 min-h-[2.5rem]'
                    : modalCompactRows
                      ? 'gap-0 px-1 py-0.5'
                      : 'gap-0.5 rounded-lg px-2.5 py-2.5',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/25',
                  'hover:border-slate-200/90 hover:bg-white/90',
                  'active:bg-slate-100/80',
                  hidden && 'opacity-45',
                )}
              >
                <div
                  className={cn(
                    'flex min-w-0',
                    embedded || modalCompactRows ? 'items-center gap-1.5' : 'items-start gap-3',
                  )}
                >
                  <span
                    className={cn(
                      'shrink-0 rounded-full ring-2 ring-white drop-shadow-sm',
                      embedded ? 'h-2 w-2' : modalCompactRows ? 'h-1.5 w-1.5 ring-1' : 'mt-1.5 h-2.5 w-2.5',
                    )}
                    style={{ backgroundColor: dotColor }}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        'm-0 truncate font-semibold text-slate-900',
                        embedded ? 'text-xs leading-snug' : modalCompactRows ? 'text-[10px] leading-tight' : 'text-sm',
                      )}
                    >
                      {row.label}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p
                      className={cn(
                        'm-0 font-semibold tabular-nums text-slate-900',
                        embedded ? 'text-xs leading-snug' : modalCompactRows ? 'text-[10px] leading-tight' : 'text-sm',
                      )}
                    >
                      {countStr}
                      {pctParen ? (
                        <span
                          className={cn(
                            'font-semibold tabular-nums text-teal-700/90',
                            embedded ? 'text-[11px] tabular-nums sm:text-xs' : modalCompactRows ? 'text-[9px] sm:text-[10px]' : 'text-xs',
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
