import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { CustomerLeadsStartedFromBreakdownItem } from '@/api/types';
import { formatAnalyticsInteger, formatAnalyticsRatioAsPercent } from '@/lib/analyticsFormat';
import { CHART } from '../shared/analyticsChartTheme';
import { AnalyticsChartEmpty } from '../shared/AnalyticsChartEmpty';
import { normalizeLeadsStartedFromBreakdown, type NormalizedLeadSourceRow } from './leadsAnalyticsDisplay';

/** Active sources sorted by leads — used by chart and tests (Recharts SSR omits SVG text). */
export function buildLeadsSourceChartRows(rows: CustomerLeadsStartedFromBreakdownItem[]): NormalizedLeadSourceRow[] {
  const normalized = normalizeLeadsStartedFromBreakdown(rows);
  const active = normalized.filter((r) => r.leads > 0 || r.conversations > 0);
  return [...active].sort((a, b) => b.leads - a.leads || a.label.localeCompare(b.label));
}

type Props = { rows: CustomerLeadsStartedFromBreakdownItem[] };

function SourceTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: readonly { payload: NormalizedLeadSourceRow }[];
}) {
  if (!active || !payload?.[0]) return null;
  const row = payload[0].payload;
  const cr =
    row.conversionRate != null && Number.isFinite(row.conversionRate)
      ? formatAnalyticsRatioAsPercent(row.conversionRate, 1)
      : row.conversations > 0
        ? formatAnalyticsRatioAsPercent(row.leads / row.conversations, 1)
        : '—';
  return (
    <div className="rounded-lg border border-slate-200/90 bg-white/95 px-3 py-2.5 text-xs shadow-lg backdrop-blur-[2px]">
      <p className="m-0 mb-1 font-semibold text-slate-800">{row.label}</p>
      <ul className="m-0 list-none space-y-1 p-0 tabular-nums text-slate-600">
        <li className="flex justify-between gap-6">
          <span>Leads captured</span>
          <span className="font-medium text-slate-800">{formatAnalyticsInteger(row.leads)}</span>
        </li>
        <li className="flex justify-between gap-6">
          <span>Conversations</span>
          <span className="font-medium text-slate-800">{formatAnalyticsInteger(row.conversations)}</span>
        </li>
        <li className="flex justify-between gap-6 text-slate-500">
          <span>Conversion</span>
          <span>{cr}</span>
        </li>
      </ul>
    </div>
  );
}

export function LeadsSourceChart({ rows }: Props) {
  const chartRows = useMemo(() => buildLeadsSourceChartRows(rows), [rows]);

  if (!chartRows.length) {
    return <AnalyticsChartEmpty message="No source activity for this range." className="h-full min-h-[14rem] w-full flex-1" />;
  }

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col">
      <div className="min-h-[14rem] w-full flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            layout="vertical"
            data={chartRows}
            margin={{ top: 8, right: 12, left: 4, bottom: 8 }}
            barCategoryGap="18%"
          >
            <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} horizontal={false} />
            <XAxis
              type="number"
              tick={{ fontSize: 11, fill: CHART.axis }}
              tickFormatter={(v) => formatAnalyticsInteger(Number(v))}
              axisLine={{ stroke: CHART.grid }}
            />
            <YAxis
              type="category"
              dataKey="label"
              width={118}
              tick={{ fontSize: 11, fill: CHART.axis }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<SourceTooltip />} cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }} />
            <Bar dataKey="leads" name="Leads captured" fill={CHART.teal600} radius={[0, 4, 4, 0]} animationDuration={520} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
