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
 * Compact sparkline matching {@link LeadsConversionRateChart}: percent axis 0–100, teal monotone line, connectNulls.
 */
export function LeadsConversionKpiMiniChart({
  points,
  granularity,
  chartHeight = 76,
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

  const chartData = useMemo(() => buildLeadsConversionChartRows(points, granularity), [points, granularity]);

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
        <YAxis domain={[0, 100]} hide width={0} />
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
