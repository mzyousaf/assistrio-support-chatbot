import { useState } from 'react';
import { Building2 } from 'lucide-react';
import { BillingProfileEditModal } from '@/components/billing/BillingProfileEditModal';
import { Button } from '@/components/ui';
import { SettingsInfoCard } from '@/components/settings/SettingsInfoCard';
import { useCustomerAuth } from '@/auth/CustomerAuthContext';
import { useWorkspaceBillingProfile } from '@/hooks/useWorkspaceBillingProfile';
import { formatBillingProfileLines } from '@/lib/billingProfileDisplay';
import { resolveActiveCustomerWorkspace } from '@/lib/resolveActiveCustomerWorkspace';
import { appToast } from '@/lib/app-toast';

type Props = {
  workspaceId: string;
  canManage: boolean;
  cardId?: string;
};

export function BillingProfileCard({ workspaceId, canManage, cardId = 'billing-profile' }: Props) {
  const { customer } = useCustomerAuth();
  const { workspace } = resolveActiveCustomerWorkspace(customer);
  const billingProfile = useWorkspaceBillingProfile(workspaceId, canManage);
  const [modalOpen, setModalOpen] = useState(false);

  if (!canManage) return null;

  const actionLabel = billingProfile.profile ? 'Edit billing details' : 'Add billing details';
  const workspaceName = workspace?.name?.trim() || 'Workspace';

  return (
    <>
      <SettingsInfoCard
        id={cardId}
        icon={Building2}
        title="Billing details"
        description="Used when generating invoices for one-time purchases and credit top-ups."
        variant="default"
        action={
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={billingProfile.loading || billingProfile.saving}
            onClick={() => setModalOpen(true)}
          >
            {actionLabel}
          </Button>
        }
      >
        {billingProfile.loading ? (
          <p className="m-0 text-sm text-slate-500">Loading billing details…</p>
        ) : billingProfile.error ? (
          <p className="m-0 text-sm text-amber-900">{billingProfile.error}</p>
        ) : billingProfile.profile ? (
          <div className="space-y-1 text-sm text-slate-700">
            {formatBillingProfileLines(billingProfile.profile).map((line) => (
              <p key={line} className="m-0">
                {line}
              </p>
            ))}
          </div>
        ) : (
          <p className="m-0 text-sm text-slate-600">No billing details saved</p>
        )}
      </SettingsInfoCard>

      <BillingProfileEditModal
        open={modalOpen}
        busy={billingProfile.saving}
        initialProfile={billingProfile.profile}
        workspaceName={workspaceName}
        customerEmail={customer?.email}
        onClose={() => {
          if (billingProfile.saving) return;
          setModalOpen(false);
        }}
        onSubmit={async (input) => {
          const result = await billingProfile.saveProfile(input);
          if (!result.ok) {
            appToast.error(result.error ?? 'Could not save billing details.');
            return;
          }
          appToast.success('Billing details saved.');
          setModalOpen(false);
        }}
      />
    </>
  );
}

/** @deprecated Use BillingProfileCard */
export const WorkspaceBillingProfileSection = BillingProfileCard;
