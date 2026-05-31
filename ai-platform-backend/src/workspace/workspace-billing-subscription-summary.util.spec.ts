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

  it('hides scheduled interval when cancellation is scheduled', () => {
    const periodStart = new Date('2026-06-01T00:00:00.000Z');
    const summary = buildWorkspaceBillingSubscriptionSummary({
      subscription: {
        planKey: 'starter',
        billingInterval: 'monthly',
        status: 'active',
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        provider: 'lemon_squeezy',
        providerSubscriptionId: 'sub-123',
        cancelAtPeriodEnd: true,
        scheduledPlanChange: {
          fromPlanKey: 'starter',
          toPlanKey: 'starter',
          fromBillingInterval: 'monthly',
          toBillingInterval: 'yearly',
          effectiveAt: periodEnd,
          status: 'scheduled',
        },
      },
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      checkoutConfigured: true,
      now,
    });

    expect(summary.scheduledBillingInterval).toBeUndefined();
    expect(summary.cancelAtPeriodEnd).toBe(true);
  });

  it('exposes interval-only scheduled change without scheduled plan key', () => {
    const periodStart = new Date('2026-06-01T00:00:00.000Z');
    const summary = buildWorkspaceBillingSubscriptionSummary({
      subscription: {
        planKey: 'starter',
        billingInterval: 'monthly',
        status: 'active',
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        provider: 'lemon_squeezy',
        providerSubscriptionId: 'sub-123',
        cancelAtPeriodEnd: false,
        scheduledPlanChange: {
          fromPlanKey: 'starter',
          toPlanKey: 'starter',
          fromBillingInterval: 'monthly',
          toBillingInterval: 'yearly',
          effectiveAt: periodEnd,
          status: 'scheduled',
        },
      },
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      checkoutConfigured: true,
      now,
    });

    expect(summary.scheduledBillingInterval).toBe('yearly');
    expect(summary.scheduledPlanKey).toBeUndefined();
  });

  it('exposes downgrade scheduled plan without separate interval banner fields', () => {
    const periodStart = new Date('2026-06-01T00:00:00.000Z');
    const summary = buildWorkspaceBillingSubscriptionSummary({
      subscription: {
        planKey: 'pro',
        billingInterval: 'yearly',
        status: 'active',
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        provider: 'lemon_squeezy',
        providerSubscriptionId: 'sub-123',
        cancelAtPeriodEnd: false,
        scheduledPlanChange: {
          fromPlanKey: 'pro',
          toPlanKey: 'starter',
          fromBillingInterval: 'yearly',
          toBillingInterval: 'monthly',
          effectiveAt: periodEnd,
          status: 'scheduled',
        },
      },
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      checkoutConfigured: true,
      now,
    });

    expect(summary.scheduledPlanKey).toBe('starter');
    expect(summary.scheduledBillingInterval).toBeUndefined();
  });
});
