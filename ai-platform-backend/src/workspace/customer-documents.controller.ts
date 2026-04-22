import {
  Controller,
  HttpException,
  HttpStatus,
  Logger,
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
  MAX_BOT_DOCUMENT_FILES_PER_REQUEST,
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
  private readonly logger = new Logger(CustomerDocumentsController.name);

  constructor(
    documentsService: DocumentsService,
    botsService: BotsService,
    workspacesService: WorkspacesService,
    ingestionService: IngestionService,
  ) {
    super(documentsService, botsService, workspacesService, ingestionService);
  }

  /**
   * Customer-safe upload: `multipart/form-data` with one or more parts named `file` (same field repeated),
   * optional text field `title` (only applied when exactly one file is uploaded). Up to
   * {@link MAX_BOT_DOCUMENT_FILES_PER_REQUEST} files per request; each is stored in S3, persisted, and queued for ingest.
   */
  @Post()
  async uploadDocument(@Param('botId') botId: string, @Req() req: RequestWithUser) {
    const t0 = Date.now();
    const userId = req.user?._id != null ? String(req.user._id) : '';
    this.logger.log(
      `[upload] start botId=${botId} userId=${userId || '(none)'} maxBytes=${MAX_BOT_DOCUMENT_UPLOAD_BYTES} maxFiles=${MAX_BOT_DOCUMENT_FILES_PER_REQUEST}`,
    );

    await this.assertBotAccess(botId, req);
    this.logger.log(`[upload] assertBotAccess ok +${Date.now() - t0}ms botId=${botId}`);

    const r = req;
    if (!r.isMultipart()) {
      this.logger.warn(`[upload] reject not multipart +${Date.now() - t0}ms botId=${botId}`);
      throw new HttpException(
        { error: 'Expected multipart/form-data with a file field named "file".' },
        HttpStatus.BAD_REQUEST,
      );
    }

    type ParsedFile = {
      buffer: Buffer;
      originalName: string;
      fileMimetype: string;
      ext: string;
    };

    let titleField = '';
    const parsedFiles: ParsedFile[] = [];

    try {
      this.logger.log(`[upload] multipart parts iterate begin +${Date.now() - t0}ms botId=${botId}`);
      for await (const part of r.parts()) {
        if (part.type === 'file') {
          if (part.fieldname !== 'file') {
            throw new HttpException(
              { error: 'Unexpected file field. Use field name "file".' },
              HttpStatus.BAD_REQUEST,
            );
          }
          if (parsedFiles.length >= MAX_BOT_DOCUMENT_FILES_PER_REQUEST) {
            this.logger.warn(
              `[upload] too many files +${Date.now() - t0}ms botId=${botId} max=${MAX_BOT_DOCUMENT_FILES_PER_REQUEST}`,
            );
            throw new HttpException(
              {
                error: `At most ${MAX_BOT_DOCUMENT_FILES_PER_REQUEST} files per upload.`,
                maxFiles: MAX_BOT_DOCUMENT_FILES_PER_REQUEST,
              },
              HttpStatus.BAD_REQUEST,
            );
          }
          const tBuf = Date.now();
          const buffer = await part.toBuffer();
          this.logger.log(
            `[upload] file part read +${Date.now() - t0}ms botId=${botId} index=${parsedFiles.length} bytes=${buffer.length} readMs=${Date.now() - tBuf}`,
          );
          if (!buffer.length) {
            this.logger.warn(`[upload] skip empty file part +${Date.now() - t0}ms botId=${botId}`);
            continue;
          }
          const originalName = (part.filename || 'document').trim() || 'document';
          const ext = getBotDocumentExtension(originalName);
          if (!ext || !isAllowedBotDocumentExtension(ext)) {
            this.logger.warn(
              `[upload] unsupported extension +${Date.now() - t0}ms botId=${botId} fileName=${originalName} ext=${ext || '(none)'}`,
            );
            throw new HttpException(
              {
                error: 'Unsupported file type',
                allowedExtensions: [...BOT_DOCUMENT_UPLOAD_EXTENSIONS].sort(),
                fileName: originalName,
              },
              HttpStatus.UNPROCESSABLE_ENTITY,
            );
          }
          const fileMimetype =
            part.mimetype && part.mimetype !== 'application/octet-stream' ? part.mimetype : '';
          parsedFiles.push({ buffer, originalName, fileMimetype, ext });
        } else if (part.type === 'field' && part.fieldname === 'title') {
          titleField = String(part.value ?? '').trim();
        }
      }
      this.logger.log(
        `[upload] multipart parts iterate done +${Date.now() - t0}ms botId=${botId} fileCount=${parsedFiles.length}`,
      );
    } catch (e) {
      if (e instanceof HttpException) throw e;
      const err = e as { statusCode?: number; code?: string; message?: string };
      if (err.statusCode === 413 || String(err.code ?? '').includes('FILE_TOO_LARGE')) {
        this.logger.warn(
          `[upload] multipart too large +${Date.now() - t0}ms botId=${botId} code=${String(err.code ?? '')} statusCode=${String(err.statusCode ?? '')}`,
        );
        throw new HttpException(
          { error: 'File too large', maxBytes: MAX_BOT_DOCUMENT_UPLOAD_BYTES },
          HttpStatus.PAYLOAD_TOO_LARGE,
        );
      }
      const msg = typeof err.message === 'string' ? err.message : '';
      if (/limit|too large/i.test(msg)) {
        this.logger.warn(`[upload] multipart size limit +${Date.now() - t0}ms botId=${botId} msg=${msg}`);
        throw new HttpException(
          { error: 'File too large', maxBytes: MAX_BOT_DOCUMENT_UPLOAD_BYTES },
          HttpStatus.PAYLOAD_TOO_LARGE,
        );
      }
      this.logger.error(
        `[upload] multipart parse failed +${Date.now() - t0}ms botId=${botId} err=${e instanceof Error ? e.stack ?? e.message : String(e)}`,
      );
      throw new HttpException({ error: 'Upload failed' }, HttpStatus.BAD_REQUEST);
    }

    if (parsedFiles.length === 0) {
      this.logger.warn(`[upload] missing or empty files +${Date.now() - t0}ms botId=${botId}`);
      throw new HttpException(
        { error: 'Missing file. Send one or more multipart fields named "file".' },
        HttpStatus.BAD_REQUEST,
      );
    }

    const documentsOut: Array<{
      _id: string;
      botId: string;
      title: string;
      sourceType: string;
      status: string;
      fileName: string;
      fileType: string;
      fileSize: number;
      active: boolean;
      createdAt: string;
    }> = [];

    for (let i = 0; i < parsedFiles.length; i++) {
      const pf = parsedFiles[i]!;
      const title =
        parsedFiles.length === 1
          ? (titleField || pf.originalName).trim() || pf.originalName
          : pf.originalName.trim() || pf.originalName;
      const contentType = pf.fileMimetype ? pf.fileMimetype : guessContentType(pf.ext);

      let uploaded: { bucket: string; key: string };
      try {
        const tS3 = Date.now();
        this.logger.log(
          `[upload] s3 begin +${Date.now() - t0}ms botId=${botId} idx=${i} bytes=${pf.buffer.length} contentType=${contentType}`,
        );
        const result = await uploadToS3({
          visibility: 'private',
          prefix: `uploads/documents/${botId}`,
          originalName: pf.originalName,
          contentType,
          body: pf.buffer,
        });
        uploaded = { bucket: result.bucket, key: result.key };
        this.logger.log(
          `[upload] s3 ok +${Date.now() - t0}ms botId=${botId} idx=${i} s3Ms=${Date.now() - tS3} key=${uploaded.key}`,
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        this.logger.error(`[upload] s3 failed +${Date.now() - t0}ms botId=${botId} idx=${i} msg=${msg}`);
        throw new HttpException(
          { error: 'Document storage is not available. Try again later.' },
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      const tDb = Date.now();
      const created = await this.documentsService.create({
        botId,
        title,
        sourceType: 'upload',
        fileName: pf.originalName,
        fileType: contentType,
        fileSize: pf.buffer.length,
        status: 'queued',
        storage: 's3',
        s3Bucket: uploaded.bucket,
        s3Key: uploaded.key,
      });
      this.logger.log(`[upload] db.create ok +${Date.now() - t0}ms botId=${botId} idx=${i} dbMs=${Date.now() - tDb}`);

      const docId =
        (created as { _id?: { toString?: () => string } })._id?.toString?.() ??
        String((created as { _id?: unknown })._id);

      const tJob = Date.now();
      await this.ingestionService.createQueuedJob(botId, docId);
      this.logger.log(
        `[upload] ingestion job queued +${Date.now() - t0}ms botId=${botId} idx=${i} docId=${docId} jobMs=${Date.now() - tJob}`,
      );

      const createdAtRaw = (created as { createdAt?: Date }).createdAt;
      const createdAt =
        createdAtRaw instanceof Date ? createdAtRaw.toISOString() : new Date().toISOString();

      documentsOut.push({
        _id: docId,
        botId,
        title,
        sourceType: 'upload',
        status: 'queued',
        fileName: pf.originalName,
        fileType: contentType,
        fileSize: pf.buffer.length,
        active: true,
        createdAt,
      });
    }

    this.logger.log(
      `[upload] done +${Date.now() - t0}ms botId=${botId} count=${documentsOut.length} totalBytes=${parsedFiles.reduce((s, p) => s + p.buffer.length, 0)}`,
    );

    return {
      ok: true as const,
      documents: documentsOut,
      ingestions: documentsOut.map(() => ({ jobStatus: 'queued' as const })),
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
