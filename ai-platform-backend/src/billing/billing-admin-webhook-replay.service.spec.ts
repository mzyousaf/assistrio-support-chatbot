import { BillingAdminWebhookReplayService } from './billing-admin-webhook-replay.service';

describe('BillingAdminWebhookReplayService', () => {
  function buildService(options?: { status?: string; applyThrows?: boolean }) {
    const webhookEventModel = {
      findById: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({
            _id: 'evt-1',
            provider: 'lemon_squeezy',
            providerEventId: 'order:1',
            eventName: 'order_created',
            status: options?.status ?? 'failed',
            workspaceId: '507f1f77bcf86cd799439011',
            rawPayload: {
              meta: { custom_data: { workspaceId: '507f1f77bcf86cd799439011' } },
            },
          }),
        }),
      }),
    };
    const billingProviderService = {
      mapWebhookEvent: jest.fn().mockResolvedValue({
        kind: 'subscription_sync',
        workspaceId: '507f1f77bcf86cd799439011',
        providerSubscriptionId: 'sub-1',
        status: 'active',
      }),
    };
    const webhookEventsService = {
      markWebhookRetryScheduled: jest.fn().mockResolvedValue(undefined),
      markWebhookReplaySuccess: jest.fn().mockResolvedValue(undefined),
      markWebhookReplayFailed: jest.fn().mockResolvedValue(undefined),
    };
    const webhookProcessingService = {
      applyAction: options?.applyThrows
        ? jest.fn().mockRejectedValue(new Error('replay failed'))
        : jest.fn().mockResolvedValue(undefined),
    };

    const service = new BillingAdminWebhookReplayService(
      webhookEventModel as never,
      billingProviderService as never,
      webhookEventsService as never,
      webhookProcessingService as never,
    );

    return { service, webhookEventsService, webhookProcessingService };
  }

  it('replays failed webhook and returns structured success result', async () => {
    const { service, webhookEventsService } = buildService();

    const result = await service.replayEvent('evt-1');

    expect(result).toEqual({
      replayed: true,
      status: 'processed',
      message: 'Webhook event replayed successfully.',
    });
    expect(webhookEventsService.markWebhookRetryScheduled).toHaveBeenCalledWith('evt-1');
    expect(webhookEventsService.markWebhookReplaySuccess).toHaveBeenCalledWith(
      'evt-1',
      'processed',
      null,
    );
  });

  it('returns structured failure result when replay processing fails', async () => {
    const { service, webhookEventsService } = buildService({ applyThrows: true });

    const result = await service.replayEvent('evt-1');

    expect(result).toEqual({
      replayed: false,
      status: 'failed',
      message: 'replay failed',
    });
    expect(webhookEventsService.markWebhookReplayFailed).toHaveBeenCalledWith('evt-1', 'replay failed');
  });
});
