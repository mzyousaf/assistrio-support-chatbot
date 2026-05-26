import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Bot, Coins, Users } from 'lucide-react';
import { getCustomerBots, getWorkspaceBillingSummary } from '@/api/customerApi';
import type { CustomerBotListItem, WorkspaceBillingSummary } from '@/api/types';
import { useCustomerAuth } from '@/auth/CustomerAuthContext';
import { SettingsPageHeader } from '@/components/settings/SettingsPageHeader';
import { Button, Card, CardBody } from '@/components/ui';
import { WorkspaceContentContainer } from '@/layout/workspace-layout/WorkspaceContentContainer';
import { resolveActiveCustomerWorkspace } from '@/lib/resolveActiveCustomerWorkspace';
import { UsageAddonCard } from '@/pages/usage/UsageAddonCard';
import { UsageAgentCreditsTable } from '@/pages/usage/UsageAgentCreditsTable';
import { UsageCreditsTrendChart } from '@/pages/usage/UsageCreditsTrendChart';
import {
  USAGE_FILTER_DEFAULTS,
  type UsageFilterValues,
  UsageFilterBar,
} from '@/pages/usage/UsageFilterBar';
import { UsageKnowledgeStorageTable } from '@/pages/usage/UsageKnowledgeStorageTable';
import { UsageMetricCard } from '@/pages/usage/UsageMetricCard';
import { UsagePageSkeleton } from '@/pages/usage/UsagePageSkeleton';
import { UsagePlanStatusChips } from '@/pages/usage/UsagePlanStatusChips';
import { formatAiCreditsPercent, formatLimitPercent } from '@/pages/usage/usagePageFormat';

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

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
  const [workspaceBots, setWorkspaceBots] = useState<CustomerBotListItem[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [usageFilter, setUsageFilter] = useState<UsageFilterValues>(() => ({
    ...USAGE_FILTER_DEFAULTS,
  }));

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

  useEffect(() => {
    setUsageFilter((prev) => ({ ...prev, agentIds: [] }));
  }, [activeWorkspaceId]);

  useEffect(() => {
    if (!activeWorkspaceId) {
      setWorkspaceBots([]);
      return;
    }

    let cancelled = false;
    void getCustomerBots({ workspaceId: activeWorkspaceId, status: 'all' }).then((result) => {
      if (cancelled) return;
      setWorkspaceBots(result.ok ? result.data : []);
    });

    return () => {
      cancelled = true;
    };
  }, [activeWorkspaceId]);

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
  const aiCreditsRingTone = aiCreditsOverLimit || aiCreditsPercent >= 100 ? 'danger' : 'default';
  const aiCreditsCardTone = aiCreditsOverLimit || aiCreditsPercent >= 100 ? 'danger' : 'default';

  const botsCurrent = botsUsage?.current ?? 0;
  const botsLimit = botsUsage?.limit ?? 0;
  const botsPercent = formatLimitPercent(botsCurrent, botsLimit);

  const membersUsed = membersUsage?.used ?? 0;
  const membersLimit = membersUsage?.limit ?? 0;
  const membersPercent = formatLimitPercent(membersUsed, membersLimit);

  const planStatusChips = summary ? <UsagePlanStatusChips summary={summary} /> : null;
  const maxHistoryDays = summary?.entitlements.analyticsHistoryDays ?? null;
  const usageFilterBar = (
    <UsageFilterBar
      values={usageFilter}
      onChange={setUsageFilter}
      agents={workspaceBots}
      disabled={!activeWorkspaceId || loadState === 'loading'}
      maxHistoryDays={maxHistoryDays}
    />
  );

  return (
    <>
      <SettingsPageHeader
        title="Usage"
        description="Track workspace limits, AI credits, agent usage, and trained knowledge storage."
        titleAddon={planStatusChips}
        actions={activeWorkspaceId ? usageFilterBar : null}
      />

      <WorkspaceContentContainer size="editor" className="pt-0">
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
          <div className="flex flex-col gap-6 pb-12">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <UsageMetricCard
                title="AI credits"
                icon={Coins}
                valueLabel={`${aiCreditsUsed.toLocaleString()} / ${aiCreditsTotal.toLocaleString()}`}
                ringPercent={aiCreditsPercent}
                ringAriaLabel="AI credits used this billing period"
                ringTone={aiCreditsRingTone}
                supportText={`${aiCreditsRemaining.toLocaleString()} remaining`}
                helper="AI credits reset each billing period."
                tone={aiCreditsCardTone}
                footer={
                  aiCreditsOverLimit ? (
                    <p className="m-0 text-xs font-medium text-red-800">
                      You are over your included AI credits for this period.
                    </p>
                  ) : null
                }
              />

              <UsageMetricCard
                title="Agents"
                icon={Bot}
                valueLabel={`${botsCurrent} / ${botsLimit}`}
                ringPercent={botsLimit > 0 ? botsPercent : 0}
                ringAriaLabel="Agents used in workspace"
                supportText="Agents used in this workspace."
              />

              <UsageMetricCard
                title="Members"
                icon={Users}
                valueLabel={`${membersUsed} / ${membersLimit}`}
                ringPercent={membersLimit > 0 ? membersPercent : 0}
                ringAriaLabel="Workspace member seats used"
                supportText="Includes pending invites."
              />
            </div>

            <UsageCreditsTrendChart
              periodStart={aiCredits?.periodStart}
              periodEnd={aiCredits?.periodEnd}
              monthlyCreditsUsed={aiCreditsUsed}
              className="w-full"
            />

            <div
              className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-stretch"
              data-testid="usage-agent-usage-row"
            >
              <UsageAgentCreditsTable
                summary={summary}
                aiCredits={aiCredits}
                agentIds={usageFilter.agentIds}
              />
              <UsageKnowledgeStorageTable
                trainedKnowledge={trainedKnowledge}
                bots={workspaceBots}
                agentIds={usageFilter.agentIds}
              />
            </div>

            <section aria-labelledby="usage-addons-heading" className="space-y-3">
              <div>
                <h2 id="usage-addons-heading" className="m-0 text-sm font-semibold text-slate-900">
                  Available add-ons
                </h2>
                <p className="m-0 mt-1 text-xs text-slate-500">Add-ons are not available yet.</p>
              </div>
              <div className="flex flex-col gap-3">
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
