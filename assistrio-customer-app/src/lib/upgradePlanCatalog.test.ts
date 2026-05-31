import { describe, expect, it } from 'vitest';
import {
  resolveContextualUpgradePlanKey,
  resolveContextualUpgradePlans,
} from '@/lib/upgradePlanCatalog';

const planCatalog = [
  {
    key: 'starter',
    name: 'Starter',
    priceMonthly: 49,
    botLimit: 3,
    memberLimit: 5,
    monthlyAiCredits: 500,
    kbStorageMbPerBot: 15,
    analyticsHistoryDays: null,
    canExportReports: true,
    checkoutAvailable: true,
  },
  {
    key: 'pro',
    name: 'Pro',
    priceMonthly: 99,
    botLimit: 10,
    memberLimit: 10,
    monthlyAiCredits: 2000,
    kbStorageMbPerBot: 30,
    analyticsHistoryDays: null,
    canExportReports: true,
    checkoutAvailable: true,
  },
];

describe('upgradePlanCatalog', () => {
  it('resolves Starter for free trial', () => {
    expect(resolveContextualUpgradePlanKey('free', true)).toBe('starter');
    expect(resolveContextualUpgradePlans(planCatalog, 'free', true)).toHaveLength(1);
    expect(resolveContextualUpgradePlans(planCatalog, 'free', true)[0]?.key).toBe('starter');
  });

  it('resolves Pro for Starter', () => {
    expect(resolveContextualUpgradePlanKey('starter')).toBe('pro');
    expect(resolveContextualUpgradePlans(planCatalog, 'starter')[0]?.key).toBe('pro');
  });

  it('returns no upgrade plan for Pro', () => {
    expect(resolveContextualUpgradePlanKey('pro')).toBeNull();
    expect(resolveContextualUpgradePlans(planCatalog, 'pro')).toEqual([]);
  });
});
