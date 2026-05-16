/**
 * Visitor chat attachment uploads (widget composer). Files are stored in S3 public prefix
 * `uploads/widget-chat/{botId}/` and URLs are persisted on the user {@link Message} record.
 */
import { getBotDocumentExtension } from '../documents/bot-document-upload.constants';

/** Visitor composer uploads — separate cap from workspace KB documents (`MAX_BOT_DOCUMENT_UPLOAD_BYTES`). */
export const WIDGET_CHAT_ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024;

export const WIDGET_CHAT_ATTACHMENT_MAX_FILES = 5;

/**
 * Allowed extensions (lowercase). Includes common images, office, archives.
 * Must stay in sync with `chat-widget` accept list and {@link pickWidgetChatFiles}.
 */
export const WIDGET_CHAT_ATTACHMENT_EXTENSIONS = new Set([
  'pdf',
  'xls',
  'xlsx',
  'csv',
  'doc',
  'docx',
  'zip',
  'rar',
  '7z',
  'png',
  'jpg',
  'jpeg',
  'webp',
  'gif',
  'bmp',
  'tif',
  'tiff',
  'svg',
  'ico',
  'heic',
  'heif',
  'avif',
]);

export function isAllowedWidgetChatAttachmentFilename(fileName: string): boolean {
  const ext = getBotDocumentExtension(fileName);
  if (!ext) return false;
  return WIDGET_CHAT_ATTACHMENT_EXTENSIONS.has(ext.toLowerCase());
}
