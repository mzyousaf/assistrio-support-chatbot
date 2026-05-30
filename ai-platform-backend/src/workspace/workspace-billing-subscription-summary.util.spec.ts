import { buildWorkspaceBillingSubscriptionSummary } from './workspace-billing-subscription-summary.util';

describe('buildWorkspaceBillingSubscriptionSummary', () => {
  const periodEnd = new Date('2026-07-01T00:00:00.000Z');
  const now = new Date('2026-06-15T00:00:00.000Z');

  it('exposes safe flags for active paid Lemon subscription', () => {
    const periodStart = new Date('2026-06-01T00:00:00.000Z');
    const summary = buildWorkspaceBillingSubscriptionSummary({
      subscription: {
        planKey: 'starter',
        status: 'active',
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        provider: 'lemon_squeezy',
        providerSubscriptionId: 'sub-123',
        cancelAtPeriodEnd: false,
        paymentMethod: { brand: 'visa', last4: '4242', label: 'Visa ending in 4242' },
      },
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      checkoutConfigured: true,
      now,
    });

    expect(summary).toMatchObject({
      provider: 'lemon_squeezy',
      subscriptionStatus: 'active',
      cancelAtPeriodEnd: false,
      hasActivePaidSubscription: true,
      hasPaymentIssue: false,
      paymentMethod: { brand: 'visa', last4: '4242', label: 'Visa ending in 4242' },
      customerPortalAvailable: true,
      manageBillingAvailable: true,
    });
    expect(summary.currentPeriodEnd).toBe(periodEnd.toISOString());
  });

  it('manage billing unavailable without provider subscription id', () => {
    const periodStart = new Date('2026-06-01T00:00:00.000Z');
    const summary = buildWorkspaceBillingSubscriptionSummary({
      subscription: {
        planKey: 'free',
        status: 'free',
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        provider: null,
        providerSubscriptionId: null,
        cancelAtPeriodEnd: false,
      },
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      checkoutConfigured: true,
      now,
    });

    expect(summary.manageBillingAvailable).toBe(false);
    expect(summary.customerPortalAvailable).toBe(false);
    expect(summary.hasActivePaidSubscription).toBe(false);
  });

  it('flags past_due as payment issue without exposing full card number', () => {
    const periodStart = new Date('2026-06-01T00:00:00.000Z');
    const summary = buildWorkspaceBillingSubscriptionSummary({
      subscription: {
        planKey: 'starter',
        status: 'past_due',
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        provider: 'lemon_squeezy',
        providerSubscriptionId: 'sub-123',
        cancelAtPeriodEnd: false,
        paymentMethod: { brand: 'visa', last4: '4242', label: 'Visa ending in 4242' },
      },
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      checkoutConfigured: true,
      now,
    });

    expect(summary.hasPaymentIssue).toBe(true);
    expect(summary.paymentMethod).toEqual({
      brand: 'visa',
      last4: '4242',
      label: 'Visa ending in 4242',
    });
    expect(JSON.stringify(summary)).not.toMatch(/4242{2,}/);
  });
});
