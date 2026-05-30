import type { WorkspaceBillingSummary } from '@/api/types';
import { formatUsagePeriodDate } from '@/pages/usage/usagePageFormat';

export function formatBillingSubscriptionStatusLabel(
  summary: Pick<WorkspaceBillingSummary, 'plan' | 'subscription' | 'entitlements'>,
): string {
  const status = String(summary.subscription?.subscriptionStatus ?? summary.plan.status ?? '')
    .trim()
    .toLowerCase();

  if (
    summary.subscription?.cancelAtPeriodEnd &&
    summary.subscription.hasActivePaidSubscription
  ) {
    return 'Cancels at period end';
  }

  if (status === 'free' || status === 'trialing') {
    return summary.entitlements.isTrialPlan ? 'Free trial' : 'Free';
  }
  if (status === 'active') return 'Active';
  if (status === 'past_due') return 'Past due';
  if (status === 'canceled') {
    return summary.subscription?.hasActivePaidSubscription ? 'Cancels at period end' : 'Canceled';
  }
  if (status === 'unpaid') return 'Unpaid';

  if (!status) return 'Unknown';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function formatCancelAtPeriodEndMessage(
  summary: Pick<WorkspaceBillingSummary, 'subscription'>,
): string | null {
  if (!summary.subscription?.cancelAtPeriodEnd || !summary.subscription.hasActivePaidSubscription) {
    return null;
  }
  const date = formatUsagePeriodDate(summary.subscription.currentPeriodEnd);
  return `Your subscription is scheduled to cancel on ${date}.`;
}

export function canRestoreSubscription(
  summary: Pick<WorkspaceBillingSummary, 'subscription'>,
  now: Date = new Date(),
): boolean {
  const sub = summary.subscription;
  if (!sub.hasActivePaidSubscription) return false;
  if (!sub.cancelAtPeriodEnd && sub.subscriptionStatus !== 'canceled') return false;
  const endRaw = sub.currentPeriodEnd;
  if (!endRaw) return false;
  const end = new Date(endRaw);
  return !Number.isNaN(end.getTime()) && end > now;
}

export function formatPastDueBillingWarning(
  summary: Pick<WorkspaceBillingSummary, 'subscription'>,
): string | null {
  if (
    summary.subscription?.subscriptionStatus !== 'past_due' &&
    !summary.subscription?.hasPaymentIssue
  ) {
    return null;
  }
  return 'Payment issue detected. Please update your payment method to avoid losing access.';
}

export function formatBillingRenewsOrEndsLabel(
  summary: Pick<WorkspaceBillingSummary, 'plan' | 'subscription' | 'entitlements'>,
): string | null {
  const end = summary.subscription?.currentPeriodEnd ?? summary.plan.currentPeriodEnd;
  if (!end) return null;
  const date = formatUsagePeriodDate(end);
  if (summary.subscription?.cancelAtPeriodEnd && summary.subscription.hasActivePaidSubscription) {
    return `Ends on ${date}`;
  }
  if (summary.entitlements.isTrialPlan) {
    return `Trial ends ${date}`;
  }
  if (summary.subscription?.hasActivePaidSubscription) {
    return `Renews on ${date}`;
  }
  return `Billing period ends ${date}`;
}

export function shouldShowPlanPricingCard(input: {
  planKey: string;
  currentPlanKey: string;
  isTrialPlan: boolean;
}): boolean {
  if (input.planKey !== 'free') return true;
  if (input.currentPlanKey === 'starter' || input.currentPlanKey === 'pro') return false;
  return true;
}

