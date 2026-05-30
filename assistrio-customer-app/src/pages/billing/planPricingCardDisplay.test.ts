import { describe, expect, it } from 'vitest';
import { buildPlanCardLimitItems } from './planPricingCardDisplay';

describe('planPricingCardDisplay', () => {
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
    expect(items.some((item) => item.label === '5 MB trained knowledge / bot')).toBe(true);
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
    expect(items.some((item) => item.label === '15 MB trained knowledge / bot')).toBe(true);
  });
});
