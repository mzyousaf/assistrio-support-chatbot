import type { KnowledgeBaseItemTrainingStatus } from '../models/knowledge-base-item.schema';

export type SnapshotForFinalize = {
  contentHash: string;
  lastContentUpdatedAt?: Date | null;
};

/** Latest row from Mongo for a KnowledgeBaseItem (subset of fields). */
export type LeanKbItemForFinalize = {
  active?: boolean;
  status?: KnowledgeBaseItemTrainingStatus | string;
  contentHash?: string;
  lastContentUpdatedAt?: Date | null;
} | null;

function timeMs(v: unknown): number | null {
  if (v == null) return null;
  const d = v instanceof Date ? v : typeof v === 'string' ? new Date(v) : null;
  if (!d || !Number.isFinite(d.getTime())) return null;
  return d.getTime();
}

function timesRoughlyEqual(snapshot: Date | null | undefined, latest: unknown): boolean {
  const tm = latest != null ? timeMs(latest) : null;
  const ts = snapshot ? timeMs(snapshot) : null;
  if (tm == null && ts == null) return true;
  if (tm == null || ts == null) return false;
  return tm === ts;
}

/**
 * Returns true iff the worker may mark this KB item ready for the embeddings it computed
 * from the captured snapshot (hash + timestamp).
 */
export function canFinalizeKnowledgeItemTraining(latest: LeanKbItemForFinalize, snapshot: SnapshotForFinalize): boolean {
  if (!latest) return false;
  if ((latest.status as string) !== 'processing') return false;
  if ((latest.contentHash ?? '') !== snapshot.contentHash) return false;
  if (!timesRoughlyEqual(snapshot.lastContentUpdatedAt ?? null, latest.lastContentUpdatedAt)) return false;
  return true;
}
