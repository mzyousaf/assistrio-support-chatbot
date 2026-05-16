import { useMemo } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type {
  CustomerChatsAnalyticsGranularity,
  CustomerTopicsAnalyticsConversationTopicSeriesPoint,
  CustomerTopicsAnalyticsTimeSeriesPoint,
} from '@/api/types';
import { formatAnalyticsDateLabel, formatAnalyticsInteger } from '@/lib/analyticsFormat';
import { AnalyticsChartEmpty } from '../shared/AnalyticsChartEmpty';
import {
  UNCLASSIFIED_SERIES_ID,
  colorForSeriesInOrder,
  humanizeTopicKey,
  type TopicRankingRow,
  type TopicsMetricMode,
} from './topicsChartHelpers';

type TimePoint = CustomerTopicsAnalyticsTimeSeriesPoint | CustomerTopicsAnalyticsConversationTopicSeriesPoint;

const CHART_ANIM_MS = 520;

/** Visible markers: hollow circle (light fill + series stroke). */
function hollowDotProps(color: string, r = 3.5) {
  return {
    r,
    fill: '#ffffff',
    stroke: color,
    strokeWidth: 2,
  };
}

function hollowActiveDotProps(color: string) {
  return {
    r: 5,
    fill: '#ffffff',
    stroke: color,
    strokeWidth: 2.5,
  };
}

type Props = {
  points: TimePoint[];
  granularity: CustomerChatsAnalyticsGranularity;
  /** Full ranking order — used for stable series colors. */
  colorSeriesOrder: string[];
  /** Subset of series ids actually drawn. */
  chartSeriesOrder: string[];
  rankingRows: TopicRankingRow[];
  metricMode: TopicsMetricMode;
};

function pointValueForSeries(p: TimePoint, id: string): number {
  if (id === UNCLASSIFIED_SERIES_ID) {
    const raw = (p as CustomerTopicsAnalyticsTimeSeriesPoint).unclassifiedMessages;
    const v = Number(raw ?? 0);
    return Number.isFinite(v) ? Math.max(0, Math.trunc(v)) : 0;
  }
  const raw = (p as Record<string, unknown>)[id];
  const v = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(v) ? Math.max(0, Math.trunc(v)) : 0;
}

function tooltipValuePhrase(id: string, v: number, metricMode: TopicsMetricMode): string {
  const n = formatAnalyticsInteger(v);
  if (id === UNCLASSIFIED_SERIES_ID) {
    return `${n} messages`;
  }
  if (metricMode === 'conversations') {
    return `${n} chats`;
  }
  return `${n} mentions`;
}

type TipRow = { dataKey?: string | number; value?: number; color?: string; name?: string };

function TopicsTooltipBody({
  label,
  payload,
  chartSeriesOrder,
  metricMode,
}: {
  label?: string;
  payload: readonly TipRow[];
  chartSeriesOrder: string[];
  metricMode: TopicsMetricMode;
}) {
  const rows: { name: string; phrase: string }[] = [];
  for (const pl of payload) {
    const key = pl.dataKey != null ? String(pl.dataKey) : '';
    const si = chartSeriesOrder.indexOf(key);
    if (si < 0) continue;
    const v = Number(pl.value ?? 0);
    if (!Number.isFinite(v) || v <= 0) continue;
    rows.push({
      name: pl.name ?? '',
      phrase: tooltipValuePhrase(key, v, metricMode),
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
            <span className="shrink-0 text-slate-500">{r.phrase}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TopicsOverTimeChart({
  points,
  granularity,
  colorSeriesOrder,
  chartSeriesOrder,
  rankingRows,
  metricMode,
}: Props) {
  const labelById = useMemo(
    () => new Map(rankingRows.map((r) => [r.id, r.label] as const)),
    [rankingRows],
  );

  const chartData = useMemo(() => {
    return points.map((p) => {
      const row: Record<string, string | number> = {
        xLabel: formatAnalyticsDateLabel(p.date, granularity),
      };
      for (const id of colorSeriesOrder) {
        row[id] = pointValueForSeries(p, id);
      }
      return row;
    });
  }, [points, granularity, colorSeriesOrder]);

  const maxY = useMemo(() => {
    let m = 0;
    for (const row of chartData) {
      for (const id of chartSeriesOrder) {
        const v = Number(row[id] ?? 0);
        if (v > m) m = v;
      }
    }
    return m;
  }, [chartData, chartSeriesOrder]);

  const yMax = maxY <= 0 ? 1 : Math.ceil(maxY * 1.08);

  const commonAxes = (
    <>
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
            <TopicsTooltipBody
              label={typeof label === 'string' ? label : String(label ?? '')}
              payload={payload as readonly TipRow[]}
              chartSeriesOrder={chartSeriesOrder}
              metricMode={metricMode}
            />
          );
        }}
      />
    </>
  );

  const seriesElements = chartSeriesOrder.map((id) => {
    const color = colorForSeriesInOrder(id, colorSeriesOrder);
    const name = labelById.get(id) ?? humanizeTopicKey(id);
    return (
      <Line
        key={id}
        type="monotone"
        dataKey={id}
        name={name}
        stroke={color}
        strokeWidth={2.25}
        strokeLinecap="round"
        strokeLinejoin="round"
        dot={hollowDotProps(color)}
        activeDot={hollowActiveDotProps(color)}
        isAnimationActive
        animationDuration={CHART_ANIM_MS}
        animationEasing="ease-out"
      />
    );
  });

  if (!points.length || colorSeriesOrder.length === 0) {
    return <AnalyticsChartEmpty message="No topic activity for this range." className="h-full min-h-[12rem] w-full flex-1" />;
  }

  if (chartSeriesOrder.length === 0) {
    return (
      <AnalyticsChartEmpty
        message="Select at least one topic to show on the chart."
        className="h-full min-h-[12rem] w-full flex-1"
      />
    );
  }

  const chartInner = (
    <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
      {commonAxes}
      {seriesElements}
    </LineChart>
  );

  return (
    <div
      className="flex h-full min-h-0 w-full min-w-0 max-w-full flex-1 flex-col transition-opacity duration-300 ease-out"
      key={`${metricMode}-${chartSeriesOrder.join(',')}`}
    >
      <div className="min-h-[12rem] w-full min-w-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          {chartInner}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
