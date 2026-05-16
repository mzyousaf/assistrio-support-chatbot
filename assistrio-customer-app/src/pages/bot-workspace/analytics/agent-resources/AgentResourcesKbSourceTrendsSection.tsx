import { useCallback, useMemo, useState } from 'react';
import type {
  CustomerAgentResourcesKbPrimaryTypeBreakdownItem,
  CustomerAgentResourcesKbSummary,
  CustomerAgentResourcesKbTimePoint,
  CustomerChatsAnalyticsGranularity,
} from '@/api/types';
import { formatAnalyticsInteger } from '@/lib/analyticsFormat';
import { cn } from '@/lib/utils';
import {
  KB_SOURCE_COLOR,
  KB_SOURCE_DISPLAY_ORDER,
  KB_SOURCE_LABEL,
} from '@/pages/bot-workspace/analytics/agent-resources/agentResourcesKbSourceSeries';
import { AnalyticsChartCard } from '../shared/AnalyticsChartCard';
import { AnalyticsTrendDistributionTabs } from '../shared/AnalyticsTrendDistributionTabs';
import { TOPICS_ANALYTICS_SECTION_CARD_CLASS } from '../topics/topicsAnalyticsSectionLayout';
import { AgentResourcesKbSourceDistributionPieChart } from './AgentResourcesKbSourceDistributionPieChart';
import {
  AgentResourcesKbSourceUsageOverTimeChart,
  KB_SOURCE_AREA_CHART_SERIES_KEY,
} from './AgentResourcesKbSourceUsageOverTimeChart';
import { type KbSourceRankingRow, KbSourceTypeRankingCard } from './KbSourceTypeRankingCard';

const SECTION_DESCRIPTION_TRENDS =
  'Answers citing knowledge over time (teal area) with stacked primary-source mix — tap Knowledge base usage to toggle the area, or a row below to toggle bar types.';
const SECTION_DESCRIPTION_DISTRIBUTION =
  'Outer ring shows sourced answers per bucket (same scale as the teal trend). Inner disk shows primary source-type shares (same mix as the stacked bars).';

type Props = {
  summary: CustomerAgentResourcesKbSummary;
  timeSeries: CustomerAgentResourcesKbTimePoint[];
  sourceTypeBreakdown: CustomerAgentResourcesKbPrimaryTypeBreakdownItem[];
  granularity: CustomerChatsAnalyticsGranularity;
};

const KB_DISPLAY_SET = new Set<string>(KB_SOURCE_DISPLAY_ORDER);

function buildKbRankingRows(
  breakdown: CustomerAgentResourcesKbPrimaryTypeBreakdownItem[],
  points: CustomerAgentResourcesKbTimePoint[],
): KbSourceRankingRow[] {
  const counts = new Map<string, number>();
  const labels = new Map<string, string>();

  for (const t of KB_SOURCE_DISPLAY_ORDER) {
    counts.set(t, 0);
    labels.set(t, KB_SOURCE_LABEL[t]);
  }

  if (breakdown.length > 0) {
    for (const item of breakdown) {
      const sourceType = item.sourceType;
      if (sourceType === 'unknown' || !KB_DISPLAY_SET.has(sourceType)) continue;

      counts.set(sourceType, (counts.get(sourceType) ?? 0) + Math.max(0, Math.trunc(Number(item.primarySourceUses ?? 0))));

      if (typeof item.label === 'string' && item.label.trim()) {
        labels.set(sourceType, item.label.trim());
      }
    }
  } else {
    for (const p of points) {
      for (const t of KB_SOURCE_DISPLAY_ORDER) {
        counts.set(t, (counts.get(t) ?? 0) + Math.trunc(Number((p as Record<string, unknown>)[t] ?? 0)));
      }
    }
  }

  let totalMix = 0;
  for (const t of KB_SOURCE_DISPLAY_ORDER) totalMix += counts.get(t) ?? 0;

  const rows: KbSourceRankingRow[] = KB_SOURCE_DISPLAY_ORDER.map((t) => {
    const count = counts.get(t) ?? 0;
    return {
      id: t,
      label: labels.get(t) ?? KB_SOURCE_LABEL[t],
      count,
      pctOfTotal: totalMix > 0 ? (100 * count) / totalMix : null,
      color: KB_SOURCE_COLOR[t],
    };
  });
  rows.sort((a, b) => b.count - a.count);
  return rows;
}

export function AgentResourcesKbSourceTrendsSection({
  summary,
  timeSeries,
  sourceTypeBreakdown,
  granularity,
}: Props) {
  const [hiddenSeriesIds, setHiddenSeriesIds] = useState<string[]>([]);
  const [kbChartView, setKbChartView] = useState<'trends' | 'distribution'>('trends');

  const rankingRows = useMemo(
    () => buildKbRankingRows(sourceTypeBreakdown, timeSeries),
    [sourceTypeBreakdown, timeSeries],
  );

  const typeLabels = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rankingRows) m.set(r.id, r.label);
    return m;
  }, [rankingRows]);

  const seriesOrder = useMemo(() => rankingRows.map((r) => r.id), [rankingRows]);

  const toggleSeries = useCallback(
    (id: string) => {
      setHiddenSeriesIds((prev) => {
        const isCurrentlyHidden = prev.includes(id);
        const visibleCount = seriesOrder.filter((x) => !prev.includes(x)).length;
        if (!isCurrentlyHidden && visibleCount <= 1) return prev;
        if (isCurrentlyHidden) return prev.filter((x) => x !== id);
        return [...prev, id];
      });
    },
    [seriesOrder],
  );

  const kbAreaChartHidden = hiddenSeriesIds.includes(KB_SOURCE_AREA_CHART_SERIES_KEY);

  const toggleKbAreaChart = useCallback(() => {
    setHiddenSeriesIds((prev) =>
      prev.includes(KB_SOURCE_AREA_CHART_SERIES_KEY)
        ? prev.filter((id) => id !== KB_SOURCE_AREA_CHART_SERIES_KEY)
        : [...prev, KB_SOURCE_AREA_CHART_SERIES_KEY],
    );
  }, []);

  const chartBlock =
    kbChartView === 'trends' ? (
      <AgentResourcesKbSourceUsageOverTimeChart
        points={timeSeries}
        granularity={granularity}
        hiddenSeriesIds={hiddenSeriesIds}
        fillHeight
      />
    ) : (
      <AgentResourcesKbSourceDistributionPieChart
        points={timeSeries}
        granularity={granularity}
        hiddenSeriesIds={hiddenSeriesIds}
        typeLabels={typeLabels}
        fillHeight
      />
    );

  const classifiedTotal = Math.max(0, Math.trunc(summary.messagesWithSources ?? 0));
  const kbUsageTitle = 'Knowledge base usage';
  const rankingTitle = 'Source ranking by citations';
  const sectionTitle =
    kbChartView === 'trends' ? 'Source Usage Trends' : 'Source Usage Distribution';

  return (
    <AnalyticsChartCard
      title={sectionTitle}
      description={kbChartView === 'trends' ? SECTION_DESCRIPTION_TRENDS : SECTION_DESCRIPTION_DISTRIBUTION}
      titleAside={
        <div className="flex w-full min-w-0 justify-end sm:max-w-[28rem]">
          <AnalyticsTrendDistributionTabs value={kbChartView} onChange={setKbChartView} />
        </div>
      }
      bodyClassName={cn('flex min-h-0 flex-1 flex-col !overflow-y-auto')}
      noMaxHeight
      className={cn(
        'overflow-hidden border-slate-100/95 shadow-[0_1px_3px_rgba(15,23,42,0.06)]',
        TOPICS_ANALYTICS_SECTION_CARD_CLASS,
      )}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-6 p-3 sm:p-5 lg:flex-row lg:items-stretch lg:gap-0">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:pr-6">{chartBlock}</div>
        <aside className="flex min-h-0 w-full shrink-0 flex-col overflow-hidden border-t border-slate-200/90 pt-6 lg:h-full lg:max-w-[min(100%,24rem)] lg:w-[34%] lg:flex-shrink-0 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
          <button
            type="button"
            onClick={toggleKbAreaChart}
            aria-pressed={!kbAreaChartHidden}
            aria-label={
              kbAreaChartHidden ? 'Show knowledge base usage area chart' : 'Hide knowledge base usage area chart'
            }
            className={cn(
              'shrink-0 rounded-lg border border-transparent text-left outline-none transition-colors duration-200',
              'flex w-full min-w-0 flex-col px-2 py-1.5 hover:border-slate-200 hover:bg-white active:bg-slate-100',
              'focus-visible:ring-2 focus-visible:ring-teal-500/25',
              kbAreaChartHidden && 'opacity-[0.92]',
            )}
          >
            <p className="m-0 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{kbUsageTitle}</p>
            <p className="m-0 mt-2 text-xl font-semibold tabular-nums tracking-tight text-slate-900">
              {formatAnalyticsInteger(classifiedTotal)}
            </p>
            <p className="m-0 mt-1 shrink-0 text-[10px] leading-snug text-slate-500">
              Tap to show or hide the teal area in the chart.
            </p>
          </button>
          <div className="mt-3 shrink-0 border-b border-slate-200/90" role="presentation" />
          <h3 className="m-0 mt-4 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {rankingTitle}
          </h3>
          <div className="mt-2 flex min-h-[10.5rem] min-w-0 flex-1 flex-col overflow-hidden lg:min-h-0">
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-slate-50 p-1">
              <KbSourceTypeRankingCard
                rankingRows={rankingRows}
                hiddenSeriesIds={hiddenSeriesIds}
                onToggleSeries={toggleSeries}
                embedded
              />
            </div>
          </div>
        </aside>
      </div>
    </AnalyticsChartCard>
  );
}
