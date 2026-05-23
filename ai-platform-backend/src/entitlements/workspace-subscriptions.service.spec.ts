import { Types } from 'mongoose';
import { WorkspaceSubscriptionsService } from './workspace-subscriptions.service';

describe('WorkspaceSubscriptionsService', () => {
  const workspaceId = new Types.ObjectId('507f1f77bcf86cd799439011');

  function createService(initialDoc: Record<string, unknown> | null) {
    let stored = initialDoc;
    const subscriptionModel = {
      findOne: jest.fn(({ workspaceId: wsId }: { workspaceId: Types.ObjectId }) => ({
        lean: jest.fn().mockResolvedValue(stored && String(stored.workspaceId) === String(wsId) ? stored : null),
      })),
      create: jest.fn(async (payload: Record<string, unknown>) => {
        if (stored) {
          const err = new Error('duplicate') as Error & { code: number };
          err.code = 11000;
          throw err;
        }
        stored = { ...payload, _id: new Types.ObjectId() };
        return { toObject: () => stored };
      }),
    };

    return {
      service: new WorkspaceSubscriptionsService(subscriptionModel as never),
      subscriptionModel,
      getStored: () => stored,
    };
  }

  it('creates a Free subscription when none exists', async () => {
    const { service, subscriptionModel } = createService(null);

    const result = await service.ensureFreeSubscriptionForWorkspace(workspaceId);

    expect(subscriptionModel.create).toHaveBeenCalledTimes(1);
    expect(result.planKey).toBe('free');
    expect(result.status).toBe('free');
    expect(result.workspaceId).toEqual(workspaceId);
    expect(result.currentPeriodStart).toBeInstanceOf(Date);
    expect(result.currentPeriodEnd).toBeInstanceOf(Date);
  });

  it('is idempotent when subscription already exists', async () => {
    const existing = {
      workspaceId,
      planKey: 'free',
      status: 'free',
      currentPeriodStart: new Date('2026-05-01'),
      currentPeriodEnd: new Date('2026-06-01'),
    };
    const { service, subscriptionModel } = createService(existing);

    const result = await service.ensureFreeSubscriptionForWorkspace(workspaceId);

    expect(subscriptionModel.create).not.toHaveBeenCalled();
    expect(result).toEqual(existing);
  });

  it('returns raced row when duplicate key occurs on create', async () => {
    const raced = {
      workspaceId,
      planKey: 'free',
      status: 'free',
      currentPeriodStart: new Date('2026-05-01'),
      currentPeriodEnd: new Date('2026-06-01'),
    };

    const subscriptionModel = {
      findOne: jest
        .fn()
        .mockReturnValueOnce({ lean: jest.fn().mockResolvedValue(null) })
        .mockReturnValueOnce({ lean: jest.fn().mockResolvedValue(raced) }),
      create: jest.fn(async () => {
        const err = new Error('duplicate') as Error & { code: number };
        err.code = 11000;
        throw err;
      }),
    };

    const service = new WorkspaceSubscriptionsService(subscriptionModel as never);
    const result = await service.ensureFreeSubscriptionForWorkspace(workspaceId);

    expect(result).toEqual(raced);
  });
});
