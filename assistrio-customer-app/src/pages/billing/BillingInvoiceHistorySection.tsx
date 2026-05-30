import { useEffect, useState } from 'react';
import { FileText, Download } from 'lucide-react';
import type { WorkspaceBillingInvoiceRow } from '@/api/types';
import { getWorkspaceBillingInvoices } from '@/api/customerApi';
import { BillingInvoiceDetailsModal } from '@/components/billing/BillingInvoiceDetailsModal';
import { Button } from '@/components/ui';
import { SettingsInfoCard } from '@/components/settings/SettingsInfoCard';
import { useCustomerAuth } from '@/auth/CustomerAuthContext';
import { useBillingHistoryDownload } from '@/hooks/useBillingHistoryDownload';
import { useBillingInvoiceDownload } from '@/hooks/useBillingInvoiceDownload';
import { useWorkspaceBillingProfile } from '@/hooks/useWorkspaceBillingProfile';
import { billingInvoiceActionLabel } from '@/lib/billingInvoiceActionLabel';
import { resolveActiveCustomerWorkspace } from '@/lib/resolveActiveCustomerWorkspace';
import { formatUsagePeriodDate } from '@/pages/usage/usagePageFormat';

type Props = {
  workspaceId: string;
  canView: boolean;
};

function displayInvoiceAmount(row: WorkspaceBillingInvoiceRow): string {
  if (row.amountFormatted?.trim()) return row.amountFormatted;
  if (row.amountCents != null) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: row.currency || 'USD',
    }).format(row.amountCents / 100);
  }
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: row.currency || 'USD',
    }).format(row.amount);
  } catch {
    return `${row.amount} ${row.currency}`;
  }
}

function invoiceItemPrimaryLabel(row: WorkspaceBillingInvoiceRow): string {
  return row.itemName?.trim() || row.description?.trim() || 'Payment';
}

function invoiceItemSecondaryLabel(row: WorkspaceBillingInvoiceRow): string | null {
  const primary = invoiceItemPrimaryLabel(row);
  const description = row.description?.trim() ?? '';
  if (!description || description === primary) return null;
  return description;
}

export function BillingInvoiceHistorySection({ workspaceId, canView }: Props) {
  const { customer } = useCustomerAuth();
  const { workspace } = resolveActiveCustomerWorkspace(customer);
  const billingProfile = useWorkspaceBillingProfile(workspaceId, canView);
  const [invoices, setInvoices] = useState<WorkspaceBillingInvoiceRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const invoiceDownload = useBillingInvoiceDownload(workspaceId, {
    applyProfile: billingProfile.applyProfile,
    reloadProfile: billingProfile.reload,
    customerId: customer?.id,
  });
  const historyDownload = useBillingHistoryDownload(workspaceId);

  useEffect(() => {
    if (!canView || !workspaceId) {
      setInvoices(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void getWorkspaceBillingInvoices(workspaceId).then((result) => {
      if (cancelled) return;
      setLoading(false);
      if (!result.ok) {
        setError(result.error ?? 'Could not load invoices.');
        setInvoices([]);
        return;
      }
      setInvoices(result.data ?? []);
    });

    return () => {
      cancelled = true;
    };
  }, [workspaceId, canView]);

  if (!canView) return null;

  return (
    <>
      <SettingsInfoCard
        id="billing-invoices"
        icon={FileText}
        title="Billing history"
        description="Paid subscription invoices and one-time purchases."
        variant="default"
        action={
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={historyDownload.busy}
            onClick={() => void historyDownload.download()}
          >
            {historyDownload.busy ? 'Preparing…' : 'Download billing history'}
          </Button>
        }
      >
        {loading ? (
          <p className="m-0 text-sm text-slate-500">Loading invoices…</p>
        ) : error ? (
          <p className="m-0 text-sm text-amber-900">{error}</p>
        ) : invoices && invoices.length === 0 ? (
          <p className="m-0 text-sm text-slate-600">No invoices yet.</p>
        ) : (
          <div className="space-y-3">
            {invoiceDownload.error ? (
              <p className="m-0 text-sm text-amber-900">{invoiceDownload.error}</p>
            ) : null}
            <div className="overflow-x-auto rounded-xl border border-slate-200/80">
              <table className="min-w-full border-collapse text-left text-sm">
                <thead className="bg-slate-50/90 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Item</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">PDF</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/80 bg-white">
                  {(invoices ?? []).map((row) => {
                    const primary = invoiceItemPrimaryLabel(row);
                    const secondary = invoiceItemSecondaryLabel(row);
                    const actionLabel = billingInvoiceActionLabel(row);

                    return (
                      <tr key={row.id}>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                          {formatUsagePeriodDate(row.date)}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          <div className="font-medium text-slate-900">{primary}</div>
                          {secondary ? (
                            <div className="mt-0.5 text-xs text-slate-500">{secondary}</div>
                          ) : null}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">
                          {displayInvoiceAmount(row)}
                        </td>
                        <td className="px-4 py-3 capitalize text-slate-600">{row.status}</td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 font-medium text-teal-800 hover:text-teal-900 disabled:opacity-60"
                            disabled={invoiceDownload.busy}
                            onClick={() => void invoiceDownload.download(row.id)}
                          >
                            {actionLabel}
                            <Download size={14} aria-hidden />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </SettingsInfoCard>

      <BillingInvoiceDetailsModal
        open={invoiceDownload.detailsModalOpen}
        busy={invoiceDownload.busy}
        savedProfile={billingProfile.profile}
        workspaceName={workspace?.name?.trim() || 'Workspace'}
        customerEmail={customer?.email}
        onClose={invoiceDownload.closeDetailsModal}
        onSubmit={(details) => void invoiceDownload.submitDetails(details)}
      />
    </>
  );
}
