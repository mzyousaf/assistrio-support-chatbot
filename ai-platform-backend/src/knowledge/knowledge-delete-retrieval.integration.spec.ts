/**
 * Opt-in Mongo integration: soft-delete removes chunks and unified retrieval returns no evidence.
 *
 * Run:
 *   set KB_INTEGRATION=1
 *   set KB_INTEGRATION_MONGODB_URI=mongodb://127.0.0.1:27017/kb_delete_retrieval
 *   npx jest src/knowledge/knowledge-delete-retrieval.integration.spec.ts --runInBand
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
import { KnowledgeModule } from './knowledge.module';
import { IngestionModule } from '../ingestion/ingestion.module';
import { IngestionService } from '../ingestion/ingestion.service';
import { KnowledgeBaseItemService } from './knowledge-base-item.service';
import { KnowledgeTrainingJobService } from './knowledge-training-job.service';
import { RagService } from '../rag/rag.service';
import { KbService } from './kb.service';
import { UnifiedKnowledgeRetrievalService } from '../rag/unified-knowledge-retrieval.service';
import { RagModule } from '../rag/rag.module';

jest.mock('../lib/s3', () => ({
  getObjectBody: jest.fn().mockResolvedValue(Buffer.from('fake-bytes')),
}));

const URI = process.env.KB_INTEGRATION_MONGODB_URI ?? process.env.MONGODB_URI;
const RUN = Boolean(URI && (process.env.KB_INTEGRATION === '1' || process.env.KB_INTEGRATION === 'true'));

const describeIntegration = RUN ? describe : describe.skip;

const kbTestDouble = {
  extractTextFromUpload: jest.fn().mockResolvedValue({
    extracted: true,
    text: 'DeleteRetrievalDocMarker paragraph content. '.repeat(8),
  }),
  chunkText: jest.fn((text: string) => [text]),
  getFileExtension: jest.fn((name: string) => String(name).split('.').pop() ?? 'txt'),
};

function uniqueSlug(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

describeIntegration('KB delete + retrieval safety (Mongo)', () => {
  jest.setTimeout(120_000);

  let moduleRef: TestingModule;
  let ingestionService: IngestionService;
  let itemService: KnowledgeBaseItemService;
  let trainingJobService: KnowledgeTrainingJobService;
  let retrieval: UnifiedKnowledgeRetrievalService;
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
        RagModule,
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
    retrieval = moduleRef.get(UnifiedKnowledgeRetrievalService);
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
      text: 'DeleteRetrievalDocMarker paragraph content. '.repeat(8),
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
      name: 'KB delete/retrieval bot',
      slug: uniqueSlug('kb-del'),
      knowledgeTraining: { autoTrainEnabled: autoTrain, trainingDelayMinutes: 0, scheduleMode: 'smart' },
    });
    return bot._id as Types.ObjectId;
  }

  it('document: after soft delete, row inactive + chunks gone + retrieval returns no evidence', async () => {
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
      await ingestionService.processJob({
        _id: ex0!._id as Types.ObjectId,
        botId,
        knowledgeBaseItemId: new Types.ObjectId(docId),
      });

      let trainJob = await trainingJobService.claimQueuedTrainJob();
      await ingestionService.processDocumentTrainJob(trainJob as Parameters<IngestionService['processDocumentTrainJob']>[0]);

      const docOid = new Types.ObjectId(docId);
      expect(await chunkModel.countDocuments({ knowledgeBaseItemId: docOid })).toBeGreaterThanOrEqual(1);

      let hit = await retrieval.getRelevantKnowledgeItemsForBot(String(botId), 'DeleteRetrievalDocMarker');
      expect(hit.items.some((i) => i.sourceId === docId)).toBe(true);

      const n = await itemService.softDeleteKnowledgeItemsMatching(String(botId), { _id: docOid });
      expect(n).toBe(1);

      const item = await itemModel.findById(docOid).lean();
      expect(item?.active).toBe(false);
      expect(item?.deletedAt).toBeInstanceOf(Date);
      expect(await chunkModel.countDocuments({ knowledgeBaseItemId: docOid })).toBe(0);

      hit = await retrieval.getRelevantKnowledgeItemsForBot(String(botId), 'DeleteRetrievalDocMarker');
      expect(hit.items.some((i) => i.sourceId === docId)).toBe(false);
    } finally {
      await purgeBot(botId);
    }
  });

  it('table: after soft delete, row inactive + chunks gone + retrieval returns no evidence', async () => {
    const botId = await createTestBot(true);
    try {
      await itemService.upsertTableKnowledgeItemsForBot(String(botId), [
        { title: 'T', columns: ['c'], rows: [['DeleteRetrievalTableMarker']], active: true },
      ]);
      const job = await trainingJobService.claimQueuedTrainJob();
      await trainingJobService.processScopesTrainJob(job!);

      const table = await itemModel.findOne({ botId, sourceType: 'table' }).lean();
      expect(table).toBeTruthy();
      const tid = String((table as { _id: Types.ObjectId })._id);
      const tableOid = new Types.ObjectId(tid);

      expect(await chunkModel.countDocuments({ knowledgeBaseItemId: tableOid })).toBeGreaterThanOrEqual(1);

      let hit = await retrieval.getRelevantKnowledgeItemsForBot(String(botId), 'DeleteRetrievalTableMarker');
      expect(hit.items.some((i) => i.sourceId === tid)).toBe(true);

      const n = await itemService.softDeleteKnowledgeItemsMatching(String(botId), { _id: tableOid });
      expect(n).toBe(1);

      const item = await itemModel.findById(tableOid).lean();
      expect(item?.active).toBe(false);
      expect(item?.deletedAt).toBeInstanceOf(Date);
      expect(await chunkModel.countDocuments({ knowledgeBaseItemId: tableOid })).toBe(0);

      hit = await retrieval.getRelevantKnowledgeItemsForBot(String(botId), 'DeleteRetrievalTableMarker');
      expect(hit.items.some((i) => i.sourceId === tid)).toBe(false);
    } finally {
      await purgeBot(botId);
    }
  });
});
