import type { WorkspaceBillingPlanCatalogCard } from '@/api/types';

export const UPGRADE_MODAL_PAID_PLAN_KEYS = ['starter', 'pro'] as const;

export type UpgradeModalPaidPlanKey = (typeof UPGRADE_MODAL_PAID_PLAN_KEYS)[number];

/** Fallback when billing summary has not loaded yet. */
export const FALLBACK_UPGRADE_PLAN_CATALOG: WorkspaceBillingPlanCatalogCard[] = [
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
    checkoutAvailable: false,
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
