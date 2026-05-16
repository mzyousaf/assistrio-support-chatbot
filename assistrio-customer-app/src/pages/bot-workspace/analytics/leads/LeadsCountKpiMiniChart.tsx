import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CartesianGrid, Line, LineChart, YAxis } from 'recharts';
import type { CustomerChatsAnalyticsGranularity, CustomerLeadsTimeSeriesPoint } from '@/api/types';
import { formatAnalyticsDateLabel } from '@/lib/analyticsFormat';
import { CHART } from '../shared/analyticsChartTheme';

export type LeadsCountSeriesKey = 'completeLeads' | 'partialLeads';

export type LeadsCountChartRow = {
  xLabel: string;
  count: number;
};

export function buildLeadsCountChartRows(
  points: CustomerLeadsTimeSeriesPoint[],
  granularity: CustomerChatsAnalyticsGranularity,
  key: LeadsCountSeriesKey,
): LeadsCountChartRow[] {
  return points.map((p) => ({
    xLabel: formatAnalyticsDateLabel(p.date, granularity),
    count: Math.max(0, Math.trunc(p[key] ?? 0)),
  }));
}

type Props = {
  points: CustomerLeadsTimeSeriesPoint[];
  granularity: CustomerChatsAnalyticsGranularity;
  seriesKey: LeadsCountSeriesKey;
  chartHeight?: number;
  className?: string;
};

/**
 * Compact sparkline for integer lead counts — same shell as {@link LeadsConversionKpiMiniChart}: teal line, light grid.
 */
export function LeadsCountKpiMiniChart({
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

  const chartData = useMemo(
    () => buildLeadsCountChartRows(points, granularity, seriesKey),
    [points, granularity, seriesKey],
  );

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
          stroke={CHART.teal600}
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
