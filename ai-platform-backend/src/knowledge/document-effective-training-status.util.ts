import type { KnowledgeBaseItemTrainingStatus } from '../models/knowledge-base-item.schema';
import type { IngestJobStatus } from '../models';
import { normalizeKnowledgeTrainingStatus } from './knowledge-training-status.util';

/** Inputs for deriving the training badge for a bot document row (KB job + embeddings only). */
export type KbDocumentTrainingDisplayInput = {
  knowledgeItemStatus: string | null | undefined;
  latestIngestJobStatus: IngestJobStatus | null | undefined;
  embeddedChunkCount: number;
};

/**
 * Unified training lifecycle for UI/API for document-linked KB rows (`sourceType=document`).
 *
 * **`documents.status` must not contribute** — only {@link KnowledgeBaseItem} + ingest job + chunk proof.
 *
 * Rough order: latest job dominates while active; KB row + embeddings resolve terminal states once the job finishes.
 */
export function computeKbDocumentTrainingDisplay(input: KbDocumentTrainingDisplayInput): KnowledgeBaseItemTrainingStatus {
  const kb = normalizeKnowledgeTrainingStatus(typeof input.knowledgeItemStatus === 'string' ? input.knowledgeItemStatus : '');
  const j = input.latestIngestJobStatus ?? null;

  if (kb === 'failed') {
    return 'failed';
  }

  if (j === 'processing') {
    return 'processing';
  }

  if (j === 'queued') {
    return 'queued';
  }

  if (j === 'failed') {
    return 'failed';
  }

  if (kb === 'queued') {
    return 'queued';
  }

  /** Job finished or absent — heal stale KB `processing` when embeddings landed. */
  if (input.embeddedChunkCount > 0 && (kb === 'ready' || kb === 'processing')) {
    return 'ready';
  }

  if ((kb === 'ready' || kb === 'processing') && input.embeddedChunkCount === 0) {
    return 'failed';
  }

  if (kb === 'processing') {
    return 'processing';
  }

  if (kb === 'pending') {
    return 'pending';
  }

  if (kb === 'ready' && input.embeddedChunkCount > 0) {
    return 'ready';
  }

  return 'failed';
}

/** @deprecated Use {@link computeKbDocumentTrainingDisplay} — document row no longer tracks training */
export type DocumentEffectiveTrainingStatusInput = {
  documentStatus?: string | null;
  knowledgeItemStatus?: string | null;
  latestIngestJobStatus?: IngestJobStatus | null | undefined;
  embeddedChunkCount?: number;
};

/** @deprecated */
export function computeEffectiveDocumentTrainingStatus(input: DocumentEffectiveTrainingStatusInput): KnowledgeBaseItemTrainingStatus {
  return computeKbDocumentTrainingDisplay({
    knowledgeItemStatus: input.knowledgeItemStatus,
    latestIngestJobStatus: input.latestIngestJobStatus,
    embeddedChunkCount: typeof input.embeddedChunkCount === 'number' ? input.embeddedChunkCount : 0,
  });
}
