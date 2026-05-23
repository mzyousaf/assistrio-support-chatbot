import { Types } from 'mongoose';
import { BotsService } from './bots.service';

describe('BotsService soft remove', () => {
  it('remove marks bot deleted, cascades KB soft-delete, clears chunks and queued jobs, fails table imports', async () => {
    const botId = new Types.ObjectId();
    const now = new Date();
    const findOneAndUpdate = jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue({ _id: botId, active: false, deletedAt: now }),
    });
    const botModel = {
      findOneAndUpdate,
      findById: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }),
      }),
    } as never;

    const softDelete = jest.fn().mockResolvedValue(2);
    const knowledgeBaseItemService = { softDeleteKnowledgeItemsMatching: softDelete } as never;
    const chunkDeleteMany = jest.fn().mockResolvedValue({ deletedCount: 1 });
    const extractDeleteMany = jest.fn().mockResolvedValue({ deletedCount: 1 });
    const trainDeleteMany = jest.fn().mockResolvedValue({ deletedCount: 1 });
    const summaryDeleteMany = jest.fn().mockResolvedValue({ deletedCount: 1 });
    const tableUpdateMany = jest.fn().mockResolvedValue({ modifiedCount: 1 });

    const svc = new BotsService(
      {} as never,
      botModel,
      {} as never,
      { deleteMany: chunkDeleteMany } as never,
      { deleteMany: extractDeleteMany } as never,
      { deleteMany: trainDeleteMany } as never,
      { deleteMany: summaryDeleteMany } as never,
      {} as never,
      {} as never,
      {} as never,
      { updateMany: tableUpdateMany } as never,
      knowledgeBaseItemService,
      {} as never,
      {} as never,
      {} as never,
    );

    const r = await svc.remove(String(botId));
    expect(r.alreadyDeleted).toBe(false);
    expect(softDelete).toHaveBeenCalledWith(String(botId), {});
    expect(chunkDeleteMany).toHaveBeenCalledWith({ botId });
    expect(extractDeleteMany).toHaveBeenCalledWith({ botId, status: 'queued' });
    expect(trainDeleteMany).toHaveBeenCalledWith({ botId, status: 'queued' });
    expect(summaryDeleteMany).toHaveBeenCalledWith({ botId, status: 'queued' });
    expect(tableUpdateMany).toHaveBeenCalledWith(
      { botId, status: { $in: ['queued', 'processing'] } },
      expect.objectContaining({
        $set: expect.objectContaining({ errorCode: 'kb_bot_deleted', status: 'failed' }),
      }),
    );
  });

  it('remove is idempotent when bot already soft-deleted', async () => {
    const botId = new Types.ObjectId();
    const findOneAndUpdate = jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(null),
    });
    const botModel = {
      findOneAndUpdate,
      findById: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({ active: false, deletedAt: new Date() }),
        }),
      }),
    } as never;

    const svc = new BotsService(
      {} as never,
      botModel,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { softDeleteKnowledgeItemsMatching: jest.fn() } as never,
      {} as never,
      {} as never,
      {} as never,
    );

    const r = await svc.remove(String(botId));
    expect(r.alreadyDeleted).toBe(true);
  });
});
