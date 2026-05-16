/**
 * Opt-in Mongo tests for scope-training extraction gating + non-document extractionStatus backfill on upsert.
 *
 * Run (same env as kb-training.integration.spec.ts):
 *   set KB_INTEGRATION=1
 *   set KB_INTEGRATION_MONGODB_URI=mongodb://127.0.0.1:27017/kb_training_verify
 *   npx jest src/knowledge/scope-training-extraction.integration.spec.ts --runInBand
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
import { KnowledgeBaseItemService } from './knowledge-base-item.service';
import { KnowledgeBaseChunkService } from './knowledge-base-chunk.service';
import { RagService } from '../rag/rag.service';
import {
  buildFaqEmbeddingText,
  buildNoteEmbeddingText,
  buildSuggestionEmbeddingText,
  buildTableEmbeddingText,
  computeEmbeddingInputHash,
} from './faq-note-embedding.helper';
import { metricsForSuggestionRow } from './knowledge-text-metrics';
import { KnowledgeExtractionStatusBackfillService } from './knowledge-extraction-status-backfill.service';

const URI = process.env.KB_INTEGRATION_MONGODB_URI ?? process.env.MONGODB_URI;
const RUN = Boolean(URI && (process.env.KB_INTEGRATION === '1' || process.env.KB_INTEGRATION === 'true'));

const describeIntegration = RUN ? describe : describe.skip;

function uniqueSlug(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

describeIntegration('scope training vs extractionStatus (Mongo)', () => {
  jest.setTimeout(120_000);

  let moduleRef: TestingModule;
  let itemService: KnowledgeBaseItemService;
  let chunkService: KnowledgeBaseChunkService;
  let botModel: Model<Bot>;
  let trainJobModel: Model<TrainJob>;
  let extractJobModel: Model<ExtractJob>;
  let itemModel: Model<KnowledgeBaseItem>;
  let chunkModel: Model<KnowledgeBaseChunk>;
  let backfillService: KnowledgeExtractionStatusBackfillService;

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
      ],
    })
      .overrideProvider(RagService)
      .useValue({
        embedTexts: async (texts: string[]) =>
          texts.map((_, i) => Array.from({ length: 12 }, (_, j) => (i + j) * 0.001)),
        embedText: async () => Array.from({ length: 12 }, (_, j) => j * 0.001),
      })
      .compile();

    itemService = moduleRef.get(KnowledgeBaseItemService);
    chunkService = moduleRef.get(KnowledgeBaseChunkService);
    botModel = moduleRef.get(getModelToken(Bot.name));
    trainJobModel = moduleRef.get(getModelToken(TrainJob.name));
    extractJobModel = moduleRef.get(getModelToken(ExtractJob.name));
    itemModel = moduleRef.get(getModelToken(KnowledgeBaseItem.name));
    chunkModel = moduleRef.get(getModelToken(KnowledgeBaseChunk.name));
    backfillService = moduleRef.get(KnowledgeExtractionStatusBackfillService);
  });

  afterAll(async () => {
    if (moduleRef) await moduleRef.close();
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
      name: 'scope-extraction bot',
      slug: uniqueSlug('scope-ext'),
      knowledgeTraining: { autoTrainEnabled: autoTrain, trainingDelayMinutes: 0, scheduleMode: 'smart' },
    });
    return bot._id as Types.ObjectId;
  }

  it('FAQ with extractionStatus not_required trains to ready + chunk', async () => {
    const botId = await createTestBot(true);
    try {
      const primaryQ = 'Scope FAQ Q?';
      const answer = 'Scope FAQ answer.';
      const content = buildFaqEmbeddingText(primaryQ, answer);
      const hash = computeEmbeddingInputHash(content);
      const lastContentUpdatedAt = new Date();
      const row = await itemModel.create({
        botId,
        title: primaryQ,
        sourceType: 'faq',
        active: true,
        status: 'processing',
        content,
        contentHash: hash,
        lastContentUpdatedAt,
        extractionStatus: 'not_required',
        faqMeta: { faqIndex: 0, questions: [primaryQ], answer },
        characterCount: content.length,
      });
      await chunkService.replaceFaqKnowledgeChunksForBot(String(botId));
      const after = await itemModel.findById(row._id).lean();
      expect((after as { status?: string }).status).toBe('ready');
      expect(await chunkModel.countDocuments({ knowledgeBaseItemId: row._id })).toBe(1);
    } finally {
      await purgeBot(botId);
    }
  });

  it('FAQ with legacy extraction failed is normalized by backfill then trains to ready', async () => {
    const botId = await createTestBot(true);
    try {
      const primaryQ = 'Bad extraction FAQ?';
      const answer = 'Ans';
      const content = buildFaqEmbeddingText(primaryQ, answer);
      const hash = computeEmbeddingInputHash(content);
      const lastContentUpdatedAt = new Date();
      const row = await itemModel.create({
        botId,
        title: primaryQ,
        sourceType: 'faq',
        active: true,
        status: 'processing',
        content,
        contentHash: hash,
        lastContentUpdatedAt,
        extractionStatus: 'failed',
        extractionError: 'legacy_bad_status',
        faqMeta: { faqIndex: 0, questions: [primaryQ], answer },
        characterCount: content.length,
      });
      await backfillService.runBackfill();
      const normalized = await itemModel.findById(row._id).lean();
      expect((normalized as { extractionStatus?: string }).extractionStatus).toBe('not_required');
      expect((normalized as { extractionError?: string }).extractionError).toBeUndefined();
      await chunkService.replaceFaqKnowledgeChunksForBot(String(botId));
      const after = await itemModel.findById(row._id).lean();
      expect((after as { status?: string }).status).toBe('ready');
      expect(await chunkModel.countDocuments({ knowledgeBaseItemId: row._id })).toBe(1);
    } finally {
      await purgeBot(botId);
    }
  });

  it('backfill sets faq/note/table/suggestion to not_required for failed/queued/processing/done/missing and clears extractionError', async () => {
    const botId = await createTestBot(false);
    try {
      const t = new Date();
      await itemModel.create({
        botId,
        title: 'F',
        sourceType: 'faq',
        active: true,
        status: 'ready',
        content: 'c',
        contentHash: 'h1',
        lastContentUpdatedAt: t,
        extractionStatus: 'failed',
        extractionError: 'x',
        faqMeta: { faqIndex: 0, answer: 'a' },
        characterCount: 1,
      });
      await itemModel.create({
        botId,
        title: 'N',
        sourceType: 'note',
        active: true,
        status: 'ready',
        content: 'c',
        contentHash: 'h2',
        lastContentUpdatedAt: t,
        extractionStatus: 'queued',
        noteMeta: { kind: 'snippet', snippetIndex: 0 },
        characterCount: 1,
      });
      await itemModel.create({
        botId,
        title: 'Tbl',
        sourceType: 'table',
        active: true,
        status: 'ready',
        content: 'c',
        contentHash: 'h3',
        lastContentUpdatedAt: t,
        extractionStatus: 'processing',
        tableMeta: { tableIndex: 0 },
        characterCount: 1,
      });
      const m = metricsForSuggestionRow({ chipText: 'C', scopedInformation: 's' });
      await itemModel.create({
        botId,
        title: 'C',
        sourceType: 'suggestion',
        active: true,
        status: 'ready',
        content: 'emb',
        contentHash: 'h4',
        lastContentUpdatedAt: t,
        extractionStatus: 'done',
        suggestionMeta: { suggestionIndex: 0, chipText: 'C', scopedInformation: 's' },
        characterCount: m.characterCount,
      });
      await itemModel.create({
        botId,
        title: 'Clean',
        sourceType: 'faq',
        active: true,
        status: 'ready',
        content: 'c2',
        contentHash: 'h5',
        lastContentUpdatedAt: t,
        extractionStatus: 'not_required',
        extractionError: 'should_clear',
        faqMeta: { faqIndex: 1, answer: 'b' },
        characterCount: 1,
      });
      await itemModel.collection.insertOne({
        botId,
        title: 'Legacy miss',
        sourceType: 'note',
        active: true,
        status: 'ready',
        content: 'c3',
        contentHash: 'h6',
        lastContentUpdatedAt: t,
        noteMeta: { kind: 'snippet', snippetIndex: 1 },
        characterCount: 1,
        createdAt: t,
        updatedAt: t,
      });

      await backfillService.runBackfill();

      const rows = await itemModel
        .find({ botId, sourceType: { $in: ['faq', 'note', 'table', 'suggestion'] } })
        .select('extractionStatus extractionError')
        .lean();
      expect(rows.length).toBe(6);
      for (const r of rows) {
        expect((r as { extractionStatus?: string }).extractionStatus).toBe('not_required');
        expect((r as { extractionError?: string }).extractionError).toBeUndefined();
      }
    } finally {
      await purgeBot(botId);
    }
  });

  it('note, table, suggestion with extractionStatus not_required train to ready', async () => {
    const botId = await createTestBot(true);
    try {
      const now = new Date();
      const stitle = 'Note t';
      const body = 'Note body for scope training. '.repeat(4);
      const noteText = buildNoteEmbeddingText(stitle, body);
      const noteHash = computeEmbeddingInputHash(noteText);
      const noteRow = await itemModel.create({
        botId,
        title: stitle,
        sourceType: 'note',
        active: true,
        status: 'processing',
        content: noteText,
        contentHash: noteHash,
        lastContentUpdatedAt: now,
        extractionStatus: 'not_required',
        noteMeta: { kind: 'snippet', snippetIndex: 0 },
        characterCount: noteText.length,
      });

      const tblTitle = 'T';
      const columns = ['c1'];
      const rows = [['x']];
      const tableText = buildTableEmbeddingText(tblTitle, columns, rows);
      const tableHash = computeEmbeddingInputHash(tableText);
      const tableRow = await itemModel.create({
        botId,
        title: tblTitle,
        sourceType: 'table',
        active: true,
        status: 'processing',
        content: tableText,
        contentHash: tableHash,
        lastContentUpdatedAt: now,
        extractionStatus: 'not_required',
        tableMeta: { tableIndex: 0 },
        characterCount: tableText.length,
      });

      const chip = 'Chip';
      const scoped = 'Scoped training text';
      const sugText = buildSuggestionEmbeddingText(chip, scoped);
      const sugHash = computeEmbeddingInputHash(sugText);
      const m = metricsForSuggestionRow({ chipText: chip, scopedInformation: scoped });
      const sugRow = await itemModel.create({
        botId,
        title: chip,
        sourceType: 'suggestion',
        active: true,
        status: 'processing',
        content: sugText,
        contentHash: sugHash,
        lastContentUpdatedAt: now,
        extractionStatus: 'not_required',
        suggestionMeta: { suggestionIndex: 0, chipText: chip, scopedInformation: scoped },
        characterCount: m.characterCount,
      });

      await chunkService.replaceNoteKnowledgeChunksForBot(String(botId));
      await chunkService.replaceTableKnowledgeChunksForBot(String(botId));
      await chunkService.replaceSuggestionKnowledgeChunksForBot(String(botId));

      for (const row of [noteRow, tableRow, sugRow]) {
        const after = await itemModel.findById(row._id).lean();
        expect((after as { status?: string }).status).toBe('ready');
        expect(await chunkModel.countDocuments({ knowledgeBaseItemId: row._id })).toBeGreaterThanOrEqual(1);
      }
    } finally {
      await purgeBot(botId);
    }
  });

  it('non-document upserts set extractionStatus not_required', async () => {
    const botId = await createTestBot(false);
    try {
      await itemService.upsertFaqKnowledgeItemsForBot(String(botId), [
        { question: 'Q1', answer: 'A1', active: true },
      ]);
      await itemService.upsertSnippetKnowledgeItemsForBot(String(botId), [
        { title: 'Sn', snippet: 'body', active: true },
      ]);
      await itemService.upsertTableKnowledgeItemsForBot(String(botId), [
        { title: 'Tbl', columns: ['a'], rows: [['b']], active: true },
      ]);
      await itemService.upsertSuggestionKnowledgeItemsForBot(String(botId), [{ label: 'L', context: 'ctx' }]);

      const items = await itemModel
        .find({
          botId,
          sourceType: { $in: ['faq', 'note', 'table', 'suggestion'] },
        })
        .select('sourceType extractionStatus')
        .lean();
      expect(items.length).toBeGreaterThanOrEqual(4);
      for (const it of items) {
        expect((it as { extractionStatus?: string }).extractionStatus).toBe('not_required');
      }
    } finally {
      await purgeBot(botId);
    }
  });
});
