import { useMemo, useState } from 'react';
import type { CustomerTopicsAnalyticsResponse } from '@/api/types';
import { Button, Modal } from '@/components/ui';
import { formatAnalyticsInteger } from '@/lib/analyticsFormat';
import { cn } from '@/lib/utils';
import { AnalyticsChartCard } from '../shared/AnalyticsChartCard';
import {
  ANALYTICS_SPLIT_CHART_MAIN_CLASS,
  ANALYTICS_SPLIT_CHART_ROW_CLASS,
  ANALYTICS_SPLIT_SIDEBAR_32_CLASS,
  ANALYTICS_SPLIT_SIDEBAR_34_CLASS,
} from '../shared/analyticsChartTheme';
import { TopicsChartStyleTabs } from './TopicsChartStyleTabs';
import { TopicsDonutChart } from './TopicsDonutChart';
import { TopicsOverTimeChart } from './TopicsOverTimeChart';
import { TopicsTopicRankingCard, TOPIC_RANKING_MESSAGES_SIDEBAR_MAX, TOPIC_RANKING_SIDEBAR_MAX_VISIBLE } from './TopicsTopicRankingCard';
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

  const rankingListMaxVisible =
    metricMode === 'messages' ? TOPIC_RANKING_MESSAGES_SIDEBAR_MAX : TOPIC_RANKING_SIDEBAR_MAX_VISIBLE;

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
      <div className={ANALYTICS_SPLIT_CHART_ROW_CLASS}>
        <div className={ANALYTICS_SPLIT_CHART_MAIN_CLASS}>{chartBlock}</div>
        <aside className={ANALYTICS_SPLIT_SIDEBAR_32_CLASS}>
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
          <p className="m-0 mt-1 max-w-full text-[10px] leading-snug text-slate-500">
            Tap a row to show or hide that series on the chart
          </p>
          <div className="mt-2 flex min-h-0 min-w-0 flex-1 flex-col">
            <TopicsTopicRankingCard
              rankingRows={rankingRows}
              seriesOrder={seriesOrder}
              metricMode={metricMode}
              hiddenSeriesIds={hiddenSeriesIds}
              onToggleSeries={onToggleSeries}
              embedded
              maxVisible={rankingListMaxVisible}
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
        className="max-h-[56rem] max-w-6xl"
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
          <div className="flex min-h-0 flex-row items-stretch gap-4 sm:gap-6">
            <div className="flex h-[350px] max-h-[350px] min-h-0 min-w-0 flex-1 flex-col">{chartBlock}</div>
            <aside className={cn(ANALYTICS_SPLIT_SIDEBAR_34_CLASS, 'h-[350px] max-h-[350px]')}>
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
              <p className="m-0 mt-1 max-w-full text-[10px] leading-snug text-slate-500">
                Tap a row to show or hide that series on the chart
              </p>
              <div className="mt-2 flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden overscroll-y-contain pr-0.5 [scrollbar-gutter:stable]">
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
