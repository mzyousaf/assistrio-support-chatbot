import { useCallback, useEffect, useMemo, useState } from 'react';
import { SmilePlus } from 'lucide-react';
import { getCustomerBotSentimentAnalytics } from '@/api/customerApi';
import type { CustomerSentimentAnalyticsResponse, CustomerSentimentLabelId } from '@/api/types';
import { safeClientString } from '@/lib/safeClientString';
import {
  SENTIMENT_ANALYTICS_DEFAULTS,
  buildSentimentAnalyticsApiParams,
  sentimentChartTimeSeriesPoints,
  type SentimentAnalyticsUiState,
} from '@/lib/sentimentAnalyticsQuery';
import { WorkspaceContentContainer } from '@/layout/workspace-layout';
import { useBotWorkspace } from '../../BotWorkspaceContext';
import { AnalyticsErrorState } from '../shared/AnalyticsErrorState';
import { AnalyticsPageHeader } from '../shared/AnalyticsPageHeader';
import { SentimentAnalyticsFilterBar } from '../shared/AnalyticsInsightsFilterBars';
import { SentimentPageSkeleton } from './SentimentPageSkeleton';
import { SentimentSummaryCards } from './SentimentSummaryCards';
import { SentimentTrendsSection } from './SentimentTrendsSection';
import { SentimentMetricModeTabs } from './SentimentMetricModeTabs';
import { buildSentimentRankingRows, type SentimentChartStyle } from './sentimentTrendsChartHelpers';

export function SentimentAnalyticsPage() {
  const { botId } = useBotWorkspace();
  const [ui, setUi] = useState<SentimentAnalyticsUiState>(() => ({ ...SENTIMENT_ANALYTICS_DEFAULTS }));
  const [chartStyle, setChartStyle] = useState<SentimentChartStyle>('trend');
  const [hiddenSeriesIds, setHiddenSeriesIds] = useState<string[]>([]);
  const [data, setData] = useState<CustomerSentimentAnalyticsResponse | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'ok' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  const params = useMemo(() => buildSentimentAnalyticsApiParams(ui), [ui]);

  const load = useCallback(async () => {
    if (!botId) return;
    setLoadState('loading');
    setErrorMessage('');
    const res = await getCustomerBotSentimentAnalytics(botId, params);
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

  const sentimentLabels = useMemo(() => {
    if (!data?.sentimentBreakdown) return {};
    return Object.fromEntries(data.sentimentBreakdown.map((r) => [r.sentiment, r.label])) as Partial<
      Record<CustomerSentimentLabelId, string>
    >;
  }, [data]);

  const dominantLabel = useMemo(() => {
    if (!data) return '—';
    const rows = data.sentimentBreakdown;
    if (!rows.length) return '—';
    const field = ui.metricMode === 'conversations' ? 'conversations' : 'messages';
    let best: (typeof rows)[0] | null = null;
    for (const r of rows) {
      const n = field === 'conversations' ? r.conversations : r.messages;
      const bn = best ? (field === 'conversations' ? best.conversations : best.messages) : -1;
      if (n > bn) best = r;
      else if (n === bn && n > 0 && best && r.sentiment.localeCompare(best.sentiment) < 0) best = r;
    }
    if (!best || (field === 'conversations' ? best.conversations : best.messages) <= 0) return '—';
    return best.label;
  }, [data, ui.metricMode]);

  const rankingKey = useMemo(() => {
    if (!data) return '';
    const { seriesOrder } = buildSentimentRankingRows(data.sentimentBreakdown, ui.metricMode);
    return `${seriesOrder.join('\0')}|${ui.metricMode}|${params.from ?? ''}|${params.to ?? ''}|${params.sentiment ?? ''}|${params.startedFrom ?? ''}|${params.includePreview}`;
  }, [data, params, ui.metricMode]);

  useEffect(() => {
    if (!data) {
      setHiddenSeriesIds([]);
      return;
    }
    const { rows, seriesOrder } = buildSentimentRankingRows(data.sentimentBreakdown, ui.metricMode);
    const zeroIds = seriesOrder.filter((id) => (rows.find((r) => r.id === id)?.count ?? 0) <= 0);
    setHiddenSeriesIds(zeroIds);
  }, [rankingKey, data, ui.metricMode]);

  const toggleSeries = useCallback(
    (id: string) => {
      if (!data) return;
      const { seriesOrder } = buildSentimentRankingRows(data.sentimentBreakdown, ui.metricMode);
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

  const pageSubtitle =
    ui.metricMode === 'messages'
      ? 'Distribution and score trends from classified user messages — counts and averages only.'
      : 'Distribution and score trends from classified conversations — counts and averages only.';

  const chartTimeSeries = useMemo(
    () => (data ? sentimentChartTimeSeriesPoints(data, ui.metricMode) : []),
    [data, ui.metricMode],
  );

  if (!botId) return null;

  const showSkeleton = loadState === 'loading' && !data;
  const showError = loadState === 'error';
  const showBody = data != null && !showError;

  return (
    <WorkspaceContentContainer size="full">
      <div className="flex min-h-0 min-h-[calc(100svh-var(--nav-height)-1.5rem)] flex-1 flex-col overflow-hidden">
        <AnalyticsPageHeader
          title="Sentiment"
          titleIcon={SmilePlus}
          subtitle={pageSubtitle}
          actions={
            <SentimentMetricModeTabs
              value={ui.metricMode}
              onChange={(metricMode) => setUi((s) => ({ ...s, metricMode }))}
              disabled={loadState === 'loading'}
            />
          }
          filters={
            <SentimentAnalyticsFilterBar
              state={ui}
              onChange={setUi}
              disabled={loadState === 'loading'}
              sentimentLabels={sentimentLabels}
            />
          }
        />

        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-gradient-to-b from-slate-50/90 to-slate-100/50 p-4 sm:p-6 md:p-8">
          <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
            {showSkeleton ? <SentimentPageSkeleton /> : null}
            {showError ? <AnalyticsErrorState onRetry={() => void load()} detail={errorMessage} /> : null}

            {showBody && data ? (
              <>
                <SentimentSummaryCards
                  summary={data.summary}
                  dominantLabel={dominantLabel}
                  sentimentBreakdown={data.sentimentBreakdown}
                  timeSeries={chartTimeSeries}
                  granularity={data.range.granularity}
                  metricMode={ui.metricMode}
                />
                <SentimentTrendsSection
                  data={data}
                  metricMode={ui.metricMode}
                  chartStyle={chartStyle}
                  onChartStyleChange={setChartStyle}
                  hiddenSeriesIds={hiddenSeriesIds}
                  onToggleSeries={toggleSeries}
                  disabled={loadState === 'loading'}
                />
              </>
            ) : null}
          </div>
        </div>
      </div>
    </WorkspaceContentContainer>
  );
}
