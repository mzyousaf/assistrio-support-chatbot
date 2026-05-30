import { useEffect, useState } from 'react';
import { Button } from '@/components/ui';
import type { WorkspaceBillingProfile, WorkspaceBillingProfileInput } from '@/api/types';
import { BillingProfileFormFields } from '@/components/billing/BillingProfileFormFields';
import { profileToBillingForm } from '@/lib/billingProfileFormDefaults';

type Props = {
  open: boolean;
  busy?: boolean;
  initialProfile?: WorkspaceBillingProfile | null;
  workspaceName?: string;
  customerEmail?: string;
  onClose: () => void;
  onSubmit: (input: WorkspaceBillingProfileInput) => void;
};

export function BillingProfileEditModal({
  open,
  busy = false,
  initialProfile,
  workspaceName,
  customerEmail,
  onClose,
  onSubmit,
}: Props) {
  const [form, setForm] = useState<WorkspaceBillingProfileInput>(profileToBillingForm(initialProfile));

  useEffect(() => {
    if (!open) return;
    if (initialProfile) {
      setForm(profileToBillingForm(initialProfile));
      return;
    }
    setForm({
      ...profileToBillingForm(null),
      name: String(workspaceName ?? '').trim(),
      email: String(customerEmail ?? '').trim(),
    });
  }, [customerEmail, initialProfile, open, workspaceName]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-900/40 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="billing-profile-edit-title"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="billing-profile-edit-title" className="m-0 text-lg font-semibold text-slate-900">
          Billing details
        </h2>
        <p className="m-0 mt-2 text-sm text-slate-600">
          These details are used when generating invoices for one-time purchases and credit top-ups.
        </p>

        <form
          className="mt-5 grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit({
              ...form,
              country: form.country.trim().toUpperCase(),
            });
          }}
        >
          <BillingProfileFormFields form={form} onChange={setForm} idPrefix="billing-profile-edit" />

          <div className="mt-2 flex flex-wrap justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={busy}>
              {busy ? 'Saving…' : 'Save billing details'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
