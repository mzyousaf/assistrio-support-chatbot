import {
  Controller,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { CustomerSessionAuthGuard } from '../auth/customer/customer-session.guard';
import type { RequestUser } from '../auth/shared/request-user.types';
import {
  BOT_DOCUMENT_UPLOAD_EXTENSIONS,
  MAX_BOT_DOCUMENT_UPLOAD_BYTES,
  getBotDocumentExtension,
  isAllowedBotDocumentExtension,
} from '../documents/bot-document-upload.constants';
import { DocumentsService } from '../documents/documents.service';
import { BotsService } from '../bots/bots.service';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { IngestionService } from '../ingestion/ingestion.service';
import { uploadToS3 } from '../lib/s3';
import { WorkspaceBotDocumentsControllerBase } from './shared/workspace-bot-documents.controller.base';

type RequestWithUser = FastifyRequest & { user?: RequestUser };

/**
 * Customer workspace documents — list, upload, patch, delete, bulk-delete, requeue ingest, and
 * {@link WorkspaceBotDocumentsControllerBase.downloadUrl GET :id/download-url} (signed S3 / URL for ready, active uploads).
 */
@Controller('api/customer/bots/:botId/documents')
@UseGuards(CustomerSessionAuthGuard)
export class CustomerDocumentsController extends WorkspaceBotDocumentsControllerBase {
  constructor(
    documentsService: DocumentsService,
    botsService: BotsService,
    workspacesService: WorkspacesService,
    ingestionService: IngestionService,
  ) {
    super(documentsService, botsService, workspacesService, ingestionService);
  }

  /**
   * Customer-safe upload: `multipart/form-data` with a single file field named `file`, optional `title`.
   * Stores the file in private S3, creates a `documents` row (`status: queued`), and enqueues the existing ingestion job.
   */
  @Post()
  async uploadDocument(@Param('botId') botId: string, @Req() req: RequestWithUser) {
    await this.assertBotAccess(botId, req);

    const r = req;
    if (!r.isMultipart()) {
      throw new HttpException(
        { error: 'Expected multipart/form-data with a file field named "file".' },
        HttpStatus.BAD_REQUEST,
      );
    }

    let titleField = '';
    let filePart: { filename: string; mimetype: string; toBuffer: () => Promise<Buffer> } | null = null;

    try {
      for await (const part of r.parts()) {
        if (part.type === 'file') {
          if (part.fieldname !== 'file') {
            throw new HttpException(
              { error: 'Unexpected file field. Use field name "file".' },
              HttpStatus.BAD_REQUEST,
            );
          }
          if (filePart) {
            throw new HttpException({ error: 'Only one file is allowed per request.' }, HttpStatus.BAD_REQUEST);
          }
          filePart = part;
        } else if (part.type === 'field' && part.fieldname === 'title') {
          titleField = String(part.value ?? '').trim();
        }
      }
    } catch (e) {
      if (e instanceof HttpException) throw e;
      const err = e as { statusCode?: number; code?: string; message?: string };
      if (err.statusCode === 413 || String(err.code ?? '').includes('FILE_TOO_LARGE')) {
        throw new HttpException(
          { error: 'File too large', maxBytes: MAX_BOT_DOCUMENT_UPLOAD_BYTES },
          HttpStatus.PAYLOAD_TOO_LARGE,
        );
      }
      const msg = typeof err.message === 'string' ? err.message : '';
      if (/limit|too large/i.test(msg)) {
        throw new HttpException(
          { error: 'File too large', maxBytes: MAX_BOT_DOCUMENT_UPLOAD_BYTES },
          HttpStatus.PAYLOAD_TOO_LARGE,
        );
      }
      throw new HttpException({ error: 'Upload failed' }, HttpStatus.BAD_REQUEST);
    }

    if (!filePart) {
      throw new HttpException(
        { error: 'Missing file. Send multipart field "file".' },
        HttpStatus.BAD_REQUEST,
      );
    }

    const originalName = (filePart.filename || 'document').trim() || 'document';
    const ext = getBotDocumentExtension(originalName);
    if (!ext || !isAllowedBotDocumentExtension(ext)) {
      throw new HttpException(
        {
          error: 'Unsupported file type',
          allowedExtensions: [...BOT_DOCUMENT_UPLOAD_EXTENSIONS].sort(),
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    let buffer: Buffer;
    try {
      buffer = await filePart.toBuffer();
    } catch (e) {
      if (e instanceof HttpException) throw e;
      const err = e as { statusCode?: number; code?: string; message?: string };
      if (err.statusCode === 413 || String(err.code ?? '').includes('FILE_TOO_LARGE')) {
        throw new HttpException(
          { error: 'File too large', maxBytes: MAX_BOT_DOCUMENT_UPLOAD_BYTES },
          HttpStatus.PAYLOAD_TOO_LARGE,
        );
      }
      const msg = typeof err.message === 'string' ? err.message : '';
      if (/limit|too large/i.test(msg)) {
        throw new HttpException(
          { error: 'File too large', maxBytes: MAX_BOT_DOCUMENT_UPLOAD_BYTES },
          HttpStatus.PAYLOAD_TOO_LARGE,
        );
      }
      throw new HttpException({ error: 'Could not read uploaded file' }, HttpStatus.BAD_REQUEST);
    }

    if (!buffer.length) {
      throw new HttpException({ error: 'Empty file' }, HttpStatus.BAD_REQUEST);
    }

    const title = (titleField || originalName).trim() || originalName;
    const contentType =
      filePart.mimetype && filePart.mimetype !== 'application/octet-stream'
        ? filePart.mimetype
        : guessContentType(ext);

    let uploaded: { bucket: string; key: string };
    try {
      const result = await uploadToS3({
        visibility: 'private',
        prefix: `uploads/documents/${botId}`,
        originalName,
        contentType,
        body: buffer,
      });
      uploaded = { bucket: result.bucket, key: result.key };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[customer-documents] S3 upload failed', { botId, msg });
      throw new HttpException(
        { error: 'Document storage is not available. Try again later.' },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const created = await this.documentsService.create({
      botId,
      title,
      sourceType: 'upload',
      fileName: originalName,
      fileType: contentType,
      fileSize: buffer.length,
      status: 'queued',
      storage: 's3',
      s3Bucket: uploaded.bucket,
      s3Key: uploaded.key,
    });

    const docId =
      (created as { _id?: { toString?: () => string } })._id?.toString?.() ??
      String((created as { _id?: unknown })._id);

    await this.ingestionService.createQueuedJob(botId, docId);

    const createdAtRaw = (created as { createdAt?: Date }).createdAt;
    const createdAt =
      createdAtRaw instanceof Date ? createdAtRaw.toISOString() : new Date().toISOString();

    return {
      ok: true as const,
      document: {
        _id: docId,
        botId,
        title,
        sourceType: 'upload',
        status: 'queued',
        fileName: originalName,
        fileType: contentType,
        fileSize: buffer.length,
        active: true,
        createdAt,
      },
      ingestion: { jobStatus: 'queued' as const },
    };
  }
}

function guessContentType(ext: string): string {
  switch (ext.toLowerCase()) {
    case 'pdf':
      return 'application/pdf';
    case 'txt':
      return 'text/plain';
    case 'md':
    case 'markdown':
      return 'text/markdown';
    case 'docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case 'doc':
      return 'application/msword';
    default:
      return 'application/octet-stream';
  }
}
