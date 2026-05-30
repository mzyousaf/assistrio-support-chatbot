import { Types } from 'mongoose';
import { BillingWorkspacePaymentNotificationService } from './billing-workspace-payment-notification.service';

describe('BillingWorkspacePaymentNotificationService', () => {
  const workspaceId = '507f1f77bcf86cd799439011';
  const webhookEventId = 'evt-payment-failed-1';

  function buildService(options?: { sendReceiptEmail?: boolean }) {
    const emailService = {
      send: jest.fn().mockResolvedValue({ ok: true, id: 'email-1' }),
    };
    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'customerAppBaseUrl') return 'https://app.example.com';
        if (key === 'sendAssistrioPaymentReceiptEmail') return options?.sendReceiptEmail ?? false;
        return '';
      }),
    };
    const billingManageService = {
      createManageBillingUrl: jest.fn().mockResolvedValue({
        url: 'https://portal.lemonsqueezy.com/billing',
        provider: 'lemon_squeezy',
      }),
    };
    const subscriptionModel = {
      findOne: jest.fn(),
      updateOne: jest.fn().mockResolvedValue({}),
    };
    const membershipModel = {
      findOne: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue({ userId: new Types.ObjectId() }),
          }),
        }),
      }),
    };
    const userModel = {
      findById: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue({ email: 'owner@example.com' }),
          }),
        }),
      }),
    };
    const workspaceModel = {
      findById: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue({ name: 'Acme Workspace' }),
          }),
        }),
      }),
    };

    const service = new BillingWorkspacePaymentNotificationService(
      emailService as never,
      configService as never,
      billingManageService as never,
      subscriptionModel as never,
      membershipModel as never,
      userModel as never,
      workspaceModel as never,
    );

    return { service, emailService, subscriptionModel };
  }

  it('sends payment failed email once per webhook event', async () => {
    const { service, emailService, subscriptionModel } = buildService();
    const subscriptionDoc = {
      _id: new Types.ObjectId(),
      planKey: 'starter',
      paymentFailure: {
        failedAt: new Date(),
        invoiceId: 'inv-1',
        amount: 4900,
        currency: 'USD',
        notifiedWebhookEventId: null,
        notifiedInvoiceId: null,
      },
    };
    subscriptionModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(subscriptionDoc) });

    await service.handleWebhookProcessed({
      webhookEventId,
      eventName: 'subscription_payment_failed',
      actions: [
        {
          kind: 'subscription_sync',
          workspaceId,
          providerSubscriptionId: 'sub-1',
          status: 'past_due',
          paymentFailure: { failedAt: new Date(), invoiceId: 'inv-1', amount: 4900, currency: 'USD' },
        },
      ],
    });

    expect(emailService.send).toHaveBeenCalledTimes(1);
    expect(emailService.send.mock.calls[0][0].subject).toBe('Payment failed for your Assistrio workspace');
    expect(emailService.send.mock.calls[0][0].text).toContain('Billing & Invoices');
    expect(subscriptionModel.updateOne).toHaveBeenCalled();
  });

  it('does not send duplicate failed payment email for same webhook event', async () => {
    const { service, emailService, subscriptionModel } = buildService();
    subscriptionModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue({
        _id: new Types.ObjectId(),
        planKey: 'starter',
        paymentFailure: {
          failedAt: new Date(),
          invoiceId: 'inv-1',
          notifiedWebhookEventId: webhookEventId,
          notifiedInvoiceId: 'inv-1',
        },
      }),
    });

    await service.handleWebhookProcessed({
      webhookEventId,
      eventName: 'subscription_payment_failed',
      actions: [
        {
          kind: 'subscription_sync',
          workspaceId,
          providerSubscriptionId: 'sub-1',
          status: 'past_due',
        },
      ],
    });

    expect(emailService.send).not.toHaveBeenCalled();
  });

  it('sends subscription cancel email once', async () => {
    const { service, emailService, subscriptionModel } = buildService();
    subscriptionModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue({
        _id: new Types.ObjectId(),
        planKey: 'starter',
        cancelAtPeriodEnd: true,
        currentPeriodEnd: new Date('2026-07-01T00:00:00.000Z'),
        subscriptionCancelEmailSentAt: null,
      }),
    });

    await service.notifySubscriptionCancelScheduled(workspaceId);

    expect(emailService.send).toHaveBeenCalledTimes(1);
    expect(emailService.send.mock.calls[0][0].subject).toBe(
      'Your Assistrio subscription is scheduled to cancel',
    );
  });

  it('sends subscription restored email once', async () => {
    const { service, emailService, subscriptionModel } = buildService();
    subscriptionModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue({
        _id: new Types.ObjectId(),
        planKey: 'starter',
        subscriptionRestoredEmailSentAt: null,
      }),
    });

    await service.notifySubscriptionRestored(workspaceId);

    expect(emailService.send).toHaveBeenCalledTimes(1);
    expect(emailService.send.mock.calls[0][0].subject).toBe('Your Assistrio subscription has been restored');
  });

  it('sends receipt email only when flag enabled', async () => {
    const disabled = buildService({ sendReceiptEmail: false });
    disabled.subscriptionModel.findOne.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({
            lastPaymentReceiptEmailWebhookEventId: null,
            planKey: 'starter',
          }),
        }),
      }),
    });

    await disabled.service.handleWebhookProcessed({
      webhookEventId: 'evt-receipt-1',
      eventName: 'subscription_payment_success',
      actions: [
        {
          kind: 'subscription_sync',
          workspaceId,
          providerSubscriptionId: 'sub-1',
          status: 'active',
          clearPaymentFailure: false,
        },
      ],
    });
    expect(disabled.emailService.send).not.toHaveBeenCalled();

    const enabled = buildService({ sendReceiptEmail: true });
    enabled.subscriptionModel.findOne.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({
            lastPaymentReceiptEmailWebhookEventId: null,
            planKey: 'starter',
          }),
        }),
      }),
    });

    await enabled.service.handleWebhookProcessed({
      webhookEventId: 'evt-receipt-1',
      eventName: 'subscription_payment_success',
      actions: [
        {
          kind: 'subscription_sync',
          workspaceId,
          providerSubscriptionId: 'sub-1',
          status: 'active',
          clearPaymentFailure: false,
        },
      ],
    });

    expect(enabled.emailService.send).toHaveBeenCalledTimes(1);
    expect(enabled.emailService.send.mock.calls[0][0].subject).toBe(
      'Payment received for your Assistrio workspace',
    );
  });
});
