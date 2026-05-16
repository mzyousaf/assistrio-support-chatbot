import { Types } from 'mongoose';
import { effectiveKbDocumentFileMetaLean } from './knowledge-base-document-sync-fields.util';

/** One private S3 object to remove during KB item hard purge (bucket + key + trace label). */
export type KbPurgeS3Ref = {
  bucket: string;
  key: string;
  provenance: string;
};

type TableJobLean = {
  _id: Types.ObjectId;
  s3Bucket?: string;
  s3Key?: string;
};

type TableSessionLean = {
  _id: Types.ObjectId;
  s3Bucket?: string;
  s3Key?: string;
};

/**
 * Collects S3 object references owned by a KB item or its table-import jobs/sessions.
 * Dedupes by bucket+key. Does not perform deletes.
 *
 * - {@link KnowledgeBaseItem.fileMeta} (+ legacy {@link effectiveKbDocumentFileMetaLean}): only when
 *   `storage` is `s3` or unset (skips explicit `https` / other non-S3 storage to avoid wrong deletes).
 * - {@link TableImportJob} / {@link TableImportSession}: temp upload objects (always treated as deletable
 *   when bucket+key present).
 *
 * {@link ExtractJob} and {@link TrainJob} carry no bucket/key in schema — nothing to collect there.
 */
export function collectKbPurgeS3Refs(args: {
  itemLean: Record<string, unknown> & { _id: Types.ObjectId; sourceType?: string };
  tableImportJobs: TableJobLean[];
  tableImportSessions: TableSessionLean[];
}): KbPurgeS3Ref[] {
  const seen = new Set<string>();
  const out: KbPurgeS3Ref[] = [];

  const add = (bucket: string, key: string, provenance: string) => {
    const b = bucket.trim();
    const k = key.trim();
    if (!b || !k) return;
    const dedupe = `${b}\n${k}`;
    if (seen.has(dedupe)) return;
    seen.add(dedupe);
    out.push({ bucket: b, key: k, provenance });
  };

  const fm = effectiveKbDocumentFileMetaLean(args.itemLean);
  const storage = String(fm.storage ?? '').toLowerCase();
  const bucket = String(fm.storageBucket ?? '').trim();
  const key = String(fm.storageKey ?? '').trim();
  if (bucket && key && (storage === 's3' || !storage)) {
    add(bucket, key, 'knowledgeBaseItem.fileMeta');
  }

  for (const job of args.tableImportJobs) {
    const jb = String(job.s3Bucket ?? '').trim();
    const jk = String(job.s3Key ?? '').trim();
    if (jb && jk) add(jb, jk, `tableImportJob:${String(job._id)}`);
  }
  for (const sess of args.tableImportSessions) {
    const sb = String(sess.s3Bucket ?? '').trim();
    const sk = String(sess.s3Key ?? '').trim();
    if (sb && sk) add(sb, sk, `tableImportSession:${String(sess._id)}`);
  }

  return out;
}
