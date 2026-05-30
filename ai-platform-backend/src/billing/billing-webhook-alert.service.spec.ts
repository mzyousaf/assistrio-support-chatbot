import { BillingWebhookAlertService } from './billing-webhook-alert.service';

describe('BillingWebhookAlertService', () => {
  function buildService(options?: { alertEmail?: string; alreadyAlerted?: boolean }) {
    const emailService = {
      send: jest.fn().mockResolvedValue({ ok: true, id: 'email-1' }),
    };
    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'billingAlertEmail') return options?.alertEmail ?? 'ops@example.com';
        if (key === 'adminAppBaseUrl') return 'https://admin.example.com';
        return '';
      }),
    };
    const webhookEventsService = {
      findById: jest.fn().mockResolvedValue({
        _id: 'evt-1',
        alertedAt: options?.alreadyAlerted ? new Date() : null,
        workspaceId: '507f1f77bcf86cd799439011',
        receivedAt: new Date('2026-05-01T00:00:00.000Z'),
      }),
      markAlertSent: jest.fn().mockResolvedValue(undefined),
    };

    const service = new BillingWebhookAlertService(
      emailService as never,
      configService as never,
      webhookEventsService as never,
    );

    return { service, emailService, webhookEventsService };
  }

  it('sends billing webhook failure alert once', async () => {
    const { service, emailService, webhookEventsService } = buildService();

    await service.notifyWebhookFailure({
      eventId: 'evt-1',
      eventName: 'subscription_updated',
      provider: 'lemon_squeezy',
      workspaceId: '507f1f77bcf86cd799439011',
      processingError: 'Invalid variant',
    });

    expect(emailService.send).toHaveBeenCalledTimes(1);
    expect(emailService.send.mock.calls[0][0].subject).toBe('Billing webhook failed');
    expect(webhookEventsService.markAlertSent).toHaveBeenCalledWith('evt-1');
  });

  it('does not send duplicate alerts for the same event', async () => {
    const { service, emailService } = buildService({ alreadyAlerted: true });

    await service.notifyWebhookFailure({
      eventId: 'evt-1',
      eventName: 'subscription_updated',
      provider: 'lemon_squeezy',
      processingError: 'Invalid variant',
    });

    expect(emailService.send).not.toHaveBeenCalled();
  });

  it('skips alert when BILLING_ALERT_EMAIL is unset', async () => {
    const { service, emailService } = buildService({ alertEmail: '' });

    await service.notifyWebhookFailure({
      eventId: 'evt-1',
      eventName: 'subscription_updated',
      provider: 'lemon_squeezy',
      processingError: 'Invalid variant',
    });

    expect(emailService.send).not.toHaveBeenCalled();
  });
});
