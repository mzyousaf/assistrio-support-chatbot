import { useCallback, useEffect, useMemo, useState } from 'react';
import { Tags } from 'lucide-react';
import { getCustomerBotTopicsAnalytics } from '@/api/customerApi';
import type { CustomerTopicsAnalyticsResponse } from '@/api/types';
import { safeClientString } from '@/lib/safeClientString';
import {
  TOPICS_ANALYTICS_DEFAULTS,
  buildTopicsAnalyticsApiParams,
  type TopicsAnalyticsUiState,
} from '@/lib/topicsAnalyticsQuery';
import { WorkspaceContentContainer } from '@/layout/workspace-layout';
import { useBotWorkspace } from '../../BotWorkspaceContext';
import { AnalyticsErrorState } from '../shared/AnalyticsErrorState';
import { AnalyticsPageHeader } from '../shared/AnalyticsPageHeader';
import { ANALYTICS_TWO_CHART_ROW_GRID_CLASS } from '../shared/analyticsChartTheme';
import { TopicsAnalyticsFilterBar } from '../shared/AnalyticsInsightsFilterBars';
import { TopicsPageSkeleton } from './TopicsPageSkeleton';
import { TopicsTopicTrendsSection } from './TopicsTopicTrendsSection';
import { TopicsFastestGrowingSection } from './TopicsFastestGrowingSection';
import { TopicsTopicBySentimentSection } from './TopicsTopicBySentimentSection';
import { TopicsMetricModeTabs } from './TopicsMetricModeTabs';
import { buildTopicRankingRows, type TopicsBreakdownBundle, type TopicsChartStyle } from './topicsChartHelpers';

export function TopicsAnalyticsPage() {
  const { botId } = useBotWorkspace();
  const [ui, setUi] = useState<TopicsAnalyticsUiState>(() => ({ ...TOPICS_ANALYTICS_DEFAULTS }));
  const [chartStyle, setChartStyle] = useState<TopicsChartStyle>('line');
  const [hiddenSeriesIds, setHiddenSeriesIds] = useState<string[]>([]);
  const [data, setData] = useState<CustomerTopicsAnalyticsResponse | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'ok' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  const params = useMemo(() => buildTopicsAnalyticsApiParams(ui), [ui]);

  const load = useCallback(async () => {
    if (!botId) return;
    setLoadState('loading');
    setErrorMessage('');
    const res = await getCustomerBotTopicsAnalytics(botId, params);
    if (!res.ok) {
      setData(null);
      setLoadState('error');
      setErrorMessage(safeClientString(res.error, 'Something went wrong.'));
      return;
    }
    setData(res.data);
    setLoadState('ok');
  }, [botId, params]);

  useEffect(() => {
    void load();
  }, [load]);

  const breakdownBundle: TopicsBreakdownBundle | null = useMemo(() => {
    if (!data) return null;
    return {
      topicBreakdownByMessages: data.topicBreakdownByMessages ?? data.topicBreakdown ?? [],
      topicBreakdownByConversations: data.topicBreakdownByConversations ?? [],
    };
  }, [data]);

  const rankingKey = useMemo(() => {
    if (!data || !breakdownBundle) return '';
    const { seriesOrder } = buildTopicRankingRows(data.summary, ui.metricMode, breakdownBundle);
    return `${seriesOrder.join('\0')}|${ui.metricMode}`;
  }, [data, breakdownBundle, ui.metricMode]);

  useEffect(() => {
    setHiddenSeriesIds([]);
  }, [rankingKey]);

  const toggleSeries = useCallback(
    (id: string) => {
      if (!data) return;
      const bundle: TopicsBreakdownBundle = {
        topicBreakdownByMessages: data.topicBreakdownByMessages ?? data.topicBreakdown ?? [],
        topicBreakdownByConversations: data.topicBreakdownByConversations ?? [],
      };
      const { seriesOrder } = buildTopicRankingRows(data.summary, ui.metricMode, bundle);
      setHiddenSeriesIds((prev) => {
        const isCurrentlyHidden = prev.includes(id);
        const visibleCount = seriesOrder.filter((x) => !prev.includes(x)).length;
        if (!isCurrentlyHidden && visibleCount <= 1) return prev;
        if (isCurrentlyHidden) return prev.filter((x) => x !== id);
        return [...prev, id];
      });
    },
    [data, ui.metricMode],
  );

  if (!botId) return null;

  const showSkeleton = loadState === 'loading' && !data;
  const showError = loadState === 'error';
  const showBody = data != null && !showError;
  const growthRows =
    ui.metricMode === 'messages'
      ? (data?.fastestGrowingByMessages ?? data?.fastestGrowingTopics ?? [])
      : (data?.fastestGrowingByConversations ?? []);
  const pageTitle = 'Topics';
  const pageSubtitle =
    ui.metricMode === 'messages'
      ? 'Distribution and score trends from topic-tagged user messages — counts and averages only.'
      : 'Distribution and score trends from conversations by primary topic — counts and averages only.';

  return (
    <WorkspaceContentContainer size="full">
      <div className="flex min-h-0 min-h-[calc(100svh-var(--nav-height)-1.5rem)] flex-1 flex-col overflow-hidden">
        <AnalyticsPageHeader
          title={pageTitle}
          titleIcon={Tags}
          subtitle={pageSubtitle}
          actions={
            <TopicsMetricModeTabs
              value={ui.metricMode}
              onChange={(metricMode) => setUi((s) => ({ ...s, metricMode }))}
              disabled={loadState === 'loading'}
            />
          }
          filters={
            <div className="flex flex-col gap-2">
              <TopicsAnalyticsFilterBar state={ui} onChange={setUi} disabled={loadState === 'loading'} />
              {ui.metricMode === 'messages' ? (
                <p className="m-0 max-w-3xl text-[11px] leading-snug text-slate-600">
                  {ui.messageTopicScope === 'all' ? (
                    <>One message can include multiple topics.</>
                  ) : (
                    <>Each message counts toward its primary topic only.</>
                  )}
                </p>
              ) : null}
            </div>
          }
        />

        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-gradient-to-b from-slate-50/90 to-slate-100/50 p-4 sm:p-6 md:p-8">
          <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
            {showSkeleton ? <TopicsPageSkeleton /> : null}
            {showError ? <AnalyticsErrorState onRetry={() => void load()} detail={errorMessage} /> : null}

            {showBody && data ? (
              <>
                <TopicsTopicTrendsSection
                  data={data}
                  metricMode={ui.metricMode}
                  chartStyle={chartStyle}
                  onChartStyleChange={setChartStyle}
                  hiddenSeriesIds={hiddenSeriesIds}
                  onToggleSeries={toggleSeries}
                  disabled={loadState === 'loading'}
                />

                <div className={ANALYTICS_TWO_CHART_ROW_GRID_CLASS}>
                  <div className="min-w-0">
                    <TopicsFastestGrowingSection rows={growthRows} metricMode={ui.metricMode} />
                  </div>
                  <div className="min-w-0">
                    <TopicsTopicBySentimentSection data={data} metricMode={ui.metricMode} />
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </WorkspaceContentContainer>
  );
}
