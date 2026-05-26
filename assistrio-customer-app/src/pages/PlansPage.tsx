import { useCustomerAuth } from '@/auth/CustomerAuthContext';
import { SettingsPageHeader } from '@/components/settings/SettingsPageHeader';
import { useWorkspaceBillingSummary } from '@/hooks/useWorkspaceBillingSummary';
import { WorkspaceContentContainer } from '@/layout/workspace-layout/WorkspaceContentContainer';
import { resolveActiveCustomerWorkspace } from '@/lib/resolveActiveCustomerWorkspace';
import { AddonCatalogSection, PlanCatalogSection } from '@/pages/billing/BillingCatalogSections';
import { BillingCurrentPlanHero } from '@/pages/billing/BillingCurrentPlanHero';
import { BillingFutureSections } from '@/pages/billing/BillingFutureSections';
import {
  BillingEmptyWorkspaceCard,
  BillingErrorCard,
  BillingPageSkeleton,
  BillingPaymentSetupNotice,
} from '@/pages/billing/BillingPageShared';
import { BillingUnavailableNotice } from '@/pages/billing/BillingUnavailableNotice';
import { BillingUsageSnapshot } from '@/pages/billing/BillingUsageSnapshot';

export function PlansPage() {
  const { customer } = useCustomerAuth();
  const { activeWorkspaceId, role } = resolveActiveCustomerWorkspace(customer);
  const { summary, loadState, errorMessage, loadSummary } = useWorkspaceBillingSummary(activeWorkspaceId);

  return (
    <>
      <SettingsPageHeader
        settingsRoute="/settings/plans"
        title="Plans"
        description="Compare workspace plans, limits, and add-ons."
        actions={<BillingUnavailableNotice role={role} variant="chip" />}
      />

      <WorkspaceContentContainer size="editor" className="pt-0">
        {!activeWorkspaceId ? (
          <BillingEmptyWorkspaceCard />
        ) : loadState === 'loading' && !summary ? (
          <BillingPageSkeleton cards={3} />
        ) : loadState === 'error' ? (
          <BillingErrorCard
            message={errorMessage ?? 'Could not load billing details.'}
            onRetry={() => void loadSummary()}
          />
        ) : summary ? (
          <div className="flex flex-col gap-4 pb-12">
            <BillingCurrentPlanHero summary={summary} />
            <PlanCatalogSection summary={summary} />
            <AddonCatalogSection summary={summary} />
          </div>
        ) : null}
      </WorkspaceContentContainer>
    </>
  );
}

export function SettingsBillingPage() {
  const { customer } = useCustomerAuth();
  const { activeWorkspaceId, role } = resolveActiveCustomerWorkspace(customer);
  const { summary, loadState, errorMessage, loadSummary } = useWorkspaceBillingSummary(activeWorkspaceId);

  return (
    <>
      <SettingsPageHeader
        settingsRoute="/settings/billing"
        title="Billing"
        description="Review your workspace subscription, usage, and upcoming billing features."
      />

      <WorkspaceContentContainer size="editor" className="pt-0">
        {!activeWorkspaceId ? (
          <BillingEmptyWorkspaceCard />
        ) : loadState === 'loading' && !summary ? (
          <BillingPageSkeleton cards={2} />
        ) : loadState === 'error' ? (
          <BillingErrorCard
            message={errorMessage ?? 'Could not load billing details.'}
            onRetry={() => void loadSummary()}
          />
        ) : summary ? (
          <div className="flex flex-col gap-4 pb-12">
            <BillingUnavailableNotice role={role} />
            <BillingCurrentPlanHero summary={summary} variant="compact" showViewPlansLink />
            <BillingPaymentSetupNotice />
            <BillingUsageSnapshot summary={summary} />
            <BillingFutureSections />
          </div>
        ) : null}
      </WorkspaceContentContainer>
    </>
  );
}
