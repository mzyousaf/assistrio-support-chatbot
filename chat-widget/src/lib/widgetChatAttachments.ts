/**
 * Widget composer attachment rules — keep in sync with
 * `ai-platform-backend/src/chat/widget-chat-attachment.constants.ts`.
 */
export const WIDGET_CHAT_ATTACHMENT_MAX_FILES = 5;

export const WIDGET_CHAT_ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024;

const ALLOWED_EXT = new Set([
  "pdf",
  "xls",
  "xlsx",
  "csv",
  "doc",
  "docx",
  "zip",
  "rar",
  "7z",
  "png",
  "jpg",
  "jpeg",
  "webp",
  "gif",
  "bmp",
  "tif",
  "tiff",
  "svg",
  "ico",
  "heic",
  "heif",
  "avif",
]);

/** `accept` for hidden file inputs (extension hints; validation is still enforced in JS). */
export const WIDGET_CHAT_ACCEPT =
  ".pdf,.xls,.xlsx,.csv,.doc,.docx,.zip,.rar,.7z,.png,.jpg,.jpeg,.webp,.gif,.bmp,.tif,.tiff,.svg,.ico,.heic,.heif,.avif,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,application/zip,application/x-zip-compressed,application/x-rar-compressed,application/x-7z-compressed";

export function getWidgetChatFileExtension(fileName: string): string {
  const n = fileName.trim();
  const i = n.lastIndexOf(".");
  if (i < 0) return "";
  return n.slice(i + 1).toLowerCase();
}

export function isAllowedWidgetChatAttachmentFile(file: File): boolean {
  const ext = getWidgetChatFileExtension(file.name);
  if (ext && ALLOWED_EXT.has(ext)) return true;
  if (file.type && /^image\//i.test(file.type)) return true;
  return false;
}

export type PickWidgetChatFilesResult = {
  added: Array<{ id: string; file: File }>;
  errors: string[];
};

export function pickWidgetChatFiles(
  incoming: FileList | File[],
  currentCount: number,
  genId: () => string,
): PickWidgetChatFilesResult {
  const list = Array.from(incoming);
  const errors: string[] = [];
  const added: Array<{ id: string; file: File }> = [];
  let count = currentCount;
  const maxMb = WIDGET_CHAT_ATTACHMENT_MAX_BYTES / (1024 * 1024);

  for (const file of list) {
    if (count >= WIDGET_CHAT_ATTACHMENT_MAX_FILES) {
      errors.push(`You can attach at most ${WIDGET_CHAT_ATTACHMENT_MAX_FILES} files per message.`);
      break;
    }
    if (file.size > WIDGET_CHAT_ATTACHMENT_MAX_BYTES) {
      errors.push(`“${file.name}” is larger than ${maxMb} MB.`);
      continue;
    }
    if (!isAllowedWidgetChatAttachmentFile(file)) {
      errors.push(
        `“${file.name}” is not an allowed type. Use PDF, Excel, CSV, Word, images, GIF, ZIP, RAR, or 7Z.`,
      );
      continue;
    }
    added.push({ id: genId(), file });
    count += 1;
  }

  return { added, errors };
}
