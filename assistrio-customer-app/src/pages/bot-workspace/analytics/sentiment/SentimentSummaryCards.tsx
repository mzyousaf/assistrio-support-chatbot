import type {
  CustomerChatsAnalyticsGranularity,
  CustomerSentimentAnalyticsSummary,
  CustomerSentimentAnalyticsTimeSeriesPoint,
  CustomerSentimentBreakdownItem,
} from '@/api/types';
import type { SentimentMetricMode } from '@/lib/sentimentAnalyticsQuery';
import { cn } from '@/lib/utils';
import {
  AnalyticsKpiGrid,
  type AnalyticsKpiItem,
} from '@/pages/bot-workspace/analytics/shared/AnalyticsKpiGrid';
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

export function SentimentSummaryCards({
  summary,
  dominantLabel,
  sentimentBreakdown,
  timeSeries,
  granularity,
  metricMode,
}: Props) {
  const averageFace = resolveAverageSentimentFace(summary.averageSentimentScore);
  const averageLabel = averageFace?.label ?? '—';

  const cards: AnalyticsKpiItem[] = [
    {
      label: 'Average sentiment',
      value: '',
      infoTooltip: 'Band from the average score (−1…1) on classified traffic — icon reflects the same bucket.',
      headerInline: true,
      headerTrailingSlot: (
        <span
          className={cn(
            'inline-flex max-w-full min-w-0 items-center gap-2 rounded-full border px-2.5 py-1.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]',
            averageFace
              ? 'border-slate-200/95 bg-gradient-to-r from-slate-50/95 to-white'
              : 'border-slate-100 bg-slate-50/90 text-slate-400',
          )}
          role="img"
          aria-label={averageFace ? `Average sentiment: ${averageLabel}` : 'No average score'}
        >
          <span data-testid="average-sentiment-face-meter" data-face-id={averageFace?.id ?? 'none'} className="flex shrink-0">
            <AverageSentimentFaceMeter score={summary.averageSentimentScore} iconOnly className="!size-7 sm:!size-8" />
          </span>
          <p
            className={cn(
              'm-0 max-w-[min(100%,11rem)] truncate text-xl font-semibold tabular-nums tracking-tight sm:text-2xl',
              averageFace ? 'text-slate-900' : 'text-slate-400',
            )}
            data-testid="average-sentiment-band-label"
          >
            {averageLabel}
          </p>
        </span>
      ),
      footer: <SentimentKpiMiniTrend points={timeSeries} granularity={granularity} className="mt-0" chartHeight={76} />,
    },
    {
      label: 'Dominant sentiment',
      value: dominantLabel,
      infoTooltip:
        metricMode === 'messages'
          ? 'Sentiment label with the highest classified user-message count in this range.'
          : 'Sentiment label with the highest classified conversation count in this range.',
      headerInline: true,
      footer: (
        <SentimentKpiMiniDistribution
          breakdown={sentimentBreakdown}
          metricMode={metricMode}
          className="mt-0"
          chartHeight={76}
        />
      ),
    },
  ];

  return <AnalyticsKpiGrid items={cards} columnsClassName="grid-cols-1 sm:grid-cols-3" />;
}
