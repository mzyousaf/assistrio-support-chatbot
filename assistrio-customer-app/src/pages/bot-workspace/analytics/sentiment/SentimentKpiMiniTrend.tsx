import { useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Area, AreaChart, YAxis } from 'recharts';
import type { CustomerChatsAnalyticsGranularity, CustomerSentimentAnalyticsTimeSeriesPoint } from '@/api/types';
import { formatAnalyticsDateLabel } from '@/lib/analyticsFormat';
import { cn } from '@/lib/utils';
import { CHART } from '../shared/analyticsChartTheme';

type Point = { label: string; score: number };

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

/** Chart uses 0 for missing scores so the area renders a flat neutral baseline. */
function chartScore(v: unknown): number {
  return finiteScore(v) ?? 0;
}

export function SentimentKpiMiniTrend({ points, granularity, className, chartHeight = 52 }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(120);
  const gradientId = `sentimentMiniTrendFill-${useId().replace(/:/g, '')}`;

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => setWidth(Math.max(48, Math.floor(el.getBoundingClientRect().width)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const data = useMemo<Point[]>(() => {
    if (points.length > 0) {
      return points.map((p) => ({
        label: formatAnalyticsDateLabel(p.date, granularity),
        score: chartScore(p.averageSentimentScore),
      }));
    }
    return [
      { label: '', score: 0 },
      { label: '', score: 0 },
    ];
  }, [points, granularity]);

  return (
    <div
      ref={wrapRef}
      className={cn(
        'mt-2 w-full min-w-0 transition-opacity duration-200 ease-out hover:opacity-95',
        className,
      )}
      style={{ height: chartHeight }}
      aria-hidden
    >
      <AreaChart width={width} height={chartHeight} data={data} margin={{ top: 2, right: 2, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART.teal600} stopOpacity={0.22} />
            <stop offset="100%" stopColor={CHART.teal600} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <YAxis domain={[-1, 1]} hide width={0} />
        <Area
          type="linear"
          dataKey="score"
          baseLine={0}
          stroke={CHART.teal600}
          strokeWidth={1.5}
          fill={`url(#${gradientId})`}
          connectNulls
          dot={false}
          isAnimationActive
          animationDuration={420}
          animationEasing="ease-out"
        />
      </AreaChart>
    </div>
  );
}
