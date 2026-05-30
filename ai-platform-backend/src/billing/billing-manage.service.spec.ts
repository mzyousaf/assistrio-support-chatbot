import { NotFoundException } from '@nestjs/common';
import { BillingManageService } from './billing-manage.service';

describe('BillingManageService', () => {
  const workspaceId = '507f1f77bcf86cd799439011';

  function createService(options: {
    checkoutConfigured?: boolean;
    subscription?: {
      providerSubscriptionId: string | null;
    } | null;
    portalUrl?: string | null;
  }) {
    const billingProviderService = {
      isCheckoutConfigured: jest.fn().mockReturnValue(options.checkoutConfigured ?? true),
      getCustomerPortalUrl: jest.fn().mockResolvedValue(
        options.portalUrl
          ? { url: options.portalUrl, provider: 'lemon_squeezy' }
          : null,
      ),
    };
    const subscriptionsService = {
      findByWorkspaceId: jest.fn().mockResolvedValue(options.subscription ?? null),
    };

    return {
      service: new BillingManageService(
        billingProviderService as never,
        subscriptionsService as never,
      ),
      billingProviderService,
      subscriptionsService,
    };
  }

  it('returns portal url when provider supports it', async () => {
    const { service } = createService({
      subscription: { providerSubscriptionId: 'sub-1' },
      portalUrl: 'https://store.lemonsqueezy.com/billing?signed=1',
    });

    await expect(service.createManageBillingUrl(workspaceId)).resolves.toEqual({
      url: 'https://store.lemonsqueezy.com/billing?signed=1',
      provider: 'lemon_squeezy',
    });
  });

  it('throws billing_portal_not_available when portal url missing', async () => {
    const { service } = createService({
      subscription: { providerSubscriptionId: 'sub-1' },
      portalUrl: null,
    });

    await expect(service.createManageBillingUrl(workspaceId)).rejects.toMatchObject({
      response: { errorCode: 'billing_portal_not_available' },
    });
  });

  it('throws billing_portal_not_available when not configured', async () => {
    const { service } = createService({ checkoutConfigured: false });

    await expect(service.createManageBillingUrl(workspaceId)).rejects.toBeInstanceOf(NotFoundException);
  });
});
