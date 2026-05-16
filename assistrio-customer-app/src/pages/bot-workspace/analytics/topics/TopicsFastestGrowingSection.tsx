import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { CustomerTopicsFastestGrowingItem } from '@/api/types';
import { formatAnalyticsInteger, formatAnalyticsNumber } from '@/lib/analyticsFormat';
import { cn } from '@/lib/utils';
import { AnalyticsChartCard } from '../shared/AnalyticsChartCard';
import type { TopicsMetricMode } from './topicsChartHelpers';
import { TOPICS_ANALYTICS_SECTION_CARD_CLASS } from './topicsAnalyticsSectionLayout';

const TOP_N = 5;
const POSITIVE = '#0d9488';
const MUTED = '#94a3b8';
const NEGATIVE = '#fb7185';

/** Display sort (top N): positive finite % first, then |change|, then currentCount. Exported for tests. */
export function compareFastestGrowingDisplay(
  a: CustomerTopicsFastestGrowingItem,
  b: CustomerTopicsFastestGrowingItem,
): number {
  const aPosPct = a.changePercent != null && Number.isFinite(a.changePercent) && a.changePercent > 0;
  const bPosPct = b.changePercent != null && Number.isFinite(b.changePercent) && b.changePercent > 0;
  if (aPosPct && bPosPct) {
    const d = (b.changePercent as number) - (a.changePercent as number);
    if (d !== 0) return d;
  } else if (aPosPct !== bPosPct) {
    return aPosPct ? -1 : 1;
  }
  const dChange = Math.abs(b.change) - Math.abs(a.change);
  if (dChange !== 0) return dChange;
  return b.currentCount - a.currentCount;
}

function slopeValueKey(topic: string): string {
  return `v_${topic}`;
}

function lineStroke(r: CustomerTopicsFastestGrowingItem): string {
  if (r.change < 0) return NEGATIVE;
  if (r.growthLabel === 'New' || r.changePercent == null) return MUTED;
  if (r.change > 0) return POSITIVE;
  return MUTED;
}

function formatGrowthPercent(r: CustomerTopicsFastestGrowingItem): string {
  if (r.growthLabel === 'New' || r.changePercent == null) return 'New';
  const sign = (r.changePercent as number) > 0 ? '+' : '';
  return `${sign}${formatAnalyticsNumber(r.changePercent, { maximumFractionDigits: 1 })}%`;
}

function formatChangeSigned(change: number): string {
  const sign = change > 0 ? '+' : change < 0 ? '' : '';
  return `${sign}${formatAnalyticsInteger(change)}`;
}

type ChartRow = Record<string, string | number>;

type Props = {
  rows: CustomerTopicsFastestGrowingItem[];
  metricMode: TopicsMetricMode;
};

export function TopicsFastestGrowingSection({ rows, metricMode }: Props) {
  const unit = metricMode === 'messages' ? 'mentions' : 'chats';

  const top = useMemo(
    () => [...rows].sort(compareFastestGrowingDisplay).slice(0, TOP_N),
    [rows],
  );

  const chartData: ChartRow[] = useMemo(() => {
    if (!top.length) return [];
    const prev: ChartRow = { xLabel: 'Previous' };
    const curr: ChartRow = { xLabel: 'Current' };
    for (const r of top) {
      const k = slopeValueKey(r.topic);
      prev[k] = r.previousCount;
      curr[k] = r.currentCount;
    }
    return [prev, curr];
  }, [top]);

  const yMax = useMemo(() => {
    let m = 1;
    for (const r of top) {
      m = Math.max(m, r.previousCount, r.currentCount);
    }
    return Math.ceil(m * 1.08);
  }, [top]);

  const [hoverTopic, setHoverTopic] = useState<string | null>(null);

  if (!rows.length) {
    return (
      <AnalyticsChartCard
        title="Fastest growing topics"
        description="Compare topic growth against the previous period."
        className={cn(
          'border-slate-100/95 shadow-[0_1px_3px_rgba(15,23,42,0.06)]',
          TOPICS_ANALYTICS_SECTION_CARD_CLASS,
        )}
        noMaxHeight
        bodyClassName="flex min-h-0 flex-1 flex-col !overflow-y-auto"
      >
        <p className="m-0 flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-slate-200/90 bg-slate-50/50 px-4 py-10 text-center text-sm text-slate-500">
          Not enough topic history yet.
        </p>
      </AnalyticsChartCard>
    );
  }

  return (
    <AnalyticsChartCard
      title="Fastest growing topics"
      description="Compare topic growth against the previous period."
      className={cn(
        'border-slate-100/95 shadow-[0_1px_3px_rgba(15,23,42,0.06)]',
        TOPICS_ANALYTICS_SECTION_CARD_CLASS,
      )}
      noMaxHeight
      bodyClassName="flex min-h-0 flex-1 flex-col !overflow-y-auto"
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-row gap-4 sm:gap-5">
        <div className="min-h-[220px] min-w-0 flex-1 basis-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 12, right: 8, left: 0, bottom: 8 }}
              onMouseLeave={() => setHoverTopic(null)}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis
                dataKey="xLabel"
                type="category"
                tickLine={false}
                axisLine={{ stroke: '#e2e8f0' }}
                tick={{ fontSize: 12, fill: '#64748b', fontWeight: 500 }}
                padding={{ left: 16, right: 16 }}
              />
              <YAxis
                domain={[0, yMax]}
                tickLine={false}
                axisLine={{ stroke: '#e2e8f0' }}
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                tickFormatter={(v) => formatAnalyticsInteger(v)}
                width={36}
                allowDecimals={false}
              />
              <Tooltip
                shared={false}
                cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }}
                content={({ active, payload }) => {
                  if (!active || !payload?.[0]) return null;
                  const dk = String(payload[0].dataKey ?? '');
                  const topicId = dk.startsWith('v_') ? dk.slice(2) : '';
                  const row = top.find((t) => t.topic === topicId);
                  if (!row) return null;
                  return (
                    <div className="max-w-[18rem] rounded-lg border border-slate-200/90 bg-white px-3 py-2 text-xs shadow-md">
                      <p className="m-0 font-semibold text-slate-900">{row.label}</p>
                      <ul className="m-0 mt-2 list-none space-y-1 p-0 tabular-nums text-slate-600">
                        <li>Previous: {formatAnalyticsInteger(row.previousCount)}</li>
                        <li>Current: {formatAnalyticsInteger(row.currentCount)}</li>
                        <li>Change: {formatChangeSigned(row.change)}</li>
                        <li className="font-medium text-slate-800">
                          Growth: {row.growthLabel === 'New' ? 'New' : formatGrowthPercent(row)}
                        </li>
                      </ul>
                    </div>
                  );
                }}
              />
              {top.map((r) => {
                const stroke = lineStroke(r);
                const dim = hoverTopic != null && hoverTopic !== r.topic;
                return (
                  <Line
                    key={r.topic}
                    type="linear"
                    dataKey={slopeValueKey(r.topic)}
                    name={r.label}
                    stroke={stroke}
                    strokeWidth={2}
                    strokeOpacity={dim ? 0.22 : 1}
                    dot={{ r: 3.5, fill: stroke, stroke: '#fff', strokeWidth: 1 }}
                    activeDot={{ r: 5, fill: stroke, stroke: '#fff', strokeWidth: 2 }}
                    isAnimationActive={false}
                    onMouseEnter={() => setHoverTopic(r.topic)}
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="flex min-h-0 min-w-[10rem] w-[min(36%,280px)] max-w-[280px] shrink-0 flex-col border-l border-slate-100 pl-4 pt-0">
          <p className="m-0 mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Top {TOP_N}</p>
          <ol className="m-0 list-none space-y-2.5 p-0">
            {top.map((r, i) => (
              <li
                key={r.topic}
                className="rounded-md border border-slate-100/90 bg-slate-50/30 px-2.5 py-2 text-xs transition-colors hover:bg-slate-50/80"
                aria-label={`Rank ${i + 1}: ${r.label}`}
                onMouseEnter={() => setHoverTopic(r.topic)}
                onMouseLeave={() => setHoverTopic(null)}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0 font-medium text-slate-900">
                    <span className="mr-1.5 tabular-nums text-slate-400">{i + 1}.</span>
                    {r.label}
                  </span>
                  <span
                    className={cn(
                      'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold tabular-nums',
                      r.growthLabel === 'New' || r.changePercent == null
                        ? 'bg-slate-200/80 text-slate-600'
                        : r.change < 0
                          ? 'bg-rose-100/90 text-rose-800'
                          : 'bg-teal-100/80 text-teal-900',
                    )}
                  >
                    {formatChangeSigned(r.change)} / {r.growthLabel === 'New' ? 'New' : formatGrowthPercent(r)}
                  </span>
                </div>
                <p className="m-0 mt-1 tabular-nums text-[11px] text-slate-500">
                  {formatAnalyticsInteger(r.previousCount)} → {formatAnalyticsInteger(r.currentCount)}{' '}
                  <span className="text-slate-400">({unit})</span>
                </p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </AnalyticsChartCard>
  );
}
