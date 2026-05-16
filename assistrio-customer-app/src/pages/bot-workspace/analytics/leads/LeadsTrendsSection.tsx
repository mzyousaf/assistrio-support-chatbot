import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CustomerLeadsAnalyticsResponse } from '@/api/types';
import { cn } from '@/lib/utils';
import { AnalyticsChartCard } from '../shared/AnalyticsChartCard';
import { TOPICS_ANALYTICS_SECTION_CARD_CLASS } from '../topics/topicsAnalyticsSectionLayout';
import { LEADS_OVER_TIME_SERIES, LeadsOverTimeTrendChart } from './LeadsOverTimeTrendChart';
import { LeadsVolumeRankingCard, type LeadsVolumeRankingRow } from './LeadsVolumeRankingCard';

const SERIES_ORDER = LEADS_OVER_TIME_SERIES.map((s) => s.id);

type Props = {
  data: CustomerLeadsAnalyticsResponse;
};

export function LeadsTrendsSection({ data }: Props) {
  const [hiddenSeriesIds, setHiddenSeriesIds] = useState<string[]>([]);

  const volumeRows: LeadsVolumeRankingRow[] = useMemo(
    () =>
      LEADS_OVER_TIME_SERIES.map((s) => ({
        id: s.id,
        label: s.label,
        color: s.color,
        count:
          s.id === 'conversations'
            ? Math.max(0, Math.trunc(data.summary.totalConversations ?? 0))
            : Math.max(0, Math.trunc(data.summary.totalLeads ?? 0)),
      })),
    [data.summary.totalConversations, data.summary.totalLeads],
  );

  const rankingKey = useMemo(
    () =>
      `${SERIES_ORDER.join('\0')}|${data.summary.totalConversations}|${data.summary.totalLeads}|${data.range.from}|${data.range.to}`,
    [data.summary.totalConversations, data.summary.totalLeads, data.range.from, data.range.to],
  );

  useEffect(() => {
    const zeroIds = volumeRows.filter((r) => r.count <= 0).map((r) => r.id);
    setHiddenSeriesIds(zeroIds);
  }, [rankingKey, volumeRows]);

  const toggleSeries = useCallback((id: LeadsVolumeRankingRow['id']) => {
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
      title="Leads over time"
      description="Stacked volume by time bucket — conversations and qualified leads combined per period."
      bodyClassName={cn('flex min-h-0 flex-1 flex-col !overflow-y-auto')}
      noMaxHeight
      className={cn(
        'overflow-hidden border-slate-100/95 shadow-[0_1px_3px_rgba(15,23,42,0.06)]',
        TOPICS_ANALYTICS_SECTION_CARD_CLASS,
      )}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-6 p-3 sm:p-5 lg:flex-row lg:items-stretch lg:gap-0">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:pr-6">
          <LeadsOverTimeTrendChart
            points={data.timeSeries}
            granularity={data.range.granularity}
            hiddenSeriesIds={hiddenSeriesIds}
          />
        </div>
        <aside className="flex w-full shrink-0 flex-col border-t border-slate-200/90 pt-6 lg:w-[34%] lg:max-w-[min(100%,24rem)] lg:flex-shrink-0 lg:self-start lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
          <h3 className="m-0 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Volume in range
          </h3>
          <p className="m-0 mt-1 shrink-0 max-w-full text-[10px] leading-snug text-slate-500">
            Tap a row to show or hide that series on the chart. At least one stays visible.
          </p>
          <div className="mt-2 w-full shrink-0 rounded-lg border border-slate-200/80 bg-slate-50/60 p-1">
            <LeadsVolumeRankingCard
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
