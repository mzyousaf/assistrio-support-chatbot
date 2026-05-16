import type { CustomerUsageTypeBreakdownItem } from '@/api/types';
import { formatAnalyticsCredits, formatAnalyticsInteger } from '@/lib/analyticsFormat';
import { AnalyticsChartCard } from '@/pages/bot-workspace/analytics/shared/AnalyticsChartCard';
import { USAGE_DASHBOARD_COPY } from './usageDashboardCopy';

type Props = {
  rows: CustomerUsageTypeBreakdownItem[];
};

export function UsageBreakdownTable({ rows }: Props) {
  const sorted = [...rows].sort((a, b) => (b.creditsUsed ?? 0) - (a.creditsUsed ?? 0));

  return (
    <AnalyticsChartCard
      title={USAGE_DASHBOARD_COPY.tableTitle}
      description={USAGE_DASHBOARD_COPY.tableDescription}
      bodyClassName="min-h-0 overflow-x-auto"
    >
      <table className="w-full min-w-[520px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            <th className="py-2.5 pr-4 font-medium">Usage type</th>
            <th className="py-2.5 pr-4 text-right font-medium">Events</th>
            <th className="py-2.5 pr-4 text-right font-medium">Credits</th>
            <th className="py-2.5 pr-4 text-right font-medium">Billable</th>
            <th className="py-2.5 text-right font-medium">Non-billable</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.usageType} className="border-b border-slate-50 last:border-b-0">
              <td className="py-2.5 pr-4 font-medium text-slate-800">{r.label || r.usageType}</td>
              <td className="py-2.5 pr-4 text-right tabular-nums text-slate-700">{formatAnalyticsInteger(r.events)}</td>
              <td className="py-2.5 pr-4 text-right tabular-nums text-slate-900">{formatAnalyticsCredits(r.creditsUsed)}</td>
              <td className="py-2.5 pr-4 text-right tabular-nums text-slate-700">
                {formatAnalyticsCredits(r.billableCredits)}
              </td>
              <td className="py-2.5 text-right tabular-nums text-slate-600">
                {formatAnalyticsCredits(r.nonBillableCredits)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </AnalyticsChartCard>
  );
}
