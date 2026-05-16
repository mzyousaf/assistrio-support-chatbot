import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CartesianGrid, Line, LineChart, YAxis } from 'recharts';
import type { CustomerChatsAnalyticsGranularity, CustomerChatsAnalyticsTimeSeriesPoint } from '@/api/types';
import { formatAnalyticsDateLabel } from '@/lib/analyticsFormat';
import { CHART } from '../shared/analyticsChartTheme';

export type ChatsSummaryMiniSeriesKey = 'conversations' | 'messages' | 'thumbsUp' | 'thumbsDown';

type Row = { xLabel: string; count: number };

function countForSeries(p: CustomerChatsAnalyticsTimeSeriesPoint, seriesKey: ChatsSummaryMiniSeriesKey): number {
  switch (seriesKey) {
    case 'conversations':
      return Math.max(0, Math.trunc(p.conversations ?? 0));
    case 'messages':
      return Math.max(0, Math.trunc(p.messages ?? 0));
    case 'thumbsUp':
      return Math.max(0, Math.trunc(p.thumbsUp ?? 0));
    case 'thumbsDown':
      return Math.max(0, Math.trunc(p.thumbsDown ?? 0));
  }
}

function buildRows(
  points: CustomerChatsAnalyticsTimeSeriesPoint[],
  granularity: CustomerChatsAnalyticsGranularity,
  seriesKey: ChatsSummaryMiniSeriesKey,
): Row[] {
  return points.map((p) => ({
    xLabel: formatAnalyticsDateLabel(p.date, granularity),
    count: countForSeries(p, seriesKey),
  }));
}

const STROKE: Record<ChatsSummaryMiniSeriesKey, string> = {
  conversations: CHART.teal600,
  messages: CHART.slate500,
  thumbsUp: CHART.teal700,
  thumbsDown: CHART.rose400,
};

type Props = {
  points: CustomerChatsAnalyticsTimeSeriesPoint[];
  granularity: CustomerChatsAnalyticsGranularity;
  seriesKey: ChatsSummaryMiniSeriesKey;
  chartHeight?: number;
  className?: string;
};

/** Compact sparkline for chats summary KPIs — matches Leads count mini chart layout. */
export function ChatsSummaryKpiMiniChart({
  points,
  granularity,
  seriesKey,
  chartHeight = 88,
  className,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(120);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => setWidth(Math.max(48, Math.floor(el.getBoundingClientRect().width)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const chartData = useMemo(() => buildRows(points, granularity, seriesKey), [points, granularity, seriesKey]);
  const stroke = STROKE[seriesKey];

  if (!points.length) {
    return (
      <div
        ref={wrapRef}
        className={`flex w-full items-center justify-center rounded-md border border-dashed border-slate-200/90 bg-slate-50/50 text-[11px] text-slate-400 ${className ?? ''}`}
        style={{ height: chartHeight }}
      >
        No trend data
      </div>
    );
  }

  return (
    <div ref={wrapRef} className={`w-full min-w-0 ${className ?? ''}`} style={{ height: chartHeight }} aria-hidden>
      <LineChart width={width} height={chartHeight} data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 2 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <YAxis domain={[0, 'dataMax']} hide width={0} />
        <Line
          type="monotone"
          dataKey="count"
          stroke={stroke}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          dot={false}
          activeDot={false}
          connectNulls
          isAnimationActive
          animationDuration={420}
          animationEasing="ease-out"
        />
      </LineChart>
    </div>
  );
}
