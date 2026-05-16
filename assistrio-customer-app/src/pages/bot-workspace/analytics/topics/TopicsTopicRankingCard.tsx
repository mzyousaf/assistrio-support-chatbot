import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatAnalyticsInteger } from '@/lib/analyticsFormat';
import type { TopicRankingRow, TopicsMetricMode } from './topicsChartHelpers';
import { colorForSeriesInOrder, topicRankingRowsVisibleSlice } from './topicsChartHelpers';

/** Visible topic rows in the Topic trends sidebar before "View all topics". */
export const TOPIC_RANKING_SIDEBAR_MAX_VISIBLE = 9;

type Props = {
  rankingRows: TopicRankingRow[];
  seriesOrder: string[];
  metricMode: TopicsMetricMode;
  hiddenSeriesIds: string[];
  onToggleSeries: (id: string) => void;
  /** Tighter copy when nested beside the chart (e.g. Topic trends). */
  embedded?: boolean;
  /** When `embedded`, caps list length (default {@link TOPIC_RANKING_SIDEBAR_MAX_VISIBLE}). Ignored when not embedded. */
  maxVisible?: number;
  /** When not embedded, merged into the ranking `<ul>` (e.g. `max-h-none` so a parent modal owns scrolling). */
  rankingListClassName?: string;
  /** When set with `embedded`, "View all topics" opens the parent expanded view (e.g. chart + full list). */
  onViewAllTopics?: () => void;
  /** Shorter ranking rows (e.g. Topic trends expanded modal with full list). */
  compactRows?: boolean;
};

function formatPctParen(pct: number | null): string | null {
  if (pct == null || !Number.isFinite(pct)) return null;
  const s = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(pct);
  return `(${s}%)`;
}

function unitForAria(metricMode: TopicsMetricMode, _row: TopicRankingRow): string {
  return metricMode === 'conversations' ? 'chats' : 'mentions';
}

export function TopicsTopicRankingCard({
  rankingRows,
  seriesOrder,
  metricMode,
  hiddenSeriesIds,
  onToggleSeries,
  embedded = false,
  maxVisible = TOPIC_RANKING_SIDEBAR_MAX_VISIBLE,
  rankingListClassName,
  onViewAllTopics,
  compactRows = false,
}: Props) {
  if (!rankingRows.length) {
    return (
      <div
        className={cn(
          'rounded-lg border border-dashed border-slate-200/90 bg-slate-50/40 px-4 py-8 text-center text-sm text-slate-500',
          embedded && 'flex min-h-0 flex-1 flex-col items-center justify-center',
        )}
      >
        No ranked topics for this range.
      </div>
    );
  }

  const cap = embedded ? maxVisible : rankingRows.length;
  const rowsToShow =
    embedded && cap < rankingRows.length
      ? topicRankingRowsVisibleSlice(rankingRows, cap)
      : rankingRows.slice(0, cap);
  const hasMoreThanCap = embedded && rankingRows.length > cap;
  const modalCompactRows = compactRows && !embedded;

  return (
    <div className={cn('min-w-0', embedded && 'flex min-h-0 flex-1 flex-col', !embedded && 'min-h-0')}>
        <ul
          className={cn(
            'list-none p-0',
            embedded
              ? 'mt-0 min-h-0 flex-1 space-y-0 overflow-y-auto'
              : compactRows
                ? cn('mt-2 space-y-0 overflow-y-auto overflow-x-hidden', rankingListClassName)
                : rankingListClassName != null
                  ? cn('mt-4 space-y-1', rankingListClassName)
                  : 'mt-4 max-h-[min(420px,55vh)] space-y-1 overflow-y-auto',
          )}
        >
          {rowsToShow.map((row) => {
            const hidden = hiddenSeriesIds.includes(row.id);
            const dotColor = colorForSeriesInOrder(row.id, seriesOrder);
            const pctParen = formatPctParen(row.pctOfTotal);
            const countStr = formatAnalyticsInteger(row.count);
            const ariaPct =
              row.pctOfTotal != null && Number.isFinite(row.pctOfTotal)
                ? `, ${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(row.pctOfTotal)}%`
                : '';
            const ariaLabel = `${row.label}: ${countStr} ${unitForAria(metricMode, row)}${ariaPct}`;
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
                      ? 'gap-0 px-1.5 py-1'
                      : modalCompactRows
                        ? 'gap-0 px-1 py-0.5'
                        : 'gap-0.5 rounded-lg px-2.5 py-2.5',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/25',
                    'hover:border-slate-200/90 hover:bg-slate-50/80',
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
                        embedded ? 'mt-0.5 h-1.5 w-1.5 ring-1' : modalCompactRows ? 'h-1.5 w-1.5 ring-1' : 'mt-1.5 h-2.5 w-2.5',
                      )}
                      style={{ backgroundColor: dotColor }}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          'm-0 truncate font-semibold text-slate-900',
                          embedded ? 'text-[11px] leading-tight' : modalCompactRows ? 'text-[10px] leading-tight' : 'text-sm',
                        )}
                      >
                        {row.label}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p
                        className={cn(
                          'm-0 font-semibold tabular-nums text-slate-900',
                          embedded ? 'text-[11px] leading-tight' : modalCompactRows ? 'text-[10px] leading-tight' : 'text-sm',
                        )}
                      >
                        {countStr}
                        {pctParen ? (
                          <span
                            className={cn(
                              'font-semibold tabular-nums text-teal-700/90',
                              embedded
                                ? 'text-[10px] sm:text-[11px]'
                                : modalCompactRows
                                  ? 'text-[9px] sm:text-[10px]'
                                  : 'text-xs',
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
        {embedded && onViewAllTopics ? (
          <button
            type="button"
            className="mt-1.5 inline-flex w-fit max-w-full shrink-0 cursor-pointer select-none items-center gap-1 self-center rounded-lg border border-slate-200/80 bg-slate-50/50 px-2.5 py-1.5 text-left text-[11px] font-semibold text-teal-700 transition-colors hover:border-teal-200/80 hover:bg-teal-50/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/25 sm:text-xs"
            aria-label={
              hasMoreThanCap
                ? 'View all topics — open chart and full list in a larger view'
                : 'View all topics — open chart and list in a larger view'
            }
            onClick={onViewAllTopics}
          >
            <span>View all topics</span>
            <ChevronRight className="h-3 w-3 shrink-0 text-teal-600 sm:h-3.5 sm:w-3.5" strokeWidth={2.25} aria-hidden />
          </button>
        ) : null}
    </div>
  );
}
