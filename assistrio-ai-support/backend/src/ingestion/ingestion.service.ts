import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { DocumentModel, IngestJob } from '../models';
import { KbService } from '../knowledge/kb.service';
import { KnowledgeBaseItemService } from '../knowledge/knowledge-base-item.service';
import { KnowledgeBaseChunkService } from '../knowledge/knowledge-base-chunk.service';
import { RagService } from '../rag/rag.service';
import { getObjectBody } from '../lib/s3';
import type { IngestionRunResult } from './ingestion-runner.types';

/** Max document chunks to embed and store (KB-only). */
const MAX_DOC_CHUNKS = 50;
/** Max total chars across chunks for one document. */
const MAX_EMBED_TOTAL_CHARS = 100_000;
const EMBED_BATCH_SIZE = 25;

@Injectable()
export class IngestionService {
  constructor(
    private readonly config: ConfigService,
    private readonly kbService: KbService,
    private readonly ragService: RagService,
    private readonly knowledgeBaseItemService: KnowledgeBaseItemService,
    private readonly knowledgeBaseChunkService: KnowledgeBaseChunkService,
    @InjectModel(DocumentModel.name) private readonly documentModel: Model<DocumentModel>,
    @InjectModel(IngestJob.name) private readonly ingestJobModel: Model<IngestJob>,
  ) { }

  async runJob(secret: string, _jobId?: string): Promise<{ ok: boolean }> {
    const expected = this.config.get<string>('jobRunnerSecret');
    if (secret !== expected) {
      throw new Error('Invalid job runner secret');
    }
    return { ok: true };
  }

  async deleteJobsByDocId(botId: string, docId: string): Promise<void> {
    if (!Types.ObjectId.isValid(botId) || !Types.ObjectId.isValid(docId)) return;
    await this.ingestJobModel.deleteMany({
      botId: new Types.ObjectId(botId),
      docId: new Types.ObjectId(docId),
    });
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
    await this.knowledgeBaseItemService.setDocumentKnowledgeItemStatus(
      String(job.botId),
      String(job.docId),
      { status: 'processing' },
    );

    let textToChunk: string;

    if (document.sourceType === 'manual' && document.text?.trim()) {
      textToChunk = document.text.trim();
    } else {
      const doc = document as { s3Bucket?: string; s3Key?: string; url?: string; fileName?: string; fileType?: string; text?: string };
      // Reuse previously extracted text when present (retries/re-embeds). Skips slow PDF/DOC/DOCX extraction.
      if (doc.text?.trim()) {
        textToChunk = doc.text.trim();
      } else {
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
            await fs.unlink(filePath).catch(() => { });
          }
        } else if (doc.url) {
          const urlStr = String(doc.url).trim();
          if (urlStr.startsWith('http://') || urlStr.startsWith('https://')) {
            const res = await fetch(urlStr, { redirect: 'follow' });
            if (!res.ok) throw new Error(`url_fetch_failed: ${res.status}`);
            const buffer = Buffer.from(await res.arrayBuffer());
            const urlPathname = new URL(urlStr).pathname || '';
            const baseName = path.basename(urlPathname) || 'document';
            const ext = this.kbService.getFileExtension(baseName) || path.extname(urlPathname).slice(1) || 'bin';
            fileName = doc.fileName || baseName;
            filePath = path.join(os.tmpdir(), `ingest-${job.docId}-${Date.now()}.${ext}`);
            await fs.writeFile(filePath, buffer);
            try {
              const extractionResult = await this.kbService.extractTextFromUpload({
                filePath,
                fileName,
                fileType: doc.fileType || res.headers.get('content-type') || undefined,
              });
              if (!extractionResult.extracted || !extractionResult.text.trim()) {
                throw new Error(extractionResult.reason || 'extraction_failed');
              }
              textToChunk = extractionResult.text;
            } finally {
              await fs.unlink(filePath).catch(() => { });
            }
          } else {
            const relativePath = urlStr.replace(/^\/+/, '');
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
          }
        } else {
          throw new Error('file_url_missing');
        }

        await this.documentModel.updateOne(
          { _id: document._id },
          { $set: { text: textToChunk } },
        );
        await this.knowledgeBaseItemService.upsertDocumentKnowledgeItem({
          _id: document._id as Types.ObjectId,
          botId: document.botId as Types.ObjectId,
          title: document.title,
          status: 'queued',
          active: document.active !== false,
          text: textToChunk,
          fileName: document.fileName,
          fileType: document.fileType,
          fileSize: document.fileSize,
          url: document.url,
          storage: document.storage,
          s3Bucket: (document as { s3Bucket?: string }).s3Bucket,
          s3Key: (document as { s3Key?: string }).s3Key,
          uploadSessionId: (document as { uploadSessionId?: string }).uploadSessionId,
        });
      }
    }

    // Dev/debug: log extracted text length and preview (no secrets; helps diagnose empty chunks).
    const extractedLength = (textToChunk || '').length;
    if (process.env.NODE_ENV !== 'production') {
      const preview = (textToChunk || '').slice(0, 200).replace(/\s+/g, ' ');
      console.log(`[ingestion] processJob docId=${job.docId} extractedTextLength=${extractedLength} preview=${JSON.stringify(preview)}`);
    } else {
      console.log(`[ingestion] processJob docId=${job.docId} extractedTextLength=${extractedLength}`);
    }
    if (!textToChunk?.trim()) {
      throw new Error('extraction_empty_text');
    }

    const rawChunks = this.kbService.chunkText(textToChunk);
    const limitedChunks = rawChunks.slice(0, MAX_DOC_CHUNKS);
    const totalChars = limitedChunks.reduce((sum, c) => sum + c.length, 0);
    console.log(`[ingestion] processJob docId=${job.docId} chunkCount=${limitedChunks.length} totalChars=${totalChars}`);

    if (limitedChunks.length === 0) {
      await this.knowledgeBaseChunkService.removeDocumentKnowledgeChunksForDocument(
        String(document.botId),
        String(document._id),
      );
      await this.documentModel.updateOne(
        { _id: document._id, botId: document.botId },
        { $set: { status: 'failed', error: 'no_chunks_created' } },
      );
      await this.knowledgeBaseItemService.setDocumentKnowledgeItemStatus(
        String(document.botId),
        String(document._id),
        { status: 'failed' },
      );
      await this.ingestJobModel.updateOne(
        { _id: job._id },
        { $set: { status: 'failed', error: 'no_chunks_created', finishedAt: new Date() } },
      );
      throw new Error('no_chunks_created');
    }

    if (totalChars > MAX_EMBED_TOTAL_CHARS) {
      await this.knowledgeBaseChunkService.removeDocumentKnowledgeChunksForDocument(
        String(document.botId),
        String(document._id),
      );
      await this.documentModel.updateOne(
        { _id: document._id, botId: document.botId },
        { $set: { status: 'failed', error: 'too_large_for_embedding' } },
      );
      await this.knowledgeBaseItemService.setDocumentKnowledgeItemStatus(
        String(document.botId),
        String(document._id),
        { status: 'failed' },
      );
      await this.ingestJobModel.updateOne(
        { _id: job._id },
        { $set: { status: 'failed', error: 'too_large_for_embedding', finishedAt: new Date() } },
      );
      throw new Error('too_large_for_embedding');
    }

    const apiKeyOverride = await this.knowledgeBaseChunkService.getBotApiKeyOverride(String(document.botId));
    const embeddings: number[][] = [];
    for (let i = 0; i < limitedChunks.length; i += EMBED_BATCH_SIZE) {
      const batch = limitedChunks.slice(i, i + EMBED_BATCH_SIZE);
      const batchEmbeds = await this.ragService.embedTexts(batch, apiKeyOverride);
      embeddings.push(...batchEmbeds);
    }
    const chunksForKb = limitedChunks.slice(0, embeddings.length).map((text, i) => ({
      text,
      embedding: embeddings[i] ?? [],
    })).filter((c) => c.embedding.length > 0);

    if (chunksForKb.length === 0) {
      const reason = 'no_embeddings_saved';
      await this.knowledgeBaseChunkService.removeDocumentKnowledgeChunksForDocument(
        String(document.botId),
        String(document._id),
      );
      await this.documentModel.updateOne(
        { _id: document._id, botId: document.botId },
        { $set: { status: 'failed', error: reason } },
      );
      await this.knowledgeBaseItemService.setDocumentKnowledgeItemStatus(
        String(document.botId),
        String(document._id),
        { status: 'failed' },
      );
      await this.ingestJobModel.updateOne(
        { _id: job._id },
        { $set: { status: 'failed', error: reason, finishedAt: new Date() } },
      );
      throw new Error(reason);
    }

    await this.knowledgeBaseChunkService.replaceDocumentKnowledgeChunks(
      String(document.botId),
      String(document._id),
      chunksForKb,
    );
    const chunksCreated = chunksForKb.length;
    console.log(`[ingestion] docId=${document._id} botId=${document.botId} kbChunksCreated=${chunksCreated}`);

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
    await this.knowledgeBaseItemService.upsertDocumentKnowledgeItem({
      _id: document._id as Types.ObjectId,
      botId: document.botId as Types.ObjectId,
      title: document.title,
      status: 'ready',
      active: document.active !== false,
      text: textToChunk,
      fileName: document.fileName,
      fileType: document.fileType,
      fileSize: document.fileSize,
      url: document.url,
      storage: document.storage,
      s3Bucket: (document as { s3Bucket?: string }).s3Bucket,
      s3Key: (document as { s3Key?: string }).s3Key,
      uploadSessionId: (document as { uploadSessionId?: string }).uploadSessionId,
    });

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
   * Reset jobs (and their documents) stuck in "processing" for too long.
   * Use when the process crashed or timed out so they can be retried.
   */
  async resetStuckJobs(): Promise<number> {
    const timeoutMinutes = Math.max(1, Number(process.env.INGESTION_STUCK_TIMEOUT_MINUTES) || 15);
    const cutoff = new Date(Date.now() - timeoutMinutes * 60 * 1000);
    const stuck = await this.ingestJobModel.find({
      status: 'processing',
      startedAt: { $lt: cutoff },
    });
    for (const job of stuck) {
      await this.ingestJobModel.updateOne(
        { _id: job._id },
        { $set: { status: 'queued', error: undefined, startedAt: undefined } },
      );
      await this.documentModel.updateOne(
        { _id: job.docId, botId: job.botId },
        { $set: { status: 'queued', error: undefined } },
      );
    }
    if (stuck.length > 0) {
      console.log(`[ingestion] reset ${stuck.length} stuck job(s) (processing > ${timeoutMinutes} min)`);
    }
    return stuck.length;
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
    await this.knowledgeBaseItemService.setDocumentKnowledgeItemStatus(
      String(job.botId),
      String(job.docId),
      { status: 'failed' },
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
        await this.knowledgeBaseItemService.setDocumentKnowledgeItemStatus(
          String(job.botId),
          String(job.docId),
          { status: 'failed' },
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
