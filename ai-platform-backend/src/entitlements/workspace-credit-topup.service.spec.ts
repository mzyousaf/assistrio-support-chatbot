import { Types } from 'mongoose';
import { WorkspaceCreditTopUpService } from './workspace-credit-topup.service';

describe('WorkspaceCreditTopUpService', () => {
  const workspaceId = '507f1f77bcf86cd799439011';
  const now = new Date('2026-06-15T12:00:00.000Z');

  it('sums non-expired remaining credits', async () => {
    const topUpModel = {
      find: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([
              { creditsRemaining: 400 },
              { creditsRemaining: 600 },
            ]),
          }),
        }),
      }),
    };

    const service = new WorkspaceCreditTopUpService(topUpModel as never);
    await expect(service.sumRemainingCredits(workspaceId, now)).resolves.toBe(1000);
  });

  it('debits FIFO from oldest top-up', async () => {
    const row = {
      _id: new Types.ObjectId(),
      creditsRemaining: 100,
    };
    const topUpModel = {
      findOne: jest
        .fn()
        .mockReturnValueOnce({ sort: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(row) }) })
        .mockReturnValueOnce({ sort: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }) }),
      findOneAndUpdate: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({ creditsRemaining: 0 }) }),
    };

    const service = new WorkspaceCreditTopUpService(topUpModel as never);
    await expect(service.debitCredits(workspaceId, 50, now)).resolves.toBe(50);
    expect(topUpModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: row._id, creditsRemaining: { $gte: 50 } },
      { $inc: { creditsRemaining: -50 } },
      { new: true },
    );
  });

  it('debitSpillAfterMonthlyUsed only debits over monthly cap', async () => {
    const topUpModel = {
      findOne: jest.fn().mockReturnValue({ sort: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }) }),
      findOneAndUpdate: jest.fn(),
    };
    const service = new WorkspaceCreditTopUpService(topUpModel as never);

    await expect(
      service.debitSpillAfterMonthlyUsed(workspaceId, 500, 499, 1, now),
    ).resolves.toBe(0);
    await expect(
      service.debitSpillAfterMonthlyUsed(workspaceId, 500, 500, 2, now),
    ).resolves.toBe(0);
  });
});
