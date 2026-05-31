import type { BillingInterval } from '../billing/billing-interval.types';
import { parseBillingInterval } from '../billing/billing-interval.types';

export const SCHEDULED_INTERVAL_CHANGE_STATUSES = ['scheduled', 'applied', 'canceled'] as const;
export type ScheduledIntervalChangeStatus = (typeof SCHEDULED_INTERVAL_CHANGE_STATUSES)[number];

export type ScheduledIntervalChangeRecord = {
  fromBillingInterval: BillingInterval;
  toBillingInterval: BillingInterval;
  effectiveAt: Date | string;
  status: ScheduledIntervalChangeStatus;
  appliedAt?: Date | string | null;
};

export function readScheduledIntervalChange(
  value: ScheduledIntervalChangeRecord | null | undefined,
): ScheduledIntervalChangeRecord | null {
  if (!value || typeof value !== 'object') return null;
  const fromBillingInterval = parseBillingInterval(value.fromBillingInterval);
  const toBillingInterval = parseBillingInterval(value.toBillingInterval);
  const status = String(value.status ?? '').trim() as ScheduledIntervalChangeStatus;
  if (!SCHEDULED_INTERVAL_CHANGE_STATUSES.includes(status)) return null;
  const effectiveAt = value.effectiveAt instanceof Date ? value.effectiveAt : new Date(value.effectiveAt);
  if (Number.isNaN(effectiveAt.getTime())) return null;
  return {
    fromBillingInterval,
    toBillingInterval,
    effectiveAt,
    status,
    appliedAt: value.appliedAt ?? null,
  };
}

export function shouldApplyScheduledIntervalChange(
  addon: { scheduledIntervalChange?: ScheduledIntervalChangeRecord | null },
  now: Date = new Date(),
): ScheduledIntervalChangeRecord | null {
  const scheduled = readScheduledIntervalChange(addon.scheduledIntervalChange ?? null);
  if (scheduled?.status !== 'scheduled') return null;
  const effectiveAt =
    scheduled.effectiveAt instanceof Date
      ? scheduled.effectiveAt
      : new Date(scheduled.effectiveAt);
  if (Number.isNaN(effectiveAt.getTime()) || effectiveAt > now) return null;
  return scheduled;
}

export function resolveActiveScheduledIntervalChangeForSummary(
  addon: { scheduledIntervalChange?: ScheduledIntervalChangeRecord | null },
  now: Date = new Date(),
): ScheduledIntervalChangeRecord | null {
  const scheduled = readScheduledIntervalChange(addon.scheduledIntervalChange ?? null);
  if (scheduled?.status !== 'scheduled') return null;
  const effectiveAt =
    scheduled.effectiveAt instanceof Date
      ? scheduled.effectiveAt
      : new Date(scheduled.effectiveAt);
  if (Number.isNaN(effectiveAt.getTime()) || effectiveAt <= now) return null;
  return scheduled;
}

export function resolveEffectiveAddonBillingInterval(
  addon: {
    billingInterval?: BillingInterval | null;
    scheduledIntervalChange?: ScheduledIntervalChangeRecord | null;
  },
  now: Date = new Date(),
): BillingInterval {
  const current = parseBillingInterval(addon.billingInterval);
  const scheduled = readScheduledIntervalChange(addon.scheduledIntervalChange ?? null);
  if (scheduled?.status === 'scheduled') {
    const effectiveAt =
      scheduled.effectiveAt instanceof Date
        ? scheduled.effectiveAt
        : new Date(scheduled.effectiveAt);
    if (!Number.isNaN(effectiveAt.getTime()) && effectiveAt > now) {
      return scheduled.fromBillingInterval;
    }
    return scheduled.toBillingInterval;
  }
  return current;
}
