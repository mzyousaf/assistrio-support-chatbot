import type { WorkspaceBillingAddonCatalogCard, WorkspaceBillingTopUpRow } from '@/api/types';
import { formatUsagePeriodDate } from '@/pages/usage/usagePageFormat';

export type AddonDisplayStatus =
  | 'active'
  | 'inactive'
  | 'cancel_at_period_end'
  | 'expired'
  | 'cancelled';

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
    default:
      return 'Not active';
  }
}

export function formatAddonBillingIntervalLabel(
  interval: WorkspaceBillingAddonCatalogCard['billingInterval'],
): string {
  return interval === 'one_time' ? 'One-time purchase' : 'Monthly';
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
    return `Ends on ${date}`;
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

export const AI_CREDITS_TOP_UP_COPY =
  'Monthly credits renew each billing period. Top-up credits remain separate until used or expired.';

export const AI_CREDITS_TOP_UP_USAGE_ORDER_COPY =
  'Top-up credits are used only after monthly plan credits are used.';

export const AI_CREDITS_SIDEBAR_TOP_UP_TOOLTIP =
  'Top-up credits are used after monthly credits.';

export function resolveAddonPurchaseLabel(addon: WorkspaceBillingAddonCatalogCard): string {
  if (addon.key === 'ai_credits_1000') return 'Buy credits';
  return addon.billingInterval === 'one_time' ? 'Buy add-on' : 'Add add-on';
}
