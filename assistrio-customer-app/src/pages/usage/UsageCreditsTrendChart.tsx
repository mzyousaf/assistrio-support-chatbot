import { useMemo } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import { SettingsInfoCard } from '@/components/settings/SettingsInfoCard';
import {
  buildAiCreditsTrendPoints,
  type AiCreditsTrendPoint,
} from '@/pages/usage/usagePageFormat';

type Props = {
  periodStart: string | null | undefined;
  periodEnd: string | null | undefined;
  monthlyCreditsUsed: number;
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
    <div className="rounded-lg border border-slate-200/90 bg-white/95 px-3 py-2 text-xs shadow-lg">
      <p className="m-0 font-semibold text-slate-700">{label}</p>
      <p className="m-0 mt-1 tabular-nums text-slate-600">{credits.toLocaleString()} credits</p>
    </div>
  );
}

export function UsageCreditsTrendChart({ periodStart, periodEnd, monthlyCreditsUsed }: Props) {
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
    <SettingsInfoCard
      id="usage-credits-trend"
      icon={TrendingUp}
      title="Usage trend"
      description="Estimated from current billing-period usage."
    >
      <div className="h-52 w-full min-w-0" aria-label="AI credits usage trend chart">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="usageCreditsTrendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0d9488" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#0d9488" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: '#64748b', fontSize: 11 }}
              axisLine={{ stroke: '#e2e8f0' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: '#64748b', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={40}
              allowDecimals={false}
            />
            <Tooltip content={<CreditsTooltip />} />
            <Area
              type="monotone"
              dataKey="credits"
              name="Credits used"
              stroke="#0d9488"
              strokeWidth={2}
              fill="url(#usageCreditsTrendFill)"
              dot={{ r: 4, fill: '#ffffff', stroke: '#0d9488', strokeWidth: 2 }}
              activeDot={{ r: 5, fill: '#ffffff', stroke: '#0d9488', strokeWidth: 2.5 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      {/* TODO: Replace estimated trend with daily ledger endpoint when available. */}
    </SettingsInfoCard>
  );
}
