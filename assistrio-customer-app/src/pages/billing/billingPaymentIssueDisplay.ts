import type { WorkspaceBillingSummary } from '@/api/types';
import { isWorkspaceOwnerRole } from '@/lib/workspaceRoles';

export const BILLING_MANAGE_PAYMENTS_SECTION_ID = 'billing-manage-payments';

export const PAYMENT_ISSUE_RECOVERY_COPY =
  'Please update your payment method to avoid losing access.';

export function hasSubscriptionPaymentIssue(
  summary: Pick<WorkspaceBillingSummary, 'subscription'>,
): boolean {
  const status = String(summary.subscription?.subscriptionStatus ?? '')
    .trim()
    .toLowerCase();
  return status === 'past_due' || Boolean(summary.subscription?.hasPaymentIssue);
}

export function isAddonPaymentIssueStatus(status: string | undefined): boolean {
  const normalized = String(status ?? '')
    .trim()
    .toLowerCase();
  return normalized === 'past_due' || normalized === 'payment_failed';
}

export function canOpenBillingCustomerPortal(input: {
  role: string | null | undefined;
  summary: Pick<WorkspaceBillingSummary, 'subscription'>;
  checkoutEnabled: boolean;
}): boolean {
  if (!input.checkoutEnabled || !isWorkspaceOwnerRole(input.role)) return false;
  const sub = input.summary.subscription;
  return Boolean(sub.customerPortalAvailable || sub.manageBillingAvailable);
}
