import type { KnowledgeBaseItemTrainingStatus } from '../models/knowledge-base-item.schema';
import { KNOWLEDGE_BASE_ITEM_TRAINING_STATUSES } from '../models/knowledge-base-item.schema';

const STATUS_CANONICAL = new Set<string>(KNOWLEDGE_BASE_ITEM_TRAINING_STATUSES);

/** Legacy / internal labels (documents ingest, old jobs) → canonical KB training status. */
const STATUS_ALIASES: Record<string, KnowledgeBaseItemTrainingStatus> = {
  done: 'ready',
  completed: 'ready',
  complete: 'ready',
  success: 'ready',
  successful: 'ready',
  ingesting: 'processing',
  training: 'processing',
  running: 'processing',
  extracting: 'processing',
  indexing: 'processing',
  upload: 'pending',
  uploaded: 'pending',
  upload_pending: 'pending',
  uploading: 'processing',
  idle: 'pending',
  stale: 'pending',
  new: 'pending',
  queued_for_training: 'queued',
  queued_for_processing: 'queued',
  queued_for_embedding: 'queued',
  aborted: 'failed',
  aborted_with_error: 'failed',
};

/** Canonical knowledge training lifecycle — shared by all KB types and APIs. */
export function normalizeKnowledgeTrainingStatus(
  raw: string | null | undefined,
): KnowledgeBaseItemTrainingStatus {
  const s = String(raw ?? '').trim().toLowerCase();
  if (!s) {
    return 'pending';
  }
  const mapped = STATUS_ALIASES[s];
  if (mapped) {
    return mapped;
  }
  if (STATUS_CANONICAL.has(s)) {
    return s as KnowledgeBaseItemTrainingStatus;
  }
  return 'pending';
}
