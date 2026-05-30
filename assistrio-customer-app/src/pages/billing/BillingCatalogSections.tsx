import { useCallback } from 'react';
import type { WorkspaceBillingSummary } from '@/api/types';
import { buildPlanComparisonTableGroups } from '@/pages/billing/billingPlanComparisonCopy';
import { BillingPlanCard } from '@/pages/billing/BillingPlanCard';
import type { PlanBillingPeriod } from '@/pages/billing/planPricingCardDisplay';
import {
  BillingComparisonSection,
  BillingPlanComparisonTable,
} from '@/pages/billing/BillingComparisonTable';
import { UsageAddonCard } from '@/pages/usage/UsageAddonCard';
import {
  isTopUpAddonKey,
  resolvePlanCardCheckoutAction,
} from '@/lib/billingCheckout';
import { shouldShowPlanPricingCard } from '@/pages/billing/billingSubscriptionDisplay';
import type { PaidPlanCheckoutKey } from '@/lib/billingCheckout';
import type { useBillingCheckout } from '@/hooks/useBillingCheckout';

type CheckoutApi = Pick<
  ReturnType<typeof useBillingCheckout>,
  | 'startPlanCheckout'
  | 'startAddonCheckout'
  | 'startTopUpCheckout'
  | 'isPlanLoading'
  | 'isAddonLoading'
>;

export function PlansPricingCardsSection(props: {
  summary: WorkspaceBillingSummary;
  billingPeriod?: PlanBillingPeriod;
  isOwner: boolean;
  checkout: CheckoutApi;
  onDowngradeToStarter?: () => void;
  downgradeLoading?: boolean;
}) {
  const currentPlanKey = props.summary.plan?.key ?? 'free';
  const isTrialPlan = props.summary.entitlements.isTrialPlan;
  const plans = (props.summary.planCatalog ?? []).filter((plan) =>
    shouldShowPlanPricingCard({
      planKey: plan.key,
      currentPlanKey,
      isTrialPlan,
    }),
  );
  const billingPeriod = props.billingPeriod ?? 'monthly';

  return (
    <section aria-label="Plans">
      <div className="grid gap-5 lg:grid-cols-3 lg:items-stretch">
        {plans.map((plan) => {
          const action = resolvePlanCardCheckoutAction({
            planKey: plan.key,
            currentPlanKey,
            isTrialPlan,
            checkoutAvailable: plan.checkoutAvailable,
            isOwner: props.isOwner,
          });
          const loading =
            action.canChangePlan && plan.key === 'starter'
              ? Boolean(props.downgradeLoading)
              : props.checkout.isPlanLoading(plan.key);

          return (
            <BillingPlanCard
              key={plan.key}
              plan={plan}
              isCurrent={plan.key === currentPlanKey}
              billingPeriod={billingPeriod}
              actionLabel={action.label}
              actionDisabled={action.disabled}
              actionLoading={loading}
              onAction={
                action.canChangePlan && plan.key === 'starter'
                  ? props.onDowngradeToStarter
                  : action.canCheckout && (plan.key === 'starter' || plan.key === 'pro')
                    ? () => void props.checkout.startPlanCheckout(plan.key as PaidPlanCheckoutKey)
                    : undefined
              }
            />
          );
        })}
      </div>
    </section>
  );
}

export function PlanFeatureComparisonSection(props: { summary: WorkspaceBillingSummary }) {
  const groups = buildPlanComparisonTableGroups(props.summary.planCatalog ?? []);

  return (
    <BillingComparisonSection
      id="plans-feature-comparison-heading"
      title="What each plan includes"
      subtitle="Compare Free, Starter, and Pro at a glance."
      align="center"
      compact
    >
      <BillingPlanComparisonTable
        groups={groups}
        planCatalog={props.summary.planCatalog ?? []}
        currentPlanKey={props.summary.plan?.key}
      />
    </BillingComparisonSection>
  );
}

export function AddonCatalogSection(props: {
  summary: WorkspaceBillingSummary;
  workspaceId: string;
  isOwner: boolean;
  checkout: CheckoutApi;
}) {
  const addons = props.summary.addonCatalog ?? [];
  const currentPlanKey = props.summary.plan?.key;
  const addonsAllowed = props.summary.entitlements.addonsAllowed;

  const handleAddonPurchase = useCallback(
    async (addonKey: string) => {
      if (isTopUpAddonKey(addonKey)) {
        await props.checkout.startTopUpCheckout('ai_credits_1000');
        return;
      }

      await props.checkout.startAddonCheckout(addonKey);
    },
    [props.checkout],
  );

  return (
    <BillingComparisonSection
      id="plans-addons-heading"
      title="Add-ons"
      subtitle="Add capacity when your workspace grows."
      className="border-t border-slate-200/80 pt-10"
    >
      <div className="flex flex-col gap-3">
        {addons.map((addon) => (
          <UsageAddonCard
            key={addon.key}
            addon={addon}
            variant="plans"
            currentPlanKey={currentPlanKey}
            isOwner={props.isOwner}
            addonsAllowed={addonsAllowed}
            checkoutLoading={props.checkout.isAddonLoading(addon.key)}
            onPurchase={
              props.isOwner && addon.checkoutAvailable && addonsAllowed
                ? () => void handleAddonPurchase(addon.key)
                : undefined
            }
          />
        ))}
      </div>
    </BillingComparisonSection>
  );
}

/** @deprecated Use PlansPricingCardsSection instead. */
export function PlanCatalogSection(props: {
  summary: WorkspaceBillingSummary;
  isOwner: boolean;
  checkout: CheckoutApi;
}) {
  return <PlansPricingCardsSection summary={props.summary} isOwner={props.isOwner} checkout={props.checkout} />;
}

/** @deprecated Use PlansPricingCardsSection instead. */
export function PlanComparisonSection(props: {
  summary: WorkspaceBillingSummary;
  isOwner: boolean;
  checkout: CheckoutApi;
}) {
  return <PlansPricingCardsSection summary={props.summary} isOwner={props.isOwner} checkout={props.checkout} />;
}
