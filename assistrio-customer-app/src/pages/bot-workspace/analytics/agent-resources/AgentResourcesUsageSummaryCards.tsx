import { useMemo, type ReactNode } from 'react';
import type {
  CustomerAgentResourcesUsageCreditRule,
  CustomerAgentResourcesUsageSummary,
  CustomerAgentResourcesUsageTimePoint,
  CustomerChatsAnalyticsGranularity,
} from '@/api/types';
import { formatAnalyticsAiCreditsLabel } from '@/lib/analyticsFormat';
import {
  AnalyticsKpiGrid,
  type AnalyticsKpiItem,
} from '@/pages/bot-workspace/analytics/shared/AnalyticsKpiGrid';
import { CHART } from '@/pages/bot-workspace/analytics/shared/analyticsChartTheme';
import { AgentResourcesUsageKpiMiniChart } from './AgentResourcesUsageKpiMiniChart';
import { usageSummaryHasServerAttribution } from './agentResourcesUsageCredits.util';
import type { AgentResourcesUsageVolumeRow } from './AgentResourcesUsageVolumeRankingCard';
import { buildAgentResourcesUsageVolumeRows } from './agentResourcesUsageVolumeRows';

type Props = {
  summary: CustomerAgentResourcesUsageSummary;
  creditRules: CustomerAgentResourcesUsageCreditRule[];
  timeSeries: CustomerAgentResourcesUsageTimePoint[];
  granularity: CustomerChatsAnalyticsGranularity;
};

const CREDIT_USAGE_TITLE_CLASS = 'text-slate-700';
const CREDIT_USAGE_UNIT_SUBTEXT_CLASS =
  'pointer-events-auto select-text text-slate-500 tabular-nums';

/** Tooltip-only copy; sidebar {@link AgentResourcesUsageVolumeRow.detailLine} stays compact (numbers only). */
function usageVolumeTooltipDetailLine(row: AgentResourcesUsageVolumeRow): string {
  const { formula } = row;
  if (formula.kind === 'total') {
    return `= ${formatAnalyticsAiCreditsLabel(row.magnitude)}`;
  }
  return `${formula.quantity} ${formula.noun} x ${formula.unitCost} cost = ${formatAnalyticsAiCreditsLabel(row.magnitude)}`;
}

function TotalCreditsTooltip(props: { rows: AgentResourcesUsageVolumeRow[] }): ReactNode {
  const { rows } = props;
  const textRow = rows.find((r) => r.id === 'textCredits');
  const voiceRow = rows.find((r) => r.id === 'voiceCredits');
  const dictRow = rows.find((r) => r.id === 'dictationCredits');
  const totalRow = rows.find((r) => r.id === 'totalCreditsUsed');

  const modalityRows = [textRow, voiceRow, dictRow].filter((r): r is AgentResourcesUsageVolumeRow => r != null);

  return (
    <div className="space-y-2">
      <p className="m-0 text-[11px] font-semibold uppercase tracking-wide text-slate-300">Usage in range</p>
      <ul className="m-0 list-none space-y-2 p-0 text-[0.75rem] font-medium leading-snug text-slate-50">
        {modalityRows.map((row) => (
          <li key={row.id} className="space-y-0.5">
            <p className="m-0 font-semibold text-white">{row.label}</p>
            <p className="m-0 tabular-nums text-slate-100">{usageVolumeTooltipDetailLine(row)}</p>
          </li>
        ))}
        {totalRow ? (
          <li className="space-y-0.5 border-t border-white/20 pt-2">
            <p className="m-0 font-semibold text-white">{totalRow.label}</p>
            <p className="m-0 font-semibold tabular-nums text-white">{usageVolumeTooltipDetailLine(totalRow)}</p>
          </li>
        ) : null}
      </ul>
    </div>
  );
}

function usageMetricTooltip(row: AgentResourcesUsageVolumeRow): ReactNode {
  return (
    <div className="space-y-1">
      <p className="m-0 text-[11px] font-semibold uppercase tracking-wide text-slate-300">{row.label}</p>
      <p className="m-0 text-[0.75rem] font-medium leading-snug tracking-normal text-slate-50 tabular-nums">
        {usageVolumeTooltipDetailLine(row)}
      </p>
    </div>
  );
}

export function AgentResourcesUsageSummaryCards({ summary, creditRules, timeSeries, granularity }: Props) {
  const volumeRows = useMemo(() => buildAgentResourcesUsageVolumeRows(summary, creditRules), [summary, creditRules]);
  const useAttribution = usageSummaryHasServerAttribution(summary);

  const textRow = volumeRows.find((r) => r.id === 'textCredits')!;
  const voiceRow = volumeRows.find((r) => r.id === 'voiceCredits')!;
  const dictRow = volumeRows.find((r) => r.id === 'dictationCredits')!;
  const totalRow = volumeRows.find((r) => r.id === 'totalCreditsUsed')!;

  const textSparkKey = useAttribution ? 'textCreditsAttributed' : 'textMessages';
  const voiceSparkKey = useAttribution ? 'voiceCreditsAttributed' : 'voiceMessages';
  const dictSparkKey = useAttribution ? 'dictationCreditsAttributed' : 'voiceDictationSessions';

  const creditsUnitLabel = 'AI Credits';

  const cards: AnalyticsKpiItem[] = [
    {
      label: 'Total Usage',
      labelClassName: CREDIT_USAGE_TITLE_CLASS,
      labelSubtext: creditsUnitLabel,
      labelSubtextClassName: CREDIT_USAGE_UNIT_SUBTEXT_CLASS,
      value: totalRow.formula.credits,
      headerInline: true,
      tileTooltip: <TotalCreditsTooltip rows={volumeRows} />,
      footer: (
        <AgentResourcesUsageKpiMiniChart
          points={timeSeries}
          granularity={granularity}
          seriesKey="totalCreditsUsed"
          stroke={CHART.teal600}
        />
      ),
    },
    {
      label: 'Text messages',
      labelClassName: CREDIT_USAGE_TITLE_CLASS,
      labelSubtext: creditsUnitLabel,
      labelSubtextClassName: CREDIT_USAGE_UNIT_SUBTEXT_CLASS,
      value: textRow.formula.credits,
      headerInline: true,
      tileTooltip: usageMetricTooltip(textRow),
      footer: (
        <AgentResourcesUsageKpiMiniChart
          points={timeSeries}
          granularity={granularity}
          seriesKey={textSparkKey}
          stroke={CHART.slate500}
        />
      ),
    },
    {
      label: 'Voice messages',
      labelClassName: CREDIT_USAGE_TITLE_CLASS,
      labelSubtext: creditsUnitLabel,
      labelSubtextClassName: CREDIT_USAGE_UNIT_SUBTEXT_CLASS,
      value: voiceRow.formula.credits,
      headerInline: true,
      tileTooltip: usageMetricTooltip(voiceRow),
      footer: (
        <AgentResourcesUsageKpiMiniChart
          points={timeSeries}
          granularity={granularity}
          seriesKey={voiceSparkKey}
          stroke={CHART.indigo400}
        />
      ),
    },
    {
      label: 'Dictation sessions',
      labelClassName: CREDIT_USAGE_TITLE_CLASS,
      labelSubtext: creditsUnitLabel,
      labelSubtextClassName: CREDIT_USAGE_UNIT_SUBTEXT_CLASS,
      value: dictRow.formula.credits,
      headerInline: true,
      tileTooltip: usageMetricTooltip(dictRow),
      footer: (
        <AgentResourcesUsageKpiMiniChart
          points={timeSeries}
          granularity={granularity}
          seriesKey={dictSparkKey}
          stroke={CHART.amber500}
        />
      ),
    },
  ];

  const columnsClassName = 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-4';

  return <AnalyticsKpiGrid items={cards} columnsClassName={columnsClassName} />;
}
