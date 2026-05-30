import {
  resolveMainPlanProviderSubscriptionId,
  shouldFetchMainPlanInvoices,
} from './billing-invoice-main-subscription.util';

describe('billing-invoice-main-subscription.util', () => {
  it('prefers main subscription id when it does not match an add-on subscription', () => {
    const result = resolveMainPlanProviderSubscriptionId({
      subscriptionProviderSubscriptionId: 'sub-plan',
      addonSubscriptionIds: new Set(['sub-addon']),
      planOrderProviderSubscriptionIds: ['sub-plan-order'],
    });

    expect(result).toEqual({ id: 'sub-plan', source: 'subscription' });
  });

  it('recovers plan subscription id from billing order when workspace row points at add-on', () => {
    const result = resolveMainPlanProviderSubscriptionId({
      subscriptionProviderSubscriptionId: 'sub-addon',
      addonSubscriptionIds: new Set(['sub-addon']),
      planOrderProviderSubscriptionIds: ['sub-plan', 'sub-addon'],
    });

    expect(result).toEqual({ id: 'sub-plan', source: 'billing_order' });
  });

  it('reports when main subscription id is missing', () => {
    const result = resolveMainPlanProviderSubscriptionId({
      subscriptionProviderSubscriptionId: null,
      addonSubscriptionIds: new Set(['sub-addon']),
      planOrderProviderSubscriptionIds: [],
    });

    expect(result).toEqual({
      id: '',
      source: 'none',
      skippedReason: 'missing_provider_subscription_id',
    });
  });

  it('allows canceled-at-period-end starter subscriptions to fetch invoices', () => {
    const result = shouldFetchMainPlanInvoices({
      provider: 'lemon_squeezy',
      planKey: 'starter',
      status: 'canceled',
      cancelAtPeriodEnd: true,
      currentPeriodEnd: new Date('2099-01-01T00:00:00.000Z'),
      planSubscriptionId: 'sub-plan',
    });

    expect(result).toEqual({ eligible: true });
  });

  it('skips main fetch when plan subscription id is missing', () => {
    expect(
      shouldFetchMainPlanInvoices({
        provider: 'lemon_squeezy',
        planKey: 'pro',
        status: 'active',
        planSubscriptionId: '',
      }),
    ).toEqual({ eligible: false, skippedReason: 'missing_provider_subscription_id' });
  });
});
