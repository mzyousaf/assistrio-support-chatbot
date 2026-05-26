import type { WorkspaceBillingSummary } from '@/api/types';
import { BillingAddonCard } from '@/pages/billing/BillingAddonCard';
import { BillingPlanCard } from '@/pages/billing/BillingPlanCard';

export function PlanCatalogSection(props: { summary: WorkspaceBillingSummary }) {
  const currentPlanKey = props.summary.plan?.key;

  return (
    <section aria-labelledby="plans-catalog-heading" className="space-y-4">
      <div>
        <h2 id="plans-catalog-heading" className="m-0 text-base font-semibold text-slate-900">
          Compare plans
        </h2>
        <p className="m-0 mt-1 text-sm text-slate-500">Plan changes are not available yet.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {(props.summary.planCatalog ?? []).map((plan) => (
          <BillingPlanCard key={plan.key} plan={plan} isCurrent={plan.key === currentPlanKey} />
        ))}
      </div>
    </section>
  );
}

export function AddonCatalogSection(props: { summary: WorkspaceBillingSummary }) {
  return (
    <section aria-labelledby="plans-addons-heading" className="space-y-4">
      <div>
        <h2 id="plans-addons-heading" className="m-0 text-base font-semibold text-slate-900">
          Available add-ons
        </h2>
        <p className="m-0 mt-1 text-sm text-slate-500">Add-ons are not available yet.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {(props.summary.addonCatalog ?? []).map((addon) => (
          <BillingAddonCard key={addon.key} addon={addon} />
        ))}
      </div>
    </section>
  );
}
