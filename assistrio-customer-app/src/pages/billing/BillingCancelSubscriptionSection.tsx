import { useState } from 'react';
import type { WorkspaceBillingSummary } from '@/api/types';
import { Button } from '@/components/ui';
import { useBillingPortal } from '@/hooks/useBillingPortal';
import { useBillingSubscriptionActions } from '@/hooks/useBillingSubscriptionActions';
import { isWorkspaceOwnerRole } from '@/lib/workspaceRoles';
import { BillingBeforeCancelModal } from '@/pages/billing/BillingBeforeCancelModal';
import { BillingDowngradePlanModal } from '@/pages/billing/BillingDowngradePlanModal';
import { formatUsagePeriodDate } from '@/pages/usage/usagePageFormat';

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

function formatCancelRenewalDate(summary: WorkspaceBillingSummary): string {
  const end = summary.subscription?.currentPeriodEnd ?? summary.plan.currentPeriodEnd;
  if (!end) return 'the end of your billing period';
  return formatUsagePeriodDate(end);
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
  const renewalDate = formatCancelRenewalDate(props.summary);

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
      className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[var(--shadow-card)]"
    >
      <div className="border-l-[3px] border-l-rose-300/90 bg-gradient-to-r from-rose-50/35 via-white to-white">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 space-y-1">
            <h2
              id="billing-cancel-subscription-heading"
              className="m-0 text-base font-semibold tracking-tight text-slate-900"
            >
              Cancel subscription
            </h2>
            <p className="m-0 max-w-prose text-sm leading-relaxed text-slate-500">
              Your plan stays active until {renewalDate}. You can restore it before that date.
            </p>
          </div>
          <Button
            type="button"
            variant="secondaryDanger"
            size="sm"
            className="shrink-0 self-start sm:self-center"
            onClick={() => setCancelOpen(true)}
          >
            Cancel subscription
          </Button>
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
