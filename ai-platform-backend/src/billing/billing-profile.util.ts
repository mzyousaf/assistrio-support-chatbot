import type { BillingOrderInvoiceDetails } from './billing-invoice-download.types';
import {
  isCompleteOrderInvoiceDetails,
  parseOrderInvoiceDetails,
} from './billing-invoice-download.util';
import type {
  WorkspaceBillingProfileInput,
  WorkspaceBillingProfileRecord,
} from './billing-profile.types';

export type ParsedBillingProfilePatch =
  | {
      ok: true;
      profile: Omit<WorkspaceBillingProfileRecord, 'workspaceId' | 'updatedAt' | 'updatedBy'>;
    }
  | {
      ok: false;
      errorCode: 'billing_profile_invalid' | 'billing_invoice_details_required' | 'billing_invoice_details_invalid';
      message: string;
    };

export function parseBillingProfilePatch(
  input: WorkspaceBillingProfileInput | null | undefined,
): ParsedBillingProfilePatch {
  const parsed = parseOrderInvoiceDetails(input ?? undefined);
  if (!parsed.ok) {
    return {
      ok: false,
      errorCode:
        parsed.errorCode === 'billing_invoice_details_invalid'
          ? 'billing_invoice_details_invalid'
          : 'billing_profile_invalid',
      message: parsed.message,
    };
  }

  const email = String(input?.email ?? '').trim().toLowerCase();
  const taxId = String(input?.taxId ?? '').trim();

  return {
    ok: true,
    profile: {
      name: parsed.details.name,
      address: parsed.details.address,
      city: parsed.details.city,
      state: parsed.details.state,
      zipCode: parsed.details.zipCode,
      country: parsed.details.country,
      taxId: taxId || undefined,
      email: email || undefined,
      notes: parsed.details.notes,
    },
  };
}

export function profileRecordToInvoiceDetails(
  profile: Pick<
    WorkspaceBillingProfileRecord,
    'name' | 'address' | 'city' | 'state' | 'zipCode' | 'country' | 'notes'
  >,
): BillingOrderInvoiceDetails {
  return {
    name: profile.name,
    address: profile.address,
    city: profile.city,
    state: profile.state,
    zipCode: profile.zipCode,
    country: profile.country,
    notes: profile.notes,
  };
}

export function isCompleteBillingProfileInput(
  input: WorkspaceBillingProfileInput | null | undefined,
): boolean {
  return isCompleteOrderInvoiceDetails(input);
}

export function toWorkspaceBillingProfileResponse(
  workspaceId: string,
  doc: {
    name: string;
    address: string;
    city: string;
    state?: string | null;
    zipCode: string;
    country: string;
    taxId?: string | null;
    email?: string | null;
    notes?: string | null;
    updatedAt?: Date;
    updatedBy: { toString(): string } | string;
  },
): WorkspaceBillingProfileRecord {
  return {
    workspaceId,
    name: doc.name,
    address: doc.address,
    city: doc.city,
    state: doc.state?.trim() || undefined,
    zipCode: doc.zipCode,
    country: doc.country,
    taxId: doc.taxId?.trim() || undefined,
    email: doc.email?.trim() || undefined,
    notes: doc.notes?.trim() || undefined,
    updatedAt: (doc.updatedAt ?? new Date()).toISOString(),
    updatedBy: String(doc.updatedBy),
  };
}
