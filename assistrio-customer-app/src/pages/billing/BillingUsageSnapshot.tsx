import { Coins } from 'lucide-react';
import type { WorkspaceBillingSummary } from '@/api/types';
import { SettingsInfoCard } from '@/components/settings/SettingsInfoCard';
import { SettingsStatCard } from '@/components/settings/SettingsStatCard';
import { TRAINED_KNOWLEDGE_STORAGE_LABEL } from '@/lib/trainedKnowledgeStorageCopy';
import { formatKnowledgeBytes } from '@/lib/formatKnowledgeBytes';

type Props = {
  summary: WorkspaceBillingSummary;
};

export function BillingUsageSnapshot({ summary }: Props) {
  const { usage, entitlements } = summary;
  const aiCredits = usage.aiCredits;
  const bots = usage.bots;
  const members = usage.members;
  const trainedKnowledge = usage.trainedKnowledge;

  return (
    <SettingsInfoCard
      id="billing-usage-snapshot"
      icon={Coins}
      title="Usage snapshot"
      description="Current workspace consumption against your plan limits."
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SettingsStatCard
          label="AI credits"
          value={`${(aiCredits?.monthlyCreditsUsed ?? 0).toLocaleString()} used`}
          hint={`${(aiCredits?.totalCreditsRemaining ?? aiCredits?.monthlyCreditsRemaining ?? 0).toLocaleString()} remaining`}
        />
        <SettingsStatCard
          label="Agents"
          value={`${bots?.current ?? 0} / ${bots?.limit ?? 0}`}
          hint="Agents used"
        />
        <SettingsStatCard
          label="Members"
          value={`${members?.used ?? 0} / ${members?.limit ?? 0}`}
          hint="Includes pending invites"
        />
        <SettingsStatCard
          label={TRAINED_KNOWLEDGE_STORAGE_LABEL}
          value={formatKnowledgeBytes(trainedKnowledge?.totalUsedBytes ?? 0)}
          hint={`${entitlements.kbStorageMbPerBot} MB limit per AI Agent`}
        />
      </div>
    </SettingsInfoCard>
  );
}
