import {
  FREE_PLAN,
  PRO_PLAN,
  STARTER_PLAN,
  getPlanByKey,
  megabytesToBytes,
  PLAN_CATALOG,
} from './plan-catalog';

describe('plan-catalog', () => {
  it('defines Free, Starter, and Pro plans', () => {
    expect(PLAN_CATALOG.map((p) => p.key)).toEqual(['free', 'starter', 'pro']);
  });

  it('Free plan matches Epic 2 spec', () => {
    expect(FREE_PLAN).toMatchObject({
      key: 'free',
      name: 'Free',
      priceMonthlyUsd: 0,
      botLimit: 1,
      memberLimit: 3,
      monthlyAiCredits: 50,
      kbStorageMbPerBot: 10,
      maxKbStorageMbPerBot: 40,
      analyticsHistoryDays: 7,
      canExportReports: false,
      showPoweredByAssistrio: true,
    });
  });

  it('Starter plan enables export reports', () => {
    expect(STARTER_PLAN).toMatchObject({
      key: 'starter',
      name: 'Starter',
      priceMonthlyUsd: 49,
      monthlyAiCredits: 500,
      kbStorageMbPerBot: 15,
      canExportReports: true,
      showPoweredByAssistrio: true,
    });
    expect(STARTER_PLAN.analyticsHistoryDays).toBeNull();
  });

  it('Pro plan has higher member and credit limits', () => {
    expect(PRO_PLAN).toMatchObject({
      key: 'pro',
      name: 'Pro',
      priceMonthlyUsd: 99,
      memberLimit: 5,
      monthlyAiCredits: 3000,
      kbStorageMbPerBot: 25,
      canExportReports: true,
    });
    expect(PRO_PLAN.analyticsHistoryDays).toBeNull();
  });

  it('max KB storage is 40 MB for all plans', () => {
    for (const plan of PLAN_CATALOG) {
      expect(plan.maxKbStorageMbPerBot).toBe(40);
    }
  });

  it('getPlanByKey falls back to Free for unknown keys', () => {
    expect(getPlanByKey('unknown').key).toBe('free');
    expect(getPlanByKey(undefined).key).toBe('free');
  });

  it('megabytesToBytes converts using binary megabytes', () => {
    expect(megabytesToBytes(10)).toBe(10 * 1024 * 1024);
    expect(megabytesToBytes(40)).toBe(40 * 1024 * 1024);
  });
});
