import { useMemo } from 'react';
import type { CustomerSentimentBreakdownItem, CustomerSentimentLabelId } from '@/api/types';
import { formatAnalyticsInteger } from '@/lib/analyticsFormat';
import type { SentimentMetricMode } from '@/lib/sentimentAnalyticsQuery';
import { cn } from '@/lib/utils';
import { SENTIMENT_CHART_COLORS, SENTIMENT_STACK_ORDER } from './sentimentChartTheme';
import { CHART } from '../shared/analyticsChartTheme';

const ORDER: readonly CustomerSentimentLabelId[] = [...SENTIMENT_STACK_ORDER] as const;

type Props = {
  breakdown: CustomerSentimentBreakdownItem[];
  metricMode: SentimentMetricMode;
  className?: string;
  chartHeight?: number;
};

export function SentimentKpiMiniDistribution({
  breakdown,
  metricMode,
  className,
  chartHeight = 36,
}: Props) {
  const segments = useMemo(() => {
    return ORDER.map((id) => {
      const row = breakdown.find((r) => r.sentiment === id);
      const count =
        metricMode === 'messages'
          ? Math.max(0, Math.trunc(row?.messages ?? 0))
          : Math.max(0, Math.trunc(row?.conversations ?? 0));
      return {
        id,
        count,
        label: row?.label ?? id,
        color: SENTIMENT_CHART_COLORS[id] ?? CHART.slate400,
      };
    });
  }, [breakdown, metricMode]);

  const total = segments.reduce((s, x) => s + x.count, 0);

  if (total <= 0) {
    return (
      <div
        className={cn(
          'flex w-full items-center justify-center rounded-lg bg-slate-50/50',
          className,
        )}
        style={{ height: chartHeight }}
      >
        <span className="text-[10px] font-medium text-slate-400">No classified volume</span>
      </div>
    );
  }

  return (
    <div
      className={cn('flex w-full items-center', className)}
      style={{ height: chartHeight }}
      title={segments
        .filter((s) => s.count > 0)
        .map((s) => `${s.label}: ${formatAnalyticsInteger(s.count)}`)
        .join(' · ')}
    >
      <div className="flex h-3 w-full overflow-hidden rounded-full border border-slate-100/90 bg-slate-50 shadow-[inset_0_1px_1px_rgba(15,23,42,0.04)]">
        {segments.map((s) => {
          const pct = (s.count / total) * 100;
          if (pct <= 0) return null;
          return (
            <div
              key={s.id}
              className={cn('h-full min-w-px transition-[filter] duration-200 ease-out hover:brightness-[1.03]')}
              style={{ width: `${pct}%`, backgroundColor: s.color }}
              aria-hidden
            />
          );
        })}
      </div>
    </div>
  );
}
