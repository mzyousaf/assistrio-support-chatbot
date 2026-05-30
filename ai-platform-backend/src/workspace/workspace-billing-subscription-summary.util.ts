import type { BillingProvider } from '../billing/billing-provider.types';
import { isPaidSubscriptionEntitled } from '../entitlements/workspace-effective-subscription.util';
import type { WorkspaceSubscriptionStatus } from '../models/workspace-subscription.schema';
import { toCustomerSafePaymentMethod } from '../billing/billing-payment-method.util';
import type {
  WorkspaceBillingPaymentMethodSummary,
  WorkspaceBillingSubscriptionSummary,
} from './workspace-billing-summary.types';

export type SubscriptionDocForBillingSummary = {
  planKey: string;
  status: WorkspaceSubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  provider?: BillingProvider | null;
  providerSubscriptionId?: string | null;
  cancelAtPeriodEnd?: boolean;
  paymentMethod?: WorkspaceBillingPaymentMethodSummary | null;
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
  };
}
