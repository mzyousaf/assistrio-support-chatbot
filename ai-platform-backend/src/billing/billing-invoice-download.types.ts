export type BillingOrderInvoiceDetails = {
  name: string;
  address: string;
  city: string;
  state?: string;
  zipCode: string;
  country: string;
  notes?: string;
  locale?: string;
};

export type BillingInvoiceDownloadResult = {
  downloadUrl: string;
};

export type BillingInvoicePdfStreamResult = {
  buffer: Buffer;
  filename: string;
};

export type BillingInvoiceProviderUrlResult = {
  mode: 'provider_url';
  url: string;
  source: string;
};

export type BillingInvoicePdfResolveResult =
  | BillingInvoiceProviderUrlResult
  | ({ mode: 'pdf' } & BillingInvoicePdfStreamResult);

export type BillingInvoiceListKind = 'subscription_invoice' | 'order';

export type BillingInvoiceDeliveryMode = 'provider_url' | 'direct_pdf' | 'local_pdf';

export type { BillingInvoicePdfRequestContext } from './billing-invoice-pdf-log.util';
