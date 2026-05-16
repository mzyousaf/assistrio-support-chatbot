import { useMemo } from 'react';
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type {
  CustomerAgentResourcesUsageCreditRule,
  CustomerAgentResourcesUsageTimePoint,
  CustomerChatsAnalyticsGranularity,
} from '@/api/types';
import {
  formatAnalyticsCredits,
  formatAnalyticsCreditsWithUnit,
  formatAnalyticsDateLabel,
} from '@/lib/analyticsFormat';
import { AnalyticsChartEmpty } from '@/pages/bot-workspace/analytics/shared/AnalyticsChartEmpty';
import { ANALYTICS_FIXED_CHART_PLOT_HEIGHT_PX, CHART } from '@/pages/bot-workspace/analytics/shared/analyticsChartTheme';
import {
  buildUsageCreditRuleLookup,
  usageCreditSplitFromTimePoint,
} from './agentResourcesUsageCredits.util';
import { AGENT_RESOURCES_USAGE_SERIES } from './agentResourcesUsageTrendTheme';

const CHART_ANIM_MS = 520;
const STACK_ID = 'usageCreditsStack';

/** When present in {@link Props.hiddenSeriesIds}, the teal area (`totalCreditsUsed`) is not drawn. */
export const USAGE_CREDITS_AREA_CHART_SERIES_KEY = 'totalCreditsUsed' as const;

const USAGE_STACK_SERIES = AGENT_RESOURCES_USAGE_SERIES.filter((s) => s.id !== 'totalCreditsUsed');

export type UsageCreditsStackSeriesId = (typeof USAGE_STACK_SERIES)[number]['id'];

type TipRow = { dataKey?: string | number; value?: number; color?: string; name?: string };

function UsageCreditsComposedTooltip({
  label,
  payload,
  visibleStackIdsOrdered,
  areaChartVisible,
}: {
  label?: string;
  payload: readonly TipRow[];
  visibleStackIdsOrdered: readonly UsageCreditsStackSeriesId[];
  areaChartVisible: boolean;
}) {
  const map = new Map<string, TipRow>();
  for (const p of payload ?? []) map.set(String(p.dataKey), p);

  const totalRow = map.get('totalCreditsUsed');
  const totalVal = Number(totalRow?.value ?? 0);
  const stacked: { id: UsageCreditsStackSeriesId; credits: number; name: string; color?: string }[] = [];
  for (const id of visibleStackIdsOrdered) {
    const pl = map.get(id);
    const credits = Number(pl?.value ?? 0);
    stacked.push({
      id,
      credits,
      name: String(pl?.name ?? id),
      color: pl?.color,
    });
  }

  return (
    <div className="rounded-lg border border-slate-200/90 bg-white/95 px-3 py-2.5 text-xs shadow-lg backdrop-blur-[2px]">
      <p className="m-0 mb-1.5 font-semibold text-slate-700">{label}</p>
      {areaChartVisible && Number.isFinite(totalVal) ? (
        <p className="m-0 mb-2 tabular-nums text-slate-600">
          <span className="text-slate-500">Total billed AI Credits</span>{' '}
          <span className="font-semibold text-slate-900">{formatAnalyticsCreditsWithUnit(Math.max(0, totalVal))}</span>
        </p>
      ) : null}
      {stacked.length ? (
        <>
          <p className="m-0 mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Modality AI Credits</p>
          <ul className="m-0 list-none space-y-1 p-0 tabular-nums">
            {stacked.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-4 text-slate-600">
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className="inline-block size-2 shrink-0 rounded-sm ring-1 ring-black/[0.06]"
                    style={{ backgroundColor: row.color ?? CHART.slate500 }}
                    aria-hidden
                  />
                  <span className="min-w-0 truncate font-medium text-slate-800">{row.name}</span>
                </span>
                <span className="shrink-0 font-semibold text-slate-800">
                  {formatAnalyticsCreditsWithUnit(Math.max(0, row.credits))}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

type Props = {
  points: CustomerAgentResourcesUsageTimePoint[];
  granularity: CustomerChatsAnalyticsGranularity;
  creditRules: CustomerAgentResourcesUsageCreditRule[];
  /** Omit stack segments using modality ids (`textCredits`, …); include {@link USAGE_CREDITS_AREA_CHART_SERIES_KEY} to hide the teal area. */
  hiddenSeriesIds: string[];
  fillHeight?: boolean;
};

const CHART_MOUNT_STYLE: { minHeight: number; height: number | string } = {
  minHeight: ANALYTICS_FIXED_CHART_PLOT_HEIGHT_PX,
  height: ANALYTICS_FIXED_CHART_PLOT_HEIGHT_PX,
};

export function AgentResourcesUsageOverTimeChart({
  points,
  granularity,
  creditRules,
  hiddenSeriesIds,
  fillHeight = false,
}: Props) {
  const ruleByUsageType = useMemo(() => buildUsageCreditRuleLookup(creditRules), [creditRules]);

  const visibleSeries = useMemo(
    () => AGENT_RESOURCES_USAGE_SERIES.filter((s) => !hiddenSeriesIds.includes(s.id)),
    [hiddenSeriesIds],
  );

  const visibleStackSeries = useMemo(
    () => USAGE_STACK_SERIES.filter((s) => !hiddenSeriesIds.includes(s.id)),
    [hiddenSeriesIds],
  );

  const visibleStackIdsOrdered = useMemo(
    () => visibleStackSeries.map((s) => s.id) as UsageCreditsStackSeriesId[],
    [visibleStackSeries],
  );

  const areaChartVisible = !hiddenSeriesIds.includes(USAGE_CREDITS_AREA_CHART_SERIES_KEY);

  const chartData = useMemo(() => {
    return points.map((p) => {
      const split = usageCreditSplitFromTimePoint(p, ruleByUsageType);
      return {
        xLabel: formatAnalyticsDateLabel(p.date, granularity),
        totalCreditsUsed: split.totalCreditsUsed,
        textCredits: split.textCredits,
        voiceCredits: split.voiceCredits,
        dictationCredits: split.dictationCredits,
      };
    });
  }, [points, granularity, ruleByUsageType]);

  const yMax = useMemo(() => {
    let m = 0;
    for (const row of chartData) {
      let stackSum = 0;
      for (const s of visibleStackSeries) {
        stackSum += Number(row[s.id as keyof typeof row] ?? 0);
      }
      const total = Number(row.totalCreditsUsed ?? 0);
      const peak = areaChartVisible ? Math.max(stackSum, total) : stackSum;
      if (peak > m) m = peak;
    }
    const n = Number(m);
    return n <= 0 ? 1 : Math.ceil(n * 1.08 * 1e6) / 1e6;
  }, [chartData, visibleStackSeries, areaChartVisible]);

  const hasSignal = chartData.some(
    (r) =>
      r.textCredits > 0 ||
      r.voiceCredits > 0 ||
      r.dictationCredits > 0 ||
      r.totalCreditsUsed > 0,
  );

  const emptyShell = (
    <div
      className={
        fillHeight
          ? 'flex h-full min-h-[12rem] w-full flex-col items-center justify-center px-4 py-8'
          : 'flex w-full items-center justify-center px-4 py-8'
      }
      style={fillHeight ? undefined : CHART_MOUNT_STYLE}
      data-testid="agent-resources-usage-chart"
    >
      <AnalyticsChartEmpty message="No AI Credits Usage in this range yet. AI Credits apply when visitors message your assistant." />
    </div>
  );

  if (!visibleSeries.length) {
    return (
      <div
        className={fillHeight ? 'flex h-full min-h-0 w-full flex-1 flex-col' : 'w-full min-w-0'}
        style={fillHeight ? undefined : CHART_MOUNT_STYLE}
        data-testid="agent-resources-usage-chart"
      >
        <AnalyticsChartEmpty
          message="Show at least one series from the list."
          className={fillHeight ? 'h-full min-h-[12rem] w-full flex-1' : 'min-h-[12rem] w-full'}
        />
      </div>
    );
  }

  if (!points.length || !hasSignal) {
    return emptyShell;
  }

  const chartInner = (
    <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 4 }} barCategoryGap="32%">
      <defs>
        <linearGradient id="agentUsageTotalCreditsGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={CHART.teal600} stopOpacity={0.3} />
          <stop offset="100%" stopColor={CHART.teal600} stopOpacity={0.04} />
        </linearGradient>
      </defs>
      <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" vertical={false} />
      <XAxis
        dataKey="xLabel"
        tick={{ fontSize: 11, fill: CHART.axis }}
        tickMargin={8}
        interval="preserveStartEnd"
        axisLine={{ stroke: CHART.grid }}
        tickLine={false}
      />
      <YAxis
        domain={[0, yMax]}
        tick={{ fontSize: 11, fill: CHART.axis }}
        tickFormatter={(v) => formatAnalyticsCredits(Number(v))}
        width={44}
        axisLine={false}
        tickLine={false}
      />
      <Tooltip
        shared
        cursor={{ stroke: CHART.slate300, strokeWidth: 1, strokeDasharray: '4 4' }}
        content={({ active, label, payload }) => {
          if (!active || !payload?.length) return null;
          return (
            <UsageCreditsComposedTooltip
              label={typeof label === 'string' ? label : String(label ?? '')}
              payload={payload as readonly TipRow[]}
              visibleStackIdsOrdered={visibleStackIdsOrdered}
              areaChartVisible={areaChartVisible}
            />
          );
        }}
      />
      {areaChartVisible ? (
        <Area
          type="monotone"
          dataKey="totalCreditsUsed"
          name="Total AI Credits"
          stroke={CHART.teal600}
          strokeWidth={2}
          fill="url(#agentUsageTotalCreditsGrad)"
          fillOpacity={1}
          dot={false}
          activeDot={{ r: 4, stroke: CHART.teal700, strokeWidth: 2, fill: '#fff' }}
          isAnimationActive
          animationDuration={CHART_ANIM_MS}
          animationEasing="ease-out"
        />
      ) : null}
      {visibleStackSeries.map((s) => (
        <Bar
          key={s.id}
          dataKey={s.id}
          name={s.label}
          stackId={STACK_ID}
          fill={s.color}
          radius={[2, 2, 0, 0]}
          maxBarSize={14}
          isAnimationActive
          animationDuration={CHART_ANIM_MS}
          animationEasing="ease-out"
        />
      ))}
    </ComposedChart>
  );

  if (fillHeight) {
    return (
      <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col" data-testid="agent-resources-usage-chart">
        <div className="min-h-0 w-full flex-1">
          <ResponsiveContainer width="100%" height="100%">
            {chartInner}
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 shrink-0" style={CHART_MOUNT_STYLE} data-testid="agent-resources-usage-chart">
      <ResponsiveContainer width="100%" height="100%">
        {chartInner}
      </ResponsiveContainer>
    </div>
  );
}
