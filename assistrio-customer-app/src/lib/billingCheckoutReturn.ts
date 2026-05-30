import type { WorkspaceBillingSummary } from '@/api/types';

export type BillingCheckoutSnapshot = {
  planKey: string;
  activeAddonCount: number;
  topUpCreditsRemaining: number;
};

export function captureBillingCheckoutSnapshot(
  summary: WorkspaceBillingSummary,
): BillingCheckoutSnapshot {
  return {
    planKey: summary.plan.key,
    activeAddonCount: summary.entitlements.activeAddons.length,
    topUpCreditsRemaining: summary.entitlements.topUpCreditsRemaining,
  };
}

/** True when billing summary reflects a post-checkout change (plan, add-on, or top-up). */
export function billingCheckoutChangesApplied(
  before: BillingCheckoutSnapshot | null,
  after: WorkspaceBillingSummary | null,
): boolean {
  if (!before || !after) return false;
  const afterSnap = captureBillingCheckoutSnapshot(after);
  if (afterSnap.planKey !== before.planKey && afterSnap.planKey !== 'free') return true;
  if (afterSnap.activeAddonCount > before.activeAddonCount) return true;
  if (afterSnap.topUpCreditsRemaining > before.topUpCreditsRemaining) return true;
  return false;
}
