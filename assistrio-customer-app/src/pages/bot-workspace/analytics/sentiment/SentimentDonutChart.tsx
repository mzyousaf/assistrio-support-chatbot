import { useMemo } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { formatAnalyticsInteger } from '@/lib/analyticsFormat';
import { AnalyticsChartEmpty } from '../shared/AnalyticsChartEmpty';
import { colorForSentimentSeries, type SentimentRankingRow } from './sentimentTrendsChartHelpers';

const DONUT_ANIM_MS = 560;

type PieRow = { id: string; name: string; value: number; color: string };

type Props = {
  rankingRows: SentimentRankingRow[];
  /** Tooltip count wording. */
  countUnit?: 'messages' | 'chats';
};

export function SentimentDonutChart({ rankingRows, countUnit = 'messages' }: Props) {
  const { pieData, centerTotal } = useMemo(() => {
    const sliceRows = rankingRows.filter((r) => r.count > 0);
    const data: PieRow[] = sliceRows.map((r) => ({
      id: r.id,
      name: r.label,
      value: r.count,
      color: colorForSentimentSeries(r.id),
    }));
    const centerTotalLocal = data.reduce((a, b) => a + b.value, 0);
    return { pieData: data, centerTotal: centerTotalLocal };
  }, [rankingRows]);

  if (!pieData.length) {
    return (
      <AnalyticsChartEmpty message="No sentiment volume for this range." className="h-full min-h-[12rem] w-full flex-1" />
    );
  }

  return (
    <div
      className="relative flex h-full min-h-0 w-full min-w-0 max-w-full flex-1 flex-col justify-center transition-opacity duration-300 ease-out"
      key={`sentiment-donut-${pieData.map((p) => p.id).join(',')}`}
    >
      <div className="mx-auto h-full min-h-[12rem] w-full max-w-md flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={pieData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius="58%"
              outerRadius="78%"
              paddingAngle={1.5}
              stroke="none"
              label={false}
              labelLine={false}
              isAnimationActive
              animationDuration={DONUT_ANIM_MS}
              animationEasing="ease-out"
            >
              {pieData.map((entry) => (
                <Cell key={entry.id} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.[0]) return null;
                const row = payload[0].payload as PieRow;
                const r = rankingRows.find((x) => x.id === row.id);
                if (!r) return null;
                const pctParen =
                  r.pctOfTotal != null && Number.isFinite(r.pctOfTotal)
                    ? ` (${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(r.pctOfTotal)}%)`
                    : '';
                const n = formatAnalyticsInteger(r.count);
                const phrase =
                  countUnit === 'chats'
                    ? `${n} distinct chats${pctParen}`
                    : `${n} user messages${pctParen}`;
                return (
                  <div className="rounded-lg border border-slate-200/90 bg-white/95 px-3 py-2.5 text-xs shadow-lg backdrop-blur-[2px]">
                    <p className="m-0 mb-1 font-semibold text-slate-800">{r.label}</p>
                    <p className="m-0 tabular-nums text-slate-600">{phrase}</p>
                  </div>
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <p className="m-0 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Total</p>
        <p className="m-0 mt-0.5 text-xl font-semibold tabular-nums tracking-tight text-slate-900">
          {formatAnalyticsInteger(centerTotal)}
        </p>
      </div>
    </div>
  );
}
