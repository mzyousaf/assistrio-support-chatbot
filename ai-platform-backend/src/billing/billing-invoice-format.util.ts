import type { PlanKey } from '../entitlements/plan-catalog';

function stringifyCustomValue(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

export function parseAmountCents(value: unknown): number {
  if (value == null || value === '') return 0;
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n);
}

export function formatInvoiceAmountFormatted(amountCents: number, currency: string): string {
  const code = (currency || 'USD').trim().toUpperCase() || 'USD';
  const dollars = amountCents / 100;
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: code }).format(dollars);
  } catch {
    return `$${dollars.toFixed(2)}`;
  }
}

export function resolveLemonSubscriptionInvoiceUrl(attrs: Record<string, unknown>): string | null {
  const urls = attrs.urls;
  if (urls && typeof urls === 'object') {
    const invoiceUrl = stringifyCustomValue((urls as Record<string, unknown>).invoice_url);
    if (invoiceUrl) return invoiceUrl;
  }
  return stringifyCustomValue(attrs.invoice_url) || null;
}

export function resolveLemonInvoiceUrl(attrs: Record<string, unknown>): string | null {
  const urls = attrs.urls;
  if (urls && typeof urls === 'object') {
    const urlRecord = urls as Record<string, unknown>;
    const invoiceUrl = stringifyCustomValue(urlRecord.invoice_url);
    if (invoiceUrl) return invoiceUrl;
    const receiptUrl = stringifyCustomValue(urlRecord.receipt);
    if (receiptUrl) return receiptUrl;
  }
  return stringifyCustomValue(attrs.invoice_url) || stringifyCustomValue(attrs.receipt_url) || null;
}

export function resolveLemonOrderUrls(attrs: Record<string, unknown>): {
  invoiceUrl: string | null;
  receiptUrl: string | null;
} {
  const urls = attrs.urls;
  if (urls && typeof urls === 'object') {
    const urlRecord = urls as Record<string, unknown>;
    return {
      invoiceUrl: stringifyCustomValue(urlRecord.invoice_url) || null,
      receiptUrl: stringifyCustomValue(urlRecord.receipt) || null,
    };
  }
  return { invoiceUrl: null, receiptUrl: null };
}

const BILLING_REASON_LABELS: Record<string, string> = {
  initial: 'Subscription started',
  renewal: 'Subscription renewal',
  updated: 'Subscription updated',
  manual: 'Manual invoice',
  unknown: 'Subscription invoice',
};

export function mapInvoiceBillingReasonDescription(
  billingReason: string | null | undefined,
  planKey?: PlanKey | string | null,
): string {
  const reason = String(billingReason ?? '')
    .trim()
    .toLowerCase();
  if (planKey === 'starter') {
    return reason === 'renewal' ? 'Starter subscription renewal' : 'Starter subscription started';
  }
  if (planKey === 'pro') {
    return reason === 'renewal' ? 'Pro subscription renewal' : 'Pro subscription started';
  }
  if (reason && BILLING_REASON_LABELS[reason]) {
    return BILLING_REASON_LABELS[reason];
  }
  if (reason) {
    return BILLING_REASON_LABELS.unknown;
  }
  return 'Subscription invoice';
}

export function normalizeProviderInvoiceRow(input: {
  id: string;
  provider: 'lemon_squeezy' | 'stripe_future';
  date: string;
  amountCents: number;
  currency: string;
  status: string;
  invoiceUrl: string | null;
  receiptUrl: string | null;
  description: string;
}) {
  const currency = input.currency || 'USD';
  return {
    id: input.id,
    provider: input.provider,
    date: input.date,
    amount: input.amountCents / 100,
    amountCents: input.amountCents,
    amountFormatted: formatInvoiceAmountFormatted(input.amountCents, currency),
    currency,
    status: input.status,
    invoiceUrl: input.invoiceUrl,
    receiptUrl: input.receiptUrl,
    description: input.description,
  };
}
