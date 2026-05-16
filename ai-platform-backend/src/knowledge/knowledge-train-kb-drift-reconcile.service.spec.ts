import { Types } from 'mongoose';
import { PLAN_LIMIT_BOT_KB_TOTAL_CODE } from './bot-knowledge-total-limit.service';
import { KnowledgeTrainKbDriftReconcileService } from './knowledge-train-kb-drift-reconcile.service';

function kbCandidatesChain(rows: unknown[]) {
  return {
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(rows),
  };
}

describe('KnowledgeTrainKbDriftReconcileService', () => {
  const prevDisabled = process.env.KNOWLEDGE_TRAIN_KB_DRIFT_RECONCILE_DISABLED;

  afterEach(() => {
    if (prevDisabled === undefined) delete process.env.KNOWLEDGE_TRAIN_KB_DRIFT_RECONCILE_DISABLED;
    else process.env.KNOWLEDGE_TRAIN_KB_DRIFT_RECONCILE_DISABLED = prevDisabled;
  });

  it('returns 0 when disabled via env', async () => {
    process.env.KNOWLEDGE_TRAIN_KB_DRIFT_RECONCILE_DISABLED = 'true';
    const itemModel = { find: jest.fn() };
    const trainJobModel = { find: jest.fn() };
    const chunkSvc = { countChunksWithValidEmbeddingsByKnowledgeItemIds: jest.fn() };
    const kbItemSvc = { setDocumentKnowledgeItemStatus: jest.fn() };

    const svc = new KnowledgeTrainKbDriftReconcileService(
      itemModel as never,
      trainJobModel as never,
      chunkSvc as never,
      kbItemSvc as never,
    );
    await expect(svc.reconcileDocumentTrainKbDrift()).resolves.toBe(0);
    expect(itemModel.find).not.toHaveBeenCalled();
  });

  it('calls setDocumentKnowledgeItemStatus(ready) when latest train is done, extraction ok, embeddings exist', async () => {
    const kbId = new Types.ObjectId();
    const botId = new Types.ObjectId();

    const itemModel = {
      find: jest.fn().mockReturnValue(
        kbCandidatesChain([
          {
            _id: kbId,
            botId,
            extractionStatus: 'done',
            isContentExtracted: true,
            trainingError: null,
          },
        ]),
      ),
    };
    const trainJobModel = {
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([{ knowledgeBaseItemId: kbId, status: 'done' }]),
      }),
    };
    const chunkSvc = {
      countChunksWithValidEmbeddingsByKnowledgeItemIds: jest
        .fn()
        .mockResolvedValue(new Map([[kbId.toString(), 2]])),
    };
    const setDocumentKnowledgeItemStatus = jest.fn().mockResolvedValue(true);
    const kbItemSvc = { setDocumentKnowledgeItemStatus };

    const svc = new KnowledgeTrainKbDriftReconcileService(
      itemModel as never,
      trainJobModel as never,
      chunkSvc as never,
      kbItemSvc as never,
    );

    await expect(svc.reconcileDocumentTrainKbDrift()).resolves.toBe(1);
    expect(setDocumentKnowledgeItemStatus).toHaveBeenCalledWith(botId.toString(), kbId.toString(), {
      status: 'ready',
    });
  });

  it('skips when newest train job is not done', async () => {
    const kbId = new Types.ObjectId();
    const botId = new Types.ObjectId();

    const itemModel = {
      find: jest.fn().mockReturnValue(
        kbCandidatesChain([
          {
            _id: kbId,
            botId,
            extractionStatus: 'done',
            isContentExtracted: true,
            trainingError: null,
          },
        ]),
      ),
    };
    const trainJobModel = {
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([
          { knowledgeBaseItemId: kbId, status: 'queued' },
          { knowledgeBaseItemId: kbId, status: 'done' },
        ]),
      }),
    };
    const chunkSvc = {
      countChunksWithValidEmbeddingsByKnowledgeItemIds: jest
        .fn()
        .mockResolvedValue(new Map([[kbId.toString(), 2]])),
    };
    const setDocumentKnowledgeItemStatus = jest.fn();
    const kbItemSvc = { setDocumentKnowledgeItemStatus };

    const svc = new KnowledgeTrainKbDriftReconcileService(
      itemModel as never,
      trainJobModel as never,
      chunkSvc as never,
      kbItemSvc as never,
    );

    await expect(svc.reconcileDocumentTrainKbDrift()).resolves.toBe(0);
    expect(setDocumentKnowledgeItemStatus).not.toHaveBeenCalled();
  });

  it('skips plan-limit rows', async () => {
    const kbId = new Types.ObjectId();
    const botId = new Types.ObjectId();

    const itemModel = {
      find: jest.fn().mockReturnValue(
        kbCandidatesChain([
          {
            _id: kbId,
            botId,
            extractionStatus: 'done',
            isContentExtracted: true,
            trainingError: PLAN_LIMIT_BOT_KB_TOTAL_CODE,
          },
        ]),
      ),
    };
    const trainJobModel = {
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([{ knowledgeBaseItemId: kbId, status: 'done' }]),
      }),
    };
    const chunkSvc = {
      countChunksWithValidEmbeddingsByKnowledgeItemIds: jest
        .fn()
        .mockResolvedValue(new Map([[kbId.toString(), 2]])),
    };
    const setDocumentKnowledgeItemStatus = jest.fn();
    const kbItemSvc = { setDocumentKnowledgeItemStatus };

    const svc = new KnowledgeTrainKbDriftReconcileService(
      itemModel as never,
      trainJobModel as never,
      chunkSvc as never,
      kbItemSvc as never,
    );

    await expect(svc.reconcileDocumentTrainKbDrift()).resolves.toBe(0);
    expect(setDocumentKnowledgeItemStatus).not.toHaveBeenCalled();
  });

  it('skips when KB contentHash no longer matches the completed train snapshot', async () => {
    const kbId = new Types.ObjectId();
    const botId = new Types.ObjectId();

    const itemModel = {
      find: jest.fn().mockReturnValue(
        kbCandidatesChain([
          {
            _id: kbId,
            botId,
            extractionStatus: 'done',
            isContentExtracted: true,
            trainingError: null,
            contentHash: 'hash-new',
            lastContentUpdatedAt: new Date('2026-05-01'),
          },
        ]),
      ),
    };
    const trainJobModel = {
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([
          {
            knowledgeBaseItemId: kbId,
            status: 'done',
            finishedAt: new Date('2026-04-01'),
            documentEmbedTargetContentHash: 'hash-old',
            documentEmbedTargetLastContentUpdatedAt: new Date('2026-03-01'),
          },
        ]),
      }),
    };
    const chunkSvc = {
      countChunksWithValidEmbeddingsByKnowledgeItemIds: jest
        .fn()
        .mockResolvedValue(new Map([[kbId.toString(), 2]])),
    };
    const setDocumentKnowledgeItemStatus = jest.fn();
    const kbItemSvc = { setDocumentKnowledgeItemStatus };

    const svc = new KnowledgeTrainKbDriftReconcileService(
      itemModel as never,
      trainJobModel as never,
      chunkSvc as never,
      kbItemSvc as never,
    );

    await expect(svc.reconcileDocumentTrainKbDrift()).resolves.toBe(0);
    expect(setDocumentKnowledgeItemStatus).not.toHaveBeenCalled();
  });

  it('skips when lastContentUpdatedAt is newer than the train job embed snapshot', async () => {
    const kbId = new Types.ObjectId();
    const botId = new Types.ObjectId();

    const itemModel = {
      find: jest.fn().mockReturnValue(
        kbCandidatesChain([
          {
            _id: kbId,
            botId,
            extractionStatus: 'done',
            isContentExtracted: true,
            trainingError: null,
            contentHash: 'same-hash',
            lastContentUpdatedAt: new Date('2026-05-06T12:00:00.000Z'),
          },
        ]),
      ),
    };
    const trainJobModel = {
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([
          {
            knowledgeBaseItemId: kbId,
            status: 'done',
            finishedAt: new Date('2026-05-01'),
            documentEmbedTargetContentHash: 'same-hash',
            documentEmbedTargetLastContentUpdatedAt: new Date('2026-05-01T10:00:00.000Z'),
          },
        ]),
      }),
    };
    const chunkSvc = {
      countChunksWithValidEmbeddingsByKnowledgeItemIds: jest
        .fn()
        .mockResolvedValue(new Map([[kbId.toString(), 2]])),
    };
    const setDocumentKnowledgeItemStatus = jest.fn();
    const kbItemSvc = { setDocumentKnowledgeItemStatus };

    const svc = new KnowledgeTrainKbDriftReconcileService(
      itemModel as never,
      trainJobModel as never,
      chunkSvc as never,
      kbItemSvc as never,
    );

    await expect(svc.reconcileDocumentTrainKbDrift()).resolves.toBe(0);
    expect(setDocumentKnowledgeItemStatus).not.toHaveBeenCalled();
  });
});
