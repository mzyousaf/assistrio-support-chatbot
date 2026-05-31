import type { WorkspaceBillingPlanCatalogCard } from '@/api/types';
import type { UpgradePlanReason } from '@/lib/planLimitError';
import { resolveContextualUpgradePlanKey } from '@/lib/upgradePlanCatalog';

export type PlansModalMode = 'billing' | 'upgrade';

export const ALLOWED_BILLING_ADDON_KEYS = [
  'ai_credits_1000',
  'extra_bot',
  'remove_branding',
] as const;

export type AllowedBillingAddonKey = (typeof ALLOWED_BILLING_ADDON_KEYS)[number];

export function isAllowedBillingAddonKey(key: string): key is AllowedBillingAddonKey {
  return (ALLOWED_BILLING_ADDON_KEYS as readonly string[]).includes(key);
}

export function isKbStorageAddonKey(key: string): boolean {
  return key === 'kb_storage_5mb' || key === 'kb_storage_10mb' || key.startsWith('kb_storage_');
}

/** Hide Free when the workspace is on a paid plan. */
export function shouldHideFreePlanForCurrentPlan(currentPlanKey: string): boolean {
  return currentPlanKey === 'starter' || currentPlanKey === 'pro';
}

export function shouldShowPlanInModal(
  planKey: string,
  input: {
    mode: PlansModalMode;
    currentPlanKey: string;
    isTrialPlan: boolean;
  },
): boolean {
  const { mode, currentPlanKey, isTrialPlan } = input;

  if (planKey === 'free' && shouldHideFreePlanForCurrentPlan(currentPlanKey)) {
    return false;
  }

  if (mode === 'billing') {
    if (currentPlanKey === 'pro') {
      return planKey === 'pro' || planKey === 'starter';
    }
    if (currentPlanKey === 'starter') {
      return planKey === 'starter' || planKey === 'pro';
    }
    if (planKey === 'pro') {
      return false;
    }
    return true;
  }

  if (currentPlanKey === 'pro') {
    return false;
  }

  const targetKey = resolveContextualUpgradePlanKey(currentPlanKey, isTrialPlan);
  if (!targetKey) return false;
  return planKey === targetKey;
}

export function filterPlansForModal(
  planCatalog: WorkspaceBillingPlanCatalogCard[] | null | undefined,
  input: {
    mode: PlansModalMode;
    currentPlanKey: string;
    isTrialPlan: boolean;
  },
): WorkspaceBillingPlanCatalogCard[] {
  return (planCatalog ?? []).filter((plan) =>
    shouldShowPlanInModal(plan.key, input),
  );
}

export function shouldShowHighestPlanPanel(input: {
  mode: PlansModalMode;
  currentPlanKey: string;
}): boolean {
  return input.mode === 'upgrade' && input.currentPlanKey === 'pro';
}

export function resolveRelevantAddonKeysForReason(
  reason: UpgradePlanReason | undefined,
): readonly AllowedBillingAddonKey[] {
  switch (reason) {
    case 'bots':
      return ['extra_bot'];
    case 'credits':
      return ['ai_credits_1000'];
    case 'branding':
      return ['remove_branding'];
    default:
      return ALLOWED_BILLING_ADDON_KEYS;
  }
}

export function resolvePlansModalTitle(mode: PlansModalMode, currentPlanKey: string): string {
  if (shouldShowHighestPlanPanel({ mode, currentPlanKey })) {
    return 'Highest plan';
  }
  if (mode === 'billing') {
    return 'Plans';
  }
  return 'Upgrade plan';
}

export function resolvePlansModalDescription(
  mode: PlansModalMode,
  currentPlanKey: string,
  _reason?: UpgradePlanReason,
): string {
  if (shouldShowHighestPlanPanel({ mode, currentPlanKey })) {
    return "You're on the highest plan. Add workspace capacity with add-ons below.";
  }
  if (mode === 'billing') {
    return 'Compare plans and choose the one that fits your workspace.';
  }
  if (currentPlanKey === 'starter') {
    return 'Upgrade to Pro for higher limits and priority support.';
  }
  return 'Upgrade to Starter to unlock paid plan features and add-ons.';
}
