import type { WorkspaceBillingPlanCatalogCard } from '@/api/types';

export const UPGRADE_MODAL_PAID_PLAN_KEYS = ['starter', 'pro'] as const;

export type UpgradeModalPaidPlanKey = (typeof UPGRADE_MODAL_PAID_PLAN_KEYS)[number];

/** Fallback when billing summary has not loaded yet. */
export const FALLBACK_UPGRADE_PLAN_CATALOG: WorkspaceBillingPlanCatalogCard[] = [
  {
    key: 'starter',
    name: 'Starter',
    priceMonthly: 59,
    botLimit: 3,
    memberLimit: 5,
    monthlyAiCredits: 500,
    kbStorageMbPerBot: 15,
    analyticsHistoryDays: null,
    canExportReports: true,
    checkoutAvailable: false,
  },
  {
    key: 'pro',
    name: 'Pro',
    priceMonthly: 119,
    botLimit: 10,
    memberLimit: 10,
    monthlyAiCredits: 2000,
    kbStorageMbPerBot: 30,
    analyticsHistoryDays: null,
    canExportReports: true,
    checkoutAvailable: false,
  },
];

export function resolveUpgradeModalPaidPlans(
  planCatalog?: WorkspaceBillingPlanCatalogCard[] | null,
): WorkspaceBillingPlanCatalogCard[] {
  const source = planCatalog ?? [];
  const resolved = UPGRADE_MODAL_PAID_PLAN_KEYS.map((key) =>
    source.find((plan) => plan.key === key),
  ).filter((plan): plan is WorkspaceBillingPlanCatalogCard => Boolean(plan));

  if (resolved.length === UPGRADE_MODAL_PAID_PLAN_KEYS.length) {
    return resolved;
  }

  return FALLBACK_UPGRADE_PLAN_CATALOG;
}

/** Next paid plan to offer for upgrade, or null when already on Pro. */
export function resolveContextualUpgradePlanKey(
  currentPlanKey: string,
  isTrialPlan?: boolean,
): UpgradeModalPaidPlanKey | null {
  if (currentPlanKey === 'pro') return null;
  if (currentPlanKey === 'starter') return 'pro';
  if (currentPlanKey === 'free' || isTrialPlan) return 'starter';
  return 'starter';
}

/** Single contextual upgrade card for the upgrade modal (Free → Starter, Starter → Pro). */
export function resolveContextualUpgradePlans(
  planCatalog: WorkspaceBillingPlanCatalogCard[] | null | undefined,
  currentPlanKey: string,
  isTrialPlan?: boolean,
): WorkspaceBillingPlanCatalogCard[] {
  const targetKey = resolveContextualUpgradePlanKey(currentPlanKey, isTrialPlan);
  if (!targetKey) return [];

  const source = planCatalog ?? [];
  const fromCatalog = source.find((plan) => plan.key === targetKey);
  if (fromCatalog) return [fromCatalog];

  const fallback = FALLBACK_UPGRADE_PLAN_CATALOG.find((plan) => plan.key === targetKey);
  return fallback ? [fallback] : [];
}
