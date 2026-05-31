import type { BillingInterval } from '../billing/billing-interval.types';
import { parseBillingInterval } from '../billing/billing-interval.types';
import type { PlanKey } from './plan-catalog';

export const SCHEDULED_PLAN_CHANGE_STATUSES = ['scheduled', 'applied', 'canceled'] as const;
export type ScheduledPlanChangeStatus = (typeof SCHEDULED_PLAN_CHANGE_STATUSES)[number];

export type ScheduledPlanChangeRecord = {
  fromPlanKey: PlanKey;
  toPlanKey: PlanKey;
  fromBillingInterval?: BillingInterval | null;
  toBillingInterval?: BillingInterval | null;
  effectiveAt: Date | string;
  status: ScheduledPlanChangeStatus;
  appliedAt?: Date | string | null;
};

function parseOptionalBillingInterval(value: unknown): BillingInterval | null {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) return null;
  return parseBillingInterval(normalized);
}

export function readScheduledPlanChange(
  value: ScheduledPlanChangeRecord | null | undefined,
): ScheduledPlanChangeRecord | null {
  if (!value || typeof value !== 'object') return null;
  const fromPlanKey = String(value.fromPlanKey ?? '').trim();
  const toPlanKey = String(value.toPlanKey ?? '').trim();
  const status = String(value.status ?? '').trim() as ScheduledPlanChangeStatus;
  if (!fromPlanKey || !toPlanKey || !SCHEDULED_PLAN_CHANGE_STATUSES.includes(status)) {
    return null;
  }
  const effectiveAt = value.effectiveAt instanceof Date ? value.effectiveAt : new Date(value.effectiveAt);
  if (Number.isNaN(effectiveAt.getTime())) return null;
  return {
    fromPlanKey: fromPlanKey as PlanKey,
    toPlanKey: toPlanKey as PlanKey,
    fromBillingInterval: parseOptionalBillingInterval(value.fromBillingInterval),
    toBillingInterval: parseOptionalBillingInterval(value.toBillingInterval),
    effectiveAt,
    status,
    appliedAt: value.appliedAt ?? null,
  };
}

/** Entitlement tier before lazy DB apply: keep current plan until effectiveAt, then target plan. */
export function resolveEntitlementPlanKey(
  subscription: { planKey: string; scheduledPlanChange?: ScheduledPlanChangeRecord | null },
  now: Date = new Date(),
): PlanKey {
  const scheduled = readScheduledPlanChange(subscription.scheduledPlanChange ?? null);
  if (scheduled?.status === 'scheduled') {
    const effectiveAt =
      scheduled.effectiveAt instanceof Date
        ? scheduled.effectiveAt
        : new Date(scheduled.effectiveAt);
    if (!Number.isNaN(effectiveAt.getTime()) && effectiveAt > now) {
      return scheduled.fromPlanKey;
    }
    return scheduled.toPlanKey;
  }
  return subscription.planKey as PlanKey;
}

export function shouldApplyScheduledPlanChange(
  subscription: { scheduledPlanChange?: ScheduledPlanChangeRecord | null },
  now: Date = new Date(),
): ScheduledPlanChangeRecord | null {
  const scheduled = readScheduledPlanChange(subscription.scheduledPlanChange ?? null);
  if (scheduled?.status !== 'scheduled') return null;
  const effectiveAt =
    scheduled.effectiveAt instanceof Date
      ? scheduled.effectiveAt
      : new Date(scheduled.effectiveAt);
  if (Number.isNaN(effectiveAt.getTime()) || effectiveAt > now) return null;
  return scheduled;
}

export function resolveActiveScheduledPlanChangeForSummary(
  subscription: { scheduledPlanChange?: ScheduledPlanChangeRecord | null },
  now: Date = new Date(),
): ScheduledPlanChangeRecord | null {
  const scheduled = readScheduledPlanChange(subscription.scheduledPlanChange ?? null);
  if (scheduled?.status !== 'scheduled') return null;
  const effectiveAt =
    scheduled.effectiveAt instanceof Date
      ? scheduled.effectiveAt
      : new Date(scheduled.effectiveAt);
  if (Number.isNaN(effectiveAt.getTime()) || effectiveAt <= now) return null;
  return scheduled;
}

export function isScheduledPlanIntervalChangeOnly(scheduled: ScheduledPlanChangeRecord): boolean {
  return (
    scheduled.fromPlanKey === scheduled.toPlanKey &&
    Boolean(scheduled.fromBillingInterval) &&
    Boolean(scheduled.toBillingInterval) &&
    scheduled.fromBillingInterval !== scheduled.toBillingInterval
  );
}
