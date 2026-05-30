import {
  FREE_PLAN,
  PRO_PLAN,
  STARTER_PLAN,
  getPlanByKey,
  megabytesToBytes,
  PLAN_CATALOG,
} from './plan-catalog';
import { FREE_TRIAL_DAYS } from './plan-trial-period.util';

describe('plan-catalog', () => {
  it('defines Free, Starter, and Pro plans', () => {
    expect(PLAN_CATALOG.map((p) => p.key)).toEqual(['free', 'starter', 'pro']);
  });

  it('Free plan is a 7-day trial with 50 non-renewing credits', () => {
    expect(FREE_PLAN).toMatchObject({
      key: 'free',
      name: 'Free',
      priceMonthlyUsd: 0,
      botLimit: 1,
      memberLimit: 1,
      monthlyAiCredits: 50,
      kbStorageMbPerBot: 5,
      maxKbStorageMbPerBot: 40,
      analyticsHistoryDays: 7,
      canExportReports: false,
      showPoweredByAssistrio: true,
      isTrialPlan: true,
      trialDays: FREE_TRIAL_DAYS,
      creditsRenewMonthly: false,
      autoTrainAllowed: false,
      addonsAllowed: false,
      memberInvitesAllowed: false,
    });
  });

  it('Starter plan enables export reports and paid-plan features', () => {
    expect(STARTER_PLAN).toMatchObject({
      key: 'starter',
      name: 'Starter',
      priceMonthlyUsd: 49,
      memberLimit: 5,
      monthlyAiCredits: 500,
      kbStorageMbPerBot: 15,
      canExportReports: true,
      showPoweredByAssistrio: true,
      isTrialPlan: false,
      creditsRenewMonthly: true,
      autoTrainAllowed: true,
      addonsAllowed: true,
      memberInvitesAllowed: true,
    });
    expect(STARTER_PLAN.analyticsHistoryDays).toBeNull();
  });

  it('Pro plan has 10 members and 2000 monthly credits', () => {
    expect(PRO_PLAN).toMatchObject({
      key: 'pro',
      name: 'Pro',
      priceMonthlyUsd: 99,
      memberLimit: 10,
      monthlyAiCredits: 2000,
      kbStorageMbPerBot: 30,
      canExportReports: true,
      autoTrainAllowed: true,
      addonsAllowed: true,
      memberInvitesAllowed: true,
    });
    expect(PRO_PLAN.analyticsHistoryDays).toBeNull();
  });

  it('trained KB storage limits per plan (Epic 6)', () => {
    expect(FREE_PLAN.kbStorageMbPerBot).toBe(5);
    expect(STARTER_PLAN.kbStorageMbPerBot).toBe(15);
    expect(PRO_PLAN.kbStorageMbPerBot).toBe(30);
  });

  it('max trained KB storage is 40 MB for all plans', () => {
    for (const plan of PLAN_CATALOG) {
      expect(plan.maxKbStorageMbPerBot).toBe(40);
    }
  });

  it('megabytesToBytes maps plan KB limits to binary bytes', () => {
    expect(megabytesToBytes(FREE_PLAN.kbStorageMbPerBot)).toBe(5 * 1024 * 1024);
    expect(megabytesToBytes(STARTER_PLAN.kbStorageMbPerBot)).toBe(15 * 1024 * 1024);
    expect(megabytesToBytes(PRO_PLAN.kbStorageMbPerBot)).toBe(30 * 1024 * 1024);
    expect(megabytesToBytes(FREE_PLAN.maxKbStorageMbPerBot)).toBe(40 * 1024 * 1024);
  });

  it('getPlanByKey falls back to Free for unknown keys', () => {
    expect(getPlanByKey('unknown').key).toBe('free');
    expect(getPlanByKey(undefined).key).toBe('free');
  });

  it('megabytesToBytes converts using binary megabytes', () => {
    expect(megabytesToBytes(5)).toBe(5 * 1024 * 1024);
    expect(megabytesToBytes(40)).toBe(40 * 1024 * 1024);
  });
});
