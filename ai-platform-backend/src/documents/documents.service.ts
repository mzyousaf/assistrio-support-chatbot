import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Chunk, DocumentModel } from '../models';

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
    @InjectModel(Chunk.name) private readonly chunkModel: Model<Chunk>,
  ) {}

  async create(data: CreateDocumentDto) {
    const doc = await this.documentModel.create({
      ...data,
      botId: new Types.ObjectId(data.botId),
      status: data.status ?? 'queued',
    });
    return doc.toObject ? doc.toObject() : (doc as unknown as Record<string, unknown>);
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
    await this.documentModel.findByIdAndDelete(id);
    return { deleted: id };
  }

  async removeByBotAndDoc(botId: string, docId: string) {
    if (!Types.ObjectId.isValid(botId) || !Types.ObjectId.isValid(docId)) return;
    const botOid = new Types.ObjectId(botId);
    const docOid = new Types.ObjectId(docId);
    await this.documentModel.deleteOne({ _id: docOid, botId: botOid });
    await this.chunkModel.deleteMany({ documentId: docOid, botId: botOid });
  }

  async removeByBotAndDocIds(botId: string, docIds: string[]): Promise<number> {
    if (!Types.ObjectId.isValid(botId) || !Array.isArray(docIds) || docIds.length === 0) return 0;
    const botOid = new Types.ObjectId(botId);
    const validIds = docIds
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));
    if (validIds.length === 0) return 0;
    await this.chunkModel.deleteMany({ botId: botOid, documentId: { $in: validIds } });
    const result = await this.documentModel.deleteMany({ _id: { $in: validIds }, botId: botOid });
    return result.deletedCount ?? 0;
  }

  async setActive(botId: string, docId: string, active: boolean): Promise<void> {
    if (!Types.ObjectId.isValid(botId) || !Types.ObjectId.isValid(docId)) return;
    await this.documentModel.updateOne(
      { _id: new Types.ObjectId(docId), botId: new Types.ObjectId(botId) },
      { $set: { active } },
    );
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
  }

  async setFailed(botId: string, docId: string, errorMessage: string) {
    if (!Types.ObjectId.isValid(botId) || !Types.ObjectId.isValid(docId)) return;
    await this.documentModel.updateOne(
      { _id: new Types.ObjectId(docId), botId: new Types.ObjectId(botId) },
      { $set: { status: 'failed', error: errorMessage } },
    );
  }

  async countChunksByDocumentId(docId: string): Promise<number> {
    return this.chunkModel.countDocuments({ documentId: new Types.ObjectId(docId) });
  }

  /**
   * Verification for RAG ingestion integrity: document status, text length, chunk counts.
   * Use to diagnose "ready but 0 chunks" or "0 chunks with valid embedding".
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
    const [chunkCount, chunksWithValidEmbeddingCount] = await Promise.all([
      this.chunkModel.countDocuments({ documentId: docOid, botId: botOid }),
      this.chunkModel.countDocuments({
        documentId: docOid,
        botId: botOid,
        'embedding.0': { $exists: true },
      }),
    ]);
    const textLength = typeof (doc as { text?: string }).text === 'string' ? (doc as { text: string }).text.length : 0;
    const status = (doc as { status?: string }).status;
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
