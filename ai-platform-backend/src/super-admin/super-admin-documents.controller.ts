import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { BotsService } from '../bots/bots.service';
import { DocumentsService } from '../documents/documents.service';
import { IngestionService } from '../ingestion/ingestion.service';
import { getSignedGetUrl } from '../lib/s3';
import { SuperAdminGuard } from './super-admin.guard';

@Controller('api/super-admin/bots')
@UseGuards(SuperAdminGuard)
export class SuperAdminDocumentsController {
  constructor(
    private readonly botsService: BotsService,
    private readonly documentsService: DocumentsService,
    private readonly ingestionService: IngestionService,
  ) {}

  @Get(':id/documents')
  async listDocuments(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    if (!Types.ObjectId.isValid(id)) {
      throw new HttpException({ error: 'Invalid id' }, HttpStatus.BAD_REQUEST);
    }
    const bot = await this.botsService.findOne(id);
    if (!bot) {
      throw new HttpException({ error: 'Bot not found' }, HttpStatus.NOT_FOUND);
    }
    const pageNum = Math.max(1, parseInt(String(page ?? '1'), 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(String(limit ?? '10'), 10) || 10));
    const { documents: rawDocs, total } = await this.documentsService.findByBotPaginated(
      id,
      pageNum,
      limitNum,
    );
    const documents = rawDocs.map((doc) => ({
      _id: String(doc._id),
      title: String(doc.title ?? ''),
      sourceType: String(doc.sourceType ?? ''),
      fileName: doc.fileName ?? undefined,
      fileType: doc.fileType ?? undefined,
      fileSize: doc.fileSize ?? undefined,
      url: doc.url ?? undefined,
      status: doc.status ?? undefined,
      error: doc.error ?? undefined,
      ingestedAt: doc.ingestedAt ? new Date(doc.ingestedAt as Date).toISOString() : undefined,
      hasText: typeof doc.text === 'string' && (doc.text as string).trim().length > 0,
      textLength: typeof doc.text === 'string' ? (doc.text as string).length : 0,
      createdAt: doc.createdAt ? new Date(doc.createdAt as Date).toISOString() : undefined,
      active: (doc as { active?: boolean }).active !== false,
    }));
    const totalPages = Math.ceil(total / limitNum) || 1;
    const health = await this.documentsService.getHealthSummary(id);
    return {
      ok: true,
      documents,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages,
      counts: {
        total: health.docsTotal,
        queued: health.docsQueued,
        processing: health.docsProcessing,
        ready: health.docsReady,
        failed: health.docsFailed,
      },
      lastIngestedAt: health.lastIngestedAt,
      lastFailedDoc: health.lastFailedDoc,
    };
  }

  /**
   * Verification endpoint: document status, text length, chunk count, chunks with valid embeddings.
   * Use to diagnose RAG ingestion (e.g. ready but 0 chunks).
   */
  @Get(':id/documents/:docId/verify')
  async verifyDocument(
    @Param('id') id: string,
    @Param('docId') docId: string,
  ) {
    if (!Types.ObjectId.isValid(id) || !Types.ObjectId.isValid(docId)) {
      throw new HttpException({ error: 'Invalid id' }, HttpStatus.BAD_REQUEST);
    }
    const bot = await this.botsService.findOne(id);
    if (!bot) {
      throw new HttpException({ error: 'Bot not found' }, HttpStatus.NOT_FOUND);
    }
    const integrity = await this.documentsService.getDocumentIntegrity(id, docId);
    if (!integrity) {
      throw new HttpException({ error: 'Document not found' }, HttpStatus.NOT_FOUND);
    }
    const { ok: verified, ...rest } = integrity;
    return { ok: true, verified, ...rest };
  }

  /**
   * Returns a single document's download URL (presigned for S3, or the stored url for url-sourced docs).
   */
  @Get(':id/documents/:docId/download-url')
  async getDocumentDownloadUrl(@Param('id') id: string, @Param('docId') docId: string) {
    if (!Types.ObjectId.isValid(id) || !Types.ObjectId.isValid(docId)) {
      throw new HttpException({ error: 'Invalid id' }, HttpStatus.BAD_REQUEST);
    }
    const bot = await this.botsService.findOne(id);
    if (!bot) {
      throw new HttpException({ error: 'Bot not found' }, HttpStatus.NOT_FOUND);
    }
    const doc = await this.documentsService.findOneByBotAndDoc(id, docId);
    if (!doc) {
      throw new HttpException({ error: 'Document not found' }, HttpStatus.NOT_FOUND);
    }
    const d = doc as Record<string, unknown>;
    let url = d.url as string | undefined;
    if (!url && d.s3Bucket && d.s3Key) {
      try {
        url = await getSignedGetUrl(String(d.s3Bucket), String(d.s3Key), 3600);
      } catch {
        throw new HttpException({ error: 'Download URL unavailable' }, HttpStatus.SERVICE_UNAVAILABLE);
      }
    }
    if (!url) {
      throw new HttpException({ error: 'No download URL for this document' }, HttpStatus.NOT_FOUND);
    }
    return { ok: true, url };
  }

  /**
   * Returns list of document file names with URLs (presigned for S3 uploads) for copy/export.
   */
  @Get(':id/documents/urls-list')
  async getDocumentsUrlsList(@Param('id') id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new HttpException({ error: 'Invalid id' }, HttpStatus.BAD_REQUEST);
    }
    const bot = await this.botsService.findOne(id);
    if (!bot) {
      throw new HttpException({ error: 'Bot not found' }, HttpStatus.NOT_FOUND);
    }
    const documents = await this.documentsService.findByBot(id);
    const items: { fileName: string; url: string }[] = [];
    for (const doc of documents as Array<Record<string, unknown>>) {
      const name = String(doc.fileName ?? doc.title ?? '');
      let url = doc.url as string | undefined;
      if (!url && doc.s3Bucket && doc.s3Key) {
        try {
          url = await getSignedGetUrl(String(doc.s3Bucket), String(doc.s3Key), 3600);
        } catch {
          url = '(URL unavailable)';
        }
      }
      if (!url) url = '(no URL)';
      items.push({ fileName: name, url });
    }
    return { ok: true, items };
  }

  @Post(':id/documents/bulk-delete')
  async bulkDeleteDocuments(
    @Param('id') id: string,
    @Body() body: { docIds?: string[] },
  ) {
    if (!Types.ObjectId.isValid(id)) {
      throw new HttpException({ error: 'Invalid id' }, HttpStatus.BAD_REQUEST);
    }
    const bot = await this.botsService.findOne(id);
    if (!bot) {
      throw new HttpException({ error: 'Bot not found' }, HttpStatus.NOT_FOUND);
    }
    const docIds = Array.isArray(body?.docIds) ? body.docIds : [];
    if (docIds.length === 0) {
      return { ok: true, deleted: 0 };
    }
    for (const docId of docIds) {
      if (Types.ObjectId.isValid(docId)) {
        await this.ingestionService.deleteJobsByDocId(id, docId);
      }
    }
    const deleted = await this.documentsService.removeByBotAndDocIds(id, docIds);
    return { ok: true, deleted };
  }

  @Delete(':id/documents/:docId')
  async deleteDocument(@Param('id') id: string, @Param('docId') docId: string) {
    if (!Types.ObjectId.isValid(id) || !Types.ObjectId.isValid(docId)) {
      throw new HttpException({ error: 'Invalid id' }, HttpStatus.BAD_REQUEST);
    }
    const bot = await this.botsService.findOne(id);
    if (!bot) {
      throw new HttpException({ error: 'Bot not found' }, HttpStatus.NOT_FOUND);
    }
    const existing = await this.documentsService.findOneByBotAndDoc(id, docId);
    if (!existing) {
      throw new HttpException({ error: 'Document not found' }, HttpStatus.NOT_FOUND);
    }
    await this.ingestionService.deleteJobsByDocId(id, docId);
    await this.documentsService.removeByBotAndDoc(id, docId);
    return { ok: true };
  }

  @Patch(':id/documents/:docId')
  async updateDocument(
    @Param('id') id: string,
    @Param('docId') docId: string,
    @Body() body: { active?: boolean },
  ) {
    if (!Types.ObjectId.isValid(id) || !Types.ObjectId.isValid(docId)) {
      throw new HttpException({ error: 'Invalid id' }, HttpStatus.BAD_REQUEST);
    }
    const bot = await this.botsService.findOne(id);
    if (!bot) {
      throw new HttpException({ error: 'Bot not found' }, HttpStatus.NOT_FOUND);
    }
    const existing = await this.documentsService.findOneByBotAndDoc(id, docId);
    if (!existing) {
      throw new HttpException({ error: 'Document not found' }, HttpStatus.NOT_FOUND);
    }
    if (typeof body.active === 'boolean') {
      await this.documentsService.setActive(id, docId, body.active);
    }
    return { ok: true };
  }

  @Post(':id/documents/:docId/embed')
  async embedDocument(@Param('id') id: string, @Param('docId') docId: string) {
    if (!Types.ObjectId.isValid(id) || !Types.ObjectId.isValid(docId)) {
      throw new HttpException({ error: 'Invalid id' }, HttpStatus.BAD_REQUEST);
    }
    const bot = await this.botsService.findOne(id);
    if (!bot) {
      throw new HttpException({ error: 'Bot not found' }, HttpStatus.NOT_FOUND);
    }
    const document = await this.documentsService.findOneByBotAndDoc(id, docId);
    if (!document) {
      throw new HttpException({ error: 'Document not found' }, HttpStatus.NOT_FOUND);
    }
    await this.documentsService.setQueued(id, docId);
    const job = await this.ingestionService.createQueuedJob(id, docId);
    const jobId = (job as { _id?: { toString?: () => string } })._id?.toString?.() ?? String((job as { _id?: unknown })._id);
    return {
      ok: true,
      documentId: docId,
      documentStatus: 'queued' as const,
      ingestJobId: jobId,
      ingestJobStatus: 'queued' as const,
      s3Key: (document as { s3Key?: string }).s3Key ?? '',
      originalName: (document as { fileName?: string }).fileName ?? '',
    };
  }
}
