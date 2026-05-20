import { HttpException, HttpStatus, Logger } from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import {
  BOT_DOCUMENT_UPLOAD_EXTENSIONS,
  MAX_BOT_DOCUMENT_FILES_PER_REQUEST,
  MAX_BOT_DOCUMENT_UPLOAD_BYTES,
  getBotDocumentExtension,
  isAllowedBotDocumentExtension,
} from '../../documents/bot-document-upload.constants';
import { DocumentsService } from '../../documents/documents.service';
import { normalizeKnowledgeTrainingStatus } from '../../knowledge/knowledge-training-status.util';
import {
  assertDocumentUploadBatchFileCountAtMost,
  assertDocumentUploadWithinPlanLimit,
  planLimitDocumentBatchCountException,
  planLimitDocumentFileSizeException,
} from '../../knowledge/kb-upload-plan-limit.util';
import { normalizeDocumentUploadStatus } from '../../documents/document-upload-status.util';
import { IngestionService } from '../../ingestion/ingestion.service';
import { BotKnowledgeTotalLimitService } from '../../knowledge/bot-knowledge-total-limit.service';
import { uploadToS3 } from '../../lib/s3';
import { KNOWLEDGE_DOCUMENTS_MAX } from './bot-field-limits';

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

/** Shared multipart document upload for customer and admin bot document routes. */
export async function handleWorkspaceBotDocumentUpload(params: {
  botId: string;
  req: FastifyRequest;
  logLabel: string;
  documentsService: DocumentsService;
  ingestionService: IngestionService;
  botKbTotalLimit: BotKnowledgeTotalLimitService;
}): Promise<{
  ok: true;
  documents: Array<{
    _id: string;
    botId: string;
    title: string;
    sourceType: string;
    status: string;
    documentStatus: string;
    trainingStatus: string;
    fileName: string;
    fileType: string;
    fileSize: number;
    active: boolean;
    createdAt: string;
  }>;
  ingestions: Array<{ jobStatus: 'queued' }>;
}> {
  const { botId, req, logLabel, documentsService, ingestionService, botKbTotalLimit } = params;
  const logger = new Logger(logLabel);
  const t0 = Date.now();
  logger.log(
    `[upload] start botId=${botId} maxBytes=${MAX_BOT_DOCUMENT_UPLOAD_BYTES} maxFiles=${MAX_BOT_DOCUMENT_FILES_PER_REQUEST}`,
  );

  await botKbTotalLimit.assertStoredBytesBelowCapForNewContent(botId);

  const r = req as FastifyRequest & {
    isMultipart: () => boolean;
    parts: () => AsyncIterable<
      | { type: 'file'; fieldname: string; filename: string; mimetype: string; toBuffer: () => Promise<Buffer> }
      | { type: 'field'; fieldname: string; value: unknown }
    >;
  };

  if (!r.isMultipart()) {
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
    for await (const part of r.parts()) {
      if (part.type === 'file') {
        if (part.fieldname !== 'file') {
          throw new HttpException(
            { error: 'Unexpected file field. Use field name "file".' },
            HttpStatus.BAD_REQUEST,
          );
        }
        if (parsedFiles.length >= MAX_BOT_DOCUMENT_FILES_PER_REQUEST) {
          throw planLimitDocumentBatchCountException({
            maxFilesPerUpload: MAX_BOT_DOCUMENT_FILES_PER_REQUEST,
            incomingFiles: parsedFiles.length + 1,
          });
        }
        const buffer = await part.toBuffer();
        if (!buffer.length) continue;
        assertDocumentUploadWithinPlanLimit(buffer.length);
        const originalName = (part.filename || 'document').trim() || 'document';
        const ext = getBotDocumentExtension(originalName);
        if (!ext || !isAllowedBotDocumentExtension(ext)) {
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
  } catch (e) {
    if (e instanceof HttpException) throw e;
    const err = e as { statusCode?: number; code?: string; message?: string };
    if (err.statusCode === 413 || String(err.code ?? '').includes('FILE_TOO_LARGE')) {
      throw planLimitDocumentFileSizeException();
    }
    const msg = typeof err.message === 'string' ? err.message : '';
    if (/limit|too large/i.test(msg)) {
      throw planLimitDocumentFileSizeException();
    }
    throw new HttpException({ error: 'Upload failed' }, HttpStatus.BAD_REQUEST);
  }

  if (parsedFiles.length === 0) {
    throw new HttpException(
      { error: 'Missing file. Send one or more multipart fields named "file".' },
      HttpStatus.BAD_REQUEST,
    );
  }

  assertDocumentUploadBatchFileCountAtMost(parsedFiles.length, MAX_BOT_DOCUMENT_FILES_PER_REQUEST);

  const existingDocs = await documentsService.countByBot(botId);
  if (existingDocs + parsedFiles.length > KNOWLEDGE_DOCUMENTS_MAX) {
    throw new HttpException(
      {
        error: `Each agent can have at most ${KNOWLEDGE_DOCUMENTS_MAX} documents. Remove one before adding more.`,
        errorCode: 'plan_limit_knowledge_documents_count',
        maxDocuments: KNOWLEDGE_DOCUMENTS_MAX,
        currentDocuments: existingDocs,
        incomingFiles: parsedFiles.length,
      },
      HttpStatus.BAD_REQUEST,
    );
  }

  const documentsOut: Array<{
    _id: string;
    botId: string;
    title: string;
    sourceType: string;
    status: string;
    documentStatus: string;
    trainingStatus: string;
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
      const result = await uploadToS3({
        visibility: 'private',
        prefix: `uploads/documents/${botId}`,
        originalName: pf.originalName,
        contentType,
        body: pf.buffer,
      });
      uploaded = { bucket: result.bucket, key: result.key };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.error(`[upload] s3 failed botId=${botId} idx=${i} msg=${msg}`);
      throw new HttpException(
        { error: 'Document storage is not available. Try again later.' },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const created = await documentsService.create({
      botId,
      title,
      sourceType: 'upload',
      fileName: pf.originalName,
      fileType: contentType,
      fileSize: pf.buffer.length,
      storage: 's3',
      s3Bucket: uploaded.bucket,
      s3Key: uploaded.key,
    });

    const docId =
      (created as { _id?: { toString?: () => string } })._id?.toString?.() ??
      String((created as { _id?: unknown })._id);

    const uploadStNorm = normalizeDocumentUploadStatus(
      String((created as { documentStatus?: string }).documentStatus ?? (created as { status?: string }).status ?? ''),
    );
    const trainStNorm = normalizeKnowledgeTrainingStatus(
      String((created as { trainingStatus?: string }).trainingStatus ?? ''),
    );

    await ingestionService.createQueuedJob(botId, docId, { markTrainingQueued: false });

    const createdAtRaw = (created as { createdAt?: Date }).createdAt;
    const createdAt =
      createdAtRaw instanceof Date ? createdAtRaw.toISOString() : new Date().toISOString();

    documentsOut.push({
      _id: docId,
      botId,
      title,
      sourceType: 'upload',
      status: uploadStNorm,
      documentStatus: uploadStNorm,
      trainingStatus: trainStNorm,
      fileName: pf.originalName,
      fileType: contentType,
      fileSize: pf.buffer.length,
      active: true,
      createdAt,
    });
  }

  logger.log(`[upload] done botId=${botId} count=${documentsOut.length} ms=${Date.now() - t0}`);

  return {
    ok: true as const,
    documents: documentsOut,
    ingestions: documentsOut.map(() => ({ jobStatus: 'queued' as const })),
  };
}
