import { DEFAULT_KB_FIELD_LIMITS } from '../knowledge/knowledge-plan-limits';
import { KNOWLEDGE_DOCUMENT_UPLOAD_BATCH_MAX } from '../workspace/shared/bot-field-limits';

/**
 * Limits and allowlists for bot document uploads.
 * `@fastify/multipart` `limits.fileSize` in `main.ts` must be at least {@link MAX_MULTIPART_FILE_BYTES} so every
 * upload route can read the buffer; each route then enforces its own cap (see {@link DEFAULT_KB_FIELD_LIMITS}).
 */
export const MAX_BOT_DOCUMENT_UPLOAD_BYTES = DEFAULT_KB_FIELD_LIMITS.documentMaxUploadBytes;

/** Datasheet import: one CSV/Excel file per request (preview / import session). */
export const MAX_DATASHEET_IMPORT_BYTES = DEFAULT_KB_FIELD_LIMITS.datasheetMaxUploadBytes;

/** Global multipart part cap — must be >= max of all per-feature limits that use the same Fastify instance. */
export const MAX_MULTIPART_FILE_BYTES = Math.max(
  MAX_BOT_DOCUMENT_UPLOAD_BYTES,
  MAX_DATASHEET_IMPORT_BYTES,
);

/** Max files per `POST .../documents` multipart request (customer workspace). */
export const MAX_BOT_DOCUMENT_FILES_PER_REQUEST = KNOWLEDGE_DOCUMENT_UPLOAD_BATCH_MAX;

/** Extensions supported by {@link KbService.extractTextFromUpload} (ingestion pipeline). */
export const BOT_DOCUMENT_UPLOAD_EXTENSIONS = new Set([
  'txt',
  'md',
  'markdown',
  'pdf',
  'docx',
  'doc',
]);

export function getBotDocumentExtension(fileName: string): string {
  const n = fileName.trim();
  const i = n.lastIndexOf('.');
  if (i < 0) return '';
  return n.slice(i + 1).toLowerCase();
}

export function isAllowedBotDocumentExtension(ext: string): boolean {
  return BOT_DOCUMENT_UPLOAD_EXTENSIONS.has(ext.toLowerCase());
}
