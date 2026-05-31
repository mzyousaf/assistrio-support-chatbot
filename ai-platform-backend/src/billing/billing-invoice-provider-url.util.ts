import { isLikelyOrderInvoicePdfUrl } from './billing-invoice-pdf.util';
import type { ProviderInvoiceRow } from './billing-invoice.types';

export type ProviderHostedInvoiceUrl = {
  url: string;
  source: string;
};

function firstNonEmptyUrl(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    const trimmed = String(value ?? '').trim();
    if (trimmed) return trimmed;
  }
  return null;
}

/** Lemon hosted invoice/receipt page — not a direct PDF download link. */
export function resolveProviderHostedInvoiceUrl(
  row: Pick<ProviderInvoiceRow, 'invoiceUrl' | 'receiptUrl' | 'source'>,
): ProviderHostedInvoiceUrl | null {
  const url = firstNonEmptyUrl(row.invoiceUrl, row.receiptUrl);
  if (!url || isLikelyOrderInvoicePdfUrl(url)) return null;

  return {
    url,
    source: row.source ?? 'lemon_subscription_invoice',
  };
}

/** Direct PDF download URL from the billing provider, when available. */
export function resolveProviderDirectPdfUrl(
  row: Pick<ProviderInvoiceRow, 'invoiceUrl' | 'receiptUrl'>,
): string | null {
  const url = firstNonEmptyUrl(row.invoiceUrl, row.receiptUrl);
  if (!url || !isLikelyOrderInvoicePdfUrl(url)) return null;
  return url;
}

/** Lemon order invoice PDF — never use receipt HTML pages. */
export function resolveOrderDirectPdfUrl(
  row: Pick<ProviderInvoiceRow, 'invoiceUrl' | 'receiptUrl'>,
): string | null {
  const invoiceUrl = String(row.invoiceUrl ?? '').trim();
  if (invoiceUrl && isLikelyOrderInvoicePdfUrl(invoiceUrl)) return invoiceUrl;
  return null;
}

export type BillingInvoiceDeliveryMode = 'provider_url' | 'direct_pdf' | 'local_pdf';

export function resolveBillingInvoiceDeliveryMode(
  row: Pick<ProviderInvoiceRow, 'invoiceUrl' | 'receiptUrl' | 'source' | 'billingKind'>,
): BillingInvoiceDeliveryMode {
  if (row.billingKind === 'order') {
    if (resolveOrderDirectPdfUrl(row)) return 'direct_pdf';
    return 'local_pdf';
  }
  if (resolveProviderHostedInvoiceUrl(row)) return 'provider_url';
  if (resolveProviderDirectPdfUrl(row)) return 'direct_pdf';
  return 'local_pdf';
}
