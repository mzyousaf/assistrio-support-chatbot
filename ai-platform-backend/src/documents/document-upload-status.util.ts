/**
 * Persisted lifecycle for `documents.status` — file/source only (not KB training).
 */
export type DocumentUploadStatus = 'uploading' | 'uploaded' | 'upload_failed';

const CANON_UPLOAD: ReadonlySet<string> = new Set(['uploading', 'uploaded', 'upload_failed']);

/**
 * Migrate legacy pipelines + UI-only labels mixed into Mongo `documents.status`.
 *
 * Training outcomes (`queued` / `processing` / `ready`) map to **`uploaded`** once the blob exists.
 * `failed` heuristics: if `documentError` looks like upload/storage failure → `upload_failed`, else **`uploaded`**
 * (typically a training/embed failure mirrored on doc before refactor).
 */
export function normalizeDocumentUploadStatus(
  raw: string | null | undefined,
  documentError?: string | null | undefined,
): DocumentUploadStatus {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (!s) return 'uploaded';
  if (CANON_UPLOAD.has(s)) return s as DocumentUploadStatus;

  if (s === 'pending' || s === 'queued' || s === 'processing' || s === 'ready' || s === 'done' || s === 'completed') {
    return 'uploaded';
  }

  if (s === 'failed' || s === 'aborted') {
    const err = String(documentError ?? '')
      .trim()
      .toLowerCase();
    if (
      err &&
      /\b(s3|upload|storage|multipart|multipart\/|413|payload|file)\b/i.test(`${documentError ?? ''}`)
    ) {
      return 'upload_failed';
    }
    return 'uploaded';
  }

  return 'uploaded';
}
