import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { CustomerTopicsAnalyticsResponse } from '@/api/types';
import { formatAnalyticsInteger } from '@/lib/analyticsFormat';
import { cn } from '@/lib/utils';
import { AnalyticsChartCard } from '../shared/AnalyticsChartCard';
import { AnalyticsChartEmpty } from '../shared/AnalyticsChartEmpty';
import type { TopicsMetricMode } from './topicsChartHelpers';
import { TOPICS_ANALYTICS_SECTION_CARD_CLASS } from './topicsAnalyticsSectionLayout';

const STACK = [
  { key: 'positive' as const, legend: 'Positive', fill: '#0d9488' },
  { key: 'neutral' as const, legend: 'Neutral', fill: '#64748b' },
  { key: 'negative' as const, legend: 'Negative', fill: '#f43f5e' },
  { key: 'mixed' as const, legend: 'Mixed', fill: '#d97706' },
  { key: 'unknown' as const, legend: 'Unknown', fill: '#94a3b8' },
];

type ChartRow = {
  topicKey: string;
  topicLabel: string;
  positive: number;
  neutral: number;
  negative: number;
  mixed: number;
  unknown: number;
  totalMessages: number;
};

type Props = {
  data: CustomerTopicsAnalyticsResponse;
  metricMode: TopicsMetricMode;
};

export function TopicsTopicBySentimentSection({ data, metricMode }: Props) {
  const rows = data.topicSentimentBreakdown ?? [];

  const chartData = useMemo((): ChartRow[] => {
    const mapped = rows.map((r) => ({
      topicKey: r.topic,
      topicLabel: r.label,
      positive: Math.max(0, Math.trunc(r.positive)),
      neutral: Math.max(0, Math.trunc(r.neutral)),
      negative: Math.max(0, Math.trunc(r.negative)),
      mixed: Math.max(0, Math.trunc(r.mixed)),
      unknown: Math.max(0, Math.trunc(r.unknown)),
      totalMessages: Math.max(0, Math.trunc(r.totalMessages)),
    }));
    return mapped;
  }, [rows]);

  const yAxisWidth = useMemo(() => {
    const maxLen = chartData.reduce((m, r) => Math.max(m, r.topicLabel.length), 0);
    return Math.min(200, Math.max(96, 7 * maxLen + 16));
  }, [chartData]);

  if (metricMode === 'conversations') {
    return (
      <AnalyticsChartCard
        title="Topic by sentiment"
        description="See which topics create positive, neutral, negative, or mixed user messages."
        className={cn(
          'border-slate-100/95 shadow-[0_1px_3px_rgba(15,23,42,0.06)]',
          TOPICS_ANALYTICS_SECTION_CARD_CLASS,
        )}
        noMaxHeight
        bodyClassName="flex min-h-0 flex-1 flex-col !overflow-y-auto"
      >
        <p className="m-0 rounded-lg border border-slate-200/80 bg-slate-50/60 px-4 py-6 text-center text-sm leading-relaxed text-slate-600">
          Topic sentiment is measured on user messages. Switch to{' '}
          <span className="font-semibold text-slate-800">By messages</span> to see this chart.
        </p>
      </AnalyticsChartCard>
    );
  }

  const hasRows = rows.length > 0;

  return (
    <AnalyticsChartCard
      title="Topic by sentiment"
      description="See which topics create positive, neutral, negative, or mixed user messages."
      className={cn(
        'border-slate-100/95 shadow-[0_1px_3px_rgba(15,23,42,0.06)]',
        TOPICS_ANALYTICS_SECTION_CARD_CLASS,
      )}
      noMaxHeight
      bodyClassName="flex min-h-0 flex-1 flex-col !overflow-y-auto"
    >
      {!hasRows ? (
        <AnalyticsChartEmpty message="No topic sentiment data for this range." />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <div className="min-h-[280px] w-full min-w-0 flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={chartData}
                margin={{ top: 4, right: 12, left: 4, bottom: 4 }}
                barCategoryGap={10}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis
                  type="number"
                  tickLine={false}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  tickFormatter={(v) => formatAnalyticsInteger(v)}
                />
                <YAxis
                  type="category"
                  dataKey="topicLabel"
                  width={yAxisWidth}
                  tickLine={false}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tick={{ fill: '#334155', fontSize: 11 }}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(148, 163, 184, 0.12)' }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const row = payload[0]?.payload as ChartRow | undefined;
                    if (!row) return null;
                    return (
                      <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
                        <p className="m-0 mb-2 font-semibold text-slate-900">{row.topicLabel}</p>
                        <ul className="m-0 list-none space-y-1 p-0 text-slate-600">
                          <li>Positive: {formatAnalyticsInteger(row.positive)}</li>
                          <li>Neutral: {formatAnalyticsInteger(row.neutral)}</li>
                          <li>Negative: {formatAnalyticsInteger(row.negative)}</li>
                          <li>Mixed: {formatAnalyticsInteger(row.mixed)}</li>
                          <li>Unknown: {formatAnalyticsInteger(row.unknown)}</li>
                          <li className="mt-1 border-t border-slate-100 pt-1 font-medium text-slate-800">
                            Total messages: {formatAnalyticsInteger(row.totalMessages)}
                          </li>
                        </ul>
                      </div>
                    );
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                  formatter={(value) => <span className="text-slate-600">{value}</span>}
                />
                {STACK.map((s) => (
                  <Bar
                    key={s.key}
                    dataKey={s.key}
                    name={s.legend}
                    stackId="topicSentiment"
                    fill={s.fill}
                    maxBarSize={28}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </AnalyticsChartCard>
  );
}
