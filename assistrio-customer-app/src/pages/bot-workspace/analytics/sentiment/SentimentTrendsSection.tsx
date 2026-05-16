import { useMemo } from 'react';
import type { CustomerSentimentAnalyticsResponse } from '@/api/types';
import { formatAnalyticsInteger } from '@/lib/analyticsFormat';
import { sentimentChartTimeSeriesPoints, type SentimentMetricMode } from '@/lib/sentimentAnalyticsQuery';
import { cn } from '@/lib/utils';
import { AnalyticsChartCard } from '../shared/AnalyticsChartCard';
import { TOPICS_ANALYTICS_SECTION_CARD_CLASS } from '../topics/topicsAnalyticsSectionLayout';
import { SentimentChartStyleTabs } from './SentimentChartStyleTabs';
import { SentimentDonutChart } from './SentimentDonutChart';
import { SentimentLabelRankingCard } from './SentimentLabelRankingCard';
import { SentimentOverTimeChart } from './SentimentOverTimeChart';
import { SentimentOverTimeRechartsChart } from './SentimentOverTimeRechartsChart';
import {
  buildSentimentRankingRows,
  sentimentTrendChartTitle,
  type SentimentChartStyle,
} from './sentimentTrendsChartHelpers';

type Props = {
  data: CustomerSentimentAnalyticsResponse;
  metricMode: SentimentMetricMode;
  chartStyle: SentimentChartStyle;
  onChartStyleChange: (v: SentimentChartStyle) => void;
  hiddenSeriesIds: string[];
  onToggleSeries: (id: string) => void;
  disabled: boolean;
};

export function SentimentTrendsSection({
  data,
  metricMode,
  chartStyle,
  onChartStyleChange,
  hiddenSeriesIds,
  onToggleSeries,
  disabled,
}: Props) {
  const chartPoints = useMemo(
    () => sentimentChartTimeSeriesPoints(data, metricMode),
    [data, metricMode],
  );

  const { rows: rankingRows, seriesOrder } = useMemo(
    () => buildSentimentRankingRows(data.sentimentBreakdown, metricMode),
    [data.sentimentBreakdown, metricMode],
  );

  const labelById = useMemo(
    () => new Map(rankingRows.map((r) => [r.id, r.label] as const)),
    [rankingRows],
  );

  const visibleSeriesOrder = useMemo(
    () => seriesOrder.filter((id) => !hiddenSeriesIds.includes(id)),
    [seriesOrder, hiddenSeriesIds],
  );

  const visibleRankingRows = useMemo(
    () => rankingRows.filter((r) => !hiddenSeriesIds.includes(r.id)),
    [rankingRows, hiddenSeriesIds],
  );

  const isConv = metricMode === 'conversations';
  const countUnit = isConv ? 'chats' : 'messages';
  const classifiedTotal = isConv ? data.summary.classifiedConversations : data.summary.classifiedMessages;
  const classifiedLabel = isConv ? 'Classified chats' : 'Classified messages';
  const rankingTitle = isConv ? 'Sentiment ranking by chats' : 'Sentiment ranking by messages';

  const description = isConv
    ? 'Each chat is counted once in the bucket when it started. One sentiment label per thread (mixed when the chat has more than one label).'
    : 'Volume by time bucket (user messages). Use the list to show or hide series on the chart.';

  const chartBlock =
    chartStyle === 'trend' ? (
      <SentimentOverTimeRechartsChart
        points={chartPoints}
        granularity={data.range.granularity}
        colorSeriesOrder={seriesOrder}
        chartSeriesOrder={visibleSeriesOrder as string[]}
        labelById={labelById}
        chartVariant="area"
        countUnit={countUnit}
      />
    ) : chartStyle === 'distribution' ? (
      <SentimentDonutChart rankingRows={visibleRankingRows} countUnit={countUnit} />
    ) : (
      <SentimentOverTimeChart
        points={chartPoints}
        granularity={data.range.granularity}
        hiddenSeriesIds={hiddenSeriesIds}
        countUnit={countUnit}
      />
    );

  const sectionTitle = sentimentTrendChartTitle(chartStyle);

  return (
    <AnalyticsChartCard
      title={sectionTitle}
      description={description}
      titleAside={
        <div className="flex w-full min-w-0 justify-end sm:max-w-[28rem]">
          <SentimentChartStyleTabs value={chartStyle} onChange={onChartStyleChange} disabled={disabled} />
        </div>
      }
      bodyClassName={cn(
        'flex min-h-0 flex-1 flex-col',
        chartStyle === 'bar' ? '!overflow-y-hidden' : '!overflow-y-auto',
      )}
      noMaxHeight
      className={cn(
        'overflow-hidden border-slate-100/95 shadow-[0_1px_3px_rgba(15,23,42,0.06)]',
        chartStyle === 'bar'
          ? 'h-auto min-h-0 max-h-none'
          : TOPICS_ANALYTICS_SECTION_CARD_CLASS,
      )}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-6 p-3 sm:p-5 lg:flex-row lg:items-stretch lg:gap-0">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:pr-6">{chartBlock}</div>
        <aside className="flex min-h-0 w-full shrink-0 flex-col overflow-hidden border-t border-slate-200/90 pt-6 lg:h-full lg:max-w-[min(100%,24rem)] lg:w-[34%] lg:flex-shrink-0 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
          <div className="shrink-0">
            <p className="m-0 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{classifiedLabel}</p>
            <p className="m-0 mt-0.5 text-xl font-semibold tabular-nums tracking-tight text-slate-900">
              {formatAnalyticsInteger(classifiedTotal)}
            </p>
            <div className="mt-2 border-b border-slate-200/90" role="presentation" />
          </div>
          <h3 className="m-0 mt-2 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {rankingTitle}
          </h3>
          <div className="mt-2 flex min-h-[10.5rem] min-w-0 flex-1 flex-col overflow-hidden lg:min-h-0">
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-slate-50 p-1">
              <SentimentLabelRankingCard
                rankingRows={rankingRows}
                hiddenSeriesIds={hiddenSeriesIds}
                onToggleSeries={onToggleSeries}
                embedded
                countUnit={countUnit}
              />
            </div>
          </div>
        </aside>
      </div>
    </AnalyticsChartCard>
  );
}
