import { useMemo } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { formatAnalyticsInteger } from '@/lib/analyticsFormat';
import { AnalyticsChartEmpty } from '../shared/AnalyticsChartEmpty';
import {
  colorForSeriesInOrder,
  type TopicRankingRow,
  type TopicsMetricMode,
} from './topicsChartHelpers';

const DONUT_ANIM_MS = 560;

type Props = {
  rankingRows: TopicRankingRow[];
  seriesOrder: string[];
  metricMode: TopicsMetricMode;
};

type PieRow = { id: string; name: string; value: number; color: string };

export function TopicsDonutChart({ rankingRows, seriesOrder, metricMode }: Props) {
  const { pieData, centerLabel, centerTotal } = useMemo(() => {
    const sliceRows = rankingRows.filter((r) => r.count > 0);
    const data: PieRow[] = sliceRows.map((r) => ({
      id: r.id,
      name: r.label,
      value: r.count,
      color: colorForSeriesInOrder(r.id, seriesOrder),
    }));
    const totalDisplayed = data.reduce((a, b) => a + b.value, 0);
    const centerLabelLocal =
      metricMode === 'conversations' ? 'Distinct chats' : 'Total';
    return { pieData: data, centerLabel: centerLabelLocal, centerTotal: totalDisplayed };
  }, [rankingRows, seriesOrder, metricMode]);

  if (!pieData.length) {
    return <AnalyticsChartEmpty message="No topic activity for this range." className="h-full min-h-[12rem] w-full flex-1" />;
  }

  return (
    <div
      className="relative flex h-full min-h-0 w-full min-w-0 max-w-full flex-1 flex-col justify-center transition-opacity duration-300 ease-out"
      key={`donut-${metricMode}-${pieData.map((p) => p.id).join(',')}`}
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
                return (
                  <div className="rounded-lg border border-slate-200/90 bg-white/95 px-3 py-2.5 text-xs shadow-lg backdrop-blur-[2px]">
                    <p className="m-0 mb-1 font-semibold text-slate-800">{r.label}</p>
                    <p className="m-0 tabular-nums text-slate-600">
                      <span className="font-semibold text-slate-800">{n}</span>
                      {pctParen ? (
                        <span className="font-semibold text-teal-700/90">{pctParen}</span>
                      ) : null}
                    </p>
                  </div>
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center pb-2">
        <div className="text-center">
          <p className="m-0 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{centerLabel}</p>
          <p className="m-0 text-xl font-semibold tabular-nums tracking-tight text-slate-800">
            {formatAnalyticsInteger(centerTotal)}
          </p>
        </div>
      </div>
    </div>
  );
}
