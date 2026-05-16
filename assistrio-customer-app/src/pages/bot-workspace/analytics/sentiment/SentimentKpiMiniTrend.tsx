import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CartesianGrid, Line, LineChart, YAxis } from 'recharts';
import type { CustomerChatsAnalyticsGranularity, CustomerSentimentAnalyticsTimeSeriesPoint } from '@/api/types';
import { cn } from '@/lib/utils';
import { CHART } from '../shared/analyticsChartTheme';

type Row = { score: number };

type Props = {
  points: CustomerSentimentAnalyticsTimeSeriesPoint[];
  granularity: CustomerChatsAnalyticsGranularity;
  className?: string;
  chartHeight?: number;
};

function finiteScore(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  return null;
}

/** Match Chats KPI mini charts: missing bucket scores flatten to 0 so the line stays defined. */
function rowScore(p: CustomerSentimentAnalyticsTimeSeriesPoint): number {
  return finiteScore(p.averageSentimentScore) ?? 0;
}

function buildRows(points: CustomerSentimentAnalyticsTimeSeriesPoint[]): Row[] {
  return points.map((p) => ({ score: rowScore(p) }));
}

/**
 * Sparkline for average sentiment over time — same layout as {@link ChatsSummaryKpiMiniChart}
 * (line + horizontal grid, no area fill).
 */
export function SentimentKpiMiniTrend({ points, granularity: _granularity, className, chartHeight = 88 }: Props) {
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

  const chartData = useMemo(() => buildRows(points), [points]);

  if (!points.length) {
    return (
      <div
        ref={wrapRef}
        className={cn(
          'flex w-full items-center justify-center rounded-md border border-dashed border-slate-200/90 bg-slate-50/50 text-[11px] text-slate-400',
          className,
        )}
        style={{ height: chartHeight }}
      >
        No trend data
      </div>
    );
  }

  return (
    <div
      ref={wrapRef}
      className={cn('w-full min-w-0', className)}
      style={{ height: chartHeight }}
      aria-hidden
    >
      <LineChart width={width} height={chartHeight} data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 2 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <YAxis domain={[-1, 1]} hide width={0} />
        <Line
          type="monotone"
          dataKey="score"
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
