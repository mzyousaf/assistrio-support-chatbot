import type { WorkspaceBillingSummary } from '@/api/types';
import { buildPlanComparisonTableGroups } from '@/pages/billing/billingPlanComparisonCopy';
import { BillingPlanCard } from '@/pages/billing/BillingPlanCard';
import type { PlanBillingPeriod } from '@/pages/billing/planPricingCardDisplay';
import {
  BillingComparisonSection,
  BillingPlanComparisonTable,
} from '@/pages/billing/BillingComparisonTable';
import { UsageAddonCard } from '@/pages/usage/UsageAddonCard';

export function PlansPricingCardsSection(props: {
  summary: WorkspaceBillingSummary;
  billingPeriod?: PlanBillingPeriod;
}) {
  const currentPlanKey = props.summary.plan?.key;
  const plans = props.summary.planCatalog ?? [];
  const billingPeriod = props.billingPeriod ?? 'monthly';

  return (
    <section aria-label="Plans">
      <div className="grid gap-5 lg:grid-cols-3 lg:items-stretch">
        {plans.map((plan) => (
          <BillingPlanCard
            key={plan.key}
            plan={plan}
            isCurrent={plan.key === currentPlanKey}
            billingPeriod={billingPeriod}
          />
        ))}
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

export function AddonCatalogSection(props: { summary: WorkspaceBillingSummary }) {
  const addons = props.summary.addonCatalog ?? [];

  return (
    <BillingComparisonSection
      id="plans-addons-heading"
      title="Add-ons"
      subtitle="Add capacity when your workspace grows."
      className="border-t border-slate-200/80 pt-10"
    >
      <div className="flex flex-col gap-3">
        {addons.map((addon) => (
          <UsageAddonCard key={addon.key} addon={addon} />
        ))}
      </div>
    </BillingComparisonSection>
  );
}

/** @deprecated Use PlansPricingCardsSection instead. */
export function PlanCatalogSection(props: { summary: WorkspaceBillingSummary }) {
  return <PlansPricingCardsSection summary={props.summary} />;
}

/** @deprecated Use PlansPricingCardsSection instead. */
export function PlanComparisonSection(props: { summary: WorkspaceBillingSummary }) {
  return <PlansPricingCardsSection summary={props.summary} />;
}
