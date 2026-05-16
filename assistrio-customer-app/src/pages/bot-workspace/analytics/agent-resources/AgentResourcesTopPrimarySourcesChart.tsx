import { useMemo } from 'react';
import { ExternalLink } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { CustomerAgentResourcesTopPrimarySourceItem } from '@/api/types';
import { formatAnalyticsInteger, formatAnalyticsNumber } from '@/lib/analyticsFormat';
import { AnalyticsChartEmpty } from '@/pages/bot-workspace/analytics/shared/AnalyticsChartEmpty';
import { CHART } from '@/pages/bot-workspace/analytics/shared/analyticsChartTheme';

const DISPLAY_LIMIT = 12;

export type TopPrimarySourcesChartRow = {
  rowKey: string;
  /** Y-axis: rank + truncated {@link CustomerAgentResourcesTopPrimarySourceItem sourceTitle} (display name). */
  shortLabel: string;
  title: string;
  rank: number;
  primaryUses: number;
  assistantMessages: number;
  sourceType: string;
  typeLabel: string;
  averageScore: number | null;
  lastUsedAt: string | null;
  openHref: string | null;
};

function formatPrettyType(sourceType: string): string {
  return String(sourceType ?? 'unknown')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatSourceTypeLabel(sourceType: string): string {
  if (sourceType === 'note') return 'Snippets';
  return formatPrettyType(sourceType);
}

function dateShort(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function truncateForAxis(raw: string, maxLen: number): string {
  const s = raw.trim();
  if (s.length <= maxLen) return s;
  const edge = Math.max(4, Math.floor((maxLen - 3) / 2));
  return `${s.slice(0, edge)}…${s.slice(-edge)}`;
}

const FALLBACK_TITLE = 'Q&A Snippets';

/** Display title: API `sourceTitle` when set; otherwise {@link FALLBACK_TITLE}. */
export function topPrimarySourceDisplayTitle(r: CustomerAgentResourcesTopPrimarySourceItem): string {
  const t = r.sourceTitle?.trim();
  return t?.length ? t : FALLBACK_TITLE;
}

export function buildTopPrimarySourcesChartRows(
  rows: CustomerAgentResourcesTopPrimarySourceItem[],
): TopPrimarySourcesChartRow[] {
  const ranked = [...rows]
    .sort((a, b) => Math.trunc(b.primarySourceUses ?? 0) - Math.trunc(a.primarySourceUses ?? 0))
    .slice(0, DISPLAY_LIMIT);

  return ranked.map((r, idx) => {
    const title = topPrimarySourceDisplayTitle(r);
    const typeKey = String(r.sourceType ?? 'unknown');
    const typeLabel = formatSourceTypeLabel(typeKey);
    const rank = idx + 1;
    const shortLabel = `${rank}. ${truncateForAxis(title, 44)}`;
    const uses = Math.trunc(r.primarySourceUses ?? 0);
    const id = String(r.knowledgeBaseItemId ?? '');
    const rowKey = id || `${idx}-${title.slice(0, 48)}`;
    const openHref =
      typeof r.sourceUrl === 'string' && /^https?:\/\//i.test(r.sourceUrl) ? r.sourceUrl : null;

    return {
      rowKey,
      shortLabel,
      title,
      rank,
      primaryUses: uses,
      assistantMessages: Math.trunc(r.assistantMessages ?? 0),
      sourceType: typeKey,
      typeLabel,
      averageScore: typeof r.averageScore === 'number' && Number.isFinite(r.averageScore) ? r.averageScore : null,
      lastUsedAt: r.lastUsedAt ?? null,
      openHref,
    };
  });
}

type Props = { rows: CustomerAgentResourcesTopPrimarySourceItem[] };

function TopPrimaryTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: readonly { payload: TopPrimarySourcesChartRow }[];
}) {
  if (!active || !payload?.[0]) return null;
  const row = payload[0].payload;
  const avgStr =
    row.averageScore != null ? formatAnalyticsNumber(row.averageScore, { maximumFractionDigits: 3 }) : '—';

  return (
    <div className="max-w-xs rounded-lg border border-slate-200/90 bg-white/95 px-3 py-2.5 text-xs shadow-lg backdrop-blur-[2px]">
      <p className="m-0 mb-1 font-semibold leading-snug text-slate-900">{row.title}</p>
      <p className="m-0 mb-2 text-[11px] font-medium leading-snug text-slate-500">{row.typeLabel}</p>
      <ul className="m-0 mt-2 list-none space-y-1 p-0 tabular-nums text-slate-600">
        <li className="flex justify-between gap-6">
          <span>Primary uses</span>
          <span className="font-semibold text-slate-800">{formatAnalyticsInteger(row.primaryUses)}</span>
        </li>
        <li className="flex justify-between gap-6">
          <span>Messages</span>
          <span className="font-semibold text-slate-800">{formatAnalyticsInteger(row.assistantMessages)}</span>
        </li>
        <li className="flex justify-between gap-6">
          <span>Avg score</span>
          <span className="font-semibold text-slate-800">{avgStr}</span>
        </li>
        <li className="flex justify-between gap-6">
          <span>Last used</span>
          <span className="font-semibold text-slate-800">{dateShort(row.lastUsedAt)}</span>
        </li>
      </ul>
      {row.openHref ? (
        <a
          href={row.openHref}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1 font-semibold text-teal-700 underline-offset-4 hover:text-teal-900 hover:underline"
        >
          <ExternalLink className="size-3.5 shrink-0 opacity-85" aria-hidden />
          View source
        </a>
      ) : null}
    </div>
  );
}

export function AgentResourcesTopPrimarySourcesChart({ rows }: Props) {
  const chartRows = useMemo(() => buildTopPrimarySourcesChartRows(rows), [rows]);
  /** Rank #1 = largest `primaryUses` is last in array so it renders at the top (Recharts stacks first row at bottom for `layout="vertical"`). */
  const chartData = useMemo(() => [...chartRows].reverse(), [chartRows]);

  const yAxisWidth = useMemo(() => {
    const maxLen = chartData.reduce((m, r) => Math.max(m, r.shortLabel.length), 0);
    return Math.min(300, Math.max(100, 6 * maxLen + 14));
  }, [chartData]);

  const chartMinHeight = useMemo(() => Math.max(220, chartData.length * 28 + 56), [chartData.length]);

  if (!chartRows.some((r) => r.primaryUses > 0)) {
    return (
      <div className="flex min-h-[12rem] w-full items-center justify-center px-4 py-10">
        <AnalyticsChartEmpty message="No primary sources in this range yet. Top knowledge items appear once answers cite sources." />
      </div>
    );
  }

  return (
    <div className="w-full" data-testid="agent-resources-top-primary-chart">
      {/* ResponsiveContainer needs a definite parent height; min-height alone collapses the chart. */}
      <div className="w-full min-w-0 shrink-0" style={{ height: chartMinHeight, minHeight: chartMinHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            layout="vertical"
            data={chartData}
            margin={{ top: 4, right: 8, left: 0, bottom: 4 }}
            barCategoryGap="10%"
          >
            <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} horizontal={false} />
            <XAxis
              type="number"
              tick={{ fontSize: 10, fill: CHART.axis }}
              tickFormatter={(v) => formatAnalyticsInteger(Number(v))}
              axisLine={{ stroke: CHART.grid }}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="shortLabel"
              width={yAxisWidth}
              reversed
              tick={{ fontSize: 10, fill: CHART.axis }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<TopPrimaryTooltip />} cursor={{ fill: 'rgba(148, 163, 184, 0.1)' }} />
            <Bar
              dataKey="primaryUses"
              name="Primary uses"
              fill={CHART.teal600}
              radius={[0, 4, 4, 0]}
              maxBarSize={14}
              isAnimationActive
              animationDuration={520}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
