import { useEffect, useState } from 'react';
import { Download, ExternalLink } from 'lucide-react';
import type { WorkspaceBillingInvoiceRow } from '@/api/types';
import { getWorkspaceBillingInvoices } from '@/api/customerApi';
import { BillingInvoiceDetailsModal } from '@/components/billing/BillingInvoiceDetailsModal';
import { Button } from '@/components/ui';
import { useCustomerAuth } from '@/auth/CustomerAuthContext';
import { useBillingHistoryDownload } from '@/hooks/useBillingHistoryDownload';
import { useBillingInvoiceDownload } from '@/hooks/useBillingInvoiceDownload';
import { useWorkspaceBillingProfile } from '@/hooks/useWorkspaceBillingProfile';
import { resolveActiveCustomerWorkspace } from '@/lib/resolveActiveCustomerWorkspace';
import { formatCustomerFacingAgentText } from '@/lib/customerAgentTerminology';
import { formatUsagePeriodDate } from '@/pages/usage/usagePageFormat';
import { cn } from '@/lib/utils';

const INVOICE_TABLE_ACTION_LABEL = 'View Invoice';

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
  const raw = row.itemName?.trim() || row.description?.trim() || 'Payment';
  return formatCustomerFacingAgentText(raw);
}

function invoiceItemSecondaryLabel(row: WorkspaceBillingInvoiceRow): string | null {
  const primary = invoiceItemPrimaryLabel(row);
  const description = row.description?.trim() ?? '';
  if (!description || description === primary) return null;
  return formatCustomerFacingAgentText(description);
}

function InvoiceStatusTag(props: { status: string }) {
  const normalized = props.status.trim().toLowerCase();
  const isPaid = normalized === 'paid';

  return (
    <span
      className={cn(
        'inline-flex rounded px-1.5 py-0.5 text-[10px] ring-1',
        isPaid
          ? 'bg-emerald-50/60 text-emerald-700 ring-emerald-200/70'
          : 'bg-slate-50 text-slate-600 ring-slate-200/80',
      )}
    >
      {isPaid ? 'Paid' : props.status}
    </span>
  );
}

const invoiceTableClassName = 'min-w-[640px] w-full border-collapse text-left text-xs';

function InvoiceHistoryLoadingTable() {
  return (
    <table
      className={invoiceTableClassName}
      aria-busy="true"
      aria-label="Loading invoices"
    >
      <thead>
        <tr className="border-b border-slate-200/80 text-[10px] uppercase tracking-wide text-slate-400">
          <th className="py-1.5 pr-3 font-normal">Date</th>
          <th className="py-1.5 pr-3 font-normal">Item</th>
          <th className="py-1.5 pr-3 font-normal">Amount</th>
          <th className="py-1.5 pr-3 font-normal">Status</th>
          <th className="py-1.5 font-normal">Action</th>
        </tr>
      </thead>
      <tbody>
        {[0, 1, 2].map((index) => (
          <tr key={index} className="border-b border-slate-100 last:border-b-0">
            <td colSpan={5} className="py-2">
              <div className="h-3 animate-pulse rounded bg-slate-100" />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function InvoiceHistoryTable(props: {
  invoices: WorkspaceBillingInvoiceRow[];
  downloadBusy: boolean;
  onDownload: (invoiceId: string) => void;
}) {
  return (
    <table className={invoiceTableClassName}>
      <thead>
        <tr className="border-b border-slate-200/80 text-[10px] uppercase tracking-wide text-slate-400">
          <th className="py-1.5 pr-3 font-normal">Date</th>
          <th className="py-1.5 pr-3 font-normal">Item</th>
          <th className="py-1.5 pr-3 font-normal">Amount</th>
          <th className="py-1.5 pr-3 font-normal">Status</th>
          <th className="py-1.5 font-normal">Action</th>
        </tr>
      </thead>
      <tbody>
        {props.invoices.map((row) => {
          const primary = invoiceItemPrimaryLabel(row);
          const secondary = invoiceItemSecondaryLabel(row);

          return (
            <tr
              key={row.id}
              className="border-b border-slate-100 transition-colors last:border-b-0 hover:bg-slate-50/70"
            >
              <td className="whitespace-nowrap py-2 pr-3 tabular-nums text-[11px] text-slate-500">
                {formatUsagePeriodDate(row.date)}
              </td>
              <td className="py-2 pr-3">
                <p className="m-0 text-xs text-slate-900">{primary}</p>
                {secondary ? (
                  <p className="m-0 mt-0.5 text-[11px] leading-relaxed text-slate-500">{secondary}</p>
                ) : null}
              </td>
              <td className="whitespace-nowrap py-2 pr-3 text-xs tabular-nums text-slate-900">
                {displayInvoiceAmount(row)}
              </td>
              <td className="py-2 pr-3">
                <InvoiceStatusTag status={row.status} />
              </td>
              <td className="py-2">
                <button
                  type="button"
                  className="inline-flex cursor-pointer items-center gap-1 text-[11px] text-[var(--color-teal-700)] underline-offset-2 hover:text-[var(--color-teal-800)] hover:underline disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={props.downloadBusy}
                  onClick={() => props.onDownload(row.id)}
                >
                  <ExternalLink size={11} strokeWidth={2} className="shrink-0" aria-hidden />
                  {INVOICE_TABLE_ACTION_LABEL}
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
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

  const hasInvoices = Boolean(invoices && invoices.length > 0);

  return (
    <>
      <section
        id="billing-invoices"
        aria-labelledby="billing-invoices-heading"
        className={cn(
          'rounded-2xl border border-slate-200/90 bg-white shadow-[var(--shadow-card)]',
          hasInvoices && 'overflow-x-auto',
        )}
      >
        <div className="flex flex-col gap-4 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h2
                id="billing-invoices-heading"
                className="m-0 text-base font-semibold tracking-tight text-slate-900"
              >
                Billing history
              </h2>
              <p className="m-0 mt-1 text-sm text-slate-500">
                Paid subscription invoices and one-time purchases.
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={historyDownload.busy || loading || !hasInvoices}
              className="shrink-0 self-start"
              onClick={() => void historyDownload.download()}
            >
              <Download size={12} strokeWidth={2} className="shrink-0" aria-hidden />
              {historyDownload.busy ? 'Exporting…' : 'Export'}
            </Button>
          </div>

          {loading ? (
            <InvoiceHistoryLoadingTable />
          ) : error ? (
            <p className="m-0 rounded-lg border border-amber-200/80 bg-amber-50/60 px-3 py-2.5 text-sm text-amber-900">
              {error}
            </p>
          ) : !hasInvoices ? (
            <p className="m-0 rounded-lg border border-dashed border-slate-200/80 bg-slate-50/25 px-4 py-4 text-sm text-slate-600">
              No invoices yet.
            </p>
          ) : (
            <>
              {invoiceDownload.error ? (
                <p className="m-0 rounded-lg border border-amber-200/80 bg-amber-50/60 px-3 py-2.5 text-sm text-amber-900">
                  {invoiceDownload.error}
                </p>
              ) : null}
              <InvoiceHistoryTable
                invoices={invoices ?? []}
                downloadBusy={invoiceDownload.busy}
                onDownload={(invoiceId) => void invoiceDownload.download(invoiceId)}
              />
            </>
          )}
        </div>
      </section>

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
