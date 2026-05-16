import { useMemo, useState } from 'react';
import type { CustomerTopicsAnalyticsResponse } from '@/api/types';
import { Button, Modal } from '@/components/ui';
import { formatAnalyticsInteger } from '@/lib/analyticsFormat';
import { cn } from '@/lib/utils';
import { AnalyticsChartCard } from '../shared/AnalyticsChartCard';
import { TopicsChartStyleTabs } from './TopicsChartStyleTabs';
import { TopicsDonutChart } from './TopicsDonutChart';
import { TopicsOverTimeChart } from './TopicsOverTimeChart';
import { TopicsTopicRankingCard } from './TopicsTopicRankingCard';
import {
  buildTopicRankingRows,
  topicsTrendChartTitle,
  type TopicsBreakdownBundle,
  type TopicsChartStyle,
  type TopicsMetricMode,
} from './topicsChartHelpers';
import { TOPICS_ANALYTICS_SECTION_CARD_CLASS } from './topicsAnalyticsSectionLayout';

type Props = {
  data: CustomerTopicsAnalyticsResponse;
  metricMode: TopicsMetricMode;
  chartStyle: TopicsChartStyle;
  onChartStyleChange: (v: TopicsChartStyle) => void;
  hiddenSeriesIds: string[];
  onToggleSeries: (id: string) => void;
  disabled: boolean;
};

export function TopicsTopicTrendsSection({
  data,
  metricMode,
  chartStyle,
  onChartStyleChange,
  hiddenSeriesIds,
  onToggleSeries,
  disabled,
}: Props) {
  const [topicTrendsExpandedOpen, setTopicTrendsExpandedOpen] = useState(false);

  const breakdown: TopicsBreakdownBundle = useMemo(
    () => ({
      topicBreakdownByMessages: data.topicBreakdownByMessages ?? data.topicBreakdown ?? [],
      topicBreakdownByConversations: data.topicBreakdownByConversations ?? [],
    }),
    [data],
  );

  const { rows: rankingRows, seriesOrder } = useMemo(
    () => buildTopicRankingRows(data.summary, metricMode, breakdown),
    [data.summary, metricMode, breakdown],
  );

  const timeSeriesPoints = useMemo(() => {
    if (metricMode === 'conversations') {
      return data.topicConversationTimeSeries?.length
        ? data.topicConversationTimeSeries
        : data.conversationTopicSeries ?? [];
    }
    return data.topicMessageTimeSeries?.length ? data.topicMessageTimeSeries : data.timeSeries ?? [];
  }, [data, metricMode]);

  const visibleSeriesOrder = useMemo(
    () => seriesOrder.filter((id) => !hiddenSeriesIds.includes(id)),
    [seriesOrder, hiddenSeriesIds],
  );

  const visibleRankingRows = useMemo(
    () => rankingRows.filter((r) => !hiddenSeriesIds.includes(r.id)),
    [rankingRows, hiddenSeriesIds],
  );

  const totalTopics = useMemo(() => {
    const { rows } = buildTopicRankingRows(data.summary, metricMode, breakdown);
    return rows.filter((r) => r.id !== 'unclassified').length;
  }, [data.summary, metricMode, breakdown]);

  const rankingTitle =
    metricMode === 'messages' ? 'Topic ranking by messages' : 'Topic ranking by conversations';
  const rankingHelper: string | null =
    metricMode === 'messages'
      ? null
      : 'Each chat is counted once by its conversation-level primary topic.';

  const description =
    metricMode === 'messages'
      ? 'Volume by time bucket (topic mentions). Unclassified counts user messages without topic labels.'
      : 'Distinct chats per time bucket by conversation primary topic.';

  const chartBlock =
    chartStyle === 'donut' ? (
      <TopicsDonutChart rankingRows={visibleRankingRows} seriesOrder={seriesOrder} metricMode={metricMode} />
    ) : (
      <TopicsOverTimeChart
        points={timeSeriesPoints}
        granularity={data.range.granularity}
        colorSeriesOrder={seriesOrder}
        chartSeriesOrder={visibleSeriesOrder}
        rankingRows={rankingRows}
        metricMode={metricMode}
      />
    );

  const sectionTitle = topicsTrendChartTitle(chartStyle);

  return (
    <AnalyticsChartCard
      title={sectionTitle}
      description={description}
      titleAside={
        <div className="flex w-full min-w-0 justify-end sm:max-w-[28rem]">
          <TopicsChartStyleTabs value={chartStyle} onChange={onChartStyleChange} disabled={disabled} />
        </div>
      }
      bodyClassName="flex min-h-0 flex-1 flex-col !overflow-y-auto"
      noMaxHeight
      className={cn(
        'overflow-hidden border-slate-100/95 shadow-[0_1px_3px_rgba(15,23,42,0.06)]',
        TOPICS_ANALYTICS_SECTION_CARD_CLASS,
      )}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-6 p-3 sm:p-5 lg:flex-row lg:items-stretch lg:gap-0">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:pr-6">{chartBlock}</div>
        <aside className="flex min-h-0 w-full shrink-0 flex-col overflow-hidden border-t border-slate-200/90 pt-6 lg:h-full lg:max-w-[min(100%,22rem)] lg:w-[32%] lg:flex-shrink-0 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
          <div className="shrink-0">
            <p className="m-0 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Total topics</p>
            <p className="m-0 mt-0.5 text-xl font-semibold tabular-nums tracking-tight text-slate-900">
              {formatAnalyticsInteger(totalTopics)}
            </p>
            <div className="mt-2 border-b border-slate-200/90" role="presentation" />
          </div>
          <h3 className="m-0 mt-2 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {rankingTitle}
          </h3>
          {rankingHelper ? (
            <p className="m-0 mt-1 max-w-full text-[10px] leading-snug text-slate-500">{rankingHelper}</p>
          ) : null}
          <div className={cn('flex min-h-0 min-w-0 flex-1 flex-col', rankingHelper ? 'mt-2' : 'mt-1')}>
            <TopicsTopicRankingCard
              rankingRows={rankingRows}
              seriesOrder={seriesOrder}
              metricMode={metricMode}
              hiddenSeriesIds={hiddenSeriesIds}
              onToggleSeries={onToggleSeries}
              embedded
              onViewAllTopics={() => setTopicTrendsExpandedOpen(true)}
            />
          </div>
        </aside>
      </div>
      <Modal
        open={topicTrendsExpandedOpen}
        onClose={() => setTopicTrendsExpandedOpen(false)}
        title={sectionTitle}
        description={description}
        size="lg"
        className="max-h-[min(94vh,56rem)] max-w-6xl"
        closeOnBackdropClick
        bodyClassName="min-h-0 px-4 py-4 sm:px-5 sm:py-5"
        footer={
          <Button type="button" variant="primary" size="sm" onClick={() => setTopicTrendsExpandedOpen(false)}>
            Got it!
          </Button>
        }
      >
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
            <TopicsChartStyleTabs value={chartStyle} onChange={onChartStyleChange} disabled={disabled} />
          </div>
          <div className="flex min-h-0 flex-col gap-6 lg:flex-row lg:items-stretch lg:gap-0">
            <div className="flex h-[350px] max-h-[350px] min-h-0 min-w-0 flex-1 flex-col lg:pr-6">{chartBlock}</div>
            <aside className="flex min-h-0 w-full max-h-[min(52vh,24rem)] shrink-0 flex-col overflow-hidden border-t border-slate-200/90 pt-5 lg:h-[350px] lg:max-h-[350px] lg:max-w-[min(100%,24rem)] lg:w-[34%] lg:flex-shrink-0 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
              <div className="shrink-0">
                <p className="m-0 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Total topics</p>
                <p className="m-0 mt-0.5 text-xl font-semibold tabular-nums tracking-tight text-slate-900">
                  {formatAnalyticsInteger(totalTopics)}
                </p>
                <div className="mt-2 border-b border-slate-200/90" role="presentation" />
              </div>
              <h3 className="m-0 mt-2 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {rankingTitle}
              </h3>
              {rankingHelper ? (
                <p className="m-0 mt-1 max-w-full text-[10px] leading-snug text-slate-500">{rankingHelper}</p>
              ) : null}
              <div
                className={cn(
                  'flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden overscroll-y-contain pr-0.5 [scrollbar-gutter:stable]',
                  rankingHelper ? 'mt-2' : 'mt-1',
                )}
              >
                <TopicsTopicRankingCard
                  rankingRows={rankingRows}
                  seriesOrder={seriesOrder}
                  metricMode={metricMode}
                  hiddenSeriesIds={hiddenSeriesIds}
                  onToggleSeries={onToggleSeries}
                  embedded={false}
                  compactRows
                  rankingListClassName="max-h-none"
                />
              </div>
            </aside>
          </div>
        </div>
      </Modal>
    </AnalyticsChartCard>
  );
}
