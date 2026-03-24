import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  KnowledgeBaseItem,
  type KnowledgeBaseItemFaqMeta,
  type KnowledgeBaseItemSourceMeta,
} from '../models/knowledge-base-item.schema';
import { buildFaqEmbeddingText, computeEmbeddingInputHash } from './faq-note-embedding.helper';
import * as crypto from 'crypto';

/** Minimal document shape for syncing from DocumentModel. */
export interface DocumentLikeForSync {
  _id: Types.ObjectId;
  botId: Types.ObjectId;
  title: string;
  status?: string;
  active?: boolean;
  text?: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  url?: string;
  storage?: string;
  s3Bucket?: string;
  s3Key?: string;
  uploadSessionId?: string;
}

function contentHash(input: string): string {
  return crypto.createHash('sha256').update(input || '', 'utf8').digest('hex').slice(0, 32);
}

@Injectable()
export class KnowledgeBaseItemService {
  constructor(
    @InjectModel(KnowledgeBaseItem.name) private readonly itemModel: Model<KnowledgeBaseItem>,
  ) {}

  /**
   * Create or update a KnowledgeBaseItem for a document. Uses documentId for matching.
   * Sets status to queued when content changed; keeps ready if unchanged.
   */
  async upsertDocumentKnowledgeItem(doc: DocumentLikeForSync): Promise<{ id: string; created: boolean }> {
    const botId = doc.botId as Types.ObjectId;
    const docId = doc._id as Types.ObjectId;
    const content = (doc.text ?? '').trim();
    const hash = contentHash(doc.title + '\n' + content);

    const sourceMeta: KnowledgeBaseItemSourceMeta = {};
    if (doc.fileName != null) sourceMeta.fileName = doc.fileName;
    if (doc.fileType != null) sourceMeta.fileType = doc.fileType;
    if (doc.fileSize != null) sourceMeta.fileSize = doc.fileSize;
    if (doc.url != null) sourceMeta.url = doc.url;
    if (doc.storage != null) sourceMeta.storage = doc.storage;
    if (doc.s3Bucket != null) sourceMeta.s3Bucket = doc.s3Bucket;
    if (doc.s3Key != null) sourceMeta.s3Key = doc.s3Key;
    if (doc.uploadSessionId != null) sourceMeta.uploadSessionId = doc.uploadSessionId;

    const existing = await this.itemModel
      .findOne({ botId, documentId: docId, sourceType: 'document' })
      .select('_id contentHash status active')
      .lean();

    const active = doc.active !== false;
    const status = (doc.status === 'ready' ? 'ready' : doc.status === 'failed' ? 'failed' : doc.status === 'processing' ? 'processing' : 'queued') as 'queued' | 'processing' | 'ready' | 'failed';

    if (existing) {
      const sameHash = (existing as { contentHash?: string }).contentHash === hash;
      const nextStatus = sameHash ? status : 'queued';
      await this.itemModel.updateOne(
        { _id: (existing as { _id: Types.ObjectId })._id },
        {
          $set: {
            title: doc.title,
            content,
            rawContent: content || undefined,
            contentHash: hash,
            status: nextStatus,
            active,
            sourceMeta: Object.keys(sourceMeta).length ? sourceMeta : undefined,
            error: undefined,
            processedAt: nextStatus === 'ready' ? new Date() : undefined,
            updatedAt: new Date(),
          },
        },
      );
      return { id: (existing as { _id: Types.ObjectId })._id.toString(), created: false };
    }

    const created = await this.itemModel.create({
      botId,
      documentId: docId,
      title: doc.title,
      sourceType: 'document',
      status: status === 'ready' ? 'ready' : 'queued',
      active,
      content,
      rawContent: content || undefined,
      contentHash: hash,
      sourceMeta: Object.keys(sourceMeta).length ? sourceMeta : undefined,
      processedAt: status === 'ready' ? new Date() : undefined,
    });
    return { id: (created as { _id: Types.ObjectId })._id.toString(), created: true };
  }

  /**
   * Sync all FAQs for a bot to KnowledgeBaseItems. Matches by botId + sourceType='faq' + faqMeta.faqIndex.
   * Deactivates items whose faqIndex is no longer in the current list.
   */
  async upsertFaqKnowledgeItemsForBot(
    botId: string,
    faqs: Array<{ question: string; answer: string; active?: boolean }>,
  ): Promise<{ upserted: number; deactivated: number }> {
    const botOid = new Types.ObjectId(botId);
    const existingItems = await this.itemModel
      .find({ botId: botOid, sourceType: 'faq' })
      .select('_id faqMeta')
      .lean();

    const byIndex = new Map<number, { _id: Types.ObjectId }>();
    for (const item of existingItems) {
      const meta = (item as { faqMeta?: { faqIndex?: number } }).faqMeta;
      if (meta?.faqIndex != null) byIndex.set(meta.faqIndex, { _id: (item as { _id: Types.ObjectId })._id });
    }

    let upserted = 0;
    for (let i = 0; i < faqs.length; i++) {
      const faq = faqs[i];
      const question = (faq.question ?? '').trim();
      const answer = (faq.answer ?? '').trim();
      const active = faq.active !== false;
      const title = question || `FAQ ${i + 1}`;
      const content = `Q: ${question}\nA: ${answer}`;
      const inputForHash = buildFaqEmbeddingText(question, answer);
      const hash = computeEmbeddingInputHash(inputForHash);

      const faqMeta: KnowledgeBaseItemFaqMeta = { question, answer, faqIndex: i };

      const existing = byIndex.get(i);
      if (existing) {
        const current = await this.itemModel.findById(existing._id).select('contentHash').lean();
        const sameHash = (current as { contentHash?: string } | null)?.contentHash === hash;
        await this.itemModel.updateOne(
          { _id: existing._id },
          {
            $set: {
              title,
              content,
              contentHash: hash,
              faqMeta,
              status: active ? (sameHash ? 'ready' : 'queued') : 'ready',
              active,
              updatedAt: new Date(),
            },
          },
        );
        upserted++;
        byIndex.delete(i);
        continue;
      }

      await this.itemModel.create({
        botId: botOid,
        title,
        sourceType: 'faq',
        status: active ? 'queued' : 'ready',
        active,
        content,
        contentHash: hash,
        faqMeta,
      });
      upserted++;
    }

    const deactivated = await this.deactivateMissingFaqKnowledgeItemsForBot(botId, faqs.length);
    return { upserted, deactivated };
  }

  /**
   * Deactivate KnowledgeBaseItems for FAQs that no longer exist at the given indices (by faqIndex >= faqCount).
   */
  async deactivateMissingFaqKnowledgeItemsForBot(botId: string, faqCount: number): Promise<number> {
    const botOid = new Types.ObjectId(botId);
    const result = await this.itemModel.updateMany(
      { botId: botOid, sourceType: 'faq', 'faqMeta.faqIndex': { $gte: faqCount } },
      { $set: { active: false, updatedAt: new Date() } },
    );
    return result.modifiedCount ?? 0;
  }

  /**
   * One note KnowledgeBaseItem per bot. Create or update when knowledgeDescription has content; deactivate when cleared.
   */
  async upsertNoteKnowledgeItemForBot(botId: string, knowledgeDescription: string): Promise<{ id: string; created: boolean; active: boolean }> {
    const botOid = new Types.ObjectId(botId);
    const content = (knowledgeDescription ?? '').trim();
    const hasContent = content.length > 0;
    const hash = contentHash(content);
    const title = 'Knowledge Notes';

    const existing = await this.itemModel
      .findOne({ botId: botOid, sourceType: 'note' })
      .select('_id contentHash active')
      .lean();

    if (existing) {
      const sameHash = (existing as { contentHash?: string }).contentHash === hash;
      await this.itemModel.updateOne(
        { _id: (existing as { _id: Types.ObjectId })._id },
        {
          $set: {
            title,
            content,
            contentHash: hash,
            noteMeta: { kind: 'general_note' },
            status: sameHash && hasContent ? 'ready' : hasContent ? 'queued' : 'ready',
            active: hasContent,
            updatedAt: new Date(),
          },
        },
      );
      return {
        id: (existing as { _id: Types.ObjectId })._id.toString(),
        created: false,
        active: hasContent,
      };
    }

    const created = await this.itemModel.create({
      botId: botOid,
      title,
      sourceType: 'note',
      status: hasContent ? 'queued' : 'ready',
      active: hasContent,
      content,
      contentHash: hash,
      noteMeta: { kind: 'general_note' },
    });
    return {
      id: (created as { _id: Types.ObjectId })._id.toString(),
      created: true,
      active: hasContent,
    };
  }

  /**
   * Deactivate the single note KnowledgeBaseItem for a bot (e.g. when knowledgeDescription is cleared).
   */
  async deactivateNoteKnowledgeItemsForBot(botId: string): Promise<number> {
    const result = await this.itemModel.updateMany(
      { botId: new Types.ObjectId(botId), sourceType: 'note' },
      { $set: { active: false, updatedAt: new Date() } },
    );
    return result.modifiedCount ?? 0;
  }

  async findKnowledgeItemsForBot(
    botId: string,
    options?: { sourceType?: 'document' | 'faq' | 'note' | 'url' | 'html'; activeOnly?: boolean },
  ) {
    const filter: Record<string, unknown> = { botId: new Types.ObjectId(botId) };
    if (options?.sourceType) filter.sourceType = options.sourceType;
    if (options?.activeOnly !== false) filter.active = true;
    return this.itemModel.find(filter).sort({ createdAt: -1 }).lean();
  }

  /** Get FAQ list for a bot from KB (for admin/chat display). */
  async getFaqsForBot(
    botId: string,
    options?: { includeInactive?: boolean },
  ): Promise<Array<{ question: string; answer: string; active?: boolean }>> {
    const includeInactive = options?.includeInactive === true;
    const items = await this.itemModel
      .find({
        botId: new Types.ObjectId(botId),
        sourceType: 'faq',
        ...(includeInactive ? {} : { active: true }),
      })
      .select(includeInactive ? 'faqMeta active' : 'faqMeta')
      .sort({ 'faqMeta.faqIndex': 1 })
      .lean();
    return items.map((it) => {
      const meta = (it as { faqMeta?: { question?: string; answer?: string }; active?: boolean }).faqMeta;
      return {
        question: String(meta?.question ?? '').trim(),
        answer: String(meta?.answer ?? '').trim(),
        active: includeInactive ? (it as { active?: boolean }).active !== false : true,
      };
    });
  }

  /** Get note content for a bot from KB (for admin/chat display). */
  async getNoteContentForBot(botId: string): Promise<string> {
    const item = await this.itemModel
      .findOne({ botId: new Types.ObjectId(botId), sourceType: 'note', active: true })
      .select('content')
      .lean();
    const content = (item as { content?: string } | null)?.content;
    return typeof content === 'string' ? content.trim() : '';
  }

  /** KB-based status for admin (replaces legacy embedding job status). */
  async getKnowledgeStatusForBot(botId: string): Promise<{ faqItemCount: number; noteContentLength: number }> {
    const [faqs, noteContent] = await Promise.all([
      this.getFaqsForBot(botId),
      this.getNoteContentForBot(botId),
    ]);
    return { faqItemCount: faqs.length, noteContentLength: noteContent.length };
  }

  async findKnowledgeItemById(id: string): Promise<KnowledgeBaseItem | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    return this.itemModel.findById(new Types.ObjectId(id)).lean();
  }

  /** Find the document-linked KnowledgeBaseItem for a given document (for chunk sync). */
  async findKnowledgeItemByDocumentId(botId: string, documentId: string): Promise<{ _id: Types.ObjectId } | null> {
    if (!Types.ObjectId.isValid(botId) || !Types.ObjectId.isValid(documentId)) return null;
    const item = await this.itemModel
      .findOne({
        botId: new Types.ObjectId(botId),
        documentId: new Types.ObjectId(documentId),
        sourceType: 'document',
      })
      .select('_id')
      .lean();
    return item as { _id: Types.ObjectId } | null;
  }

  /**
   * Update status/active for the document-linked item (e.g. when document is set active/failed/queued).
   */
  async setDocumentKnowledgeItemStatus(
    botId: string,
    documentId: string,
    updates: { status?: 'queued' | 'processing' | 'ready' | 'failed'; active?: boolean },
  ): Promise<boolean> {
    if (!Types.ObjectId.isValid(botId) || !Types.ObjectId.isValid(documentId)) return false;
    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (updates.status != null) set.status = updates.status;
    if (updates.active != null) set.active = updates.active;
    const result = await this.itemModel.updateOne(
      { botId: new Types.ObjectId(botId), documentId: new Types.ObjectId(documentId), sourceType: 'document' },
      { $set: set },
    );
    return (result.modifiedCount ?? 0) > 0;
  }

  /**
   * Deactivate KnowledgeBaseItems linked to the given document IDs (e.g. when documents are removed).
   */
  async deactivateByDocumentIds(botId: string, documentIds: Types.ObjectId[]): Promise<number> {
    if (documentIds.length === 0) return 0;
    const result = await this.itemModel.updateMany(
      { botId: new Types.ObjectId(botId), documentId: { $in: documentIds }, sourceType: 'document' },
      { $set: { active: false, updatedAt: new Date() } },
    );
    return result.modifiedCount ?? 0;
  }
}
