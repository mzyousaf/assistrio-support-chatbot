import { useMemo } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { CustomerTopicsAnalyticsResponse } from '@/api/types';
import { formatAnalyticsDateLabel, formatAnalyticsInteger, formatAnalyticsRatioAsPercent } from '@/lib/analyticsFormat';
import { cn } from '@/lib/utils';
import { AnalyticsChartCard } from '../shared/AnalyticsChartCard';
import { AnalyticsChartEmpty } from '../shared/AnalyticsChartEmpty';
import type { TopicsMetricMode } from './topicsChartHelpers';
import { TOPICS_ANALYTICS_SECTION_CARD_CLASS } from './topicsAnalyticsSectionLayout';

const CLASSIFIED_COLOR = '#0d9488';
const UNCLASSIFIED_COLOR = '#94a3b8';
const ANIM_MS = 520;

type Props = {
  data: CustomerTopicsAnalyticsResponse;
  metricMode: TopicsMetricMode;
};

export function TopicsClassificationSection({ data, metricMode }: Props) {
  const { summary } = data;
  const coverage = formatAnalyticsRatioAsPercent(summary.topicCoverageRate, 1);

  const timeSeries = data.topicMessageTimeSeries?.length ? data.topicMessageTimeSeries : data.timeSeries ?? [];

  const chartData = useMemo(
    () =>
      (timeSeries ?? []).map((p) => ({
        xLabel: formatAnalyticsDateLabel(p.date, data.range.granularity),
        classified: Math.max(0, Math.trunc(Number(p.classifiedMessages ?? 0))),
        unclassified: Math.max(0, Math.trunc(Number(p.unclassifiedMessages ?? 0))),
      })),
    [timeSeries, data.range.granularity],
  );

  const hasSeries = chartData.some((d) => d.classified > 0 || d.unclassified > 0);

  if (metricMode === 'conversations') {
    return (
      <AnalyticsChartCard
        title="Classification coverage"
        description="Message-level classification is not shown in By conversations mode."
        className={cn(
          'border-slate-100/95 shadow-[0_1px_3px_rgba(15,23,42,0.06)]',
          TOPICS_ANALYTICS_SECTION_CARD_CLASS,
        )}
        noMaxHeight
        bodyClassName="flex min-h-0 flex-1 flex-col !overflow-y-auto"
      >
        <p className="m-0 rounded-lg border border-slate-200/80 bg-slate-50/60 px-4 py-6 text-center text-sm leading-relaxed text-slate-600">
          Classification coverage is measured on user messages. Switch to <span className="font-semibold text-slate-800">By messages</span> to see classified vs unclassified over time.
        </p>
      </AnalyticsChartCard>
    );
  }

  return (
    <AnalyticsChartCard
      title="Classification coverage"
      description="How many messages were labeled vs left unclassified over time."
      className={cn(
        'border-slate-100/95 shadow-[0_1px_3px_rgba(15,23,42,0.06)]',
        TOPICS_ANALYTICS_SECTION_CARD_CLASS,
      )}
      noMaxHeight
      bodyClassName="flex min-h-0 flex-1 flex-col !overflow-y-auto"
    >
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <div className="grid shrink-0 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-100/90 bg-slate-50/40 px-3 py-3 transition-shadow duration-200 hover:shadow-sm">
            <p className="m-0 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Classified</p>
            <p className="mt-1 mb-0 text-lg font-semibold tabular-nums text-slate-900">
              {formatAnalyticsInteger(summary.classifiedMessages)}
            </p>
            <p className="mt-0.5 mb-0 text-[11px] text-slate-500">Messages with a topic label</p>
          </div>
          <div className="rounded-lg border border-slate-100/90 bg-slate-50/40 px-3 py-3 transition-shadow duration-200 hover:shadow-sm">
            <p className="m-0 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Unclassified</p>
            <p className="mt-1 mb-0 text-lg font-semibold tabular-nums text-slate-900">
              {formatAnalyticsInteger(summary.unclassifiedMessages)}
            </p>
            <p className="mt-0.5 mb-0 text-[11px] text-slate-500">No label yet</p>
          </div>
          <div className="rounded-lg border border-teal-100/90 bg-teal-50/30 px-3 py-3 transition-shadow duration-200 hover:shadow-sm">
            <p className="m-0 text-[11px] font-semibold uppercase tracking-wide text-teal-800/80">Coverage</p>
            <p className="mt-1 mb-0 text-lg font-semibold tabular-nums text-teal-900">{coverage}</p>
            <p className="mt-0.5 mb-0 text-[11px] text-teal-900/70">Classified ÷ all user messages</p>
          </div>
        </div>

        {!chartData.length || !hasSeries ? (
          <AnalyticsChartEmpty
            message="No classification time series for this range."
            className="min-h-[10rem] w-full flex-1"
          />
        ) : (
          <div className="min-h-0 w-full flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="xLabel"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickMargin={6}
                  interval="preserveStartEnd"
                  axisLine={{ stroke: '#e2e8f0' }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  width={40}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => formatAnalyticsInteger(Number(v))}
                />
                <Tooltip
                  content={({ active, label, payload }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="rounded-lg border border-slate-200/90 bg-white/95 px-3 py-2 text-xs shadow-lg">
                        <p className="m-0 mb-1 font-semibold text-slate-800">{String(label)}</p>
                        {payload.map((pl) => (
                          <p key={pl.dataKey?.toString()} className="m-0 tabular-nums text-slate-600">
                            <span className="font-medium text-slate-800">{pl.name}:</span>{' '}
                            {formatAnalyticsInteger(Number(pl.value))}
                          </p>
                        ))}
                      </div>
                    );
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="classified"
                  name="Classified"
                  stackId="a"
                  stroke={CLASSIFIED_COLOR}
                  fill={CLASSIFIED_COLOR}
                  fillOpacity={0.35}
                  strokeWidth={2}
                  isAnimationActive
                  animationDuration={ANIM_MS}
                  animationEasing="ease-out"
                />
                <Area
                  type="monotone"
                  dataKey="unclassified"
                  name="Unclassified"
                  stackId="a"
                  stroke={UNCLASSIFIED_COLOR}
                  fill={UNCLASSIFIED_COLOR}
                  fillOpacity={0.35}
                  strokeWidth={2}
                  isAnimationActive
                  animationDuration={ANIM_MS}
                  animationEasing="ease-out"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </AnalyticsChartCard>
  );
}
