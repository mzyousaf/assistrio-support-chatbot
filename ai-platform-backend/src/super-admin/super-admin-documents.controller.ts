import {
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { Types } from 'mongoose';
import { BotsService } from '../bots/bots.service';
import { DocumentsService } from '../documents/documents.service';
import { IngestionService } from '../ingestion/ingestion.service';
import { KbService } from '../kb/kb.service';
import { uploadPrivateDoc } from '../lib/s3';
import { SuperAdminGuard } from './super-admin.guard';

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(['txt', 'pdf', 'docx', 'doc', 'md', 'markdown']);
const MIME_BY_EXT: Record<string, Set<string>> = {
  txt: new Set(['text/plain']),
  pdf: new Set(['application/pdf']),
  doc: new Set(['application/msword']),
  docx: new Set([
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/zip',
  ]),
  md: new Set(['text/markdown', 'text/plain']),
  markdown: new Set(['text/markdown', 'text/plain']),
};

function isMimeAllowed(extension: string, mimeType: string): boolean {
  return MIME_BY_EXT[extension]?.has(mimeType) ?? false;
}

async function parseMultipart(req: FastifyRequest): Promise<{ file?: { buffer: Buffer; name: string; mimetype: string; size: number }; title?: string }> {
  const raw = req as FastifyRequest & { isMultipart?: () => boolean; parts?: () => AsyncIterable<{ type: string; fieldname: string; value?: string; filename?: string; mimetype?: string; toBuffer?: () => Promise<Buffer> }> };
  if (!raw.isMultipart?.() || !raw.parts) return {};
  let file: { buffer: Buffer; name: string; mimetype: string; size: number } | undefined;
  let title: string | undefined;
  for await (const part of raw.parts()) {
    if (part.type === 'field' && typeof part.value === 'string') {
      if (part.fieldname === 'title') title = part.value.trim();
    } else if (part.type === 'file' && part.filename && part.toBuffer) {
      const buffer = await part.toBuffer();
      file = { buffer, name: part.filename, mimetype: part.mimetype ?? 'application/octet-stream', size: buffer.length };
    }
  }
  return { file, title };
}

@Controller('api/super-admin/bots')
@UseGuards(SuperAdminGuard)
export class SuperAdminDocumentsController {
  constructor(
    private readonly botsService: BotsService,
    private readonly documentsService: DocumentsService,
    private readonly ingestionService: IngestionService,
    private readonly kbService: KbService,
  ) {}

  @Get(':id/documents')
  async listDocuments(@Param('id') id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new HttpException({ error: 'Invalid id' }, HttpStatus.BAD_REQUEST);
    }
    const bot = await this.botsService.findOne(id);
    if (!bot) {
      throw new HttpException({ error: 'Bot not found' }, HttpStatus.NOT_FOUND);
    }
    const documents = await this.documentsService.findByBot(id);
    return {
      ok: true,
      documents: (documents as Array<Record<string, unknown>>).map((doc) => ({
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
      })),
    };
  }

  /**
   * Single doc upload endpoint: uploadToS3 (private) -> Document (status: queued) -> IngestJob (queued).
   * Runner processes jobs to "ready" and creates chunks. FE must use this path only (not /documents/upload).
   */
  @Post(':id/upload-doc')
  async uploadDoc(@Param('id') id: string, @Req() req: FastifyRequest) {
    if (!Types.ObjectId.isValid(id)) {
      throw new HttpException({ error: 'Invalid id' }, HttpStatus.BAD_REQUEST);
    }
    const bot = await this.botsService.findOne(id);
    if (!bot) {
      throw new HttpException({ error: 'Bot not found' }, HttpStatus.NOT_FOUND);
    }
    const { file, title: titleFromForm } = await parseMultipart(req);
    if (!file) {
      throw new HttpException({ error: 'File is required' }, HttpStatus.BAD_REQUEST);
    }
    const extension = this.kbService.getFileExtension(file.name);
    if (!ALLOWED_EXTENSIONS.has(extension)) {
      throw new HttpException({ error: 'Unsupported file type' }, HttpStatus.BAD_REQUEST);
    }
    if (!isMimeAllowed(extension, file.mimetype)) {
      throw new HttpException({ error: 'Invalid MIME type for file extension' }, HttpStatus.BAD_REQUEST);
    }
    if (file.size <= 0 || file.size > MAX_UPLOAD_BYTES) {
      throw new HttpException({ error: 'File exceeds 15MB limit' }, HttpStatus.BAD_REQUEST);
    }
    const title =
      typeof titleFromForm === 'string' && titleFromForm.length > 0 ? titleFromForm : file.name;

    const result = await uploadPrivateDoc({
      botId: id,
      body: file.buffer,
      originalName: file.name,
      contentType: file.mimetype,
    });

    const document = await this.documentsService.create({
      botId: id,
      title,
      sourceType: 'upload',
      storage: 's3',
      s3Bucket: result.bucket,
      s3Key: result.key,
      fileName: file.name,
      fileType: file.mimetype,
      fileSize: file.size,
      status: 'queued',
    });
    const docId = (document as { _id?: { toString?: () => string } })._id?.toString?.() ?? String((document as { _id?: unknown })._id);

    try {
      const job = await this.ingestionService.createQueuedJob(id, docId);
      const jobId = (job as { _id?: { toString?: () => string } })._id?.toString?.() ?? String((job as { _id?: unknown })._id);
      return {
        ok: true,
        documentId: docId,
        documentStatus: 'queued' as const,
        ingestJobId: jobId,
        ingestJobStatus: 'queued' as const,
        s3Key: result.key,
        originalName: file.name,
      };
    } catch (jobErr) {
      await this.documentsService.setFailed(id, docId, 'job_queue_failed');
      const msg = jobErr instanceof Error ? jobErr.message : String(jobErr);
      throw new HttpException(
        { error: `Failed to queue ingestion: ${msg}` },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
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
    await this.documentsService.removeByBotAndDoc(id, docId);
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
