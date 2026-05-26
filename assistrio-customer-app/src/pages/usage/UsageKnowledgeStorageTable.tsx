import { HardDrive } from 'lucide-react';
import type { WorkspaceBillingTrainedKnowledgeUsageSummary } from '@/api/types';
import { SettingsInfoCard } from '@/components/settings/SettingsInfoCard';
import { TRAINED_KNOWLEDGE_STORAGE_HELPER, TRAINED_KNOWLEDGE_STORAGE_LABEL } from '@/lib/trainedKnowledgeStorageCopy';
import { UsageProgressBar } from '@/pages/usage/UsageProgressBar';
import { botAgentInitials, formatMbLabel } from '@/pages/usage/usagePageFormat';

type Props = {
  trainedKnowledge: WorkspaceBillingTrainedKnowledgeUsageSummary | undefined;
};

function AgentAvatar({ name }: { name: string }) {
  return (
    <span
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-50 text-xs font-semibold text-teal-800 ring-1 ring-teal-100"
      aria-hidden
    >
      {botAgentInitials(name)}
    </span>
  );
}

export function UsageKnowledgeStorageTable({ trainedKnowledge }: Props) {
  const rows = trainedKnowledge?.perBot ?? [];
  const helper = trainedKnowledge?.note ?? TRAINED_KNOWLEDGE_STORAGE_HELPER;
  const isEmpty = rows.length === 0;

  return (
    <SettingsInfoCard
      id="usage-knowledge-storage"
      icon={HardDrive}
      title={`${TRAINED_KNOWLEDGE_STORAGE_LABEL} by agent`}
      description={helper}
    >
      {isEmpty ? (
        <p className="m-0 rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-8 text-center text-sm text-slate-500">
          No trained knowledge usage yet.
        </p>
      ) : (
        <div className="overflow-x-auto -mx-1 px-1">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-[0.6875rem] font-semibold uppercase tracking-wide text-slate-500">
                <th className="pb-3 pr-4 font-semibold">Agent</th>
                <th className="pb-3 pr-4 font-semibold">Used</th>
                <th className="pb-3 pr-4 font-semibold">Limit</th>
                <th className="pb-3 pr-4 font-semibold">Used %</th>
                <th className="min-w-[8rem] pb-3 font-semibold">Progress</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.botId}
                  className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/60"
                >
                  <td className="py-3.5 pr-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <AgentAvatar name={row.botName} />
                      <span className="truncate font-medium text-slate-900">{row.botName}</span>
                    </div>
                  </td>
                  <td className="py-3.5 pr-4 tabular-nums text-slate-700">{formatMbLabel(row.usedMb)}</td>
                  <td className="py-3.5 pr-4 tabular-nums text-slate-700">{formatMbLabel(row.maxMb)}</td>
                  <td className="py-3.5 pr-4 tabular-nums text-slate-700">
                    {row.percentUsed.toLocaleString()}%
                  </td>
                  <td className="py-3.5">
                    <UsageProgressBar
                      percent={row.percentUsed}
                      ariaLabel={`${row.botName} trained knowledge storage ${row.percentUsed}% used`}
                      tone={
                        row.percentUsed >= 95
                          ? 'danger'
                          : row.percentUsed >= 85
                            ? 'warning'
                            : 'default'
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SettingsInfoCard>
  );
}
