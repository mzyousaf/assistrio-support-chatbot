import { useState } from 'react';
import { Layers } from 'lucide-react';
import { useCustomerAuth } from '@/auth/CustomerAuthContext';
import { SettingsPageHeader } from '@/components/settings/SettingsPageHeader';
import { useWorkspaceBillingSummary } from '@/hooks/useWorkspaceBillingSummary';
import { WorkspaceContentContainer } from '@/layout/workspace-layout/WorkspaceContentContainer';
import { resolveActiveCustomerWorkspace } from '@/lib/resolveActiveCustomerWorkspace';
import {
  AddonCatalogSection,
  PlanFeatureComparisonSection,
  PlansPricingCardsSection,
} from '@/pages/billing/BillingCatalogSections';
import { BillingCurrentPlanHero } from '@/pages/billing/BillingCurrentPlanHero';
import { BillingFutureSections } from '@/pages/billing/BillingFutureSections';
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
import { BillingUsageSnapshot } from '@/pages/billing/BillingUsageSnapshot';

export function PlansPage() {
  const { customer } = useCustomerAuth();
  const { activeWorkspaceId, role } = resolveActiveCustomerWorkspace(customer);
  const { summary, loadState, errorMessage, loadSummary } = useWorkspaceBillingSummary(activeWorkspaceId);
  const [billingPeriod, setBillingPeriod] = useState<PlanBillingPeriod>('monthly');

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
            <BillingUnavailableNotice role={role} variant="chip" />
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
            <PlansPricingCardsSection summary={summary} billingPeriod={billingPeriod} />
            <PlanFeatureComparisonSection summary={summary} />
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
