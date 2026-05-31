import type { WorkspaceBillingProfile } from '@/api/types';
import { BILLING_INVOICE_COUNTRIES } from '@/lib/billingInvoiceCountries';

export const BILLING_PROFILE_PLACEHOLDERS = {
  companyName: '{Company Name}',
  address: '{Address}',
  cityLine: '{City, State ZIP}',
  country: '{Country}',
  taxId: '{Tax ID}',
  notes: '{Notes}',
} as const;

export function billingProfileCountryLabel(countryCode: string): string {
  const code = countryCode.trim().toUpperCase();
  return BILLING_INVOICE_COUNTRIES.find((row) => row.code === code)?.label ?? code;
}

export function formatBillingProfileCityLine(
  profile: Pick<WorkspaceBillingProfile, 'city' | 'state' | 'zipCode'>,
): string {
  if (!profile.city?.trim() && !profile.zipCode?.trim()) return '';
  if (profile.state?.trim()) {
    return `${profile.city}, ${profile.state} ${profile.zipCode}`;
  }
  return `${profile.city}, ${profile.zipCode}`;
}

export function buildBillingProfileAddressLines(
  profile: WorkspaceBillingProfile | null | undefined,
): string[] {
  if (!profile) {
    return [
      BILLING_PROFILE_PLACEHOLDERS.address,
      BILLING_PROFILE_PLACEHOLDERS.cityLine,
      BILLING_PROFILE_PLACEHOLDERS.country,
    ];
  }

  const cityLine = formatBillingProfileCityLine(profile);
  return [
    profile.address?.trim() || BILLING_PROFILE_PLACEHOLDERS.address,
    cityLine || BILLING_PROFILE_PLACEHOLDERS.cityLine,
    profile.country?.trim()
      ? billingProfileCountryLabel(profile.country)
      : BILLING_PROFILE_PLACEHOLDERS.country,
  ];
}

export function formatBillingProfileLines(profile: WorkspaceBillingProfile): string[] {
  const cityLine = formatBillingProfileCityLine(profile);
  const lines = [profile.name, profile.address, cityLine, billingProfileCountryLabel(profile.country)];
  if (profile.email?.trim()) lines.push(profile.email.trim());
  if (profile.taxId?.trim()) lines.push(`Tax ID: ${profile.taxId.trim()}`);
  if (profile.notes?.trim()) lines.push(profile.notes.trim());
  return lines;
}
