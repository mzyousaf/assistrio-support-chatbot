import {
  resolveMonthlyEquivalentYearly,
  resolveYearlyPriceFromMonthly,
  YEARLY_DISCOUNT_PERCENT,
} from '../billing/billing-interval.types';

/** Workspace plan tier keys. */
export const PLAN_KEYS = ['free', 'starter', 'pro'] as const;
export type PlanKey = (typeof PLAN_KEYS)[number];

export type PlanDefinition = {
  key: PlanKey;
  name: string;
  priceMonthlyUsd: number;
  priceYearlyUsd: number;
  monthlyEquivalentYearlyUsd: number;
  yearlyDiscountPercent: number;
  botLimit: number;
  memberLimit: number;
  monthlyAiCredits: number;
  kbStorageMbPerBot: number;
  maxKbStorageMbPerBot: number;
  /** `null` = unlimited analytics history retention. */
  analyticsHistoryDays: number | null;
  canExportReports: boolean;
  showPoweredByAssistrio: boolean;
  /** Free plan is a time-boxed trial, not a renewing monthly tier. */
  isTrialPlan: boolean;
  trialDays: number | null;
  /** Included AI credits renew each billing month (paid plans only). */
  creditsRenewMonthly: boolean;
  autoTrainAllowed: boolean;
  addonsAllowed: boolean;
  memberInvitesAllowed: boolean;
  sharePreviewAllowed: boolean;
};

function buildPaidPlanDefinition(input: Omit<
  PlanDefinition,
  'priceYearlyUsd' | 'monthlyEquivalentYearlyUsd' | 'yearlyDiscountPercent' | 'isTrialPlan' | 'trialDays'
>): PlanDefinition {
  const priceYearlyUsd = resolveYearlyPriceFromMonthly(input.priceMonthlyUsd);
  return {
    ...input,
    priceYearlyUsd,
    monthlyEquivalentYearlyUsd: resolveMonthlyEquivalentYearly(priceYearlyUsd),
    yearlyDiscountPercent: YEARLY_DISCOUNT_PERCENT,
    isTrialPlan: false,
    trialDays: null,
  };
}

export const FREE_PLAN: PlanDefinition = {
  key: 'free',
  name: 'Free',
  priceMonthlyUsd: 0,
  priceYearlyUsd: 0,
  monthlyEquivalentYearlyUsd: 0,
  yearlyDiscountPercent: YEARLY_DISCOUNT_PERCENT,
  botLimit: 1,
  memberLimit: 1,
  monthlyAiCredits: 50,
  kbStorageMbPerBot: 5,
  maxKbStorageMbPerBot: 40,
  analyticsHistoryDays: 7,
  canExportReports: false,
  showPoweredByAssistrio: true,
  isTrialPlan: true,
  trialDays: 7,
  creditsRenewMonthly: false,
  autoTrainAllowed: false,
  addonsAllowed: false,
  memberInvitesAllowed: false,
  sharePreviewAllowed: false,
};

export const STARTER_PLAN: PlanDefinition = buildPaidPlanDefinition({
  key: 'starter',
  name: 'Starter',
  priceMonthlyUsd: 59,
  botLimit: 1,
  memberLimit: 5,
  monthlyAiCredits: 500,
  kbStorageMbPerBot: 15,
  maxKbStorageMbPerBot: 40,
  analyticsHistoryDays: null,
  canExportReports: true,
  showPoweredByAssistrio: true,
  creditsRenewMonthly: true,
  autoTrainAllowed: true,
  addonsAllowed: true,
  memberInvitesAllowed: true,
  sharePreviewAllowed: true,
});

export const PRO_PLAN: PlanDefinition = buildPaidPlanDefinition({
  key: 'pro',
  name: 'Pro',
  priceMonthlyUsd: 119,
  botLimit: 1,
  memberLimit: 10,
  monthlyAiCredits: 2000,
  kbStorageMbPerBot: 30,
  maxKbStorageMbPerBot: 40,
  analyticsHistoryDays: null,
  canExportReports: true,
  showPoweredByAssistrio: true,
  creditsRenewMonthly: true,
  autoTrainAllowed: true,
  addonsAllowed: true,
  memberInvitesAllowed: true,
  sharePreviewAllowed: true,
});

export const PLAN_CATALOG: readonly PlanDefinition[] = [FREE_PLAN, STARTER_PLAN, PRO_PLAN];

const PLAN_BY_KEY: Record<PlanKey, PlanDefinition> = {
  free: FREE_PLAN,
  starter: STARTER_PLAN,
  pro: PRO_PLAN,
};

export function isPlanKey(value: string): value is PlanKey {
  return (PLAN_KEYS as readonly string[]).includes(value);
}

export function getPlanByKey(key: string | null | undefined): PlanDefinition {
  const k = String(key ?? '').trim();
  if (isPlanKey(k)) return PLAN_BY_KEY[k];
  return FREE_PLAN;
}

export function megabytesToBytes(mb: number): number {
  return Math.round(mb * 1024 * 1024);
}
