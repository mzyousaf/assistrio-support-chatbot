import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { KnowledgeBaseChunk } from '../models/knowledge-base-chunk.schema';
import type { KnowledgeBaseItemSourceType } from '../models/knowledge-base-item.schema';
import { Bot } from '../models';
import { KnowledgeBaseItemAccessService } from './knowledge-base-item-access.service';
import { KnowledgeStatsService } from './knowledge-stats.service';
import { RagService } from '../rag/rag.service';
import { chunkDocumentText } from './chunking.helper';
import {
  canFinalizeKnowledgeItemTraining,
  type SnapshotForFinalize,
} from './knowledge-training-finalize.helper';
import { PLAN_LIMIT_BOT_KB_TOTAL_CODE } from './bot-knowledge-total-limit.service';

export interface ChunkInput {
  text: string;
  embedding: number[];
  chunkIndex: number;
  heading?: string;
  sectionPath?: string;
  tokenCount?: number;
}

const MAX_NOTE_CHUNKS = 30;
const MAX_EMBED_BATCH = 25;

function isMongoTransactionUnsupportedError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return (
    msg.includes('Transaction numbers are only allowed') ||
    msg.includes('Transactions are not supported') ||
    msg.includes('IllegalOperation') ||
    /replica set/i.test(msg)
  );
}

@Injectable()
export class KnowledgeBaseChunkService {
  private readonly log = new Logger(KnowledgeBaseChunkService.name);

  constructor(
    @InjectModel(KnowledgeBaseChunk.name) private readonly chunkModel: Model<KnowledgeBaseChunk>,
    @InjectModel(Bot.name) private readonly botModel: Model<Bot>,
    private readonly knowledgeBaseItemAccess: KnowledgeBaseItemAccessService,
    private readonly knowledgeStatsService: KnowledgeStatsService,
    private readonly ragService: RagService,
  ) {}

  /**
   * Replace all chunks for a knowledge item using a **multi-document transaction** when the deployment
   * supports it (MongoDB replica set). **deleteMany** + **insertMany** commit atomically: if inserts fail,
   * chunk deletes roll back so a `ready` row cannot temporarily (or permanently) lose all embeddings.
   *
   * On MongoDB standalone (typical laptop install), transactions are rejected — we log once and fall back
   * to legacy delete-then-insert (same risk as before). **Production should use a replica set** (e.g. Atlas).
   *
   * Empty `chunks`: deletes all rows for the item and commits (same as before; callers must keep status consistent).
   */
  async replaceChunksForKnowledgeItem(
    botId: Types.ObjectId,
    knowledgeBaseItemId: Types.ObjectId,
    sourceType: KnowledgeBaseItemSourceType,
    chunks: ChunkInput[],
  ): Promise<number> {
    try {
      return await this.replaceChunksForKnowledgeItemInTransaction(botId, knowledgeBaseItemId, sourceType, chunks);
    } catch (e) {
      if (isMongoTransactionUnsupportedError(e)) {
        this.log.warn(
          `replaceChunksForKnowledgeItem: transactions unavailable (${e instanceof Error ? e.message : String(e)}); using non-transactional path. Use a MongoDB replica set in production.`,
        );
        return this.replaceChunksForKnowledgeItemWithoutTransaction(botId, knowledgeBaseItemId, sourceType, chunks);
      }
      throw e;
    }
  }

  private async replaceChunksForKnowledgeItemInTransaction(
    botId: Types.ObjectId,
    knowledgeBaseItemId: Types.ObjectId,
    sourceType: KnowledgeBaseItemSourceType,
    chunks: ChunkInput[],
  ): Promise<number> {
    const session = await this.chunkModel.db.startSession();
    session.startTransaction();
    try {
      await this.chunkModel.deleteMany({ knowledgeBaseItemId }).session(session);
      if (chunks.length === 0) {
        await session.commitTransaction();
        return 0;
      }
      const docs = this.buildChunkDocs(botId, knowledgeBaseItemId, sourceType, chunks);
      await this.chunkModel.insertMany(docs, { session });
      await session.commitTransaction();
      return docs.length;
    } catch (err) {
      await session.abortTransaction().catch(() => undefined);
      throw err;
    } finally {
      session.endSession();
    }
  }

  /**
   * Legacy path: delete then insert without atomicity. Only used when the server cannot run transactions.
   */
  private async replaceChunksForKnowledgeItemWithoutTransaction(
    botId: Types.ObjectId,
    knowledgeBaseItemId: Types.ObjectId,
    sourceType: KnowledgeBaseItemSourceType,
    chunks: ChunkInput[],
  ): Promise<number> {
    await this.chunkModel.deleteMany({ knowledgeBaseItemId });
    if (chunks.length === 0) return 0;
    const docs = this.buildChunkDocs(botId, knowledgeBaseItemId, sourceType, chunks);
    await this.chunkModel.insertMany(docs);
    return docs.length;
  }

  private buildChunkDocs(
    botId: Types.ObjectId,
    knowledgeBaseItemId: Types.ObjectId,
    sourceType: KnowledgeBaseItemSourceType,
    chunks: ChunkInput[],
  ): Record<string, unknown>[] {
    return chunks.map((c) => ({
      botId,
      knowledgeBaseItemId,
      sourceType,
      text: c.text,
      embedding: c.embedding,
      chunkIndex: c.chunkIndex,
      ...(c.heading != null && { heading: c.heading }),
      ...(c.sectionPath != null && { sectionPath: c.sectionPath }),
      ...(c.tokenCount != null && { tokenCount: c.tokenCount }),
    }));
  }

  /**
   * Deletes + inserts chunks for scope training; on any persist error, marks **this** KB item `failed`
   * (so it is not `ready` with missing chunks) and returns `failed` so callers skip finalization.
   */
  private async replaceChunksForScopeItemOrMarkFailed(
    botId: Types.ObjectId,
    knowledgeBaseItemId: Types.ObjectId,
    sourceType: KnowledgeBaseItemSourceType,
    chunks: ChunkInput[],
    trainingErrorCode: string,
  ): Promise<number | 'failed'> {
    try {
      return await this.replaceChunksForKnowledgeItem(botId, knowledgeBaseItemId, sourceType, chunks);
    } catch {
      await this.knowledgeBaseItemAccess.setKnowledgeItemStatusById(knowledgeBaseItemId, 'failed', {
        errorMessage: trainingErrorCode,
      });
      return 'failed';
    }
  }

  async removeChunksForKnowledgeItem(knowledgeBaseItemId: Types.ObjectId): Promise<number> {
    const result = await this.chunkModel.deleteMany({ knowledgeBaseItemId });
    return result.deletedCount ?? 0;
  }

  async removeChunksForKnowledgeItems(knowledgeBaseItemIds: Types.ObjectId[]): Promise<number> {
    if (knowledgeBaseItemIds.length === 0) return 0;
    const result = await this.chunkModel.deleteMany({
      knowledgeBaseItemId: { $in: knowledgeBaseItemIds },
    });
    return result.deletedCount ?? 0;
  }

  /**
   * Replace document KnowledgeBaseChunks for a document (resolves KnowledgeBaseItem by documentId).
   */
  async replaceDocumentKnowledgeChunks(
    botId: string,
    documentId: string,
    chunksWithEmbeddings: Array<{ text: string; embedding: number[] }>,
  ): Promise<number> {
    const kbStale = await this.knowledgeBaseItemAccess.findDocumentLinkedKbStaleFields(botId, documentId);
    if (!kbStale) return 0;
    const botOid = new Types.ObjectId(botId);
    const itemOid = kbStale._id;
    const chunks: ChunkInput[] = chunksWithEmbeddings.map((c, i) => ({
      text: c.text,
      embedding: c.embedding,
      chunkIndex: i,
    }));
    const n = await this.replaceChunksForKnowledgeItem(botOid, itemOid, 'document', chunks);
    await this.knowledgeStatsService.recalculateKnowledgeStatsForBot(botId);
    return n;
  }

  /**
   * Ensure document KnowledgeBaseItem has no stale chunks (e.g. when ingestion fails or produces no chunks).
   */
  async removeDocumentKnowledgeChunksForDocument(botId: string, documentId: string): Promise<number> {
    const item = await this.knowledgeBaseItemAccess.findKnowledgeItemByDocumentId(botId, documentId);
    if (!item) return 0;
    return this.removeChunksForKnowledgeItem(item._id);
  }

  /**
   * For each FAQ KnowledgeBaseItem, create or update a single KnowledgeBaseChunk.
   * Skips embedding when the item already has one chunk with matching text (contentHash unchanged).
   */
  async replaceFaqKnowledgeChunksForBot(botId: string, apiKeyOverride?: string): Promise<{ updated: number; skipped: number }> {
    const key = apiKeyOverride ?? (await this.getBotApiKeyOverride(botId));
    const items = await this.knowledgeBaseItemAccess.findKnowledgeItemsForBot(botId, {
      sourceType: 'faq',
      activeOnly: false,
      statuses: ['processing'],
      scopeTrainingExtractionOnly: true,
    });
    let updated = 0;
    let skipped = 0;
    const botOid = new Types.ObjectId(botId);

    for (const item of items) {
      const it = item as {
        _id: Types.ObjectId;
        content?: string;
        contentHash?: string;
        lastContentUpdatedAt?: Date;
        updatedAt?: Date;
      };
      const snapshot: SnapshotForFinalize = {
        contentHash: String(it.contentHash ?? ''),
        lastContentUpdatedAt: it.lastContentUpdatedAt ?? it.updatedAt ?? null,
      };
      const latest = await this.knowledgeBaseItemAccess.findKnowledgeItemByIdLean(it._id);
      if (String((latest as { trainingError?: string })?.trainingError ?? '').trim() === PLAN_LIMIT_BOT_KB_TOTAL_CODE) {
        await this.removeChunksForKnowledgeItem(it._id);
        await this.knowledgeBaseItemAccess.setKnowledgeItemStatusById(it._id, 'failed', {
          errorMessage: PLAN_LIMIT_BOT_KB_TOTAL_CODE,
        });
        continue;
      }
      if (!canFinalizeKnowledgeItemTraining(latest, snapshot)) {
        await this.knowledgeBaseItemAccess.requeueStaleProcessingItemNow(it._id);
        continue;
      }
      const content = (latest?.content ?? it.content ?? '').trim();
      if (!content) {
        await this.removeChunksForKnowledgeItem(it._id);
        await this.knowledgeBaseItemAccess.setKnowledgeItemStatusById(it._id, 'failed', {
          errorMessage: 'faq_empty_content',
        });
        continue;
      }
      const existing = await this.chunkModel.find({ knowledgeBaseItemId: it._id }).sort({ chunkIndex: 1 }).lean();
      if (existing.length === 1 && (existing[0] as { text?: string }).text === content) {
        const post = await this.knowledgeBaseItemAccess.findKnowledgeItemByIdLean(it._id);
        if (canFinalizeKnowledgeItemTraining(post, snapshot)) {
          await this.knowledgeBaseItemAccess.setKnowledgeItemStatusById(it._id, 'ready');
          skipped++;
        } else {
          await this.knowledgeBaseItemAccess.requeueStaleProcessingItemNow(it._id);
        }
        continue;
      }
      let embedding: number[];
      try {
        embedding = await this.ragService.embedText(content, key);
      } catch {
        await this.removeChunksForKnowledgeItem(it._id);
        await this.knowledgeBaseItemAccess.setKnowledgeItemStatusById(it._id, 'failed', {
          errorMessage: 'faq_embedding_api_failed',
        });
        continue;
      }
      if (!embedding?.length) {
        await this.knowledgeBaseItemAccess.setKnowledgeItemStatusById(it._id, 'failed', {
          errorMessage: 'faq_empty_embedding',
        });
        continue;
      }
      const afterEmbed = await this.knowledgeBaseItemAccess.findKnowledgeItemByIdLean(it._id);
      if (!canFinalizeKnowledgeItemTraining(afterEmbed, snapshot)) {
        await this.knowledgeBaseItemAccess.requeueStaleProcessingItemNow(it._id);
        continue;
      }
      const persisted = await this.replaceChunksForScopeItemOrMarkFailed(
        botOid,
        it._id,
        'faq',
        [{ text: content, embedding, chunkIndex: 0 }],
        'faq_chunk_persist_failed',
      );
      if (persisted === 'failed') {
        continue;
      }
      const preReady = await this.knowledgeBaseItemAccess.findKnowledgeItemByIdLean(it._id);
      if (canFinalizeKnowledgeItemTraining(preReady, snapshot)) {
        await this.knowledgeBaseItemAccess.setKnowledgeItemStatusById(it._id, 'ready');
        updated++;
      } else {
        await this.knowledgeBaseItemAccess.requeueStaleProcessingItemNow(it._id);
      }
    }
    await this.knowledgeStatsService.recalculateKnowledgeStatsForBot(botId);
    return { updated, skipped };
  }

  /**
   * Chunk note/snippet items and replace KnowledgeBaseChunks per item.
   */
  async replaceNoteKnowledgeChunksForBot(botId: string, apiKeyOverride?: string): Promise<number> {
    const key = apiKeyOverride ?? (await this.getBotApiKeyOverride(botId));
    const items = await this.knowledgeBaseItemAccess.findKnowledgeItemsForBot(botId, {
      sourceType: 'note',
      activeOnly: false,
      statuses: ['processing'],
      scopeTrainingExtractionOnly: true,
    });
    const botOid = new Types.ObjectId(botId);
    let total = 0;
    for (const noteItem of items) {
      const it = noteItem as {
        _id: Types.ObjectId;
        content?: string;
        contentHash?: string;
        lastContentUpdatedAt?: Date;
        updatedAt?: Date;
      };
      const snapshot: SnapshotForFinalize = {
        contentHash: String(it.contentHash ?? ''),
        lastContentUpdatedAt: it.lastContentUpdatedAt ?? it.updatedAt ?? null,
      };
      const latestRow = await this.knowledgeBaseItemAccess.findKnowledgeItemByIdLean(it._id);
      if (String((latestRow as { trainingError?: string })?.trainingError ?? '').trim() === PLAN_LIMIT_BOT_KB_TOTAL_CODE) {
        await this.removeChunksForKnowledgeItem(it._id);
        await this.knowledgeBaseItemAccess.setKnowledgeItemStatusById(it._id, 'failed', {
          errorMessage: PLAN_LIMIT_BOT_KB_TOTAL_CODE,
        });
        continue;
      }
      if (!canFinalizeKnowledgeItemTraining(latestRow, snapshot)) {
        await this.knowledgeBaseItemAccess.requeueStaleProcessingItemNow(it._id);
        continue;
      }
      const content = String(latestRow?.content ?? it.content ?? '').trim();
      if (!content) {
        await this.removeChunksForKnowledgeItem(it._id);
        await this.knowledgeBaseItemAccess.setKnowledgeItemStatusById(it._id, 'failed', {
          errorMessage: 'note_empty_content',
        });
        continue;
      }
      const chunkTexts = chunkDocumentText(content).slice(0, MAX_NOTE_CHUNKS);
      if (chunkTexts.length === 0) {
        await this.removeChunksForKnowledgeItem(it._id);
        await this.knowledgeBaseItemAccess.setKnowledgeItemStatusById(it._id, 'failed', {
          errorMessage: 'note_no_chunkable_text',
        });
        continue;
      }
      const embeddings: number[][] = [];
      for (let i = 0; i < chunkTexts.length; i += MAX_EMBED_BATCH) {
        const batch = chunkTexts.slice(i, i + MAX_EMBED_BATCH);
        const batchEmbeds = await this.ragService.embedTexts(batch, key);
        embeddings.push(...batchEmbeds);
      }
      const chunks: ChunkInput[] = chunkTexts.slice(0, embeddings.length).map((text, i) => ({
        text,
        embedding: embeddings[i] ?? [],
        chunkIndex: i,
      }));
      const valid = chunks.filter((c) => c.embedding.length > 0);
      const afterEmbed = await this.knowledgeBaseItemAccess.findKnowledgeItemByIdLean(it._id);
      if (!canFinalizeKnowledgeItemTraining(afterEmbed, snapshot)) {
        await this.knowledgeBaseItemAccess.requeueStaleProcessingItemNow(it._id);
        continue;
      }
      const n = await this.replaceChunksForScopeItemOrMarkFailed(botOid, it._id, 'note', valid, 'note_chunk_persist_failed');
      if (n === 'failed') {
        continue;
      }
      const preReady = await this.knowledgeBaseItemAccess.findKnowledgeItemByIdLean(it._id);
      if (n > 0 && canFinalizeKnowledgeItemTraining(preReady, snapshot)) {
        await this.knowledgeBaseItemAccess.setKnowledgeItemStatusById(it._id, 'ready');
      } else if (n === 0) {
        await this.knowledgeBaseItemAccess.setKnowledgeItemStatusById(it._id, 'failed', {
          errorMessage: 'note_no_chunks_persisted',
        });
      } else {
        await this.knowledgeBaseItemAccess.requeueStaleProcessingItemNow(it._id);
      }
      total += n;
    }
    await this.knowledgeStatsService.recalculateKnowledgeStatsForBot(botId);
    return total;
  }

  /**
   * One embedding chunk per spreadsheet table (full table text in `content`).
   */
  async replaceTableKnowledgeChunksForBot(botId: string, apiKeyOverride?: string): Promise<{ updated: number; skipped: number }> {
    const key = apiKeyOverride ?? (await this.getBotApiKeyOverride(botId));
    const items = await this.knowledgeBaseItemAccess.findKnowledgeItemsForBot(botId, {
      sourceType: 'table',
      activeOnly: false,
      statuses: ['processing'],
      scopeTrainingExtractionOnly: true,
      tableGridReadyForScopeEmbedding: true,
    });
    const botOid = new Types.ObjectId(botId);
    let updated = 0;
    let skipped = 0;
    for (const item of items) {
      const it = item as {
        _id: Types.ObjectId;
        content?: string;
        contentHash?: string;
        lastContentUpdatedAt?: Date;
        updatedAt?: Date;
      };
      const snapshot: SnapshotForFinalize = {
        contentHash: String(it.contentHash ?? ''),
        lastContentUpdatedAt: it.lastContentUpdatedAt ?? it.updatedAt ?? null,
      };
      const latestRow = await this.knowledgeBaseItemAccess.findKnowledgeItemByIdLean(it._id);
      if (String((latestRow as { trainingError?: string })?.trainingError ?? '').trim() === PLAN_LIMIT_BOT_KB_TOTAL_CODE) {
        await this.removeChunksForKnowledgeItem(it._id);
        await this.knowledgeBaseItemAccess.setKnowledgeItemStatusById(it._id, 'failed', {
          errorMessage: PLAN_LIMIT_BOT_KB_TOTAL_CODE,
        });
        continue;
      }
      if (!canFinalizeKnowledgeItemTraining(latestRow, snapshot)) {
        await this.knowledgeBaseItemAccess.requeueStaleProcessingItemNow(it._id);
        continue;
      }
      const content = String(latestRow?.content ?? it.content ?? '').trim();
      if (!content) {
        await this.removeChunksForKnowledgeItem(it._id);
        await this.knowledgeBaseItemAccess.setKnowledgeItemStatusById(it._id, 'failed', {
          errorMessage: 'table_empty_content',
        });
        continue;
      }
      const existing = await this.chunkModel.find({ knowledgeBaseItemId: it._id }).sort({ chunkIndex: 1 }).lean();
      if (existing.length === 1 && (existing[0] as { text?: string }).text === content) {
        const post = await this.knowledgeBaseItemAccess.findKnowledgeItemByIdLean(it._id);
        if (canFinalizeKnowledgeItemTraining(post, snapshot)) {
          await this.knowledgeBaseItemAccess.setKnowledgeItemStatusById(it._id, 'ready');
          skipped++;
        } else {
          await this.knowledgeBaseItemAccess.requeueStaleProcessingItemNow(it._id);
        }
        continue;
      }
      let embedding: number[];
      try {
        embedding = await this.ragService.embedText(content, key);
      } catch {
        await this.removeChunksForKnowledgeItem(it._id);
        await this.knowledgeBaseItemAccess.setKnowledgeItemStatusById(it._id, 'failed', {
          errorMessage: 'table_embedding_api_failed',
        });
        continue;
      }
      if (!embedding?.length) {
        await this.knowledgeBaseItemAccess.setKnowledgeItemStatusById(it._id, 'failed', {
          errorMessage: 'table_empty_embedding',
        });
        continue;
      }
      const afterEmbed = await this.knowledgeBaseItemAccess.findKnowledgeItemByIdLean(it._id);
      if (!canFinalizeKnowledgeItemTraining(afterEmbed, snapshot)) {
        await this.knowledgeBaseItemAccess.requeueStaleProcessingItemNow(it._id);
        continue;
      }
      const persisted = await this.replaceChunksForScopeItemOrMarkFailed(
        botOid,
        it._id,
        'table',
        [{ text: content, embedding, chunkIndex: 0 }],
        'table_chunk_persist_failed',
      );
      if (persisted === 'failed') {
        continue;
      }
      const preReady = await this.knowledgeBaseItemAccess.findKnowledgeItemByIdLean(it._id);
      if (canFinalizeKnowledgeItemTraining(preReady, snapshot)) {
        await this.knowledgeBaseItemAccess.setKnowledgeItemStatusById(it._id, 'ready');
        updated++;
      } else {
        await this.knowledgeBaseItemAccess.requeueStaleProcessingItemNow(it._id);
      }
    }
    await this.knowledgeStatsService.recalculateKnowledgeStatsForBot(botId);
    return { updated, skipped };
  }

  /**
   * Embed one chunk per active suggestion with scoped content (`status: processing` from worker).
   *
   * **Product model (see {@link KnowledgeBaseItemService.upsertSuggestionKnowledgeItemsForBot}):**
   * - Chips with **scoped information** (`ExampleQuestionDoc.context`) get a `KnowledgeBaseItem` and are trained into retrieval.
   * - **Label-only** chips do **not** get a persisted suggestion row — they are UI-only; sync hard-deletes any
   *   previous scoped row when context is cleared.
   *
   * This worker path still treats “scoped text became empty on an existing row” as **ready without embedding**
   * (no chunk): that is a narrow edge case; normal label-only flow never creates the row in the first place.
   */
  async replaceSuggestionKnowledgeChunksForBot(botId: string, apiKeyOverride?: string): Promise<{ updated: number; skipped: number }> {
    const key = apiKeyOverride ?? (await this.getBotApiKeyOverride(botId));
    const items = await this.knowledgeBaseItemAccess.findKnowledgeItemsForBot(botId, {
      sourceType: 'suggestion',
      activeOnly: false,
      statuses: ['processing'],
      scopeTrainingExtractionOnly: true,
    });
    const botOid = new Types.ObjectId(botId);
    let updated = 0;
    let skipped = 0;
    for (const item of items) {
      const it = item as {
        _id: Types.ObjectId;
        content?: string;
        title?: string;
        contentHash?: string;
        lastContentUpdatedAt?: Date;
        updatedAt?: Date;
        suggestionMeta?: { chipText?: string; scopedInformation?: string };
      };
      const snapshot: SnapshotForFinalize = {
        contentHash: String(it.contentHash ?? ''),
        lastContentUpdatedAt: it.lastContentUpdatedAt ?? it.updatedAt ?? null,
      };
      const latestRow = await this.knowledgeBaseItemAccess.findKnowledgeItemByIdLean(it._id);
      if (String((latestRow as { trainingError?: string })?.trainingError ?? '').trim() === PLAN_LIMIT_BOT_KB_TOTAL_CODE) {
        await this.removeChunksForKnowledgeItem(it._id);
        await this.knowledgeBaseItemAccess.setKnowledgeItemStatusById(it._id, 'failed', {
          errorMessage: PLAN_LIMIT_BOT_KB_TOTAL_CODE,
        });
        continue;
      }
      if (!canFinalizeKnowledgeItemTraining(latestRow, snapshot)) {
        await this.knowledgeBaseItemAccess.requeueStaleProcessingItemNow(it._id);
        continue;
      }
      const scoped = String(latestRow?.suggestionMeta?.scopedInformation ?? it.suggestionMeta?.scopedInformation ?? '').trim();
      if (!scoped) {
        await this.removeChunksForKnowledgeItem(it._id);
        /** Label-only: nothing to embed; surface as canonical `ready` (no empty jobs). */
        await this.knowledgeBaseItemAccess.setKnowledgeItemStatusById(it._id, 'ready');
        skipped++;
        continue;
      }
      const content = String(latestRow?.content ?? it.content ?? '').trim();
      if (!content) {
        await this.removeChunksForKnowledgeItem(it._id);
        await this.knowledgeBaseItemAccess.setKnowledgeItemStatusById(it._id, 'failed', {
          errorMessage: 'suggestion_empty_content',
        });
        continue;
      }
      const chip = (
        latestRow?.suggestionMeta?.chipText ??
        it.suggestionMeta?.chipText ??
        latestRow?.title ??
        it.title ??
        ''
      )
        .trim() || 'Suggestion';
      const existing = await this.chunkModel.find({ knowledgeBaseItemId: it._id }).sort({ chunkIndex: 1 }).lean();
      if (existing.length === 1 && (existing[0] as { text?: string }).text === content) {
        const post = await this.knowledgeBaseItemAccess.findKnowledgeItemByIdLean(it._id);
        if (canFinalizeKnowledgeItemTraining(post, snapshot)) {
          await this.knowledgeBaseItemAccess.setKnowledgeItemStatusById(it._id, 'ready');
          skipped++;
        } else {
          await this.knowledgeBaseItemAccess.requeueStaleProcessingItemNow(it._id);
        }
        continue;
      }
      let embedding: number[];
      try {
        embedding = await this.ragService.embedText(content, key);
      } catch {
        await this.removeChunksForKnowledgeItem(it._id);
        await this.knowledgeBaseItemAccess.setKnowledgeItemStatusById(it._id, 'failed', {
          errorMessage: 'suggestion_embedding_api_failed',
        });
        continue;
      }
      if (!embedding?.length) {
        await this.knowledgeBaseItemAccess.setKnowledgeItemStatusById(it._id, 'failed', {
          errorMessage: 'suggestion_empty_embedding',
        });
        continue;
      }
      const afterEmbed = await this.knowledgeBaseItemAccess.findKnowledgeItemByIdLean(it._id);
      if (!canFinalizeKnowledgeItemTraining(afterEmbed, snapshot)) {
        await this.knowledgeBaseItemAccess.requeueStaleProcessingItemNow(it._id);
        continue;
      }
      const persisted = await this.replaceChunksForScopeItemOrMarkFailed(
        botOid,
        it._id,
        'suggestion',
        [{ text: content, embedding, chunkIndex: 0, heading: chip, sectionPath: 'suggestion' }],
        'suggestion_chunk_persist_failed',
      );
      if (persisted === 'failed') {
        continue;
      }
      const preReady = await this.knowledgeBaseItemAccess.findKnowledgeItemByIdLean(it._id);
      if (canFinalizeKnowledgeItemTraining(preReady, snapshot)) {
        await this.knowledgeBaseItemAccess.setKnowledgeItemStatusById(it._id, 'ready');
        updated++;
      } else {
        await this.knowledgeBaseItemAccess.requeueStaleProcessingItemNow(it._id);
      }
    }
    await this.knowledgeStatsService.recalculateKnowledgeStatsForBot(botId);
    return { updated, skipped };
  }

  async findChunksForKnowledgeItem(knowledgeBaseItemId: string) {
    if (!Types.ObjectId.isValid(knowledgeBaseItemId)) return [];
    return this.chunkModel
      .find({ knowledgeBaseItemId: new Types.ObjectId(knowledgeBaseItemId) })
      .sort({ chunkIndex: 1 })
      .lean();
  }

  /** Count KnowledgeBaseChunks for a document (via its KnowledgeBaseItem). */
  async countChunksForDocument(botId: string, documentId: string): Promise<number> {
    const item = await this.knowledgeBaseItemAccess.findKnowledgeItemByDocumentId(botId, documentId);
    if (!item) return 0;
    return this.chunkModel.countDocuments({ knowledgeBaseItemId: item._id });
  }

  /**
   * Chunks stored with a non-empty embedding — required for ingestion "ready" verification and semantic RAG.
   */
  async countChunksWithValidEmbeddingsForDocument(botId: string, documentId: string): Promise<number> {
    const item = await this.knowledgeBaseItemAccess.findKnowledgeItemByDocumentId(botId, documentId);
    if (!item) return 0;
    return this.chunkModel.countDocuments({
      knowledgeBaseItemId: item._id,
      $expr: { $gt: [{ $size: { $ifNull: ['$embedding', []] } }, 0] },
    });
  }

  /** Batch count of active embedded chunks keyed by KnowledgeBaseItem id (documents / KB polling). */
  async countChunksWithValidEmbeddingsByKnowledgeItemIds(itemIds: Types.ObjectId[]): Promise<Map<string, number>> {
    const out = new Map<string, number>();
    if (itemIds.length === 0) return out;
    const rows = await this.chunkModel
      .aggregate<{ _id: Types.ObjectId; count: number }>([
        {
          $match: {
            knowledgeBaseItemId: { $in: itemIds },
            $expr: { $gt: [{ $size: { $ifNull: ['$embedding', []] } }, 0] },
          },
        },
        {
          $group: {
            _id: '$knowledgeBaseItemId',
            count: { $sum: 1 },
          },
        },
      ])
      .exec();
    for (const r of rows) {
      if (r._id) out.set(String(r._id), typeof r.count === 'number' && r.count >= 0 ? r.count : 0);
    }
    return out;
  }

  /** Resolve bot openaiApiKeyOverride for embedding (e.g. FAQ/note). */
  async getBotApiKeyOverride(botId: string): Promise<string | undefined> {
    const bot = await this.botModel.findById(botId).select('openaiApiKeyOverride').lean();
    return (bot as { openaiApiKeyOverride?: string } | null)?.openaiApiKeyOverride;
  }
}
