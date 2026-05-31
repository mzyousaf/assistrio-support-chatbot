import { useMemo } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { WorkspaceUsageAnalyticsAiCreditsByAgent } from '@/api/types';
import { UsageSectionCard } from '@/pages/usage/UsageSectionCard';
import {
  USAGE_CHART_TOOLTIP_CLASS,
  usageSliceColor,
} from '@/pages/usage/usageChartTheme';
import { formatCreditsSharePercent } from '@/pages/usage/usagePageFormat';

type Props = {
  rows: WorkspaceUsageAnalyticsAiCreditsByAgent[] | null | undefined;
  loading?: boolean;
  errorMessage?: string | null;
  agentFilterActive?: boolean;
  className?: string;
};

type AgentSlice = {
  id: string;
  name: string;
  value: number;
  color: string;
  share: number;
  monthlyCreditsUsed: number;
  topUpCreditsUsed: number;
  messageCount: number;
};

function formatCreditsUsedLabel(credits: number): string {
  const value = Math.max(0, credits);
  return `${value.toLocaleString()} credit${value === 1 ? '' : 's'}`;
}

function formatMessageCountLabel(count: number): string {
  const value = Math.max(0, count);
  return `${value.toLocaleString()} message${value === 1 ? '' : 's'}`;
}

function UsageAgentCreditsLegendRow({ slice }: { slice: AgentSlice }) {
  return (
    <li className="list-none">
      <div className="flex items-start gap-2 rounded-lg border border-slate-100/90 bg-slate-50/60 px-2 py-2">
        <span
          className="mt-1 h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: slice.color }}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-start justify-between gap-1.5">
            <p
              className="m-0 min-w-0 flex-1 truncate text-xs font-medium leading-snug text-slate-800"
              title={slice.name}
            >
              {slice.name}
            </p>
            <span className="shrink-0 rounded-md bg-white px-1.5 py-0.5 text-[10px] font-semibold tabular-nums leading-none text-slate-700 ring-1 ring-slate-200/80">
              {slice.share}%
            </span>
          </div>
          <p className="m-0 mt-1 truncate text-[11px] leading-snug tabular-nums text-slate-500">
            {formatCreditsUsedLabel(slice.value)} · {formatMessageCountLabel(slice.messageCount)}
          </p>
        </div>
      </div>
    </li>
  );
}

export function UsageAgentCreditsTable({
  rows,
  loading = false,
  errorMessage = null,
  agentFilterActive = false,
  className,
}: Props) {
  const filteredRows = useMemo(
    () => [...(rows ?? [])].filter((row) => row.totalCreditsUsed > 0),
    [rows],
  );

  const totalUsed = useMemo(
    () => filteredRows.reduce((sum, row) => sum + row.totalCreditsUsed, 0),
    [filteredRows],
  );
  const isEmpty = !loading && !errorMessage && filteredRows.length === 0;

  const pieData: AgentSlice[] = useMemo(
    () =>
      filteredRows.map((row, index) => ({
        id: row.botId,
        name: row.botName,
        value: row.totalCreditsUsed,
        color: usageSliceColor(index),
        share: formatCreditsSharePercent(row.totalCreditsUsed, totalUsed),
        monthlyCreditsUsed: row.monthlyCreditsUsed,
        topUpCreditsUsed: row.topUpCreditsUsed,
        messageCount: row.messageCount,
      })),
    [filteredRows, totalUsed],
  );

  return (
    <UsageSectionCard
      id="usage-agent-credits"
      className={className}
      title="AI credits by agent"
      description={
        errorMessage
          ? 'Could not load agent credit usage.'
          : loading
            ? 'Loading agent credit usage…'
            : 'Credits used in the selected date range.'
      }
      bodyClassName="flex flex-1 flex-col"
    >
      {loading ? (
        <div className="min-h-[280px] flex-1 animate-pulse rounded-lg bg-slate-100/80 sm:min-h-[300px]" aria-hidden />
      ) : errorMessage ? (
        <p className="m-0 flex flex-1 items-center justify-center rounded-lg border border-dashed border-amber-200 bg-amber-50/60 px-4 py-8 text-center text-sm text-amber-900">
          {errorMessage}
        </p>
      ) : isEmpty ? (
        <p className="m-0 flex flex-1 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/60 px-4 py-8 text-center text-sm text-slate-500">
          {agentFilterActive
            ? 'No AI credit usage for the selected agents.'
            : 'No AI credit usage in this date range.'}
        </p>
      ) : (
        <div className="flex min-h-[280px] flex-1 flex-col items-stretch gap-4 sm:min-h-[300px] sm:flex-row sm:items-center sm:gap-4">
          <div
            className="relative mx-auto flex h-[200px] w-[200px] shrink-0 items-center justify-center sm:mx-0 sm:h-[210px] sm:w-[210px]"
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
                          Total: {formatCreditsUsedLabel(slice.value)} · {slice.share}%
                        </p>
                        <p className="m-0 tabular-nums text-slate-600">
                          Monthly: {slice.monthlyCreditsUsed.toLocaleString()}
                        </p>
                        <p className="m-0 tabular-nums text-slate-600">
                          Top-up: {slice.topUpCreditsUsed.toLocaleString()}
                        </p>
                        <p className="m-0 tabular-nums text-slate-600">
                          Messages: {slice.messageCount.toLocaleString()}
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

          <ul
            className="m-0 min-w-0 flex-1 list-none space-y-1.5 p-0 sm:max-h-[260px] sm:overflow-y-auto"
            aria-label="AI credits by agent breakdown"
          >
            {pieData.map((slice) => (
              <UsageAgentCreditsLegendRow key={slice.id} slice={slice} />
            ))}
          </ul>
        </div>
      )}
    </UsageSectionCard>
  );
}
