import { ServiceUnavailableException } from '@nestjs/common';
import { BillingProviderService } from './billing-provider.service';
import { LemonSqueezyProvider } from './providers/lemon-squeezy.provider';

describe('BillingProviderService', () => {
  function createService(config: Record<string, string>) {
    const configService = {
      get: jest.fn((key: string) => config[key] ?? ''),
    };
    const lemon = {
      createSubscriptionCheckout: jest.fn(),
      createAddonCheckout: jest.fn(),
      createTopUpCheckout: jest.fn(),
      parseWebhook: jest.fn(),
      verifyWebhookSignature: jest.fn(),
      mapWebhookEvent: jest.fn(),
      getCustomerPortalUrl: jest.fn(),
      fetchProviderSubscription: jest.fn(),
      provider: 'lemon_squeezy',
    };
    const service = new BillingProviderService(configService as never, lemon as never);
    return { service, lemon };
  }

  const starterOnlyConfig = {
    lemonSqueezyApiKey: 'key',
    lemonSqueezyStoreId: 'store',
    customerAppBaseUrl: 'https://app.example.com',
    lemonSqueezyStarterVariantId: 'v-starter',
  };

  it('returns 503 when base checkout env is missing', async () => {
    const { service } = createService({});
    expect(service.isCheckoutConfigured()).toBe(false);
    expect(service.isPlanCheckoutAvailable('starter')).toBe(false);
    let caught: ServiceUnavailableException | undefined;
    try {
      await service.createSubscriptionCheckout({
        workspaceId: '507f1f77bcf86cd799439011',
        userId: '507f1f77bcf86cd799439012',
        planKey: 'starter',
        internalRequestId: 'req-1',
      });
    } catch (err) {
      caught = err as ServiceUnavailableException;
    }
    expect(caught).toBeInstanceOf(ServiceUnavailableException);
    expect(caught?.getResponse()).toMatchObject({
      errorCode: 'billing_provider_not_configured',
      requiredEnv: expect.arrayContaining(['LEMON_SQUEEZY_API_KEY']),
    });
  });

  it('Starter checkout succeeds when only Starter variant is configured', async () => {
    const { service, lemon } = createService(starterOnlyConfig);
    lemon.createSubscriptionCheckout.mockResolvedValue({
      checkoutUrl: 'https://checkout.example.com',
      provider: 'lemon_squeezy',
    });
    expect(service.isPlanCheckoutAvailable('starter')).toBe(true);
    expect(service.isPlanCheckoutAvailable('pro')).toBe(false);
    expect(service.isAddonCheckoutAvailable('extra_bot')).toBe(false);
    const result = await service.createSubscriptionCheckout({
      workspaceId: '507f1f77bcf86cd799439011',
      userId: '507f1f77bcf86cd799439012',
      planKey: 'starter',
      internalRequestId: 'req-1',
    });
    expect(result.checkoutUrl).toContain('checkout');
    expect(lemon.createSubscriptionCheckout).toHaveBeenCalled();
  });

  it('Pro checkout is blocked when Pro variant env is missing', async () => {
    const { service, lemon } = createService(starterOnlyConfig);
    let caught: ServiceUnavailableException | undefined;
    try {
      await service.createSubscriptionCheckout({
        workspaceId: '507f1f77bcf86cd799439011',
        userId: '507f1f77bcf86cd799439012',
        planKey: 'pro',
        internalRequestId: 'req-2',
      });
    } catch (err) {
      caught = err as ServiceUnavailableException;
    }
    expect(caught?.getResponse()).toMatchObject({
      errorCode: 'billing_provider_not_configured',
      requiredEnv: expect.arrayContaining(['LEMON_SQUEEZY_PRO_VARIANT_ID']),
    });
    expect(lemon.createSubscriptionCheckout).not.toHaveBeenCalled();
  });

  it('webhook secret missing does not block plan checkout availability', () => {
    const { service } = createService({
      ...starterOnlyConfig,
      lemonSqueezyWebhookSecret: '',
    });
    expect(service.isCheckoutConfigured()).toBe(true);
    expect(service.isPlanCheckoutAvailable('starter')).toBe(true);
  });

  it('delegates customer portal url when base config is present', async () => {
    const { service, lemon } = createService(starterOnlyConfig);
    lemon.getCustomerPortalUrl.mockResolvedValue({
      url: 'https://store.lemonsqueezy.com/billing',
      provider: 'lemon_squeezy',
    });

    const result = await service.getCustomerPortalUrl({ providerSubscriptionId: 'sub-1' });
    expect(result?.url).toContain('billing');
    expect(lemon.getCustomerPortalUrl).toHaveBeenCalledWith({ providerSubscriptionId: 'sub-1' });
  });
});
