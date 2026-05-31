import { useCustomerAuth } from '@/auth/CustomerAuthContext';
import { SettingsPageHeader } from '@/components/settings/SettingsPageHeader';
import { useWorkspaceBillingSummary } from '@/hooks/useWorkspaceBillingSummary';
import { WorkspaceContentContainer } from '@/layout/workspace-layout/WorkspaceContentContainer';
import { isBillingCheckoutConfigured } from '@/lib/billingCheckout';
import { resolveActiveCustomerWorkspace } from '@/lib/resolveActiveCustomerWorkspace';
import { BILLING_SETTINGS_LABEL } from '@/lib/settingsNavigation';
import { isWorkspaceManagerRole } from '@/lib/workspaceRoles';
import { BillingSubscriptionOverviewSection } from '@/pages/billing/BillingSubscriptionOverviewSection';
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
import { BillingUnavailableNotice } from '@/pages/billing/BillingUnavailableNotice';
import { BillingCheckoutReturnBanner } from '@/pages/billing/BillingCheckoutReturnBanner';
import { BillingCancelSubscriptionSection } from '@/pages/billing/BillingCancelSubscriptionSection';
import { BillingRestoreSubscriptionSection } from '@/pages/billing/BillingRestoreSubscriptionSection';
import { BillingScheduledDowngradeSection } from '@/pages/billing/BillingScheduledDowngradeSection';
import { BillingSubscriptionStatusAlerts } from '@/pages/billing/BillingSubscriptionStatusAlerts';
import { BillingTrialAlerts } from '@/pages/billing/BillingTrialAlerts';

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
        title={BILLING_SETTINGS_LABEL}
        description="Manage your subscription, payment method, invoices, and add-ons."
      />

      <WorkspaceContentContainer size="editor" className="pt-0">
        {!activeWorkspaceId ? (
          <BillingEmptyWorkspaceCard />
        ) : loadState === 'loading' && !summary ? (
          <BillingPageSkeleton />
        ) : loadState === 'error' ? (
          <BillingErrorCard
            message={errorMessage ?? 'Could not load billing details.'}
            onRetry={() => void loadSummary()}
          />
        ) : summary ? (
          <div className="flex flex-col gap-5 pb-12">
            <BillingCheckoutReturnBanner
              summary={summary}
              onRefreshBilling={() => void reload()}
              refreshing={refreshing}
            />
            <BillingUnavailableNotice role={role} checkoutEnabled={checkoutEnabled} />
            <BillingSubscriptionStatusAlerts summary={summary} />
            <BillingTrialAlerts summary={summary} />
            <BillingRestoreSubscriptionSection
              workspaceId={activeWorkspaceId}
              role={role ?? undefined}
              summary={summary}
              checkoutEnabled={checkoutEnabled}
              onSummaryUpdated={handleSummaryUpdated}
            />
            <BillingScheduledDowngradeSection
              workspaceId={activeWorkspaceId}
              role={role ?? undefined}
              summary={summary}
              checkoutEnabled={checkoutEnabled}
              onSummaryUpdated={handleSummaryUpdated}
            />
            {!checkoutEnabled ? <BillingPaymentSetupNotice /> : null}
            <BillingSubscriptionOverviewSection
              workspaceId={activeWorkspaceId}
              role={role ?? undefined}
              summary={summary}
              checkoutEnabled={checkoutEnabled}
              onSummaryUpdated={handleSummaryUpdated}
            />
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
