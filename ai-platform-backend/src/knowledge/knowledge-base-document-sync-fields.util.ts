/**
 * Canonical file / URL payload for {@link KnowledgeBaseItem} rows with `sourceType === 'document'`.
 * Stored on `fileMeta` (S3 keys, display fields, HTTPS URL sources, upload session).
 */
/** Nested `KnowledgeBaseItem.fileMeta` for S3-backed rows — preferred bucket/key/display file fields. */
export function fileSubdocFromDocumentSyncInputs(params: {
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  s3Bucket?: string;
  s3Key?: string;
  uploadFailed?: boolean;
}): Record<string, unknown> | undefined {
  const bucket = String(params.s3Bucket ?? '').trim();
  const key = String(params.s3Key ?? '').trim();
  if (!bucket || !key) return undefined;
  const name = params.fileName?.trim() || 'document';
  const size =
    typeof params.fileSize === 'number' && Number.isFinite(params.fileSize)
      ? Math.max(0, Math.floor(params.fileSize))
      : 0;
  return {
    originalName: name,
    mimeType: params.fileType?.trim() || 'application/octet-stream',
    sizeBytes: size,
    storageBucket: bucket,
    storageKey: key,
    storageProvider: 's3',
    uploadStatus: params.uploadFailed ? 'upload_failed' : 'uploaded',
  };
}

export type DocumentSyncFileMetaInput = {
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  s3Bucket?: string;
  s3Key?: string;
  url?: string;
  uploadSessionId?: string;
  storage?: string;
};

/** Builds `fileMeta` for sync from upload pipeline payloads — URL + optional S3/session fields. */
export function mergedDocumentKbFileMetaFromSync(doc: DocumentSyncFileMetaInput): Record<string, unknown> | undefined {
  const s3doc = fileSubdocFromDocumentSyncInputs({
    fileName: doc.fileName,
    fileType: doc.fileType,
    fileSize: doc.fileSize,
    s3Bucket: doc.s3Bucket,
    s3Key: doc.s3Key,
  });
  const base = (typeof s3doc === 'object' && s3doc ? { ...s3doc } : {}) as Record<string, unknown>;
  const u = typeof doc.url === 'string' ? doc.url.trim() : '';
  if (u) base.url = u;
  const sid = typeof doc.uploadSessionId === 'string' ? doc.uploadSessionId.trim() : '';
  if (sid) base.uploadSessionId = sid;
  const st = typeof doc.storage === 'string' ? doc.storage.trim() : '';
  if (st) base.storage = st;
  return Object.keys(base).length > 0 ? base : undefined;
}

/**
 * Read path: merges `fileMeta`, legacy `file`, and legacy `sourceMeta` so old Mongo rows still resolve
 * bucket/key, URL, and display names after the schema rename.
 */
export function effectiveKbDocumentFileMetaLean(
  row: Record<string, unknown> | null | undefined,
): {
  storageBucket?: string;
  storageKey?: string;
  originalName?: string;
  mimeType?: string;
  sizeBytes?: number;
  url?: string;
  uploadSessionId?: string;
  storage?: string;
  uploadStatus?: string;
} {
  const fm = (row?.fileMeta ?? row?.file) as Record<string, unknown> | undefined;
  const sm = (row?.sourceMeta ?? {}) as Record<string, unknown>;
  const bucket = String(fm?.storageBucket ?? sm.s3Bucket ?? '').trim();
  const key = String(fm?.storageKey ?? sm.s3Key ?? '').trim();
  const originalNameRaw = fm?.originalName ?? sm.fileName;
  const originalName =
    typeof originalNameRaw === 'string' && originalNameRaw.trim()
      ? originalNameRaw.trim()
      : typeof originalNameRaw === 'string'
        ? originalNameRaw
        : undefined;
  const mimeRaw = fm?.mimeType ?? sm.fileType;
  const mimeType =
    typeof mimeRaw === 'string' && mimeRaw.trim()
      ? mimeRaw.trim()
      : typeof mimeRaw === 'string'
        ? mimeRaw
        : undefined;
  const sizeLegacy = fm?.sizeBytes ?? sm.fileSize;
  const sizeBytes =
    typeof sizeLegacy === 'number' && Number.isFinite(sizeLegacy) ? Math.floor(sizeLegacy) : undefined;
  const urlRaw = fm?.url ?? sm.url;
  const url =
    typeof urlRaw === 'string' && urlRaw.trim()
      ? urlRaw.trim()
      : typeof urlRaw === 'string'
        ? urlRaw
        : undefined;
  const uploadSessionRaw = fm?.uploadSessionId ?? sm.uploadSessionId;
  const uploadSessionId =
    typeof uploadSessionRaw === 'string' && uploadSessionRaw.trim()
      ? uploadSessionRaw.trim()
      : typeof uploadSessionRaw === 'string'
        ? uploadSessionRaw
        : undefined;
  const storageRaw = fm?.storage ?? sm.storage;
  const storage =
    typeof storageRaw === 'string' && storageRaw.trim()
      ? storageRaw.trim()
      : typeof storageRaw === 'string'
        ? storageRaw
        : undefined;
  const uploadRaw = fm?.uploadStatus ?? (row?.file as Record<string, unknown> | undefined)?.uploadStatus;
  const uploadStatus = typeof uploadRaw === 'string' ? uploadRaw : undefined;

  const out: {
    storageBucket?: string;
    storageKey?: string;
    originalName?: string;
    mimeType?: string;
    sizeBytes?: number;
    url?: string;
    uploadSessionId?: string;
    storage?: string;
    uploadStatus?: string;
  } = {};
  if (bucket) out.storageBucket = bucket;
  if (key) out.storageKey = key;
  if (originalName !== undefined) out.originalName = originalName;
  if (mimeType !== undefined) out.mimeType = mimeType;
  if (sizeBytes !== undefined) out.sizeBytes = sizeBytes;
  if (url !== undefined) out.url = url;
  if (uploadSessionId !== undefined) out.uploadSessionId = uploadSessionId;
  if (storage !== undefined) out.storage = storage;
  if (uploadStatus !== undefined) out.uploadStatus = uploadStatus;
  return out;
}
