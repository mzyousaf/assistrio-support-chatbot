import { describe, expect, it } from 'vitest';
import { mockBillingSubscription } from '@/lib/billingSummaryFixtures';
import {
  formatCancelAtPeriodEndMessage,
  formatPastDueBillingWarning,
  shouldShowPlanPricingCard,
} from '@/pages/billing/billingSubscriptionDisplay';
import { resolvePlanCardCheckoutAction } from '@/lib/billingCheckout';

describe('billingSubscriptionDisplay', () => {
  it('shows past_due payment warning copy', () => {
    const message = formatPastDueBillingWarning({
      subscription: mockBillingSubscription({
        subscriptionStatus: 'past_due',
        hasPaymentIssue: true,
      }),
    });
    expect(message).toContain('Payment issue detected');
    expect(message).toContain('update your payment method');
  });

  it('hides Free plan card for paid Starter workspaces', () => {
    expect(
      shouldShowPlanPricingCard({
        planKey: 'free',
        currentPlanKey: 'starter',
        isTrialPlan: false,
      }),
    ).toBe(false);
  });

  it('shows scheduled cancel message when cancel at period end', () => {
    const message = formatCancelAtPeriodEndMessage({
      subscription: mockBillingSubscription({
        cancelAtPeriodEnd: true,
        hasActivePaidSubscription: true,
        currentPeriodEnd: '2026-07-15T00:00:00.000Z',
      }),
    });
    expect(message).toContain('scheduled to cancel on');
    expect(message).not.toContain('initial');
  });
});

describe('paid plan checkout actions', () => {
  it('Pro current plan does not offer Starter checkout downgrade', () => {
    const action = resolvePlanCardCheckoutAction({
      planKey: 'starter',
      currentPlanKey: 'pro',
      isTrialPlan: false,
      checkoutAvailable: true,
      isOwner: true,
    });
    expect(action.canCheckout).toBe(false);
    expect(action.canChangePlan).toBe(true);
    expect(action.label).toBe('Downgrade to Starter');
  });
});
