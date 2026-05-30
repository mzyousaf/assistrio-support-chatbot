import type { WorkspaceBillingProfile } from '@/api/types';
import { BILLING_INVOICE_COUNTRIES } from '@/lib/billingInvoiceCountries';

export function billingProfileCountryLabel(countryCode: string): string {
  const code = countryCode.trim().toUpperCase();
  return BILLING_INVOICE_COUNTRIES.find((row) => row.code === code)?.label ?? code;
}

export function formatBillingProfileLines(profile: WorkspaceBillingProfile): string[] {
  const cityLine = profile.state?.trim()
    ? `${profile.city}, ${profile.state} ${profile.zipCode}`
    : `${profile.city}, ${profile.zipCode}`;
  const lines = [profile.name, profile.address, cityLine, billingProfileCountryLabel(profile.country)];
  if (profile.email?.trim()) lines.push(profile.email.trim());
  if (profile.taxId?.trim()) lines.push(`Tax ID: ${profile.taxId.trim()}`);
  if (profile.notes?.trim()) lines.push(profile.notes.trim());
  return lines;
}
