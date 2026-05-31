export const BILLING_INTERVALS = ['monthly', 'yearly'] as const;
export type BillingInterval = (typeof BILLING_INTERVALS)[number];

export const YEARLY_DISCOUNT_PERCENT = 10;

export function isBillingInterval(value: string | null | undefined): value is BillingInterval {
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized === 'monthly' || normalized === 'yearly';
}

export function parseBillingInterval(value: unknown, fallback: BillingInterval = 'monthly'): BillingInterval {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'annual') return 'yearly';
  return isBillingInterval(normalized) ? normalized : fallback;
}

/** Annual list price from monthly (10% off × 12 months). */
export function resolveYearlyPriceFromMonthly(priceMonthly: number): number {
  return Math.round(priceMonthly * 12 * (1 - YEARLY_DISCOUNT_PERCENT / 100) * 100) / 100;
}

/** Effective monthly rate when billed yearly. */
export function resolveMonthlyEquivalentYearly(priceYearly: number): number {
  return Math.round((priceYearly / 12) * 100) / 100;
}
