import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { CustomerLeadsFieldCaptureItem } from '@/api/types';
import type { LeadsFieldCaptureStatusFilter } from '@/lib/leadsAnalyticsQuery';
import { formatAnalyticsInteger } from '@/lib/analyticsFormat';
import { CHART } from '../shared/analyticsChartTheme';
import { AnalyticsChartEmpty } from '../shared/AnalyticsChartEmpty';

export type LeadCaptureFieldRowStatus = 'active' | 'inactive' | 'deleted';

export type FieldCaptureChartRow = {
  label: string;
  fieldKey: string;
  type: string;
  capturedCount: number;
  fieldStatus: LeadCaptureFieldRowStatus;
};

type Props = {
  rows: CustomerLeadsFieldCaptureItem[];
  /** Scope bars by field lifecycle status; `''` keeps every status (default). */
  statusFilter?: LeadsFieldCaptureStatusFilter;
};

function truncateLabel(s: string, max = 32): string {
  const t = s.trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

export function inferLeadCaptureRowStatus(r: CustomerLeadsFieldCaptureItem): LeadCaptureFieldRowStatus {
  if (r.fieldStatus) return r.fieldStatus;
  return r.archived ? 'deleted' : 'active';
}

function barFillForStatus(st: LeadCaptureFieldRowStatus): string {
  switch (st) {
    case 'active':
      return CHART.teal600;
    case 'inactive':
      return '#d97706';
    default:
      return '#e11d48';
  }
}

function statusBadgeClass(st: LeadCaptureFieldRowStatus): string {
  switch (st) {
    case 'active':
      return 'bg-teal-50 text-teal-900 ring-teal-200/80';
    case 'inactive':
      return 'bg-amber-50 text-amber-950 ring-amber-200/85';
    default:
      return 'bg-rose-50 text-rose-950 ring-rose-200/85';
  }
}

function statusUiLabel(st: LeadCaptureFieldRowStatus): string {
  switch (st) {
    case 'active':
      return 'Active';
    case 'inactive':
      return 'Inactive';
    default:
      return 'Deleted';
  }
}

/** Sorted descending by captures — used by chart and tests (Recharts SSR omits SVG text). */
export function buildFieldCaptureChartRows(
  rows: CustomerLeadsFieldCaptureItem[],
  statusFilter: LeadsFieldCaptureStatusFilter = '',
): FieldCaptureChartRow[] {
  return [...rows]
    .filter((r) => {
      if ((r.capturedCount ?? 0) <= 0) return false;
      if (!statusFilter) return true;
      return inferLeadCaptureRowStatus(r) === statusFilter;
    })
    .sort((a, b) => (b.capturedCount ?? 0) - (a.capturedCount ?? 0))
    .map((r) => {
      const fieldStatus = inferLeadCaptureRowStatus(r);
      return {
        label: truncateLabel(r.label || r.fieldKey),
        fieldKey: r.fieldKey,
        type: r.type,
        capturedCount: Math.max(0, Math.trunc(r.capturedCount ?? 0)),
        fieldStatus,
      };
    });
}

export function FieldTooltip({ active, payload }: { active?: boolean; payload?: readonly { payload: FieldCaptureChartRow }[] }) {
  if (!active || !payload?.[0]) return null;
  const row = payload[0].payload;
  const typeLabel = row.type ? row.type.replace(/_/g, ' ') : '—';
  const st = row.fieldStatus;
  const statusLabel = statusUiLabel(st);
  return (
    <div className="rounded-lg border border-slate-200/90 bg-white/95 px-3 py-2.5 text-xs shadow-lg backdrop-blur-[2px]">
      <p className="m-0 mb-1 flex flex-wrap items-center gap-2 font-semibold text-slate-800">
        <span>{row.label}</span>
        <span
          className={`rounded px-1 py-px text-[9px] font-semibold uppercase tracking-wide ring-1 ring-inset ${statusBadgeClass(st)}`}
        >
          {statusLabel}
        </span>
      </p>
      <ul className="m-0 list-none space-y-1 p-0 tabular-nums text-slate-600">
        <li className="flex justify-between gap-6">
          <span>Captures</span>
          <span className="font-medium text-slate-800">{formatAnalyticsInteger(row.capturedCount)}</span>
        </li>
        <li className="flex justify-between gap-6 text-slate-500">
          <span>Type</span>
          <span>{typeLabel}</span>
        </li>
        <li className="flex justify-between gap-6 text-slate-500">
          <span>Status</span>
          <span className="font-medium text-slate-800">{statusLabel}</span>
        </li>
      </ul>
    </div>
  );
}

/** Minimum chart height from row count when parent height is unknown (SSR, tests). */
function intrinsicFieldCaptureChartHeightPx(barCount: number): number {
  return Math.min(520, Math.max(160, 140 + barCount * 26));
}

export function LeadsFieldCaptureChart({ rows, statusFilter = '' }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [containerPx, setContainerPx] = useState(0);
  const [containerWidthPx, setContainerWidthPx] = useState(0);

  const chartRows = useMemo(() => buildFieldCaptureChartRows(rows, statusFilter), [rows, statusFilter]);

  /** Avoid a fixed wide category gutter when labels are short (Recharts default reserves heavy left space). */
  const yAxisWidthPx = useMemo(() => {
    const longest = chartRows.reduce((n, r) => Math.max(n, r.label.length), 0);
    const estimated = 8 + longest * 6.2;
    return Math.min(152, Math.max(44, Math.round(estimated)));
  }, [chartRows]);

  const intrinsicPx = intrinsicFieldCaptureChartHeightPx(chartRows.length);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      const w = Math.floor(r.width);
      const h = Math.floor(r.height);
      if (w > 8) setContainerWidthPx(w);
      if (h > 8) setContainerPx(h);
    };
    measure();
    const RO = typeof ResizeObserver !== 'undefined' ? ResizeObserver : null;
    if (!RO) return;
    const ro = new RO(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [rows, statusFilter]);

  const chartHeightPx = Math.max(containerPx > 8 ? containerPx : intrinsicPx, intrinsicPx);
  const chartWidth = containerWidthPx > 8 ? containerWidthPx : ('100%' as const);

  if (!chartRows.length) {
    return <AnalyticsChartEmpty message="No captured fields yet." />;
  }

  return (
    <div
      ref={wrapRef}
      className="box-border flex min-h-0 w-full min-w-0 max-w-full flex-1 flex-col self-stretch overflow-y-auto overflow-x-hidden"
    >
      <div className="w-full min-w-0 max-w-full shrink-0" style={{ height: chartHeightPx }}>
        <ResponsiveContainer width={chartWidth} height={chartHeightPx}>
          <BarChart
            layout="vertical"
            data={chartRows}
            margin={{ top: 8, right: 12, left: 0, bottom: 8 }}
            barCategoryGap="16%"
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
              width={yAxisWidthPx}
              tick={{ fontSize: 10, fill: CHART.axis }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<FieldTooltip />} cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }} />
            <Bar dataKey="capturedCount" name="Captures" radius={[0, 4, 4, 0]} animationDuration={520}>
              {chartRows.map((entry) => (
                <Cell key={entry.fieldKey} fill={barFillForStatus(entry.fieldStatus)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
