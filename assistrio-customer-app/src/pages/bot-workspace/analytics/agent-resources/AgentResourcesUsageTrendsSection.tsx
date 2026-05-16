import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  CustomerAgentResourcesUsageCreditRule,
  CustomerAgentResourcesUsageSummary,
  CustomerAgentResourcesUsageTimePoint,
  CustomerChatsAnalyticsGranularity,
} from '@/api/types';
import { formatAnalyticsAiCreditsLabel } from '@/lib/analyticsFormat';
import { cn } from '@/lib/utils';
import { AnalyticsChartCard } from '../shared/AnalyticsChartCard';
import {
  ANALYTICS_SPLIT_CHART_MAIN_CLASS,
  ANALYTICS_SPLIT_CHART_ROW_CLASS,
  ANALYTICS_SPLIT_SIDEBAR_34_CLASS,
} from '../shared/analyticsChartTheme';
import { AnalyticsTrendDistributionTabs } from '../shared/AnalyticsTrendDistributionTabs';
import { TOPICS_ANALYTICS_SECTION_CARD_CLASS } from '../topics/topicsAnalyticsSectionLayout';
import { AgentResourcesUsageDistributionPieChart } from './AgentResourcesUsageDistributionPieChart';
import {
  AgentResourcesUsageOverTimeChart,
} from './AgentResourcesUsageOverTimeChart';
import {
  AgentResourcesUsageVolumeRankingCard,
  type AgentResourcesUsageVolumeRow,
} from './AgentResourcesUsageVolumeRankingCard';
import { usageSummaryHasServerAttribution } from './agentResourcesUsageCredits.util';
import { buildAgentResourcesUsageVolumeRows } from './agentResourcesUsageVolumeRows';
import {
  AGENT_RESOURCES_USAGE_SERIES_IDS,
  type AgentResourcesUsageSeriesId,
} from './agentResourcesUsageTrendTheme';

const SERIES_ORDER: AgentResourcesUsageSeriesId[] = AGENT_RESOURCES_USAGE_SERIES_IDS;

const SECTION_DESCRIPTION_TRENDS =
  'Billed AI Credits over time (teal area) with stacked modality breakdown — tap Total Usage to toggle the area; tap modality rows to toggle bars (keep at least one row visible).';
const SECTION_DESCRIPTION_DISTRIBUTION =
  'Outer ring shows AI Credits per time bucket (same scale as the teal trend). Inner disk shows modality shares (same mix as the stacked bars).';

type Props = {
  summary: CustomerAgentResourcesUsageSummary;
  timeSeries: CustomerAgentResourcesUsageTimePoint[];
  granularity: CustomerChatsAnalyticsGranularity;
  creditRules: CustomerAgentResourcesUsageCreditRule[];
  rangeFrom: string;
  rangeTo: string;
};

export function AgentResourcesUsageTrendsSection({
  summary,
  timeSeries,
  granularity,
  creditRules,
  rangeFrom,
  rangeTo,
}: Props) {
  const [hiddenSeriesIds, setHiddenSeriesIds] = useState<string[]>([]);
  const [usageChartView, setUsageChartView] = useState<'trends' | 'distribution'>('trends');

  const hasServerAttribution = usageSummaryHasServerAttribution(summary);

  const volumeRows: AgentResourcesUsageVolumeRow[] = useMemo(
    () => buildAgentResourcesUsageVolumeRows(summary, creditRules),
    [summary, creditRules],
  );

  const rankingKey = useMemo(
    () =>
      `${SERIES_ORDER.join('\0')}|${volumeRows.map((r) => `${r.id}:${r.magnitude}`).join('|')}|${rangeFrom}|${rangeTo}`,
    [volumeRows, rangeFrom, rangeTo],
  );

  useEffect(() => {
    const zeroIds = volumeRows
      .filter((r) => r.id !== 'totalCreditsUsed' && !(r.magnitude > 0))
      .map((r) => r.id);
    setHiddenSeriesIds(zeroIds);
  }, [rankingKey, volumeRows]);

  const toggleSeries = useCallback((id: AgentResourcesUsageSeriesId) => {
    setHiddenSeriesIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((x) => x !== id);
      }
      const next = [...prev, id];
      const visibleCount = SERIES_ORDER.filter((sid) => !next.includes(sid)).length;
      if (visibleCount === 0) return prev;
      return next;
    });
  }, []);

  const chartBlock =
    usageChartView === 'trends' ? (
      <AgentResourcesUsageOverTimeChart
        points={timeSeries}
        granularity={granularity}
        creditRules={creditRules}
        hiddenSeriesIds={hiddenSeriesIds}
        fillHeight
      />
    ) : (
      <AgentResourcesUsageDistributionPieChart
        points={timeSeries}
        granularity={granularity}
        creditRules={creditRules}
        hiddenSeriesIds={hiddenSeriesIds}
        fillHeight
      />
    );

  const creditsUsageTitle = 'Avg AI Credits / message';
  const sectionTitle =
    usageChartView === 'trends' ? 'AI Credits Usage Trends' : 'AI Credits Usage Distribution';

  return (
    <AnalyticsChartCard
      title={sectionTitle}
      description={usageChartView === 'trends' ? SECTION_DESCRIPTION_TRENDS : SECTION_DESCRIPTION_DISTRIBUTION}
      titleAside={
        <div className="flex w-full min-w-0 justify-end sm:max-w-[28rem]">
          <AnalyticsTrendDistributionTabs value={usageChartView} onChange={setUsageChartView} />
        </div>
      }
      bodyClassName={cn('flex min-h-0 flex-1 flex-col !overflow-y-auto')}
      noMaxHeight
      className={cn(
        'overflow-hidden border-slate-100/95 shadow-[0_1px_3px_rgba(15,23,42,0.06)]',
        TOPICS_ANALYTICS_SECTION_CARD_CLASS,
      )}
    >
      <div className={ANALYTICS_SPLIT_CHART_ROW_CLASS}>
        <div className={ANALYTICS_SPLIT_CHART_MAIN_CLASS}>{chartBlock}</div>
        <aside className={ANALYTICS_SPLIT_SIDEBAR_34_CLASS}>
          <div className="shrink-0 px-2 py-1.5">
            <p className="m-0 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{creditsUsageTitle}</p>
            <p className="m-0 mt-2 text-xl font-semibold tabular-nums tracking-tight text-slate-900">
              {summary.averageCreditsPerMessage != null
                ? formatAnalyticsAiCreditsLabel(summary.averageCreditsPerMessage)
                : '—'}
            </p>
          </div>
          <div className="mt-3 shrink-0 border-b border-slate-200/90" role="presentation" />
          <div className="mt-4 flex shrink-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h3 className="m-0 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Usage in range</h3>
            <p className="m-0 text-[11px] font-medium tabular-nums leading-snug text-slate-500">
              {hasServerAttribution ? 'Transaction × Cost = AI Credits Usage' : 'Messages × cost'}
            </p>
          </div>
          <p className="m-0 mt-1 shrink-0 max-w-full text-[10px] leading-snug text-slate-500">
            Tap a row to show or hide that series on the chart
          </p>
          <div className="mt-2 min-w-0 shrink-0">
            <div className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-1">
              <AgentResourcesUsageVolumeRankingCard
                rows={volumeRows}
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
