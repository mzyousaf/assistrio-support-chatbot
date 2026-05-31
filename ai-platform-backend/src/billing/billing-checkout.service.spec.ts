import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Types } from 'mongoose';
import { BillingCheckoutService } from './billing-checkout.service';
import {
  mockFreeWorkspaceEntitlements,
  mockStarterWorkspaceEntitlements,
} from '../entitlements/test/workspace-entitlements.fixture';

describe('BillingCheckoutService', () => {
  const workspaceId = '507f1f77bcf86cd799439011';
  const userId = '507f1f77bcf86cd799439012';

  function createService(options?: {
    subscription?: {
      planKey: 'free' | 'starter' | 'pro';
      status: 'free' | 'active' | 'trialing';
    } | null;
    checkoutConfigured?: boolean;
  }) {
    const billingProviderService = {
      assertCheckoutConfigured: jest.fn(),
      createSubscriptionCheckout: jest.fn().mockResolvedValue({
        checkoutUrl: 'https://pay.example/checkout',
        provider: 'lemon_squeezy',
      }),
      createAddonCheckout: jest.fn().mockResolvedValue({
        checkoutUrl: 'https://pay.example/addon',
        provider: 'lemon_squeezy',
      }),
      createTopUpCheckout: jest.fn().mockResolvedValue({
        checkoutUrl: 'https://pay.example/topup',
        provider: 'lemon_squeezy',
      }),
      isCheckoutConfigured: jest.fn().mockReturnValue(options?.checkoutConfigured ?? true),
    };
    if (options?.checkoutConfigured === false) {
      const { ServiceUnavailableException } = require('@nestjs/common');
      billingProviderService.createSubscriptionCheckout = jest.fn().mockImplementation(() => {
        throw new ServiceUnavailableException({ errorCode: 'billing_provider_not_configured' });
      });
    }

    const entitlementsService = {
      resolveForWorkspace: jest.fn().mockImplementation(async () => {
        const sub = options?.subscription ?? { planKey: 'starter' as const, status: 'active' as const };
        if (sub.planKey === 'free') {
          return mockFreeWorkspaceEntitlements({ workspaceId });
        }
        return mockStarterWorkspaceEntitlements({ workspaceId });
      }),
    };

    const subscription =
      options?.subscription === null
        ? null
        : (options?.subscription ?? { planKey: 'starter' as const, status: 'active' as const });

    const subscriptionsService = {
      findByWorkspaceId: jest.fn().mockResolvedValue(
        subscription
          ? {
              workspaceId: new Types.ObjectId(workspaceId),
              providerSubscriptionId: 'sub-1',
              ...subscription,
              currentPeriodStart: new Date(),
              currentPeriodEnd: new Date(),
            }
          : null,
      ),
    };

    const service = new BillingCheckoutService(
      billingProviderService as never,
      entitlementsService as never,
      subscriptionsService as never,
    );

    return { service, billingProviderService, subscriptionsService };
  }

  it('owner flow: creates starter plan checkout', async () => {
    const { service, billingProviderService } = createService({
      subscription: { planKey: 'free', status: 'trialing' },
    });
    const result = await service.createPlanCheckout(workspaceId, userId, 'starter');
    expect(result.provider).toBe('lemon_squeezy');
    expect(billingProviderService.createSubscriptionCheckout).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId, userId, planKey: 'starter' }),
    );
  });

  it('owner flow: creates pro plan checkout', async () => {
    const { service, billingProviderService } = createService({
      subscription: { planKey: 'free', status: 'trialing' },
    });
    await service.createPlanCheckout(workspaceId, userId, 'pro');
    expect(billingProviderService.createSubscriptionCheckout).toHaveBeenCalledWith(
      expect.objectContaining({ planKey: 'pro' }),
    );
  });

  it('blocks paid Starter to Pro checkout in favor of plan change', async () => {
    const { service, billingProviderService } = createService({
      subscription: { planKey: 'starter', status: 'active' },
    });

    await expect(service.createPlanCheckout(workspaceId, userId, 'pro')).rejects.toMatchObject({
      response: { errorCode: 'billing_plan_change_required' },
    });
    expect(billingProviderService.createSubscriptionCheckout).not.toHaveBeenCalled();
  });

  it('blocks add-on checkout on free trial plan', async () => {
    const { service } = createService({
      subscription: { planKey: 'free', status: 'trialing' },
    });
    await expect(
      service.createAddonCheckout(workspaceId, userId, 'extra_bot'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows add-on checkout on paid starter plan', async () => {
    const { service, billingProviderService } = createService({
      subscription: { planKey: 'starter', status: 'active' },
    });
    await service.createAddonCheckout(workspaceId, userId, 'extra_bot');
    expect(billingProviderService.createAddonCheckout).toHaveBeenCalled();
  });

  it('rejects retired KB add-on checkout keys', async () => {
    const { service } = createService({
      subscription: { planKey: 'starter', status: 'active' },
    });
    await expect(
      service.createAddonCheckout(workspaceId, userId, 'kb_storage_5mb'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('blocks top-up checkout on free trial', async () => {
    const { service } = createService({
      subscription: { planKey: 'free', status: 'trialing' },
    });
    await expect(service.createTopUpCheckout(workspaceId, userId, 'ai_credits_1000')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('allows top-up checkout on paid plan', async () => {
    const { service, billingProviderService } = createService({
      subscription: { planKey: 'pro', status: 'active' },
    });
    await service.createTopUpCheckout(workspaceId, userId, 'ai_credits_1000');
    expect(billingProviderService.createTopUpCheckout).toHaveBeenCalled();
  });
});
