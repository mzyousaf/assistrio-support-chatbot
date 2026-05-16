/**
 * Opt-in Mongo integration tests — no real OpenAI or S3 (mocked RagService / Kb extraction / getObjectBody).
 *
 * Run:
 *   set KB_INTEGRATION=1
 *   set KB_INTEGRATION_MONGODB_URI=mongodb://127.0.0.1:27017/kb_training_verify
 *   npx jest src/ingestion/kb-training.integration.spec.ts --runInBand
 *
 * Or: npm run test:kb-integration (still requires KB_INTEGRATION + Mongo URI set in the shell; does not read .env.example).
 * CI: set KB_INTEGRATION=1 and KB_INTEGRATION_MONGODB_URI or MONGODB_URI on a disposable DB, then run npm run test:kb-integration.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Bot } from '../models/bot.schema';
import { ExtractJob } from '../models/extract-job.schema';
import { TrainJob } from '../models/train-job.schema';
import { KnowledgeBaseItem } from '../models/knowledge-base-item.schema';
import { KnowledgeBaseChunk } from '../models/knowledge-base-chunk.schema';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { IngestionModule } from './ingestion.module';
import { IngestionService } from './ingestion.service';
import { KnowledgeBaseItemService } from '../knowledge/knowledge-base-item.service';
import { KnowledgeTrainingJobService } from '../knowledge/knowledge-training-job.service';
import { RagService } from '../rag/rag.service';
import { KbService } from '../knowledge/kb.service';

jest.mock('../lib/s3', () => ({
  getObjectBody: jest.fn().mockResolvedValue(Buffer.from('fake-bytes')),
}));

const URI = process.env.KB_INTEGRATION_MONGODB_URI ?? process.env.MONGODB_URI;
const RUN = Boolean(URI && (process.env.KB_INTEGRATION === '1' || process.env.KB_INTEGRATION === 'true'));

const describeIntegration = RUN ? describe : describe.skip;

/** Shared test double so tests can `mockResolvedValueOnce` / `mockImplementation` safely. */
const kbTestDouble = {
  extractTextFromUpload: jest.fn().mockResolvedValue({
    extracted: true,
    text: 'Integration document paragraph. '.repeat(8),
  }),
  chunkText: jest.fn((text: string) => [text]),
  getFileExtension: jest.fn((name: string) => String(name).split('.').pop() ?? 'txt'),
};

function uniqueSlug(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

describeIntegration('KB training integration (Mongo)', () => {
  jest.setTimeout(120_000);

  let moduleRef: TestingModule;
  let ingestionService: IngestionService;
  let itemService: KnowledgeBaseItemService;
  let trainingJobService: KnowledgeTrainingJobService;
  let botModel: Model<Bot>;
  let extractJobModel: Model<ExtractJob>;
  let trainJobModel: Model<TrainJob>;
  let itemModel: Model<KnowledgeBaseItem>;
  let chunkModel: Model<KnowledgeBaseChunk>;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              enableKbWorker: false,
              jobRunnerSecret: 'test-secret',
              openaiApiKey: '',
              appMode: 'all',
            }),
          ],
        }),
        MongooseModule.forRoot(URI!),
        KnowledgeModule,
        IngestionModule.forRoot({ registerHttpControllers: false }),
      ],
    })
      .overrideProvider(RagService)
      .useValue({
        embedTexts: async (texts: string[]) =>
          texts.map((_, i) => Array.from({ length: 12 }, (_, j) => (i + j) * 0.001)),
        embedText: async () => Array.from({ length: 12 }, (_, j) => j * 0.001),
      })
      .overrideProvider(KbService)
      .useValue(kbTestDouble)
      .compile();

    ingestionService = moduleRef.get(IngestionService);
    itemService = moduleRef.get(KnowledgeBaseItemService);
    trainingJobService = moduleRef.get(KnowledgeTrainingJobService);
    botModel = moduleRef.get(getModelToken(Bot.name));
    extractJobModel = moduleRef.get(getModelToken(ExtractJob.name));
    trainJobModel = moduleRef.get(getModelToken(TrainJob.name));
    itemModel = moduleRef.get(getModelToken(KnowledgeBaseItem.name));
    chunkModel = moduleRef.get(getModelToken(KnowledgeBaseChunk.name));
  });

  afterAll(async () => {
    if (moduleRef) await moduleRef.close();
  });

  afterEach(() => {
    kbTestDouble.extractTextFromUpload.mockReset();
    kbTestDouble.extractTextFromUpload.mockResolvedValue({
      extracted: true,
      text: 'Integration document paragraph. '.repeat(8),
    });
    kbTestDouble.chunkText.mockReset();
    kbTestDouble.chunkText.mockImplementation((text: string) => [text]);
    kbTestDouble.getFileExtension.mockImplementation((name: string) => String(name).split('.').pop() ?? 'txt');
  });

  async function purgeBot(botId: Types.ObjectId): Promise<void> {
    await Promise.all([
      extractJobModel.deleteMany({ botId }),
      trainJobModel.deleteMany({ botId }),
      chunkModel.deleteMany({ botId }),
      itemModel.deleteMany({ botId }),
      botModel.deleteOne({ _id: botId }),
    ]);
  }

  async function createTestBot(autoTrain: boolean): Promise<Types.ObjectId> {
    const bot = await botModel.create({
      name: 'KB integration bot',
      slug: uniqueSlug('kb-int'),
      knowledgeTraining: { autoTrainEnabled: autoTrain, trainingDelayMinutes: 0, scheduleMode: 'smart' },
    });
    return bot._id as Types.ObjectId;
  }

  it('document: autoTrain on → extract → single document TrainJob → ready + chunks + lastTrainedAt', async () => {
    const botId = await createTestBot(true);
    try {
      const { id: docId } = await itemService.createKbDocumentUploadItem({
        botId: String(botId),
        title: 'Doc',
        file: {
          originalName: 'a.txt',
          mimeType: 'text/plain',
          sizeBytes: 10,
          storageKey: 'k',
          storageBucket: 'b',
          uploadStatus: 'uploaded',
        },
        trainingStatus: 'queued',
      });
      await ingestionService.createQueuedJob(String(botId), docId, {
        deferImmediateExtract: true,
        markTrainingQueued: true,
      });

      const ex0 = await extractJobModel.findOne({ botId, knowledgeBaseItemId: new Types.ObjectId(docId) }).lean();
      expect(ex0?.status).toBe('queued');

      const outcome = await ingestionService.processJob({
        _id: ex0!._id as Types.ObjectId,
        botId,
        knowledgeBaseItemId: new Types.ObjectId(docId),
      });
      expect(outcome).toBe('completed');

      const item = await itemModel.findById(docId).lean();
      expect((item as { isContentExtracted?: boolean }).isContentExtracted).toBe(true);
      expect(String((item as { content?: string }).content ?? '').length).toBeGreaterThan(10);
      expect((item as { status?: string }).status).toBe('queued');

      const trainQueued = await trainJobModel
        .countDocuments({
          botId,
          kind: 'document',
          knowledgeBaseItemId: new Types.ObjectId(docId),
          status: 'queued',
        })
        .exec();
      expect(trainQueued).toBe(1);

      let trainJob = await trainingJobService.claimQueuedTrainJob();
      expect(trainJob?.kind).toBe('document');
      await ingestionService.processDocumentTrainJob(trainJob as Parameters<IngestionService['processDocumentTrainJob']>[0]);

      const itemAfter = await itemModel.findById(docId).lean();
      expect((itemAfter as { status?: string }).status).toBe('ready');
      expect((itemAfter as { lastTrainedAt?: Date }).lastTrainedAt).toBeInstanceOf(Date);

      const chunkCount = await chunkModel.countDocuments({ knowledgeBaseItemId: new Types.ObjectId(docId) });
      expect(chunkCount).toBeGreaterThanOrEqual(1);
    } finally {
      await purgeBot(botId);
    }
  });

  it('document: autoTrain off → extract completes, pending, no document TrainJob', async () => {
    const botId = await createTestBot(false);
    try {
      const { id: docId } = await itemService.createKbDocumentUploadItem({
        botId: String(botId),
        title: 'Doc2',
        file: {
          originalName: 'a.txt',
          mimeType: 'text/plain',
          sizeBytes: 10,
          storageKey: 'k2',
          storageBucket: 'b2',
          uploadStatus: 'uploaded',
        },
        trainingStatus: 'pending',
      });
      await ingestionService.createQueuedJob(String(botId), docId, {
        deferImmediateExtract: true,
        markTrainingQueued: false,
      });
      const ex = await extractJobModel.findOne({ botId, knowledgeBaseItemId: new Types.ObjectId(docId) }).lean();
      await ingestionService.processJob({
        _id: ex!._id as Types.ObjectId,
        botId,
        knowledgeBaseItemId: new Types.ObjectId(docId),
      });

      const item = await itemModel.findById(docId).lean();
      expect((item as { isContentExtracted?: boolean }).isContentExtracted).toBe(true);
      expect((item as { status?: string }).status).toBe('pending');

      const trainN = await trainJobModel.countDocuments({ botId, kind: 'document' });
      expect(trainN).toBe(0);

      await ingestionService.ensureQueuedIngestJobForDocument(String(botId), docId);
      const trainAfterEnsure = await trainJobModel.countDocuments({ botId, kind: 'document' });
      expect(trainAfterEnsure).toBe(0);
      const itemAfterEnsure = await itemModel.findById(docId).lean();
      expect((itemAfterEnsure as { status?: string }).status).toBe('pending');
    } finally {
      await purgeBot(botId);
    }
  });

  it('softDeleteKbDocumentRoutesByIds soft-deletes item, removes chunks and queued jobs', async () => {
    const botId = await createTestBot(true);
    try {
      const { id: docId } = await itemService.createKbDocumentUploadItem({
        botId: String(botId),
        title: 'Cascade',
        file: {
          originalName: 'a.txt',
          mimeType: 'text/plain',
          sizeBytes: 10,
          storageKey: 'kc',
          storageBucket: 'bc',
          uploadStatus: 'uploaded',
        },
        trainingStatus: 'queued',
      });
      await ingestionService.createQueuedJob(String(botId), docId, {
        deferImmediateExtract: true,
        markTrainingQueued: true,
      });
      const itemOid = new Types.ObjectId(docId);

      await trainJobModel.create({
        botId,
        kind: 'document',
        knowledgeBaseItemId: itemOid,
        status: 'queued',
        queuedItems: 0,
        queuedCharacters: 0,
      });
      await chunkModel.create({
        botId,
        knowledgeBaseItemId: itemOid,
        sourceType: 'document',
        text: 'orphan chunk',
        embedding: [0.01],
        chunkIndex: 0,
      });

      const n = await itemService.softDeleteKbDocumentRoutesByIds(String(botId), [itemOid]);
      expect(n).toBe(1);
      const itemAfter = await itemModel.findById(itemOid).lean();
      expect(itemAfter?.active).toBe(false);
      expect(itemAfter?.deletedAt).toBeInstanceOf(Date);
      expect(await chunkModel.countDocuments({ knowledgeBaseItemId: itemOid })).toBe(0);
      expect(await extractJobModel.countDocuments({ botId, knowledgeBaseItemId: itemOid })).toBe(0);
      expect(
        await trainJobModel.countDocuments({ botId, kind: 'document', knowledgeBaseItemId: itemOid }),
      ).toBe(0);
    } finally {
      await purgeBot(botId);
    }
  });

  it('softDeleteKbDocumentRoutesByIds leaves processing ExtractJob; worker skips without persisting extract', async () => {
    const botId = await createTestBot(true);
    try {
      const { id: docId } = await itemService.createKbDocumentUploadItem({
        botId: String(botId),
        title: 'ProcDel',
        file: {
          originalName: 'a.txt',
          mimeType: 'text/plain',
          sizeBytes: 10,
          storageKey: 'kcp',
          storageBucket: 'bcp',
          uploadStatus: 'uploaded',
        },
        trainingStatus: 'queued',
      });
      const itemOid = new Types.ObjectId(docId);
      const exOid = new Types.ObjectId();
      await extractJobModel.create({
        _id: exOid,
        botId,
        knowledgeBaseItemId: itemOid,
        status: 'processing',
        startedAt: new Date(),
        queuedAt: new Date(),
      });

      const n = await itemService.softDeleteKbDocumentRoutesByIds(String(botId), [itemOid]);
      expect(n).toBe(1);
      expect(await extractJobModel.countDocuments({ _id: exOid })).toBe(1);
      const exBefore = await extractJobModel.findById(exOid).lean();
      expect(exBefore?.status).toBe('processing');

      const outcome = await ingestionService.processJob({
        _id: exOid,
        botId,
        knowledgeBaseItemId: itemOid,
      });
      expect(outcome).toBe('skipped');
      const exAfter = await extractJobModel.findById(exOid).lean();
      expect(exAfter?.status).toBe('done');
      expect(String(exAfter?.error ?? '')).toContain('skipped:document_missing');

      const itemRow = await itemModel.findById(itemOid).lean();
      expect((itemRow as { isContentExtracted?: boolean }).isContentExtracted).not.toBe(true);
    } finally {
      await purgeBot(botId);
    }
  });

  it('parallel claimQueuedJob: only one worker claims the same ExtractJob row', async () => {
    const botId = await createTestBot(true);
    try {
      const { id: docId } = await itemService.createKbDocumentUploadItem({
        botId: String(botId),
        title: 'Race',
        file: {
          originalName: 'race.txt',
          mimeType: 'text/plain',
          sizeBytes: 10,
          storageKey: 'kr',
          storageBucket: 'br',
          uploadStatus: 'uploaded',
        },
        trainingStatus: 'queued',
      });
      await ingestionService.createQueuedJob(String(botId), docId, {
        deferImmediateExtract: true,
        markTrainingQueued: true,
      });
      const [a, b] = await Promise.all([
        ingestionService.claimQueuedJob(),
        ingestionService.claimQueuedJob(),
      ]);
      const claimed = [a, b].filter((x): x is NonNullable<typeof x> => x != null);
      expect(claimed.length).toBe(1);
      const processingN = await extractJobModel.countDocuments({
        botId,
        knowledgeBaseItemId: new Types.ObjectId(docId),
        status: 'processing',
      });
      expect(processingN).toBe(1);
    } finally {
      await purgeBot(botId);
    }
  });

  it('parallel claimQueuedTrainJob: only one worker claims the same document TrainJob row', async () => {
    const botId = await createTestBot(true);
    try {
      const { id: docId } = await itemService.createKbDocumentUploadItem({
        botId: String(botId),
        title: 'RaceT',
        file: {
          originalName: 't.txt',
          mimeType: 'text/plain',
          sizeBytes: 10,
          storageKey: 'ktr',
          storageBucket: 'btr',
          uploadStatus: 'uploaded',
        },
        trainingStatus: 'queued',
      });
      const oid = new Types.ObjectId(docId);
      await trainJobModel.create({
        botId,
        kind: 'document',
        knowledgeBaseItemId: oid,
        status: 'queued',
        queuedAt: new Date(),
        runAfter: new Date(),
        queuedItems: 0,
        queuedCharacters: 0,
      });
      const [t1, t2] = await Promise.all([
        trainingJobService.claimQueuedTrainJob(),
        trainingJobService.claimQueuedTrainJob(),
      ]);
      const claimed = [t1, t2].filter((x): x is NonNullable<typeof x> => x != null);
      expect(claimed.length).toBe(1);
      expect(claimed[0]?.kind).toBe('document');
      const processingN = await trainJobModel.countDocuments({
        botId,
        kind: 'document',
        knowledgeBaseItemId: oid,
        status: 'processing',
      });
      expect(processingN).toBe(1);
    } finally {
      await purgeBot(botId);
    }
  });

  it('document: manual Train Now after autoTrain off → train → ready', async () => {
    const botId = await createTestBot(false);
    try {
      const { id: docId } = await itemService.createKbDocumentUploadItem({
        botId: String(botId),
        title: 'Doc3',
        file: {
          originalName: 'a.txt',
          mimeType: 'text/plain',
          sizeBytes: 10,
          storageKey: 'k3',
          storageBucket: 'b3',
          uploadStatus: 'uploaded',
        },
        trainingStatus: 'pending',
      });
      const ex = (
        await extractJobModel.create({
          botId,
          knowledgeBaseItemId: new Types.ObjectId(docId),
          status: 'queued',
          queuedAt: new Date(),
          runAfter: new Date(),
          extractAutoRetryCycles: 0,
        })
      ).toObject();
      await ingestionService.processJob({
        _id: ex._id as Types.ObjectId,
        botId,
        knowledgeBaseItemId: new Types.ObjectId(docId),
      });

      const { documentIdsForIngest } = await itemService.applyTrainNow(String(botId), { type: 'document' });
      expect(documentIdsForIngest).toContain(docId);
      await ingestionService.ensureQueuedIngestJobsForDocumentIds(String(botId), documentIdsForIngest, {
        forceImmediateDue: true,
      });

      const trainJob = await trainingJobService.claimQueuedTrainJob();
      expect(trainJob?.kind).toBe('document');
      await ingestionService.processDocumentTrainJob(trainJob as Parameters<IngestionService['processDocumentTrainJob']>[0]);
      const item = await itemModel.findById(docId).lean();
      expect((item as { status?: string }).status).toBe('ready');
    } finally {
      await purgeBot(botId);
    }
  });

  it('document: non-trainable text → training fails, failed status, no extra ready', async () => {
    const botId = await createTestBot(true);
    try {
      const { id: docId } = await itemService.createKbDocumentUploadItem({
        botId: String(botId),
        title: 'Emptyish',
        file: {
          originalName: 'a.txt',
          mimeType: 'text/plain',
          sizeBytes: 10,
          storageKey: 'k4',
          storageBucket: 'b4',
          uploadStatus: 'uploaded',
        },
        trainingStatus: 'queued',
      });
      kbTestDouble.extractTextFromUpload.mockResolvedValueOnce({ extracted: true, text: '   \n\t  ' });

      await ingestionService.createQueuedJob(String(botId), docId, { deferImmediateExtract: true });
      const ex = await extractJobModel.findOne({ botId, knowledgeBaseItemId: new Types.ObjectId(docId) }).lean();
      await expect(
        ingestionService.processJob({
          _id: ex!._id as Types.ObjectId,
          botId,
          knowledgeBaseItemId: new Types.ObjectId(docId),
        }),
      ).rejects.toThrow();

      await itemModel.updateOne(
        { _id: new Types.ObjectId(docId) },
        {
          $set: {
            content: 'valid length now for train attempt',
            isContentExtracted: true,
            status: 'queued',
            lastQueuedAt: new Date(),
            runAfter: new Date(),
          },
        },
      );
      await trainJobModel.create({
        botId,
        kind: 'document',
        knowledgeBaseItemId: new Types.ObjectId(docId),
        status: 'queued',
        queuedAt: new Date(),
        runAfter: new Date(),
        queuedItems: 0,
        queuedCharacters: 0,
      });
      kbTestDouble.chunkText.mockImplementation(() => []);

      const tj = await trainingJobService.claimQueuedTrainJob();
      await expect(
        ingestionService.processDocumentTrainJob(tj as Parameters<IngestionService['processDocumentTrainJob']>[0]),
      ).rejects.toThrow();

      const item = await itemModel.findById(docId).lean();
      expect((item as { status?: string }).status).toBe('failed');
      expect(String((item as { trainingError?: string }).trainingError ?? '')).toMatch(/no_chunks_created/i);
    } finally {
      await purgeBot(botId);
    }
  });

  it('document: repeated ensureQueuedIngest collapses to one queued TrainJob', async () => {
    const botId = await createTestBot(true);
    try {
      const { id: docId } = await itemService.createKbDocumentUploadItem({
        botId: String(botId),
        title: 'Dedup doc',
        file: {
          originalName: 'a.txt',
          mimeType: 'text/plain',
          sizeBytes: 10,
          storageKey: 'kd',
          storageBucket: 'bd',
          uploadStatus: 'uploaded',
        },
        trainingStatus: 'queued',
      });
      await ingestionService.createQueuedJob(String(botId), docId, { deferImmediateExtract: true });
      const ex = await extractJobModel.findOne({ botId, knowledgeBaseItemId: new Types.ObjectId(docId) }).lean();
      await ingestionService.processJob({
        _id: ex!._id as Types.ObjectId,
        botId,
        knowledgeBaseItemId: new Types.ObjectId(docId),
      });
      let tj = await trainingJobService.claimQueuedTrainJob();
      await ingestionService.processDocumentTrainJob(tj as Parameters<IngestionService['processDocumentTrainJob']>[0]);

      await itemService.applyTrainNow(String(botId), { type: 'document', forceRetrain: true });
      await ingestionService.ensureQueuedIngestJobForDocument(String(botId), docId, { forceImmediateDue: true });
      await ingestionService.ensureQueuedIngestJobForDocument(String(botId), docId, { forceImmediateDue: true });

      const n = await trainJobModel.countDocuments({
        botId,
        kind: 'document',
        knowledgeBaseItemId: new Types.ObjectId(docId),
        status: 'queued',
      });
      expect(n).toBe(1);
    } finally {
      await purgeBot(botId);
    }
  });

  it('document: retrain removes orphan extra chunks (replace semantics)', async () => {
    const botId = await createTestBot(true);
    try {
      const { id: docId } = await itemService.createKbDocumentUploadItem({
        botId: String(botId),
        title: 'Retrain doc',
        file: {
          originalName: 'a.txt',
          mimeType: 'text/plain',
          sizeBytes: 10,
          storageKey: 'kr',
          storageBucket: 'br',
          uploadStatus: 'uploaded',
        },
        trainingStatus: 'queued',
      });
      await ingestionService.createQueuedJob(String(botId), docId, { deferImmediateExtract: true });
      const ex = await extractJobModel.findOne({ botId, knowledgeBaseItemId: new Types.ObjectId(docId) }).lean();
      await ingestionService.processJob({
        _id: ex!._id as Types.ObjectId,
        botId,
        knowledgeBaseItemId: new Types.ObjectId(docId),
      });
      let tj = await trainingJobService.claimQueuedTrainJob();
      await ingestionService.processDocumentTrainJob(tj as Parameters<IngestionService['processDocumentTrainJob']>[0]);
      const c1 = await chunkModel.countDocuments({ knowledgeBaseItemId: new Types.ObjectId(docId) });

      await chunkModel.create({
        botId,
        knowledgeBaseItemId: new Types.ObjectId(docId),
        sourceType: 'document',
        text: 'orphan-chunk',
        embedding: [0.99],
        chunkIndex: 999,
      });
      expect(await chunkModel.countDocuments({ knowledgeBaseItemId: new Types.ObjectId(docId) })).toBe(c1 + 1);

      await itemService.applyTrainNow(String(botId), { type: 'document', forceRetrain: true });
      await ingestionService.ensureQueuedIngestJobForDocument(String(botId), docId, { forceImmediateDue: true });
      tj = await trainingJobService.claimQueuedTrainJob();
      await ingestionService.processDocumentTrainJob(tj as Parameters<IngestionService['processDocumentTrainJob']>[0]);
      const cFinal = await chunkModel.countDocuments({ knowledgeBaseItemId: new Types.ObjectId(docId) });
      expect(cFinal).toBe(c1);
    } finally {
      await purgeBot(botId);
    }
  });

  it('document: inactive KB row still completes ExtractJob (not kb_item_inactive)', async () => {
    const botId = await createTestBot(true);
    try {
      const { id: docId } = await itemService.createKbDocumentUploadItem({
        botId: String(botId),
        title: 'Inact',
        file: {
          originalName: 'a.txt',
          mimeType: 'text/plain',
          sizeBytes: 10,
          storageKey: 'ki',
          storageBucket: 'bi',
          uploadStatus: 'uploaded',
        },
        trainingStatus: 'queued',
      });
      await ingestionService.createQueuedJob(String(botId), docId, { deferImmediateExtract: true });
      await itemModel.updateOne({ _id: new Types.ObjectId(docId) }, { $set: { active: false } });

      const ex = await extractJobModel.findOne({ botId, knowledgeBaseItemId: new Types.ObjectId(docId) }).lean();
      await ingestionService.processJob({
        _id: ex!._id as Types.ObjectId,
        botId,
        knowledgeBaseItemId: new Types.ObjectId(docId),
      });

      const exAfter = await extractJobModel.findOne({ botId, knowledgeBaseItemId: new Types.ObjectId(docId) }).lean();
      expect(exAfter?.status).toBe('done');
      expect(String(exAfter?.error ?? '')).not.toMatch(/kb_item_inactive/);

      const item = await itemModel.findById(docId).lean();
      expect((item as { active?: boolean }).active).toBe(false);
      expect((item as { isContentExtracted?: boolean }).isContentExtracted).toBe(true);
    } finally {
      await purgeBot(botId);
    }
  });

  it('FAQ: autoTrain on → no ExtractJob, scopes job includes faq, chunks + ready', async () => {
    const botId = await createTestBot(true);
    try {
      await itemService.upsertFaqKnowledgeItemsForBot(String(botId), [
        { question: 'Q1', answer: 'A1 with enough chars for embedding.', active: true },
      ]);
      const exN = await extractJobModel.countDocuments({ botId });
      expect(exN).toBe(0);

      const job = await trainingJobService.claimQueuedTrainJob();
      expect(job?.kind).toBe('scopes');
      expect(job?.scopes).toContain('faq');
      await trainingJobService.processScopesTrainJob(job!);

      const faq = await itemModel.findOne({ botId, sourceType: 'faq' }).lean();
      expect((faq as { status?: string }).status).toBe('ready');
      const chunks = await chunkModel.countDocuments({ knowledgeBaseItemId: (faq as { _id: Types.ObjectId })._id });
      expect(chunks).toBe(1);
    } finally {
      await purgeBot(botId);
    }
  });

  it('FAQ: autoTrain off → pending, no scopes TrainJob until Train Now', async () => {
    const botId = await createTestBot(false);
    try {
      await itemService.upsertFaqKnowledgeItemsForBot(String(botId), [
        { question: 'Q', answer: 'Answer text here for the faq row.', active: true },
      ]);
      const tj = await trainJobModel.countDocuments({ botId, kind: 'scopes' });
      expect(tj).toBe(0);
      const faq = await itemModel.findOne({ botId, sourceType: 'faq' }).lean();
      expect((faq as { status?: string }).status).toBe('pending');

      await itemService.applyTrainNow(String(botId), { type: 'faq' });
      await trainingJobService.scheduleTrainingForScopes(String(botId), ['faq'], {
        bypassAutoTrainGate: true,
        immediateJob: true,
      });
      const job = await trainingJobService.claimQueuedTrainJob();
      await trainingJobService.processScopesTrainJob(job!);
      const faq2 = await itemModel.findOne({ botId, sourceType: 'faq' }).lean();
      expect((faq2 as { status?: string }).status).toBe('ready');
    } finally {
      await purgeBot(botId);
    }
  });

  it('snippet (note): autoTrain → scope note → chunks + ready', async () => {
    const botId = await createTestBot(true);
    try {
      await itemService.upsertSnippetKnowledgeItemsForBot(String(botId), [
        { title: 'S', snippet: 'Body text for snippet training path.', active: true },
      ]);
      const job = await trainingJobService.claimQueuedTrainJob();
      expect(job?.scopes).toContain('note');
      await trainingJobService.processScopesTrainJob(job!);
      const note = await itemModel.findOne({ botId, sourceType: 'note' }).lean();
      expect((note as { status?: string }).status).toBe('ready');
      const n = await chunkModel.countDocuments({ knowledgeBaseItemId: (note as { _id: Types.ObjectId })._id });
      expect(n).toBeGreaterThanOrEqual(1);
    } finally {
      await purgeBot(botId);
    }
  });

  it('table: autoTrain → scope table → chunk + ready; update replaces chunks', async () => {
    const botId = await createTestBot(true);
    try {
      await itemService.upsertTableKnowledgeItemsForBot(String(botId), [
        { title: 'T', columns: ['c'], rows: [['v']], active: true },
      ]);
      let job = await trainingJobService.claimQueuedTrainJob();
      await trainingJobService.processScopesTrainJob(job!);
      let table = await itemModel.findOne({ botId, sourceType: 'table' }).lean();
      const id = (table as { _id: Types.ObjectId })._id;
      let txt = await chunkModel.findOne({ knowledgeBaseItemId: id }).lean();

      await itemService.upsertTableKnowledgeItemsForBot(String(botId), [
        { title: 'T', columns: ['c'], rows: [['x']], active: true },
      ]);
      await trainingJobService.scheduleTrainingForScopes(String(botId), ['table'], {
        bypassAutoTrainGate: true,
        immediateJob: true,
      });
      job = await trainingJobService.claimQueuedTrainJob();
      await trainingJobService.processScopesTrainJob(job!);
      const txt2 = await chunkModel.findOne({ knowledgeBaseItemId: id }).lean();
      expect((txt2 as { text?: string })?.text).not.toBe((txt as { text?: string })?.text);
      const count = await chunkModel.countDocuments({ knowledgeBaseItemId: id });
      expect(count).toBe(1);
    } finally {
      await purgeBot(botId);
    }
  });

  it('suggestion: scoped → chunk + ready; label-only → no suggestion KB row (UI-only)', async () => {
    const botId = await createTestBot(true);
    try {
      await itemService.upsertSuggestionKnowledgeItemsForBot(String(botId), [
        { label: 'Chip', context: 'Scoped facts for retrieval.' },
      ]);
      const job = await trainingJobService.claimQueuedTrainJob();
      expect(job?.scopes).toContain('suggestion');
      await trainingJobService.processScopesTrainJob(job!);
      const sug = await itemModel.findOne({ botId, sourceType: 'suggestion' }).lean();
      expect((sug as { status?: string }).status).toBe('ready');
      const ch = await chunkModel.countDocuments({ knowledgeBaseItemId: (sug as { _id: Types.ObjectId })._id });
      expect(ch).toBe(1);

      await itemService.upsertSuggestionKnowledgeItemsForBot(String(botId), [{ label: 'OnlyLabel', context: '' }]);
      const nAfter = await itemModel.countDocuments({ botId, sourceType: 'suggestion' });
      expect(nAfter).toBe(0);
    } finally {
      await purgeBot(botId);
    }
  });

  it('train claim order: document job before scopes when both due', async () => {
    const botId = await createTestBot(true);
    try {
      const docOid = new Types.ObjectId();
      await itemModel.create({
        _id: docOid,
        botId,
        sourceType: 'document',
        title: 'x',
        status: 'queued',
        active: true,
        content: 'train me please with enough characters for the test.',
        isContentExtracted: true,
        characterCount: 40,
        fileMeta: {},
      });
      const now = new Date();
      await trainJobModel.create({
        botId,
        kind: 'scopes',
        scopes: ['faq'],
        status: 'queued',
        queuedAt: now,
        runAfter: now,
        queuedItems: 1,
        queuedCharacters: 10,
      });
      await trainJobModel.create({
        botId,
        kind: 'document',
        knowledgeBaseItemId: docOid,
        status: 'queued',
        queuedAt: now,
        runAfter: now,
        queuedItems: 0,
        queuedCharacters: 0,
      });

      const claimed = await trainingJobService.claimQueuedTrainJob();
      expect(claimed?.kind).toBe('document');
    } finally {
      await purgeBot(botId);
    }
  });

  it('runAfter: future TrainJob is not claimed', async () => {
    const botId = await createTestBot(true);
    try {
      await trainJobModel.create({
        botId,
        kind: 'scopes',
        scopes: ['faq'],
        status: 'queued',
        queuedAt: new Date(),
        runAfter: new Date(Date.now() + 3_600_000),
        queuedItems: 1,
        queuedCharacters: 1,
      });
      const j = await trainingJobService.claimQueuedTrainJob();
      expect(j).toBeNull();
    } finally {
      await purgeBot(botId);
    }
  });

  it('resetStuckJobs: old processing job returns to queued', async () => {
    const botId = await createTestBot(true);
    try {
      const old = new Date(Date.now() - 60 * 60 * 1000);
      await trainJobModel.create({
        botId,
        kind: 'scopes',
        scopes: ['faq'],
        status: 'processing',
        startedAt: old,
        queuedAt: old,
        runAfter: old,
        queuedItems: 1,
        queuedCharacters: 1,
      });
      const n = await trainingJobService.resetStuckJobs();
      expect(n).toBeGreaterThanOrEqual(1);
      const row = await trainJobModel.findOne({ botId }).lean();
      expect(row?.status).toBe('queued');
    } finally {
      await purgeBot(botId);
    }
  });

  it('stuck ExtractJob: re-queues same row + sets KB extractionStatus queued; training status not processing', async () => {
    const botId = await createTestBot(true);
    try {
      const { id: docId } = await itemService.createKbDocumentUploadItem({
        botId: String(botId),
        title: 'StuckEx',
        file: {
          originalName: 's.txt',
          mimeType: 'text/plain',
          sizeBytes: 10,
          storageKey: 'ks',
          storageBucket: 'bs',
          uploadStatus: 'uploaded',
        },
        trainingStatus: 'pending',
      });
      const kid = new Types.ObjectId(docId);
      await extractJobModel.deleteMany({ botId, knowledgeBaseItemId: kid });
      const old = new Date(Date.now() - 60 * 60 * 1000);
      await extractJobModel.create({
        botId,
        knowledgeBaseItemId: kid,
        status: 'processing',
        startedAt: old,
        processingStartedAt: old,
        queuedAt: old,
        runAfter: old,
      });
      await itemModel.updateOne(
        { _id: kid },
        { $set: { extractionStatus: 'processing', status: 'pending' } },
      );
      const before = await extractJobModel.countDocuments({ botId });
      const n = await ingestionService.resetStuckJobs();
      expect(n).toBeGreaterThanOrEqual(1);
      expect(await extractJobModel.countDocuments({ botId })).toBe(before);
      const ex = await extractJobModel.findOne({ botId, knowledgeBaseItemId: kid }).lean();
      expect(ex?.status).toBe('queued');
      expect(ex?.extractStuckRecoveryCycles).toBe(1);
      expect(ex?.startedAt).toBeUndefined();
      const item = await itemModel.findById(docId).lean();
      expect((item as { extractionStatus?: string }).extractionStatus).toBe('queued');
      expect((item as { status?: string }).status).not.toBe('processing');
    } finally {
      await purgeBot(botId);
    }
  });

  it('stuck ExtractJob for missing KB route: finishes job done (no queued/processing left)', async () => {
    const botId = await createTestBot(true);
    try {
      const phantom = new Types.ObjectId();
      const old = new Date(Date.now() - 60 * 60 * 1000);
      await extractJobModel.create({
        botId,
        knowledgeBaseItemId: phantom,
        status: 'processing',
        startedAt: old,
        processingStartedAt: old,
        queuedAt: old,
        runAfter: old,
      });
      await ingestionService.resetStuckJobs();
      const ex = await extractJobModel.findOne({ botId }).lean();
      expect(ex?.status).toBe('done');
      expect(String(ex?.error ?? '')).toContain('document_missing');
    } finally {
      await purgeBot(botId);
    }
  });

  it('stuck document TrainJob: job re-queued, KB training status queued, extractionStatus stays done', async () => {
    const botId = await createTestBot(true);
    try {
      const { id: docId } = await itemService.createKbDocumentUploadItem({
        botId: String(botId),
        title: 'StuckTr',
        file: {
          originalName: 't.txt',
          mimeType: 'text/plain',
          sizeBytes: 10,
          storageKey: 'kt',
          storageBucket: 'bt',
          uploadStatus: 'uploaded',
        },
        trainingStatus: 'queued',
      });
      const kid = new Types.ObjectId(docId);
      await itemModel.updateOne(
        { _id: kid },
        {
          $set: {
            extractionStatus: 'done',
            isContentExtracted: true,
            content: 'Trainable body text for stuck recovery. '.repeat(4),
            status: 'processing',
          },
        },
      );
      const old = new Date(Date.now() - 60 * 60 * 1000);
      await trainJobModel.deleteMany({ botId });
      await trainJobModel.create({
        botId,
        kind: 'document',
        knowledgeBaseItemId: kid,
        status: 'processing',
        startedAt: old,
        queuedAt: old,
        runAfter: old,
        queuedItems: 0,
        queuedCharacters: 0,
      });
      const before = await trainJobModel.countDocuments({ botId });
      const n = await trainingJobService.resetStuckJobs();
      expect(n).toBeGreaterThanOrEqual(1);
      expect(await trainJobModel.countDocuments({ botId })).toBe(before);
      const tj = await trainJobModel.findOne({ botId, kind: 'document' }).lean();
      expect(tj?.status).toBe('queued');
      expect(tj?.trainStuckRecoveryCycles).toBe(1);
      const item = await itemModel.findById(docId).lean();
      expect((item as { status?: string }).status).toBe('queued');
      expect((item as { extractionStatus?: string }).extractionStatus).toBe('done');
      const claimed = await trainingJobService.claimQueuedTrainJob();
      expect(claimed?._id?.toString()).toBe(tj?._id?.toString());
    } finally {
      await purgeBot(botId);
    }
  });

  it('stuck scopes TrainJob: processing FAQ row returns to queued', async () => {
    const botId = await createTestBot(true);
    try {
      await itemService.upsertFaqKnowledgeItemsForBot(String(botId), [
        { question: 'SQ', answer: 'Answer with enough text for the stuck recovery path.', active: true },
      ]);
      const faq = await itemModel.findOne({ botId, sourceType: 'faq' }).lean();
      expect(faq).toBeTruthy();
      await itemModel.updateOne(
        { _id: (faq as { _id: Types.ObjectId })._id },
        { $set: { status: 'processing', lastTrainingStartedAt: new Date() } },
      );
      const old = new Date(Date.now() - 60 * 60 * 1000);
      await trainJobModel.create({
        botId,
        kind: 'scopes',
        scopes: ['faq'],
        status: 'processing',
        startedAt: old,
        queuedAt: old,
        runAfter: old,
        queuedItems: 1,
        queuedCharacters: 10,
      });
      await trainingJobService.resetStuckJobs();
      const row = await itemModel.findById((faq as { _id: Types.ObjectId })._id).lean();
      expect((row as { status?: string }).status).toBe('queued');
      const tj = await trainJobModel.findOne({ botId }).lean();
      expect(tj?.status).toBe('queued');
      expect(tj?.trainStuckRecoveryCycles).toBe(1);
    } finally {
      await purgeBot(botId);
    }
  });

  it('markJobFailed: extraction failure sets extractionStatus failed, not training status failed', async () => {
    const botId = await createTestBot(true);
    try {
      const { id: docId } = await itemService.createKbDocumentUploadItem({
        botId: String(botId),
        title: 'FailEx',
        file: {
          originalName: 'f.txt',
          mimeType: 'text/plain',
          sizeBytes: 10,
          storageKey: 'kf',
          storageBucket: 'bf',
          uploadStatus: 'uploaded',
        },
        trainingStatus: 'queued',
      });
      const kid = new Types.ObjectId(docId);
      await ingestionService.createQueuedJob(String(botId), docId, {
        deferImmediateExtract: true,
        markTrainingQueued: false,
      });
      const ex = await extractJobModel.findOne({ botId, knowledgeBaseItemId: kid }).lean();
      expect(ex).toBeTruthy();
      await extractJobModel.updateOne(
        { _id: (ex as { _id: Types.ObjectId })._id },
        { $set: { status: 'processing', startedAt: new Date() } },
      );
      await ingestionService.markJobFailed(
        {
          _id: (ex as { _id: Types.ObjectId })._id,
          botId,
          knowledgeBaseItemId: kid,
        },
        's3_read_failed',
      );
      const item = await itemModel.findById(docId).lean();
      expect((item as { extractionStatus?: string }).extractionStatus).toBe('failed');
      expect((item as { status?: string }).status).not.toBe('failed');
      const exAfter = await extractJobModel.findById((ex as { _id: Types.ObjectId })._id).lean();
      expect((exAfter as { status?: string })?.status).toBe('failed');
    } finally {
      await purgeBot(botId);
    }
  });

  it('reflectDocumentTrainJobCatchFailure: training failure keeps extractionStatus done', async () => {
    const botId = await createTestBot(true);
    try {
      const { id: docId } = await itemService.createKbDocumentUploadItem({
        botId: String(botId),
        title: 'FailTr',
        file: {
          originalName: 'g.txt',
          mimeType: 'text/plain',
          sizeBytes: 10,
          storageKey: 'kg',
          storageBucket: 'bg',
          uploadStatus: 'uploaded',
        },
        trainingStatus: 'queued',
      });
      const kid = new Types.ObjectId(docId);
      await itemModel.updateOne(
        { _id: kid },
        {
          $set: {
            extractionStatus: 'done',
            isContentExtracted: true,
            content: 'Body '.repeat(30),
          },
        },
      );
      const tj = await trainJobModel.create({
        botId,
        kind: 'document',
        knowledgeBaseItemId: kid,
        status: 'processing',
        queuedItems: 0,
        queuedCharacters: 0,
      });
      await ingestionService.reflectDocumentTrainJobCatchFailure(
        { _id: tj._id as Types.ObjectId, botId, knowledgeBaseItemId: kid },
        'embed_crash',
      );
      const item = await itemModel.findById(docId).lean();
      expect((item as { status?: string }).status).toBe('failed');
      expect((item as { extractionStatus?: string }).extractionStatus).toBe('done');
    } finally {
      await purgeBot(botId);
    }
  });
});