import { describe, expect, it } from 'vitest';
import { mockBillingSubscription } from '@/lib/billingSummaryFixtures';
import { mockTrialBillingEntitlements } from '@/lib/planEntitlements';
import {
  formatCancelAtPeriodEndMessage,
  formatPastDueBillingWarning,
  formatPlanModalDaysLeftButtonLabel,
  formatPlanModalExpiresOnButtonLabel,
  formatScheduledDowngradeMessage,
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

  it('formats modal days left button label', () => {
    expect(formatPlanModalDaysLeftButtonLabel('2026-06-01T00:00:00.000Z', new Date('2026-05-20T00:00:00.000Z'))).toBe(
      '12 Days Left',
    );
    expect(formatPlanModalDaysLeftButtonLabel('2026-05-21T00:00:00.000Z', new Date('2026-05-20T00:00:00.000Z'))).toBe(
      '1 Day Left',
    );
  });

  it('formats modal trial expiry as Expires on with date', () => {
    const label = formatPlanModalExpiresOnButtonLabel({
      plan: {
        key: 'free',
        name: 'Free',
        priceMonthly: 0,
        status: 'active',
        currentPeriodEnd: '2026-06-01T00:00:00.000Z',
      },
      subscription: mockBillingSubscription({
        currentPeriodEnd: '2026-06-01T00:00:00.000Z',
        hasActivePaidSubscription: false,
      }),
      entitlements: mockTrialBillingEntitlements(),
    });
    expect(label).toMatch(/^Expires on /);
    expect(label).toContain('2026');
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
    expect(message).toContain('Cancellation scheduled');
    expect(message).toContain('remains active until');
  });

  it('formats scheduled downgrade message', () => {
    const message = formatScheduledDowngradeMessage({
      plan: {
        key: 'pro',
        name: 'Pro',
        priceMonthly: 99,
        status: 'active',
        currentPeriodStart: '2026-05-01T00:00:00.000Z',
        currentPeriodEnd: '2026-07-01T00:00:00.000Z',
      },
      subscription: mockBillingSubscription({
        scheduledPlanKey: 'starter',
        scheduledPlanName: 'Starter',
        scheduledPlanEffectiveDate: '2026-07-01T00:00:00.000Z',
      }),
    });
    expect(message).toContain('Downgrade scheduled');
    expect(message).toContain('Starter');
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
