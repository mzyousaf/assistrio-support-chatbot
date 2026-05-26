import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Bot, Coins, HardDrive, Users } from 'lucide-react';
import { getWorkspaceBillingSummary } from '@/api/customerApi';
import type { WorkspaceBillingSummary } from '@/api/types';
import { useCustomerAuth } from '@/auth/CustomerAuthContext';
import { SettingsPageHeader } from '@/components/settings/SettingsPageHeader';
import { Button, Card, CardBody } from '@/components/ui';
import { WorkspaceContentContainer } from '@/layout/workspace-layout/WorkspaceContentContainer';
import { formatKnowledgeBytes } from '@/lib/formatKnowledgeBytes';
import { resolveActiveCustomerWorkspace } from '@/lib/resolveActiveCustomerWorkspace';
import { TRAINED_KNOWLEDGE_STORAGE_HELPER, TRAINED_KNOWLEDGE_STORAGE_LABEL } from '@/lib/trainedKnowledgeStorageCopy';
import { UsageAddonCard } from '@/pages/usage/UsageAddonCard';
import { UsageAgentCreditsTable } from '@/pages/usage/UsageAgentCreditsTable';
import { UsageCreditsTrendChart } from '@/pages/usage/UsageCreditsTrendChart';
import { UsageKnowledgeStorageTable } from '@/pages/usage/UsageKnowledgeStorageTable';
import { UsageMetricCard } from '@/pages/usage/UsageMetricCard';
import { UsagePlanStatusChips } from '@/pages/usage/UsagePlanStatusChips';
import {
  formatAiCreditsPercent,
  formatLimitPercent,
  formatUsagePeriodDate,
} from '@/pages/usage/usagePageFormat';

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

function UsagePageSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading usage">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-52 animate-pulse rounded-2xl border border-slate-200/90 bg-slate-50" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-2xl border border-slate-200/90 bg-slate-50" />
      <div className="h-72 animate-pulse rounded-2xl border border-slate-200/90 bg-slate-50" />
      <div className="h-72 animate-pulse rounded-2xl border border-slate-200/90 bg-slate-50" />
    </div>
  );
}

function UsageErrorCard(props: { message: string; onRetry: () => void }) {
  return (
    <Card className="border-amber-200/90 bg-amber-50/70 shadow-[var(--shadow-card)]">
      <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-800" aria-hidden />
          <div className="min-w-0">
            <p className="m-0 font-semibold text-amber-950">Could not load usage</p>
            <p className="m-0 mt-1 text-sm leading-relaxed text-amber-900/90">{props.message}</p>
          </div>
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={props.onRetry}>
          Retry
        </Button>
      </CardBody>
    </Card>
  );
}

export function UsagePage() {
  const { customer } = useCustomerAuth();
  const { activeWorkspaceId } = resolveActiveCustomerWorkspace(customer);

  const [summary, setSummary] = useState<WorkspaceBillingSummary | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    if (!activeWorkspaceId) {
      setSummary(null);
      setLoadState('ready');
      setErrorMessage(null);
      return;
    }

    setLoadState('loading');
    setErrorMessage(null);

    const result = await getWorkspaceBillingSummary(activeWorkspaceId);
    if (!result.ok) {
      setSummary(null);
      setLoadState('error');
      setErrorMessage(result.error?.trim() || 'Something went wrong while loading workspace usage.');
      return;
    }

    setSummary(result.data);
    setLoadState('ready');
  }, [activeWorkspaceId]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const aiCredits = summary?.usage?.aiCredits;
  const botsUsage = summary?.usage?.bots;
  const membersUsage = summary?.usage?.members;
  const trainedKnowledge = summary?.usage?.trainedKnowledge;
  const addonCatalog = summary?.addonCatalog ?? [];

  const aiCreditsUsed = aiCredits?.monthlyCreditsUsed ?? 0;
  const aiCreditsTotal = aiCredits?.monthlyCredits ?? 0;
  const aiCreditsRemaining = aiCredits?.totalCreditsRemaining ?? aiCredits?.monthlyCreditsRemaining ?? 0;
  const aiCreditsOverLimit = Boolean(aiCredits?.isOverLimit);
  const aiCreditsPercent = formatAiCreditsPercent(aiCreditsUsed, aiCreditsTotal);
  const aiCreditsProgressTone = aiCreditsOverLimit
    ? 'danger'
    : aiCreditsPercent >= 85
      ? 'warning'
      : 'default';

  const botsCurrent = botsUsage?.current ?? 0;
  const botsLimit = botsUsage?.limit ?? 0;
  const botsPercent = formatLimitPercent(botsCurrent, botsLimit);

  const membersUsed = membersUsage?.used ?? 0;
  const membersLimit = membersUsage?.limit ?? 0;
  const membersPercent = formatLimitPercent(membersUsed, membersLimit);

  const headerActions = summary ? <UsagePlanStatusChips summary={summary} /> : null;

  return (
    <>
      <SettingsPageHeader
        title="Usage"
        description="Track your workspace limits, AI credits, and trained knowledge storage."
        actions={headerActions}
      />

      <WorkspaceContentContainer size="standard" className="pt-6">
        {!activeWorkspaceId ? (
          <Card className="border-slate-200/90 shadow-[var(--shadow-card)]">
            <CardBody>
              <p className="m-0 text-sm leading-relaxed text-slate-600">
                No active workspace selected.
              </p>
            </CardBody>
          </Card>
        ) : loadState === 'loading' && !summary ? (
          <UsagePageSkeleton />
        ) : loadState === 'error' ? (
          <UsageErrorCard message={errorMessage ?? 'Could not load usage.'} onRetry={() => void loadSummary()} />
        ) : summary ? (
          <div className="flex flex-col gap-4 pb-12">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <UsageMetricCard
                title="AI credits"
                icon={Coins}
                headline={`${aiCreditsUsed.toLocaleString()} used`}
                subtext={`${aiCreditsRemaining.toLocaleString()} remaining · ${aiCreditsTotal.toLocaleString()} included this period`}
                helper="AI credits reset each billing period."
                tone={aiCreditsOverLimit ? 'danger' : 'default'}
                progressPercent={aiCreditsPercent}
                progressAriaLabel="AI credits used this billing period"
                progressTone={aiCreditsProgressTone}
                footer={
                  <>
                    <p className="m-0 text-xs text-slate-500">
                      Period: {formatUsagePeriodDate(aiCredits?.periodStart)} –{' '}
                      {formatUsagePeriodDate(aiCredits?.periodEnd)}
                    </p>
                    {aiCreditsOverLimit ? (
                      <p className="m-0 text-xs font-medium text-red-800">
                        You are over your included AI credits for this period.
                      </p>
                    ) : null}
                  </>
                }
              />

              <UsageMetricCard
                title="Agents"
                icon={Bot}
                headline={`${botsCurrent} of ${botsLimit}`}
                subtext="Agents used in this workspace."
                progressPercent={botsLimit > 0 ? botsPercent : undefined}
                progressAriaLabel={botsLimit > 0 ? 'Agents used in workspace' : undefined}
                progressTone={botsPercent >= 100 ? 'danger' : botsPercent >= 85 ? 'warning' : 'default'}
              />

              <UsageMetricCard
                title="Members"
                icon={Users}
                headline={`${membersUsed} of ${membersLimit}`}
                subtext="Includes pending invites."
                progressPercent={membersLimit > 0 ? membersPercent : undefined}
                progressAriaLabel={membersLimit > 0 ? 'Workspace member seats used' : undefined}
                progressTone={membersPercent >= 100 ? 'danger' : membersPercent >= 85 ? 'warning' : 'default'}
              />

              <UsageMetricCard
                title={TRAINED_KNOWLEDGE_STORAGE_LABEL}
                icon={HardDrive}
                headline={formatKnowledgeBytes(trainedKnowledge?.totalUsedBytes ?? 0)}
                subtext="Total extracted text across all agents."
                helper={TRAINED_KNOWLEDGE_STORAGE_HELPER}
              />
            </div>

            <UsageCreditsTrendChart
              periodStart={aiCredits?.periodStart}
              periodEnd={aiCredits?.periodEnd}
              monthlyCreditsUsed={aiCreditsUsed}
            />

            <UsageAgentCreditsTable summary={summary} aiCredits={aiCredits} />

            <UsageKnowledgeStorageTable trainedKnowledge={trainedKnowledge} />

            <section aria-labelledby="usage-addons-heading" className="space-y-3">
              <div>
                <h2 id="usage-addons-heading" className="m-0 text-base font-semibold text-slate-900">
                  Available add-ons
                </h2>
                <p className="m-0 mt-1 text-sm text-slate-500">Add-ons are not available yet.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {addonCatalog.map((addon) => (
                  <UsageAddonCard key={addon.key} addon={addon} />
                ))}
              </div>
            </section>
          </div>
        ) : null}
      </WorkspaceContentContainer>
    </>
  );
}
