import { HttpException, HttpStatus } from '@nestjs/common';
import { KNOWLEDGE_DOCUMENT_UPLOAD_BATCH_MAX } from '../workspace/shared/bot-field-limits';
import { DEFAULT_KB_FIELD_LIMITS } from './knowledge-plan-limits';

export const PLAN_LIMIT_DOCUMENT_FILE_SIZE_ERROR_CODE = 'plan_limit_document_file_size' as const;
export const PLAN_LIMIT_DATASHEET_FILE_SIZE_ERROR_CODE = 'plan_limit_datasheet_file_size' as const;
export const PLAN_LIMIT_DOCUMENT_BATCH_COUNT_ERROR_CODE = 'plan_limit_document_batch_count' as const;

const DOCUMENT_UPLOAD_MESSAGE = 'Document files can be up to 20 MB.';
const DATASHEET_UPLOAD_MESSAGE = 'Datasheet files can be up to 20 MB.';

export function planLimitDocumentFileSizeException(): HttpException {
  return new HttpException(
    {
      error: DOCUMENT_UPLOAD_MESSAGE,
      message: DOCUMENT_UPLOAD_MESSAGE,
      errorCode: PLAN_LIMIT_DOCUMENT_FILE_SIZE_ERROR_CODE,
      maxBytes: DEFAULT_KB_FIELD_LIMITS.documentMaxUploadBytes,
    },
    HttpStatus.PAYLOAD_TOO_LARGE,
  );
}

export function planLimitDatasheetFileSizeException(): HttpException {
  return new HttpException(
    {
      error: DATASHEET_UPLOAD_MESSAGE,
      message: DATASHEET_UPLOAD_MESSAGE,
      errorCode: PLAN_LIMIT_DATASHEET_FILE_SIZE_ERROR_CODE,
      maxBytes: DEFAULT_KB_FIELD_LIMITS.datasheetMaxUploadBytes,
    },
    HttpStatus.PAYLOAD_TOO_LARGE,
  );
}

export function assertDocumentUploadWithinPlanLimit(bufferLength: number): void {
  if (bufferLength > DEFAULT_KB_FIELD_LIMITS.documentMaxUploadBytes) {
    throw planLimitDocumentFileSizeException();
  }
}

export function assertDatasheetUploadWithinPlanLimit(bufferLength: number): void {
  if (bufferLength > DEFAULT_KB_FIELD_LIMITS.datasheetMaxUploadBytes) {
    throw planLimitDatasheetFileSizeException();
  }
}

export function planLimitDocumentBatchCountException(opts: {
  maxFilesPerUpload: number;
  incomingFiles: number;
}): HttpException {
  const msg = `You can upload up to ${opts.maxFilesPerUpload} files at a time.`;
  return new HttpException(
    {
      error: msg,
      message: msg,
      errorCode: PLAN_LIMIT_DOCUMENT_BATCH_COUNT_ERROR_CODE,
      maxFilesPerUpload: opts.maxFilesPerUpload,
      incomingFiles: opts.incomingFiles,
    },
    HttpStatus.BAD_REQUEST,
  );
}

/**
 * Reject when a single upload carries more file parts than allowed (before S3 / KB / extract jobs).
 */
export function assertDocumentUploadBatchFileCountAtMost(
  incomingFiles: number,
  maxFilesPerUpload: number = KNOWLEDGE_DOCUMENT_UPLOAD_BATCH_MAX,
): void {
  if (incomingFiles <= maxFilesPerUpload) return;
  throw planLimitDocumentBatchCountException({
    maxFilesPerUpload,
    incomingFiles,
  });
}
