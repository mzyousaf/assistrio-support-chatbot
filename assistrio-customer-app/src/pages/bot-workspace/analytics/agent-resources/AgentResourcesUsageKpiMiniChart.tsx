import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CartesianGrid, Line, LineChart, YAxis } from 'recharts';
import type {
  CustomerAgentResourcesUsageTimePoint,
  CustomerChatsAnalyticsGranularity,
} from '@/api/types';
import { formatAnalyticsDateLabel } from '@/lib/analyticsFormat';

export type AgentResourcesUsageSparkSeriesKey =
  | 'totalCreditsUsed'
  | 'textMessages'
  | 'voiceMessages'
  | 'voiceDictationSessions'
  | 'textCreditsAttributed'
  | 'voiceCreditsAttributed'
  | 'dictationCreditsAttributed';

export type AgentResourcesUsageSparkRow = {
  xLabel: string;
  value: number;
};

function pointSeriesValue(p: CustomerAgentResourcesUsageTimePoint, key: AgentResourcesUsageSparkSeriesKey): number {
  switch (key) {
    case 'totalCreditsUsed':
      return Number(p.totalCreditsUsed ?? 0);
    case 'textMessages':
      return (
        Number(p.textMessages ?? 0) +
        Number(p.suggestedQuestionMessages ?? 0)
      );
    case 'voiceMessages':
      return Number(p.voiceMessages ?? 0);
    case 'voiceDictationSessions':
      return Number(p.voiceDictationSessions ?? 0);
    case 'textCreditsAttributed':
      return (
        Number(p.textCreditsAttributed ?? 0) +
        Number(p.suggestedQuestionCreditsAttributed ?? 0)
      );
    case 'voiceCreditsAttributed':
      return Number(p.voiceCreditsAttributed ?? 0);
    case 'dictationCreditsAttributed':
      return Number(p.dictationCreditsAttributed ?? 0);
  }
}

export function buildAgentResourcesUsageSparkRows(
  points: CustomerAgentResourcesUsageTimePoint[],
  granularity: CustomerChatsAnalyticsGranularity,
  seriesKey: AgentResourcesUsageSparkSeriesKey,
): AgentResourcesUsageSparkRow[] {
  return points.map((p) => ({
    xLabel: formatAnalyticsDateLabel(p.date, granularity),
    value: Math.max(0, pointSeriesValue(p, seriesKey)),
  }));
}

type Props = {
  points: CustomerAgentResourcesUsageTimePoint[];
  granularity: CustomerChatsAnalyticsGranularity;
  seriesKey: AgentResourcesUsageSparkSeriesKey;
  stroke: string;
  chartHeight?: number;
  className?: string;
};

/**
 * Compact sparkline for usage metrics — shell matches leads KPI mini charts.
 */
export function AgentResourcesUsageKpiMiniChart({
  points,
  granularity,
  seriesKey,
  stroke,
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

  const chartData = useMemo(
    () => buildAgentResourcesUsageSparkRows(points, granularity, seriesKey),
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
          dataKey="value"
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
