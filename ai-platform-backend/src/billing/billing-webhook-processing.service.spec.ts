import { Types } from 'mongoose';
import { BillingWebhookProcessingService } from './billing-webhook-processing.service';

describe('BillingWebhookProcessingService', () => {
  const workspaceId = '507f1f77bcf86cd799439011';

  it('subscription webhook updates workspace subscription', async () => {
    const subscriptionModel = {
      findOne: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }),
      findOneAndUpdate: jest.fn().mockResolvedValue({}),
    };
    const addonModel = {
      findOne: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }),
      findOneAndUpdate: jest.fn(),
    };
    const topUpModel = { create: jest.fn() };

    const billingOrderModel = { findOneAndUpdate: jest.fn().mockResolvedValue({}) };

    const service = new BillingWebhookProcessingService(
      subscriptionModel as never,
      addonModel as never,
      topUpModel as never,
      billingOrderModel as never,
      { syncFromWebhook: jest.fn() } as never,
    );

    await service.applyAction({
      kind: 'subscription_sync',
      workspaceId,
      planKey: 'starter',
      providerCustomerId: 'cust-1',
      providerSubscriptionId: 'sub-1',
      providerVariantId: '111',
      status: 'active',
      currentPeriodStart: new Date('2026-05-01T00:00:00.000Z'),
      currentPeriodEnd: new Date('2026-06-01T00:00:00.000Z'),
      cancelAtPeriodEnd: false,
    });

    expect(subscriptionModel.findOneAndUpdate).toHaveBeenCalledWith(
      { workspaceId: new Types.ObjectId(workspaceId) },
      expect.objectContaining({
        $set: expect.objectContaining({
          planKey: 'starter',
          provider: 'lemon_squeezy',
          providerSubscriptionId: 'sub-1',
        }),
      }),
      { upsert: true, new: true },
    );
  });

  it('payment_failed webhook sets past_due and stores payment failure metadata', async () => {
    const subscriptionModel = {
      findOne: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue({ planKey: 'starter' }) }),
      findOneAndUpdate: jest.fn().mockResolvedValue({}),
    };
    const addonModel = {
      findOne: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }),
      findOneAndUpdate: jest.fn(),
    };
    const topUpModel = { create: jest.fn() };

    const billingOrderModel = { findOneAndUpdate: jest.fn().mockResolvedValue({}) };

    const service = new BillingWebhookProcessingService(
      subscriptionModel as never,
      addonModel as never,
      topUpModel as never,
      billingOrderModel as never,
      { syncFromWebhook: jest.fn() } as never,
    );

    const failedAt = new Date('2026-05-20T00:00:00.000Z');
    await service.applyAction({
      kind: 'subscription_sync',
      workspaceId,
      planKey: 'starter',
      providerSubscriptionId: 'sub-1',
      status: 'past_due',
      paymentFailure: {
        failedAt,
        invoiceId: 'inv-99',
        invoiceUrl: 'https://invoice.example/inv-99',
        amount: 49,
        currency: 'USD',
        cardBrand: 'visa',
        cardLastFour: '4242',
      },
      paymentMethod: { brand: 'visa', last4: '4242', label: 'Visa ending in 4242' },
    });

    expect(subscriptionModel.findOneAndUpdate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        $set: expect.objectContaining({
          status: 'past_due',
          planKey: 'starter',
          paymentFailure: expect.objectContaining({
            invoiceId: 'inv-99',
            cardBrand: 'visa',
            cardLastFour: '4242',
          }),
          paymentMethod: expect.objectContaining({ last4: '4242' }),
        }),
      }),
      expect.anything(),
    );
    const payload = JSON.stringify(subscriptionModel.findOneAndUpdate.mock.calls[0][1]);
    expect(payload).not.toContain('42424242');
  });

  it('payment_success clears payment failure and sets active', async () => {
    const subscriptionModel = {
      findOne: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          planKey: 'starter',
          status: 'past_due',
          paymentFailure: { failedAt: new Date(), invoiceId: 'inv-1' },
        }),
      }),
      findOneAndUpdate: jest.fn().mockResolvedValue({}),
    };
    const addonModel = {
      findOne: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }),
      findOneAndUpdate: jest.fn(),
    };
    const topUpModel = { create: jest.fn() };

    const billingOrderModel = { findOneAndUpdate: jest.fn().mockResolvedValue({}) };

    const service = new BillingWebhookProcessingService(
      subscriptionModel as never,
      addonModel as never,
      topUpModel as never,
      billingOrderModel as never,
      { syncFromWebhook: jest.fn() } as never,
    );

    await service.applyAction({
      kind: 'subscription_sync',
      workspaceId,
      planKey: 'starter',
      providerSubscriptionId: 'sub-1',
      status: 'active',
      clearPaymentFailure: true,
      paymentMethod: { brand: 'visa', last4: '4242' },
    });

    expect(subscriptionModel.findOneAndUpdate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        $set: expect.objectContaining({
          status: 'active',
          paymentFailure: null,
          paymentMethod: expect.objectContaining({ last4: '4242' }),
        }),
      }),
      expect.anything(),
    );
  });

  it('canceled subscription after period end downgrades planKey to free', async () => {
    const subscriptionModel = {
      findOne: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          planKey: 'pro',
          currentPeriodEnd: new Date('2026-01-01T00:00:00.000Z'),
        }),
      }),
      findOneAndUpdate: jest.fn().mockResolvedValue({}),
    };
    const addonModel = {
      findOne: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }),
      findOneAndUpdate: jest.fn(),
    };
    const topUpModel = { create: jest.fn() };

    const billingOrderModel = { findOneAndUpdate: jest.fn().mockResolvedValue({}) };

    const service = new BillingWebhookProcessingService(
      subscriptionModel as never,
      addonModel as never,
      topUpModel as never,
      billingOrderModel as never,
      { syncFromWebhook: jest.fn() } as never,
    );

    await service.applyAction(
      {
        kind: 'subscription_sync',
        workspaceId,
        planKey: 'pro',
        providerSubscriptionId: 'sub-1',
        status: 'canceled',
        currentPeriodEnd: new Date('2026-01-01T00:00:00.000Z'),
        cancelAtPeriodEnd: false,
      },
      new Date('2026-06-15T00:00:00.000Z'),
    );

    expect(subscriptionModel.findOneAndUpdate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        $set: expect.objectContaining({ planKey: 'free' }),
      }),
      expect.anything(),
    );
  });

  it('order_created top-up creates credit top-up idempotently', async () => {
    const subscriptionModel = { findOneAndUpdate: jest.fn() };
    const addonModel = {
      findOne: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }),
      findOneAndUpdate: jest.fn(),
    };
    const topUpModel = {
      create: jest
        .fn()
        .mockRejectedValueOnce({ code: 11000 })
        .mockResolvedValue({}),
    };

    const billingOrderModel = { findOneAndUpdate: jest.fn().mockResolvedValue({}) };

    const service = new BillingWebhookProcessingService(
      subscriptionModel as never,
      addonModel as never,
      topUpModel as never,
      billingOrderModel as never,
      { syncFromWebhook: jest.fn() } as never,
    );

    const action = {
      kind: 'top_up_credit' as const,
      workspaceId,
      topUpKey: 'ai_credits_1000' as const,
      providerOrderId: 'order-42',
      creditsPurchased: 1000,
    };

    await service.applyAction(action);
    await service.applyAction(action);

    expect(topUpModel.create).toHaveBeenCalledTimes(2);
    expect(topUpModel.create.mock.calls[0][0]).toMatchObject({
      workspaceId: new Types.ObjectId(workspaceId),
      creditsPurchased: 1000,
      creditsRemaining: 1000,
      provider: 'lemon_squeezy',
      providerOrderId: 'order-42',
    });
  });

  it('order_created stores billing order record idempotently', async () => {
    const subscriptionModel = { findOneAndUpdate: jest.fn() };
    const addonModel = {
      findOne: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }),
      findOneAndUpdate: jest.fn(),
    };
    const topUpModel = { create: jest.fn() };
    const billingOrderModel = {
      findOneAndUpdate: jest
        .fn()
        .mockRejectedValueOnce({ code: 11000 })
        .mockResolvedValue({}),
    };

    const service = new BillingWebhookProcessingService(
      subscriptionModel as never,
      addonModel as never,
      topUpModel as never,
      billingOrderModel as never,
      { syncFromWebhook: jest.fn() } as never,
    );

    const action = {
      kind: 'order_record' as const,
      workspaceId,
      providerOrderId: 'order-plan',
      checkoutType: 'plan' as const,
      planKey: 'starter' as const,
      amountCents: 4900,
      currency: 'USD',
      status: 'paid',
      invoiceUrl: 'https://invoice.example/plan',
      orderCreatedAt: new Date('2026-05-01T00:00:00.000Z'),
    };

    await service.applyAction(action);
    await service.applyAction(action);

    expect(billingOrderModel.findOneAndUpdate).toHaveBeenCalledTimes(2);
    expect(billingOrderModel.findOneAndUpdate.mock.calls[0][0]).toEqual({
      providerOrderId: 'order-plan',
    });
  });

  it('add-on webhook creates or updates workspace add-on', async () => {
    const subscriptionModel = { findOneAndUpdate: jest.fn() };
    const addonModel = {
      findOne: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }),
      findOneAndUpdate: jest.fn().mockResolvedValue({}),
    };
    const topUpModel = { create: jest.fn() };

    const billingOrderModel = { findOneAndUpdate: jest.fn().mockResolvedValue({}) };

    const service = new BillingWebhookProcessingService(
      subscriptionModel as never,
      addonModel as never,
      topUpModel as never,
      billingOrderModel as never,
      { syncFromWebhook: jest.fn() } as never,
    );

    await service.applyAction({
      kind: 'addon_sync',
      workspaceId,
      addonKey: 'remove_branding',
      status: 'active',
      providerSubscriptionId: 'sub-addon-1',
      currentPeriodStart: new Date('2026-05-01T00:00:00.000Z'),
      currentPeriodEnd: new Date('2026-06-01T00:00:00.000Z'),
    });

    expect(addonModel.findOneAndUpdate).toHaveBeenCalledWith(
      { provider: 'lemon_squeezy', providerSubscriptionId: 'sub-addon-1' },
      expect.objectContaining({
        $set: expect.objectContaining({
          status: 'active',
          provider: 'lemon_squeezy',
          providerSubscriptionId: 'sub-addon-1',
          addonKey: 'remove_branding',
        }),
      }),
      { upsert: true, new: true },
    );
  });

  it('throws when addon sync lacks providerSubscriptionId', async () => {
    const service = new BillingWebhookProcessingService(
      { findOneAndUpdate: jest.fn() } as never,
      { findOneAndUpdate: jest.fn() } as never,
      { create: jest.fn() } as never,
      { findOneAndUpdate: jest.fn() } as never,
      { syncFromWebhook: jest.fn() } as never,
    );

    await expect(
      service.applyAction({
        kind: 'addon_sync',
        workspaceId,
        addonKey: 'extra_bot',
        status: 'active',
      }),
    ).rejects.toMatchObject({ errorCode: 'billing_addon_provider_subscription_missing' });
  });

  it('treats duplicate providerSubscriptionId upsert as idempotent', async () => {
    const duplicateError = Object.assign(new Error('duplicate'), { code: 11000 });
    const addonModel = {
      findOne: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }),
      findOneAndUpdate: jest.fn().mockRejectedValue(duplicateError),
    };

    const service = new BillingWebhookProcessingService(
      { findOneAndUpdate: jest.fn() } as never,
      addonModel as never,
      { create: jest.fn() } as never,
      { findOneAndUpdate: jest.fn() } as never,
      { syncFromWebhook: jest.fn() } as never,
    );

    await expect(
      service.applyAction({
        kind: 'addon_sync',
        workspaceId,
        addonKey: 'extra_bot',
        status: 'active',
        providerSubscriptionId: 'sub-extra-dup',
      }),
    ).resolves.toBeUndefined();
  });

  it('creates separate extra_bot rows per provider subscription id', async () => {
    const subscriptionModel = { findOneAndUpdate: jest.fn() };
    const addonModel = {
      findOne: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }),
      findOneAndUpdate: jest.fn().mockResolvedValue({}),
    };
    const topUpModel = { create: jest.fn() };
    const billingOrderModel = { findOneAndUpdate: jest.fn().mockResolvedValue({}) };

    const service = new BillingWebhookProcessingService(
      subscriptionModel as never,
      addonModel as never,
      topUpModel as never,
      billingOrderModel as never,
      { syncFromWebhook: jest.fn() } as never,
    );

    await service.applyAction({
      kind: 'addon_sync',
      workspaceId,
      addonKey: 'extra_bot',
      status: 'active',
      providerSubscriptionId: 'sub-extra-1',
    });
    await service.applyAction({
      kind: 'addon_sync',
      workspaceId,
      addonKey: 'extra_bot',
      status: 'active',
      providerSubscriptionId: 'sub-extra-2',
    });

    expect(addonModel.findOneAndUpdate).toHaveBeenCalledTimes(2);
    expect(addonModel.findOneAndUpdate.mock.calls[0][0]).toEqual({
      provider: 'lemon_squeezy',
      providerSubscriptionId: 'sub-extra-1',
    });
    expect(addonModel.findOneAndUpdate.mock.calls[1][0]).toEqual({
      provider: 'lemon_squeezy',
      providerSubscriptionId: 'sub-extra-2',
    });
  });

  it('defers early yearly interval while scheduled plan interval change is pending', async () => {
    const subscriptionModel = {
      findOne: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          planKey: 'starter',
          billingInterval: 'monthly',
          scheduledPlanChange: {
            fromPlanKey: 'starter',
            toPlanKey: 'starter',
            fromBillingInterval: 'monthly',
            toBillingInterval: 'yearly',
            effectiveAt: new Date('2026-07-01T00:00:00.000Z'),
            status: 'scheduled',
          },
        }),
      }),
      findOneAndUpdate: jest.fn().mockResolvedValue({}),
    };
    const addonModel = {
      findOne: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }),
      findOneAndUpdate: jest.fn(),
    };
    const topUpModel = { create: jest.fn() };
    const billingOrderModel = { findOneAndUpdate: jest.fn().mockResolvedValue({}) };

    const service = new BillingWebhookProcessingService(
      subscriptionModel as never,
      addonModel as never,
      topUpModel as never,
      billingOrderModel as never,
      { syncFromWebhook: jest.fn() } as never,
    );

    await service.applyAction(
      {
        kind: 'subscription_sync',
        workspaceId,
        planKey: 'starter',
        billingInterval: 'yearly',
        providerSubscriptionId: 'sub-1',
        providerVariantId: 'yearly-variant',
        status: 'active',
        currentPeriodStart: new Date('2026-05-01T00:00:00.000Z'),
        currentPeriodEnd: new Date('2026-06-01T00:00:00.000Z'),
        cancelAtPeriodEnd: false,
      },
      new Date('2026-05-15T00:00:00.000Z'),
    );

    expect(subscriptionModel.findOneAndUpdate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        $set: expect.objectContaining({
          planKey: 'starter',
          billingInterval: 'monthly',
        }),
      }),
      expect.anything(),
    );
  });

  it('defers early Starter plan while scheduled Pro to Starter downgrade is pending', async () => {
    const subscriptionModel = {
      findOne: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          planKey: 'pro',
          billingInterval: 'monthly',
          scheduledPlanChange: {
            fromPlanKey: 'pro',
            toPlanKey: 'starter',
            fromBillingInterval: 'monthly',
            toBillingInterval: 'monthly',
            effectiveAt: new Date('2026-07-01T00:00:00.000Z'),
            status: 'scheduled',
          },
        }),
      }),
      findOneAndUpdate: jest.fn().mockResolvedValue({}),
    };
    const addonModel = {
      findOne: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }),
      findOneAndUpdate: jest.fn(),
    };
    const topUpModel = { create: jest.fn() };
    const billingOrderModel = { findOneAndUpdate: jest.fn().mockResolvedValue({}) };

    const service = new BillingWebhookProcessingService(
      subscriptionModel as never,
      addonModel as never,
      topUpModel as never,
      billingOrderModel as never,
      { syncFromWebhook: jest.fn() } as never,
    );

    await service.applyAction(
      {
        kind: 'subscription_sync',
        workspaceId,
        planKey: 'starter',
        billingInterval: 'monthly',
        providerSubscriptionId: 'sub-1',
        providerVariantId: 'starter-variant',
        status: 'active',
        currentPeriodStart: new Date('2026-05-01T00:00:00.000Z'),
        currentPeriodEnd: new Date('2026-06-01T00:00:00.000Z'),
        cancelAtPeriodEnd: false,
      },
      new Date('2026-05-15T00:00:00.000Z'),
    );

    expect(subscriptionModel.findOneAndUpdate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        $set: expect.objectContaining({
          planKey: 'pro',
        }),
      }),
      expect.anything(),
    );
  });

  it('does not overwrite plan providerSubscriptionId when subscription sync lacks plan key', async () => {
    const subscriptionModel = {
      findOne: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          planKey: 'starter',
          providerSubscriptionId: 'sub-plan',
          providerVariantId: '111',
        }),
      }),
      findOneAndUpdate: jest.fn().mockResolvedValue({}),
    };
    const addonModel = {
      findOne: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }),
      findOneAndUpdate: jest.fn(),
    };
    const topUpModel = { create: jest.fn() };
    const billingOrderModel = { findOneAndUpdate: jest.fn().mockResolvedValue({}) };

    const service = new BillingWebhookProcessingService(
      subscriptionModel as never,
      addonModel as never,
      topUpModel as never,
      billingOrderModel as never,
      { syncFromWebhook: jest.fn() } as never,
    );

    await service.applyAction({
      kind: 'subscription_sync',
      workspaceId,
      providerCustomerId: 'cust-1',
      providerSubscriptionId: 'sub-addon-1',
      providerVariantId: '555',
      status: 'active',
      currentPeriodStart: new Date('2026-05-01T00:00:00.000Z'),
      currentPeriodEnd: new Date('2026-06-01T00:00:00.000Z'),
      cancelAtPeriodEnd: false,
    });

    expect(subscriptionModel.findOneAndUpdate).toHaveBeenCalledWith(
      { workspaceId: new Types.ObjectId(workspaceId) },
      expect.objectContaining({
        $set: expect.not.objectContaining({
          providerSubscriptionId: 'sub-addon-1',
        }),
      }),
      { upsert: true, new: true },
    );
  });
});
