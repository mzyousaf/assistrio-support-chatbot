/**
 * Limits and allowlists for bot document uploads.
 * `MAX_BOT_DOCUMENT_UPLOAD_BYTES` must stay in sync with `@fastify/multipart` `limits.fileSize` in `main.ts`.
 */
export const MAX_BOT_DOCUMENT_UPLOAD_BYTES = 5 * 1024 * 1024;

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
