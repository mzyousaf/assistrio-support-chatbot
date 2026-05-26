import { useMemo } from 'react';
import type { CustomerBotListItem, WorkspaceBillingTrainedKnowledgeUsageSummary } from '@/api/types';
import { TRAINED_KNOWLEDGE_STORAGE_HELPER, TRAINED_KNOWLEDGE_STORAGE_LABEL } from '@/lib/trainedKnowledgeStorageCopy';
import { UsageAgentAvatar } from '@/pages/usage/UsageAgentAvatar';
import { matchesUsageAgentFilter } from '@/pages/usage/UsageFilterBar';
import { UsageProgressBar } from '@/pages/usage/UsageProgressBar';
import { UsageSectionCard } from '@/pages/usage/UsageSectionCard';
import { formatMbLabel } from '@/pages/usage/usagePageFormat';

type Props = {
  trainedKnowledge: WorkspaceBillingTrainedKnowledgeUsageSummary | undefined;
  bots?: CustomerBotListItem[];
  agentIds?: string[];
  className?: string;
};

export function UsageKnowledgeStorageTable({
  trainedKnowledge,
  bots = [],
  agentIds = [],
  className,
}: Props) {
  const helper = trainedKnowledge?.note ?? TRAINED_KNOWLEDGE_STORAGE_HELPER;
  const botsById = useMemo(() => new Map(bots.map((bot) => [bot._id, bot])), [bots]);
  const rows = useMemo(
    () =>
      [...(trainedKnowledge?.perBot ?? [])]
        .filter((row) => matchesUsageAgentFilter(row.botId, agentIds))
        .sort((a, b) => (b.percentUsed ?? 0) - (a.percentUsed ?? 0)),
    [trainedKnowledge?.perBot, agentIds],
  );
  const isEmpty = rows.length === 0;

  return (
    <UsageSectionCard
      id="usage-knowledge-storage"
      className={className}
      title={`${TRAINED_KNOWLEDGE_STORAGE_LABEL} by agent`}
      description={helper}
      bodyClassName="flex flex-1 flex-col"
    >
      {isEmpty ? (
        <p className="m-0 flex flex-1 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/60 px-4 py-8 text-center text-sm text-slate-500">
          {agentIds.length > 0
            ? 'No trained knowledge usage for the selected agents.'
            : 'No trained knowledge usage yet.'}
        </p>
      ) : (
        <ul className="m-0 flex min-h-0 flex-1 flex-col divide-y divide-slate-100 p-0 lg:max-h-[220px] lg:overflow-y-auto">
          {rows.map((row) => {
            const bot = botsById.get(row.botId);
            return (
              <li key={row.botId} className="list-none py-2.5 first:pt-0 last:pb-0">
                <div className="flex items-start gap-3">
                  <UsageAgentAvatar
                    name={row.botName}
                    size="sm"
                    imageUrl={bot?.imageUrl}
                    avatarEmoji={bot?.avatarEmoji}
                    primaryColor={bot?.primaryColor}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <p className="m-0 min-w-0 truncate text-sm font-medium text-slate-900">
                        {row.botName}
                      </p>
                      <p className="m-0 shrink-0 text-xs font-medium tabular-nums text-slate-700">
                        {row.percentUsed.toLocaleString()}%
                      </p>
                    </div>
                    <p className="m-0 mt-0.5 text-xs text-slate-500">
                      {formatMbLabel(row.usedMb)} used · {formatMbLabel(row.maxMb)} limit
                    </p>
                    <div className="mt-2">
                      <UsageProgressBar
                        percent={row.percentUsed}
                        ariaLabel={`${row.botName} trained knowledge storage ${row.percentUsed}% used`}
                        tone={row.percentUsed >= 95 ? 'danger' : 'default'}
                        heightClass="h-1.5"
                      />
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </UsageSectionCard>
  );
}
