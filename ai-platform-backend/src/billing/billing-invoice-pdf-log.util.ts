import { randomUUID } from 'node:crypto';
import type { BillingOrderInvoiceDetails } from './billing-invoice-download.types';

export type BillingInvoicePdfRequestContext = {
  requestId: string;
  userId?: string;
  saveProfile?: boolean;
};

export function createBillingInvoicePdfRequestId(): string {
  return randomUUID();
}

export function billingInvoicePdfQueryMetadata(
  input: Partial<BillingOrderInvoiceDetails> | null | undefined,
): {
  hasQueryDetails: boolean;
  country?: string;
  hasState: boolean;
  zipCodePresent: boolean;
} {
  const country = String(input?.country ?? '').trim().toUpperCase() || undefined;
  const hasQueryDetails = Boolean(
    input?.name?.trim() ||
      input?.address?.trim() ||
      input?.city?.trim() ||
      input?.state?.trim() ||
      input?.zipCode?.trim() ||
      country ||
      input?.notes?.trim() ||
      input?.locale?.trim(),
  );

  return {
    hasQueryDetails,
    country,
    hasState: Boolean(input?.state?.trim()),
    zipCodePresent: Boolean(input?.zipCode?.trim()),
  };
}

export function extractLemonInvoiceGenerationErrorFields(responseText: string): {
  lemonErrorTitle?: string;
  lemonErrorDetail?: string;
  reason: string;
} {
  const trimmed = String(responseText ?? '').trim();
  if (!trimmed) {
    return { reason: 'Could not generate order invoice.' };
  }

  try {
    const json = JSON.parse(trimmed) as {
      errors?: Array<{ detail?: string; title?: string; source?: { pointer?: string } }>;
      error?: string;
      message?: string;
    };

    if (Array.isArray(json.errors) && json.errors.length > 0) {
      const first = json.errors[0];
      const title = String(first?.title ?? '').trim().slice(0, 200) || undefined;
      const detail = String(first?.detail ?? first?.title ?? '').trim().slice(0, 500) || undefined;
      const parts = json.errors
        .map((entry) => {
          const entryDetail = String(entry.detail ?? entry.title ?? '').trim();
          const pointer = String(entry.source?.pointer ?? '').trim();
          if (entryDetail && pointer) return `${entryDetail} (${pointer})`;
          return entryDetail;
        })
        .filter(Boolean);
      const reason = parts.length > 0 ? parts.join('; ').slice(0, 500) : 'Could not generate order invoice.';
      return { lemonErrorTitle: title, lemonErrorDetail: detail, reason };
    }

    const message = String(json.error ?? json.message ?? '').trim();
    if (message) {
      return { lemonErrorDetail: message.slice(0, 500), reason: message.slice(0, 500) };
    }
  } catch {
    if (trimmed.length <= 500) {
      return { lemonErrorDetail: trimmed, reason: trimmed };
    }
    return { lemonErrorDetail: trimmed.slice(0, 500), reason: trimmed.slice(0, 500) };
  }

  return { reason: 'Could not generate order invoice.' };
}

export function invoicePdfUrlKind(
  billingKind?: string,
): 'subscription_invoice' | 'order_invoice' {
  return billingKind === 'order' ? 'order_invoice' : 'subscription_invoice';
}

/** Returns true when a log string appears to contain sensitive invoice/PDF data. */
export function logPayloadContainsSensitiveData(payload: string): boolean {
  const lower = payload.toLowerCase();
  if (lower.includes('bearer ')) return true;
  if (lower.includes('whsec_')) return true;
  if (lower.includes('api_key')) return true;
  if (lower.includes('download_invoice=')) return true;
  if (lower.includes('https://app.lemonsqueezy.com/invoice/download/')) return true;
  if (lower.includes('name=jane') || lower.includes('address=123')) return true;
  if (lower.includes('%pdf')) return true;
  return false;
}
