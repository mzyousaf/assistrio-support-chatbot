import { createHmac } from 'node:crypto';
import { Logger } from '@nestjs/common';
import {
  buildLemonCheckoutCustomDataForTest,
  extractLemonInvoiceGenerationErrorReason,
  LemonSqueezyProvider,
} from './lemon-squeezy.provider';

describe('LemonSqueezyProvider', () => {
  const fullConfig = {
    lemonSqueezyApiKey: 'api-key',
    lemonSqueezyStoreId: '12345',
    lemonSqueezyWebhookSecret: 'whsec_test',
    customerAppBaseUrl: 'https://app.assistrio.com',
    lemonSqueezyStarterMonthlyVariantId: '111',
    lemonSqueezyStarterYearlyVariantId: '112',
    lemonSqueezyProMonthlyVariantId: '222',
    lemonSqueezyProYearlyVariantId: '223',
    lemonSqueezyAddonExtraBotMonthlyVariantId: '333',
    lemonSqueezyAddonExtraBotYearlyVariantId: '334',
    lemonSqueezyAddonRemoveBrandingMonthlyVariantId: '444',
    lemonSqueezyAddonRemoveBrandingYearlyVariantId: '445',
    lemonSqueezyTopup1000CreditsVariantId: '777',
  };

  function createProvider(config: Record<string, string> = fullConfig) {
    const configService = {
      get: jest.fn((key: string) => config[key] ?? ''),
    };
    return new LemonSqueezyProvider(configService as never);
  }

  it('builds checkout custom_data with workspace and checkout metadata', () => {
    const custom = buildLemonCheckoutCustomDataForTest({
      workspaceId: '507f1f77bcf86cd799439011',
      userId: '507f1f77bcf86cd799439012',
      checkoutType: 'plan',
      internalRequestId: 'req-abc',
      planKey: 'starter',
    });
    expect(custom).toEqual({
      workspaceId: '507f1f77bcf86cd799439011',
      userId: '507f1f77bcf86cd799439012',
      checkoutType: 'plan',
      internalRequestId: 'req-abc',
      planKey: 'starter',
    });
  });

  it('sends correct custom_data in subscription checkout API request', async () => {
    const provider = createProvider();
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { attributes: { url: 'https://store.lemonsqueezy.com/checkout/x' } } }),
    });
    global.fetch = fetchMock as never;

    await provider.createSubscriptionCheckout({
      workspaceId: '507f1f77bcf86cd799439011',
      userId: '507f1f77bcf86cd799439012',
      planKey: 'starter',
      internalRequestId: 'req-1',
    });

    const body = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    expect(body.data.attributes.checkout_data.custom).toMatchObject({
      workspaceId: '507f1f77bcf86cd799439011',
      userId: '507f1f77bcf86cd799439012',
      checkoutType: 'plan',
      planKey: 'starter',
      internalRequestId: 'req-1',
    });
    expect(body.data.relationships.variant.data.id).toBe('111');
  });

  it('rejects invalid webhook signature', () => {
    const provider = createProvider();
    const rawBody = Buffer.from('{"meta":{"event_name":"order_created"}}');
    expect(provider.verifyWebhookSignature(rawBody, { 'x-signature': 'bad' })).toBe(false);
  });

  it('accepts valid webhook signature', () => {
    const provider = createProvider();
    const rawBody = Buffer.from('{"meta":{"event_name":"order_created"}}');
    const sig = createHmac('sha256', 'whsec_test').update(rawBody).digest('hex');
    expect(provider.verifyWebhookSignature(rawBody, { 'x-signature': sig })).toBe(true);
  });

  it('maps order_created to order record and top-up credit actions', async () => {
    const provider = createProvider();
    const rawBody = Buffer.from(
      JSON.stringify({
        meta: {
          event_name: 'order_created',
          custom_data: {
            workspaceId: '507f1f77bcf86cd799439011',
            checkoutType: 'top_up',
            topUpKey: 'ai_credits_1000',
          },
        },
        data: {
          type: 'orders',
          id: 'order-99',
          attributes: {
            total: 3000,
            currency: 'USD',
            status: 'paid',
            created_at: '2026-05-02T00:00:00.000Z',
            urls: { receipt: 'https://app.lemonsqueezy.com/receipt/order-99' },
          },
        },
      }),
    );
    const event = provider.parseWebhook(rawBody, { 'x-event-name': 'order_created' });
    const action = await provider.mapWebhookEvent(event);
    expect(action).toEqual([
      expect.objectContaining({
        kind: 'order_record',
        workspaceId: '507f1f77bcf86cd799439011',
        providerOrderId: 'order-99',
        checkoutType: 'top_up',
        topUpKey: 'ai_credits_1000',
        amountCents: 3000,
        invoiceUrl: null,
        receiptUrl: 'https://app.lemonsqueezy.com/receipt/order-99',
      }),
      expect.objectContaining({
        kind: 'top_up_credit',
        workspaceId: '507f1f77bcf86cd799439011',
        providerOrderId: 'order-99',
        creditsPurchased: 1000,
      }),
    ]);
  });

  it('maps plan order_created to order record action', async () => {
    const provider = createProvider();
    const rawBody = Buffer.from(
      JSON.stringify({
        meta: {
          event_name: 'order_created',
          custom_data: {
            workspaceId: '507f1f77bcf86cd799439011',
            checkoutType: 'plan',
            planKey: 'starter',
          },
        },
        data: {
          type: 'orders',
          id: 'order-plan',
          attributes: {
            total: 4900,
            currency: 'USD',
            status: 'paid',
            subscription_id: 'sub-plan',
            created_at: '2026-05-01T00:00:00.000Z',
          },
        },
      }),
    );
    const event = provider.parseWebhook(rawBody, { 'x-event-name': 'order_created' });
    const action = await provider.mapWebhookEvent(event);
    expect(action).toMatchObject({
      kind: 'order_record',
      checkoutType: 'plan',
      planKey: 'starter',
      providerOrderId: 'order-plan',
      providerSubscriptionId: 'sub-plan',
      amountCents: 4900,
    });
  });

  it('maps subscription_created to subscription sync', async () => {
    const provider = createProvider();
    const rawBody = Buffer.from(
      JSON.stringify({
        meta: {
          event_name: 'subscription_created',
          custom_data: {
            workspaceId: '507f1f77bcf86cd799439011',
            checkoutType: 'plan',
            planKey: 'pro',
          },
        },
        data: {
          type: 'subscriptions',
          id: 'sub-1',
          attributes: {
            status: 'active',
            customer_id: 42,
            variant_id: 222,
            renews_at: '2026-06-01T00:00:00.000Z',
            created_at: '2026-05-01T00:00:00.000Z',
          },
        },
      }),
    );
    const event = provider.parseWebhook(rawBody, { 'x-event-name': 'subscription_created' });
    const action = await provider.mapWebhookEvent(event);
    expect(action).toMatchObject({
      kind: 'subscription_sync',
      workspaceId: '507f1f77bcf86cd799439011',
      planKey: 'pro',
      providerSubscriptionId: 'sub-1',
      status: 'active',
    });
  });

  it('maps add-on subscription_created to addon sync only', async () => {
    const provider = createProvider();
    const rawBody = Buffer.from(
      JSON.stringify({
        meta: {
          event_name: 'subscription_created',
          custom_data: {
            workspaceId: '507f1f77bcf86cd799439011',
            checkoutType: 'addon',
            addonKey: 'extra_bot',
          },
        },
        data: {
          type: 'subscriptions',
          id: 'sub-addon-bot',
          attributes: {
            status: 'active',
            customer_id: 42,
            variant_id: 333,
            renews_at: '2026-06-01T00:00:00.000Z',
            created_at: '2026-05-01T00:00:00.000Z',
          },
        },
      }),
    );
    const event = provider.parseWebhook(rawBody, { 'x-event-name': 'subscription_created' });
    const action = await provider.mapWebhookEvent(event);
    expect(action).toEqual(
      expect.objectContaining({
        kind: 'addon_sync',
        workspaceId: '507f1f77bcf86cd799439011',
        addonKey: 'extra_bot',
        status: 'active',
        providerSubscriptionId: 'sub-addon-bot',
        providerVariantId: '333',
        providerCustomerId: '42',
        billingInterval: 'monthly',
        currentPeriodStart: expect.any(Date),
        currentPeriodEnd: expect.any(Date),
        cancelAtPeriodEnd: false,
      }),
    );
  });

  it('maps subscription_payment_success invoice to subscription sync via provider fetch', async () => {
    const provider = createProvider();
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            attributes: {
              status: 'active',
              customer_id: 42,
              variant_id: 111,
              created_at: '2026-05-01T00:00:00.000Z',
              renews_at: '2026-06-01T00:00:00.000Z',
              cancelled: false,
            },
          },
        }),
      });
    global.fetch = fetchMock as never;

    const rawBody = Buffer.from(
      JSON.stringify({
        meta: {
          event_name: 'subscription_payment_success',
          custom_data: {
            workspaceId: '507f1f77bcf86cd799439011',
            checkoutType: 'plan',
            planKey: 'starter',
          },
        },
        data: {
          type: 'subscription-invoices',
          id: 'invoice-1',
          attributes: {
            subscription_id: '2206148',
          },
        },
      }),
    );
    const event = provider.parseWebhook(rawBody, { 'x-event-name': 'subscription_payment_success' });
    const action = await provider.mapWebhookEvent(event);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.lemonsqueezy.com/v1/subscriptions/2206148',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(action).toMatchObject({
      kind: 'subscription_sync',
      workspaceId: '507f1f77bcf86cd799439011',
      planKey: 'starter',
      providerSubscriptionId: '2206148',
      status: 'active',
    });
  });

  it('restoreSubscription PATCHes cancelled=false', async () => {
    const provider = createProvider();
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            id: '2206148',
            attributes: {
              status: 'active',
              cancelled: false,
              variant_id: 111,
              renews_at: '2026-08-01T00:00:00.000Z',
            },
          },
        }),
      });
    global.fetch = fetchMock as never;

    const snapshot = await provider.restoreSubscription({ providerSubscriptionId: '2206148' });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.lemonsqueezy.com/v1/subscriptions/2206148',
      expect.objectContaining({ method: 'PATCH' }),
    );
    const body = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    expect(body.data.attributes.cancelled).toBe(false);
    expect(snapshot.cancelAtPeriodEnd).toBe(false);
  });

  it('listSubscriptionInvoices maps cents, invoice URL, and billing reason', async () => {
    const provider = createProvider();
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            id: 'inv-99',
            attributes: {
              total: 4900,
              currency: 'USD',
              status: 'paid',
              billing_reason: 'initial',
              created_at: '2026-05-01T00:00:00.000Z',
              urls: { invoice_url: 'https://app.lemonsqueezy.com/invoice/abc' },
            },
          },
        ],
      }),
    });
    global.fetch = fetchMock as never;

    const rows = await provider.listSubscriptionInvoices('2206148', { planKey: 'starter' });
    expect(rows).toHaveLength(1);
    expect(rows[0].amountCents).toBe(4900);
    expect(rows[0].amountFormatted).toBe('$49.00');
    expect(rows[0].invoiceUrl).toBe('https://app.lemonsqueezy.com/invoice/abc');
    expect(rows[0].description).toBe('Starter subscription started');
    expect(rows[0].description).not.toBe('initial');
    expect(rows[0].source).toBe('lemon_subscription_invoice');
  });

  it('fetchOrderInvoice maps order receipt URL and amount', async () => {
    const provider = createProvider();
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          id: 'order-99',
          attributes: {
            total: 3000,
            currency: 'USD',
            status: 'paid',
            created_at: '2026-05-02T00:00:00.000Z',
            urls: { receipt: 'https://app.lemonsqueezy.com/receipt/order-99' },
            first_order_item: { variant_id: '777' },
          },
        },
      }),
    });
    global.fetch = fetchMock as never;

    const row = await provider.fetchOrderInvoice('order-99');
    expect(row).toMatchObject({
      id: 'order-99',
      amountCents: 3000,
      amountFormatted: '$30.00',
      invoiceUrl: null,
      receiptUrl: 'https://app.lemonsqueezy.com/receipt/order-99',
      providerOrderId: 'order-99',
      source: 'lemon_order',
    });
  });

  it('generateOrderInvoice returns download_invoice URL', async () => {
    const provider = createProvider();
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        meta: {
          urls: {
            download_invoice: 'https://app.lemonsqueezy.com/invoice/download/order-99',
          },
        },
      }),
    });
    global.fetch = fetchMock as never;

    const result = await provider.generateOrderInvoice('order-99', {
      name: 'Jane Doe',
      address: '123 Main St',
      city: 'Anytown',
      state: 'CA',
      zipCode: '90210',
      country: 'US',
    });

    expect(result).toEqual({
      downloadUrl: 'https://app.lemonsqueezy.com/invoice/download/order-99',
    });
    expect(String(fetchMock.mock.calls[0][0])).toContain('/orders/order-99/generate-invoice');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'POST' });
  });

  it('maps zipCode to zip_code for Pakistan addresses', async () => {
    const provider = createProvider();
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        meta: {
          urls: {
            download_invoice: 'https://app.lemonsqueezy.com/invoice/download/order-99',
          },
        },
      }),
    });
    global.fetch = fetchMock as never;

    await provider.generateOrderInvoice('order-99', {
      name: 'Jane Doe',
      address: '123 Mall Road',
      city: 'Lahore',
      state: 'Punjab',
      zipCode: '54000',
      country: 'PK',
    });

    const requestUrl = String(fetchMock.mock.calls[0][0]);
    expect(requestUrl).toContain('zip_code=54000');
    expect(requestUrl).toContain('country=PK');
    expect(requestUrl).toContain('city=Lahore');
  });

  it('extracts safe Lemon validation reason from error response', () => {
    const reason = extractLemonInvoiceGenerationErrorReason(
      JSON.stringify({
        errors: [
          {
            detail: 'The state field is invalid.',
            source: { pointer: '/data/attributes/state' },
          },
        ],
      }),
    );
    expect(reason).toContain('state field is invalid');
    expect(reason).toContain('/data/attributes/state');
  });

  it('logs validation failure metadata without address or API key', async () => {
    const provider = createProvider();
    const debugSpy = jest.spyOn(Logger.prototype, 'debug').mockImplementation();
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 422,
      text: async () =>
        JSON.stringify({
          errors: [{ title: 'Invalid country', detail: 'The country field is invalid.' }],
        }),
    });
    global.fetch = fetchMock as never;

    await expect(
      provider.generateOrderInvoice(
        'order-99',
        {
          name: 'Jane Doe',
          address: '123 Main St',
          city: 'Anytown',
          state: 'CA',
          zipCode: '90210',
          country: 'US',
        },
        { requestId: 'req-lemon-1' },
      ),
    ).rejects.toMatchObject({
      errorCode: 'billing_invoice_generation_failed',
      message: 'The country field is invalid.',
    });

    const requestLog = String(debugSpy.mock.calls[0]?.[0] ?? '');
    expect(requestLog).toContain('lemon_generate_order_invoice_request');
    expect(requestLog).not.toContain('123 Main St');
    expect(requestLog).not.toContain('api-key');

    const responseLog = String(warnSpy.mock.calls[0]?.[0] ?? '');
    expect(responseLog).toContain('lemon_generate_order_invoice_response');
    expect(responseLog).toContain('Invalid country');
    expect(responseLog).toContain('country field is invalid');
    expect(responseLog).not.toContain('download_invoice');
    expect(responseLog).not.toContain('Bearer');

    debugSpy.mockRestore();
    warnSpy.mockRestore();
  });
});

