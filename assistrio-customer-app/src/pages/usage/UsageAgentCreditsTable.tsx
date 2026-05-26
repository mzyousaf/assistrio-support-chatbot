import { useMemo } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { WorkspaceBillingAiCreditsUsageSummary, WorkspaceBillingSummary } from '@/api/types';
import { UsageSectionCard } from '@/pages/usage/UsageSectionCard';
import {
  USAGE_CHART_TOOLTIP_CLASS,
  usageSliceColor,
} from '@/pages/usage/usageChartTheme';
import {
  buildBotNameLookup,
  formatCreditsSharePercent,
} from '@/pages/usage/usagePageFormat';
import { matchesUsageAgentFilter } from '@/pages/usage/UsageFilterBar';

type Props = {
  summary: WorkspaceBillingSummary;
  aiCredits: WorkspaceBillingAiCreditsUsageSummary | undefined;
  agentIds?: string[];
  className?: string;
};

type AgentSlice = {
  id: string;
  name: string;
  value: number;
  color: string;
  share: number;
};

function formatCreditsUsedLabel(credits: number): string {
  const value = Math.max(0, credits);
  return `${value.toLocaleString()} credit${value === 1 ? '' : 's'}`;
}

export function UsageAgentCreditsTable({
  summary,
  aiCredits,
  agentIds = [],
  className,
}: Props) {
  const botNameLookup = buildBotNameLookup(summary);

  const rows = useMemo(() => {
    const source = aiCredits?.byBot ?? [];
    return [...source]
      .filter((row) => (row.creditsUsed ?? 0) > 0)
      .filter((row) => matchesUsageAgentFilter(row.botId, agentIds))
      .sort((a, b) => (b.creditsUsed ?? 0) - (a.creditsUsed ?? 0));
  }, [aiCredits?.byBot, agentIds]);

  const totalUsed = useMemo(
    () => rows.reduce((sum, row) => sum + (row.creditsUsed ?? 0), 0),
    [rows],
  );
  const isEmpty = rows.length === 0;

  const pieData: AgentSlice[] = useMemo(
    () =>
      rows.map((row, index) => {
        const name = botNameLookup.get(row.botId) ?? 'Agent';
        return {
          id: row.botId,
          name,
          value: row.creditsUsed,
          color: usageSliceColor(index),
          share: formatCreditsSharePercent(row.creditsUsed, totalUsed),
        };
      }),
    [rows, botNameLookup, totalUsed],
  );

  return (
    <UsageSectionCard
      id="usage-agent-credits"
      className={className}
      title="AI credits by agent"
      description="Credits used in the current billing period."
      bodyClassName="flex flex-1 flex-col"
    >
      {isEmpty ? (
        <p className="m-0 flex flex-1 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/60 px-4 py-8 text-center text-sm text-slate-500">
          {agentIds.length > 0 ? 'No AI credit usage for the selected agents.' : 'No AI credit usage yet.'}
        </p>
      ) : (
        <div className="relative flex min-h-[280px] flex-1 items-center justify-center sm:min-h-[300px]">
          <ul
            className="absolute right-0 top-0 z-[1] m-0 max-w-[46%] list-none space-y-1.5 p-0 sm:max-w-[42%]"
            aria-label="AI credits by agent breakdown"
          >
            {pieData.map((slice) => (
              <li key={slice.id} className="list-none">
                <div className="flex items-start gap-1.5">
                  <span
                    className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: slice.color }}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1 leading-tight">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="m-0 min-w-0 truncate text-[11px] font-medium text-slate-800">
                        {slice.name}
                      </p>
                      <p className="m-0 shrink-0 text-[10px] font-semibold tabular-nums text-slate-700">
                        {slice.share}%
                      </p>
                    </div>
                    <p className="m-0 text-[10px] tabular-nums text-slate-500">
                      {formatCreditsUsedLabel(slice.value)}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <div
            className="relative flex h-[240px] w-[240px] shrink-0 items-center justify-center sm:h-[260px] sm:w-[260px]"
            data-testid="usage-agent-credits-donut"
          >
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius="60%"
                  outerRadius="100%"
                  paddingAngle={pieData.length > 1 ? 2 : 0}
                  stroke="none"
                  isAnimationActive
                  animationDuration={480}
                >
                  {pieData.map((slice) => (
                    <Cell key={slice.id} fill={slice.color} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.[0]) return null;
                    const slice = payload[0].payload as AgentSlice;
                    return (
                      <div className={USAGE_CHART_TOOLTIP_CLASS}>
                        <p className="m-0 font-medium text-slate-800">{slice.name}</p>
                        <p className="m-0 mt-0.5 tabular-nums text-slate-600">
                          {formatCreditsUsedLabel(slice.value)} · {slice.share}%
                        </p>
                      </div>
                    );
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-2 text-center">
              <span className="text-xl font-semibold tabular-nums leading-none text-slate-900 sm:text-2xl">
                {totalUsed.toLocaleString()}
              </span>
              <span className="mt-1 text-[0.6875rem] font-medium text-slate-500">AI Credits</span>
            </div>
          </div>
        </div>
      )}
    </UsageSectionCard>
  );
}
