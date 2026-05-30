import { BillingAddonActionsService } from './billing-addon-actions.service';
import { BillingProviderService } from './billing-provider.service';
import { BillingWebhookProcessingService } from './billing-webhook-processing.service';

describe('BillingAddonActionsService', () => {
  const workspaceId = '507f1f77bcf86cd799439011';
  const botId = '507f1f77bcf86cd799439013';
  const periodEnd = new Date('2026-06-01T00:00:00.000Z');

  function createService(options?: {
    addon?: {
      addonKey: string;
      targetBotId?: string | null;
      status: string;
      providerSubscriptionId?: string | null;
      cancelAtPeriodEnd?: boolean;
      currentPeriodEnd?: Date;
    } | null;
  }) {
    const addon = options?.addon ?? {
      addonKey: 'extra_bot',
      targetBotId: null,
      status: 'active',
      providerSubscriptionId: 'addon-sub-1',
      cancelAtPeriodEnd: false,
      currentPeriodEnd: periodEnd,
    };

    const addonModel = {
      findOne: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(addon),
        }),
      }),
    };

    const billingProviderService = {
      isCheckoutConfigured: jest.fn().mockReturnValue(true),
      cancelSubscription: jest.fn().mockResolvedValue({
        providerSubscriptionId: 'addon-sub-1',
        status: 'active',
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: true,
      }),
    };

    const webhookProcessingService = {
      applyAction: jest.fn().mockResolvedValue(undefined),
    };

    const service = new BillingAddonActionsService(
      addonModel as never,
      billingProviderService as never,
      webhookProcessingService as never,
    );

    return { service, billingProviderService, webhookProcessingService, addonModel };
  }

  it('cancels active recurring add-on via provider', async () => {
    const { service, billingProviderService, webhookProcessingService } = createService();
    const result = await service.cancelAddon(workspaceId, 'extra_bot');

    expect(billingProviderService.cancelSubscription).toHaveBeenCalledWith({
      providerSubscriptionId: 'addon-sub-1',
    });
    expect(webhookProcessingService.applyAction).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'addon_sync',
        addonKey: 'extra_bot',
        cancelAtPeriodEnd: true,
        status: 'active',
      }),
      expect.any(Date),
    );
    expect(result.cancelAtPeriodEnd).toBe(true);
  });

  it('blocks cancelling one-time top-up add-on key', async () => {
    const { service, billingProviderService } = createService();
    await expect(service.cancelAddon(workspaceId, 'ai_credits_1000')).rejects.toMatchObject({
      response: expect.objectContaining({
        errorCode: 'billing_addon_cancel_not_allowed',
      }),
    });
    expect(billingProviderService.cancelSubscription).not.toHaveBeenCalled();
  });

  it('blocks cancelling when provider subscription id is missing', async () => {
    const { service } = createService({
      addon: {
        addonKey: 'extra_bot',
        targetBotId: null,
        status: 'active',
        providerSubscriptionId: null,
      },
    });

    await expect(service.cancelAddon(workspaceId, 'extra_bot')).rejects.toMatchObject({
      response: expect.objectContaining({
        errorCode: 'billing_addon_cancel_not_allowed',
      }),
    });
  });

  it('blocks cancelling retired KB add-on keys', async () => {
    const { service, billingProviderService } = createService();

    await expect(service.cancelAddon(workspaceId, 'kb_storage_5mb', botId)).rejects.toMatchObject({
      response: expect.objectContaining({
        errorCode: 'billing_addon_cancel_not_allowed',
      }),
    });
    expect(billingProviderService.cancelSubscription).not.toHaveBeenCalled();
  });
});
