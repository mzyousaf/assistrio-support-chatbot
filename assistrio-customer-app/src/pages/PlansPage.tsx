import { useState } from 'react';
import { Layers } from 'lucide-react';
import { useCustomerAuth } from '@/auth/CustomerAuthContext';
import { SettingsPageHeader } from '@/components/settings/SettingsPageHeader';
import { useBillingCheckout } from '@/hooks/useBillingCheckout';
import { useWorkspaceBillingSummary } from '@/hooks/useWorkspaceBillingSummary';
import { WorkspaceContentContainer } from '@/layout/workspace-layout/WorkspaceContentContainer';
import { isBillingCheckoutConfigured } from '@/lib/billingCheckout';
import { resolveActiveCustomerWorkspace } from '@/lib/resolveActiveCustomerWorkspace';
import { isWorkspaceManagerRole, isWorkspaceOwnerRole } from '@/lib/workspaceRoles';
import {
  AddonCatalogSection,
  PlanFeatureComparisonSection,
  PlansPricingCardsSection,
} from '@/pages/billing/BillingCatalogSections';
import { BillingCurrentPlanSection } from '@/pages/billing/BillingCurrentPlanSection';
import { BillingFutureSections } from '@/pages/billing/BillingFutureSections';
import { BillingInvoiceHistorySection } from '@/pages/billing/BillingInvoiceHistorySection';
import { BillingProfileCard } from '@/pages/billing/WorkspaceBillingProfileSection';
import { BillingPaymentMethodSection } from '@/pages/billing/BillingPaymentMethodSection';
import {
  BillingEmptyWorkspaceCard,
  BillingErrorCard,
  BillingPageSkeleton,
  BillingPaymentSetupNotice,
} from '@/pages/billing/BillingPageShared';
import { PlansPageSkeleton } from '@/pages/billing/PlansPageSkeleton';
import { BillingPeriodToggle } from '@/pages/billing/BillingPeriodToggle';
import { BillingUnavailableNotice } from '@/pages/billing/BillingUnavailableNotice';
import type { PlanBillingPeriod } from '@/pages/billing/planPricingCardDisplay';
import { BillingCheckoutReturnBanner } from '@/pages/billing/BillingCheckoutReturnBanner';
import { BillingAddonsSection } from '@/pages/billing/BillingAddonsSection';
import { BillingCancelSubscriptionSection } from '@/pages/billing/BillingCancelSubscriptionSection';
import { BillingRestoreSubscriptionSection } from '@/pages/billing/BillingRestoreSubscriptionSection';
import { BillingDowngradePlanModal } from '@/pages/billing/BillingDowngradePlanModal';
import { BillingSubscriptionStatusAlerts } from '@/pages/billing/BillingSubscriptionStatusAlerts';
import { useBillingSubscriptionActions } from '@/hooks/useBillingSubscriptionActions';

export function PlansPage() {
  const { customer } = useCustomerAuth();
  const { activeWorkspaceId, role } = resolveActiveCustomerWorkspace(customer);
  const { summary, loadState, errorMessage, loadSummary, reload } =
    useWorkspaceBillingSummary(activeWorkspaceId);
  const checkout = useBillingCheckout(activeWorkspaceId);
  const [billingPeriod, setBillingPeriod] = useState<PlanBillingPeriod>('monthly');
  const [downgradeOpen, setDowngradeOpen] = useState(false);
  const isOwner = isWorkspaceOwnerRole(role);
  const checkoutEnabled = isBillingCheckoutConfigured(summary?.planCatalog);
  const subscriptionActions = useBillingSubscriptionActions(activeWorkspaceId, () => {
    void reload();
  });

  return (
    <>
      <SettingsPageHeader
        settingsRoute="/settings/plans"
        title="Plans"
        description="Choose the plan and add-ons that fit your workspace."
        icon={<Layers size={20} strokeWidth={1.75} aria-hidden className="shrink-0" />}
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <BillingPeriodToggle value={billingPeriod} onChange={setBillingPeriod} />
            <BillingUnavailableNotice role={role} variant="chip" checkoutEnabled={checkoutEnabled} />
          </div>
        }
      />

      <WorkspaceContentContainer size="editor" className="pt-0">
        {!activeWorkspaceId ? (
          <BillingEmptyWorkspaceCard />
        ) : loadState === 'loading' && !summary ? (
          <PlansPageSkeleton />
        ) : loadState === 'error' ? (
          <BillingErrorCard
            message={errorMessage ?? 'Could not load billing details.'}
            onRetry={() => void loadSummary()}
          />
        ) : summary ? (
          <div className="flex flex-col gap-10 pb-12">
            <PlansPricingCardsSection
              summary={summary}
              billingPeriod={billingPeriod}
              isOwner={isOwner}
              checkout={checkout}
              onDowngradeToStarter={() => setDowngradeOpen(true)}
              downgradeLoading={subscriptionActions.busy}
            />
            <BillingDowngradePlanModal
              open={downgradeOpen}
              onClose={() => setDowngradeOpen(false)}
              busy={subscriptionActions.busy}
              onConfirm={async () => {
                const ok = await subscriptionActions.changePlan('starter');
                if (ok) setDowngradeOpen(false);
              }}
            />
            <PlanFeatureComparisonSection summary={summary} />
            <AddonCatalogSection
              summary={summary}
              workspaceId={activeWorkspaceId!}
              isOwner={isOwner}
              checkout={checkout}
            />
          </div>
        ) : null}
      </WorkspaceContentContainer>
    </>
  );
}

export function SettingsBillingPage() {
  const { customer } = useCustomerAuth();
  const { activeWorkspaceId, role } = resolveActiveCustomerWorkspace(customer);
  const { summary, loadState, errorMessage, loadSummary, reload } =
    useWorkspaceBillingSummary(activeWorkspaceId);
  const checkoutEnabled = isBillingCheckoutConfigured(summary?.planCatalog);
  const canViewBillingDocuments = isWorkspaceManagerRole(role);
  const refreshing = loadState === 'loading' && summary != null;
  const handleSummaryUpdated = () => {
    void reload();
  };

  return (
    <>
      <SettingsPageHeader
        settingsRoute="/settings/billing"
        title="Billing & Invoices"
        description="Manage your subscription, payment method, invoices, and add-ons."
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
            <BillingCheckoutReturnBanner
              summary={summary}
              onRefreshBilling={() => void reload()}
              refreshing={refreshing}
            />
            <BillingUnavailableNotice role={role} checkoutEnabled={checkoutEnabled} />
            <BillingSubscriptionStatusAlerts summary={summary} />
            <BillingRestoreSubscriptionSection
              workspaceId={activeWorkspaceId}
              role={role ?? undefined}
              summary={summary}
              checkoutEnabled={checkoutEnabled}
              onSummaryUpdated={handleSummaryUpdated}
            />
            {!checkoutEnabled ? <BillingPaymentSetupNotice /> : null}
            <div
              className="grid gap-4 lg:grid-cols-2"
              data-testid="billing-plan-addons-row"
            >
              <BillingCurrentPlanSection summary={summary} compact />
              {checkoutEnabled ? (
                <BillingAddonsSection
                  workspaceId={activeWorkspaceId}
                  role={role ?? undefined}
                  summary={summary}
                  checkoutEnabled={checkoutEnabled}
                  onSummaryUpdated={handleSummaryUpdated}
                  compact
                />
              ) : null}
            </div>
            {checkoutEnabled ? (
              <>
                <BillingPaymentMethodSection
                  workspaceId={activeWorkspaceId}
                  role={role ?? undefined}
                  summary={summary}
                  checkoutEnabled={checkoutEnabled}
                />
                <BillingProfileCard
                  workspaceId={activeWorkspaceId}
                  canManage={canViewBillingDocuments}
                />
                <BillingInvoiceHistorySection
                  workspaceId={activeWorkspaceId}
                  canView={canViewBillingDocuments}
                />
                <BillingCancelSubscriptionSection
                  workspaceId={activeWorkspaceId}
                  role={role ?? undefined}
                  summary={summary}
                  checkoutEnabled={checkoutEnabled}
                  onSummaryUpdated={handleSummaryUpdated}
                />
              </>
            ) : (
              <BillingFutureSections />
            )}
          </div>
        ) : null}
      </WorkspaceContentContainer>
    </>
  );
}
