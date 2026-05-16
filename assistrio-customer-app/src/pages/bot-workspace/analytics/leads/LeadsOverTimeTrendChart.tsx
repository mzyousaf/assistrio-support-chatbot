import { useMemo } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { CustomerChatsAnalyticsGranularity, CustomerLeadsTimeSeriesPoint } from '@/api/types';
import { formatAnalyticsDateLabel, formatAnalyticsInteger } from '@/lib/analyticsFormat';
import { CHART } from '../shared/analyticsChartTheme';
import { AnalyticsChartEmpty } from '../shared/AnalyticsChartEmpty';

const CHART_ANIM_MS = 520;

/** Same `{ id, label, color }` shape as chats activity series — stacked areas over time. */
export const LEADS_OVER_TIME_SERIES = [
  { id: 'conversations', label: 'Conversations', color: '#6366f1' },
  { id: 'leads', label: 'Qualified leads', color: CHART.teal600 },
] as const;

export const LEADS_OVER_TIME_MAIN_SERIES_KEYS = LEADS_OVER_TIME_SERIES.map((s) => s.id);

export const LEADS_OVER_TIME_LINE_COLORS = {
  conversations: LEADS_OVER_TIME_SERIES[0].color,
  leads: LEADS_OVER_TIME_SERIES[1].color,
} as const;

export type LeadsOverTimeChartRow = {
  xLabel: string;
  conversations: number;
  leads: number;
};

export function buildLeadsOverTimeChartRows(
  points: CustomerLeadsTimeSeriesPoint[],
  granularity: CustomerChatsAnalyticsGranularity,
): LeadsOverTimeChartRow[] {
  return points.map((p) => ({
    xLabel: formatAnalyticsDateLabel(p.date, granularity),
    conversations: Math.max(0, Math.trunc(p.conversations ?? 0)),
    leads: Math.max(0, Math.trunc(p.leads ?? 0)),
  }));
}

function hollowActiveDotProps(color: string) {
  return { r: 5, fill: '#ffffff', stroke: color, strokeWidth: 2.5 };
}

type TipRow = { dataKey?: string | number; value?: number; color?: string; name?: string };

function LeadsOverTimeTooltipBody({
  label,
  payload,
  visibleSeriesIds,
}: {
  label?: string;
  payload: readonly TipRow[];
  visibleSeriesIds: readonly string[];
}) {
  const rows: { name: string; value: string }[] = [];
  for (const pl of payload) {
    const key = pl.dataKey != null ? String(pl.dataKey) : '';
    if (!visibleSeriesIds.includes(key)) continue;
    const v = Number(pl.value ?? 0);
    if (!Number.isFinite(v) || v <= 0) continue;
    rows.push({
      name: pl.name ?? key,
      value: formatAnalyticsInteger(v),
    });
  }
  if (!rows.length) return null;
  return (
    <div className="rounded-lg border border-slate-200/90 bg-white/95 px-3 py-2.5 text-xs shadow-lg backdrop-blur-[2px]">
      <p className="m-0 mb-1.5 font-semibold text-slate-700">{label}</p>
      <ul className="m-0 list-none space-y-1 p-0">
        {rows.map((r) => (
          <li key={r.name} className="flex justify-between gap-4 tabular-nums text-slate-600">
            <span className="min-w-0 truncate font-medium text-slate-800">{r.name}</span>
            <span className="shrink-0 text-slate-500">{r.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** For tests — mirrors Recharts tooltip payload rows. */
export function LeadsOverTimeTrendTooltipContent({
  label,
  payload,
}: {
  label: string;
  payload: readonly { payload?: LeadsOverTimeChartRow }[];
}) {
  const row = payload
    .map((x) => x.payload)
    .find((p): p is LeadsOverTimeChartRow => p != null && 'conversations' in p && 'leads' in p);
  if (!row) return null;
  const synthetic: TipRow[] = [
    { dataKey: 'conversations', name: LEADS_OVER_TIME_SERIES[0].label, value: row.conversations },
    { dataKey: 'leads', name: LEADS_OVER_TIME_SERIES[1].label, value: row.leads },
  ];
  return (
    <LeadsOverTimeTooltipBody
      label={label}
      payload={synthetic}
      visibleSeriesIds={LEADS_OVER_TIME_MAIN_SERIES_KEYS as readonly string[]}
    />
  );
}

type Props = {
  points: CustomerLeadsTimeSeriesPoint[];
  granularity: CustomerChatsAnalyticsGranularity;
  hiddenSeriesIds: string[];
};

export function LeadsOverTimeTrendChart({ points, granularity, hiddenSeriesIds }: Props) {
  const chartData = useMemo(() => buildLeadsOverTimeChartRows(points, granularity), [points, granularity]);

  const visibleSeries = useMemo(
    () => LEADS_OVER_TIME_SERIES.filter((s) => !hiddenSeriesIds.includes(s.id)),
    [hiddenSeriesIds],
  );

  const visibleSeriesIds = useMemo(() => visibleSeries.map((s) => s.id), [visibleSeries]);

  const maxStackTotal = useMemo(() => {
    let max = 0;
    for (const row of chartData) {
      let sum = 0;
      for (const s of visibleSeries) {
        sum += s.id === 'conversations' ? row.conversations : row.leads;
      }
      if (sum > max) max = sum;
    }
    return max;
  }, [chartData, visibleSeries]);

  const yMax = maxStackTotal <= 0 ? 1 : Math.ceil(maxStackTotal * 1.08);
  const hasActivity = maxStackTotal > 0;

  const seriesElements = visibleSeries.map((s) => (
    <Area
      key={s.id}
      type="monotone"
      dataKey={s.id}
      name={s.label}
      stroke={s.color}
      fill={s.color}
      fillOpacity={0.18}
      strokeWidth={1.75}
      stackId="leadsOverTimeStack"
      dot={false}
      activeDot={hollowActiveDotProps(s.color)}
      isAnimationActive
      animationDuration={CHART_ANIM_MS}
      animationEasing="ease-out"
    />
  ));

  if (!points.length) {
    return (
      <AnalyticsChartEmpty message="No time-series data for this range." className="h-full min-h-[12rem] w-full flex-1" />
    );
  }

  if (!visibleSeries.length) {
    return (
      <AnalyticsChartEmpty
        message="Show at least one series from the list."
        className="h-full min-h-[12rem] w-full flex-1"
      />
    );
  }

  if (!hasActivity) {
    return (
      <AnalyticsChartEmpty message="No leads activity for this range." className="h-full min-h-[12rem] w-full flex-1" />
    );
  }

  return (
    <div
      className="flex h-full min-h-0 w-full min-w-0 max-w-full flex-1 flex-col transition-opacity duration-300 ease-out"
      key={visibleSeriesIds.join(',')}
    >
      <div className="min-h-[12rem] w-full min-w-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis
              dataKey="xLabel"
              tick={{ fontSize: 11, fill: '#64748b' }}
              tickMargin={8}
              interval="preserveStartEnd"
              axisLine={{ stroke: '#e2e8f0' }}
            />
            <YAxis
              domain={[0, yMax]}
              tick={{ fontSize: 11, fill: '#64748b' }}
              tickFormatter={(v) => formatAnalyticsInteger(Number(v))}
              width={44}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '4 4' }}
              content={({ active, label, payload }) => {
                if (!active || !payload?.length) return null;
                return (
                  <LeadsOverTimeTooltipBody
                    label={typeof label === 'string' ? label : String(label ?? '')}
                    payload={payload as readonly TipRow[]}
                    visibleSeriesIds={visibleSeriesIds}
                  />
                );
              }}
            />
            {seriesElements}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
