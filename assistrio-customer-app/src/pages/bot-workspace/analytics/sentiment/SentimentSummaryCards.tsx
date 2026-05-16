import type {
  CustomerChatsAnalyticsGranularity,
  CustomerSentimentAnalyticsSummary,
  CustomerSentimentAnalyticsTimeSeriesPoint,
  CustomerSentimentBreakdownItem,
} from '@/api/types';
import type { SentimentMetricMode } from '@/lib/sentimentAnalyticsQuery';
import { cn } from '@/lib/utils';
import { AverageSentimentFaceMeter, resolveAverageSentimentFace } from './AverageSentimentFaceMeter';
import { SentimentKpiMiniDistribution } from './SentimentKpiMiniDistribution';
import { SentimentKpiMiniTrend } from './SentimentKpiMiniTrend';

type Props = {
  summary: CustomerSentimentAnalyticsSummary;
  dominantLabel: string;
  sentimentBreakdown: CustomerSentimentBreakdownItem[];
  timeSeries: CustomerSentimentAnalyticsTimeSeriesPoint[];
  granularity: CustomerChatsAnalyticsGranularity;
  metricMode: SentimentMetricMode;
};

function kpiCardClass(primary?: boolean, borderless?: boolean) {
  return cn(
    'flex flex-col rounded-xl bg-white p-3 shadow-[0_1px_3px_rgba(15,23,42,0.05)] transition-[box-shadow] duration-200 sm:p-4',
    !borderless && 'border',
    !borderless &&
      (primary
        ? 'border-teal-100/90 hover:border-teal-200/80 hover:shadow-[0_4px_14px_rgba(15,23,42,0.07)]'
        : 'border-slate-100 hover:border-slate-200/90 hover:shadow-[0_4px_14px_rgba(15,23,42,0.06)]'),
  );
}

function CardTitle({
  children,
  compact,
  labelClassName,
}: {
  children: string;
  compact?: boolean;
  /** e.g. primary teal when highlighting this card header */
  labelClassName?: string;
}) {
  return (
    <div className="shrink-0">
      <p
        className={cn(
          'm-0 text-[11px] font-semibold uppercase tracking-[0.06em]',
          labelClassName ?? 'text-slate-500',
        )}
      >
        {children}
      </p>
      <div
        className={cn(
          'h-0.5 w-9 rounded-full bg-gradient-to-r from-teal-400/90 to-teal-200/40',
          compact ? 'mt-1.5' : 'mt-2',
        )}
        aria-hidden
      />
    </div>
  );
}

export function SentimentSummaryCards({
  summary,
  dominantLabel,
  sentimentBreakdown,
  timeSeries,
  granularity,
  metricMode,
}: Props) {
  const averageFace = resolveAverageSentimentFace(summary.averageSentimentScore);

  return (
    <div className="grid w-full min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 sm:items-stretch">
      <section className={cn(kpiCardClass(true, true), 'flex min-h-0 min-w-0 flex-col')}>
        <div className="flex shrink-0 items-center justify-between gap-2">
          <CardTitle compact>Average sentiment</CardTitle>
          <span
            role="img"
            aria-label={averageFace?.label ?? 'No average score'}
            data-testid="average-sentiment-face-meter"
            data-face-id={averageFace?.id ?? 'none'}
          >
            <AverageSentimentFaceMeter score={summary.averageSentimentScore} iconOnly />
          </span>
        </div>
        <p
          className={cn(
            'm-0 mt-3 shrink-0 text-xl font-semibold leading-tight tracking-tight sm:text-2xl',
            averageFace?.iconClass ?? 'text-slate-400',
          )}
          data-testid="average-sentiment-band-label"
        >
          {averageFace?.label ?? '—'}
        </p>
        <div className="mt-auto w-full min-w-0 pt-3">
          <SentimentKpiMiniTrend
            points={timeSeries}
            granularity={granularity}
            className="mt-0"
            chartHeight={36}
          />
        </div>
      </section>

      <section className={cn(kpiCardClass(true, true), 'flex min-h-0 min-w-0 flex-col')}>
        <CardTitle compact>Dominant sentiment</CardTitle>
        <p className="m-0 mt-3 shrink-0 text-xl font-semibold leading-tight tracking-tight text-slate-900 sm:text-2xl">
          {dominantLabel}
        </p>
        <div className="mt-auto w-full min-w-0 pt-3">
          <SentimentKpiMiniDistribution
            breakdown={sentimentBreakdown}
            metricMode={metricMode}
            className="mt-0"
            chartHeight={36}
          />
        </div>
      </section>
    </div>
  );
}
