import { useState, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Building2, FileText, MapPin, Pencil, Plus, Receipt } from 'lucide-react';
import type { WorkspaceBillingProfile } from '@/api/types';
import { BillingProfileEditModal } from '@/components/billing/BillingProfileEditModal';
import { Button } from '@/components/ui';
import { useCustomerAuth } from '@/auth/CustomerAuthContext';
import { useWorkspaceBillingProfile } from '@/hooks/useWorkspaceBillingProfile';
import {
  BILLING_PROFILE_PLACEHOLDERS,
  buildBillingProfileAddressLines,
} from '@/lib/billingProfileDisplay';
import { resolveActiveCustomerWorkspace } from '@/lib/resolveActiveCustomerWorkspace';
import { appToast } from '@/lib/app-toast';
import { cn } from '@/lib/utils';

type Props = {
  workspaceId: string;
  canManage: boolean;
  cardId?: string;
};

function isPlaceholderText(text: string): boolean {
  return Object.values(BILLING_PROFILE_PLACEHOLDERS).includes(
    text as (typeof BILLING_PROFILE_PLACEHOLDERS)[keyof typeof BILLING_PROFILE_PLACEHOLDERS],
  );
}

function BillingProfileIconSection(props: {
  icon: LucideIcon;
  label: string;
  children: ReactNode;
}) {
  const Icon = props.icon;

  return (
    <div className="border-t border-slate-200/70 pt-3">
      <div className="flex items-center gap-1.5">
        <Icon size={14} strokeWidth={1.75} className="shrink-0 text-slate-400" aria-hidden />
        <p className="m-0 text-[11px] font-medium uppercase tracking-wide text-slate-400">
          {props.label}
        </p>
      </div>
      <div className="mt-1.5 pl-5 text-sm leading-relaxed">{props.children}</div>
    </div>
  );
}

function BillingProfileDisplay(props: { profile: WorkspaceBillingProfile | null }) {
  const companyName = props.profile?.name?.trim() || BILLING_PROFILE_PLACEHOLDERS.companyName;
  const hasCompanyName = Boolean(props.profile?.name?.trim());
  const email = props.profile?.email?.trim() ?? '';
  const addressLines = buildBillingProfileAddressLines(props.profile);
  const taxId = props.profile?.taxId?.trim() || BILLING_PROFILE_PLACEHOLDERS.taxId;
  const notes = props.profile?.notes?.trim() || BILLING_PROFILE_PLACEHOLDERS.notes;

  return (
    <div className="rounded-lg border border-slate-200/60 bg-slate-50/30 p-3.5">
      <div className="flex flex-col gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <Building2
            size={16}
            strokeWidth={1.75}
            className="mt-0.5 shrink-0 text-slate-400"
            aria-hidden
          />
          <div className="min-w-0">
            <p
              className={cn(
                'm-0 text-sm',
                hasCompanyName ? 'font-medium text-slate-900' : 'text-slate-400',
              )}
            >
              {companyName}
            </p>
            {email ? <p className="m-0 mt-1 text-sm text-slate-500">{email}</p> : null}
          </div>
        </div>

        <BillingProfileIconSection icon={MapPin} label="Billing address">
          <address className="m-0 space-y-0.5 not-italic">
            {addressLines.map((line) => (
              <span
                key={line}
                className={cn('block', isPlaceholderText(line) ? 'text-slate-400' : 'text-slate-700')}
              >
                {line}
              </span>
            ))}
          </address>
        </BillingProfileIconSection>

        <BillingProfileIconSection icon={Receipt} label="Tax ID">
          <p className={cn('m-0', isPlaceholderText(taxId) ? 'text-slate-400' : 'text-slate-700')}>
            {taxId}
          </p>
        </BillingProfileIconSection>

        <BillingProfileIconSection icon={FileText} label="Notes">
          <p
            className={cn(
              'm-0 whitespace-pre-wrap',
              isPlaceholderText(notes) ? 'text-slate-400' : 'text-slate-700',
            )}
          >
            {notes}
          </p>
        </BillingProfileIconSection>
      </div>
    </div>
  );
}

function BillingProfileLoadingState() {
  return (
    <div
      className="rounded-lg border border-slate-200/60 bg-slate-50/30 p-3.5"
      aria-busy="true"
      aria-label="Loading billing details"
    >
      <div className="space-y-3">
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 h-4 w-4 animate-pulse rounded bg-slate-100" aria-hidden />
          <div className="h-4 w-40 animate-pulse rounded bg-slate-200/70" />
        </div>
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="space-y-2 border-t border-slate-200/70 pt-3">
            <div className="flex items-center gap-1.5">
              <div className="h-3.5 w-3.5 animate-pulse rounded bg-slate-100" aria-hidden />
              <div className="h-2.5 w-24 animate-pulse rounded bg-slate-100" />
            </div>
            <div className="h-3 w-full max-w-xs animate-pulse rounded bg-slate-100 pl-5" />
          </div>
        ))}
      </div>
    </div>
  );
}

function BillingProfileEmptyState() {
  return (
    <div className="space-y-3">
      <p className="m-0 text-sm text-slate-600">No billing details saved yet.</p>
      <BillingProfileDisplay profile={null} />
    </div>
  );
}

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
      <section
        id={cardId}
        aria-labelledby={`${cardId}-heading`}
        className="rounded-2xl border border-slate-200/90 bg-white shadow-[var(--shadow-card)]"
      >
        <div className="flex flex-col gap-4 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h2
                id={`${cardId}-heading`}
                className="m-0 text-base font-semibold tracking-tight text-slate-900"
              >
                Billing details
              </h2>
              <p className="m-0 mt-1 text-sm text-slate-500">
                Used for invoices and one-time purchases.
              </p>
            </div>
            <Button
              type="button"
              variant={billingProfile.profile ? 'secondary' : 'outlinePrimary'}
              size="sm"
              disabled={billingProfile.loading || billingProfile.saving}
              className="shrink-0 self-start"
              onClick={() => setModalOpen(true)}
            >
              {billingProfile.profile ? (
                <Pencil size={12} strokeWidth={2} className="shrink-0" aria-hidden />
              ) : (
                <Plus size={12} strokeWidth={2} className="shrink-0" aria-hidden />
              )}
              {actionLabel}
            </Button>
          </div>

          {billingProfile.loading ? (
            <BillingProfileLoadingState />
          ) : billingProfile.error ? (
            <p className="m-0 rounded-lg border border-amber-200/80 bg-amber-50/60 px-3 py-2.5 text-sm text-amber-900">
              {billingProfile.error}
            </p>
          ) : billingProfile.profile ? (
            <BillingProfileDisplay profile={billingProfile.profile} />
          ) : (
            <BillingProfileEmptyState />
          )}
        </div>
      </section>

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
