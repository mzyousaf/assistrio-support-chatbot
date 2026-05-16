import { Logger } from '@nestjs/common';
import { Types } from 'mongoose';
import { deletePrivateObject } from '../lib/s3';
import { KnowledgeItemPurgeService } from './knowledge-item-purge.service';

jest.mock('../lib/s3', () => ({
  deletePrivateObject: jest.fn().mockResolvedValue(undefined),
}));

describe('KnowledgeItemPurgeService', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
    jest.mocked(deletePrivateObject).mockClear();
    jest.mocked(deletePrivateObject).mockResolvedValue(undefined);
  });

  function tableImportJobModelWithFind(leanRows: unknown[]) {
    const lean = jest.fn().mockResolvedValue(leanRows);
    const find = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({ lean }),
    });
    return { find, lean };
  }

  function tableImportSessionModelWithFind(leanRows: unknown[]) {
    const lean = jest.fn().mockResolvedValue(leanRows);
    const find = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({ lean }),
    });
    return { find, lean };
  }

  it('purgeDueItems hard-purges each candidate row and refreshes stats per bot', async () => {
    process.env = { ...originalEnv, KNOWLEDGE_ITEM_PURGE_AFTER_MINUTES: '60' };
    const botId = new Types.ObjectId();
    const kbId = new Types.ObjectId();

    const leanRows = [{ _id: kbId, botId, sourceType: 'faq' as const }];

    const findChain = {
      select: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(leanRows),
    };
    const itemFind = jest.fn().mockReturnValue(findChain);

    const chunkDeleteMany = jest.fn().mockResolvedValue({ deletedCount: 1 });
    const extractDeleteMany = jest.fn().mockResolvedValue({ deletedCount: 0 });
    const trainDeleteMany = jest.fn().mockResolvedValue({ deletedCount: 0 });
    const tableJobDeleteMany = jest.fn().mockResolvedValue({ deletedCount: 0 });
    const { find: tableJobFind } = tableImportJobModelWithFind([]);
    const tableSessionDeleteMany = jest.fn().mockResolvedValue({ deletedCount: 0 });
    const { find: tableSessionFind } = tableImportSessionModelWithFind([]);
    const itemDeleteOne = jest.fn().mockResolvedValue({ deletedCount: 1 });

    const recalculate = jest.fn().mockResolvedValue(undefined);

    const itemModel = { find: itemFind, deleteOne: itemDeleteOne } as never;

    const svc = new KnowledgeItemPurgeService(
      itemModel,
      { deleteMany: chunkDeleteMany } as never,
      { deleteMany: extractDeleteMany } as never,
      { deleteMany: trainDeleteMany } as never,
      { find: tableJobFind, deleteMany: tableJobDeleteMany } as never,
      { find: tableSessionFind, deleteMany: tableSessionDeleteMany } as never,
      { recalculateKnowledgeStatsForBot: recalculate } as never,
    );

    const { purged, botsToRefresh } = await svc.purgeDueItems();

    expect(purged).toBe(1);
    expect(botsToRefresh).toEqual([String(botId)]);

    expect(itemFind).toHaveBeenCalledWith({
      active: false,
      deletedAt: { $lte: expect.any(Date) },
    });

    expect(chunkDeleteMany).toHaveBeenCalledWith({ knowledgeBaseItemId: kbId });
    expect(tableJobFind).toHaveBeenCalledWith({ botId, knowledgeBaseItemId: kbId });
    expect(tableSessionFind).toHaveBeenCalledWith({
      botId,
      $or: [{ resultKnowledgeBaseItemId: kbId }],
    });
    expect(deletePrivateObject).not.toHaveBeenCalled();
    expect(extractDeleteMany).toHaveBeenCalledWith({ botId, knowledgeBaseItemId: kbId });
    expect(trainDeleteMany).toHaveBeenCalledWith({
      botId,
      kind: 'document',
      knowledgeBaseItemId: kbId,
    });
    expect(tableJobDeleteMany).toHaveBeenCalledWith({ botId, knowledgeBaseItemId: kbId });
    expect(tableSessionDeleteMany).toHaveBeenCalledWith({
      botId,
      $or: [{ resultKnowledgeBaseItemId: kbId }],
    });
    expect(itemDeleteOne).toHaveBeenCalledWith({ _id: kbId, botId });
    expect(recalculate).toHaveBeenCalledWith(String(botId));
  });

  it('purgeDueItems query requires deletedAt cutoff (inactive alone is not purge-eligible)', async () => {
    const itemFind = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    });
    const svc = new KnowledgeItemPurgeService(
      { find: itemFind, deleteOne: jest.fn().mockResolvedValue({}) } as never,
      { deleteMany: jest.fn().mockResolvedValue({}) } as never,
      { deleteMany: jest.fn().mockResolvedValue({}) } as never,
      { deleteMany: jest.fn().mockResolvedValue({}) } as never,
      { find: jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }) }), deleteMany: jest.fn().mockResolvedValue({}) } as never,
      { find: jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }) }), deleteMany: jest.fn().mockResolvedValue({}) } as never,
      { recalculateKnowledgeStatsForBot: jest.fn().mockResolvedValue(undefined) } as never,
    );

    await svc.purgeDueItems();

    expect(itemFind).toHaveBeenCalledWith({
      active: false,
      deletedAt: { $lte: expect.any(Date) },
    });
  });

  it('purgeDueItems deletes document fileMeta S3 object and related table-import keys', async () => {
    process.env = { ...originalEnv, KNOWLEDGE_ITEM_PURGE_AFTER_MINUTES: '60' };
    const botId = new Types.ObjectId();
    const kbId = new Types.ObjectId();
    const jobId = new Types.ObjectId();

    const leanRows = [
      {
        _id: kbId,
        botId,
        sourceType: 'document' as const,
        fileMeta: {
          storageBucket: 'doc-bucket',
          storageKey: 'uploads/doc.pdf',
          storage: 's3',
        },
      },
    ];
    const itemFind = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(leanRows),
    });

    const { find: tableJobFind } = tableImportJobModelWithFind([
      { _id: jobId, s3Bucket: 'temp-bucket', s3Key: 'imports/file.xlsx' },
    ]);
    const { find: tableSessionFind } = tableImportSessionModelWithFind([]);

    const svc = new KnowledgeItemPurgeService(
      { find: itemFind, deleteOne: jest.fn().mockResolvedValue({ deletedCount: 1 }) } as never,
      { deleteMany: jest.fn().mockResolvedValue({}) } as never,
      { deleteMany: jest.fn().mockResolvedValue({}) } as never,
      { deleteMany: jest.fn().mockResolvedValue({}) } as never,
      { find: tableJobFind, deleteMany: jest.fn().mockResolvedValue({}) } as never,
      { find: tableSessionFind, deleteMany: jest.fn().mockResolvedValue({}) } as never,
      { recalculateKnowledgeStatsForBot: jest.fn().mockResolvedValue(undefined) } as never,
    );

    await svc.purgeDueItems();

    expect(deletePrivateObject).toHaveBeenCalledWith('doc-bucket', 'uploads/doc.pdf');
    expect(deletePrivateObject).toHaveBeenCalledWith('temp-bucket', 'imports/file.xlsx');
    expect(deletePrivateObject).toHaveBeenCalledTimes(2);
  });

  it('purgeDueItems does not call S3 for https-only fileMeta', async () => {
    process.env = { ...originalEnv, KNOWLEDGE_ITEM_PURGE_AFTER_MINUTES: '60' };
    const botId = new Types.ObjectId();
    const kbId = new Types.ObjectId();

    const leanRows = [
      {
        _id: kbId,
        botId,
        sourceType: 'html' as const,
        fileMeta: {
          storageBucket: 'x',
          storageKey: 'y',
          storage: 'https',
        },
      },
    ];
    const itemFind = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(leanRows),
    });

    const { find: tableJobFind } = tableImportJobModelWithFind([]);
    const { find: tableSessionFind } = tableImportSessionModelWithFind([]);

    const svc = new KnowledgeItemPurgeService(
      { find: itemFind, deleteOne: jest.fn().mockResolvedValue({ deletedCount: 1 }) } as never,
      { deleteMany: jest.fn().mockResolvedValue({}) } as never,
      { deleteMany: jest.fn().mockResolvedValue({}) } as never,
      { deleteMany: jest.fn().mockResolvedValue({}) } as never,
      { find: tableJobFind, deleteMany: jest.fn().mockResolvedValue({}) } as never,
      { find: tableSessionFind, deleteMany: jest.fn().mockResolvedValue({}) } as never,
      { recalculateKnowledgeStatsForBot: jest.fn().mockResolvedValue(undefined) } as never,
    );

    await svc.purgeDueItems();
    expect(deletePrivateObject).not.toHaveBeenCalled();
  });

  it('purgeDueItems deletes tableImportSession S3 when linked by resultKnowledgeBaseItemId', async () => {
    process.env = { ...originalEnv, KNOWLEDGE_ITEM_PURGE_AFTER_MINUTES: '60' };
    const botId = new Types.ObjectId();
    const kbId = new Types.ObjectId();
    const sessionId = new Types.ObjectId();

    const leanRows = [{ _id: kbId, botId, sourceType: 'table' as const }];
    const itemFind = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(leanRows),
    });

    const { find: tableJobFind } = tableImportJobModelWithFind([]);
    const { find: tableSessionFind } = tableImportSessionModelWithFind([
      { _id: sessionId, s3Bucket: 'sess-bucket', s3Key: 'preview/blob' },
    ]);

    const svc = new KnowledgeItemPurgeService(
      { find: itemFind, deleteOne: jest.fn().mockResolvedValue({ deletedCount: 1 }) } as never,
      { deleteMany: jest.fn().mockResolvedValue({}) } as never,
      { deleteMany: jest.fn().mockResolvedValue({}) } as never,
      { deleteMany: jest.fn().mockResolvedValue({}) } as never,
      { find: tableJobFind, deleteMany: jest.fn().mockResolvedValue({}) } as never,
      { find: tableSessionFind, deleteMany: jest.fn().mockResolvedValue({}) } as never,
      { recalculateKnowledgeStatsForBot: jest.fn().mockResolvedValue(undefined) } as never,
    );

    await svc.purgeDueItems();

    expect(deletePrivateObject).toHaveBeenCalledWith('sess-bucket', 'preview/blob');
    expect(deletePrivateObject).toHaveBeenCalledTimes(1);
  });

  it('purgeDueItems deletes session S3 once when job and session share the same key', async () => {
    process.env = { ...originalEnv, KNOWLEDGE_ITEM_PURGE_AFTER_MINUTES: '60' };
    const botId = new Types.ObjectId();
    const kbId = new Types.ObjectId();
    const jobId = new Types.ObjectId();
    const sessionId = new Types.ObjectId();

    const leanRows = [{ _id: kbId, botId, sourceType: 'table' as const }];
    const itemFind = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(leanRows),
    });

    const { find: tableJobFind } = tableImportJobModelWithFind([
      { _id: jobId, importSessionId: sessionId, s3Bucket: 'shared', s3Key: 'same-key' },
    ]);
    const { find: tableSessionFind } = tableImportSessionModelWithFind([
      { _id: sessionId, s3Bucket: 'shared', s3Key: 'same-key' },
    ]);

    const svc = new KnowledgeItemPurgeService(
      { find: itemFind, deleteOne: jest.fn().mockResolvedValue({ deletedCount: 1 }) } as never,
      { deleteMany: jest.fn().mockResolvedValue({}) } as never,
      { deleteMany: jest.fn().mockResolvedValue({}) } as never,
      { deleteMany: jest.fn().mockResolvedValue({}) } as never,
      { find: tableJobFind, deleteMany: jest.fn().mockResolvedValue({}) } as never,
      { find: tableSessionFind, deleteMany: jest.fn().mockResolvedValue({}) } as never,
      { recalculateKnowledgeStatsForBot: jest.fn().mockResolvedValue(undefined) } as never,
    );

    await svc.purgeDueItems();

    expect(deletePrivateObject).toHaveBeenCalledTimes(1);
    expect(deletePrivateObject).toHaveBeenCalledWith('shared', 'same-key');
  });

  it('purgeDueItems continues when S3 delete fails', async () => {
    process.env = { ...originalEnv, KNOWLEDGE_ITEM_PURGE_AFTER_MINUTES: '60' };
    const botId = new Types.ObjectId();
    const kbId = new Types.ObjectId();
    const jobId = new Types.ObjectId();

    jest.mocked(deletePrivateObject).mockRejectedValueOnce(new Error('access denied'));

    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    const leanRows = [{ _id: kbId, botId, sourceType: 'table' as const }];
    const itemFind = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(leanRows),
    });

    const tableJobDeleteMany = jest.fn().mockResolvedValue({ deletedCount: 1 });
    const { find: tableJobFind } = tableImportJobModelWithFind([
      { _id: jobId, s3Bucket: 'b', s3Key: 'k' },
    ]);
    const { find: tableSessionFind } = tableImportSessionModelWithFind([]);

    const svc = new KnowledgeItemPurgeService(
      { find: itemFind, deleteOne: jest.fn().mockResolvedValue({ deletedCount: 1 }) } as never,
      { deleteMany: jest.fn().mockResolvedValue({}) } as never,
      { deleteMany: jest.fn().mockResolvedValue({}) } as never,
      { deleteMany: jest.fn().mockResolvedValue({}) } as never,
      { find: tableJobFind, deleteMany: tableJobDeleteMany } as never,
      { find: tableSessionFind, deleteMany: jest.fn().mockResolvedValue({}) } as never,
      { recalculateKnowledgeStatsForBot: jest.fn().mockResolvedValue(undefined) } as never,
    );

    await expect(svc.purgeDueItems()).resolves.toMatchObject({ purged: 1 });

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringMatching(
        /S3 purge delete failed sourceType=table itemId=.* provenance=tableImportJob:.* bucket=b:/,
      ),
    );
    expect(tableJobDeleteMany).toHaveBeenCalledWith({ botId, knowledgeBaseItemId: kbId });

    warnSpy.mockRestore();
  });
});
