import type {
  BillingInterval,
  WorkspaceBillingAddonCatalogCard,
  WorkspaceBillingTopUpRow,
} from '@/api/types';
import { formatUsagePeriodDate } from '@/pages/usage/usagePageFormat';

export type AddonDisplayStatus =
  | 'active'
  | 'inactive'
  | 'cancel_at_period_end'
  | 'expired'
  | 'cancelled'
  | 'past_due'
  | 'payment_failed';

export function formatAddonStatusLabel(status: AddonDisplayStatus | string | undefined): string {
  switch (status) {
    case 'active':
      return 'Active';
    case 'inactive':
      return 'Not active';
    case 'cancel_at_period_end':
      return 'Cancels at period end';
    case 'expired':
      return 'Expired';
    case 'cancelled':
      return 'Canceled';
    case 'past_due':
    case 'payment_failed':
      return 'Payment issue';
    default:
      return 'Not active';
  }
}

export function formatAddonBillingIntervalLabel(
  interval: WorkspaceBillingAddonCatalogCard['billingInterval'],
  subscriptionInterval?: BillingInterval,
): string {
  if (interval === 'one_time') return 'One-time purchase';
  if (subscriptionInterval === 'yearly') return 'Annual';
  return 'Monthly';
}

export function formatAddonRenewalLabel(input: {
  billingInterval: WorkspaceBillingAddonCatalogCard['billingInterval'];
  status?: AddonDisplayStatus | string;
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd?: boolean;
}): string | null {
  if (input.billingInterval === 'one_time') return null;
  if (!input.currentPeriodEnd) return null;

  const date = formatUsagePeriodDate(input.currentPeriodEnd);
  if (input.status === 'cancel_at_period_end' || input.cancelAtPeriodEnd) {
    return `Cancels on ${date}`;
  }
  if (input.status === 'active') {
    return `Renews on ${date}`;
  }
  return null;
}

export function formatTopUpExpiryRows(topUps: WorkspaceBillingTopUpRow[]): string | null {
  const nextExpiry = topUps
    .filter((row) => row.creditsRemaining > 0)
    .map((row) => row.expiresAt)
    .sort()[0];
  if (!nextExpiry) return null;
  return `Expires ${formatUsagePeriodDate(nextExpiry)}`;
}

import type { WorkspaceBillingAutoTopUpSummary } from '@/api/types';

export function formatAutoTopUpStatusLabel(
  status: WorkspaceBillingAutoTopUpSummary['status'] | undefined,
): string {
  switch (status) {
    case 'pending':
      return 'Pending activation';
    case 'active':
      return 'Active';
    case 'payment_issue':
      return 'Payment issue';
    case 'scheduled_disable':
      return 'Scheduled to disable';
    default:
      return 'Off';
  }
}

export const AI_CREDITS_TOP_UP_COPY =
  'Monthly credits renew each billing period. Top-up credits remain separate until used or expired.';

export const AI_CREDITS_TOP_UP_USAGE_ORDER_COPY =
  'Monthly credits are used first. Existing top-up credits are used second. Auto top-up runs only when both are exhausted.';

export const AI_CREDITS_SIDEBAR_MONTHLY_TOOLTIP =
  'Credits used vs included in your plan this billing period.';

export const AI_CREDITS_SIDEBAR_TOP_UP_TOOLTIP =
  'Top-up credits are used after monthly credits.';

export function buildAiCreditsSidebarMonthlyTooltip(periodEnd: string | null | undefined): string {
  const resetDate = formatUsagePeriodDate(periodEnd);
  if (resetDate === '—') {
    return `${AI_CREDITS_SIDEBAR_MONTHLY_TOOLTIP} Resets at the next billing period.`;
  }
  return `${AI_CREDITS_SIDEBAR_MONTHLY_TOOLTIP} Resets ${resetDate}.`;
}

export function resolveAddonPurchaseLabel(addon: WorkspaceBillingAddonCatalogCard): string {
  if (addon.key === 'ai_credits_1000') return 'Buy credits';
  if (addon.key === 'extra_bot') return 'Add extra AI Agent';
  if (addon.key === 'remove_branding') return 'Remove Powered by Assistrio';
  return addon.billingInterval === 'one_time' ? 'Buy add-on' : 'Add add-on';
}
