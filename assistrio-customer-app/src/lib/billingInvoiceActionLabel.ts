import type { WorkspaceBillingInvoiceRow } from '@/api/types';

export function billingInvoiceActionLabel(row: WorkspaceBillingInvoiceRow): string {
  if (row.invoiceDeliveryMode === 'provider_url') return 'Open invoice';
  return 'Download PDF';
}
