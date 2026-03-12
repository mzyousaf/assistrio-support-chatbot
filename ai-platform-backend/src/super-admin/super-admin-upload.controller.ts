import {
  Controller,
  HttpException,
  HttpStatus,
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
import { uploadPublic } from '../lib/s3';
import { SuperAdminGuard } from './super-admin.guard';

const IMAGE_MIMES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const IMAGE_MAX_BYTES = 2 * 1024 * 1024; // 2MB

const DOC_EXTENSIONS = new Set(['docx', 'pdf', 'doc', 'md', 'txt']);
const DOC_MIME_BY_EXT: Record<string, Set<string>> = {
  txt: new Set(['text/plain']),
  pdf: new Set(['application/pdf']),
  doc: new Set(['application/msword', 'application/vnd.ms-word', 'application/octet-stream']),
  docx: new Set([
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/zip',
  ]),
  md: new Set(['text/markdown', 'text/x-markdown', 'text/plain', 'application/octet-stream']),
};
const DOC_MAX_BYTES = 5 * 1024 * 1024; // 5MB

function isDocMimeAllowed(extension: string, mimeType: string): boolean {
  return DOC_MIME_BY_EXT[extension]?.has(mimeType) ?? false;
}

type FilePart = { buffer: Buffer; name: string; mimetype: string; size: number };

async function parseMultipart(req: FastifyRequest): Promise<{
  files: FilePart[];
  botId?: string;
}> {
  const raw = req as FastifyRequest & {
    isMultipart?: () => boolean;
    parts?: () => AsyncIterable<{
      type: string;
      fieldname: string;
      value?: string;
      filename?: string;
      mimetype?: string;
      toBuffer?: () => Promise<Buffer>;
    }>;
  };
  if (!raw.isMultipart?.() || !raw.parts) return { files: [] };
  const files: FilePart[] = [];
  let botId: string | undefined;
  for await (const part of raw.parts()) {
    if (part.type === 'field' && typeof part.value === 'string') {
      if (part.fieldname === 'botId') botId = part.value.trim();
    } else if (part.type === 'file' && part.filename && part.toBuffer) {
      const buffer = await part.toBuffer();
      files.push({
        buffer,
        name: part.filename,
        mimetype: part.mimetype ?? 'application/octet-stream',
        size: buffer.length,
      });
    }
  }
  return { files, botId };
}

type ImageResult = { type: 'image'; url: string; key: string; bucket: string; originalName: string };
type DocumentResult = {
  type: 'document';
  url: string;
  key: string;
  bucket: string;
  originalName: string;
  documentId: string;
  documentStatus: string;
  ingestJobId: string;
  ingestJobStatus: string;
};

/**
 * Single upload API: accepts one or more files (images and/or documents). All uploads go to the public bucket.
 * - Images (png, jpeg, webp): upload to uploads/images.
 * - Documents (pdf, doc, docx, txt, md): require botId (one for all docs in the request), upload to uploads/documents/{botId}, create Document + IngestJob per file.
 * Returns { ok, results: [...] }. For a single file, results has one item; frontend can use results[0].
 */
@Controller('api/super-admin/upload')
@UseGuards(SuperAdminGuard)
export class SuperAdminUploadController {
  constructor(
    private readonly botsService: BotsService,
    private readonly documentsService: DocumentsService,
    private readonly ingestionService: IngestionService,
    private readonly kbService: KbService,
  ) {}

  @Post()
  async upload(@Req() req: FastifyRequest) {
    const { files, botId } = await parseMultipart(req);
    if (!files.length) {
      throw new HttpException({ error: 'At least one file is required' }, HttpStatus.BAD_REQUEST);
    }

    const hasDocuments = files.some((f) => !IMAGE_MIMES.has(f.mimetype));
    if (hasDocuments && (!botId || !Types.ObjectId.isValid(botId))) {
      throw new HttpException({ error: 'botId is required when uploading documents' }, HttpStatus.BAD_REQUEST);
    }
    let bot: unknown = null;
    if (botId && Types.ObjectId.isValid(botId)) {
      bot = await this.botsService.findOne(botId);
      if (hasDocuments && !bot) {
        throw new HttpException({ error: 'Bot not found' }, HttpStatus.NOT_FOUND);
      }
    }

    const results: (ImageResult | DocumentResult)[] = [];

    for (const file of files) {
      // Image
      if (IMAGE_MIMES.has(file.mimetype)) {
        if (file.size > IMAGE_MAX_BYTES) {
          throw new HttpException(
            { error: 'file_too_large', message: `Image "${file.name}" must be under 2MB.` },
            HttpStatus.BAD_REQUEST,
          );
        }
        const result = await uploadPublic({
          prefix: 'uploads/images',
          body: file.buffer,
          originalName: file.name,
          contentType: file.mimetype,
        });
        results.push({
          type: 'image',
          url: result.url,
          key: result.key,
          bucket: result.bucket,
          originalName: file.name,
        });
        continue;
      }

      // Document
      const extension = this.kbService.getFileExtension(file.name);
      if (!DOC_EXTENSIONS.has(extension)) {
        throw new HttpException(
          { error: 'Unsupported file type', message: `"${file.name}": use image (PNG, JPG, WEBP) or document (DOCX, PDF, DOC, MD, TXT).` },
          HttpStatus.BAD_REQUEST,
        );
      }
      if (!isDocMimeAllowed(extension, file.mimetype)) {
        throw new HttpException({ error: 'Invalid MIME type for file extension', message: file.name }, HttpStatus.BAD_REQUEST);
      }
      if (file.size <= 0 || file.size > DOC_MAX_BYTES) {
        throw new HttpException({ error: 'File exceeds 5MB limit', message: file.name }, HttpStatus.BAD_REQUEST);
      }

      const result = await uploadPublic({
        prefix: `uploads/documents/${botId}`,
        body: file.buffer,
        originalName: file.name,
        contentType: file.mimetype,
      });

      const title = file.name;
      const document = await this.documentsService.create({
        botId: botId!,
        title,
        sourceType: 'upload',
        storage: 's3',
        s3Bucket: result.bucket,
        s3Key: result.key,
        url: result.url,
        fileName: file.name,
        fileType: file.mimetype,
        fileSize: file.size,
        status: 'queued',
      });
      const docId = (document as { _id?: { toString?: () => string } })._id?.toString?.() ?? String((document as { _id?: unknown })._id);

      try {
        const job = await this.ingestionService.createQueuedJob(botId!, docId);
        const jobId = (job as { _id?: { toString?: () => string } })._id?.toString?.() ?? String((job as { _id?: unknown })._id);
        results.push({
          type: 'document',
          url: result.url,
          key: result.key,
          bucket: result.bucket,
          originalName: file.name,
          documentId: docId,
          documentStatus: 'queued',
          ingestJobId: jobId,
          ingestJobStatus: 'queued',
        });
      } catch (jobErr) {
        await this.documentsService.setFailed(botId!, docId, 'job_queue_failed');
        const msg = jobErr instanceof Error ? jobErr.message : String(jobErr);
        throw new HttpException(
          { error: `Failed to queue ingestion for "${file.name}": ${msg}` },
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    }

    return { ok: true, results };
  }
}
