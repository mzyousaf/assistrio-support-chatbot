import { Types } from 'mongoose';
import { SummaryJobService } from './summary-job.service';

function mongoFindOneAndUpdateChain<T>(result: T) {
  return {
    sort: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(result),
    }),
  };
}

describe('SummaryJobService.enqueue', () => {
  const fixedNow = new Date('2026-01-02T03:04:05.000Z');
  let dateNowSpy: jest.SpyInstance<number, []>;

  let summaryJobModel: {
    findOne: jest.Mock;
    create: jest.Mock;
    findOneAndUpdate: jest.Mock;
    updateOne: jest.Mock;
  };
  let conversationModel: { findById: jest.Mock; updateOne: jest.Mock };
  let messageModel: { find: jest.Mock };
  let botModel: { findById: jest.Mock };
  let service: SummaryJobService;

  beforeEach(() => {
    jest.clearAllMocks();
    dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(fixedNow.getTime());

    summaryJobModel = {
      findOne: jest.fn(),
      create: jest.fn().mockResolvedValue({ _id: new Types.ObjectId() }),
      findOneAndUpdate: jest.fn().mockReturnValue(mongoFindOneAndUpdateChain(null)),
      updateOne: jest.fn().mockResolvedValue({ acknowledged: true }),
    };
    conversationModel = {
      findById: jest.fn(),
      updateOne: jest.fn().mockResolvedValue({ acknowledged: true }),
    };
    messageModel = { find: jest.fn() };
    botModel = { findById: jest.fn() };
    service = new SummaryJobService(
      { get: jest.fn().mockReturnValue('') } as any,
      summaryJobModel as any,
      conversationModel as any,
      messageModel as any,
      botModel as any,
    );
  });

  afterEach(() => {
    dateNowSpy.mockRestore();
  });

  it('creates a queued summary job when none exists in the current window', async () => {
    summaryJobModel.findOne.mockResolvedValue(null);
    const conversationId = new Types.ObjectId();
    const botId = new Types.ObjectId();

    const out = await service.enqueue(conversationId, botId);

    expect(out).toBe(true);
    expect(summaryJobModel.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId,
        botId,
        status: { $in: ['queued', 'processing'] },
      }),
    );
    expect(summaryJobModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId,
        botId,
        status: 'queued',
        enqueueWindowSlot: Math.floor(fixedNow.getTime() / 60_000),
      }),
    );
  });

  it('reuses existing queued job in same window (no duplicate create)', async () => {
    summaryJobModel.findOne.mockResolvedValue({
      _id: new Types.ObjectId(),
      status: 'queued',
    });

    const out = await service.enqueue(new Types.ObjectId(), new Types.ObjectId());
    expect(out).toBe(false);
    expect(summaryJobModel.create).not.toHaveBeenCalled();
  });

  it('reuses existing processing job in same window (no duplicate create)', async () => {
    summaryJobModel.findOne.mockResolvedValue({
      _id: new Types.ObjectId(),
      status: 'processing',
    });

    const out = await service.enqueue(new Types.ObjectId(), new Types.ObjectId());
    expect(out).toBe(false);
    expect(summaryJobModel.create).not.toHaveBeenCalled();
  });

  it('creates a new job when no live queued/processing row is found (done/failed do not block)', async () => {
    summaryJobModel.findOne.mockResolvedValue(null);
    const out = await service.enqueue(new Types.ObjectId(), new Types.ObjectId());
    expect(out).toBe(true);
    expect(summaryJobModel.create).toHaveBeenCalledTimes(1);
  });

  it('handles duplicate-key enqueue race by returning false', async () => {
    summaryJobModel.findOne.mockResolvedValue(null);
    summaryJobModel.create.mockRejectedValue({ code: 11000 });

    const out = await service.enqueue(new Types.ObjectId(), new Types.ObjectId());

    expect(out).toBe(false);
  });
});
