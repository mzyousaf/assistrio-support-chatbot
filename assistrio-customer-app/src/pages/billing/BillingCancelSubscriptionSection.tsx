import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { WorkspaceBillingSummary } from '@/api/types';
import { Button } from '@/components/ui';
import { useBillingPortal } from '@/hooks/useBillingPortal';
import { useBillingSubscriptionActions } from '@/hooks/useBillingSubscriptionActions';
import { isWorkspaceOwnerRole } from '@/lib/workspaceRoles';
import { formatBillingRenewsOrEndsLabel } from '@/pages/billing/billingSubscriptionDisplay';
import { BillingBeforeCancelModal } from '@/pages/billing/BillingBeforeCancelModal';
import { BillingDowngradePlanModal } from '@/pages/billing/BillingDowngradePlanModal';

type Props = {
  workspaceId: string;
  role: string | undefined;
  summary: WorkspaceBillingSummary;
  checkoutEnabled: boolean;
  onSummaryUpdated: () => void;
};

function hasActivePaidPlanNotCanceling(summary: WorkspaceBillingSummary): boolean {
  const sub = summary.subscription;
  if (sub.cancelAtPeriodEnd) return false;
  return (
    summary.plan.key === 'starter' ||
    summary.plan.key === 'pro' ||
    sub.hasActivePaidSubscription
  );
}

export function BillingCancelSubscriptionSection(props: Props) {
  const [cancelOpen, setCancelOpen] = useState(false);
  const [downgradeOpen, setDowngradeOpen] = useState(false);
  const portal = useBillingPortal(props.workspaceId);
  const subscriptionActions = useBillingSubscriptionActions(props.workspaceId, () => {
    props.onSummaryUpdated();
  });

  const isOwner = isWorkspaceOwnerRole(props.role);
  const currentPlanKey = props.summary.plan.key;
  const portalAvailable =
    props.summary.subscription.customerPortalAvailable ||
    props.summary.subscription.manageBillingAvailable;
  const periodEndLabel = formatBillingRenewsOrEndsLabel(props.summary) ?? 'the end of your billing period';

  if (!props.checkoutEnabled || !isOwner || !hasActivePaidPlanNotCanceling(props.summary)) {
    return null;
  }

  const handleContinueToPortal = async () => {
    if (!portalAvailable) return;
    await portal.openPortal();
  };

  return (
    <section
      id="billing-cancel-subscription"
      aria-labelledby="billing-cancel-subscription-heading"
      data-testid="billing-cancel-subscription"
      className="rounded-2xl border border-red-200/70 bg-red-50/25 shadow-[var(--shadow-card)]"
    >
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:gap-5">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-100/80 text-red-800 ring-1 ring-red-200/80"
          aria-hidden
        >
          <AlertTriangle size={20} strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h2
                id="billing-cancel-subscription-heading"
                className="m-0 text-base font-semibold tracking-tight text-slate-900"
              >
                Cancel subscription
              </h2>
              <p className="m-0 mt-1 text-sm leading-relaxed text-slate-600">
                Your plan stays active until {periodEndLabel}. You can restore anytime before that
                date. Cancellation continues through Lemon Squeezy.
              </p>
            </div>
            <Button type="button" variant="danger" size="sm" onClick={() => setCancelOpen(true)}>
              Cancel subscription
            </Button>
          </div>
        </div>
      </div>

      <BillingBeforeCancelModal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        currentPlanKey={currentPlanKey}
        portalLoading={portal.loading}
        onContinueToPortal={handleContinueToPortal}
        onDowngradeToStarter={
          currentPlanKey === 'pro' ? () => setDowngradeOpen(true) : undefined
        }
      />

      <BillingDowngradePlanModal
        open={downgradeOpen}
        onClose={() => setDowngradeOpen(false)}
        busy={subscriptionActions.busy}
        onConfirm={async () => {
          const ok = await subscriptionActions.changePlan('starter');
          if (ok) {
            setDowngradeOpen(false);
            setCancelOpen(false);
          }
        }}
      />
    </section>
  );
}
