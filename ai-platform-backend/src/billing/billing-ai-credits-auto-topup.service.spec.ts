import { BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import {
  AUTO_TOPUP_LIMIT_REACHED_CODE,
  AUTO_TOPUP_PACK_CREDITS,
  AUTO_TOPUP_PAYMENT_ISSUE_CODE,
} from './billing-auto-topup.constants';
import { BillingAiCreditsAutoTopUpService } from './billing-ai-credits-auto-topup.service';

describe('BillingAiCreditsAutoTopUpService', () => {
  const workspaceId = '507f1f77bcf86cd799439011';
  const now = new Date(2026, 4, 4, 12, 0, 0, 0);

  function createService(overrides?: {
    subscription?: Record<string, unknown> | null;
    autoTopUp?: Record<string, unknown> | null;
    entitlements?: Record<string, unknown>;
    topUpCreateError?: boolean;
  }) {
    const autoTopUpModel = {
      findOne: jest.fn().mockReturnValue({
        lean: () => ({ exec: () => Promise.resolve(overrides?.autoTopUp ?? null) }),
      }),
      findOneAndUpdate: jest.fn().mockReturnValue({ exec: () => Promise.resolve({}) }),
      updateOne: jest.fn().mockResolvedValue({}),
    };
    const subscriptionModel = {
      findOne: jest.fn().mockReturnValue({
        lean: () => ({ exec: () => Promise.resolve(overrides?.subscription ?? null) }),
      }),
      findOneAndUpdate: jest.fn().mockReturnValue({ exec: () => Promise.resolve({}) }),
    };
    const topUpModel = {
      create: overrides?.topUpCreateError
        ? jest.fn().mockRejectedValue(Object.assign(new Error('dup'), { code: 11000 }))
        : jest.fn().mockResolvedValue({}),
    };
    const billingProviderService = {
      isAutoTopUpCheckoutAvailable: jest.fn().mockReturnValue(true),
      createAutoTopUpCheckout: jest.fn().mockResolvedValue({
        checkoutUrl: 'https://checkout.example/auto',
        provider: 'lemon_squeezy',
      }),
      cancelSubscription: jest.fn().mockResolvedValue({ cancelAtPeriodEnd: false }),
      recordAutoTopUpUsage: jest.fn().mockResolvedValue(undefined),
    };
    const entitlementsService = {
      resolveForWorkspace: jest.fn().mockResolvedValue(
        overrides?.entitlements ?? {
          isTrialExpired: false,
          addonsAllowed: true,
          isTrialPlan: false,
          planKey: 'starter',
        },
      ),
    };

    const service = new BillingAiCreditsAutoTopUpService(
      autoTopUpModel as never,
      subscriptionModel as never,
      topUpModel as never,
      billingProviderService as never,
      entitlementsService as never,
    );

    return { service, topUpModel, autoTopUpModel, billingProviderService };
  }

  it('creates auto top-up credits when enabled and active', async () => {
    const { service, topUpModel } = createService({
      subscription: { aiCreditsAutoTopUpEnabled: true, maxAutoTopUpsPerBillingPeriod: 5 },
      autoTopUp: {
        status: 'active',
        providerSubscriptionId: 'sub-auto',
        providerSubscriptionItemId: 'item-1',
        packsThisBillingPeriod: 0,
        billingPeriodStart: new Date(2026, 4, 1),
      },
    });

    const result = await service.tryFulfillAtCreditGate(workspaceId, 1, now);
    expect(result).toEqual({ ok: true, creditsAdded: AUTO_TOPUP_PACK_CREDITS });
    expect(topUpModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        creditsPurchased: AUTO_TOPUP_PACK_CREDITS,
        source: 'auto_topup',
      }),
    );
  });

  it('does not create credits when auto top-up disabled', async () => {
    const { service, topUpModel } = createService({
      subscription: { aiCreditsAutoTopUpEnabled: false },
    });
    const result = await service.tryFulfillAtCreditGate(workspaceId, 1, now);
    expect(result).toEqual({ ok: false, reason: 'not_enabled' });
    expect(topUpModel.create).not.toHaveBeenCalled();
  });

  it('blocks when max auto top-up packs reached', async () => {
    const { service } = createService({
      subscription: { aiCreditsAutoTopUpEnabled: true, maxAutoTopUpsPerBillingPeriod: 5 },
      autoTopUp: {
        status: 'active',
        providerSubscriptionId: 'sub-auto',
        packsThisBillingPeriod: 5,
        billingPeriodStart: new Date(2026, 4, 1),
      },
    });

    await expect(service.tryFulfillAtCreditGate(workspaceId, 1, now)).rejects.toMatchObject({
      response: { errorCode: AUTO_TOPUP_LIMIT_REACHED_CODE },
    });
  });

  it('blocks when auto top-up subscription is past due', async () => {
    const { service } = createService({
      subscription: { aiCreditsAutoTopUpEnabled: true },
      autoTopUp: { status: 'past_due', providerSubscriptionId: 'sub-auto' },
    });

    await expect(service.tryFulfillAtCreditGate(workspaceId, 1, now)).rejects.toMatchObject({
      response: { errorCode: AUTO_TOPUP_PAYMENT_ISSUE_CODE },
    });
  });

  it('enables auto top-up from webhook sync', async () => {
    const { service, autoTopUpModel } = createService();
    await service.syncFromWebhook(
      {
        workspaceId,
        status: 'active',
        providerSubscriptionId: 'sub-auto',
        enableAutoTopUp: true,
      },
      now,
    );
    expect(autoTopUpModel.findOneAndUpdate).toHaveBeenCalled();
  });

  it('rejects enable checkout on expired free trial', async () => {
    const { service } = createService({
      entitlements: { isTrialExpired: true, addonsAllowed: false, isTrialPlan: true, planKey: 'free' },
    });
    await expect(service.beginEnableCheckout(workspaceId, 'user-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
