import { BillingWebhookEventsService } from './billing-webhook-events.service';

describe('BillingWebhookEventsService', () => {
  function buildModel() {
    return {
      create: jest.fn(),
      findOne: jest.fn(),
      updateOne: jest.fn().mockResolvedValue({}),
      countDocuments: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(0) }),
      find: jest.fn(),
      findById: jest.fn(),
    };
  }

  it('stores webhook event idempotently on duplicate key', async () => {
    const webhookEventModel = {
      create: jest
        .fn()
        .mockResolvedValueOnce({ _id: 'new-id' })
        .mockRejectedValueOnce({ code: 11000 }),
      findOne: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: 'existing-id',
          status: 'processed',
        }),
      }),
    };
    const service = new BillingWebhookEventsService(webhookEventModel as never);
    const rawBody = Buffer.from(
      '{"meta":{"event_name":"order_created","custom_data":{"workspaceId":"507f1f77bcf86cd799439011"}},"data":{"type":"orders","id":"1"}}',
    );
    const first = await service.storeReceivedEvent(rawBody, {
      provider: 'lemon_squeezy',
      providerEventId: 'order_created:orders:1',
      eventName: 'order_created',
      customData: {},
      payload: {},
    });
    expect(first.isDuplicate).toBe(false);

    const second = await service.storeReceivedEvent(rawBody, {
      provider: 'lemon_squeezy',
      providerEventId: 'order_created:orders:1',
      eventName: 'order_created',
      customData: {},
      payload: {},
    });
    expect(second.isDuplicate).toBe(true);
    expect(second.status).toBe('processed');
  });

  it('marks failed webhooks with failedAt', async () => {
    const webhookEventModel = buildModel();
    const service = new BillingWebhookEventsService(webhookEventModel as never);

    await service.markFailed('evt-1', 'processing error');

    expect(webhookEventModel.updateOne).toHaveBeenCalledWith(
      { _id: 'evt-1' },
      expect.objectContaining({
        $set: expect.objectContaining({
          status: 'failed',
          processingError: 'processing error',
          failedAt: expect.any(Date),
        }),
      }),
    );
  });

  it('returns failed webhook count and recent failures', async () => {
    const webhookEventModel = buildModel();
    webhookEventModel.countDocuments.mockReturnValue({
      exec: jest.fn().mockResolvedValue(3),
    });
    webhookEventModel.find.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue([
                {
                  _id: 'evt-failed',
                  provider: 'lemon_squeezy',
                  providerEventId: 'order:1',
                  eventName: 'order_created',
                  status: 'failed',
                  workspaceId: '507f1f77bcf86cd799439011',
                  processingError: 'boom',
                  receivedAt: new Date('2026-05-01T00:00:00.000Z'),
                  processedAt: null,
                  failedAt: new Date('2026-05-01T00:00:01.000Z'),
                  retryCount: 1,
                  createdAt: new Date('2026-05-01T00:00:00.000Z'),
                },
              ]),
            }),
          }),
        }),
      }),
    });

    const service = new BillingWebhookEventsService(webhookEventModel as never);
    await expect(service.getFailedWebhookCount()).resolves.toBe(3);
    const recent = await service.getRecentFailedWebhooks(5);
    expect(recent).toHaveLength(1);
    expect(recent[0].eventName).toBe('order_created');
  });

  it('schedules retry and records replay success/failure', async () => {
    const webhookEventModel = buildModel();
    const service = new BillingWebhookEventsService(webhookEventModel as never);

    await service.markWebhookRetryScheduled('evt-1', new Date('2026-06-01T00:00:00.000Z'));
    expect(webhookEventModel.updateOne).toHaveBeenCalledWith(
      { _id: 'evt-1' },
      expect.objectContaining({
        $inc: { retryCount: 1 },
        $set: expect.objectContaining({
          lastRetryAt: expect.any(Date),
          nextRetryAt: new Date('2026-06-01T00:00:00.000Z'),
        }),
      }),
    );

    await service.markWebhookReplaySuccess('evt-1', 'processed');
    expect(webhookEventModel.updateOne).toHaveBeenCalledWith(
      { _id: 'evt-1' },
      expect.objectContaining({
        $set: expect.objectContaining({
          status: 'processed',
          failedAt: null,
        }),
      }),
    );

    await service.markWebhookReplayFailed('evt-1', 'still failing');
    expect(webhookEventModel.updateOne).toHaveBeenCalledWith(
      { _id: 'evt-1' },
      expect.objectContaining({
        $inc: { retryCount: 1 },
        $set: expect.objectContaining({
          status: 'failed',
          processingError: 'still failing',
        }),
      }),
    );
  });
});
