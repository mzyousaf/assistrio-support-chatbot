import type { PlanKey } from './plan-catalog';
import type { WorkspaceSubscriptionStatus } from '../models/workspace-subscription.schema';
import { resolveEntitlementPlanKey } from './workspace-scheduled-plan-change.util';

export type SubscriptionForEffectivePlan = {
  planKey: string;
  status: WorkspaceSubscriptionStatus;
  currentPeriodEnd?: Date | null;
  scheduledPlanChange?: {
    fromPlanKey: PlanKey;
    toPlanKey: PlanKey;
    effectiveAt: Date | string;
    status: 'scheduled' | 'applied' | 'canceled';
  } | null;
};

const PAID_PLAN_KEYS = new Set<string>(['starter', 'pro']);

const ACTIVE_PAID_STATUSES = new Set<WorkspaceSubscriptionStatus>([
  'active',
  'trialing',
  'past_due',
]);

/**
 * Paid Starter/Pro entitlements apply while status is active-ish, or during cancel-at-period-end grace.
 */
export function isPaidSubscriptionEntitled(
  subscription: SubscriptionForEffectivePlan,
  now: Date = new Date(),
): boolean {
  if (!PAID_PLAN_KEYS.has(subscription.planKey)) return false;
  if (ACTIVE_PAID_STATUSES.has(subscription.status)) return true;
  if (subscription.status === 'canceled') {
    const end = subscription.currentPeriodEnd;
    return Boolean(end && end > now);
  }
  return false;
}

/** Plan tier used for limits, credits, and trial flags (may differ from stored planKey after cancel/expiry). */
export function resolveEffectivePlanKey(
  subscription: SubscriptionForEffectivePlan | null,
  now: Date = new Date(),
): PlanKey {
  if (!subscription) return 'free';
  const entitlementPlanKey = resolveEntitlementPlanKey(subscription, now);
  if (
    isPaidSubscriptionEntitled(
      { ...subscription, planKey: entitlementPlanKey },
      now,
    )
  ) {
    return entitlementPlanKey;
  }
  return 'free';
}

/**
 * After paid subscription ends, workspace is treated as Free trial-ended (blocked) unless still in trial window.
 */
export function resolveIsTrialExpiredForEffectivePlan(
  subscription: SubscriptionForEffectivePlan | null,
  effectivePlanKey: PlanKey,
  now: Date = new Date(),
): boolean {
  if (effectivePlanKey !== 'free') return false;
  if (!subscription) return false;
  if (subscription.planKey === 'free' && subscription.status === 'trialing') {
    const end = subscription.currentPeriodEnd;
    return Boolean(end && end <= now);
  }
  if (PAID_PLAN_KEYS.has(subscription.planKey) && !isPaidSubscriptionEntitled(subscription, now)) {
    return true;
  }
  return false;
}
