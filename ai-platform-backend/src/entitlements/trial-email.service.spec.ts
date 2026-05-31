import { Types } from 'mongoose';
import { TrialEmailService } from './trial-email.service';

describe('TrialEmailService', () => {
  const workspaceId = '507f1f77bcf86cd799439011';
  const ownerUserId = new Types.ObjectId('507f1f77bcf86cd799439012');

  function createHarness(subscriptionDoc: Record<string, unknown> | null) {
    let stored = subscriptionDoc ? { ...subscriptionDoc } : null;

    const subscriptionModel = {
      findOne: jest.fn(() => ({
        exec: jest.fn().mockResolvedValue(stored ? { ...stored } : null),
      })),
      updateOne: jest.fn(async (query: Record<string, unknown>, update: Record<string, unknown>) => {
        if (!stored) return { modifiedCount: 0 };
        const sentField = Object.keys(query).find(
          (key) => key.startsWith('trial') && key.endsWith('EmailSentAt'),
        );
        if (sentField && query[sentField] !== null && stored[sentField]) {
          return { modifiedCount: 0 };
        }
        const setValues = update.$set as Record<string, unknown>;
        stored = { ...stored, ...setValues };
        return { modifiedCount: 1 };
      }),
    };

    const emailService = {
      send: jest.fn().mockResolvedValue({ ok: true, id: 'email-1' }),
    };

    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'customerAppBaseUrl') return 'https://app.assistrio.com';
        return '';
      }),
    };

    const membershipModel = {
      findOne: jest.fn(() => ({
        select: jest.fn(() => ({
          lean: jest.fn(() => ({
            exec: jest.fn().mockResolvedValue({ userId: ownerUserId }),
          })),
        })),
      })),
    };

    const userModel = {
      findById: jest.fn(() => ({
        select: jest.fn(() => ({
          lean: jest.fn(() => ({
            exec: jest.fn().mockResolvedValue({ email: 'owner@example.com' }),
          })),
        })),
      })),
    };

    const workspaceModel = {
      findById: jest.fn(() => ({
        select: jest.fn(() => ({
          lean: jest.fn(() => ({
            exec: jest.fn().mockResolvedValue({ name: 'Acme Workspace' }),
          })),
        })),
      })),
    };

    const service = new TrialEmailService(
      emailService as never,
      configService as never,
      subscriptionModel as never,
      membershipModel as never,
      userModel as never,
      workspaceModel as never,
    );

    return {
      service,
      emailService,
      getStored: () => stored,
    };
  }

  function trialSubscription(overrides?: Record<string, unknown>) {
    return {
      _id: new Types.ObjectId(),
      workspaceId: new Types.ObjectId(workspaceId),
      planKey: 'free',
      status: 'trialing',
      providerSubscriptionId: null,
      currentPeriodStart: new Date('2026-05-01T00:00:00.000Z'),
      currentPeriodEnd: new Date('2026-05-08T00:00:00.000Z'),
      trialStartedEmailSentAt: null,
      trialEndingSoonEmailSentAt: null,
      trialExpiredEmailSentAt: null,
      trialCreditsUsedEmailSentAt: null,
      ...overrides,
    };
  }

  it('sends trial started email once for free trial workspace', async () => {
    const { service, emailService, getStored } = createHarness(trialSubscription());

    await service.notifyTrialStarted(workspaceId);
    await service.notifyTrialStarted(workspaceId);

    expect(emailService.send).toHaveBeenCalledTimes(1);
    expect(emailService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'owner@example.com',
        subject: 'Welcome to Assistrio — your 7-day trial has started',
      }),
    );
    expect(getStored()?.trialStartedEmailSentAt).toBeInstanceOf(Date);
  });

  it('sends trial ending soon email once', async () => {
    const { service, emailService, getStored } = createHarness(trialSubscription());

    await service.notifyTrialEndingSoon(workspaceId, new Date('2026-05-08T00:00:00.000Z'));
    await service.notifyTrialEndingSoon(workspaceId, new Date('2026-05-08T00:00:00.000Z'));

    expect(emailService.send).toHaveBeenCalledTimes(1);
    expect(emailService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Your Assistrio trial ends soon',
      }),
    );
    expect(getStored()?.trialEndingSoonEmailSentAt).toBeInstanceOf(Date);
  });

  it('sends trial expired email once after period end', async () => {
    const { service, emailService, getStored } = createHarness(trialSubscription());

    await service.notifyTrialExpired(workspaceId);
    await service.notifyTrialExpired(workspaceId);

    expect(emailService.send).toHaveBeenCalledTimes(1);
    expect(emailService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Your Assistrio trial has ended',
      }),
    );
    expect(getStored()?.trialExpiredEmailSentAt).toBeInstanceOf(Date);
  });

  it('sends trial credits used email once', async () => {
    const { service, emailService, getStored } = createHarness(trialSubscription());

    await service.notifyTrialCreditsUsed(workspaceId);
    await service.notifyTrialCreditsUsed(workspaceId);

    expect(emailService.send).toHaveBeenCalledTimes(1);
    expect(emailService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: "You've used your trial AI credits",
      }),
    );
    expect(getStored()?.trialCreditsUsedEmailSentAt).toBeInstanceOf(Date);
  });

  it('does not send trial emails for paid workspaces', async () => {
    const { service, emailService } = createHarness(
      trialSubscription({
        planKey: 'starter',
        status: 'active',
        providerSubscriptionId: 'sub-paid',
      }),
    );

    await service.notifyTrialStarted(workspaceId);
    await service.notifyTrialExpired(workspaceId);

    expect(emailService.send).not.toHaveBeenCalled();
  });

  it('does not send expired email when workspace upgraded to paid', async () => {
    const { service, emailService } = createHarness(
      trialSubscription({
        planKey: 'pro',
        status: 'active',
        providerSubscriptionId: 'sub-paid',
        currentPeriodEnd: new Date('2026-04-01T00:00:00.000Z'),
      }),
    );

    await service.notifyTrialExpired(workspaceId);

    expect(emailService.send).not.toHaveBeenCalled();
  });
});
