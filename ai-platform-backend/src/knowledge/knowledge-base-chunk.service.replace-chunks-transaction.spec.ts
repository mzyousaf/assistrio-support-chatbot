import { Types } from 'mongoose';
import { KnowledgeBaseChunkService } from './knowledge-base-chunk.service';

function mockDeleteManyResult(res: { deletedCount: number } = { deletedCount: 1 }) {
  const p = Promise.resolve(res);
  return {
    session: jest.fn().mockReturnValue(p),
    then: (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
      p.then(onFulfilled as (v: unknown) => unknown, onRejected),
  };
}

function createTxnSessionMock() {
  return {
    startTransaction: jest.fn(),
    commitTransaction: jest.fn().mockResolvedValue(undefined),
    abortTransaction: jest.fn().mockResolvedValue(undefined),
    endSession: jest.fn().mockResolvedValue(undefined),
  };
}

describe('KnowledgeBaseChunkService.replaceChunksForKnowledgeItem (transactional)', () => {
  let chunkModel: {
    deleteMany: jest.Mock;
    insertMany: jest.Mock;
    find: jest.Mock;
    db: { startSession: jest.Mock };
  };
  let botModel: { findById: jest.Mock };
  let access: {
    findKnowledgeItemsForBot: jest.Mock;
    findKnowledgeItemByIdLean: jest.Mock;
    setKnowledgeItemStatusById: jest.Mock;
    requeueStaleProcessingItemNow: jest.Mock;
  };
  let stats: { recalculateKnowledgeStatsForBot: jest.Mock };
  let rag: { embedText: jest.Mock; embedTexts: jest.Mock };
  let service: KnowledgeBaseChunkService;
  let activeSession: ReturnType<typeof createTxnSessionMock>;

  beforeEach(() => {
    activeSession = createTxnSessionMock();
    chunkModel = {
      deleteMany: jest.fn().mockImplementation(() => mockDeleteManyResult()),
      insertMany: jest.fn().mockResolvedValue([]),
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }),
      }),
      db: { startSession: jest.fn().mockResolvedValue(activeSession) },
    };
    botModel = { findById: jest.fn().mockReturnValue({ select: () => ({ lean: jest.fn().mockResolvedValue(null) }) }) };
    access = {
      findKnowledgeItemsForBot: jest.fn(),
      findKnowledgeItemByIdLean: jest.fn(),
      setKnowledgeItemStatusById: jest.fn().mockResolvedValue(undefined),
      requeueStaleProcessingItemNow: jest.fn().mockResolvedValue(false),
    };
    stats = { recalculateKnowledgeStatsForBot: jest.fn().mockResolvedValue(undefined) };
    rag = {
      embedText: jest.fn().mockResolvedValue([0.01, 0.02]),
      embedTexts: jest.fn().mockImplementation((texts: string[]) => texts.map(() => [0.01, 0.02])),
    };
    service = new KnowledgeBaseChunkService(
      chunkModel as never,
      botModel as never,
      access as never,
      stats as never,
      rag as never,
    );
  });

  it('commits deleteMany + insertMany in one transaction (session on both ops)', async () => {
    const botId = new Types.ObjectId();
    const itemId = new Types.ObjectId();
    const chunks = [{ text: 'hello', embedding: [0.1, 0.2], chunkIndex: 0 }];

    const n = await service.replaceChunksForKnowledgeItem(botId, itemId, 'faq', chunks);

    expect(n).toBe(1);
    expect(chunkModel.db.startSession).toHaveBeenCalled();
    expect(activeSession.startTransaction).toHaveBeenCalled();
    const delChain = chunkModel.deleteMany.mock.results[0]?.value as { session: jest.Mock };
    expect(delChain.session).toHaveBeenCalledWith(activeSession);
    expect(chunkModel.insertMany).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          botId,
          knowledgeBaseItemId: itemId,
          sourceType: 'faq',
          text: 'hello',
          embedding: [0.1, 0.2],
          chunkIndex: 0,
        }),
      ]),
      expect.objectContaining({ session: activeSession }),
    );
    expect(activeSession.commitTransaction).toHaveBeenCalledTimes(1);
    expect(activeSession.abortTransaction).not.toHaveBeenCalled();
    expect(activeSession.endSession).toHaveBeenCalledTimes(1);
  });

  it('aborts transaction when insertMany fails (delete not left applied without new rows)', async () => {
    chunkModel.insertMany.mockRejectedValueOnce(new Error('bulk write error'));
    const botId = new Types.ObjectId();
    const itemId = new Types.ObjectId();

    await expect(
      service.replaceChunksForKnowledgeItem(botId, itemId, 'faq', [
        { text: 'x', embedding: [1], chunkIndex: 0 },
      ]),
    ).rejects.toThrow('bulk write error');

    expect(activeSession.abortTransaction).toHaveBeenCalledTimes(1);
    expect(activeSession.commitTransaction).not.toHaveBeenCalled();
    expect(activeSession.endSession).toHaveBeenCalledTimes(1);
  });

  it('empty chunk list: deleteMany + commit, no insertMany', async () => {
    const botId = new Types.ObjectId();
    const itemId = new Types.ObjectId();

    const n = await service.replaceChunksForKnowledgeItem(botId, itemId, 'document', []);

    expect(n).toBe(0);
    expect(chunkModel.insertMany).not.toHaveBeenCalled();
    expect(activeSession.commitTransaction).toHaveBeenCalledTimes(1);
    expect(activeSession.abortTransaction).not.toHaveBeenCalled();
  });

  it('falls back to non-transactional path when Mongo rejects transactions (dev standalone)', async () => {
    chunkModel.db.startSession.mockRejectedValueOnce(
      new Error('Transaction numbers are only allowed on a replica set member or mongos'),
    );
    const botId = new Types.ObjectId();
    const itemId = new Types.ObjectId();

    const n = await service.replaceChunksForKnowledgeItem(botId, itemId, 'faq', [
      { text: 'legacy', embedding: [0.5], chunkIndex: 0 },
    ]);

    expect(n).toBe(1);
    expect(chunkModel.insertMany).toHaveBeenCalledTimes(1);
    const opts = chunkModel.insertMany.mock.calls[0][1];
    expect(opts).toBeUndefined();
  });

  it('sequential replacements: last insertMany wins (no mixed batch in mock timeline)', async () => {
    const botId = new Types.ObjectId();
    const itemId = new Types.ObjectId();

    await service.replaceChunksForKnowledgeItem(botId, itemId, 'note', [
      { text: 'first', embedding: [0.1], chunkIndex: 0 },
    ]);
    await service.replaceChunksForKnowledgeItem(botId, itemId, 'note', [
      { text: 'second', embedding: [0.2], chunkIndex: 0 },
    ]);

    expect(chunkModel.insertMany).toHaveBeenCalledTimes(2);
    const lastDocs = chunkModel.insertMany.mock.calls[1][0] as Array<{ text: string }>;
    expect(lastDocs).toHaveLength(1);
    expect(lastDocs[0].text).toBe('second');
  });
});
