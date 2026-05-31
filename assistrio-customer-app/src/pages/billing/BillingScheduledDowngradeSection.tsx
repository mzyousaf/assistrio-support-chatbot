import type { WorkspaceBillingSummary } from '@/api/types';
import { Button } from '@/components/ui';
import { useBillingSubscriptionActions } from '@/hooks/useBillingSubscriptionActions';
import { isWorkspaceOwnerRole } from '@/lib/workspaceRoles';
import {
  formatScheduledDowngradeMessage,
  hasScheduledPlanDowngrade,
} from '@/pages/billing/billingSubscriptionDisplay';

type Props = {
  workspaceId: string;
  role: string | undefined;
  summary: WorkspaceBillingSummary;
  checkoutEnabled: boolean;
  onSummaryUpdated: () => void;
};

export function BillingScheduledDowngradeSection(props: Props) {
  const actions = useBillingSubscriptionActions(props.workspaceId, () => {
    props.onSummaryUpdated();
  });

  const isOwner = isWorkspaceOwnerRole(props.role);
  const message = formatScheduledDowngradeMessage(props.summary);
  const show =
    props.checkoutEnabled && isOwner && hasScheduledPlanDowngrade(props.summary) && message != null;

  if (!show) return null;

  return (
    <section
      aria-labelledby="billing-scheduled-downgrade-heading"
      className="rounded-xl border border-amber-200/80 bg-amber-50/60 px-4 py-4"
    >
      <p id="billing-scheduled-downgrade-heading" className="m-0 text-sm leading-relaxed text-amber-950">
        {message}
      </p>
      <div className="mt-3">
        <Button
          type="button"
          variant="primary"
          size="sm"
          disabled={actions.busy}
          onClick={() => void actions.cancelScheduledDowngrade()}
        >
          Keep Pro plan
        </Button>
      </div>
    </section>
  );
}
