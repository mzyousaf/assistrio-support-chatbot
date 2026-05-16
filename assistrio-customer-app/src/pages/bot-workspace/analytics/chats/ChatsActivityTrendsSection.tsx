import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CustomerChatsAnalyticsResponse } from '@/api/types';
import { formatAnalyticsNumber } from '@/lib/analyticsFormat';
import { cn } from '@/lib/utils';
import { AnalyticsChartCard } from '../shared/AnalyticsChartCard';
import {
  ANALYTICS_SPLIT_CHART_MAIN_CLASS,
  ANALYTICS_SPLIT_CHART_ROW_CLASS,
  ANALYTICS_SPLIT_SIDEBAR_34_CLASS,
} from '../shared/analyticsChartTheme';
import { TOPICS_ANALYTICS_SECTION_CARD_CLASS } from '../topics/topicsAnalyticsSectionLayout';
import { ChatsActivityOverTimeChart } from './ChatsActivityOverTimeChart';
import {
  ChatsActivityVolumeRankingCard,
  type ChatsVolumeRankingRow,
} from './ChatsActivityVolumeRankingCard';
import { CHATS_ACTIVITY_SERIES, type ChatsActivitySeriesId } from './chatsActivityChartTheme';

const SERIES_ORDER: ChatsActivitySeriesId[] = CHATS_ACTIVITY_SERIES.map((s) => s.id);

type Props = {
  data: CustomerChatsAnalyticsResponse;
};

export function ChatsActivityTrendsSection({ data }: Props) {
  const { totalConversations, totalMessages, averageMessagesPerConversation } = data.summary;
  const [hiddenSeriesIds, setHiddenSeriesIds] = useState<string[]>([]);

  const volumeRows: ChatsVolumeRankingRow[] = useMemo(
    () =>
      CHATS_ACTIVITY_SERIES.map((s) => ({
        id: s.id,
        label: s.label,
        color: s.color,
        count: s.id === 'conversations' ? totalConversations : totalMessages,
      })),
    [totalConversations, totalMessages],
  );

  const rankingKey = useMemo(
    () =>
      `${SERIES_ORDER.join('\0')}|${totalConversations}|${totalMessages}|${data.range.from}|${data.range.to}`,
    [totalConversations, totalMessages, data.range.from, data.range.to],
  );

  useEffect(() => {
    const zeroIds = volumeRows.filter((r) => r.count <= 0).map((r) => r.id);
    setHiddenSeriesIds(zeroIds);
  }, [rankingKey, volumeRows]);

  const toggleSeries = useCallback((id: ChatsActivitySeriesId) => {
    setHiddenSeriesIds((prev) => {
      const isCurrentlyHidden = prev.includes(id);
      const visibleCount = SERIES_ORDER.filter((x) => !prev.includes(x)).length;
      if (!isCurrentlyHidden && visibleCount <= 1) return prev;
      if (isCurrentlyHidden) return prev.filter((x) => x !== id);
      return [...prev, id];
    });
  }, []);

  return (
    <AnalyticsChartCard
      title="Activity over time"
      description="Stacked volume by time bucket — conversations and messages combined per period."
      bodyClassName="flex min-h-0 flex-1 flex-col !overflow-y-auto"
      noMaxHeight
      className={cn(
        'overflow-hidden border-slate-100/95 shadow-[0_1px_3px_rgba(15,23,42,0.06)]',
        TOPICS_ANALYTICS_SECTION_CARD_CLASS,
      )}
    >
      <div className={ANALYTICS_SPLIT_CHART_ROW_CLASS}>
        <div className={ANALYTICS_SPLIT_CHART_MAIN_CLASS}>
          <ChatsActivityOverTimeChart
            timeSeries={data.timeSeries}
            granularity={data.range.granularity}
            hiddenSeriesIds={hiddenSeriesIds}
          />
        </div>
        <aside className={ANALYTICS_SPLIT_SIDEBAR_34_CLASS}>
          <div className="shrink-0 px-2 py-1.5">
            <p className="m-0 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Avg messages / chat</p>
            <p className="m-0 mt-2 text-xl font-semibold tabular-nums tracking-tight text-slate-900">
              {formatAnalyticsNumber(averageMessagesPerConversation, { maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="mt-3 shrink-0 border-b border-slate-200/90" role="presentation" />
          <h3 className="m-0 mt-2 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Volume in range
          </h3>
          <p className="m-0 mt-1 shrink-0 max-w-full text-[10px] leading-snug text-slate-500">
            Tap a row to show or hide that series on the chart
          </p>
          <div className="mt-2 w-full shrink-0 rounded-lg border border-slate-200/80 bg-slate-50/60 p-1">
            <ChatsActivityVolumeRankingCard
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
