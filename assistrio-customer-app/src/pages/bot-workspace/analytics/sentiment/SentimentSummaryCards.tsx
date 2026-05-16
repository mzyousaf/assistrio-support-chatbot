import type { ReactNode } from 'react';
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
import {
  AverageSentimentFaceMeter,
  resolveAverageSentimentFace,
} from './AverageSentimentFaceMeter';
import { SentimentKpiMiniDistribution } from './SentimentKpiMiniDistribution';
import { SentimentKpiMiniTrend } from './SentimentKpiMiniTrend';

/** Mirrors {@link AgentResourcesUsageSummaryCards} KPI title color. */
const KPI_TITLE_CLASS = 'text-slate-700';

/** Title row for sentiment KPIs — taller line than default analytics KPI label. */
const SENTIMENT_KPI_LABEL_CLASS = cn(
  KPI_TITLE_CLASS,
  'inline-flex min-h-[2.5rem] shrink-0 items-center self-start py-0.5 text-xs leading-snug sm:min-h-11 sm:text-sm',
);

function averageSentimentTileTooltip(averageFace: ReturnType<typeof resolveAverageSentimentFace>): ReactNode {
  return (
    <div className="space-y-1 text-left">
      <p className="m-0 text-[11px] font-semibold uppercase tracking-wide text-slate-300">Average sentiment</p>
      <p className="m-0 max-w-[15rem] text-[0.75rem] font-medium leading-snug text-slate-50">
        {averageFace ? (
          <>
            How visitors overall come across in messages we could read for your filters.{' '}
            <span className="font-semibold text-white">{averageFace.label}</span> is the everyday label for that overall mood —
            the little face matches it.
          </>
        ) : (
          <>Once there are enough assessed messages in this range, an overall mood label and face will show on the card.</>
        )}
      </p>
    </div>
  );
}

function dominantSentimentTileTooltip(metricMode: SentimentMetricMode): ReactNode {
  const detail =
    metricMode === 'messages'
      ? 'The feeling that shows up most often on visitor messages in this period.'
      : 'The feeling that shows up most often across conversations in this period.';
  return (
    <div className="space-y-1">
      <p className="m-0 text-[11px] font-semibold uppercase tracking-wide text-slate-300">Dominant sentiment</p>
      <p className="m-0 max-w-[15rem] text-[0.75rem] font-medium leading-snug text-slate-50">{detail}</p>
    </div>
  );
}

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
      labelClassName: SENTIMENT_KPI_LABEL_CLASS,
      value: averageLabel,
      valueClassName: averageFace?.iconClass ?? 'text-slate-400',
      valueTestId: 'average-sentiment-band-label',
      valueAddon: (
        <span
          data-testid="average-sentiment-face-meter"
          data-face-id={averageFace?.id ?? 'none'}
          className="inline-flex shrink-0 items-center"
          aria-hidden
        >
          <AverageSentimentFaceMeter score={summary.averageSentimentScore} iconOnly className="!size-8 sm:!size-9" />
        </span>
      ),
      headerInline: true,
      tileTooltip: averageSentimentTileTooltip(averageFace),
      footer: <SentimentKpiMiniTrend points={timeSeries} granularity={granularity} className="mt-0" chartHeight={76} />,
    },
    {
      label: 'Dominant sentiment',
      labelClassName: SENTIMENT_KPI_LABEL_CLASS,
      value: dominantLabel,
      headerInline: true,
      tileTooltip: dominantSentimentTileTooltip(metricMode),
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

  return <AnalyticsKpiGrid items={cards} columnsClassName="grid-cols-1 sm:grid-cols-2" />;
}
