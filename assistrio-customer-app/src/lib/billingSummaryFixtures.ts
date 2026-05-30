import type { WorkspaceBillingSubscriptionSummary } from '@/api/types';

export function mockBillingSubscription(
  overrides?: Partial<WorkspaceBillingSubscriptionSummary>,
): WorkspaceBillingSubscriptionSummary {
  return {
    provider: null,
    subscriptionStatus: 'free',
    cancelAtPeriodEnd: false,
    currentPeriodStart: '2026-05-01T00:00:00.000Z',
    currentPeriodEnd: '2026-06-01T00:00:00.000Z',
    hasActivePaidSubscription: false,
    hasPaymentIssue: false,
    paymentMethod: null,
    customerPortalAvailable: false,
    manageBillingAvailable: false,
    ...overrides,
  };
}
