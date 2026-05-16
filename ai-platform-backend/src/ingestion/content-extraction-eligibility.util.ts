import { normalizeDocumentUploadStatus } from '../documents/document-upload-status.util';
import { effectiveKbDocumentFileMetaLean } from '../knowledge/knowledge-base-document-sync-fields.util';

/**
 * Canonical KB row: private S3 keys or https URL exists and upload did not permanently fail.
 * Pass {@link effectiveKbDocumentFileMetaLean} output (merges legacy `file` / `sourceMeta`).
 */
export function kbRowHasUploadedFileSource(params: { fileMeta?: Record<string, unknown> }): boolean {
  const file = params.fileMeta ?? {};
  const fileUploadRaw = typeof file.uploadStatus === 'string' ? file.uploadStatus : '';
  const uploadStatus = normalizeDocumentUploadStatus(fileUploadRaw || '', undefined);
  const bucket = String(file.storageBucket ?? '').trim();
  const key = String(file.storageKey ?? '').trim();
  const smUrlRaw = typeof file.url === 'string' ? file.url.trim() : '';
  return (
    (Boolean(bucket && key) && uploadStatus !== 'upload_failed') ||
    (Boolean(smUrlRaw) && /^https?:\/\//i.test(smUrlRaw) && uploadStatus !== 'upload_failed')
  );
}

/**
 * Queued ExtractJob worker may claim/run only when text is not yet marked extracted **and**
 * there is already something to read (prior non-empty body or uploaded file/url).
 */
export function kbRowEligibleForQueuedContentExtraction(kb: {
  isContentExtracted?: boolean;
  content?: string;
  fileMeta?: Record<string, unknown>;
}): boolean {
  if (kb.isContentExtracted === true) return false;
  if ((kb.content ?? '').trim().length > 0) return true;
  return kbRowHasUploadedFileSource({ fileMeta: kb.fileMeta });
}

/**
 * Document KB row has no usable S3/https source and no manual body — safe to mark `upload_failed` on a sweep.
 * Skips rows that may still be completing multipart upload (`uploadSessionId` set but keys not written yet).
 */
export function shouldMarkDocumentKbUploadFailedForUnusableSource(kb: {
  isContentExtracted?: boolean;
  content?: string;
  fileMeta?: Record<string, unknown>;
  file?: Record<string, unknown>;
  sourceMeta?: Record<string, unknown>;
}): boolean {
  if (kb.isContentExtracted === true) return false;
  if ((kb.content ?? '').trim().length > 0) return false;
  const row = kb as Record<string, unknown>;
  const effective = effectiveKbDocumentFileMetaLean(row);
  const fm = effective as Record<string, unknown>;
  if (kbRowHasUploadedFileSource({ fileMeta: fm })) return false;
  const uploadStatus = normalizeDocumentUploadStatus(String(fm.uploadStatus ?? ''), undefined);
  if (uploadStatus === 'upload_failed') return false;
  const sid = String(fm.uploadSessionId ?? '').trim();
  const bucket = String(fm.storageBucket ?? '').trim();
  const key = String(fm.storageKey ?? '').trim();
  if (sid && (!bucket || !key)) return false;
  return true;
}
