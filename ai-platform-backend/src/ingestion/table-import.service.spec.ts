import { Types } from 'mongoose';
import { Readable } from 'stream';
import * as XLSX from 'xlsx';
import { TableImportService } from './table-import.service';
import { KNOWLEDGE_TABLES_MAX } from '../workspace/shared/bot-field-limits';
import { getObjectBody, getObjectStream, deletePrivateObject, headObjectExists } from '../lib/s3';

jest.mock('../lib/s3', () => ({
  getObjectBody: jest.fn(),
  getObjectStream: jest.fn(),
  deletePrivateObject: jest.fn().mockResolvedValue(undefined),
  headObjectExists: jest.fn(),
}));

function mongoFindOneChain<T>(leanResult: T) {
  const chain: { select: jest.Mock; sort: jest.Mock; lean: jest.Mock } = {
    select: jest.fn(),
    sort: jest.fn(),
    lean: jest.fn().mockResolvedValue(leanResult),
  };
  chain.select.mockReturnValue(chain);
  chain.sort.mockReturnValue(chain);
  return chain;
}

function mongoFindByIdChain<T>(leanResult: T) {
  const chain: { select: jest.Mock; lean: jest.Mock } = {
    select: jest.fn(),
    lean: jest.fn().mockResolvedValue(leanResult),
  };
  chain.select.mockReturnValue(chain);
  return chain;
}

function previewSessionRow(overrides: Record<string, unknown> = {}) {
  return {
    s3Bucket: 'b',
    s3Key: 'k',
    originalFileName: 'f.csv',
    fileSizeBytes: 1,
    columns: ['A'],
    previewRows: [['x']],
    expiresAt: new Date(Date.now() + 3_600_000),
    ...overrides,
  };
}

describe('TableImportService', () => {
  const getObjectBodyMock = getObjectBody as jest.MockedFunction<typeof getObjectBody>;
  const getObjectStreamMock = getObjectStream as jest.MockedFunction<typeof getObjectStream>;
  const deletePrivateObjectMock = deletePrivateObject as jest.MockedFunction<typeof deletePrivateObject>;
  const headObjectExistsMock = headObjectExists as jest.MockedFunction<typeof headObjectExists>;

  let jobModel: {
    findOne: jest.Mock;
    findOneAndUpdate: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
    updateOne: jest.Mock;
    countDocuments: jest.Mock;
    aggregate: jest.Mock;
  };
  let sessionModel: {
    findOne: jest.Mock;
    findById: jest.Mock;
    findOneAndUpdate: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
    updateOne: jest.Mock;
    deleteOne: jest.Mock;
  };
  let knowledgeBaseItemService: {
    findKnowledgeItemById: jest.Mock;
    countTableKnowledgeItemsForBot: jest.Mock;
    allocateTableIndexForBot: jest.Mock;
    createAsyncTableImportPlaceholder: jest.Mock;
    linkTableImportJobToKbItem: jest.Mock;
    removeTableKnowledgeItemForBot: jest.Mock;
    setTableKbImportPhase: jest.Mock;
    finalizeAsyncTableImportSuccess: jest.Mock;
    finalizeAsyncTableImportFailure: jest.Mock;
    resetTableKnowledgeItemImportRetryState: jest.Mock;
    getKnowledgeTrainingSettingsForBot: jest.Mock;
  };
  let knowledgeTrainingJobService: { scheduleTrainingForScopes: jest.Mock };
  let botModel: {
    findById: jest.Mock;
  };
  let service: TableImportService;

  beforeEach(() => {
    jest.clearAllMocks();
    botModel = {
      findById: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({ active: true, deletedAt: null }),
        }),
      }),
    };
    jobModel = {
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      updateOne: jest.fn().mockResolvedValue({ acknowledged: true }),
      countDocuments: jest.fn().mockResolvedValue(0),
      aggregate: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }),
    };
    sessionModel = {
      findOne: jest.fn(),
      findById: jest.fn().mockReturnValue(mongoFindByIdChain(null)),
      findOneAndUpdate: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      updateOne: jest.fn().mockResolvedValue({ acknowledged: true }),
      deleteOne: jest.fn().mockResolvedValue({ acknowledged: true }),
    };
    knowledgeBaseItemService = {
      findKnowledgeItemById: jest.fn(),
      countTableKnowledgeItemsForBot: jest.fn(),
      allocateTableIndexForBot: jest.fn(),
      createAsyncTableImportPlaceholder: jest.fn(),
      linkTableImportJobToKbItem: jest.fn().mockResolvedValue(undefined),
      removeTableKnowledgeItemForBot: jest.fn().mockResolvedValue(undefined),
      setTableKbImportPhase: jest.fn().mockResolvedValue(undefined),
      finalizeAsyncTableImportSuccess: jest.fn().mockResolvedValue(undefined),
      finalizeAsyncTableImportFailure: jest.fn().mockResolvedValue(undefined),
      resetTableKnowledgeItemImportRetryState: jest.fn().mockResolvedValue(undefined),
      getKnowledgeTrainingSettingsForBot: jest.fn().mockResolvedValue({
        autoTrainEnabled: true,
        trainingDelayMinutes: 5,
        scheduleMode: 'smart',
      }),
    };
    knowledgeTrainingJobService = {
      scheduleTrainingForScopes: jest.fn().mockResolvedValue(undefined),
    };
    service = new TableImportService(
      jobModel as any,
      sessionModel as any,
      botModel as any,
      knowledgeBaseItemService as any,
      knowledgeTrainingJobService as any,
    );
  });

  describe('confirmTableImport', () => {
    const botId = new Types.ObjectId().toString();
    const importSessionId = new Types.ObjectId().toString();

    it('throws on invalid ids', async () => {
      await expect(service.confirmTableImport('not-an-id', importSessionId)).rejects.toThrow('invalid_ids');
      await expect(service.confirmTableImport(botId, 'not-an-id')).rejects.toThrow('invalid_ids');
    });

    it('returns idempotent payload when a job already exists for the session', async () => {
      const kbOid = new Types.ObjectId();
      const jobOid = new Types.ObjectId();
      jobModel.findOne.mockReturnValue(mongoFindOneChain({ _id: jobOid, knowledgeBaseItemId: kbOid }));
      knowledgeBaseItemService.findKnowledgeItemById.mockResolvedValue({
        status: 'pending',
        tableMeta: { importPhase: 'import_queued', tableIndex: 7 },
        sourceType: 'table',
      });

      const r = await service.confirmTableImport(botId, importSessionId);
      expect(r.idempotent).toBe(true);
      expect(r.knowledgeBaseItemId).toBe(String(kbOid));
      expect(r.importJobId).toBe(String(jobOid));
      expect(r.sheetIndex).toBe(7);
      expect(r.tableImportDisplayState).toBe('import_queued');
      expect(sessionModel.findOne).not.toHaveBeenCalled();
    });

    it('throws import_session_cancelled when preview was cancelled', async () => {
      jobModel.findOne.mockReturnValue(mongoFindOneChain(null));
      sessionModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(previewSessionRow({ cancelledAt: new Date() })),
      });

      await expect(service.confirmTableImport(botId, importSessionId)).rejects.toThrow('import_session_cancelled');
      expect(jobModel.create).not.toHaveBeenCalled();
    });

    it('throws import_session_expired when session TTL passed', async () => {
      jobModel.findOne.mockReturnValue(mongoFindOneChain(null));
      sessionModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(previewSessionRow({ expiresAt: new Date(Date.now() - 1000) })),
      });

      await expect(service.confirmTableImport(botId, importSessionId)).rejects.toThrow('import_session_expired');
      expect(jobModel.create).not.toHaveBeenCalled();
    });

    it('throws session_already_consumed when session marked consumed without a job row', async () => {
      jobModel.findOne.mockReturnValue(mongoFindOneChain(null));
      sessionModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(previewSessionRow({ consumedAt: new Date() })),
      });

      await expect(service.confirmTableImport(botId, importSessionId)).rejects.toThrow('session_already_consumed');
      expect(jobModel.create).not.toHaveBeenCalled();
    });

    it('throws session_not_found when session is missing', async () => {
      jobModel.findOne.mockReturnValue(mongoFindOneChain(null));
      sessionModel.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });

      await expect(service.confirmTableImport(botId, importSessionId)).rejects.toThrow('session_not_found');
    });

    it('throws import_limit_concurrent when too many live jobs', async () => {
      jobModel.findOne.mockReturnValue(mongoFindOneChain(null));
      sessionModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(previewSessionRow()),
      });
      knowledgeBaseItemService.countTableKnowledgeItemsForBot.mockResolvedValue(0);
      jobModel.countDocuments.mockResolvedValue(99);

      await expect(service.confirmTableImport(botId, importSessionId)).rejects.toThrow('import_limit_concurrent');
      expect(knowledgeBaseItemService.createAsyncTableImportPlaceholder).not.toHaveBeenCalled();
    });

    it('throws import_limit_daily when daily start cap is exceeded', async () => {
      const prev = process.env.TABLE_IMPORT_MAX_STARTS_PER_BOT_PER_DAY;
      process.env.TABLE_IMPORT_MAX_STARTS_PER_BOT_PER_DAY = '1';
      try {
        jobModel.findOne.mockReturnValue(mongoFindOneChain(null));
        sessionModel.findOne.mockReturnValue({
          lean: jest.fn().mockResolvedValue(previewSessionRow()),
        });
        knowledgeBaseItemService.countTableKnowledgeItemsForBot.mockResolvedValue(0);
        jobModel.countDocuments.mockResolvedValueOnce(0).mockResolvedValueOnce(1);

        await expect(service.confirmTableImport(botId, importSessionId)).rejects.toThrow('import_limit_daily');
        expect(knowledgeBaseItemService.createAsyncTableImportPlaceholder).not.toHaveBeenCalled();
      } finally {
        process.env.TABLE_IMPORT_MAX_STARTS_PER_BOT_PER_DAY = prev;
      }
    });

    it('throws table_limit at max tables', async () => {
      jobModel.findOne.mockReturnValue(mongoFindOneChain(null));
      sessionModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(previewSessionRow()),
      });
      knowledgeBaseItemService.countTableKnowledgeItemsForBot.mockResolvedValue(KNOWLEDGE_TABLES_MAX);

      await expect(service.confirmTableImport(botId, importSessionId)).rejects.toThrow('table_limit');
      expect(knowledgeBaseItemService.createAsyncTableImportPlaceholder).not.toHaveBeenCalled();
    });

    it('creates placeholder, job, and marks session consumed on first confirm', async () => {
      const kbOid = new Types.ObjectId();
      const jobOid = new Types.ObjectId();
      const sid = new Types.ObjectId(importSessionId);

      jobModel.findOne.mockReturnValue(mongoFindOneChain(null));
      sessionModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(
          previewSessionRow({
            _id: sid,
            s3Bucket: 'my-bucket',
            s3Key: 'uploads/x',
            originalFileName: 'sales.csv',
            fileSizeBytes: 12,
            columns: ['Name'],
            previewRows: [['Ada']],
          }),
        ),
      });
      knowledgeBaseItemService.countTableKnowledgeItemsForBot.mockResolvedValue(3);
      knowledgeBaseItemService.allocateTableIndexForBot.mockResolvedValue(2);
      knowledgeBaseItemService.createAsyncTableImportPlaceholder.mockResolvedValue({ _id: kbOid });
      jobModel.create.mockResolvedValue({ _id: jobOid });
      knowledgeBaseItemService.findKnowledgeItemById.mockResolvedValue({
        status: 'pending',
        tableMeta: { importPhase: 'import_queued' },
      });

      const r = await service.confirmTableImport(botId, importSessionId, {
        title: 'My sheet',
        dropColumnIndices: [0],
      });

      expect(r.idempotent).toBeUndefined();
      expect(r.knowledgeBaseItemId).toBe(String(kbOid));
      expect(knowledgeBaseItemService.createAsyncTableImportPlaceholder).toHaveBeenCalledWith(
        expect.objectContaining({
          botId,
          title: 'My sheet',
          tableIndex: 2,
        }),
      );
      expect(jobModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          dropColumnIndices: [0],
          s3Bucket: 'my-bucket',
          status: 'queued',
          sourceFileSizeBytes: 12,
        }),
      );
      expect(knowledgeBaseItemService.linkTableImportJobToKbItem).toHaveBeenCalledWith(kbOid, jobOid);
      expect(sessionModel.updateOne).toHaveBeenCalledWith(
        { _id: sid },
        expect.objectContaining({
          $set: expect.objectContaining({
            consumedAt: expect.any(Date),
            resultKnowledgeBaseItemId: kbOid,
            resultImportJobId: jobOid,
          }),
        }),
      );
      expect(jobModel.create).toHaveBeenCalledTimes(1);
    });

    it('on duplicate key, returns idempotent when a live job exists for the new kb row', async () => {
      const kbOid = new Types.ObjectId();
      const dupJobOid = new Types.ObjectId();
      const sid = new Types.ObjectId(importSessionId);

      jobModel.findOne
        .mockReturnValueOnce(mongoFindOneChain(null))
        .mockReturnValueOnce(mongoFindOneChain({ _id: dupJobOid, knowledgeBaseItemId: kbOid }));
      sessionModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(previewSessionRow({ originalFileName: 'z.csv', previewRows: [] })),
      });
      knowledgeBaseItemService.countTableKnowledgeItemsForBot.mockResolvedValue(0);
      knowledgeBaseItemService.allocateTableIndexForBot.mockResolvedValue(0);
      knowledgeBaseItemService.createAsyncTableImportPlaceholder.mockResolvedValue({ _id: kbOid });
      jobModel.create.mockRejectedValue({ code: 11000 });
      knowledgeBaseItemService.findKnowledgeItemById.mockResolvedValue(null);

      const r = await service.confirmTableImport(botId, importSessionId);

      expect(r.idempotent).toBe(true);
      expect(r.importJobId).toBe(String(dupJobOid));
      expect(knowledgeBaseItemService.removeTableKnowledgeItemForBot).not.toHaveBeenCalled();
    });

    it('on duplicate key with no live job, removes placeholder and rethrows', async () => {
      const kbOid = new Types.ObjectId();
      jobModel.findOne
        .mockReturnValueOnce(mongoFindOneChain(null))
        .mockReturnValueOnce(mongoFindOneChain(null));
      sessionModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(previewSessionRow({ originalFileName: 'z.csv', previewRows: [] })),
      });
      knowledgeBaseItemService.countTableKnowledgeItemsForBot.mockResolvedValue(0);
      knowledgeBaseItemService.allocateTableIndexForBot.mockResolvedValue(0);
      knowledgeBaseItemService.createAsyncTableImportPlaceholder.mockResolvedValue({ _id: kbOid });
      jobModel.create.mockRejectedValue({ code: 11000 });

      await expect(service.confirmTableImport(botId, importSessionId)).rejects.toMatchObject({ code: 11000 });
      expect(knowledgeBaseItemService.removeTableKnowledgeItemForBot).toHaveBeenCalledWith(botId, kbOid);
    });
  });

  describe('createImportSession (preview)', () => {
    it('creates only an ImportSession row, not a TableImportJob', async () => {
      const sid = new Types.ObjectId();
      sessionModel.create.mockResolvedValue({ _id: sid });
      const botId = new Types.ObjectId().toString();
      const out = await service.createImportSession({
        botId,
        s3Bucket: 'buck',
        s3Key: 'key',
        originalFileName: 'a.csv',
        fileSizeBytes: 5,
        columns: ['c'],
        previewRows: [[]],
      });
      expect(out.importSessionId).toBe(String(sid));
      expect(sessionModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ s3Bucket: 'buck', s3Key: 'key', botId: expect.anything() }),
      );
      expect(jobModel.create).not.toHaveBeenCalled();
    });
  });

  describe('cancelImportSession', () => {
    it('deletes temp S3 object and confirm afterward fails with import_session_cancelled', async () => {
      const botId = new Types.ObjectId().toString();
      const sid = new Types.ObjectId().toString();
      const sidOid = new Types.ObjectId(sid);
      sessionModel.findOne.mockReturnValue({
        lean: jest
          .fn()
          .mockResolvedValueOnce(previewSessionRow({ _id: sidOid, s3Bucket: 'bb', s3Key: 'kk' }))
          .mockResolvedValueOnce(previewSessionRow({ _id: sidOid, cancelledAt: new Date() })),
      });
      sessionModel.findOneAndUpdate.mockReturnValue({
        lean: jest.fn().mockResolvedValue({ _id: sidOid, cancelledAt: new Date() }),
      });

      const c = await service.cancelImportSession(botId, sid);
      expect(c.ok).toBe(true);
      expect(deletePrivateObjectMock).toHaveBeenCalledWith('bb', 'kk');

      jobModel.findOne.mockReturnValue(mongoFindOneChain(null));
      await expect(service.confirmTableImport(botId, sid)).rejects.toThrow('import_session_cancelled');
      expect(jobModel.create).not.toHaveBeenCalled();
    });

    it('is idempotent when session already cancelled', async () => {
      const botId = new Types.ObjectId().toString();
      const sid = new Types.ObjectId().toString();
      sessionModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(previewSessionRow({ cancelledAt: new Date() })),
      });
      const c = await service.cancelImportSession(botId, sid);
      expect(c).toEqual({ ok: true, alreadyCancelled: true });
      expect(sessionModel.findOneAndUpdate).not.toHaveBeenCalled();
      expect(deletePrivateObjectMock).not.toHaveBeenCalled();
    });
  });

  describe('cleanupStaleTableImportPreviewSessions', () => {
    it('removes expired preview sessions and deletes S3', async () => {
      const sid = new Types.ObjectId();
      const row = {
        _id: sid,
        s3Bucket: 'b-exp',
        s3Key: 'k-exp',
        expiresAt: new Date(Date.now() - 7 * 24 * 3600 * 1000),
      };
      sessionModel.find.mockReturnValue({
        limit: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([row]),
        }),
      });
      const out = await service.cleanupStaleTableImportPreviewSessions(20);
      expect(out.sessionsRemoved).toBe(1);
      expect(out.s3DeletesAttempted).toBe(1);
      expect(out.s3DeletesFailed).toBe(0);
      expect(deletePrivateObjectMock).toHaveBeenCalledWith('b-exp', 'k-exp');
      expect(sessionModel.deleteOne).toHaveBeenCalledWith({ _id: sid });
    });

    it('query excludes consumed (confirmed) sessions so they are never candidates', async () => {
      sessionModel.find.mockReturnValue({
        limit: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([]),
        }),
      });
      await service.cleanupStaleTableImportPreviewSessions(5);
      expect(sessionModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          consumedAt: { $exists: false },
        }),
      );
    });
  });

  describe('claimQueuedTableImportJobsFair', () => {
    it('includes another bot’s queue head in the same batch before a second job from a noisy bot', async () => {
      const botA = new Types.ObjectId();
      const botB = new Types.ObjectId();
      const jobAOld = {
        _id: new Types.ObjectId(),
        botId: botA,
        queuedAt: new Date('2024-05-01'),
        createdAt: new Date('2024-05-01'),
      };
      const jobBOld = {
        _id: new Types.ObjectId(),
        botId: botB,
        queuedAt: new Date('2024-06-01'),
        createdAt: new Date('2024-06-01'),
      };
      jobModel.aggregate.mockReturnValue({
        exec: jest.fn().mockResolvedValue([jobAOld, jobBOld]),
      });
      const procA = { ...jobAOld, status: 'processing' };
      const procB = { ...jobBOld, status: 'processing' };
      let globalFifo = 0;
      jobModel.findOneAndUpdate.mockImplementation((filter: Record<string, unknown>) => {
        if (filter._id) {
          const id = filter._id as Types.ObjectId;
          if (id.equals(jobAOld._id)) return { exec: () => Promise.resolve(procA) };
          if (id.equals(jobBOld._id)) return { exec: () => Promise.resolve(procB) };
          return { exec: () => Promise.resolve(null) };
        }
        globalFifo += 1;
        return { exec: () => Promise.resolve(null) };
      });

      const out = await service.claimQueuedTableImportJobsFair(2);
      expect(out).toEqual([procA, procB]);
      expect(globalFifo).toBe(0);
    });

    it('skips a stale fair candidate and uses global FIFO without double-processing', async () => {
      const botA = new Types.ObjectId();
      const stale = {
        _id: new Types.ObjectId(),
        botId: botA,
        queuedAt: new Date(),
        createdAt: new Date(),
      };
      const fallback = { _id: new Types.ObjectId(), botId: botA, status: 'processing' as const };
      jobModel.aggregate.mockReturnValue({ exec: jest.fn().mockResolvedValue([stale]) });
      let globalFifo = 0;
      jobModel.findOneAndUpdate.mockImplementation((filter: Record<string, unknown>) => {
        if (filter._id) {
          return { exec: () => Promise.resolve(null) };
        }
        globalFifo += 1;
        return { exec: () => Promise.resolve(globalFifo === 1 ? fallback : null) };
      });

      const out = await service.claimQueuedTableImportJobsFair(1);
      expect(out).toEqual([fallback]);
      expect(globalFifo).toBe(1);
    });

    it('after one-per-bot fair claims, fills with global FIFO for the same bot', async () => {
      const botA = new Types.ObjectId();
      const rep = {
        _id: new Types.ObjectId(),
        botId: botA,
        queuedAt: new Date('2024-01-01'),
        createdAt: new Date('2024-01-01'),
      };
      const g2 = { _id: new Types.ObjectId(), botId: botA, status: 'processing' as const };
      const g3 = { _id: new Types.ObjectId(), botId: botA, status: 'processing' as const };
      jobModel.aggregate.mockReturnValue({ exec: jest.fn().mockResolvedValue([rep]) });
      let fifo = 0;
      jobModel.findOneAndUpdate.mockImplementation((filter: Record<string, unknown>) => {
        if (filter._id) {
          return { exec: () => Promise.resolve({ ...rep, status: 'processing' }) };
        }
        fifo += 1;
        if (fifo === 1) return { exec: () => Promise.resolve(g2) };
        if (fifo === 2) return { exec: () => Promise.resolve(g3) };
        return { exec: () => Promise.resolve(null) };
      });

      const out = await service.claimQueuedTableImportJobsFair(3);
      expect(out).toHaveLength(3);
      expect(fifo).toBe(2);
    });
  });

  describe('resetStuckTableImportJobs', () => {
    it('requeues when under max auto retries', async () => {
      const jobId = new Types.ObjectId();
      const botId = new Types.ObjectId();
      const kbId = new Types.ObjectId();
      jobModel.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest
            .fn()
            .mockResolvedValue([
              { _id: jobId, botId, knowledgeBaseItemId: kbId, importAutoRetryCycles: 0 },
            ]),
        }),
      });

      const n = await service.resetStuckTableImportJobs();
      expect(n).toBe(1);
      expect(jobModel.updateOne).toHaveBeenCalledWith(
        { _id: jobId },
        expect.objectContaining({
          $set: expect.objectContaining({ status: 'queued' }),
          $unset: { startedAt: 1 },
        }),
      );
      expect(knowledgeBaseItemService.finalizeAsyncTableImportFailure).not.toHaveBeenCalled();
    });

    it('fails job and finalizes kb when retry cap reached', async () => {
      const jobId = new Types.ObjectId();
      const botId = new Types.ObjectId();
      const kbId = new Types.ObjectId();
      jobModel.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest
            .fn()
            .mockResolvedValue([
              { _id: jobId, botId, knowledgeBaseItemId: kbId, importAutoRetryCycles: 99 },
            ]),
        }),
      });

      const n = await service.resetStuckTableImportJobs();
      expect(n).toBe(1);
      expect(jobModel.updateOne).toHaveBeenCalledWith(
        { _id: jobId },
        expect.objectContaining({
          $set: expect.objectContaining({ status: 'failed', errorCode: 'stuck_timeout' }),
        }),
      );
      expect(knowledgeBaseItemService.finalizeAsyncTableImportFailure).toHaveBeenCalledWith(
        kbId,
        'stuck_timeout',
        expect.any(String),
        String(botId),
      );
    });
  });

  describe('processTableImportJob', () => {
    const botOid = new Types.ObjectId();
    const kbOid = new Types.ObjectId();
    const jobId = new Types.ObjectId();

    it('skips when kb row is missing', async () => {
      knowledgeBaseItemService.findKnowledgeItemById.mockResolvedValue(null);

      await service.processTableImportJob({
        _id: jobId,
        botId: botOid,
        knowledgeBaseItemId: kbOid,
        importSessionId: new Types.ObjectId(),
        s3Bucket: 'b',
        s3Key: 'k',
        originalFileName: 't.csv',
        status: 'processing',
      } as any);

      expect(jobModel.updateOne).toHaveBeenCalledWith(
        { _id: jobId },
        expect.objectContaining({ $set: expect.objectContaining({ errorCode: 'kb_missing', status: 'done' }) }),
      );
    });

    it('skips stale import job when KB links a newer tableImportJobId', async () => {
      knowledgeBaseItemService.findKnowledgeItemById.mockResolvedValue({
        sourceType: 'table',
        active: true,
        title: 'T',
        tableMeta: { tableImportJobId: new Types.ObjectId() },
      });

      await service.processTableImportJob({
        _id: jobId,
        botId: botOid,
        knowledgeBaseItemId: kbOid,
        importSessionId: new Types.ObjectId(),
        s3Bucket: 'b',
        s3Key: 'k',
        originalFileName: 'stale.csv',
        status: 'processing',
      } as any);

      expect(knowledgeBaseItemService.setTableKbImportPhase).not.toHaveBeenCalled();
      expect(knowledgeBaseItemService.finalizeAsyncTableImportSuccess).not.toHaveBeenCalled();
      expect(knowledgeBaseItemService.finalizeAsyncTableImportFailure).not.toHaveBeenCalled();
      expect(jobModel.updateOne).toHaveBeenCalledWith(
        { _id: jobId },
        expect.objectContaining({
          $set: expect.objectContaining({
            status: 'done',
            errorCode: 'stale_table_import_job',
          }),
        }),
      );
    });

    it('fails on parse error from empty grid', async () => {
      knowledgeBaseItemService.findKnowledgeItemById
        .mockResolvedValueOnce({
          sourceType: 'table',
          active: true,
          title: 'T',
          tableMeta: { tableImportJobId: jobId },
        })
        .mockResolvedValueOnce({
          sourceType: 'table',
          active: true,
          title: 'T',
          tableMeta: { tableImportJobId: new Types.ObjectId() },
        });
      getObjectStreamMock.mockResolvedValue(Readable.from([Buffer.from('', 'utf8')]) as any);

      await service.processTableImportJob({
        _id: jobId,
        botId: botOid,
        knowledgeBaseItemId: kbOid,
        importSessionId: new Types.ObjectId(),
        s3Bucket: 'b',
        s3Key: 'k',
        originalFileName: 'empty.csv',
        status: 'processing',
      } as any);

      expect(knowledgeBaseItemService.finalizeAsyncTableImportFailure).not.toHaveBeenCalled();
      expect(knowledgeTrainingJobService.scheduleTrainingForScopes).not.toHaveBeenCalled();
      expect(jobModel.updateOne).toHaveBeenCalledWith(
        { _id: jobId },
        expect.objectContaining({
          $set: expect.objectContaining({
            status: 'done',
            errorCode: 'stale_table_import_job',
          }),
        }),
      );
    });

    it('parses CSV stream from S3, finalizes, and queues table training', async () => {
      knowledgeBaseItemService.findKnowledgeItemById.mockResolvedValue({
        sourceType: 'table',
        active: true,
        title: 'My title',
        tableMeta: { tableIndex: 3 },
      });
      getObjectStreamMock.mockResolvedValue(Readable.from([Buffer.from('A,B\n1,2\n', 'utf8')]) as any);

      await service.processTableImportJob({
        _id: jobId,
        botId: botOid,
        knowledgeBaseItemId: kbOid,
        importSessionId: new Types.ObjectId(),
        s3Bucket: 'b',
        s3Key: 'k',
        originalFileName: 'g.csv',
        status: 'processing',
        dropColumnIndices: [1],
      } as any);

      expect(getObjectBodyMock).not.toHaveBeenCalled();
      expect(knowledgeBaseItemService.setTableKbImportPhase).toHaveBeenCalledWith(kbOid, 'importing');
      expect(knowledgeBaseItemService.finalizeAsyncTableImportSuccess).toHaveBeenCalledWith(
        String(botOid),
        kbOid,
        expect.objectContaining({
          columns: ['A'],
          rows: [['1']],
          tableIndex: 3,
        }),
        { skipScopeTrainingSchedule: true },
      );
      expect(knowledgeTrainingJobService.scheduleTrainingForScopes).toHaveBeenCalledWith(String(botOid), ['table']);
      expect(jobModel.updateOne).toHaveBeenCalledWith(
        { _id: jobId },
        expect.objectContaining({ $set: expect.objectContaining({ status: 'done' }) }),
      );
    });

    it('after CSV success skips scope TrainJob scheduling when Auto Train is off', async () => {
      knowledgeBaseItemService.getKnowledgeTrainingSettingsForBot.mockResolvedValue({
        autoTrainEnabled: false,
        trainingDelayMinutes: 5,
        scheduleMode: 'smart',
      });
      knowledgeBaseItemService.findKnowledgeItemById.mockResolvedValue({
        sourceType: 'table',
        active: true,
        title: 'My title',
        tableMeta: { tableIndex: 3 },
      });
      getObjectStreamMock.mockResolvedValue(Readable.from([Buffer.from('A,B\n1,2\n', 'utf8')]) as any);

      await service.processTableImportJob({
        _id: jobId,
        botId: botOid,
        knowledgeBaseItemId: kbOid,
        importSessionId: new Types.ObjectId(),
        s3Bucket: 'b',
        s3Key: 'k',
        originalFileName: 'g.csv',
        status: 'processing',
        dropColumnIndices: [1],
      } as any);

      expect(knowledgeBaseItemService.finalizeAsyncTableImportSuccess).toHaveBeenCalled();
      expect(knowledgeTrainingJobService.scheduleTrainingForScopes).not.toHaveBeenCalled();
      expect(jobModel.updateOne).toHaveBeenCalledWith(
        { _id: jobId },
        expect.objectContaining({ $set: expect.objectContaining({ status: 'done' }) }),
      );
    });

    it('xlsx path uses buffer import and queues training', async () => {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([
        ['A', 'B'],
        ['1', '2'],
      ]);
      XLSX.utils.book_append_sheet(wb, ws, 'S1');
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      knowledgeBaseItemService.findKnowledgeItemById.mockResolvedValue({
        sourceType: 'table',
        active: true,
        title: 'Sheet',
        tableMeta: { tableIndex: 0 },
      });
      getObjectBodyMock.mockResolvedValue(Buffer.from(buf));

      await service.processTableImportJob({
        _id: jobId,
        botId: botOid,
        knowledgeBaseItemId: kbOid,
        importSessionId: new Types.ObjectId(),
        s3Bucket: 'b',
        s3Key: 'k',
        originalFileName: 't.xlsx',
        sourceFileSizeBytes: buf.byteLength,
        status: 'processing',
      } as any);

      expect(getObjectStreamMock).not.toHaveBeenCalled();
      expect(knowledgeBaseItemService.finalizeAsyncTableImportSuccess).toHaveBeenCalled();
      expect(knowledgeTrainingJobService.scheduleTrainingForScopes).toHaveBeenCalledWith(String(botOid), ['table']);
    });

    it('xlsx path fails before S3 download when sourceFileSizeBytes exceeds cap', async () => {
      const prev = process.env.TABLE_IMPORT_XLSX_MAX_BYTES;
      process.env.TABLE_IMPORT_XLSX_MAX_BYTES = String(1024 * 1024);
      try {
        knowledgeBaseItemService.findKnowledgeItemById.mockResolvedValue({
          sourceType: 'table',
          active: true,
          title: 'Sheet',
          tableMeta: { tableIndex: 0 },
        });

        await service.processTableImportJob({
          _id: jobId,
          botId: botOid,
          knowledgeBaseItemId: kbOid,
          importSessionId: new Types.ObjectId(),
          s3Bucket: 'b',
          s3Key: 'k',
          originalFileName: 't.xlsx',
          sourceFileSizeBytes: 2 * 1024 * 1024,
          status: 'processing',
        } as any);

        expect(getObjectBodyMock).not.toHaveBeenCalled();
        expect(knowledgeBaseItemService.finalizeAsyncTableImportFailure).toHaveBeenCalledWith(
          kbOid,
          'xlsx_too_large',
          expect.any(String),
          String(botOid),
        );
        expect(jobModel.updateOne).toHaveBeenCalledWith(
          { _id: jobId },
          expect.objectContaining({ $set: expect.objectContaining({ status: 'failed' }) }),
        );
      } finally {
        process.env.TABLE_IMPORT_XLSX_MAX_BYTES = prev;
      }
    });

    it('xlsx path marks import failed for corrupt workbook buffer', async () => {
      knowledgeBaseItemService.findKnowledgeItemById.mockResolvedValue({
        sourceType: 'table',
        active: true,
        title: 'Sheet',
        tableMeta: { tableIndex: 0 },
      });
      getObjectBodyMock.mockResolvedValue(Buffer.from('not-a-valid-xlsx'));

      await service.processTableImportJob({
        _id: jobId,
        botId: botOid,
        knowledgeBaseItemId: kbOid,
        importSessionId: new Types.ObjectId(),
        s3Bucket: 'b',
        s3Key: 'k',
        originalFileName: 't.xlsx',
        sourceFileSizeBytes: 20,
        status: 'processing',
      } as any);

      expect(knowledgeBaseItemService.finalizeAsyncTableImportFailure).toHaveBeenCalled();
      expect(knowledgeBaseItemService.finalizeAsyncTableImportSuccess).not.toHaveBeenCalled();
      expect(jobModel.updateOne).toHaveBeenCalledWith(
        { _id: jobId },
        expect.objectContaining({ $set: expect.objectContaining({ status: 'failed' }) }),
      );
    });
  });

  describe('manualRetryFailedTableImport', () => {
    const botId = new Types.ObjectId().toString();
    const kbId = new Types.ObjectId();
    const jobId = new Types.ObjectId();
    const sid = new Types.ObjectId();

    beforeEach(() => {
      headObjectExistsMock.mockReset();
      jobModel.findOneAndUpdate.mockReset();
      sessionModel.findById.mockReset();
    });

    it('returns already_queued when a live job exists', async () => {
      knowledgeBaseItemService.findKnowledgeItemById.mockResolvedValue({
        sourceType: 'table',
        active: true,
        deletedAt: null,
      });
      jobModel.findOne.mockReturnValueOnce({
        sort: () => ({ lean: jest.fn().mockResolvedValue({ _id: jobId, status: 'queued' }) }),
      });
      const r = await service.manualRetryFailedTableImport(botId, String(kbId));
      expect(r).toEqual({ ok: false, errorCode: 'already_queued' });
    });

    it('returns source_file_missing when S3 object is gone', async () => {
      knowledgeBaseItemService.findKnowledgeItemById.mockResolvedValue({
        sourceType: 'table',
        active: true,
        deletedAt: null,
      });
      jobModel.findOne
        .mockReturnValueOnce({
          sort: () => ({ lean: jest.fn().mockResolvedValue(null) }),
        })
        .mockReturnValueOnce({
          sort: () => ({
            lean: jest.fn().mockResolvedValue({
              _id: jobId,
              botId: new Types.ObjectId(botId),
              knowledgeBaseItemId: kbId,
              importSessionId: sid,
              s3Bucket: 'b',
              s3Key: 'k',
              status: 'failed',
            }),
          }),
        });
      sessionModel.findById.mockReturnValue({
        lean: jest.fn().mockResolvedValue({ cancelledAt: null }),
      });
      headObjectExistsMock.mockResolvedValue(false);
      const r = await service.manualRetryFailedTableImport(botId, String(kbId));
      expect(r).toEqual({ ok: false, errorCode: 'source_file_missing' });
    });

    it('requeues failed job when file exists', async () => {
      knowledgeBaseItemService.findKnowledgeItemById.mockResolvedValue({
        sourceType: 'table',
        active: true,
        deletedAt: null,
      });
      jobModel.findOne
        .mockReturnValueOnce({
          sort: () => ({ lean: jest.fn().mockResolvedValue(null) }),
        })
        .mockReturnValueOnce({
          sort: () => ({
            lean: jest.fn().mockResolvedValue({
              _id: jobId,
              botId: new Types.ObjectId(botId),
              knowledgeBaseItemId: kbId,
              importSessionId: sid,
              s3Bucket: 'b',
              s3Key: 'k',
              status: 'failed',
            }),
          }),
        });
      sessionModel.findById.mockReturnValue({
        lean: jest.fn().mockResolvedValue({ cancelledAt: null }),
      });
      headObjectExistsMock.mockResolvedValue(true);
      jobModel.findOneAndUpdate.mockResolvedValue({ _id: jobId, status: 'queued' });
      const r = await service.manualRetryFailedTableImport(botId, String(kbId));
      expect(r).toEqual({ ok: true });
      expect(knowledgeBaseItemService.resetTableKnowledgeItemImportRetryState).toHaveBeenCalledWith(botId, kbId);
    });
  });
});
