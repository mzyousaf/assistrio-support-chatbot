import { useMemo, useState } from 'react';
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { WorkspaceUsageAnalyticsTrendDay } from '@/api/types';
import { Tooltip } from '@/components/ui';
import { cn } from '@/lib/utils';
import { formatUsagePeriodDate } from '@/pages/usage/usagePageFormat';
import { UsageChartViewToggle, type UsageChartViewMode } from '@/pages/usage/UsageChartViewToggle';
import { UsageSectionCard } from '@/pages/usage/UsageSectionCard';
import { USAGE_CHART, USAGE_CHART_UI_TOOLTIP_PANEL } from '@/pages/usage/usageChartTheme';

export type UsageTrendChartPoint = {
  date: string;
  label: string;
  totalCreditsUsed: number;
  monthlyCreditsUsed: number;
  topUpCreditsUsed: number;
};

type SeriesKey = 'totalCreditsUsed' | 'monthlyCreditsUsed' | 'topUpCreditsUsed';

type SeriesConfig = {
  key: SeriesKey;
  label: string;
  color: string;
  marker: 'area' | 'line' | 'stack';
};

const TREND_SERIES: SeriesConfig[] = [
  { key: 'totalCreditsUsed', label: 'Total credits', color: USAGE_CHART.teal600, marker: 'area' },
  { key: 'monthlyCreditsUsed', label: 'Monthly credits', color: '#0284c7', marker: 'line' },
  { key: 'topUpCreditsUsed', label: 'Top-up credits', color: '#7c3aed', marker: 'line' },
];

const HEIGHTS_SERIES: SeriesConfig[] = [
  { key: 'totalCreditsUsed', label: 'Total credits', color: USAGE_CHART.teal600, marker: 'area' },
  { key: 'monthlyCreditsUsed', label: 'Monthly credits', color: '#0284c7', marker: 'stack' },
  { key: 'topUpCreditsUsed', label: 'Top-up credits', color: '#7c3aed', marker: 'stack' },
];

const DEFAULT_SERIES_VISIBLE: Record<SeriesKey, boolean> = {
  totalCreditsUsed: true,
  monthlyCreditsUsed: true,
  topUpCreditsUsed: true,
};

const SERIES_HELP: Record<SeriesKey, string> = {
  totalCreditsUsed: 'All AI credits used each day (monthly + top-up combined).',
  monthlyCreditsUsed: 'Credits used from your plan’s included monthly pool.',
  topUpCreditsUsed: 'Credits used from purchased top-up balance after monthly credits run out.',
};

type Props = {
  trend: WorkspaceUsageAnalyticsTrendDay[] | null | undefined;
  loading?: boolean;
  errorMessage?: string | null;
  onRetry?: () => void;
  className?: string;
};

function formatTrendDayLabel(dateYmd: string): string {
  const d = new Date(`${dateYmd}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return dateYmd;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function mapUsageTrendToChartPoints(
  trend: WorkspaceUsageAnalyticsTrendDay[] | null | undefined,
): UsageTrendChartPoint[] {
  return (trend ?? []).map((row) => ({
    date: row.date,
    label: formatTrendDayLabel(row.date),
    totalCreditsUsed: row.totalCreditsUsed,
    monthlyCreditsUsed: row.monthlyCreditsUsed,
    topUpCreditsUsed: row.topUpCreditsUsed,
  }));
}

function hasUsageTrendData(points: UsageTrendChartPoint[]): boolean {
  return points.some(
    (row) => row.totalCreditsUsed > 0 || row.monthlyCreditsUsed > 0 || row.topUpCreditsUsed > 0,
  );
}

export function chartTitleForViewMode(viewMode: UsageChartViewMode): string {
  return viewMode === 'trend' ? 'AI Credits Usage Trends' : 'AI Credits Usage Heights';
}

function UsageCreditsSeriesLegend({
  items,
  visibility,
  onToggle,
}: {
  items: SeriesConfig[];
  visibility: Record<SeriesKey, boolean>;
  onToggle: (key: SeriesKey) => void;
}) {
  return (
    <div
      className="mb-3 flex flex-wrap items-center gap-2"
      role="group"
      aria-label="Toggle chart series"
      data-testid="usage-credits-series-legend"
    >
      {items.map((item) => {
        const active = visibility[item.key];
        return (
          <Tooltip key={item.key} content={SERIES_HELP[item.key]} side="bottom">
            <button
              type="button"
              aria-pressed={active}
              aria-label={`${active ? 'Hide' : 'Show'} ${item.label}`}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                active
                  ? 'border-slate-200/90 bg-white text-slate-700 shadow-sm'
                  : 'border-slate-100 bg-slate-50 text-slate-400 line-through',
              )}
              onClick={() => onToggle(item.key)}
            >
              <span className="flex items-center justify-center" aria-hidden>
                {item.marker === 'area' ? (
                  <span
                    className="h-2 w-2 rounded-full border border-white ring-1 ring-slate-200/80"
                    style={{ backgroundColor: active ? item.color : '#cbd5e1' }}
                  />
                ) : item.marker === 'stack' ? (
                  <span
                    className="h-2.5 w-2.5 rounded-sm"
                    style={{ backgroundColor: active ? item.color : '#cbd5e1' }}
                  />
                ) : (
                  <span className="relative flex h-2 w-3.5 items-center">
                    <span
                      className="h-0.5 w-full rounded-full"
                      style={{ backgroundColor: active ? item.color : '#cbd5e1' }}
                    />
                    <span
                      className="absolute left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full border border-white"
                      style={{ backgroundColor: active ? item.color : '#cbd5e1' }}
                    />
                  </span>
                )}
              </span>
              {item.label}
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
}

function TrendTooltip({
  active,
  payload,
  label,
  visibleKeys,
}: {
  active?: boolean;
  payload?: readonly {
    dataKey?: string;
    value?: number;
    color?: string;
    name?: string;
  }[];
  label?: string;
  visibleKeys: Set<SeriesKey>;
}) {
  if (!active || !payload?.length) return null;
  const byKey = new Map(payload.map((entry) => [String(entry.dataKey ?? ''), entry]));

  const rows: Array<{ label: string; value: number }> = [];
  if (visibleKeys.has('totalCreditsUsed')) {
    rows.push({ label: 'Total', value: Number(byKey.get('totalCreditsUsed')?.value ?? 0) });
  }
  if (visibleKeys.has('monthlyCreditsUsed')) {
    rows.push({ label: 'Monthly', value: Number(byKey.get('monthlyCreditsUsed')?.value ?? 0) });
  }
  if (visibleKeys.has('topUpCreditsUsed')) {
    rows.push({ label: 'Top-up', value: Number(byKey.get('topUpCreditsUsed')?.value ?? 0) });
  }

  if (rows.length === 0) return null;

  return (
    <div className={USAGE_CHART_UI_TOOLTIP_PANEL}>
      <p className="m-0 font-semibold text-slate-50">{label}</p>
      {rows.map((row) => (
        <p key={row.label} className="m-0 tabular-nums text-slate-200">
          {row.label}: {row.value.toLocaleString()}
        </p>
      ))}
    </div>
  );
}

function HeightsTooltip({
  active,
  payload,
  label,
  visibleKeys,
}: {
  active?: boolean;
  payload?: readonly { dataKey?: string; value?: number; name?: string }[];
  label?: string;
  visibleKeys: Set<SeriesKey>;
}) {
  if (!active || !payload?.length) return null;
  const byKey = new Map(payload.map((entry) => [String(entry.dataKey ?? ''), entry]));
  const monthly = visibleKeys.has('monthlyCreditsUsed')
    ? Number(byKey.get('monthlyCreditsUsed')?.value ?? 0)
    : 0;
  const topUp = visibleKeys.has('topUpCreditsUsed')
    ? Number(byKey.get('topUpCreditsUsed')?.value ?? 0)
    : 0;
  const total = visibleKeys.has('totalCreditsUsed')
    ? Number(byKey.get('totalCreditsUsed')?.value ?? 0)
    : monthly + topUp;

  const rows: Array<{ label: string; value: number }> = [];
  if (visibleKeys.has('totalCreditsUsed')) {
    rows.push({ label: 'Total', value: total });
  }
  if (visibleKeys.has('monthlyCreditsUsed')) {
    rows.push({ label: 'Monthly', value: monthly });
  }
  if (visibleKeys.has('topUpCreditsUsed')) {
    rows.push({ label: 'Top-up', value: topUp });
  }

  if (rows.length === 0) return null;

  return (
    <div className={USAGE_CHART_UI_TOOLTIP_PANEL}>
      <p className="m-0 font-semibold text-slate-50">{label}</p>
      {rows.map((row) => (
        <p key={row.label} className="m-0 tabular-nums text-slate-200">
          {row.label}: {row.value.toLocaleString()}
        </p>
      ))}
    </div>
  );
}

export function UsageCreditsTrendChart({
  trend,
  loading = false,
  errorMessage = null,
  onRetry,
  className,
}: Props) {
  const [viewMode, setViewMode] = useState<UsageChartViewMode>('trend');
  const [seriesVisible, setSeriesVisible] = useState(DEFAULT_SERIES_VISIBLE);

  const chartData = useMemo(() => mapUsageTrendToChartPoints(trend), [trend]);
  const isEmpty = !loading && !errorMessage && !hasUsageTrendData(chartData);
  const dateRangeLabel =
    trend && trend.length >= 2
      ? `${formatUsagePeriodDate(`${trend[0]?.date}T00:00:00.000Z`)} – ${formatUsagePeriodDate(`${trend[trend.length - 1]?.date}T00:00:00.000Z`)}`
      : 'Daily AI credit usage from workspace ledger.';

  const legendItems = viewMode === 'trend' ? TREND_SERIES : HEIGHTS_SERIES;
  const visibleKeys = useMemo(
    () =>
      new Set(
        (Object.keys(seriesVisible) as SeriesKey[]).filter((key) => seriesVisible[key]),
      ),
    [seriesVisible],
  );

  function toggleSeries(key: SeriesKey) {
    setSeriesVisible((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const lineDot = (color: string) => ({
    r: 3,
    fill: '#ffffff',
    stroke: color,
    strokeWidth: 2,
  });

  return (
    <UsageSectionCard
      id="usage-credits-trend"
      className={className}
      title={chartTitleForViewMode(viewMode)}
      description={
        errorMessage
          ? 'Could not load AI credits usage.'
          : loading
            ? 'Loading daily usage…'
            : isEmpty
              ? 'No AI credit usage in this date range.'
              : viewMode === 'trend'
                ? `Daily totals and credit pools · ${dateRangeLabel}`
                : `Stacked daily credit pools · ${dateRangeLabel}`
      }
      headerAction={<UsageChartViewToggle value={viewMode} onChange={setViewMode} />}
      bodyClassName="flex flex-col"
      testId="usage-trend-full-width"
    >
      {loading ? (
        <div
          className="h-[280px] w-full animate-pulse rounded-lg bg-slate-100/80 sm:h-[300px]"
          aria-hidden
          data-testid="usage-trend-skeleton"
        />
      ) : errorMessage ? (
        <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-amber-200 bg-amber-50/60 px-4 py-8 text-center">
          <p className="m-0 text-sm text-amber-900">{errorMessage}</p>
          {onRetry ? (
            <button
              type="button"
              className="rounded-md border border-amber-300 bg-white px-3 py-1.5 text-sm font-medium text-amber-950 hover:bg-amber-50"
              onClick={onRetry}
            >
              Retry
            </button>
          ) : null}
        </div>
      ) : isEmpty ? (
        <p className="m-0 flex min-h-[220px] items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/60 px-4 py-8 text-center text-sm text-slate-500">
          No AI credit usage in this date range.
        </p>
      ) : (
        <>
          <UsageCreditsSeriesLegend
            items={legendItems}
            visibility={seriesVisible}
            onToggle={toggleSeries}
          />
          <div
            className="h-[280px] w-full min-w-0 sm:h-[300px]"
            aria-label={chartTitleForViewMode(viewMode)}
            data-testid={viewMode === 'trend' ? 'usage-credits-trend-chart' : 'usage-credits-heights-chart'}
          >
            <ResponsiveContainer width="100%" height="100%">
              {viewMode === 'trend' ? (
                <ComposedChart data={chartData} margin={{ top: 12, right: 20, left: 4, bottom: 8 }}>
                  <defs>
                    <linearGradient id="usageCreditsTotalFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={USAGE_CHART.teal600} stopOpacity={0.22} />
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
                  <RechartsTooltip content={<TrendTooltip visibleKeys={visibleKeys} />} />
                  {seriesVisible.totalCreditsUsed ? (
                    <Area
                      type="monotone"
                      dataKey="totalCreditsUsed"
                      name="Total credits"
                      stroke={USAGE_CHART.teal600}
                      strokeWidth={2}
                      fill="url(#usageCreditsTotalFill)"
                      dot={lineDot(USAGE_CHART.teal600)}
                      activeDot={{ r: 4, fill: '#ffffff', stroke: USAGE_CHART.teal600, strokeWidth: 2.5 }}
                    />
                  ) : null}
                  {seriesVisible.monthlyCreditsUsed ? (
                    <Line
                      type="monotone"
                      dataKey="monthlyCreditsUsed"
                      name="Monthly credits"
                      stroke="#0284c7"
                      strokeWidth={2}
                      dot={lineDot('#0284c7')}
                      activeDot={{ r: 4, fill: '#ffffff', stroke: '#0284c7', strokeWidth: 2 }}
                    />
                  ) : null}
                  {seriesVisible.topUpCreditsUsed ? (
                    <Line
                      type="monotone"
                      dataKey="topUpCreditsUsed"
                      name="Top-up credits"
                      stroke="#7c3aed"
                      strokeWidth={2}
                      dot={lineDot('#7c3aed')}
                      activeDot={{ r: 4, fill: '#ffffff', stroke: '#7c3aed', strokeWidth: 2 }}
                    />
                  ) : null}
                </ComposedChart>
              ) : (
                <ComposedChart data={chartData} margin={{ top: 12, right: 20, left: 4, bottom: 8 }}>
                  <defs>
                    <linearGradient id="usageCreditsHeightsTotalFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={USAGE_CHART.teal600} stopOpacity={0.2} />
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
                  <RechartsTooltip content={<HeightsTooltip visibleKeys={visibleKeys} />} cursor={{ fill: 'rgba(13, 148, 136, 0.06)' }} />
                  {seriesVisible.totalCreditsUsed ? (
                    <Area
                      type="monotone"
                      dataKey="totalCreditsUsed"
                      name="Total credits"
                      stroke={USAGE_CHART.teal600}
                      strokeWidth={2}
                      fill="url(#usageCreditsHeightsTotalFill)"
                      dot={lineDot(USAGE_CHART.teal600)}
                      activeDot={{ r: 4, fill: '#ffffff', stroke: USAGE_CHART.teal600, strokeWidth: 2.5 }}
                    />
                  ) : null}
                  {seriesVisible.monthlyCreditsUsed ? (
                    <Bar
                      dataKey="monthlyCreditsUsed"
                      name="Monthly credits"
                      stackId="credits"
                      fill="#0284c7"
                      radius={[0, 0, 0, 0]}
                      maxBarSize={48}
                    />
                  ) : null}
                  {seriesVisible.topUpCreditsUsed ? (
                    <Bar
                      dataKey="topUpCreditsUsed"
                      name="Top-up credits"
                      stackId="credits"
                      fill="#7c3aed"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={48}
                    />
                  ) : null}
                </ComposedChart>
              )}
            </ResponsiveContainer>
          </div>
        </>
      )}
    </UsageSectionCard>
  );
}
