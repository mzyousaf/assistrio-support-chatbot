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
    return this.documentModel.find({ botId }).sort({ createdAt: -1 }).lean();
  }

  async findOneByBotAndDoc(botId: string, docId: string) {
    return this.documentModel.findOne({ _id: docId, botId }).lean();
  }

  async getHealthSummary(botId: string) {
    const [docsTotal, docsQueued, docsProcessing, docsReady, docsFailed, lastReadyDoc, lastFailedDocRaw] =
      await Promise.all([
        this.documentModel.countDocuments({ botId }),
        this.documentModel.countDocuments({ botId, status: 'queued' }),
        this.documentModel.countDocuments({ botId, status: 'processing' }),
        this.documentModel.countDocuments({ botId, status: 'ready' }),
        this.documentModel.countDocuments({ botId, status: 'failed' }),
        this.documentModel
          .findOne({ botId, status: 'ready' })
          .sort({ ingestedAt: -1, createdAt: -1 })
          .select({ ingestedAt: 1, createdAt: 1 })
          .lean(),
        this.documentModel
          .findOne({ botId, status: 'failed' })
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
    await this.documentModel.deleteOne({ _id: docId, botId });
    await this.chunkModel.deleteMany({ documentId: docId, botId });
  }

  async setQueued(botId: string, docId: string) {
    await this.documentModel.updateOne(
      { _id: docId, botId },
      { $set: { status: 'queued', error: undefined } },
    );
  }

  async setFailed(botId: string, docId: string, errorMessage: string) {
    await this.documentModel.updateOne(
      { _id: docId, botId },
      { $set: { status: 'failed', error: errorMessage } },
    );
  }

  async countChunksByDocumentId(docId: string): Promise<number> {
    return this.chunkModel.countDocuments({ documentId: new Types.ObjectId(docId) });
  }
}
