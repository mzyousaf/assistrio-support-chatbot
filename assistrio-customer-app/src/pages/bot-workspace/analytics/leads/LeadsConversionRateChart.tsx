import { useMemo } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { CustomerChatsAnalyticsGranularity, CustomerLeadsTimeSeriesPoint } from '@/api/types';
import {
  formatAnalyticsDateLabel,
  formatAnalyticsInteger,
  formatAnalyticsRatioAsPercent,
} from '@/lib/analyticsFormat';
import { CHART } from '../shared/analyticsChartTheme';
import { AnalyticsChartEmpty } from '../shared/AnalyticsChartEmpty';

const CHART_ANIM_MS = 520;

export type LeadsConversionRateChartRow = {
  xLabel: string;
  conversations: number;
  leads: number;
  /** Chart Y values: percent 0–100; `null` only when conversations ≤ 0 in this bucket. */
  conversionPercent: number | null;
};

/**
 * Percent 0–100 for the conversion chart. `null` only when the bucket has no conversations.
 * Derives from `conversionRate` when present; otherwise `leads / conversations`.
 * Treats `0` and `100` as valid; does not drop ratios at the ends.
 */
export function leadsConversionPercentForChart(p: CustomerLeadsTimeSeriesPoint): number | null {
  const conv = Math.max(0, Math.trunc(p.conversations ?? 0));
  const leads = Math.max(0, Math.trunc(p.leads ?? 0));
  if (conv <= 0) return null;
  const r = p.conversionRate;
  if (r != null && Number.isFinite(r)) {
    const ratio = r > 1 ? r / 100 : r;
    return Math.min(100, Math.max(0, ratio * 100));
  }
  return Math.min(100, Math.max(0, (leads / conv) * 100));
}

export function buildLeadsConversionChartRows(
  points: CustomerLeadsTimeSeriesPoint[],
  granularity: CustomerChatsAnalyticsGranularity,
): LeadsConversionRateChartRow[] {
  return points.map((p) => ({
    xLabel: formatAnalyticsDateLabel(p.date, granularity),
    conversations: Math.max(0, Math.trunc(p.conversations ?? 0)),
    leads: Math.max(0, Math.trunc(p.leads ?? 0)),
    conversionPercent: leadsConversionPercentForChart(p),
  }));
}

type TipPayload = { payload?: LeadsConversionRateChartRow };

function ConversionTooltipBody({ label, payload }: { label: string; payload: readonly TipPayload[] }) {
  const row = payload[0]?.payload;
  if (!row) return null;
  const rateRatio =
    row.conversionPercent != null && Number.isFinite(row.conversionPercent)
      ? row.conversionPercent / 100
      : null;
  return (
    <div className="rounded-lg border border-slate-200/90 bg-white/95 px-3 py-2.5 text-xs shadow-lg backdrop-blur-[2px]">
      <ul className="m-0 list-none space-y-1 p-0">
        <li className="flex justify-between gap-6 tabular-nums text-slate-600">
          <span className="font-medium text-slate-800">Date</span>
          <span className="text-right font-medium text-slate-700">{label}</span>
        </li>
        <li className="flex justify-between gap-6 tabular-nums text-slate-600">
          <span className="font-medium text-slate-800">Conversations</span>
          <span>{formatAnalyticsInteger(row.conversations)}</span>
        </li>
        <li className="flex justify-between gap-6 tabular-nums text-slate-600">
          <span className="font-medium text-slate-800">Leads</span>
          <span>{formatAnalyticsInteger(row.leads)}</span>
        </li>
        <li className="flex justify-between gap-6 border-t border-slate-100 pt-1 tabular-nums text-slate-500">
          <span>Conversion rate</span>
          <span>{formatAnalyticsRatioAsPercent(rateRatio, 1)}</span>
        </li>
      </ul>
    </div>
  );
}

type Props = {
  points: CustomerLeadsTimeSeriesPoint[];
  granularity: CustomerChatsAnalyticsGranularity;
};

export function LeadsConversionRateChart({ points, granularity }: Props) {
  const chartData = useMemo(() => buildLeadsConversionChartRows(points, granularity), [points, granularity]);

  if (!points.length) {
    return (
      <AnalyticsChartEmpty message="No time-series data for this range." className="h-full min-h-[12rem] w-full flex-1" />
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 max-w-full flex-1 flex-col">
      <div className="min-h-[12rem] w-full min-w-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis
              dataKey="xLabel"
              tick={{ fontSize: 11, fill: '#64748b' }}
              tickMargin={8}
              interval="preserveStartEnd"
              axisLine={{ stroke: '#e2e8f0' }}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 11, fill: '#64748b' }}
              tickFormatter={(v) => `${Math.round(Number(v))}%`}
              width={44}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '4 4' }}
              content={({ active, label, payload }) => {
                if (!active || !payload?.length) return null;
                return (
                  <ConversionTooltipBody
                    label={typeof label === 'string' ? label : String(label ?? '')}
                    payload={payload as readonly TipPayload[]}
                  />
                );
              }}
            />
            <Line
              type="monotone"
              dataKey="conversionPercent"
              name="Conversion rate"
              stroke={CHART.teal600}
              strokeWidth={2.25}
              strokeLinecap="round"
              strokeLinejoin="round"
              dot={{ r: 3.5, fill: '#ffffff', stroke: CHART.teal600, strokeWidth: 2 }}
              activeDot={{ r: 5, fill: '#ffffff', stroke: CHART.teal700, strokeWidth: 2.5 }}
              connectNulls
              isAnimationActive
              animationDuration={CHART_ANIM_MS}
              animationEasing="ease-out"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
