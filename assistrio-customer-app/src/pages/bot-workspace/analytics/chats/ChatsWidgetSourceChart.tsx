import { useMemo } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { CustomerChatsAnalyticsStartedFromBreakdownItem } from '@/api/types';
import { formatAnalyticsInteger, formatAnalyticsChatsCountWithUnit } from '@/lib/analyticsFormat';
import { AnalyticsChartEmpty } from '@/pages/bot-workspace/analytics/shared/AnalyticsChartEmpty';
import { cn } from '@/lib/utils';
import {
  hasWidgetSourceSignal,
  normalizeWidgetSourceRows,
  sortWidgetSourceRows,
} from './chatsWidgetSource.util';

const DONUT_ANIM_MS = 500;

/** Teal-forward palette + slate for unknown. */
const SLICE_COLORS = ['#0d9488', '#14b8a6', '#2dd4bf', '#5eead4', '#94a3b8'] as const;

type PieSlice = { id: string; name: string; value: number; color: string };

type Props = { rows: CustomerChatsAnalyticsStartedFromBreakdownItem[] };

export function ChatsWidgetSourceChart({ rows }: Props) {
  const sortedRows = useMemo(
    () => sortWidgetSourceRows(normalizeWidgetSourceRows(rows)),
    [rows],
  );

  const listRows = useMemo(() => sortedRows.filter((r) => r.conversations > 0), [sortedRows]);

  const { pieData, centerTotal } = useMemo(() => {
    const slices: PieSlice[] = listRows.map((r, i) => ({
      id: r.key,
      name: r.friendlyLabel,
      value: r.conversations,
      color: r.key === 'unknown' ? '#94a3b8' : SLICE_COLORS[i % SLICE_COLORS.length],
    }));
    const total = slices.reduce((a, s) => a + s.value, 0);
    return { pieData: slices, centerTotal: total };
  }, [listRows]);

  const hasData = hasWidgetSourceSignal(rows);
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
                  return (
                    <div className="rounded-lg border border-slate-200/90 bg-white/95 px-3 py-2 text-xs shadow-md">
                      <div className="font-semibold text-slate-800">{slice.name}</div>
                      <div className="mt-1 text-slate-600">
                        {formatAnalyticsChatsCountWithUnit(row.conversations)} ·{' '}
                        {formatAnalyticsInteger(row.messages)} messages
                      </div>
                    </div>
                  );
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/80 text-xs text-slate-500">
            No conversation volume by source
          </div>
        )}
        {pieData.length > 0 ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-2 text-center">
            <span className="text-xl font-semibold leading-tight text-slate-800">
              {formatAnalyticsChatsCountWithUnit(centerTotal)}
            </span>
          </div>
        ) : null}
      </div>

      <div className="flex min-h-0 min-w-0 flex-[1_1_55%] flex-col justify-center">
        <ul className="m-0 flex min-w-0 list-none flex-col gap-0 divide-y divide-slate-100 p-0">
          {listRows.map((row) => {
            const unknown = row.key === 'unknown';
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
                    {row.friendlyLabel}
                  </span>
                  <div className={cn('text-xs leading-snug', unknown ? 'text-slate-400' : 'text-slate-500')}>
                    {formatAnalyticsInteger(row.messages)} messages
                  </div>
                </div>
                <span
                  className={cn(
                    'inline-flex min-w-0 shrink-0 items-center text-sm font-semibold leading-none',
                    unknown ? 'text-slate-400' : 'text-teal-800',
                  )}
                >
                  {formatAnalyticsChatsCountWithUnit(row.conversations)}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
