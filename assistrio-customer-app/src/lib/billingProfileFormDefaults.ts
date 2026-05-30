import type { WorkspaceBillingProfile, WorkspaceBillingProfileInput } from '@/api/types';
import { EMPTY_BILLING_PROFILE_FORM } from '@/components/billing/BillingProfileFormFields';

export function profileToBillingForm(
  profile: WorkspaceBillingProfile | null | undefined,
): WorkspaceBillingProfileInput {
  if (!profile) return { ...EMPTY_BILLING_PROFILE_FORM };
  return {
    name: profile.name,
    address: profile.address,
    city: profile.city,
    state: profile.state ?? '',
    zipCode: profile.zipCode,
    country: profile.country,
    email: profile.email ?? '',
    taxId: profile.taxId ?? '',
    notes: profile.notes ?? '',
  };
}

export function buildInvoiceModalFormDefaults(input: {
  savedProfile?: WorkspaceBillingProfile | null;
  workspaceName?: string;
  customerEmail?: string;
  draftForm?: WorkspaceBillingProfileInput | null;
}): WorkspaceBillingProfileInput {
  if (input.draftForm) return { ...input.draftForm };
  if (input.savedProfile) return profileToBillingForm(input.savedProfile);

  return {
    ...EMPTY_BILLING_PROFILE_FORM,
    name: String(input.workspaceName ?? '').trim(),
    email: String(input.customerEmail ?? '').trim(),
  };
}

export function billingFormToSavedProfile(
  workspaceId: string,
  input: WorkspaceBillingProfileInput,
  updatedBy: string,
): WorkspaceBillingProfile {
  return {
    workspaceId,
    name: input.name.trim(),
    address: input.address.trim(),
    city: input.city.trim(),
    state: input.state?.trim() || undefined,
    zipCode: input.zipCode.trim(),
    country: input.country.trim().toUpperCase(),
    email: input.email?.trim() || undefined,
    taxId: input.taxId?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
    updatedAt: new Date().toISOString(),
    updatedBy,
  };
}
