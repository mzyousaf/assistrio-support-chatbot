import { Types } from 'mongoose';
import { KnowledgeBaseChunkService } from './knowledge-base-chunk.service';

function oid(): Types.ObjectId {
  return new Types.ObjectId();
}

/** Supports await deleteMany() and await deleteMany().session(sess) like Mongoose Query. */
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

describe('KnowledgeBaseChunkService scope training — chunk persist failures', () => {
  const botIdStr = new Types.ObjectId().toString();
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

  beforeEach(() => {
    const session = createTxnSessionMock();
    chunkModel = {
      deleteMany: jest.fn().mockImplementation(() => mockDeleteManyResult()),
      insertMany: jest.fn().mockResolvedValue([]),
      find: jest.fn(),
      db: { startSession: jest.fn().mockResolvedValue(session) },
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
    chunkModel.find.mockReturnValue({
      sort: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }),
    });
    service = new KnowledgeBaseChunkService(
      chunkModel as never,
      botModel as never,
      access as never,
      stats as never,
      rag as never,
    );
  });

  it('FAQ: insertMany failure marks item failed with faq_chunk_persist_failed; not ready', async () => {
    chunkModel.insertMany.mockRejectedValueOnce(new Error('insert bombed'));
    const itemId = oid();
    const lastAt = new Date('2024-06-01T12:00:00.000Z');
    const row = {
      _id: itemId,
      content: 'faq answer body',
      contentHash: 'hash-faq',
      lastContentUpdatedAt: lastAt,
    };
    access.findKnowledgeItemsForBot.mockResolvedValue([row]);
    access.findKnowledgeItemByIdLean.mockResolvedValue({
      _id: itemId,
      active: true,
      status: 'processing',
      content: row.content,
      contentHash: row.contentHash,
      lastContentUpdatedAt: lastAt,
    });

    await service.replaceFaqKnowledgeChunksForBot(botIdStr);

    expect(access.setKnowledgeItemStatusById).toHaveBeenCalledWith(itemId, 'failed', {
      errorMessage: 'faq_chunk_persist_failed',
    });
    const calls = access.setKnowledgeItemStatusById.mock.calls;
    expect(calls.some((c) => c[1] === 'ready')).toBe(false);
  });

  it('note: insertMany failure marks item failed with note_chunk_persist_failed', async () => {
    chunkModel.insertMany.mockRejectedValueOnce(new Error('bulk write error'));
    const itemId = oid();
    const lastAt = new Date('2024-06-02T12:00:00.000Z');
    const body = `${'Note paragraph for chunking. '.repeat(25)}`;
    const row = {
      _id: itemId,
      content: body,
      contentHash: 'hash-note',
      lastContentUpdatedAt: lastAt,
    };
    access.findKnowledgeItemsForBot.mockResolvedValue([row]);
    access.findKnowledgeItemByIdLean.mockResolvedValue({
      _id: itemId,
      active: true,
      status: 'processing',
      content: body,
      contentHash: row.contentHash,
      lastContentUpdatedAt: lastAt,
    });

    await service.replaceNoteKnowledgeChunksForBot(botIdStr);

    expect(access.setKnowledgeItemStatusById).toHaveBeenCalledWith(itemId, 'failed', {
      errorMessage: 'note_chunk_persist_failed',
    });
    expect(access.setKnowledgeItemStatusById.mock.calls.some((c) => c[1] === 'ready')).toBe(false);
  });

  it('table: insertMany failure marks item failed with table_chunk_persist_failed', async () => {
    chunkModel.insertMany.mockRejectedValueOnce(new Error('e11000'));
    const itemId = oid();
    const lastAt = new Date('2024-06-03T12:00:00.000Z');
    const content = 'table text for embed';
    const row = {
      _id: itemId,
      content,
      contentHash: 'hash-tbl',
      lastContentUpdatedAt: lastAt,
    };
    access.findKnowledgeItemsForBot.mockResolvedValue([row]);
    access.findKnowledgeItemByIdLean.mockResolvedValue({
      _id: itemId,
      active: true,
      status: 'processing',
      content,
      contentHash: row.contentHash,
      lastContentUpdatedAt: lastAt,
    });

    await service.replaceTableKnowledgeChunksForBot(botIdStr);

    expect(access.setKnowledgeItemStatusById).toHaveBeenCalledWith(itemId, 'failed', {
      errorMessage: 'table_chunk_persist_failed',
    });
    expect(access.setKnowledgeItemStatusById.mock.calls.some((c) => c[1] === 'ready')).toBe(false);
  });

  it('suggestion: empty scoped info marks ready without insertMany (label-only edge)', async () => {
    const itemId = oid();
    const lastAt = new Date('2024-06-04T12:00:00.000Z');
    const row = {
      _id: itemId,
      content: 'embed-text',
      title: 'Chip',
      contentHash: 'hash-sug',
      lastContentUpdatedAt: lastAt,
      suggestionMeta: { chipText: 'Chip', scopedInformation: '' },
    };
    access.findKnowledgeItemsForBot.mockResolvedValue([row]);
    access.findKnowledgeItemByIdLean.mockResolvedValue({
      _id: itemId,
      active: true,
      status: 'processing',
      content: row.content,
      title: row.title,
      contentHash: row.contentHash,
      lastContentUpdatedAt: lastAt,
      suggestionMeta: { chipText: 'Chip', scopedInformation: '' },
    });

    await service.replaceSuggestionKnowledgeChunksForBot(botIdStr);

    expect(chunkModel.insertMany).not.toHaveBeenCalled();
    expect(access.setKnowledgeItemStatusById).toHaveBeenCalledWith(itemId, 'ready');
    expect(access.setKnowledgeItemStatusById).not.toHaveBeenCalledWith(
      itemId,
      'failed',
      expect.anything(),
    );
  });
});
