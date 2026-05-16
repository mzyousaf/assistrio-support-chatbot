import { ModuleRef } from '@nestjs/core';
import { Types } from 'mongoose';
import { IngestionService } from '../ingestion/ingestion.service';
import { PLAN_LIMIT_BOT_KB_TOTAL_CODE } from './bot-knowledge-total-limit.service';
import {
  KnowledgeOosReconcileService,
  oosReconcileCreatedAtAsc,
} from './knowledge-oos-reconcile.service';

describe('oosReconcileCreatedAtAsc', () => {
  it('sorts by createdAt ascending; ties break by _id', () => {
    const t0 = new Date('2023-01-01T00:00:00.000Z');
    const t1 = new Date('2023-06-01T00:00:00.000Z');
    const idOld = new Types.ObjectId();
    const idNew = new Types.ObjectId();
    const rows = [
      { _id: idNew, createdAt: t1 },
      { _id: idOld, createdAt: t0 },
    ];
    rows.sort((a, b) => oosReconcileCreatedAtAsc(a, b));
    expect(rows[0]._id).toEqual(idOld);
    expect(rows[1]._id).toEqual(idNew);
  });

  it('uses ObjectId timestamp when createdAt is missing', () => {
    const early = new Types.ObjectId('507f1f77bcf86cd799439011'); // fixed from hex
    const late = new Types.ObjectId('608f1f77bcf86cd799439012');
    const a = { _id: early }; // no createdAt
    const b = { _id: late };
    expect(oosReconcileCreatedAtAsc(a, b)).toBeLessThan(0);
  });
});

describe('KnowledgeOosReconcileService', () => {
  const botId = new Types.ObjectId().toString();
  const PLAN = PLAN_LIMIT_BOT_KB_TOTAL_CODE;

  function mockKbItemServiceForOos() {
    return {
      getQueueTimesForTrainableKbRow: jest
        .fn()
        .mockImplementation(async (_b: string, _row: unknown, queuedAt: Date) => ({
          lastQueuedAt: queuedAt,
          runAfter: queuedAt,
        })),
    };
  }

  const baseBotLean = {
    botConfig: {
      knowledgeSize: { type: 'custom' as const, maxBytes: 50, baseMaxBytes: 50, extraMaxBytes: 0 },
    },
    knowledgeTraining: { autoTrainEnabled: true, trainingDelayMinutes: 5 },
  };

  function oosDoc(
    id: Types.ObjectId,
    byteLen: number,
    createdAt: Date,
    trainingError = PLAN,
  ): Record<string, unknown> {
    return {
      _id: id,
      sourceType: 'document',
      active: true,
      content: 'z'.repeat(byteLen),
      isContentExtracted: true,
      extractionStatus: 'done',
      trainingError,
      createdAt,
    };
  }

  function trainableDoc(id: Types.ObjectId, byteLen: number): Record<string, unknown> {
    return {
      _id: id,
      sourceType: 'document',
      active: true,
      content: 'y'.repeat(byteLen),
      isContentExtracted: true,
      extractionStatus: 'done',
      createdAt: new Date('2020-01-01'),
    };
  }

  it('1+2+3+4: oldest-first order skips first when too large; later smaller items still release; trainableBytes accumulates', async () => {
    const idT = new Types.ObjectId();
    const idA = new Types.ObjectId();
    const idB = new Types.ObjectId();
    const idC = new Types.ObjectId();
    const tA = new Date('2021-01-01T00:00:00.000Z');
    const tB = new Date('2021-06-01T00:00:00.000Z');
    const tC = new Date('2022-01-01T00:00:00.000Z');

    const trainable = trainableDoc(idT, 47);
    const A = oosDoc(idA, 5, tA);
    const B = oosDoc(idB, 2, tB);
    const C = oosDoc(idC, 1, tC);

    const leanRows = [C, B, trainable, A];
    const itemModel = {
      find: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(leanRows),
        }),
      }),
      updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    };
    const botModel = {
      findById: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(baseBotLean) }),
      }),
    };
    const ensureQueued = jest.fn().mockResolvedValue(undefined);
    const moduleRef = { get: jest.fn().mockReturnValue({ ensureQueuedIngestJobForDocument: ensureQueued }) };
    const scheduleScopes = jest.fn().mockResolvedValue(undefined);
    const trainingJob = { scheduleTrainingForScopes: scheduleScopes };
    const stats = { recalculateKnowledgeStatsForBot: jest.fn().mockResolvedValue(undefined) };

    const svc = new KnowledgeOosReconcileService(
      itemModel as never,
      botModel as never,
      moduleRef as unknown as ModuleRef,
      trainingJob as never,
      stats as never,
      mockKbItemServiceForOos() as never,
    );

    const out = await svc.reconcileOutOfStorageItemsForBot(botId, 'test');
    expect(out.releasedCount).toBe(2);

    const updatedIds = itemModel.updateOne.mock.calls.map((c) => String(c[0]._id));
    expect(updatedIds).toEqual([String(idB), String(idC)]);
    expect(updatedIds).not.toContain(String(idA));

    expect(ensureQueued).toHaveBeenCalledTimes(2);
    expect(scheduleScopes).not.toHaveBeenCalled();
  });

  it('1 cont.: size-asc would update C before B — assert we use createdAt (B before C)', async () => {
    const idT = new Types.ObjectId();
    const idA = new Types.ObjectId();
    const idB = new Types.ObjectId();
    const idC = new Types.ObjectId();
    const tA = new Date('2021-01-01T00:00:00.000Z');
    const tB = new Date('2021-06-01T00:00:00.000Z');
    const tC = new Date('2022-01-01T00:00:00.000Z');

    const leanRows = [
      trainableDoc(idT, 47),
      oosDoc(idA, 5, tA),
      oosDoc(idB, 2, tB),
      oosDoc(idC, 1, tC),
    ];
    const itemModel = {
      find: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(leanRows),
        }),
      }),
      updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    };
    const botModel = {
      findById: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(baseBotLean) }),
      }),
    };
    const moduleRef = {
      get: jest.fn().mockReturnValue({ ensureQueuedIngestJobForDocument: jest.fn().mockResolvedValue(undefined) }),
    };
    const svc = new KnowledgeOosReconcileService(
      itemModel as never,
      botModel as never,
      moduleRef as unknown as ModuleRef,
      { scheduleTrainingForScopes: jest.fn() } as never,
      { recalculateKnowledgeStatsForBot: jest.fn() } as never,
      mockKbItemServiceForOos() as never,
    );

    await svc.reconcileOutOfStorageItemsForBot(botId, 'test');
    const firstRelease = itemModel.updateOne.mock.calls[0][0]._id as Types.ObjectId;
    const secondRelease = itemModel.updateOne.mock.calls[1][0]._id as Types.ObjectId;
    expect(String(firstRelease)).toBe(String(idB));
    expect(String(secondRelease)).toBe(String(idC));
  });

  it('6: auto-training OFF sets released items to pending and does not queue jobs', async () => {
    const idT = new Types.ObjectId();
    const idB = new Types.ObjectId();
    const botOff = {
      ...baseBotLean,
      knowledgeTraining: { autoTrainEnabled: false, trainingDelayMinutes: 5 },
    };
    const leanRows = [
      trainableDoc(idT, 45),
      oosDoc(idB, 2, new Date('2021-01-01')),
    ];
    const itemModel = {
      find: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(leanRows),
        }),
      }),
      updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    };
    const botModel = {
      findById: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(botOff) }),
      }),
    };
    const moduleRef = { get: jest.fn() };
    const scheduleScopes = jest.fn();
    const svc = new KnowledgeOosReconcileService(
      itemModel as never,
      botModel as never,
      moduleRef as unknown as ModuleRef,
      { scheduleTrainingForScopes: scheduleScopes } as never,
      { recalculateKnowledgeStatsForBot: jest.fn() } as never,
      mockKbItemServiceForOos() as never,
    );

    await svc.reconcileOutOfStorageItemsForBot(botId, 'test');
    expect(itemModel.updateOne.mock.calls[0][1].$set.status).toBe('pending');
    expect(itemModel.updateOne.mock.calls[0][1].$unset).toMatchObject({
      lastQueuedAt: 1,
      runAfter: 1,
    });
    expect(moduleRef.get).not.toHaveBeenCalled();
    expect(scheduleScopes).not.toHaveBeenCalled();
  });

  it('7: generic failed (non–plan_limit trainingError) is not treated as OOS', async () => {
    const idFail = new Types.ObjectId();
    const leanRows = [
      {
        _id: idFail,
        sourceType: 'document',
        active: true,
        content: 'hello',
        isContentExtracted: true,
        extractionStatus: 'done',
        trainingError: 'network_error',
        status: 'failed',
        createdAt: new Date('2021-01-01'),
      },
    ];
    const itemModel = {
      find: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(leanRows),
        }),
      }),
      updateOne: jest.fn(),
    };
    const botModel = {
      findById: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(baseBotLean) }),
      }),
    };
    const svc = new KnowledgeOosReconcileService(
      itemModel as never,
      botModel as never,
      { get: jest.fn() } as unknown as ModuleRef,
      { scheduleTrainingForScopes: jest.fn() } as never,
      { recalculateKnowledgeStatsForBot: jest.fn() } as never,
      mockKbItemServiceForOos() as never,
    );

    const out = await svc.reconcileOutOfStorageItemsForBot(botId, 'test');
    expect(out.releasedCount).toBe(0);
    expect(itemModel.updateOne).not.toHaveBeenCalled();
  });

  it('8: inactive row is excluded from aggregation (not updated)', async () => {
    const idInact = new Types.ObjectId();
    const leanRows = [
      {
        _id: idInact,
        sourceType: 'document',
        active: false,
        deletedAt: null,
        content: 'x',
        isContentExtracted: true,
        extractionStatus: 'done',
        trainingError: PLAN,
        createdAt: new Date('2021-01-01'),
      },
    ];
    const itemModel = {
      find: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(leanRows),
        }),
      }),
      updateOne: jest.fn(),
    };
    const botModel = {
      findById: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(baseBotLean) }),
      }),
    };
    const svc = new KnowledgeOosReconcileService(
      itemModel as never,
      botModel as never,
      { get: jest.fn() } as unknown as ModuleRef,
      { scheduleTrainingForScopes: jest.fn() } as never,
      { recalculateKnowledgeStatsForBot: jest.fn() } as never,
      mockKbItemServiceForOos() as never,
    );

    await svc.reconcileOutOfStorageItemsForBot(botId, 'test');
    expect(itemModel.updateOne).not.toHaveBeenCalled();
  });

  it('9: single merged scheduleTrainingForScopes when multiple FAQ rows release (not one call per item)', async () => {
    const idT = new Types.ObjectId();
    const idF1 = new Types.ObjectId();
    const idF2 = new Types.ObjectId();
    const bigMaxBot = {
      ...baseBotLean,
      botConfig: {
        knowledgeSize: { type: 'custom' as const, maxBytes: 500, baseMaxBytes: 500, extraMaxBytes: 0 },
      },
    };
    const leanRows = [
      trainableDoc(idT, 400),
      {
        _id: idF1,
        sourceType: 'faq',
        active: true,
        content: 'q',
        faqMeta: { questions: ['q'], answer: 'a1' },
        extractionStatus: 'not_required',
        trainingError: PLAN,
        createdAt: new Date('2021-01-01'),
      },
      {
        _id: idF2,
        sourceType: 'faq',
        active: true,
        content: 'q2',
        faqMeta: { questions: ['q2'], answer: 'a2' },
        extractionStatus: 'not_required',
        trainingError: PLAN,
        createdAt: new Date('2021-02-01'),
      },
    ];
    const scheduleScopes = jest.fn().mockResolvedValue(undefined);
    const itemModel = {
      find: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(leanRows),
        }),
      }),
      updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    };
    const botModel = {
      findById: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(bigMaxBot) }),
      }),
    };
    const moduleRef = {
      get: jest.fn().mockReturnValue({ ensureQueuedIngestJobForDocument: jest.fn().mockResolvedValue(undefined) }),
    };
    const svc = new KnowledgeOosReconcileService(
      itemModel as never,
      botModel as never,
      moduleRef as unknown as ModuleRef,
      { scheduleTrainingForScopes: scheduleScopes } as never,
      { recalculateKnowledgeStatsForBot: jest.fn() } as never,
      mockKbItemServiceForOos() as never,
    );

    await svc.reconcileOutOfStorageItemsForBot(botId, 'test');
    expect(scheduleScopes).toHaveBeenCalledTimes(1);
    expect(scheduleScopes.mock.calls[0][1]).toEqual(['faq']);
  });
});
