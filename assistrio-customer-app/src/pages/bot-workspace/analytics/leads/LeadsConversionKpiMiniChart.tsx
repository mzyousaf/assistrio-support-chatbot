import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CartesianGrid, Line, LineChart, YAxis } from 'recharts';
import type { CustomerChatsAnalyticsGranularity, CustomerLeadsTimeSeriesPoint } from '@/api/types';
import { CHART } from '../shared/analyticsChartTheme';
import { buildLeadsConversionChartRows } from './LeadsConversionRateChart';

type Props = {
  points: CustomerLeadsTimeSeriesPoint[];
  granularity: CustomerChatsAnalyticsGranularity;
  chartHeight?: number;
  className?: string;
};

/**
 * Compact sparkline: same Y scaling as {@link LeadsCountKpiMiniChart} (`domain={[0, 'dataMax']}`) so a flat
 * zero series sits in the visual band like the other lead KPI sparklines.
 */
export function LeadsConversionKpiMiniChart({
  points,
  granularity,
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

  /** Map null buckets to 0 so the sparkline draws the same teal baseline as count KPIs (all-null otherwise yields no line). */
  const chartData = useMemo(
    () =>
      buildLeadsConversionChartRows(points, granularity).map((row) => ({
        ...row,
        conversionPercent: row.conversionPercent ?? 0,
      })),
    [points, granularity],
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
        {/* Same scale as {@link LeadsCountKpiMiniChart}: [0, dataMax] so an all-zero series sits mid-band like the count sparklines, not pinned to the bottom of a 0–100 axis. */}
        <YAxis domain={[0, 'dataMax']} hide width={0} />
        <Line
          type="monotone"
          dataKey="conversionPercent"
          name="Conversion rate"
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
