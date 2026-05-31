import { describe, expect, it } from 'vitest';
import {
  ANNUAL_BILLING_UNAVAILABLE_MESSAGE,
  isAnnualBillingAvailableForCatalog,
  isMonthlyBillingAvailableForCatalog,
  oppositeBillingInterval,
} from '@/lib/billingInterval.util';

describe('billingInterval.util', () => {
  it('oppositeBillingInterval toggles monthly and yearly', () => {
    expect(oppositeBillingInterval('monthly')).toBe('yearly');
    expect(oppositeBillingInterval('yearly')).toBe('monthly');
  });

  it('isAnnualBillingAvailableForCatalog requires checkoutAvailableYearly', () => {
    expect(
      isAnnualBillingAvailableForCatalog({
        checkoutAvailable: true,
        checkoutAvailableMonthly: true,
        checkoutAvailableYearly: false,
      }),
    ).toBe(false);
    expect(
      isAnnualBillingAvailableForCatalog({
        checkoutAvailable: true,
        checkoutAvailableMonthly: true,
        checkoutAvailableYearly: true,
      }),
    ).toBe(true);
  });

  it('isMonthlyBillingAvailableForCatalog prefers checkoutAvailableMonthly', () => {
    expect(
      isMonthlyBillingAvailableForCatalog({
        checkoutAvailable: false,
        checkoutAvailableMonthly: true,
      }),
    ).toBe(true);
  });

  it('exposes annual unavailable copy for UI', () => {
    expect(ANNUAL_BILLING_UNAVAILABLE_MESSAGE).toBe('Annual billing is not available yet');
  });
});
