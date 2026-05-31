import { describe, expect, it } from 'vitest';
import {
  applyAnnualPlanDiscount,
  buildPlanCardLimitItems,
  formatPlanOverviewPriceLine,
  formatRecurringAddonPriceLine,
  PLAN_ANNUAL_SAVINGS_TAG,
  resolvePlanCardAnnualTotal,
} from './planPricingCardDisplay';

describe('planPricingCardDisplay', () => {
  it('applies 10% annual discount to displayed monthly equivalent', () => {
    expect(applyAnnualPlanDiscount(59)).toBe(53);
    expect(applyAnnualPlanDiscount(119)).toBe(107);
    expect(resolvePlanCardAnnualTotal(59)).toBe(637);
    expect(PLAN_ANNUAL_SAVINGS_TAG).toBe('Save 10%');
  });

  it('formats overview and add-on prices for annual billing', () => {
    expect(
      formatPlanOverviewPriceLine(59, { planKey: 'starter', billingPeriod: 'annual' }),
    ).toBe('$53/month · $637/year');
    expect(formatRecurringAddonPriceLine({ priceUsd: 49 }, 'annual')).toBe('$44/month · $529/year');
    expect(formatRecurringAddonPriceLine({ priceUsd: 49 }, 'monthly')).toBe('$49/month');
  });

  it('uses backend yearly pricing when provided', () => {
    expect(
      formatPlanOverviewPriceLine(59, {
        planKey: 'starter',
        billingPeriod: 'annual',
        pricing: {
          priceMonthly: 59,
          priceYearly: 637.2,
          monthlyEquivalentYearly: 53.1,
          yearlyDiscountPercent: 10,
        },
      }),
    ).toBe('$53/month · $637/year');
  });

  it('formats free trial limit copy', () => {
    const items = buildPlanCardLimitItems({
      key: 'free',
      name: 'Free',
      priceMonthly: 0,
      botLimit: 1,
      memberLimit: 1,
      monthlyAiCredits: 50,
      kbStorageMbPerBot: 5,
      analyticsHistoryDays: 7,
      canExportReports: false,
    });

    expect(items.some((item) => item.label === '50 trial credits total')).toBe(true);
    expect(items.some((item) => item.label === '5 MB trained knowledge / AI Agent')).toBe(true);
    expect(items.some((item) => item.label === 'Owner only (no invites)' && !item.included)).toBe(true);
  });

  it('formats starter monthly credits copy', () => {
    const items = buildPlanCardLimitItems({
      key: 'starter',
      name: 'Starter',
      priceMonthly: 49,
      botLimit: 1,
      memberLimit: 5,
      monthlyAiCredits: 500,
      kbStorageMbPerBot: 15,
      analyticsHistoryDays: null,
      canExportReports: true,
    });

    expect(items.some((item) => item.label === '500 AI credits / month')).toBe(true);
    expect(items.some((item) => item.label === '15 MB trained knowledge / AI Agent')).toBe(true);
  });
});
