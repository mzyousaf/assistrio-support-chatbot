import { HttpException, HttpStatus } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import {
  BOT_DOCUMENT_UPLOAD_EXTENSIONS,
  getBotDocumentExtension,
  isAllowedBotDocumentExtension,
  MAX_BOT_DOCUMENT_FILES_PER_REQUEST,
} from '../documents/bot-document-upload.constants';
import {
  assertDocumentUploadBatchFileCountAtMost,
  assertDocumentUploadWithinPlanLimit,
  planLimitDocumentFileSizeException,
} from '../knowledge/kb-upload-plan-limit.util';

export type ParsedOnboardingDocumentFile = {
  buffer: Buffer;
  originalName: string;
  fileMimetype: string;
  ext: string;
};

type MultipartRequest = FastifyRequest & {
  isMultipart: () => boolean;
  parts: () => AsyncIterable<{
    type: string;
    fieldname?: string;
    filename?: string;
    mimetype?: string;
    toBuffer: () => Promise<Buffer>;
    value?: unknown;
  }>;
};

export async function parseOnboardingDocumentMultipart(
  req: FastifyRequest,
): Promise<ParsedOnboardingDocumentFile[]> {
  const r = req as MultipartRequest;
  if (!r.isMultipart()) {
    throw new HttpException(
      { error: 'Expected multipart/form-data with one or more fields named "file".' },
      HttpStatus.BAD_REQUEST,
    );
  }

  const parsedFiles: ParsedOnboardingDocumentFile[] = [];

  try {
    for await (const part of r.parts()) {
      if (part.type !== 'file') continue;
      if (part.fieldname !== 'file') {
        throw new HttpException(
          { error: 'Unexpected file field. Use field name "file".' },
          HttpStatus.BAD_REQUEST,
        );
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
  return parsedFiles;
}
