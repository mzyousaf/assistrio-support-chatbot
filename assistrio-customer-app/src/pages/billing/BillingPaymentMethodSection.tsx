import { CreditCard } from 'lucide-react';
import type { WorkspaceBillingSummary } from '@/api/types';
import { Button } from '@/components/ui';
import { SettingsInfoCard } from '@/components/settings/SettingsInfoCard';
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
  const method = summary.subscription.paymentMethod;
  const label =
    method?.label?.trim() ||
    (method?.brand && method?.last4
      ? `${method.brand} ending in ${method.last4}`
      : null);

  const portalAvailable =
    checkoutEnabled &&
    isWorkspaceOwnerRole(role) &&
    (summary.subscription.customerPortalAvailable || summary.subscription.manageBillingAvailable);

  return (
    <SettingsInfoCard
      id="billing-manage-payments"
      icon={CreditCard}
      title="Manage payments"
      description="Update payment method and payment details securely in Lemon Squeezy."
      action={
        portalAvailable ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={portal.loading}
            onClick={() => void portal.openPortal()}
          >
            {portal.loading ? 'Opening…' : 'Manage in Lemon Squeezy'}
          </Button>
        ) : undefined
      }
    >
      {label ? (
        <div className="space-y-1 text-sm text-slate-700">
          <p className="m-0 font-medium text-slate-900">{label}</p>
          <p className="m-0 text-slate-500">Stored securely by Lemon Squeezy</p>
        </div>
      ) : (
        <p className="m-0 text-sm text-slate-600">
          Payment method details will appear after your first paid invoice.
        </p>
      )}
    </SettingsInfoCard>
  );
}
