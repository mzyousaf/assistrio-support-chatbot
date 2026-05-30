import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { BillingWebhooksController } from './billing-webhooks.controller';

describe('BillingWebhooksController', () => {
  const workspaceId = '507f1f77bcf86cd799439011';

  function buildController(options?: { validSignature?: boolean }) {
    const billingProviderService = {
      verifyWebhookSignature: jest.fn().mockReturnValue(options?.validSignature ?? true),
      parseWebhook: jest.fn().mockReturnValue({
        provider: 'lemon_squeezy',
        providerEventId: 'subscription_created:subscriptions:sub-1',
        eventName: 'subscription_created',
        customData: { workspaceId },
        payload: {},
      }),
      mapWebhookEvent: jest.fn().mockResolvedValue({
        kind: 'subscription_sync',
        workspaceId,
        providerSubscriptionId: 'sub-1',
        status: 'active',
      }),
    };
    const webhookEventsService = {
      storeReceivedEvent: jest.fn().mockResolvedValue({ id: 'evt-1', isDuplicate: false, status: 'received' }),
      markProcessed: jest.fn().mockResolvedValue(undefined),
      markFailed: jest.fn().mockResolvedValue(undefined),
    };
    const webhookProcessingService = {
      applyAction: jest.fn().mockResolvedValue(undefined),
    };
    const paymentNotificationService = {
      handleWebhookProcessed: jest.fn().mockResolvedValue(undefined),
    };
    const webhookAlertService = {
      notifyWebhookFailure: jest.fn().mockResolvedValue(undefined),
    };
    const subscriptionModel = {
      find: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([]),
          }),
        }),
      }),
    };
    const controller = new BillingWebhooksController(
      billingProviderService as never,
      webhookEventsService as never,
      webhookProcessingService as never,
      paymentNotificationService as never,
      webhookAlertService as never,
      subscriptionModel as never,
    );
    return {
      controller,
      billingProviderService,
      webhookEventsService,
      webhookProcessingService,
      paymentNotificationService,
      webhookAlertService,
    };
  }

  it('rejects missing rawBody with webhook_raw_body_missing', async () => {
    const { controller } = buildController();
    const req = { headers: {}, body: {} } as never;
    try {
      await controller.handleLemonSqueezyWebhook(req);
      throw new Error('expected BadRequestException');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getResponse()).toMatchObject({
        errorCode: 'webhook_raw_body_missing',
      });
    }
  });

  it('accepts rawBody from req.raw.rawBody fallback', async () => {
    const { controller, billingProviderService } = buildController();
    const rawBody = Buffer.from('{"meta":{"event_name":"subscription_created"}}');
    const req = {
      headers: { 'x-signature': 'ok' },
      body: { meta: { event_name: 'subscription_created' } },
      raw: { rawBody },
    } as never;

    const result = await controller.handleLemonSqueezyWebhook(req);
    expect(result.received).toBe(true);
    expect(billingProviderService.verifyWebhookSignature).toHaveBeenCalledWith(rawBody, expect.any(Object));
  });

  it('rejects invalid signature', async () => {
    const { controller } = buildController({ validSignature: false });
    const req = { rawBody: Buffer.from('{}'), headers: { 'x-signature': 'bad' } } as never;
    await expect(controller.handleLemonSqueezyWebhook(req)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('stores event and processes subscription webhook when rawBody is present', async () => {
    const { controller, webhookEventsService, webhookProcessingService } = buildController();
    const req = { rawBody: Buffer.from('{}'), headers: { 'x-signature': 'ok' } } as never;
    const result = await controller.handleLemonSqueezyWebhook(req);
    expect(result.received).toBe(true);
    expect(webhookEventsService.storeReceivedEvent).toHaveBeenCalled();
    expect(webhookProcessingService.applyAction).toHaveBeenCalled();
    expect(webhookEventsService.markProcessed).toHaveBeenCalledWith('evt-1', 'processed', null);
  });

  it('marks webhook failed when workspaceId is missing in custom_data', async () => {
    const { controller, billingProviderService, webhookEventsService, webhookProcessingService, webhookAlertService } =
      buildController();
    billingProviderService.mapWebhookEvent.mockResolvedValue({
      kind: 'ignored',
      reason: 'missing_workspace_id',
    });

    const req = { rawBody: Buffer.from('{}'), headers: {} } as never;
    const result = await controller.handleLemonSqueezyWebhook(req);

    expect(result).toMatchObject({ failed: true, processingError: 'missing_workspace_id in meta.custom_data' });
    expect(webhookEventsService.markFailed).toHaveBeenCalledWith(
      'evt-1',
      'missing_workspace_id in meta.custom_data',
    );
    expect(webhookProcessingService.applyAction).not.toHaveBeenCalled();
  });

  it('skips re-processing duplicate webhooks', async () => {
    const { controller, webhookProcessingService, webhookEventsService } = buildController();
    webhookEventsService.storeReceivedEvent.mockResolvedValue({
      id: 'evt-dup',
      isDuplicate: true,
      status: 'processed',
    });
    const req = { rawBody: Buffer.from('{}'), headers: {} } as never;
    const result = await controller.handleLemonSqueezyWebhook(req);
    expect(result.duplicate).toBe(true);
    expect(webhookProcessingService.applyAction).not.toHaveBeenCalled();
  });
});
