import type { BillingInterval } from '@/api/types';
import type { PlanBillingPeriod } from '@/pages/billing/planPricingCardDisplay';

export function planBillingPeriodToInterval(period: PlanBillingPeriod): BillingInterval {
  return period === 'annual' ? 'yearly' : 'monthly';
}

export function intervalToPlanBillingPeriod(
  interval: BillingInterval | null | undefined,
): PlanBillingPeriod {
  return interval === 'yearly' ? 'annual' : 'monthly';
}

export function formatBillingIntervalLabel(interval: BillingInterval | null | undefined): string {
  if (interval === 'yearly') return 'Annual';
  if (interval === 'monthly') return 'Monthly';
  return 'Monthly';
}

export function formatBillingIntervalShort(interval: BillingInterval | null | undefined): string {
  if (interval === 'yearly') return 'year';
  return 'month';
}

export function oppositeBillingInterval(interval: BillingInterval): BillingInterval {
  return interval === 'yearly' ? 'monthly' : 'yearly';
}

export function isRecurringAddonCatalogCard(
  billingInterval: 'one_time' | 'monthly',
): boolean {
  return billingInterval === 'monthly';
}

export const ANNUAL_BILLING_UNAVAILABLE_MESSAGE = 'Annual billing is not available yet';

export function isAnnualBillingAvailableForCatalog(
  item: {
    checkoutAvailableMonthly?: boolean;
    checkoutAvailableYearly?: boolean;
    checkoutAvailable?: boolean;
  },
): boolean {
  return item.checkoutAvailableYearly ?? false;
}

export function isMonthlyBillingAvailableForCatalog(
  item: {
    checkoutAvailableMonthly?: boolean;
    checkoutAvailable?: boolean;
  },
): boolean {
  return item.checkoutAvailableMonthly ?? item.checkoutAvailable ?? false;
}
