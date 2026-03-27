import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { KnowledgeBaseChunk } from '../models/knowledge-base-chunk.schema';
import type { KnowledgeBaseItemSourceType } from '../models/knowledge-base-item.schema';
import { Bot } from '../models';
import { KnowledgeBaseItemService } from './knowledge-base-item.service';
import { RagService } from '../rag/rag.service';
import { chunkDocumentText } from './chunking.helper';

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

@Injectable()
export class KnowledgeBaseChunkService {
  constructor(
    @InjectModel(KnowledgeBaseChunk.name) private readonly chunkModel: Model<KnowledgeBaseChunk>,
    @InjectModel(Bot.name) private readonly botModel: Model<Bot>,
    private readonly knowledgeBaseItemService: KnowledgeBaseItemService,
    private readonly ragService: RagService,
  ) { }

  /**
   * Replace all chunks for a knowledge item. Deletes existing and inserts the new set.
   */
  async replaceChunksForKnowledgeItem(
    botId: Types.ObjectId,
    knowledgeBaseItemId: Types.ObjectId,
    sourceType: KnowledgeBaseItemSourceType,
    chunks: ChunkInput[],
  ): Promise<number> {
    await this.chunkModel.deleteMany({ knowledgeBaseItemId });
    if (chunks.length === 0) return 0;
    const docs = chunks.map((c) => ({
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
    await this.chunkModel.insertMany(docs);
    return docs.length;
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
    const item = await this.knowledgeBaseItemService.findKnowledgeItemByDocumentId(botId, documentId);
    if (!item) return 0;
    const botOid = new Types.ObjectId(botId);
    const itemOid = item._id;
    const chunks: ChunkInput[] = chunksWithEmbeddings.map((c, i) => ({
      text: c.text,
      embedding: c.embedding,
      chunkIndex: i,
    }));
    return this.replaceChunksForKnowledgeItem(botOid, itemOid, 'document', chunks);
  }

  /**
   * Ensure document KnowledgeBaseItem has no stale chunks (e.g. when ingestion fails or produces no chunks).
   */
  async removeDocumentKnowledgeChunksForDocument(botId: string, documentId: string): Promise<number> {
    const item = await this.knowledgeBaseItemService.findKnowledgeItemByDocumentId(botId, documentId);
    if (!item) return 0;
    return this.removeChunksForKnowledgeItem(item._id);
  }

  /**
   * For each FAQ KnowledgeBaseItem, create or update a single KnowledgeBaseChunk.
   * Skips embedding when the item already has one chunk with matching text (contentHash unchanged).
   */
  async replaceFaqKnowledgeChunksForBot(botId: string, apiKeyOverride?: string): Promise<{ updated: number; skipped: number }> {
    const key = apiKeyOverride ?? (await this.getBotApiKeyOverride(botId));
    const allFaqItems = await this.knowledgeBaseItemService.findKnowledgeItemsForBot(botId, {
      sourceType: 'faq',
      activeOnly: false,
    });
    const inactiveFaqItems = allFaqItems.filter((i) => (i as { active?: boolean }).active === false);
    for (const it of inactiveFaqItems) {
      await this.removeChunksForKnowledgeItem((it as { _id: Types.ObjectId })._id);
    }
    const items = await this.knowledgeBaseItemService.findKnowledgeItemsForBot(botId, {
      sourceType: 'faq',
      activeOnly: true,
    });
    let updated = 0;
    let skipped = 0;
    const botOid = new Types.ObjectId(botId);

    for (const item of items) {
      const it = item as { _id: Types.ObjectId; content?: string };
      const content = (it.content ?? '').trim();
      if (!content) {
        await this.removeChunksForKnowledgeItem(it._id);
        continue;
      }
      const existing = await this.chunkModel.find({ knowledgeBaseItemId: it._id }).sort({ chunkIndex: 1 }).lean();
      if (existing.length === 1 && (existing[0] as { text?: string }).text === content) {
        skipped++;
        continue;
      }
      let embedding: number[];
      try {
        embedding = await this.ragService.embedText(content, key);
      } catch {
        await this.removeChunksForKnowledgeItem(it._id);
        continue;
      }
      if (!embedding?.length) continue;
      await this.replaceChunksForKnowledgeItem(botOid, it._id, 'faq', [
        { text: content, embedding, chunkIndex: 0 },
      ]);
      updated++;
    }
    return { updated, skipped };
  }

  /**
   * Chunk the note content and replace KnowledgeBaseChunks for the bot's note item.
   * If note is empty or inactive, removes chunks.
   */
  async replaceNoteKnowledgeChunksForBot(botId: string, apiKeyOverride?: string): Promise<number> {
    const key = apiKeyOverride ?? (await this.getBotApiKeyOverride(botId));
    const allNoteItems = await this.knowledgeBaseItemService.findKnowledgeItemsForBot(botId, {
      sourceType: 'note',
      activeOnly: false,
    });
    const inactiveNoteItems = allNoteItems.filter((i) => (i as { active?: boolean }).active === false);
    for (const it of inactiveNoteItems) {
      await this.removeChunksForKnowledgeItem((it as { _id: Types.ObjectId })._id);
    }
    const items = await this.knowledgeBaseItemService.findKnowledgeItemsForBot(botId, {
      sourceType: 'note',
      activeOnly: true,
    });
    const noteItem = items[0] as { _id: Types.ObjectId; content?: string } | undefined;
    if (!noteItem) return 0;
    const content = (noteItem.content ?? '').trim();
    if (!content) {
      return this.removeChunksForKnowledgeItem(noteItem._id);
    }
    const chunkTexts = chunkDocumentText(content).slice(0, MAX_NOTE_CHUNKS);
    if (chunkTexts.length === 0) {
      return this.removeChunksForKnowledgeItem(noteItem._id);
    }
    const botOid = new Types.ObjectId(botId);
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
    return this.replaceChunksForKnowledgeItem(botOid, noteItem._id, 'note', valid);
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
    const item = await this.knowledgeBaseItemService.findKnowledgeItemByDocumentId(botId, documentId);
    if (!item) return 0;
    return this.chunkModel.countDocuments({ knowledgeBaseItemId: item._id });
  }

  /** Resolve bot openaiApiKeyOverride for embedding (e.g. FAQ/note). */
  async getBotApiKeyOverride(botId: string): Promise<string | undefined> {
    const bot = await this.botModel.findById(botId).select('openaiApiKeyOverride').lean();
    return (bot as { openaiApiKeyOverride?: string } | null)?.openaiApiKeyOverride;
  }
}
