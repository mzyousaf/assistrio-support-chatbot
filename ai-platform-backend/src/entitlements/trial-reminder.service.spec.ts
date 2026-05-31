import { Types } from 'mongoose';
import { TrialReminderService } from './trial-reminder.service';

describe('TrialReminderService', () => {
  const workspaceId = new Types.ObjectId('507f1f77bcf86cd799439011');

  function createHarness(rows: Record<string, unknown>[], creditsUsed = 0) {
    const trialEmailService = {
      notifyTrialEndingSoon: jest.fn().mockResolvedValue(undefined),
      notifyTrialExpired: jest.fn().mockResolvedValue(undefined),
      notifyTrialCreditsUsed: jest.fn().mockResolvedValue(undefined),
    };

    const subscriptionModel = {
      find: jest.fn(() => ({
        select: jest.fn(() => ({
          lean: jest.fn(() => ({
            exec: jest.fn().mockResolvedValue(rows),
          })),
        })),
      })),
    };

    const usageLedgerModel = {
      aggregate: jest.fn(() => ({
        exec: jest.fn().mockResolvedValue([{ total: creditsUsed }]),
      })),
    };

    const service = new TrialReminderService(
      subscriptionModel as never,
      usageLedgerModel as never,
      trialEmailService as never,
    );

    return { service, trialEmailService };
  }

  it('sends ending soon email for trials ending within 24 hours', async () => {
    const now = new Date('2026-05-07T12:00:00.000Z');
    const { service, trialEmailService } = createHarness([
      {
        workspaceId,
        currentPeriodEnd: new Date('2026-05-08T00:00:00.000Z'),
      },
    ]);

    await service.runReminders(now);

    expect(trialEmailService.notifyTrialEndingSoon).toHaveBeenCalledWith(
      String(workspaceId),
      expect.any(Date),
    );
  });

  it('sends expired email when trial period ended', async () => {
    const now = new Date('2026-05-09T00:00:00.000Z');
    const { service, trialEmailService } = createHarness([
      {
        workspaceId,
        currentPeriodEnd: new Date('2026-05-08T00:00:00.000Z'),
      },
    ]);

    await service.runReminders(now);

    expect(trialEmailService.notifyTrialExpired).toHaveBeenCalledWith(String(workspaceId));
  });

  it('sends credits used email when trial credits are exhausted', async () => {
    const now = new Date('2026-05-03T00:00:00.000Z');
    const { service, trialEmailService } = createHarness(
      [
        {
          workspaceId,
          currentPeriodStart: new Date('2026-05-01T00:00:00.000Z'),
          currentPeriodEnd: new Date('2026-05-08T00:00:00.000Z'),
        },
      ],
      50,
    );

    await service.runReminders(now);

    expect(trialEmailService.notifyTrialCreditsUsed).toHaveBeenCalledWith(String(workspaceId));
  });
});
