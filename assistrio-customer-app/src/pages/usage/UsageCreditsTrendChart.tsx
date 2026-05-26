import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  buildAiCreditsTrendPoints,
  type AiCreditsTrendPoint,
} from '@/pages/usage/usagePageFormat';
import { UsageChartViewToggle, type UsageChartViewMode } from '@/pages/usage/UsageChartViewToggle';
import { UsageSectionCard } from '@/pages/usage/UsageSectionCard';
import { USAGE_CHART, USAGE_CHART_TOOLTIP_CLASS } from '@/pages/usage/usageChartTheme';

type Props = {
  periodStart: string | null | undefined;
  periodEnd: string | null | undefined;
  monthlyCreditsUsed: number;
  className?: string;
};

function CreditsTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: readonly { value?: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const credits = Number(payload[0]?.value ?? 0);
  return (
    <div className={USAGE_CHART_TOOLTIP_CLASS}>
      <p className="m-0 font-medium text-slate-800">{label}</p>
      <p className="m-0 mt-0.5 tabular-nums text-slate-600">{credits.toLocaleString()} credits</p>
    </div>
  );
}

export function UsageCreditsTrendChart({
  periodStart,
  periodEnd,
  monthlyCreditsUsed,
  className,
}: Props) {
  const [viewMode, setViewMode] = useState<UsageChartViewMode>('trend');

  const trendPoints = useMemo(
    () => buildAiCreditsTrendPoints(periodStart, periodEnd, monthlyCreditsUsed),
    [periodStart, periodEnd, monthlyCreditsUsed],
  );

  const chartData: AiCreditsTrendPoint[] =
    trendPoints.length >= 2
      ? trendPoints
      : [
          ...trendPoints,
          { label: 'Current', credits: monthlyCreditsUsed },
        ].slice(0, Math.max(2, trendPoints.length));

  return (
    <UsageSectionCard
      id="usage-credits-trend"
      className={className}
      title="Usage trend"
      description="Estimated from current billing-period usage."
      headerAction={<UsageChartViewToggle value={viewMode} onChange={setViewMode} />}
      bodyClassName="flex flex-col"
      testId="usage-trend-full-width"
    >
      <div
        className="h-[280px] w-full min-w-0 sm:h-[300px]"
        aria-label={
          viewMode === 'trend' ? 'AI credits usage trend chart' : 'AI credits usage highlights chart'
        }
        data-testid={viewMode === 'trend' ? 'usage-credits-trend-chart' : 'usage-credits-highlights-chart'}
      >
        <ResponsiveContainer width="100%" height="100%">
          {viewMode === 'trend' ? (
            <AreaChart data={chartData} margin={{ top: 12, right: 20, left: 4, bottom: 8 }}>
              <defs>
                <linearGradient id="usageCreditsTrendFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={USAGE_CHART.teal600} stopOpacity={0.24} />
                  <stop offset="100%" stopColor={USAGE_CHART.teal600} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={USAGE_CHART.grid} vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: USAGE_CHART.axis, fontSize: 11 }}
                axisLine={{ stroke: USAGE_CHART.grid }}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={32}
                dy={4}
              />
              <YAxis
                tick={{ fill: USAGE_CHART.axis, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={44}
                allowDecimals={false}
                dx={-2}
              />
              <Tooltip content={<CreditsTooltip />} />
              <Area
                type="monotone"
                dataKey="credits"
                name="Credits used"
                stroke={USAGE_CHART.teal600}
                strokeWidth={2}
                fill="url(#usageCreditsTrendFill)"
                dot={{ r: 3, fill: '#ffffff', stroke: USAGE_CHART.teal600, strokeWidth: 2 }}
                activeDot={{ r: 4, fill: '#ffffff', stroke: USAGE_CHART.teal600, strokeWidth: 2.5 }}
              />
            </AreaChart>
          ) : (
            <BarChart data={chartData} margin={{ top: 12, right: 20, left: 4, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={USAGE_CHART.grid} vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: USAGE_CHART.axis, fontSize: 11 }}
                axisLine={{ stroke: USAGE_CHART.grid }}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={32}
                dy={4}
              />
              <YAxis
                tick={{ fill: USAGE_CHART.axis, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={44}
                allowDecimals={false}
                dx={-2}
              />
              <Tooltip content={<CreditsTooltip />} cursor={{ fill: 'rgba(13, 148, 136, 0.06)' }} />
              <Bar
                dataKey="credits"
                name="Credits used"
                fill={USAGE_CHART.teal600}
                radius={[4, 4, 0, 0]}
                maxBarSize={48}
              />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
      {/* TODO: Replace estimated trend with daily ledger endpoint when available. */}
    </UsageSectionCard>
  );
}
