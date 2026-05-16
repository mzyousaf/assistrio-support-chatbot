import { useMemo } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { CustomerLeadsStartedFromBreakdownItem } from '@/api/types';
import { formatAnalyticsInteger, formatAnalyticsRatioAsPercent } from '@/lib/analyticsFormat';
import { AnalyticsChartEmpty } from '@/pages/bot-workspace/analytics/shared/AnalyticsChartEmpty';
import { cn } from '@/lib/utils';
import { buildLeadsSourceChartRows } from './LeadsSourceChart';

const DONUT_ANIM_MS = 500;

const SLICE_COLORS = ['#0d9488', '#14b8a6', '#2dd4bf', '#5eead4', '#94a3b8'] as const;

type PieSlice = { id: string; name: string; value: number; color: string };

type Props = { rows: CustomerLeadsStartedFromBreakdownItem[] };

function hasLeadsSourceSignal(rows: CustomerLeadsStartedFromBreakdownItem[]): boolean {
  return rows.some((r) => (r.leads ?? 0) > 0 || (r.conversations ?? 0) > 0);
}

export function LeadsWidgetSourceChart({ rows }: Props) {
  const sortedRows = useMemo(() => buildLeadsSourceChartRows(rows), [rows]);
  const listRows = useMemo(() => sortedRows.filter((r) => r.leads > 0), [sortedRows]);

  const { pieData, centerTotal } = useMemo(() => {
    const positive = listRows;
    const slices: PieSlice[] = positive.map((r, i) => ({
      id: r.key,
      name: r.label,
      value: r.leads,
      color: r.key === 'unknown' ? '#94a3b8' : SLICE_COLORS[i % SLICE_COLORS.length],
    }));
    const total = slices.reduce((a, s) => a + s.value, 0);
    return { pieData: slices, centerTotal: total };
  }, [listRows]);

  const hasData = hasLeadsSourceSignal(rows);
  if (!hasData) {
    return <AnalyticsChartEmpty message="No widget channel data yet." />;
  }

  return (
    <div className="flex min-h-[340px] w-full min-w-0 flex-1 flex-row items-center gap-4 sm:gap-6">
      <div className="relative mx-auto flex h-[300px] min-h-0 w-full min-w-[9rem] max-w-[360px] flex-[1_1_45%] items-center justify-center self-center">
        {pieData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius="56%"
                outerRadius="88%"
                paddingAngle={2}
                stroke="none"
                isAnimationActive
                animationDuration={DONUT_ANIM_MS}
                animationEasing="ease-out"
              >
                {pieData.map((s) => (
                  <Cell key={s.id} fill={s.color} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.[0]) return null;
                  const slice = payload[0].payload as PieSlice;
                  const row = sortedRows.find((r) => r.key === slice.id);
                  if (!row) return null;
                  const cr =
                    row.conversionRate != null && Number.isFinite(row.conversionRate)
                      ? formatAnalyticsRatioAsPercent(row.conversionRate, 1)
                      : row.conversations > 0
                        ? formatAnalyticsRatioAsPercent(row.leads / row.conversations, 1)
                        : '—';
                  return (
                    <div className="rounded-lg border border-slate-200/90 bg-white/95 px-3 py-2 text-xs shadow-md">
                      <div className="font-semibold text-slate-800">{slice.name}</div>
                      <div className="mt-1 text-slate-600">
                        {formatAnalyticsInteger(row.leads)} leads · {formatAnalyticsInteger(row.conversations)} chats ·{' '}
                        {cr} conversion
                      </div>
                    </div>
                  );
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/80 text-xs text-slate-500">
            No lead volume by source
          </div>
        )}
        {pieData.length > 0 ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-2 text-center">
            <span className="text-xl font-semibold leading-tight text-slate-800">
              {formatAnalyticsInteger(centerTotal)} leads
            </span>
          </div>
        ) : null}
      </div>

      <div className="flex min-h-0 min-w-0 flex-[1_1_55%] flex-col justify-center">
        <ul className="m-0 flex min-w-0 list-none flex-col gap-0 divide-y divide-slate-100 p-0">
          {listRows.map((row) => {
            const unknown = row.key === 'unknown';
            const cr =
              row.conversionRate != null && Number.isFinite(row.conversionRate)
                ? formatAnalyticsRatioAsPercent(row.conversionRate, 1)
                : row.conversations > 0
                  ? formatAnalyticsRatioAsPercent(row.leads / row.conversations, 1)
                  : '—';
            return (
              <li
                key={row.key}
                className="flex min-h-[3.25rem] items-center justify-between gap-3 rounded-md px-3.5 py-1 transition-colors hover:bg-slate-50/90 sm:min-h-[3.5rem] sm:py-1.5"
              >
                <div className="flex min-h-0 min-w-0 flex-1 flex-col justify-center gap-0.5">
                  <span
                    className={cn(
                      'block min-w-0 text-sm font-medium leading-snug',
                      unknown ? 'text-slate-400' : 'text-slate-800',
                    )}
                  >
                    {row.label}
                  </span>
                  <div className={cn('text-xs leading-snug', unknown ? 'text-slate-400' : 'text-slate-500')}>
                    {formatAnalyticsInteger(row.conversations)} chats · {cr} conversion
                  </div>
                </div>
                <span
                  className={cn(
                    'inline-flex min-w-0 shrink-0 items-center text-sm font-semibold leading-none',
                    unknown ? 'text-slate-400' : 'text-teal-800',
                  )}
                >
                  {formatAnalyticsInteger(row.leads)} leads
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
