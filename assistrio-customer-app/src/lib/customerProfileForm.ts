import type { CustomerMe, PatchCustomerMeProfileRequest } from '@/api/types';

export type CustomerProfileFormState = {
  name: string;
  linkedinUrl: string;
  calendlyUrl: string;
  websiteUrl: string;
  otherUrl: string;
};

export type CustomerProfileFieldErrors = Partial<
  Record<'name' | 'linkedinUrl' | 'calendlyUrl' | 'websiteUrl' | 'otherUrl' | 'form', string>
>;

export function customerDisplayName(customer: Pick<CustomerMe, 'firstName' | 'lastName' | 'email'>): string {
  const full = [customer.firstName, customer.lastName].filter(Boolean).join(' ').trim();
  if (full) return full;
  const local = customer.email.split('@')[0]?.trim();
  return local || 'Account';
}

export function customerProfileFormFromSession(customer: CustomerMe): CustomerProfileFormState {
  return {
    name: customerDisplayName(customer),
    linkedinUrl: customer.profileLinks?.linkedinUrl ?? '',
    calendlyUrl: customer.profileLinks?.calendlyUrl ?? '',
    websiteUrl: customer.profileLinks?.websiteUrl ?? '',
    otherUrl: customer.profileLinks?.otherUrl ?? '',
  };
}

function normalizeOptionalUrlInput(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const href = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const u = new URL(href);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.toString();
  } catch {
    return null;
  }
}

export function validateCustomerProfileForm(state: CustomerProfileFormState): CustomerProfileFieldErrors {
  const errors: CustomerProfileFieldErrors = {};
  const name = state.name.trim().replace(/\s+/g, ' ');
  if (!name) {
    errors.name = 'Enter your name.';
  } else if (name.length > 120) {
    errors.name = 'Name is too long.';
  }

  for (const [field, label] of [
    ['linkedinUrl', 'LinkedIn URL'],
    ['calendlyUrl', 'Calendly URL'],
    ['websiteUrl', 'Website URL'],
    ['otherUrl', 'Other link URL'],
  ] as const) {
    const raw = state[field].trim();
    if (!raw) continue;
    if (!normalizeOptionalUrlInput(raw)) {
      errors[field] = `${label} must be a valid http or https URL.`;
    }
  }

  return errors;
}

export function buildCustomerProfilePatchPayload(
  state: CustomerProfileFormState,
  baseline: CustomerProfileFormState,
): PatchCustomerMeProfileRequest {
  const payload: PatchCustomerMeProfileRequest = {};

  const nextName = state.name.trim().replace(/\s+/g, ' ');
  const baseName = baseline.name.trim().replace(/\s+/g, ' ');
  if (nextName !== baseName) {
    payload.name = nextName;
  }

  const linkPatch: NonNullable<PatchCustomerMeProfileRequest['profileLinks']> = {};

  for (const field of ['linkedinUrl', 'calendlyUrl', 'websiteUrl', 'otherUrl'] as const) {
    const next = normalizeOptionalUrlInput(state[field]) ?? null;
    const base = normalizeOptionalUrlInput(baseline[field]) ?? null;
    if (next !== base) {
      linkPatch[field] = next;
    }
  }

  if (Object.keys(linkPatch).length > 0) {
    payload.profileLinks = linkPatch;
  }

  return payload;
}
