import type { WorkspaceBillingSummary } from "@/types/billing";
import { buildPlanComparisonTableGroups } from "@/lib/plans/billingPlanComparisonCopy";
import { BillingPlanCard } from "@/components/plans/BillingPlanCard";
import type { PlanBillingPeriod } from "@/lib/plans/planPricingCardDisplay";
import {
  BillingComparisonSection,
  BillingPlanComparisonTable,
} from "@/components/plans/BillingComparisonTable";
import { UsageAddonCard } from "@/components/plans/UsageAddonCard";
import { resolvePlanCardCheckoutAction } from "@/lib/plans/billingCheckout";
import { shouldShowPlanPricingCard } from "@/lib/plans/billingSubscriptionDisplay";
import {
  LANDING_PLANS_PAGE,
  landingPlanCardActionLabel,
  landingPlanCardButtonClassName,
} from "@/lib/plans/landing-plans-copy";

const MARKETING_PLAN_ORDER = ["free", "starter", "pro"] as const;

export function PlansPricingCardsSection(props: {
  summary: WorkspaceBillingSummary;
  billingPeriod?: PlanBillingPeriod;
  isOwner?: boolean;
  marketing?: boolean;
  onPlanAction?: (planKey: string) => void;
}) {
  const currentPlanKey = props.summary.plan?.key ?? "free";
  const isTrialPlan = props.summary.entitlements.isTrialPlan;
  const catalog = props.summary.planCatalog ?? [];
  const plans = props.marketing
    ? MARKETING_PLAN_ORDER.map((key) => catalog.find((plan) => plan.key === key)).filter(
        (plan): plan is NonNullable<typeof plan> => Boolean(plan),
      )
    : catalog.filter((plan) =>
        shouldShowPlanPricingCard({
          planKey: plan.key,
          currentPlanKey,
          isTrialPlan,
        }),
      );
  const billingPeriod = props.billingPeriod ?? "monthly";
  const hasCta = Boolean(props.onPlanAction);

  return (
    <section aria-label="Plans">
      <div className="grid gap-5 lg:grid-cols-3 lg:items-stretch">
        {plans.map((plan) => {
          const action = props.marketing
            ? {
                label: landingPlanCardActionLabel(plan.key),
                disabled: !hasCta,
              }
            : (() => {
                const resolved = resolvePlanCardCheckoutAction({
                  planKey: plan.key,
                  currentPlanKey,
                  isTrialPlan,
                  checkoutAvailable: plan.checkoutAvailable,
                  isOwner: props.isOwner ?? false,
                });
                return { label: resolved.label, disabled: resolved.disabled };
              })();

          return (
            <BillingPlanCard
              key={plan.key}
              plan={plan}
              isCurrent={!props.marketing && plan.key === currentPlanKey}
              billingPeriod={billingPeriod}
              actionLabel={action.label}
              actionDisabled={action.disabled}
              actionLoading={false}
              actionClassName={
                props.marketing
                  ? landingPlanCardButtonClassName(plan.key, !action.disabled)
                  : undefined
              }
              marketingAction={props.marketing}
              onAction={
                !action.disabled && props.onPlanAction
                  ? () => props.onPlanAction!(plan.key)
                  : undefined
              }
            />
          );
        })}
      </div>
    </section>
  );
}

export function PlanFeatureComparisonSection(props: {
  summary: WorkspaceBillingSummary;
  marketing?: boolean;
}) {
  const groups = buildPlanComparisonTableGroups(props.summary.planCatalog ?? []);

  return (
    <BillingComparisonSection
      id="plans-feature-comparison-heading"
      title={props.marketing ? LANDING_PLANS_PAGE.comparisonTitle : "What each plan includes"}
      subtitle={
        props.marketing
          ? LANDING_PLANS_PAGE.comparisonSubtitle
          : "Compare Free, Starter, and Pro at a glance."
      }
      align="center"
      compact
    >
      <BillingPlanComparisonTable
        groups={groups}
        planCatalog={props.summary.planCatalog ?? []}
        currentPlanKey={props.marketing ? null : props.summary.plan?.key}
      />
    </BillingComparisonSection>
  );
}

export function AddonCatalogSection(props: {
  summary: WorkspaceBillingSummary;
  isOwner?: boolean;
  marketing?: boolean;
}) {
  const addons = props.summary.addonCatalog ?? [];
  const currentPlanKey = props.summary.plan?.key;
  const addonsAllowed = props.summary.entitlements.addonsAllowed;

  return (
    <BillingComparisonSection
      id="plans-addons-heading"
      title={props.marketing ? LANDING_PLANS_PAGE.addonsTitle : "Add-ons"}
      subtitle={
        props.marketing ? LANDING_PLANS_PAGE.addonsSubtitle : "Add capacity when your workspace grows."
      }
      className="border-t border-slate-200/80 pt-10"
    >
      <div
        className={
          props.marketing ? "grid gap-4 sm:grid-cols-2" : "flex flex-col gap-3"
        }
      >
        {addons.map((addon) => (
          <UsageAddonCard
            key={addon.key}
            addon={addon}
            variant={props.marketing ? "marketing" : "plans"}
            currentPlanKey={currentPlanKey}
            isOwner={props.isOwner}
            addonsAllowed={addonsAllowed}
          />
        ))}
      </div>
    </BillingComparisonSection>
  );
}
