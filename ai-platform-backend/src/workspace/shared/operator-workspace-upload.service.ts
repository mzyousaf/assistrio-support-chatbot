import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { Types } from 'mongoose';
import type { RequestUser } from '../../auth/shared/request-user.types';
import {
  BOT_DOCUMENT_UPLOAD_EXTENSIONS,
  MAX_BOT_DOCUMENT_UPLOAD_BYTES,
  getBotDocumentExtension,
  isAllowedBotDocumentExtension,
} from '../../documents/bot-document-upload.constants';
import { DocumentsService } from '../../documents/documents.service';
import { BotsService } from '../../bots/bots.service';
import { WorkspacesService } from '../../workspaces/workspaces.service';
import { IngestionService } from '../../ingestion/ingestion.service';
import { uploadPublic, uploadToS3 } from '../../lib/s3';

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const MAX_DOCUMENT_BATCH = 25;

type MultipartFilePart = {
  type: 'file';
  fieldname: string;
  filename: string;
  mimetype: string;
  toBuffer: () => Promise<Buffer>;
};

type RequestWithUser = FastifyRequest & { user?: RequestUser };

@Injectable()
export class OperatorWorkspaceUploadService {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly botsService: BotsService,
    private readonly workspacesService: WorkspacesService,
    private readonly ingestionService: IngestionService,
  ) {}

  private async assertCanAccessWorkspaceBot(req: RequestWithUser, botId: string): Promise<void> {
    const bot = await this.botsService.findOne(botId);
    if (!bot) {
      throw new HttpException({ error: 'Bot not found' }, HttpStatus.NOT_FOUND);
    }
    const uid = req.user?._id != null ? String(req.user._id) : '';
    const ok = await this.workspacesService.canUserAccessWorkspaceBot(
      uid,
      req.user?.role ?? '',
      bot as Record<string, unknown>,
    );
    if (!ok) {
      throw new HttpException({ error: 'Forbidden' }, HttpStatus.FORBIDDEN);
    }
  }

  /**
   * Shared multipart upload for operator UIs (`/api/admin/upload`; customer uploads use bot-scoped routes).
   *
   * - **Avatar / public image:** multipart field `file` only (no `botId`). PNG, JPEG, or WEBP, max 2MB.
   * - **Bot documents:** field `botId` + one or more `file` parts (same extensions as customer upload).
   */
  async processMultipartOperatorUpload(req: RequestWithUser): Promise<Record<string, unknown>> {
    const r = req as RequestWithUser & {
      isMultipart: () => boolean;
      parts: () => AsyncIterable<MultipartFilePart | { type: 'field'; fieldname: string; value: unknown }>;
    };

    if (!r.isMultipart()) {
      throw new HttpException(
        { error: 'Expected multipart/form-data', message: 'Expected multipart/form-data' },
        HttpStatus.BAD_REQUEST,
      );
    }

    let botIdField = '';
    let titleField = '';
    const fileParts: MultipartFilePart[] = [];

    try {
      for await (const part of r.parts()) {
        if (part.type === 'file' && part.fieldname === 'file') {
          fileParts.push(part as MultipartFilePart);
        } else if (part.type === 'field' && part.fieldname === 'botId') {
          botIdField = String((part as { value?: unknown }).value ?? '').trim();
        } else if (part.type === 'field' && part.fieldname === 'title') {
          titleField = String((part as { value?: unknown }).value ?? '').trim();
        }
      }
    } catch (e) {
      if (e instanceof HttpException) throw e;
      const err = e as { statusCode?: number; code?: string; message?: string };
      if (err.statusCode === 413 || String(err.code ?? '').includes('FILE_TOO_LARGE')) {
        throw new HttpException(
          { error: 'file_too_large', message: 'File must be under 2MB.' },
          HttpStatus.PAYLOAD_TOO_LARGE,
        );
      }
      const msg = typeof err.message === 'string' ? err.message : '';
      if (/limit|too large/i.test(msg)) {
        throw new HttpException(
          { error: 'file_too_large', message: 'File must be under 2MB.' },
          HttpStatus.PAYLOAD_TOO_LARGE,
        );
      }
      throw new HttpException({ error: 'Upload failed' }, HttpStatus.BAD_REQUEST);
    }

    if (fileParts.length === 0) {
      throw new HttpException(
        { error: 'missing_file', message: 'No file was sent.' },
        HttpStatus.BAD_REQUEST,
      );
    }

    if (botIdField) {
      if (!Types.ObjectId.isValid(botIdField)) {
        throw new HttpException({ error: 'Invalid botId' }, HttpStatus.BAD_REQUEST);
      }
      await this.assertCanAccessWorkspaceBot(req, botIdField);
      if (fileParts.length > MAX_DOCUMENT_BATCH) {
        throw new HttpException(
          { error: `At most ${MAX_DOCUMENT_BATCH} files per request` },
          HttpStatus.BAD_REQUEST,
        );
      }
      return this.ingestDocumentBatch(botIdField, fileParts, titleField);
    }

    if (fileParts.length > 1) {
      throw new HttpException(
        { error: 'Only one image file is allowed without botId.' },
        HttpStatus.BAD_REQUEST,
      );
    }

    return this.ingestAvatarImage(fileParts[0]!);
  }

  private async ingestAvatarImage(filePart: MultipartFilePart): Promise<{ url: string }> {
    const originalName = (filePart.filename || 'image').trim() || 'image';
    const mime = (filePart.mimetype || '').toLowerCase();
    const allowedMime = mime === 'image/png' || mime === 'image/jpeg' || mime === 'image/jpg' || mime === 'image/webp';
    if (!allowedMime) {
      throw new HttpException(
        { error: 'invalid_type', message: 'Invalid image type. Use PNG, JPG, or WEBP.' },
        HttpStatus.BAD_REQUEST,
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
          { error: 'file_too_large', message: 'Image must be under 2MB.' },
          HttpStatus.PAYLOAD_TOO_LARGE,
        );
      }
      throw new HttpException(
        { error: 'invalid_file', message: 'Invalid image (type or size). Use PNG, JPG, or WEBP under 2MB.' },
        HttpStatus.BAD_REQUEST,
      );
    }

    if (!buffer.length) {
      throw new HttpException(
        { error: 'invalid_file', message: 'Invalid image (type or size). Use PNG, JPG, or WEBP under 2MB.' },
        HttpStatus.BAD_REQUEST,
      );
    }
    if (buffer.length > MAX_AVATAR_BYTES) {
      throw new HttpException(
        { error: 'file_too_large', message: 'Image must be under 2MB.' },
        HttpStatus.PAYLOAD_TOO_LARGE,
      );
    }

    const contentType = mime;

    try {
      const result = await uploadPublic({
        prefix: 'uploads/bot-images',
        body: buffer,
        originalName,
        contentType,
      });
      return { url: result.url };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[operator-upload] public image upload failed', { msg });
      throw new HttpException(
        { error: 'Image upload failed. Please try again.', message: 'Image upload failed. Please try again.' },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  private async ingestDocumentBatch(
    botId: string,
    fileParts: MultipartFilePart[],
    titleField: string,
  ): Promise<{ ok: true; results: Array<Record<string, unknown>> }> {
    const results: Array<Record<string, unknown>> = [];

    for (let i = 0; i < fileParts.length; i++) {
      const filePart = fileParts[i]!;
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

      const titleForDoc =
        i === 0 && titleField
          ? titleField
          : (titleField && fileParts.length === 1 ? titleField : '') || originalName;
      const title = titleForDoc.trim() || originalName;

      const contentType =
        filePart.mimetype && filePart.mimetype !== 'application/octet-stream'
          ? filePart.mimetype
          : guessDocumentContentType(ext);

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
        console.error('[operator-upload] S3 document upload failed', { botId, msg });
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

      const job = await this.ingestionService.createQueuedJob(botId, docId);
      const jobId =
        (job as { _id?: { toString?: () => string } })._id?.toString?.() ??
        String((job as { _id?: unknown })._id ?? '');

      results.push({
        type: 'document',
        originalName,
        documentStatus: 'queued',
        ingestJobStatus: 'queued',
        ingestJobId: jobId,
      });
    }

    return { ok: true, results };
  }
}

function guessDocumentContentType(ext: string): string {
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
