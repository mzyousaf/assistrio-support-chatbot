import { HttpException, HttpStatus } from '@nestjs/common';
import { Types } from 'mongoose';
import { KNOWLEDGE_MANUAL_RETRY_MAX_PER_ITEM } from '../lib/global.constants';
import { KnowledgeItemManualRetryService } from './knowledge-item-manual-retry.service';

function leanChain<T>(doc: T | null) {
  return {
    lean: jest.fn().mockResolvedValue(doc),
  };
}

/** `findOne(...).sort(...).lean()` */
function sortLeanChain<T>(doc: T | null) {
  return {
    sort: jest.fn().mockReturnValue(leanChain(doc)),
  };
}

/** `findOne(...).select(...).lean()` */
function selectLeanChain<T>(doc: T | null) {
  return {
    select: jest.fn().mockReturnValue(leanChain(doc)),
  };
}

async function expectHttpError(
  promise: Promise<unknown>,
  status: number,
  errorCode: string,
): Promise<void> {
  try {
    await promise;
    throw new Error('expected HttpException');
  } catch (e) {
    expect(e).toBeInstanceOf(HttpException);
    const ex = e as HttpException;
    expect(ex.getStatus()).toBe(status);
    const body = ex.getResponse() as { errorCode?: string };
    expect(body.errorCode).toBe(errorCode);
  }
}

describe('KnowledgeItemManualRetryService', () => {
  const botId = new Types.ObjectId().toString();
  const itemId = new Types.ObjectId().toString();
  const botOid = new Types.ObjectId(botId);
  const itemOid = new Types.ObjectId(itemId);

  let itemModel: {
    findOne: jest.Mock;
    findById: jest.Mock;
    updateOne: jest.Mock;
  };
  let extractJobModel: { findOne: jest.Mock };
  let trainJobModel: { findOne: jest.Mock };
  let knowledgeBaseItemService: {
    queueSingleFailedKbItemForTraining: jest.Mock;
    getIngestQueueTimesForDocument: jest.Mock;
  };
  let knowledgeTrainingJobService: {
    manualResetStuckDocumentTrainForKnowledgeItem: jest.Mock;
    manualResetStuckScopesTrainForBotScope: jest.Mock;
  };
  let ingestionService: {
    manualRetryExtractJob: jest.Mock;
    manualResetStuckExtractForKnowledgeItem: jest.Mock;
    ensureQueuedIngestJobForDocument: jest.Mock;
  };
  let tableImportService: {
    findLiveTableImportJobForKnowledgeItem: jest.Mock;
    manualRetryFailedTableImport: jest.Mock;
    manualResetStuckTableImportForKnowledgeItem: jest.Mock;
  };
  let rateLimitService: { check: jest.Mock };

  let service: KnowledgeItemManualRetryService;

  beforeEach(() => {
    jest.clearAllMocks();
    itemModel = {
      findOne: jest.fn(),
      findById: jest.fn(),
      updateOne: jest.fn().mockResolvedValue({ acknowledged: true, modifiedCount: 1, matchedCount: 1 }),
    };
    extractJobModel = { findOne: jest.fn() };
    trainJobModel = { findOne: jest.fn() };
    knowledgeBaseItemService = {
      queueSingleFailedKbItemForTraining: jest.fn().mockResolvedValue({ updated: true }),
      getIngestQueueTimesForDocument: jest.fn().mockResolvedValue({
        lastQueuedAt: new Date('2026-01-01T00:00:00.000Z'),
        runAfter: new Date('2026-01-01T00:05:00.000Z'),
      }),
    };
    knowledgeTrainingJobService = {
      manualResetStuckDocumentTrainForKnowledgeItem: jest.fn(),
      manualResetStuckScopesTrainForBotScope: jest.fn(),
    };
    ingestionService = {
      manualRetryExtractJob: jest.fn().mockResolvedValue({ ok: true }),
      manualResetStuckExtractForKnowledgeItem: jest.fn(),
      ensureQueuedIngestJobForDocument: jest.fn().mockResolvedValue(undefined),
    };
    tableImportService = {
      findLiveTableImportJobForKnowledgeItem: jest.fn(),
      manualRetryFailedTableImport: jest.fn(),
      manualResetStuckTableImportForKnowledgeItem: jest.fn(),
    };
    rateLimitService = {
      check: jest.fn().mockResolvedValue({
        allowed: true,
        count: 1,
        limit: 1,
        windowStart: new Date(),
      }),
    };
    const botKbTotalLimit = {
      assertWithinLimit: jest.fn().mockResolvedValue(undefined),
    };

    service = new KnowledgeItemManualRetryService(
      itemModel as any,
      extractJobModel as any,
      trainJobModel as any,
      knowledgeBaseItemService as any,
      knowledgeTrainingJobService as any,
      ingestionService as any,
      tableImportService as any,
      botKbTotalLimit as any,
      rateLimitService as any,
    );
  });

  function mockLiveItem(overrides: Record<string, unknown> = {}) {
    itemModel.findOne.mockReturnValueOnce(
      leanChain({
        _id: itemOid,
        botId: botOid,
        active: true,
        sourceType: 'document',
        status: 'pending',
        extractionStatus: 'failed',
        content: '',
        isContentExtracted: false,
        ...overrides,
      }),
    );
  }

  function mockFreshAfterAction(overrides: Record<string, unknown> = {}) {
    itemModel.findById.mockReturnValueOnce(
      leanChain({
        _id: itemOid,
        botId: botOid,
        sourceType: 'document',
        ...(overrides as object),
      }),
    );
  }

  it('document extraction failed → retry_extraction', async () => {
    mockLiveItem({
      sourceType: 'document',
      status: 'pending',
      extractionStatus: 'failed',
      isContentExtracted: false,
      content: '',
      fileMeta: {},
    });
    extractJobModel.findOne.mockReturnValueOnce(sortLeanChain(null));
    mockFreshAfterAction({
      sourceType: 'document',
      status: 'pending',
      extractionStatus: 'queued',
    });

    const r = await service.manualRetry(botId, itemId);
    expect(r.action).toBe('retry_extraction');
    expect(ingestionService.manualRetryExtractJob).toHaveBeenCalledWith(botId, itemId);
  });

  it('second POST retry within min spacing returns retry_rate_limited', async () => {
    mockLiveItem({
      sourceType: 'document',
      status: 'pending',
      extractionStatus: 'failed',
      isContentExtracted: false,
      content: '',
      fileMeta: {},
    });
    extractJobModel.findOne.mockReturnValueOnce(sortLeanChain(null));
    mockFreshAfterAction({
      sourceType: 'document',
      status: 'pending',
      extractionStatus: 'queued',
    });

    await service.manualRetry(botId, itemId);

    mockLiveItem({
      sourceType: 'document',
      status: 'pending',
      extractionStatus: 'failed',
      isContentExtracted: false,
      content: '',
      fileMeta: {},
    });
    rateLimitService.check.mockResolvedValueOnce({
      allowed: false,
      count: 2,
      limit: 1,
      windowStart: new Date(),
    });

    await expectHttpError(service.manualRetry(botId, itemId), HttpStatus.TOO_MANY_REQUESTS, 'retry_rate_limited');
  });

  it('manual retry cap exceeded → manual_retry_cap_exceeded', async () => {
    itemModel.findOne.mockReturnValueOnce(
      leanChain({
        _id: itemOid,
        botId: botOid,
        active: true,
        sourceType: 'faq',
        status: 'failed',
        extractionStatus: 'not_required',
      }),
    );
    itemModel.updateOne.mockResolvedValueOnce({ acknowledged: true, modifiedCount: 0, matchedCount: 1 });
    itemModel.findById.mockReturnValueOnce(
      selectLeanChain({
        _id: itemOid,
        knowledgeManualRetryCount: KNOWLEDGE_MANUAL_RETRY_MAX_PER_ITEM,
      }),
    );

    await expectHttpError(
      service.manualRetry(botId, itemId),
      HttpStatus.TOO_MANY_REQUESTS,
      'manual_retry_cap_exceeded',
    );
  });

  it('document training failed → retry_training', async () => {
    mockLiveItem({
      sourceType: 'document',
      status: 'failed',
      extractionStatus: 'done',
      isContentExtracted: true,
      content: 'hello world',
    });
    extractJobModel.findOne.mockReturnValueOnce(sortLeanChain(null));
    trainJobModel.findOne.mockReturnValueOnce(sortLeanChain(null)).mockReturnValueOnce(sortLeanChain(null));
    mockFreshAfterAction({
      sourceType: 'document',
      status: 'queued',
      extractionStatus: 'done',
      isContentExtracted: true,
      content: 'hello world',
    });

    const r = await service.manualRetry(botId, itemId);
    expect(r.action).toBe('retry_training');
    expect(itemModel.updateOne).toHaveBeenCalled();
    expect(ingestionService.ensureQueuedIngestJobForDocument).toHaveBeenCalledWith(botId, itemId);
  });

  it('FAQ failed → retry_training (scope faq)', async () => {
    itemModel.findOne
      .mockReturnValueOnce(
        leanChain({
          _id: itemOid,
          botId: botOid,
          active: true,
          sourceType: 'faq',
          status: 'failed',
          extractionStatus: 'not_required',
        }),
      )
      .mockReturnValueOnce(selectLeanChain(null));
    itemModel.findById.mockReturnValueOnce(
      leanChain({
        _id: itemOid,
        botId: botOid,
        sourceType: 'faq',
        status: 'queued',
        extractionStatus: 'not_required',
      }),
    );

    const r = await service.manualRetry(botId, itemId);
    expect(r.action).toBe('retry_training');
    expect(knowledgeBaseItemService.queueSingleFailedKbItemForTraining).toHaveBeenCalledWith(
      botId,
      itemId,
      'faq',
    );
  });

  it('note failed → retry_training (scope note)', async () => {
    itemModel.findOne
      .mockReturnValueOnce(
        leanChain({
          _id: itemOid,
          botId: botOid,
          active: true,
          sourceType: 'note',
          status: 'failed',
          extractionStatus: 'not_required',
        }),
      )
      .mockReturnValueOnce(selectLeanChain(null));
    itemModel.findById.mockReturnValueOnce(
      leanChain({
        _id: itemOid,
        botId: botOid,
        sourceType: 'note',
        status: 'queued',
        extractionStatus: 'not_required',
      }),
    );

    const r = await service.manualRetry(botId, itemId);
    expect(r.action).toBe('retry_training');
    expect(knowledgeBaseItemService.queueSingleFailedKbItemForTraining).toHaveBeenCalledWith(
      botId,
      itemId,
      'note',
    );
  });

  it('table training failed → retry_training (scope table)', async () => {
    itemModel.findOne.mockReturnValueOnce(
      leanChain({
        _id: itemOid,
        botId: botOid,
        active: true,
        sourceType: 'table',
        status: 'failed',
        extractionStatus: 'not_required',
        tableMeta: { importPhase: 'complete' },
      }),
    );
    itemModel.findById.mockReturnValueOnce(
      leanChain({
        _id: itemOid,
        botId: botOid,
        sourceType: 'table',
        status: 'queued',
        extractionStatus: 'not_required',
        tableMeta: { importPhase: 'complete' },
      }),
    );

    const r = await service.manualRetry(botId, itemId);
    expect(r.action).toBe('retry_training');
    expect(knowledgeBaseItemService.queueSingleFailedKbItemForTraining).toHaveBeenCalledWith(
      botId,
      itemId,
      'table',
    );
  });

  it('suggestion without scopedInformation → retry_not_allowed', async () => {
    itemModel.findOne.mockReturnValueOnce(
      leanChain({
        _id: itemOid,
        botId: botOid,
        active: true,
        sourceType: 'suggestion',
        status: 'failed',
        extractionStatus: 'not_required',
        suggestionMeta: { chipText: 'Hi', suggestionIndex: 0 },
      }),
    );

    await expectHttpError(service.manualRetry(botId, itemId), HttpStatus.BAD_REQUEST, 'retry_not_allowed');
    expect(knowledgeBaseItemService.queueSingleFailedKbItemForTraining).not.toHaveBeenCalled();
  });

  it('deleted item → item_deleted', async () => {
    itemModel.findOne
      .mockReturnValueOnce(leanChain(null))
      .mockReturnValueOnce(
        selectLeanChain({ active: true, deletedAt: new Date('2020-01-01') }),
      );

    await expectHttpError(service.manualRetry(botId, itemId), HttpStatus.GONE, 'item_deleted');
  });

  it('FAQ failed but duplicate-query sees queued → already_queued', async () => {
    itemModel.findOne
      .mockReturnValueOnce(
        leanChain({
          _id: itemOid,
          botId: botOid,
          active: true,
          sourceType: 'faq',
          status: 'failed',
          extractionStatus: 'not_required',
        }),
      )
      .mockReturnValueOnce(selectLeanChain({ _id: itemOid }));

    await expectHttpError(service.manualRetry(botId, itemId), HttpStatus.CONFLICT, 'already_queued');
    expect(knowledgeBaseItemService.queueSingleFailedKbItemForTraining).not.toHaveBeenCalled();
  });

  it('document training processing but not old enough → not_stuck_yet', async () => {
    const recent = new Date(Date.now() - 60_000);
    mockLiveItem({
      sourceType: 'document',
      status: 'processing',
      extractionStatus: 'done',
      isContentExtracted: true,
      content: 'x',
    });
    extractJobModel.findOne.mockReturnValueOnce(sortLeanChain(null));
    trainJobModel.findOne.mockReturnValueOnce(
      sortLeanChain({
        _id: new Types.ObjectId(),
        status: 'processing',
        startedAt: recent,
      }),
    );

    await expectHttpError(service.manualRetry(botId, itemId), HttpStatus.CONFLICT, 'not_stuck_yet');
  });

  it('unsupported sourceType → retry_not_allowed', async () => {
    itemModel.findOne.mockReturnValueOnce(
      leanChain({
        _id: itemOid,
        botId: botOid,
        active: true,
        sourceType: 'url',
        status: 'failed',
        extractionStatus: 'not_required',
      }),
    );

    await expectHttpError(service.manualRetry(botId, itemId), HttpStatus.BAD_REQUEST, 'retry_not_allowed');
  });
});
