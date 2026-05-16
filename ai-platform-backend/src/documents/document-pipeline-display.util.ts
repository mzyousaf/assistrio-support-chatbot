import type { DocumentUploadStatus } from './document-upload-status.util';
import { normalizeKnowledgeTrainingStatus } from '../knowledge/knowledge-training-status.util';
import type { KnowledgeBaseItemTrainingStatus } from '../models/knowledge-base-item.schema';

/**
 * High-level UX stage for KB-backed document uploads (customer documents list/detail).
 */
export type DocumentPipelineStage =
  | 'uploading'
  | 'upload_failed'
  | 'pending_extraction'
  | 'extract_queued'
  | 'extract_processing'
  | 'extract_failed'
  /** Text is on the item; embeddings / training lifecycle not satisfied yet (`pending`). */
  | 'training_required'
  /** Training queued (smart delay or manual “train”). */
  | 'training_queued'
  /** Chunk/embed work in flight. */
  | 'training'
  /** Stored as `ready` on the KB row; label matches product “passed”. */
  | 'passed'
  | 'training_failed';

export type DocumentPipelineDisplay = { stage: DocumentPipelineStage; label: string };

/**
 * Derives a single funnel label from upload state, extraction progress, then training lifecycle.
 *
 * Preconditions: caller passes **effective** training display (`computeKbDocumentTrainingDisplay`) so train vs extract merges match the rest of `/documents`.
 */
export function deriveDocumentPipelineDisplay(params: {
  uploadDocumentStatus: DocumentUploadStatus;
  isContentExtracted: boolean;
  latestExtractJobStatus?: string | null;
  /** Effective training status (`computeKbDocumentTrainingDisplay`). */
  trainingDisplayStatus: KnowledgeBaseItemTrainingStatus | string;
}): DocumentPipelineDisplay {
  const up = params.uploadDocumentStatus;
  if (up === 'upload_failed') {
    return { stage: 'upload_failed', label: 'Upload failed' };
  }
  if (up === 'uploading') {
    return { stage: 'uploading', label: 'Uploading' };
  }

  const ex = typeof params.latestExtractJobStatus === 'string' ? params.latestExtractJobStatus.trim() : '';
  const extracted = params.isContentExtracted === true;

  if (!extracted) {
    if (ex === 'failed') {
      return { stage: 'extract_failed', label: 'Extracting text failed' };
    }
    if (ex === 'processing') {
      return { stage: 'extract_processing', label: 'Extracting text' };
    }
    if (ex === 'queued') {
      return { stage: 'extract_queued', label: 'Queued for extraction' };
    }
    if (ex === 'done') {
      return { stage: 'pending_extraction', label: 'Pending extraction' };
    }
    return { stage: 'pending_extraction', label: 'Pending extraction' };
  }

  const t = normalizeKnowledgeTrainingStatus(String(params.trainingDisplayStatus ?? '')) as KnowledgeBaseItemTrainingStatus;
  switch (t) {
    case 'pending':
      return { stage: 'training_required', label: 'Training required' };
    case 'queued':
      return { stage: 'training_queued', label: 'Training Queued' };
    case 'processing':
      return { stage: 'training', label: 'Training' };
    case 'ready':
      return { stage: 'passed', label: 'Passed' };
    case 'failed':
      return { stage: 'training_failed', label: 'Failed' };
    default:
      return { stage: 'training_required', label: 'Training required' };
  }
}
