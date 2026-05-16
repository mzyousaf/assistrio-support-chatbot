import { useMemo } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type {
  CustomerAgentResourcesKbTimePoint,
  CustomerChatsAnalyticsGranularity,
  CustomerKnowledgeSourcesAnalyticsSourceType,
} from '@/api/types';
import { formatAnalyticsDateLabel, formatAnalyticsInteger } from '@/lib/analyticsFormat';
import { AnalyticsChartEmpty } from '@/pages/bot-workspace/analytics/shared/AnalyticsChartEmpty';
import { ANALYTICS_FIXED_CHART_PLOT_HEIGHT_PX, CHART } from '@/pages/bot-workspace/analytics/shared/analyticsChartTheme';
import {
  KB_SOURCE_COLOR,
  KB_SOURCE_DISPLAY_ORDER,
  KB_SOURCE_LABEL,
} from './agentResourcesKbSourceSeries';
import { KB_SOURCE_AREA_CHART_SERIES_KEY } from './AgentResourcesKbSourceUsageOverTimeChart';

const CHART_ANIM_MS = 520;

type OuterRow = { key: string; name: string; value: number };
type InnerRow = { id: string; name: string; value: number; color: string };

function outerSliceColor(index: number, total: number): string {
  if (total <= 0) return CHART.teal600;
  if (total === 1) return CHART.teal600;
  const t = index / (total - 1);
  const lightness = 38 + t * 28;
  return `hsl(173 58% ${lightness}%)`;
}

const CHART_MOUNT_STYLE: { minHeight: number; height: number | string } = {
  minHeight: ANALYTICS_FIXED_CHART_PLOT_HEIGHT_PX,
  height: ANALYTICS_FIXED_CHART_PLOT_HEIGHT_PX,
};

type Props = {
  points: CustomerAgentResourcesKbTimePoint[];
  granularity: CustomerChatsAnalyticsGranularity;
  hiddenSeriesIds?: string[];
  /** Optional labels from sidebar breakdown (custom FAQ titles, etc.). */
  typeLabels?: ReadonlyMap<string, string>;
  fillHeight?: boolean;
};

export function AgentResourcesKbSourceDistributionPieChart({
  points,
  granularity,
  hiddenSeriesIds = [],
  typeLabels,
  fillHeight = false,
}: Props) {
  const stackedKeys = KB_SOURCE_DISPLAY_ORDER;

  const visibleStackTypes = useMemo(
    () => stackedKeys.filter((t) => !hiddenSeriesIds.includes(t)),
    [hiddenSeriesIds, stackedKeys],
  );

  const areaChartVisible = !hiddenSeriesIds.includes(KB_SOURCE_AREA_CHART_SERIES_KEY);

  const { outerPieData, innerPieData } = useMemo(() => {
    const outer: OuterRow[] = [];
    for (const p of points) {
      let stackSum = 0;
      for (const t of visibleStackTypes) {
        stackSum += Math.trunc(Number((p as Record<string, unknown>)[t] ?? 0));
      }
      const total = Math.trunc(Number(p.messagesWithSources ?? 0));
      const v = areaChartVisible ? Math.max(total, stackSum) : stackSum;
      if (!Number.isFinite(v) || v <= 0) continue;
      outer.push({
        key: String(p.date),
        name: formatAnalyticsDateLabel(String(p.date), granularity),
        value: v,
      });
    }

    const sums = new Map<CustomerKnowledgeSourcesAnalyticsSourceType, number>();
    for (const t of stackedKeys) sums.set(t, 0);
    for (const p of points) {
      for (const t of visibleStackTypes) {
        const n = Math.trunc(Number((p as Record<string, unknown>)[t] ?? 0));
        sums.set(t, (sums.get(t) ?? 0) + n);
      }
    }

    const inner: InnerRow[] = [];
    for (const t of visibleStackTypes) {
      const v = sums.get(t) ?? 0;
      if (v <= 0) continue;
      inner.push({
        id: t,
        name: typeLabels?.get(t) ?? KB_SOURCE_LABEL[t],
        value: v,
        color: KB_SOURCE_COLOR[t],
      });
    }

    return { outerPieData: outer, innerPieData: inner };
  }, [points, granularity, visibleStackTypes, areaChartVisible, typeLabels]);

  const outerTotal = useMemo(() => outerPieData.reduce((a, b) => a + b.value, 0), [outerPieData]);
  const innerTotal = useMemo(() => innerPieData.reduce((a, b) => a + b.value, 0), [innerPieData]);

  const hasSignal =
    points.length > 0 &&
    (points.some((p) => Math.trunc(Number(p.messagesWithSources ?? 0)) > 0) ||
      points.some((p) => {
        for (const t of stackedKeys) {
          if (Math.trunc(Number((p as Record<string, unknown>)[t] ?? 0)) > 0) return true;
        }
        return false;
      }));

  const emptyShell = (
    <div
      className={
        fillHeight
          ? 'flex h-full min-h-[12rem] w-full flex-col items-center justify-center px-4 py-8'
          : 'flex w-full items-center justify-center px-4 py-8'
      }
      style={fillHeight ? undefined : CHART_MOUNT_STYLE}
      data-testid="agent-resources-kb-source-distribution-chart"
    >
      <AnalyticsChartEmpty message="No sourced answers in this range yet. When answers cite knowledge, counts appear here." />
    </div>
  );

  if (!hasSignal || outerPieData.length === 0) {
    return emptyShell;
  }

  const showInnerDisk = innerPieData.length > 0;

  const tooltipOuter = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: readonly { payload?: OuterRow }[];
  }) => {
    if (!active || !payload?.[0]) return null;
    const row = payload[0].payload as OuterRow;
    const pct = outerTotal > 0 ? (100 * row.value) / outerTotal : 0;
    const pctLabel =
      Number.isFinite(pct) && pct > 0 ? ` (${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(pct)}%)` : '';
    const noun = row.value === 1 ? 'answer' : 'answers';
    return (
      <div className="rounded-lg border border-slate-200/90 bg-white/95 px-3 py-2.5 text-xs shadow-lg backdrop-blur-[2px]">
        <p className="m-0 mb-1 font-semibold text-slate-800">{row.name}</p>
        <p className="m-0 tabular-nums text-slate-600">
          {formatAnalyticsInteger(row.value)} {noun}
          {pctLabel} of range total
        </p>
      </div>
    );
  };

  const tooltipInner = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: readonly { payload?: InnerRow }[];
  }) => {
    if (!active || !payload?.[0]) return null;
    const row = payload[0].payload as InnerRow;
    const pct = innerTotal > 0 ? (100 * row.value) / innerTotal : 0;
    const pctLabel =
      Number.isFinite(pct) && pct > 0 ? ` (${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(pct)}%)` : '';
    const noun = row.value === 1 ? 'citation' : 'citations';
    return (
      <div className="rounded-lg border border-slate-200/90 bg-white/95 px-3 py-2.5 text-xs shadow-lg backdrop-blur-[2px]">
        <p className="m-0 mb-1 font-semibold text-slate-800">{row.name}</p>
        <p className="m-0 tabular-nums text-slate-600">
          {formatAnalyticsInteger(row.value)} primary {noun}
          {pctLabel} of visible mix
        </p>
      </div>
    );
  };

  const outerCount = outerPieData.length;

  const caption = (
    <p className="m-0 mt-1 shrink-0 text-center text-[10px] leading-snug text-slate-500 sm:text-[11px]">
      {showInnerDisk ? (
        <>
          Outer ring · sourced answers per time bucket (matches teal trend scale). Inner disk · primary source-type mix (matches
          stacked bars).
        </>
      ) : (
        <>
          Outer ring only · sourced answers per bucket (enable more primary source types in the ranking list for the inner mix).
        </>
      )}
    </p>
  );

  const chartSection = (
    <>
      <div className={fillHeight ? 'min-h-0 w-full flex-1' : 'h-full min-h-[12rem] w-full'}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
            {showInnerDisk ? (
              <Pie
                data={innerPieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius="42%"
                paddingAngle={1}
                stroke="#fff"
                strokeWidth={1}
                label={false}
                labelLine={false}
                isAnimationActive
                animationDuration={CHART_ANIM_MS}
                animationEasing="ease-out"
              >
                {innerPieData.map((entry) => (
                  <Cell key={entry.id} fill={entry.color} />
                ))}
              </Pie>
            ) : null}
            <Pie
              data={outerPieData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={showInnerDisk ? '52%' : '28%'}
              outerRadius="74%"
              paddingAngle={0.6}
              stroke="#fff"
              strokeWidth={1}
              label={false}
              labelLine={false}
              isAnimationActive
              animationDuration={CHART_ANIM_MS}
              animationEasing="ease-out"
            >
              {outerPieData.map((entry, i) => (
                <Cell key={entry.key} fill={outerSliceColor(i, outerCount)} />
              ))}
            </Pie>
            <Tooltip
              content={(props) => {
                if (!props.active || !props.payload?.length) return null;
                const payload = props.payload as readonly { payload?: OuterRow | InnerRow }[];
                const sample = payload[0]?.payload;
                if (sample && 'key' in sample) return tooltipOuter({ active: props.active, payload: payload as never });
                return tooltipInner({ active: props.active, payload: payload as never });
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      {caption}
    </>
  );

  if (fillHeight) {
    return (
      <div
        className="flex h-full min-h-0 w-full min-w-0 max-w-full flex-1 flex-col transition-opacity duration-300 ease-out"
        data-testid="agent-resources-kb-source-distribution-chart"
        key={`${outerPieData.map((r) => r.key).join('|')}-${innerPieData.map((r) => r.id).join(',')}`}
      >
        {chartSection}
      </div>
    );
  }

  return (
    <div
      className="flex w-full min-w-0 shrink-0 flex-col"
      style={CHART_MOUNT_STYLE}
      data-testid="agent-resources-kb-source-distribution-chart"
      key={`${outerPieData.map((r) => r.key).join('|')}-${innerPieData.map((r) => r.id).join(',')}`}
    >
      {chartSection}
    </div>
  );
}
