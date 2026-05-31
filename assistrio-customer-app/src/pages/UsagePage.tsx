import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Bot, Coins, Package, Users } from 'lucide-react';
import { getCustomerBots, getWorkspaceBillingSummary, getWorkspaceUsageAnalytics } from '@/api/customerApi';
import type { CustomerBotListItem, WorkspaceBillingSummary, WorkspaceUsageAnalytics } from '@/api/types';
import { useCustomerAuth } from '@/auth/CustomerAuthContext';
import { SettingsPageHeader } from '@/components/settings/SettingsPageHeader';
import { Button, Card, CardBody } from '@/components/ui';
import { WorkspaceContentContainer } from '@/layout/workspace-layout/WorkspaceContentContainer';
import { resolveActiveCustomerWorkspace } from '@/lib/resolveActiveCustomerWorkspace';
import { isBillingCheckoutConfigured } from '@/lib/billingCheckout';
import { buildUsageAnalyticsQueryParams } from '@/lib/usageAnalyticsQuery';
import { BillingAddonsSection } from '@/pages/billing/BillingAddonsSection';
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
import { BillingTrialAlerts } from '@/pages/billing/BillingTrialAlerts';
import {
  buildMonthlyAiCreditsCardDisplay,
  buildTopUpCreditsCardDisplay,
  formatLimitPercent,
} from '@/pages/usage/usagePageFormat';
import { formatAiCreditsRingAriaLabel } from '@/lib/planEntitlements';

type LoadState = 'idle' | 'loading' | 'ready' | 'error';
type AnalyticsLoadState = 'idle' | 'loading' | 'ready' | 'error';

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
  const { activeWorkspaceId, role } = resolveActiveCustomerWorkspace(customer);

  const [summary, setSummary] = useState<WorkspaceBillingSummary | null>(null);
  const [analytics, setAnalytics] = useState<WorkspaceUsageAnalytics | null>(null);
  const [workspaceBots, setWorkspaceBots] = useState<CustomerBotListItem[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [analyticsLoadState, setAnalyticsLoadState] = useState<AnalyticsLoadState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [analyticsErrorMessage, setAnalyticsErrorMessage] = useState<string | null>(null);
  const [usageFilter, setUsageFilter] = useState<UsageFilterValues>(() => ({
    ...USAGE_FILTER_DEFAULTS,
  }));
  const topUpMetricSkeletonHintRef = useRef<Record<string, boolean>>({});

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

  const loadAnalytics = useCallback(async () => {
    if (!activeWorkspaceId) {
      setAnalytics(null);
      setAnalyticsLoadState('ready');
      setAnalyticsErrorMessage(null);
      return;
    }

    setAnalyticsLoadState('loading');
    setAnalyticsErrorMessage(null);

    const billingPeriod = summary
      ? {
          start: summary.usage?.aiCredits?.periodStart ?? summary.plan.currentPeriodStart,
          end: summary.usage?.aiCredits?.periodEnd ?? summary.plan.currentPeriodEnd,
        }
      : null;

    const params = buildUsageAnalyticsQueryParams({
      date: usageFilter.date,
      agentIds: usageFilter.agentIds,
      billingPeriod,
    });

    const result = await getWorkspaceUsageAnalytics(activeWorkspaceId, params);
    if (!result.ok) {
      setAnalytics(null);
      setAnalyticsLoadState('error');
      setAnalyticsErrorMessage(result.error?.trim() || 'Could not load usage analytics.');
      return;
    }

    setAnalytics(result.data);
    setAnalyticsLoadState('ready');
  }, [activeWorkspaceId, summary, usageFilter]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    if (loadState !== 'ready' || !summary) return;
    void loadAnalytics();
  }, [loadAnalytics, loadState, summary]);

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
  const topUps = summary?.topUps ?? [];
  const botsUsage = summary?.usage?.bots;
  const membersUsage = summary?.usage?.members;
  const checkoutEnabled = isBillingCheckoutConfigured(summary?.planCatalog);

  const monthlyCreditsDisplay = buildMonthlyAiCreditsCardDisplay(aiCredits, {
    isTrialPlan: summary?.entitlements.isTrialPlan,
  });
  const topUpCreditsDisplay = buildTopUpCreditsCardDisplay(
    aiCredits?.topUpCreditsRemaining,
    topUps,
  );

  useEffect(() => {
    if (!activeWorkspaceId || !summary) return;
    topUpMetricSkeletonHintRef.current[activeWorkspaceId] = topUpCreditsDisplay.showCard;
  }, [activeWorkspaceId, summary, topUpCreditsDisplay.showCard]);

  const showTopUpMetricSkeleton =
    activeWorkspaceId && activeWorkspaceId in topUpMetricSkeletonHintRef.current
      ? topUpMetricSkeletonHintRef.current[activeWorkspaceId]
      : false;
  const aiCreditsOverLimit = Boolean(aiCredits?.isOverLimit);
  const aiCreditsPercent = monthlyCreditsDisplay.monthlyUsagePercent;
  const aiCreditsRingTone = aiCreditsOverLimit || aiCreditsPercent >= 100 ? 'danger' : 'default';
  const aiCreditsCardTone = aiCreditsOverLimit || aiCreditsPercent >= 100 ? 'danger' : 'default';
  const metricGridClass = topUpCreditsDisplay.showCard
    ? 'grid gap-4 sm:grid-cols-2 xl:grid-cols-4'
    : 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3';

  const botsCurrent = botsUsage?.current ?? 0;
  const botsLimit = botsUsage?.limit ?? 0;
  const botsPercent = formatLimitPercent(botsCurrent, botsLimit);

  const membersUsed = membersUsage?.used ?? 0;
  const membersLimit = membersUsage?.limit ?? 0;
  const membersPercent = formatLimitPercent(membersUsed, membersLimit);

  const planStatusChips = summary ? <UsagePlanStatusChips summary={summary} /> : null;
  const maxHistoryDays = summary?.entitlements.analyticsHistoryDays ?? null;
  const agentFilterActive = usageFilter.agentIds.length > 0;
  const analyticsLoading = analyticsLoadState === 'loading' || analyticsLoadState === 'idle';

  return (
    <>
      <SettingsPageHeader
        title="Usage"
        description="Track workspace limits, AI credits, agent usage, and trained knowledge storage."
        titleAddon={planStatusChips}
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
          <UsagePageSkeleton showTopUpMetricCard={showTopUpMetricSkeleton} />
        ) : loadState === 'error' ? (
          <UsageErrorCard message={errorMessage ?? 'Could not load usage.'} onRetry={() => void loadSummary()} />
        ) : summary ? (
          <div className="flex flex-col gap-6 pb-12">
            <BillingTrialAlerts summary={summary} />
            <div className={metricGridClass}>
              <UsageMetricCard
                title={summary.entitlements.isTrialPlan ? 'Trial AI credits' : 'Monthly AI credits'}
                icon={Coins}
                valueLabel={monthlyCreditsDisplay.valueLabel}
                ringPercent={aiCreditsPercent}
                ringAriaLabel={formatAiCreditsRingAriaLabel(summary)}
                ringTone={aiCreditsRingTone}
                supportText={monthlyCreditsDisplay.usageLine}
                periodNote={monthlyCreditsDisplay.resetFooter}
                helper={
                  summary?.entitlements.isTrialPlan
                    ? 'Trial credits do not renew. Upgrade for monthly AI credits.'
                    : undefined
                }
                tone={aiCreditsCardTone}
                footer={
                  aiCreditsOverLimit ? (
                    <p className="m-0 text-xs font-medium text-red-800">
                      You are over your included AI credits for this period.
                    </p>
                  ) : null
                }
              />

              {topUpCreditsDisplay.showCard ? (
                <UsageMetricCard
                  title="Top-up credits"
                  icon={Package}
                  badge="Reserve"
                  badgeTooltip={topUpCreditsDisplay.reserveTooltip}
                  valueLabel={topUpCreditsDisplay.valueLabel}
                  ringPercent={topUpCreditsDisplay.ringPercent}
                  ringAriaLabel="Top-up credits used"
                  supportText={topUpCreditsDisplay.subtitleLine}
                  periodNote={topUpCreditsDisplay.expiryFooter ?? undefined}
                />
              ) : null}

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

            <UsageFilterBar
              values={usageFilter}
              onChange={setUsageFilter}
              agents={workspaceBots}
              disabled={!activeWorkspaceId || loadState === 'loading'}
              maxHistoryDays={maxHistoryDays}
            />

            <UsageCreditsTrendChart
              trend={analytics?.usageTrend}
              loading={analyticsLoading}
              errorMessage={analyticsLoadState === 'error' ? analyticsErrorMessage : null}
              onRetry={() => void loadAnalytics()}
              className="w-full"
            />

            <div
              className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-stretch"
              data-testid="usage-agent-usage-row"
            >
              <UsageAgentCreditsTable
                rows={analytics?.aiCreditsByAgent}
                loading={analyticsLoading}
                errorMessage={analyticsLoadState === 'error' ? analyticsErrorMessage : null}
                agentFilterActive={agentFilterActive}
              />
              <UsageKnowledgeStorageTable
                rows={analytics?.trainedKnowledgeByAgent}
                bots={workspaceBots}
                loading={analyticsLoading}
                errorMessage={analyticsLoadState === 'error' ? analyticsErrorMessage : null}
                agentFilterActive={agentFilterActive}
              />
            </div>

            {checkoutEnabled ? (
              <BillingAddonsSection
                workspaceId={activeWorkspaceId}
                role={role}
                summary={summary}
                checkoutEnabled={checkoutEnabled}
                onSummaryUpdated={() => void loadSummary()}
              />
            ) : null}
          </div>
        ) : null}
      </WorkspaceContentContainer>
    </>
  );
}
