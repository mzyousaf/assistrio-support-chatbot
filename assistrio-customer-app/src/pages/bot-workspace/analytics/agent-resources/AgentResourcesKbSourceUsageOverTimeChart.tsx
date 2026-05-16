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
  CustomerAgentResourcesKbTimePoint,
  CustomerChatsAnalyticsGranularity,
  CustomerKnowledgeSourcesAnalyticsSourceType,
} from '@/api/types';
import { formatAnalyticsDateLabel, formatAnalyticsInteger } from '@/lib/analyticsFormat';
import { KB_SOURCE_COLOR, KB_SOURCE_LABEL, KB_SOURCE_DISPLAY_ORDER } from './agentResourcesKbSourceSeries';
import { AnalyticsChartEmpty } from '@/pages/bot-workspace/analytics/shared/AnalyticsChartEmpty';
import { ANALYTICS_FIXED_CHART_PLOT_HEIGHT_PX, CHART } from '@/pages/bot-workspace/analytics/shared/analyticsChartTheme';

const CHART_ANIM_MS = 520;
const STACK_ID = 'kbPrimarySourcesStack';

/** When present in {@link Props.hiddenSeriesIds}, the teal area (`messagesWithSources`) is not drawn. */
export const KB_SOURCE_AREA_CHART_SERIES_KEY = 'messagesWithSources' as const;

type TipRow = { dataKey?: string | number; value?: number; color?: string; name?: string };

function KbSourceComposedTooltip({
  label,
  payload,
  visibleTypesOrdered,
  areaChartVisible,
}: {
  label?: string;
  payload: readonly TipRow[];
  visibleTypesOrdered: readonly CustomerKnowledgeSourcesAnalyticsSourceType[];
  areaChartVisible: boolean;
}) {
  const map = new Map<string, TipRow>();
  for (const p of payload ?? []) map.set(String(p.dataKey), p);

  const totalRow = map.get('messagesWithSources');
  const totalVal = Number(totalRow?.value ?? 0);
  const stacked: { key: CustomerKnowledgeSourcesAnalyticsSourceType; n: number; name: string; color?: string }[] = [];
  for (const key of visibleTypesOrdered) {
    const pl = map.get(key);
    const n = Math.trunc(Number(pl?.value ?? 0));
    stacked.push({ key, n, name: String(pl?.name ?? KB_SOURCE_LABEL[key]), color: pl?.color ?? KB_SOURCE_COLOR[key] });
  }

  return (
    <div className="rounded-lg border border-slate-200/90 bg-white/95 px-3 py-2.5 text-xs shadow-lg backdrop-blur-[2px]">
      <p className="m-0 mb-1.5 font-semibold text-slate-700">{label}</p>
      {areaChartVisible && Number.isFinite(totalVal) ? (
        <p className="m-0 mb-2 tabular-nums text-slate-600">
          <span className="text-slate-500">Answers with sources</span>{' '}
          <span className="font-semibold text-slate-900">{formatAnalyticsInteger(Math.max(0, Math.trunc(totalVal)))}</span>
        </p>
      ) : null}
      {stacked.length ? (
        <>
          <p className="m-0 mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Primary type mix</p>
          <ul className="m-0 list-none space-y-1 p-0 tabular-nums">
            {stacked.map((row) => (
              <li key={row.key} className="flex items-center justify-between gap-4 text-slate-600">
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className="inline-block size-2 shrink-0 rounded-sm ring-1 ring-black/[0.06]"
                    style={{ backgroundColor: row.color ?? KB_SOURCE_COLOR[row.key] }}
                    aria-hidden
                  />
                  <span className="min-w-0 truncate font-medium text-slate-800">{row.name}</span>
                </span>
                <span className="shrink-0 font-semibold text-slate-800">{formatAnalyticsInteger(row.n)}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

type Props = {
  points: CustomerAgentResourcesKbTimePoint[];
  granularity: CustomerChatsAnalyticsGranularity;
  /** Source types omitted from stacked bars. Include {@link KB_SOURCE_AREA_CHART_SERIES_KEY} to hide the teal area. */
  hiddenSeriesIds?: string[];
  /**
   * `true`: fill surrounding flex/card height (inside fixed-height layouts).
   * `false`: standalone mount with intrinsic height (standalone pages/tests).
   */
  fillHeight?: boolean;
};

const CHART_MOUNT_STYLE: { minHeight: number; height: number | string } = {
  minHeight: ANALYTICS_FIXED_CHART_PLOT_HEIGHT_PX,
  height: ANALYTICS_FIXED_CHART_PLOT_HEIGHT_PX,
};

export function AgentResourcesKbSourceUsageOverTimeChart({
  points,
  granularity,
  hiddenSeriesIds = [],
  fillHeight = false,
}: Props) {
  const stackedKeys = KB_SOURCE_DISPLAY_ORDER;

  const visibleStackTypes = useMemo(
    () => stackedKeys.filter((t) => !hiddenSeriesIds.includes(t)),
    [hiddenSeriesIds],
  );

  const areaChartVisible = !hiddenSeriesIds.includes(KB_SOURCE_AREA_CHART_SERIES_KEY);

  const chartData = useMemo(() => {
    return points.map((p) => {
      const row: Record<string, string | number> = {
        xLabel: formatAnalyticsDateLabel(String(p.date), granularity),
        messagesWithSources: Math.trunc(Number(p.messagesWithSources ?? 0)),
      };
      for (const t of stackedKeys) {
        row[t] = Math.trunc(Number((p as Record<string, unknown>)[t] ?? 0));
      }
      return row;
    });
  }, [points, granularity]);

  const yMax = useMemo(() => {
    let m = 0;
    for (const row of chartData) {
      let stackSum = 0;
      for (const t of visibleStackTypes) {
        stackSum += Math.trunc(Number(row[t as string] ?? 0));
      }
      const total = Math.trunc(Number(row.messagesWithSources ?? 0));
      const peak = areaChartVisible ? Math.max(stackSum, total) : stackSum;
      if (peak > m) m = peak;
    }
    const n = Number(m);
    return n <= 0 ? 1 : Math.ceil(n * 1.08 * 100) / 100;
  }, [chartData, visibleStackTypes, areaChartVisible]);

  const hasSignal =
    chartData.some((r) => Number(r.messagesWithSources ?? 0) > 0) ||
    chartData.some((r) => {
      for (const t of stackedKeys) {
        if (Math.trunc(Number(r[t as string] ?? 0)) > 0) return true;
      }
      return false;
    });

  const emptyShell = (
    <div
      className={
        fillHeight
          ? 'flex h-full min-h-[12rem] w-full flex-col items-center justify-center px-4 py-8'
          : 'flex w-full items-center justify-center px-4 py-8'
      }
      style={fillHeight ? undefined : CHART_MOUNT_STYLE}
      data-testid="agent-resources-kb-source-chart"
    >
      <AnalyticsChartEmpty message="No sourced answers in this range yet. When answers cite knowledge, counts appear here." />
    </div>
  );

  if (!hasSignal) {
    return emptyShell;
  }

  const chartInner = (
    <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 4 }} barCategoryGap="32%">
      <defs>
        <linearGradient id="agentKbMsgsGrad" x1="0" y1="0" x2="0" y2="1">
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
        tickFormatter={(v) => formatAnalyticsInteger(Math.round(Number(v)))}
        width={44}
        allowDecimals={false}
        axisLine={false}
        tickLine={false}
      />
      <Tooltip
        shared
        cursor={{ stroke: CHART.slate300, strokeWidth: 1, strokeDasharray: '4 4' }}
        content={({ active, label, payload }) => {
          if (!active || !payload?.length) return null;
          return (
            <KbSourceComposedTooltip
              label={typeof label === 'string' ? label : String(label ?? '')}
              payload={payload as readonly TipRow[]}
              visibleTypesOrdered={visibleStackTypes}
              areaChartVisible={areaChartVisible}
            />
          );
        }}
      />
      {areaChartVisible ? (
        <Area
          type="monotone"
          dataKey="messagesWithSources"
          name="Answers with sources"
          stroke={CHART.teal600}
          strokeWidth={2}
          fill="url(#agentKbMsgsGrad)"
          fillOpacity={1}
          dot={false}
          activeDot={{ r: 4, stroke: CHART.teal700, strokeWidth: 2, fill: '#fff' }}
          isAnimationActive
          animationDuration={CHART_ANIM_MS}
          animationEasing="ease-out"
        />
      ) : null}
      {visibleStackTypes.map((t) => (
        <Bar
          key={t}
          dataKey={t}
          name={KB_SOURCE_LABEL[t]}
          stackId={STACK_ID}
          fill={KB_SOURCE_COLOR[t]}
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
      <div
        className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col"
        data-testid="agent-resources-kb-source-chart"
      >
        <div className="min-h-0 w-full flex-1">
          <ResponsiveContainer width="100%" height="100%">
            {chartInner}
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 shrink-0" style={CHART_MOUNT_STYLE} data-testid="agent-resources-kb-source-chart">
      <ResponsiveContainer width="100%" height="100%">
        {chartInner}
      </ResponsiveContainer>
    </div>
  );
}
