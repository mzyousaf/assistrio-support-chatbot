import type { WorkspaceBillingSummary } from '@/api/types';
import { Button } from '@/components/ui';
import { useBillingPortal } from '@/hooks/useBillingPortal';
import { isWorkspaceOwnerRole } from '@/lib/workspaceRoles';

type Props = {
  workspaceId: string;
  role: string | undefined;
  summary: WorkspaceBillingSummary;
  checkoutEnabled: boolean;
};

export function BillingPaymentMethodSection({ workspaceId, role, summary, checkoutEnabled }: Props) {
  const portal = useBillingPortal(workspaceId);

  const portalAvailable =
    checkoutEnabled &&
    isWorkspaceOwnerRole(role) &&
    (summary.subscription.customerPortalAvailable || summary.subscription.manageBillingAvailable);

  return (
    <section
      id="billing-manage-payments"
      aria-labelledby="billing-manage-payments-heading"
      className="rounded-2xl border border-slate-200/90 bg-white shadow-[var(--shadow-card)]"
    >
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <h2
              id="billing-manage-payments-heading"
              className="m-0 text-base font-semibold tracking-tight text-slate-900"
            >
              Payment method
            </h2>
            <p className="m-0 mt-1 text-sm text-slate-500">
              Manage your saved payment method through Lemon Squeezy.
            </p>
          </div>
        </div>

        {portalAvailable ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={portal.loading}
            className="shrink-0 self-start sm:self-center"
            onClick={() => void portal.openPortal()}
          >
            {portal.loading ? 'Opening…' : 'Manage in Lemon Squeezy'}
          </Button>
        ) : null}
      </div>
    </section>
  );
}
