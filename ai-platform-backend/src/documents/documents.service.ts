import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { DocumentModel } from '../models';
import { KnowledgeBaseItemService } from '../knowledge/knowledge-base-item.service';
import { KnowledgeBaseChunkService } from '../knowledge/knowledge-base-chunk.service';
import { getSignedGetUrl } from '../lib/s3';

export interface CreateDocumentDto {
  botId: string;
  title: string;
  sourceType: 'upload' | 'url' | 'manual';
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  url?: string;
  status?: string;
  text?: string;
  storage?: string;
  s3Bucket?: string;
  s3Key?: string;
  uploadSessionId?: string;
}

@Injectable()
export class DocumentsService {
  constructor(
    @InjectModel(DocumentModel.name) private readonly documentModel: Model<DocumentModel>,
    private readonly knowledgeBaseItemService: KnowledgeBaseItemService,
    private readonly knowledgeBaseChunkService: KnowledgeBaseChunkService,
  ) {}

  async create(data: CreateDocumentDto) {
    const doc = await this.documentModel.create({
      ...data,
      botId: new Types.ObjectId(data.botId),
      status: data.status ?? 'queued',
    });
    const docObj = doc.toObject ? doc.toObject() : (doc as unknown as Record<string, unknown>);
    await this.knowledgeBaseItemService.upsertDocumentKnowledgeItem({
      _id: (doc as { _id: Types.ObjectId })._id,
      botId: (doc as { botId: Types.ObjectId }).botId,
      title: data.title,
      status: data.status ?? 'queued',
      active: true,
      text: data.text,
      fileName: data.fileName,
      fileType: data.fileType,
      fileSize: data.fileSize,
      url: data.url,
      storage: data.storage,
      s3Bucket: data.s3Bucket,
      s3Key: data.s3Key,
      uploadSessionId: data.uploadSessionId,
    });
    return docObj;
  }

  async findByBot(botId: string) {
    if (!Types.ObjectId.isValid(botId)) return [];
    return this.documentModel
      .find({ botId: new Types.ObjectId(botId) })
      .sort({ createdAt: -1 })
      .lean();
  }

  async countByBot(botId: string): Promise<number> {
    if (!Types.ObjectId.isValid(botId)) return 0;
    return this.documentModel.countDocuments({ botId: new Types.ObjectId(botId) });
  }

  async findByBotPaginated(
    botId: string,
    page: number,
    limit: number,
  ): Promise<{ documents: Array<Record<string, unknown>>; total: number }> {
    if (!Types.ObjectId.isValid(botId)) {
      return { documents: [], total: 0 };
    }
    const botOid = new Types.ObjectId(botId);
    const skip = Math.max(0, (page - 1) * limit);
    const safeLimit = Math.min(100, Math.max(1, limit));
    const [documents, total] = await Promise.all([
      this.documentModel
        .find({ botId: botOid })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit)
        .lean(),
      this.documentModel.countDocuments({ botId: botOid }),
    ]);
    return {
      documents: documents as Array<Record<string, unknown>>,
      total,
    };
  }

  async findOneByBotAndDoc(botId: string, docId: string) {
    if (!Types.ObjectId.isValid(botId) || !Types.ObjectId.isValid(docId)) return null;
    return this.documentModel
      .findOne({ _id: new Types.ObjectId(docId), botId: new Types.ObjectId(botId) })
      .lean();
  }

  /**
   * Public gallery: signed S3 URL or original HTTP URL for a ready, active document owned by the bot.
   * Returns null when the file is not available (manual text-only, missing keys, etc.).
   */
  async resolveFileDownloadUrlForBot(botId: string, documentId: string): Promise<string | null> {
    if (!Types.ObjectId.isValid(botId) || !Types.ObjectId.isValid(documentId)) return null;
    const doc = await this.documentModel
      .findOne({
        _id: new Types.ObjectId(documentId),
        botId: new Types.ObjectId(botId),
        status: 'ready',
        active: { $ne: false },
      })
      .select({ s3Bucket: 1, s3Key: 1, url: 1 })
      .lean();
    if (!doc) return null;
    const row = doc as { s3Bucket?: string; s3Key?: string; url?: string };
    const bucket = typeof row.s3Bucket === 'string' ? row.s3Bucket.trim() : '';
    const key = typeof row.s3Key === 'string' ? row.s3Key.trim() : '';
    if (bucket && key) {
      try {
        return await getSignedGetUrl(bucket, key, 900);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[documents] signed download URL failed', { botId, documentId, msg });
        return null;
      }
    }
    const u = typeof row.url === 'string' ? row.url.trim() : '';
    if (u && /^https?:\/\//i.test(u)) return u;
    return null;
  }

  async getHealthSummary(botId: string) {
    const botOid = Types.ObjectId.isValid(botId) ? new Types.ObjectId(botId) : null;
    if (!botOid) {
      return {
        docsTotal: 0,
        docsQueued: 0,
        docsProcessing: 0,
        docsReady: 0,
        docsFailed: 0,
        lastIngestedAt: undefined,
        lastFailedDoc: undefined,
      };
    }
    const [docsTotal, docsQueued, docsProcessing, docsReady, docsFailed, lastReadyDoc, lastFailedDocRaw] =
      await Promise.all([
        this.documentModel.countDocuments({ botId: botOid }),
        this.documentModel.countDocuments({ botId: botOid, status: 'queued' }),
        this.documentModel.countDocuments({ botId: botOid, status: 'processing' }),
        this.documentModel.countDocuments({ botId: botOid, status: 'ready' }),
        this.documentModel.countDocuments({ botId: botOid, status: 'failed' }),
        this.documentModel
          .findOne({ botId: botOid, status: 'ready' })
          .sort({ ingestedAt: -1, createdAt: -1 })
          .select({ ingestedAt: 1, createdAt: 1 })
          .lean(),
        this.documentModel
          .findOne({ botId: botOid, status: 'failed' })
          .sort({ createdAt: -1 })
          .select({ _id: 1, title: 1, error: 1, createdAt: 1 })
          .lean(),
      ]);
    const lastIngestedAtValue = (lastReadyDoc as { ingestedAt?: Date; createdAt?: Date } | null)?.ingestedAt
      ?? (lastReadyDoc as { createdAt?: Date } | null)?.createdAt;
    const lastFailed = lastFailedDocRaw as { _id: unknown; title?: string; error?: string; createdAt?: Date } | null;
    return {
      docsTotal,
      docsQueued,
      docsProcessing,
      docsReady,
      docsFailed,
      lastIngestedAt: lastIngestedAtValue ? new Date(lastIngestedAtValue).toISOString() : undefined,
      lastFailedDoc: lastFailed
        ? {
            docId: String(lastFailed._id),
            title: String(lastFailed.title ?? ''),
            error: String(lastFailed.error ?? ''),
            updatedAt: lastFailed.createdAt ? new Date(lastFailed.createdAt).toISOString() : undefined,
          }
        : undefined,
    };
  }

  async remove(id: string) {
    const doc = await this.documentModel.findById(id).select('botId').lean();
    if (doc) {
      const botId = String((doc as { botId: Types.ObjectId }).botId);
      await this.knowledgeBaseItemService.deactivateByDocumentIds(botId, [new Types.ObjectId(id)]);
      await this.knowledgeBaseChunkService.removeDocumentKnowledgeChunksForDocument(botId, id);
    }
    await this.documentModel.findByIdAndDelete(id);
    return { deleted: id };
  }

  async removeByBotAndDoc(botId: string, docId: string) {
    if (!Types.ObjectId.isValid(botId) || !Types.ObjectId.isValid(docId)) return;
    const botOid = new Types.ObjectId(botId);
    const docOid = new Types.ObjectId(docId);
    await this.knowledgeBaseItemService.deactivateByDocumentIds(botId, [docOid]);
    await this.knowledgeBaseChunkService.removeDocumentKnowledgeChunksForDocument(botId, docId);
    await this.documentModel.deleteOne({ _id: docOid, botId: botOid });
  }

  async removeByBotAndDocIds(botId: string, docIds: string[]): Promise<number> {
    if (!Types.ObjectId.isValid(botId) || !Array.isArray(docIds) || docIds.length === 0) return 0;
    const botOid = new Types.ObjectId(botId);
    const validIds = docIds
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));
    if (validIds.length === 0) return 0;
    await this.knowledgeBaseItemService.deactivateByDocumentIds(botId, validIds);
    for (const docId of validIds) {
      await this.knowledgeBaseChunkService.removeDocumentKnowledgeChunksForDocument(botId, docId.toString());
    }
    const result = await this.documentModel.deleteMany({ _id: { $in: validIds }, botId: botOid });
    return result.deletedCount ?? 0;
  }

  async setActive(botId: string, docId: string, active: boolean): Promise<void> {
    if (!Types.ObjectId.isValid(botId) || !Types.ObjectId.isValid(docId)) return;
    await this.documentModel.updateOne(
      { _id: new Types.ObjectId(docId), botId: new Types.ObjectId(botId) },
      { $set: { active } },
    );
    await this.knowledgeBaseItemService.setDocumentKnowledgeItemStatus(botId, docId, { active });
  }

  async findActiveDocumentIds(botId: string): Promise<Types.ObjectId[]> {
    if (!Types.ObjectId.isValid(botId)) return [];
    const docs = await this.documentModel
      .find({ botId: new Types.ObjectId(botId), active: { $ne: false } })
      .select({ _id: 1 })
      .lean();
    return docs.map((d) => (d as { _id: Types.ObjectId })._id);
  }

  async setQueued(botId: string, docId: string) {
    if (!Types.ObjectId.isValid(botId) || !Types.ObjectId.isValid(docId)) return;
    await this.documentModel.updateOne(
      { _id: new Types.ObjectId(docId), botId: new Types.ObjectId(botId) },
      { $set: { status: 'queued', error: undefined } },
    );
    await this.knowledgeBaseItemService.setDocumentKnowledgeItemStatus(botId, docId, { status: 'queued' });
  }

  async setFailed(botId: string, docId: string, errorMessage: string) {
    if (!Types.ObjectId.isValid(botId) || !Types.ObjectId.isValid(docId)) return;
    await this.documentModel.updateOne(
      { _id: new Types.ObjectId(docId), botId: new Types.ObjectId(botId) },
      { $set: { status: 'failed', error: errorMessage } },
    );
    await this.knowledgeBaseItemService.setDocumentKnowledgeItemStatus(botId, docId, { status: 'failed' });
  }

  async countChunksByDocumentId(docId: string): Promise<number> {
    const doc = await this.documentModel.findById(docId).select('botId').lean();
    if (!doc) return 0;
    const botId = String((doc as { botId: Types.ObjectId }).botId);
    return this.knowledgeBaseChunkService.countChunksForDocument(botId, docId);
  }

  /**
   * Verification for ingestion integrity: document status, text length, KB chunk count.
   * Uses KnowledgeBaseChunk (KB-only retrieval).
   */
  async getDocumentIntegrity(
    botId: string,
    docId: string,
  ): Promise<{
    documentId: string;
    status: string | undefined;
    textLength: number;
    chunkCount: number;
    chunksWithValidEmbeddingCount: number;
    ok: boolean;
  } | null> {
    if (!Types.ObjectId.isValid(botId) || !Types.ObjectId.isValid(docId)) return null;
    const botOid = new Types.ObjectId(botId);
    const docOid = new Types.ObjectId(docId);
    const doc = await this.documentModel
      .findOne({ _id: docOid, botId: botOid })
      .select({ status: 1, text: 1 })
      .lean();
    if (!doc) return null;
    const chunkCount = await this.knowledgeBaseChunkService.countChunksForDocument(botId, docId);
    const textLength = typeof (doc as { text?: string }).text === 'string' ? (doc as { text: string }).text.length : 0;
    const status = (doc as { status?: string }).status;
    const chunksWithValidEmbeddingCount = chunkCount; // KB chunks are stored with embeddings
    return {
      documentId: docId,
      status,
      textLength,
      chunkCount,
      chunksWithValidEmbeddingCount,
      ok: status === 'ready' && chunkCount > 0 && chunksWithValidEmbeddingCount > 0,
    };
  }
}
