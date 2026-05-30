import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui';
import type {
  BillingInvoiceDownloadDetails,
  WorkspaceBillingProfile,
  WorkspaceBillingProfileInput,
} from '@/api/types';
import {
  BillingProfileFormFields,
} from '@/components/billing/BillingProfileFormFields';
import { buildInvoiceModalFormDefaults } from '@/lib/billingProfileFormDefaults';

type Props = {
  open: boolean;
  busy?: boolean;
  savedProfile?: WorkspaceBillingProfile | null;
  workspaceName?: string;
  customerEmail?: string;
  onClose: () => void;
  onSubmit: (details: BillingInvoiceDownloadDetails) => void;
};

export function BillingInvoiceDetailsModal({
  open,
  busy = false,
  savedProfile,
  workspaceName,
  customerEmail,
  onClose,
  onSubmit,
}: Props) {
  const [form, setForm] = useState<WorkspaceBillingProfileInput>(buildInvoiceModalFormDefaults({}));
  const [saveForFuture, setSaveForFuture] = useState(true);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setForm(
        buildInvoiceModalFormDefaults({
          savedProfile,
          workspaceName,
          customerEmail,
        }),
      );
      setSaveForFuture(!savedProfile);
    }
    wasOpenRef.current = open;
  }, [customerEmail, open, savedProfile, workspaceName]);

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
        aria-labelledby="billing-invoice-details-title"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="billing-invoice-details-title" className="m-0 text-lg font-semibold text-slate-900">
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
              name: form.name,
              address: form.address,
              city: form.city,
              state: form.state,
              zipCode: form.zipCode,
              country: form.country.trim().toUpperCase(),
              email: form.email?.trim() || undefined,
              taxId: form.taxId?.trim() || undefined,
              notes: form.notes?.trim() || undefined,
              saveProfile: saveForFuture,
            });
          }}
        >
          <BillingProfileFormFields form={form} onChange={setForm} idPrefix="billing-invoice-details" />

          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className="mt-1"
              checked={saveForFuture}
              onChange={(event) => setSaveForFuture(event.target.checked)}
            />
            <span>Save these billing details for future invoices</span>
          </label>

          <div className="mt-2 flex flex-wrap justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={busy}>
              {busy ? 'Generating…' : 'Download PDF'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
