import { useMemo } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { CustomerChatsAnalyticsGranularity, CustomerChatsAnalyticsTimeSeriesPoint } from '@/api/types';
import {
  formatAnalyticsDateLabel,
  formatAnalyticsInteger,
} from '@/lib/analyticsFormat';
import { AnalyticsChartEmpty } from '../shared/AnalyticsChartEmpty';
import { CHART } from '../shared/analyticsChartTheme';
import {
  CHATS_MESSAGE_MODALITY_SERIES,
  CHATS_MESSAGE_TOTAL_AREA_KEY,
} from './chatsMessageModalityChartTheme';

const CHART_ANIM_MS = 520;

function hollowStrokeDot(color: string) {
  return { r: 3.5, fill: '#ffffff', stroke: color, strokeWidth: 2 };
}

type TipRow = { dataKey?: string | number; value?: number; color?: string; name?: string };

function ModalityTooltipBody({
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

type Props = {
  timeSeries: CustomerChatsAnalyticsTimeSeriesPoint[];
  granularity: CustomerChatsAnalyticsGranularity;
  hiddenSeriesIds: string[];
};

export function ChatsMessageModalityOverTimeChart({ timeSeries, granularity, hiddenSeriesIds }: Props) {
  const visibleSeries = useMemo(
    () => CHATS_MESSAGE_MODALITY_SERIES.filter((s) => !hiddenSeriesIds.includes(s.id)),
    [hiddenSeriesIds],
  );

  const chartData = useMemo(() => {
    return timeSeries.map((p) => {
      const text = Math.max(0, Math.trunc(p.textMessages ?? 0));
      const voice = Math.max(0, Math.trunc(p.voiceMessages ?? 0));
      const fromApi = p.userMessages;
      const userMessages =
        fromApi != null && Number.isFinite(fromApi)
          ? Math.max(0, Math.trunc(fromApi))
          : text + voice;
      return {
        xLabel: formatAnalyticsDateLabel(p.date, granularity),
        userMessages,
        textMessages: text,
        voiceMessages: voice,
      };
    });
  }, [timeSeries, granularity]);

  const visibleSeriesIds = useMemo(() => visibleSeries.map((s) => s.id), [visibleSeries]);

  const yMax = useMemo(() => {
    let max = 0;
    for (const row of chartData) {
      let peak = 0;
      for (const s of visibleSeries) {
        const v = Number(row[s.id as keyof typeof row] ?? 0);
        if (v > peak) peak = v;
      }
      if (peak > max) max = peak;
    }
    return max <= 0 ? 1 : Math.ceil(max * 1.08);
  }, [chartData, visibleSeries]);

  const hasSignal = useMemo(() => {
    if (!chartData.length) return false;
    for (const row of chartData) {
      for (const s of visibleSeries) {
        const v = Number(row[s.id as keyof typeof row] ?? 0);
        if (v > 0) return true;
      }
    }
    return false;
  }, [chartData, visibleSeries]);

  const areaVisible = !hiddenSeriesIds.includes(CHATS_MESSAGE_TOTAL_AREA_KEY);

  const chartInner = (
    <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
      <defs>
        <linearGradient id="chatsModalityMessagesGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={CHART.teal600} stopOpacity={0.28} />
          <stop offset="100%" stopColor={CHART.teal600} stopOpacity={0.04} />
        </linearGradient>
      </defs>
      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
      <XAxis
        dataKey="xLabel"
        tick={{ fontSize: 11, fill: '#64748b' }}
        tickMargin={8}
        interval="preserveStartEnd"
        axisLine={{ stroke: '#e2e8f0' }}
        tickLine={false}
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
        shared
        cursor={{ stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '4 4' }}
        content={({ active, label, payload }) => {
          if (!active || !payload?.length) return null;
          return (
            <ModalityTooltipBody
              label={typeof label === 'string' ? label : String(label ?? '')}
              payload={payload as readonly TipRow[]}
              visibleSeriesIds={visibleSeriesIds}
            />
          );
        }}
      />
      {areaVisible ? (
        <Area
          type="monotone"
          dataKey="userMessages"
          name="User messages"
          stroke={CHART.teal600}
          strokeWidth={2}
          fill="url(#chatsModalityMessagesGrad)"
          fillOpacity={1}
          dot={false}
          activeDot={{ r: 4, stroke: CHART.teal700, strokeWidth: 2, fill: '#ffffff' }}
          isAnimationActive
          animationDuration={CHART_ANIM_MS}
          animationEasing="ease-out"
        />
      ) : null}
      {visibleSeries
        .filter((s) => s.chart === 'line')
        .map((s) => (
          <Line
            key={s.id}
            type="monotone"
            dataKey={s.id}
            name={s.label}
            stroke={s.color}
            strokeWidth={2}
            dot={hollowStrokeDot(s.color)}
            activeDot={{ r: 5, fill: '#ffffff', stroke: s.color, strokeWidth: 2 }}
            isAnimationActive
            animationDuration={CHART_ANIM_MS}
            animationEasing="ease-out"
          />
        ))}
    </ComposedChart>
  );

  if (!visibleSeries.length) {
    return (
      <AnalyticsChartEmpty
        message="Show at least one series from the list."
        className="h-full min-h-[12rem] w-full flex-1"
      />
    );
  }

  if (!timeSeries.length || !hasSignal) {
    return (
      <AnalyticsChartEmpty message="No messages for this range." className="h-full min-h-[12rem] w-full flex-1" />
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 max-w-full flex-1 flex-col" key={visibleSeriesIds.join(',')}>
      <div className="min-h-[12rem] w-full min-w-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          {chartInner}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
