import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { Chunk, DocumentModel, IngestJob } from '../models';
import { KbService } from '../kb/kb.service';
import { getObjectBody } from '../lib/s3';
import type { IngestionRunResult } from './ingestion-runner.types';

@Injectable()
export class IngestionService {
  constructor(
    private readonly config: ConfigService,
    private readonly kbService: KbService,
    @InjectModel(DocumentModel.name) private readonly documentModel: Model<DocumentModel>,
    @InjectModel(IngestJob.name) private readonly ingestJobModel: Model<IngestJob>,
    @InjectModel(Chunk.name) private readonly chunkModel: Model<Chunk>,
  ) {}

  async runJob(secret: string, _jobId?: string): Promise<{ ok: boolean }> {
    const expected = this.config.get<string>('jobRunnerSecret');
    if (secret !== expected) {
      throw new Error('Invalid job runner secret');
    }
    return { ok: true };
  }

  async createQueuedJob(botId: string, docId: string) {
    const job = await this.ingestJobModel.create({
      botId: new Types.ObjectId(botId),
      docId: new Types.ObjectId(docId),
      status: 'queued',
    });
    return job.toObject ? job.toObject() : (job as unknown as Record<string, unknown>);
  }

  /**
   * Atomically claim one queued job (oldest first). Returns the job doc or null.
   */
  async claimQueuedJob(): Promise<(InstanceType<typeof IngestJob> & { _id: Types.ObjectId; docId: Types.ObjectId; botId: Types.ObjectId }) | null> {
    const startedAt = new Date();
    const job = await this.ingestJobModel.findOneAndUpdate(
      { status: 'queued' },
      { $set: { status: 'processing', startedAt, error: undefined } },
      { sort: { createdAt: 1 }, new: true },
    );
    return job ?? null;
  }

  /**
   * Process a single claimed job: fetch document, extract text, chunk, embed, store chunks, update doc + job status.
   */
  async processJob(
    job: { _id: Types.ObjectId; docId: Types.ObjectId; botId: Types.ObjectId },
  ): Promise<void> {
    const document = await this.documentModel.findOne({
      _id: job.docId,
      botId: job.botId,
    });

    if (!document) {
      throw new Error('document_not_found');
    }

    await this.documentModel.updateOne(
      { _id: job.docId, botId: job.botId },
      { $set: { status: 'processing', error: undefined } },
    );

    let textToChunk: string;

    if (document.sourceType === 'manual' && document.text?.trim()) {
      textToChunk = document.text.trim();
    } else {
      const doc = document as { s3Bucket?: string; s3Key?: string; url?: string; fileName?: string; fileType?: string };
      let filePath: string;
      let fileName: string;

      if (doc.s3Bucket && doc.s3Key) {
        const buffer = await getObjectBody(doc.s3Bucket, doc.s3Key);
        const ext = this.kbService.getFileExtension(doc.fileName || '') || 'bin';
        fileName = doc.fileName || `doc.${ext}`;
        filePath = path.join(os.tmpdir(), `ingest-${job.docId}-${Date.now()}.${ext}`);
        await fs.writeFile(filePath, buffer);
        try {
          const extractionResult = await this.kbService.extractTextFromUpload({
            filePath,
            fileName,
            fileType: doc.fileType || undefined,
          });
          if (!extractionResult.extracted || !extractionResult.text.trim()) {
            throw new Error(extractionResult.reason || 'extraction_failed');
          }
          textToChunk = extractionResult.text;
        } finally {
          await fs.unlink(filePath).catch(() => {});
        }
      } else if (doc.url) {
        const relativePath = String(doc.url).replace(/^\/+/, '');
        filePath = path.join(process.cwd(), 'public', relativePath);
        fileName = doc.fileName || path.basename(relativePath);
        const extractionResult = await this.kbService.extractTextFromUpload({
          filePath,
          fileName,
          fileType: doc.fileType || undefined,
        });
        if (!extractionResult.extracted || !extractionResult.text.trim()) {
          throw new Error(extractionResult.reason || 'extraction_failed');
        }
        textToChunk = extractionResult.text;
      } else {
        throw new Error('file_url_missing');
      }

      await this.documentModel.updateOne(
        { _id: document._id },
        { $set: { text: textToChunk } },
      );
    }

    const chunks = this.kbService.chunkText(textToChunk);

    await this.chunkModel.deleteMany({
      documentId: document._id,
      botId: document.botId,
    });

    const embeddingResult = await this.kbService.embedAndStoreChunks({
      botId: String(document.botId),
      documentId: String(document._id),
      chunks,
    });

    if (!embeddingResult.embedded || embeddingResult.chunkCount <= 0) {
      throw new Error(embeddingResult.reason || 'embedding_failed');
    }

    const finishedAt = new Date();
    await this.documentModel.updateOne(
      { _id: document._id },
      {
        $set: {
          status: 'ready',
          ingestedAt: finishedAt,
          error: undefined,
        },
      },
    );

    await this.ingestJobModel.updateOne(
      { _id: job._id },
      {
        $set: {
          status: 'done',
          finishedAt,
          error: undefined,
        },
      },
    );
  }

  /**
   * Mark a claimed job and its document as failed (e.g. after processJob throws).
   */
  async markJobFailed(
    job: { _id: Types.ObjectId; docId: Types.ObjectId; botId: Types.ObjectId },
    errorMessage: string,
  ): Promise<void> {
    await this.documentModel.updateOne(
      { _id: job.docId, botId: job.botId },
      { $set: { status: 'failed', error: errorMessage } },
    );
    await this.ingestJobModel.updateOne(
      { _id: job._id },
      { $set: { status: 'failed', error: errorMessage, finishedAt: new Date() } },
    );
  }

  async runQueuedIngestionJobs(limit = 3): Promise<IngestionRunResult> {
    const normalizedLimit = Number.isFinite(limit) ? Math.max(1, Math.floor(limit)) : 3;

    let processed = 0;
    let failed = 0;
    const results: IngestionRunResult['results'] = [];

    for (let i = 0; i < normalizedLimit; i++) {
      const job = await this.claimQueuedJob();
      if (!job) break;

      try {
        await this.processJob(job);
        processed += 1;
        results.push({
          jobId: job._id.toString(),
          docId: job.docId.toString(),
          status: 'done',
        });
      } catch (jobError) {
        const errorMessage =
          jobError instanceof Error && jobError.message ? jobError.message : 'ingestion_failed';

        await this.documentModel.updateOne(
          { _id: job.docId, botId: job.botId },
          { $set: { status: 'failed', error: errorMessage } },
        );

        await this.ingestJobModel.updateOne(
          { _id: job._id },
          { $set: { status: 'failed', error: errorMessage, finishedAt: new Date() } },
        );

        failed += 1;
        results.push({
          jobId: job._id.toString(),
          docId: job.docId.toString(),
          status: 'failed',
          error: errorMessage,
        });
      }
    }

    const firstResult = results[0];
    return {
      ok: true,
      processed,
      processedCount: processed,
      failed,
      claimedJobId: firstResult?.jobId,
      finalDocStatus: firstResult
        ? (firstResult.status === 'done' ? 'ready' : 'failed')
        : undefined,
      results,
    };
  }
}
