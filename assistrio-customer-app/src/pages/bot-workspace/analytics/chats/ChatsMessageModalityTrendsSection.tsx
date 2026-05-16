import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CustomerChatsAnalyticsResponse } from '@/api/types';
import { cn } from '@/lib/utils';
import { AnalyticsChartCard } from '../shared/AnalyticsChartCard';
import {
  ANALYTICS_SPLIT_CHART_MAIN_CLASS,
  ANALYTICS_SPLIT_CHART_ROW_CLASS,
  ANALYTICS_SPLIT_SIDEBAR_34_CLASS,
} from '../shared/analyticsChartTheme';
import {
  AnalyticsTrendDistributionTabs,
  type AnalyticsTrendDistributionTab,
} from '../shared/AnalyticsTrendDistributionTabs';
import { TOPICS_ANALYTICS_SECTION_CARD_CLASS } from '../topics/topicsAnalyticsSectionLayout';
import {
  CHATS_MESSAGE_MODALITY_SERIES,
  type ChatsMessageModalitySeriesId,
} from './chatsMessageModalityChartTheme';
import { ChatsMessageModalityDistributionDonut } from './ChatsMessageModalityDistributionDonut';
import { ChatsMessageModalityOverTimeChart } from './ChatsMessageModalityOverTimeChart';
import {
  ChatsMessageModalityRankingCard,
  type ChatsMessageModalityRankingRow,
} from './ChatsMessageModalityRankingCard';

const SERIES_ORDER: ChatsMessageModalitySeriesId[] = CHATS_MESSAGE_MODALITY_SERIES.map((s) => s.id);

type Props = {
  data: CustomerChatsAnalyticsResponse;
};

export function ChatsMessageModalityTrendsSection({ data }: Props) {
  const { totalUserMessages, userTextMessages, userVoiceMessages } = data.summary;
  const userTotal =
    totalUserMessages != null && Number.isFinite(totalUserMessages)
      ? Math.max(0, Math.trunc(totalUserMessages))
      : Math.max(0, (userTextMessages ?? 0) + (userVoiceMessages ?? 0));
  const [chartView, setChartView] = useState<AnalyticsTrendDistributionTab>('trends');
  const [hiddenSeriesIds, setHiddenSeriesIds] = useState<string[]>([]);

  const volumeRows: ChatsMessageModalityRankingRow[] = useMemo(
    () => [
      {
        id: 'userMessages',
        label: 'User messages',
        color: CHATS_MESSAGE_MODALITY_SERIES[0].color,
        count: userTotal,
      },
      {
        id: 'textMessages',
        label: 'User text messages',
        color: CHATS_MESSAGE_MODALITY_SERIES[1].color,
        count: userTextMessages ?? 0,
      },
      {
        id: 'voiceMessages',
        label: 'User voice messages',
        color: CHATS_MESSAGE_MODALITY_SERIES[2].color,
        count: userVoiceMessages ?? 0,
      },
    ],
    [userTotal, userTextMessages, userVoiceMessages],
  );

  const rankingKey = useMemo(
    () =>
      `${SERIES_ORDER.join('\0')}|${userTotal}|${userTextMessages}|${userVoiceMessages}|${data.range.from}|${data.range.to}`,
    [userTotal, userTextMessages, userVoiceMessages, data.range.from, data.range.to],
  );

  useEffect(() => {
    const zeroIds = volumeRows.filter((r) => r.count <= 0).map((r) => r.id);
    setHiddenSeriesIds(zeroIds);
  }, [rankingKey, volumeRows]);

  const toggleSeries = useCallback((id: ChatsMessageModalitySeriesId) => {
    setHiddenSeriesIds((prev) => {
      const isCurrentlyHidden = prev.includes(id);
      const visibleCount = SERIES_ORDER.filter((x) => !prev.includes(x)).length;
      if (!isCurrentlyHidden && visibleCount <= 1) return prev;
      if (isCurrentlyHidden) return prev.filter((x) => x !== id);
      return [...prev, id];
    });
  }, []);

  const sectionTitle =
    chartView === 'trends' ? 'Message trends' : 'Message distribution';
  const sectionDescription =
    chartView === 'trends'
      ? 'User message volume (teal area) with text vs voice breakdown as lines (hollow markers). Assistant replies are excluded from the area.'
      : 'Outer ring shows user messages per time bucket (same scale as the teal trend). Inner disk shows text, voice, and other user messages for the range (enable modalities in the list for the inner split).';

  const chartBlock =
    chartView === 'trends' ? (
      <ChatsMessageModalityOverTimeChart
        timeSeries={data.timeSeries}
        granularity={data.range.granularity}
        hiddenSeriesIds={hiddenSeriesIds}
      />
    ) : (
      <ChatsMessageModalityDistributionDonut
        timeSeries={data.timeSeries}
        granularity={data.range.granularity}
        userTotal={userTotal}
        userText={userTextMessages ?? 0}
        userVoice={userVoiceMessages ?? 0}
        hiddenSeriesIds={hiddenSeriesIds}
        fillHeight
      />
    );

  return (
    <AnalyticsChartCard
      title={sectionTitle}
      description={sectionDescription}
      titleAside={
        <div className="flex w-full min-w-0 justify-end sm:max-w-[28rem]">
          <AnalyticsTrendDistributionTabs value={chartView} onChange={setChartView} />
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
        <aside className={ANALYTICS_SPLIT_SIDEBAR_34_CLASS}>
          <h3 className="m-0 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            In this range
          </h3>
          <p className="m-0 mt-1 shrink-0 max-w-full text-[10px] leading-snug text-slate-500">
            Tap a row to show or hide that series on the chart
          </p>
          <div className="mt-2 w-full shrink-0 rounded-lg border border-slate-200/80 bg-slate-50/60 p-1">
            <ChatsMessageModalityRankingCard
              rows={volumeRows}
              hiddenSeriesIds={hiddenSeriesIds}
              onToggleSeries={toggleSeries}
            />
          </div>
        </aside>
      </div>
    </AnalyticsChartCard>
  );
}
