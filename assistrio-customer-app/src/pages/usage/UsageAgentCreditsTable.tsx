import { Bot } from 'lucide-react';
import type { WorkspaceBillingAiCreditsUsageSummary, WorkspaceBillingSummary } from '@/api/types';
import { SettingsInfoCard } from '@/components/settings/SettingsInfoCard';
import { UsageProgressBar } from '@/pages/usage/UsageProgressBar';
import {
  buildBotNameLookup,
  formatCreditsSharePercent,
  hasAiCreditUsage,
} from '@/pages/usage/usagePageFormat';

type Props = {
  summary: WorkspaceBillingSummary;
  aiCredits: WorkspaceBillingAiCreditsUsageSummary | undefined;
};

export function UsageAgentCreditsTable({ summary, aiCredits }: Props) {
  const botNameLookup = buildBotNameLookup(summary);
  const rows = aiCredits?.byBot ?? [];
  const totalUsed = aiCredits?.monthlyCreditsUsed ?? 0;
  const isEmpty = !hasAiCreditUsage(summary);

  return (
    <SettingsInfoCard
      id="usage-agent-credits"
      icon={Bot}
      title="AI credits by agent"
      description="Credits used in the current billing period."
    >
      {isEmpty ? (
        <p className="m-0 rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-8 text-center text-sm text-slate-500">
          No AI credit usage yet.
        </p>
      ) : (
        <div className="overflow-x-auto -mx-1 px-1">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-[0.6875rem] font-semibold uppercase tracking-wide text-slate-500">
                <th className="pb-3 pr-4 font-semibold">Agent</th>
                <th className="pb-3 pr-4 font-semibold">Credits used</th>
                <th className="pb-3 pr-4 font-semibold">Share of total</th>
                <th className="min-w-[8rem] pb-3 font-semibold">Usage</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const name = botNameLookup.get(row.botId) ?? 'Agent';
                const share = formatCreditsSharePercent(row.creditsUsed, totalUsed);
                return (
                  <tr
                    key={row.botId}
                    className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/60"
                  >
                    <td className="py-3.5 pr-4 font-medium text-slate-900">{name}</td>
                    <td className="py-3.5 pr-4 tabular-nums text-slate-700">
                      {row.creditsUsed.toLocaleString()}
                    </td>
                    <td className="py-3.5 pr-4 tabular-nums text-slate-700">{share}%</td>
                    <td className="py-3.5">
                      <UsageProgressBar
                        percent={share}
                        ariaLabel={`${name} share of AI credits`}
                        tone={share >= 85 ? 'warning' : 'default'}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </SettingsInfoCard>
  );
}
