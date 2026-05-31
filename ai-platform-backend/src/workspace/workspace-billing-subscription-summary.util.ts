import type { BillingProvider } from '../billing/billing-provider.types';
import { parseBillingInterval } from '../billing/billing-interval.types';
import { isPaidSubscriptionEntitled } from '../entitlements/workspace-effective-subscription.util';
import {
  isScheduledPlanIntervalChangeOnly,
  resolveActiveScheduledPlanChangeForSummary,
} from '../entitlements/workspace-scheduled-plan-change.util';
import { getPlanByKey, type PlanKey } from '../entitlements/plan-catalog';
import type { WorkspaceSubscriptionStatus } from '../models/workspace-subscription.schema';
import { toCustomerSafePaymentMethod } from '../billing/billing-payment-method.util';
import type {
  WorkspaceBillingPaymentMethodSummary,
  WorkspaceBillingSubscriptionSummary,
} from './workspace-billing-summary.types';

export type SubscriptionDocForBillingSummary = {
  planKey: string;
  billingInterval?: string | null;
  status: WorkspaceSubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  provider?: BillingProvider | null;
  providerSubscriptionId?: string | null;
  cancelAtPeriodEnd?: boolean;
  paymentMethod?: WorkspaceBillingPaymentMethodSummary | null;
  scheduledPlanChange?: {
    fromPlanKey: string;
    toPlanKey: string;
    fromBillingInterval?: string | null;
    toBillingInterval?: string | null;
    effectiveAt: Date;
    status: 'scheduled' | 'applied' | 'canceled';
  } | null;
} | null;

export function buildWorkspaceBillingSubscriptionSummary(input: {
  subscription: SubscriptionDocForBillingSummary;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  checkoutConfigured: boolean;
  now?: Date;
}): WorkspaceBillingSubscriptionSummary {
  const now = input.now ?? new Date();
  const sub = input.subscription;
  const subscriptionStatus: WorkspaceSubscriptionStatus = sub?.status ?? 'free';
  const cancelAtPeriodEnd = Boolean(sub?.cancelAtPeriodEnd);
  const provider = sub?.provider ?? null;
  const billingInterval = parseBillingInterval(sub?.billingInterval);

  const hasActivePaidSubscription =
    sub != null &&
    isPaidSubscriptionEntitled(
      {
        planKey: sub.planKey,
        status: sub.status,
        currentPeriodEnd: sub.currentPeriodEnd,
      },
      now,
    );

  const hasProviderSubscription =
    Boolean(sub?.providerSubscriptionId?.trim()) && provider === 'lemon_squeezy';

  const manageBillingAvailable = input.checkoutConfigured && hasProviderSubscription;
  const customerPortalAvailable = manageBillingAvailable;

  const paymentMethod = toCustomerSafePaymentMethod(sub?.paymentMethod ?? null);
  const hasPaymentIssue = subscriptionStatus === 'past_due';

  const suppressScheduledChanges =
    cancelAtPeriodEnd && hasActivePaidSubscription;

  const scheduledChange = sub && !suppressScheduledChanges
    ? resolveActiveScheduledPlanChangeForSummary(
        {
          scheduledPlanChange: sub.scheduledPlanChange
            ? {
                fromPlanKey: sub.scheduledPlanChange.fromPlanKey as PlanKey,
                toPlanKey: sub.scheduledPlanChange.toPlanKey as PlanKey,
                fromBillingInterval: sub.scheduledPlanChange.fromBillingInterval
                  ? parseBillingInterval(sub.scheduledPlanChange.fromBillingInterval)
                  : null,
                toBillingInterval: sub.scheduledPlanChange.toBillingInterval
                  ? parseBillingInterval(sub.scheduledPlanChange.toBillingInterval)
                  : null,
                effectiveAt: sub.scheduledPlanChange.effectiveAt,
                status: sub.scheduledPlanChange.status,
              }
            : null,
        },
        now,
      )
    : null;
  const scheduledTargetPlan = scheduledChange ? getPlanByKey(scheduledChange.toPlanKey) : null;
  const intervalOnly = scheduledChange ? isScheduledPlanIntervalChangeOnly(scheduledChange) : false;

  return {
    provider,
    subscriptionStatus,
    cancelAtPeriodEnd,
    currentPeriodStart: (sub?.currentPeriodStart ?? input.currentPeriodStart).toISOString(),
    currentPeriodEnd: input.currentPeriodEnd.toISOString(),
    hasActivePaidSubscription,
    hasPaymentIssue,
    paymentMethod,
    customerPortalAvailable,
    manageBillingAvailable,
    billingInterval,
    ...(scheduledChange && scheduledTargetPlan && !intervalOnly
      ? {
          scheduledPlanKey: scheduledChange.toPlanKey,
          scheduledPlanName: scheduledTargetPlan.name,
          scheduledPlanEffectiveDate: (
            scheduledChange.effectiveAt instanceof Date
              ? scheduledChange.effectiveAt
              : new Date(scheduledChange.effectiveAt)
          ).toISOString(),
        }
      : {}),
    ...(scheduledChange && intervalOnly && scheduledChange.toBillingInterval
      ? {
          scheduledBillingInterval: scheduledChange.toBillingInterval,
          scheduledFromBillingInterval: scheduledChange.fromBillingInterval ?? billingInterval,
          scheduledBillingIntervalEffectiveDate: (
            scheduledChange.effectiveAt instanceof Date
              ? scheduledChange.effectiveAt
              : new Date(scheduledChange.effectiveAt)
          ).toISOString(),
        }
      : {}),
  };
}
