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
import {
  formatPlanModalDaysLeftButtonLabel,
  formatPlanModalExpiresOnButtonLabel,
  shouldShowPlanPricingCard,
} from '@/pages/billing/billingSubscriptionDisplay';
import { resolveBillingPeriodEnd } from '@/pages/billing/billingSubscriptionOverviewDisplay';
import type { PaidPlanCheckoutKey } from '@/lib/billingCheckout';
import { isPlanCheckoutAvailableForPeriod } from '@/pages/billing/planPricingCardDisplay';
import type { useBillingCheckout } from '@/hooks/useBillingCheckout';
import { cn } from '@/lib/utils';
import {
  filterPlansForModal,
  isAllowedBillingAddonKey,
  type PlansModalMode,
} from '@/lib/planModalDisplay';

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
  onUpgradeToPro?: () => void;
  downgradeLoading?: boolean;
  upgradeLoading?: boolean;
  /** When true (e.g. PlansModal), merges “What each plan includes” into each card. */
  showCardIncludes?: boolean;
  /** Contextual plan filtering for modal surfaces. */
  mode?: PlansModalMode;
}) {
  const currentPlanKey = props.summary.plan?.key ?? 'free';
  const isTrialPlan = props.summary.entitlements.isTrialPlan;
  const basePlans = (props.summary.planCatalog ?? []).filter((plan) =>
    shouldShowPlanPricingCard({
      planKey: plan.key,
      currentPlanKey,
      isTrialPlan,
    }),
  );
  const plans = props.mode
    ? filterPlansForModal(basePlans, {
        mode: props.mode,
        currentPlanKey,
        isTrialPlan,
      })
    : basePlans;
  const billingPeriod = props.billingPeriod ?? 'monthly';

  const showModalLayout = Boolean(props.showCardIncludes);
  const billingPeriodEnd = resolveBillingPeriodEnd(props.summary);
  const singlePlanLayout = showModalLayout && plans.length === 1;

  return (
    <section aria-label="Plans">
      <div
        className={cn(
          showModalLayout
            ? cn(
                'grid w-full grid-cols-1 items-stretch gap-5',
                singlePlanLayout ? 'max-w-md mx-auto' : 'sm:grid-cols-2',
              )
            : 'grid gap-5 lg:grid-cols-3 lg:items-stretch',
        )}
      >
        {plans.map((plan) => {
          const action = resolvePlanCardCheckoutAction({
            planKey: plan.key,
            currentPlanKey,
            isTrialPlan,
            checkoutAvailable: isPlanCheckoutAvailableForPeriod(plan, billingPeriod),
            isOwner: props.isOwner,
          });
          const loading =
            action.canChangePlan && plan.key === 'starter'
              ? Boolean(props.downgradeLoading)
              : action.canChangePlan && plan.key === 'pro'
                ? Boolean(props.upgradeLoading)
                : props.checkout.isPlanLoading(plan.key);

          const isCurrent = plan.key === currentPlanKey;
          const modalExpiresOnButtonLabel =
            showModalLayout && isTrialPlan && plan.key === 'free'
              ? formatPlanModalExpiresOnButtonLabel(props.summary)
              : null;
          const modalDaysLeftButtonLabel =
            showModalLayout && isCurrent
              ? formatPlanModalDaysLeftButtonLabel(billingPeriodEnd)
              : null;

          const card = (
            <BillingPlanCard
              plan={plan}
              isCurrent={isCurrent}
              billingPeriod={billingPeriod}
              variant={showModalLayout ? 'modal' : 'page'}
              planCatalog={
                showModalLayout ? (props.summary.planCatalog ?? []) : undefined
              }
              modalExpiresOnButtonLabel={modalExpiresOnButtonLabel}
              modalDaysLeftButtonLabel={modalDaysLeftButtonLabel}
              actionLabel={action.label}
              actionDisabled={action.disabled}
              actionLoading={loading}
              onAction={
                action.canChangePlan && plan.key === 'starter'
                  ? props.onDowngradeToStarter
                  : action.canChangePlan && plan.key === 'pro'
                    ? props.onUpgradeToPro
                    : action.canCheckout && (plan.key === 'starter' || plan.key === 'pro')
                      ? () =>
                          void props.checkout.startPlanCheckout(
                            plan.key as PaidPlanCheckoutKey,
                            billingPeriod,
                          )
                      : undefined
              }
            />
          );

          if (showModalLayout) {
            return (
              <div
                key={plan.key}
                className="min-w-0 w-full"
              >
                {card}
              </div>
            );
          }

          return (
            <div key={plan.key}>
              {card}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function PlanFeatureComparisonSection(props: { summary: WorkspaceBillingSummary }) {
  const currentPlanKey = props.summary.plan?.key ?? 'free';
  const visibleCatalog = (props.summary.planCatalog ?? []).filter((plan) =>
    shouldShowPlanPricingCard({
      planKey: plan.key,
      currentPlanKey,
      isTrialPlan: props.summary.entitlements.isTrialPlan,
    }),
  );
  const groups = buildPlanComparisonTableGroups(visibleCatalog);

  return (
    <BillingComparisonSection
      id="plans-feature-comparison-heading"
      title="What each plan includes"
      subtitle="Compare plans at a glance."
      align="center"
      compact
    >
      <BillingPlanComparisonTable
        groups={groups}
        planCatalog={visibleCatalog}
        currentPlanKey={currentPlanKey}
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
  const addons = (props.summary.addonCatalog ?? []).filter((addon) =>
    isAllowedBillingAddonKey(addon.key),
  );
  const currentPlanKey = props.summary.plan?.key;
  const addonsAllowed = props.summary.entitlements.addonsAllowed;

  const handleAddonPurchase = useCallback(
    async (addonKey: string, billingPeriod: PlanBillingPeriod = 'monthly') => {
      if (isTopUpAddonKey(addonKey)) {
        await props.checkout.startTopUpCheckout('ai_credits_1000');
        return;
      }

      await props.checkout.startAddonCheckout(addonKey, undefined, billingPeriod);
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
