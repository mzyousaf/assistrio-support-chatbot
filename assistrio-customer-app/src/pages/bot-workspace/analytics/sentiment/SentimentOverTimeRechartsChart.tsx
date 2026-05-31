import { useMemo } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
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
  CustomerSentimentAnalyticsTimeSeriesPoint,
} from '@/api/types';
import { formatAnalyticsDateLabel, formatAnalyticsInteger } from '@/lib/analyticsFormat';
import { AnalyticsChartEmpty } from '../shared/AnalyticsChartEmpty';
import {
  colorForSentimentSeries,
  formatSentimentOverTimeTooltipCount,
} from './sentimentTrendsChartHelpers';

const CHART_ANIM_MS = 520;

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

function valueForSeries(p: CustomerSentimentAnalyticsTimeSeriesPoint, id: string): number {
  if (id === 'unclassified') return Math.max(0, Math.trunc(p.unclassifiedMessages ?? 0));
  const raw = (p as Record<string, unknown>)[id];
  const v = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(v) ? Math.max(0, Math.trunc(v)) : 0;
}

type TipRow = { dataKey?: string | number; value?: number; color?: string; name?: string };

function SentimentRechartsTooltipBody({
  label,
  payload,
  chartSeriesOrder,
  countUnit,
}: {
  label?: string;
  payload: readonly TipRow[];
  chartSeriesOrder: string[];
  countUnit: 'messages' | 'chats';
}) {
  const rows: { name: string; phrase: string }[] = [];
  for (const pl of payload) {
    const key = pl.dataKey != null ? String(pl.dataKey) : '';
    const si = chartSeriesOrder.indexOf(key);
    if (si < 0) continue;
    const v = Number(pl.value ?? 0);
    if (!Number.isFinite(v) || v <= 0) continue;
    rows.push({
      name: pl.name ?? key,
      phrase: formatSentimentOverTimeTooltipCount(v, countUnit),
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

type Props = {
  points: CustomerSentimentAnalyticsTimeSeriesPoint[];
  granularity: CustomerChatsAnalyticsGranularity;
  colorSeriesOrder: readonly string[];
  chartSeriesOrder: string[];
  labelById: Map<string, string>;
  chartVariant: 'line' | 'area' | 'bar';
  countUnit?: 'messages' | 'chats';
};

export function SentimentOverTimeRechartsChart({
  points,
  granularity,
  colorSeriesOrder,
  chartSeriesOrder,
  labelById,
  chartVariant,
  countUnit = 'messages',
}: Props) {
  const chartData = useMemo(() => {
    return points.map((p) => {
      const row: Record<string, string | number> = {
        xLabel: formatAnalyticsDateLabel(p.date, granularity),
      };
      for (const id of colorSeriesOrder) {
        row[id] = valueForSeries(p, id);
      }
      return row;
    });
  }, [points, granularity, colorSeriesOrder]);

  const maxY = useMemo(() => {
    let m = 0;
    for (const row of chartData) {
      if (chartVariant === 'area' || chartVariant === 'bar') {
        let sum = 0;
        for (const id of chartSeriesOrder) {
          sum += Number(row[id] ?? 0);
        }
        if (sum > m) m = sum;
      } else {
        for (const id of chartSeriesOrder) {
          const v = Number(row[id] ?? 0);
          if (v > m) m = v;
        }
      }
    }
    return m;
  }, [chartData, chartSeriesOrder, chartVariant]);

  const yMax = maxY <= 0 ? 1 : Math.ceil(maxY * 1.08);

  const tooltipCursor =
    chartVariant === 'bar'
      ? { fill: 'rgba(13, 148, 136, 0.06)' }
      : { stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '4 4' };

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
        cursor={tooltipCursor}
        content={({ active, label, payload }) => {
          if (!active || !payload?.length) return null;
          return (
            <SentimentRechartsTooltipBody
              label={typeof label === 'string' ? label : String(label ?? '')}
              payload={payload as readonly TipRow[]}
              chartSeriesOrder={chartSeriesOrder}
              countUnit={countUnit}
            />
          );
        }}
      />
    </>
  );

  const seriesElements = chartSeriesOrder.map((id, index) => {
    const color = colorForSentimentSeries(id);
    const name = labelById.get(id) ?? id;
    if (chartVariant === 'bar') {
      const isStackTop = index === chartSeriesOrder.length - 1;
      return (
        <Bar
          key={id}
          dataKey={id}
          name={name}
          stackId="sentimentStack"
          fill={color}
          radius={isStackTop ? [4, 4, 0, 0] : [0, 0, 0, 0]}
          maxBarSize={56}
          isAnimationActive
          animationDuration={CHART_ANIM_MS}
          animationEasing="ease-out"
        />
      );
    }
    if (chartVariant === 'area') {
      return (
        <Area
          key={id}
          type="monotone"
          dataKey={id}
          name={name}
          stroke={color}
          fill={color}
          fillOpacity={0.18}
          strokeWidth={1.75}
          stackId="sentimentStack"
          dot={false}
          activeDot={hollowActiveDotProps(color)}
          isAnimationActive
          animationDuration={CHART_ANIM_MS}
          animationEasing="ease-out"
        />
      );
    }
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

  if (!points.length) {
    return (
      <AnalyticsChartEmpty
        message="No time-series data for this range."
        className="h-full min-h-[12rem] w-full flex-1"
      />
    );
  }

  if (chartSeriesOrder.length === 0) {
    return (
      <AnalyticsChartEmpty
        message="Select at least one series to display."
        className="h-full min-h-[12rem] w-full flex-1"
      />
    );
  }

  if ((chartVariant === 'area' || chartVariant === 'bar') && maxY <= 0) {
    return (
      <AnalyticsChartEmpty message="No sentiment activity in this range." className="h-full min-h-[12rem] w-full flex-1" />
    );
  }

  const chartInner =
    chartVariant === 'area' ? (
      <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
        {commonAxes}
        {seriesElements}
      </AreaChart>
    ) : chartVariant === 'bar' ? (
      <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
        {commonAxes}
        {seriesElements}
      </BarChart>
    ) : (
      <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
        {commonAxes}
        {seriesElements}
      </LineChart>
    );

  return (
    <div
      className="flex h-full min-h-0 w-full min-w-0 max-w-full flex-1 flex-col transition-opacity duration-300 ease-out"
      key={`${chartVariant}-${chartSeriesOrder.join(',')}`}
    >
      <div className="min-h-[12rem] w-full min-w-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          {chartInner}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
