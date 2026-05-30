import {
  resolveStoredOrderItemMatch,
  shouldSkipStoredOrderForSubscriptionInvoice,
  storedBillingOrderToProviderRow,
} from './billing-invoice-order.util';

describe('billing-invoice-order.util', () => {
  it('maps top-up stored order to 1,000 AI credits top-up', () => {
    const row = storedBillingOrderToProviderRow({
      providerOrderId: 'order-top-up',
      checkoutType: 'top_up',
      topUpKey: 'ai_credits_1000',
      amountCents: 3000,
      currency: 'USD',
      status: 'paid',
      invoiceUrl: 'https://receipt.example/top-up',
      orderCreatedAt: new Date('2026-05-02T00:00:00.000Z'),
    });

    expect(row).toMatchObject({
      amountFormatted: '$30.00',
      description: '1,000 AI credits top-up',
      itemType: 'top_up',
      itemKey: 'ai_credits_1000',
      source: 'lemon_order',
    });
  });

  it('maps plan stored order to Starter subscription started', () => {
    const match = resolveStoredOrderItemMatch({
      providerOrderId: 'order-plan',
      checkoutType: 'plan',
      planKey: 'starter',
      amountCents: 4900,
      currency: 'USD',
      status: 'paid',
      orderCreatedAt: new Date('2026-05-01T00:00:00.000Z'),
    });

    expect(match).toMatchObject({
      itemType: 'plan',
      itemKey: 'starter',
      description: 'Starter subscription started',
    });
  });

  it('skips plan order when subscription invoice exists', () => {
    const shouldSkip = shouldSkipStoredOrderForSubscriptionInvoice({
      order: {
        providerOrderId: 'order-plan',
        checkoutType: 'plan',
        planKey: 'starter',
        amountCents: 4900,
        currency: 'USD',
        status: 'paid',
        orderCreatedAt: new Date('2026-05-01T00:00:00.000Z'),
      },
      subscriptionInvoices: [
        {
          id: 'inv-plan',
          provider: 'lemon_squeezy',
          date: '2026-05-01T00:00:00.000Z',
          amount: 49,
          amountCents: 4900,
          amountFormatted: '$49.00',
          currency: 'USD',
          status: 'paid',
          invoiceUrl: 'https://invoice.example/plan',
          receiptUrl: null,
          description: 'Starter subscription started',
          billingReason: 'initial',
          providerSubscriptionId: 'sub-plan',
          providerOrderId: 'order-plan',
        },
      ],
      planSubscriptionId: 'sub-plan',
      addonKeyBySubscriptionId: new Map(),
    });

    expect(shouldSkip).toBe(true);
  });

  it('does not skip top-up order when subscription invoices exist', () => {
    const shouldSkip = shouldSkipStoredOrderForSubscriptionInvoice({
      order: {
        providerOrderId: 'order-top-up',
        checkoutType: 'top_up',
        topUpKey: 'ai_credits_1000',
        amountCents: 3000,
        currency: 'USD',
        status: 'paid',
        orderCreatedAt: new Date('2026-05-02T00:00:00.000Z'),
      },
      subscriptionInvoices: [
        {
          id: 'inv-plan',
          provider: 'lemon_squeezy',
          date: '2026-05-01T00:00:00.000Z',
          amount: 49,
          amountCents: 4900,
          amountFormatted: '$49.00',
          currency: 'USD',
          status: 'paid',
          invoiceUrl: 'https://invoice.example/plan',
          receiptUrl: null,
          description: 'Starter subscription started',
          providerSubscriptionId: 'sub-plan',
        },
      ],
      planSubscriptionId: 'sub-plan',
      addonKeyBySubscriptionId: new Map(),
    });

    expect(shouldSkip).toBe(false);
  });
});
