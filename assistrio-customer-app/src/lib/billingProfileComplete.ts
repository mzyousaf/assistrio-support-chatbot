import type { WorkspaceBillingProfile, WorkspaceBillingProfileInput } from '@/api/types';

export function isCompleteBillingProfile(
  input: WorkspaceBillingProfile | WorkspaceBillingProfileInput | null | undefined,
): boolean {
  const name = String(input?.name ?? '').trim();
  const address = String(input?.address ?? '').trim();
  const city = String(input?.city ?? '').trim();
  const zipCode = String(input?.zipCode ?? '').trim();
  const country = String(input?.country ?? '').trim().toUpperCase();

  if (!name || !address || !city || !zipCode || !country) return false;
  if ((country === 'US' || country === 'CA') && !String(input?.state ?? '').trim()) return false;
  return true;
}
