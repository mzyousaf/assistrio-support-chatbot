import { useState } from 'react';
import type { WorkspaceBillingSummary } from '@/api/types';
import { Button } from '@/components/ui';
import { useBillingSubscriptionActions } from '@/hooks/useBillingSubscriptionActions';
import { isWorkspaceOwnerRole } from '@/lib/workspaceRoles';
import {
  canRestoreSubscription,
  formatCancelAtPeriodEndMessage,
} from '@/pages/billing/billingSubscriptionDisplay';
import { BillingRestoreConfirmModal } from '@/pages/billing/BillingRestoreConfirmModal';

type Props = {
  workspaceId: string;
  role: string | undefined;
  summary: WorkspaceBillingSummary;
  checkoutEnabled: boolean;
  onSummaryUpdated: () => void;
};

export function BillingRestoreSubscriptionSection(props: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const actions = useBillingSubscriptionActions(props.workspaceId, () => {
    props.onSummaryUpdated();
  });

  const isOwner = isWorkspaceOwnerRole(props.role);
  const message = formatCancelAtPeriodEndMessage(props.summary);
  const showRestore =
    props.checkoutEnabled && isOwner && canRestoreSubscription(props.summary) && message != null;

  if (!showRestore) return null;

  const handleConfirm = async () => {
    const ok = await actions.restoreSubscription();
    if (ok) setConfirmOpen(false);
  };

  return (
    <section
      aria-labelledby="billing-restore-subscription-heading"
      className="rounded-xl border border-amber-200/80 bg-amber-50/60 px-4 py-4"
    >
      <p id="billing-restore-subscription-heading" className="m-0 text-sm leading-relaxed text-amber-950">
        {message}
      </p>
      <div className="mt-3">
        <Button
          type="button"
          variant="primary"
          size="sm"
          disabled={actions.busy}
          onClick={() => setConfirmOpen(true)}
        >
          Restore subscription
        </Button>
      </div>

      <BillingRestoreConfirmModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        busy={actions.busy}
        onConfirm={handleConfirm}
      />
    </section>
  );
}
