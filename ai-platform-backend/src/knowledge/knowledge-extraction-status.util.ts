import type { KnowledgeBaseItemExtractionStatus } from '../models/knowledge-base-item.schema';
import { KNOWLEDGE_BASE_ITEM_EXTRACTION_STATUSES } from '../models/knowledge-base-item.schema';
import {
  kbRowEligibleForQueuedContentExtraction,
  kbRowHasUploadedFileSource,
} from '../ingestion/content-extraction-eligibility.util';
import { effectiveKbDocumentFileMetaLean } from './knowledge-base-document-sync-fields.util';
import { isTrainableExtractedDocumentText } from './knowledge-text-metrics';

const EXTRACTION_SET = new Set<string>(KNOWLEDGE_BASE_ITEM_EXTRACTION_STATUSES);

export function normalizeKnowledgeExtractionStatus(raw: string | undefined | null): KnowledgeBaseItemExtractionStatus {
  const s = typeof raw === 'string' ? raw.trim() : '';
  if (EXTRACTION_SET.has(s)) return s as KnowledgeBaseItemExtractionStatus;
  return 'not_required';
}

/**
 * Infer extraction phase for a document KB row from persisted fields (post-migration prefers `extractionStatus`).
 */
export function inferDocumentKnowledgeExtractionStatusFromRow(row: {
  sourceType?: string;
  extractionStatus?: string | null;
  isContentExtracted?: boolean;
  content?: string;
  fileMeta?: Record<string, unknown>;
}): KnowledgeBaseItemExtractionStatus {
  if (row.sourceType && row.sourceType !== 'document') {
    return 'not_required';
  }
  const explicit = normalizeKnowledgeExtractionStatus(row.extractionStatus ?? undefined);
  if (explicit !== 'not_required' || (row.extractionStatus != null && String(row.extractionStatus).trim() !== '')) {
    return explicit;
  }
  const body = (row.content ?? '').trim();
  if (row.isContentExtracted === true && body && isTrainableExtractedDocumentText(body)) {
    return 'done';
  }
  const fm = effectiveKbDocumentFileMetaLean(row as Record<string, unknown>);
  if (kbRowEligibleForQueuedContentExtraction({ isContentExtracted: row.isContentExtracted, content: row.content, fileMeta: fm })) {
    if ((row.content ?? '').trim().length > 0) {
      return 'queued';
    }
    if (kbRowHasUploadedFileSource({ fileMeta: fm })) {
      return 'queued';
    }
    return 'waiting_for_source';
  }
  return 'waiting_for_source';
}

/** Initial `extractionStatus` when creating a document KB row (before ExtractJob). */
export function initialDocumentKbExtractionStatus(params: {
  content: string;
  fileMeta: Record<string, unknown>;
  isContentExtracted: boolean;
}): KnowledgeBaseItemExtractionStatus {
  if (params.isContentExtracted && isTrainableExtractedDocumentText(params.content.trim())) {
    return 'done';
  }
  if (kbRowHasUploadedFileSource({ fileMeta: params.fileMeta })) {
    return 'queued';
  }
  if ((params.content ?? '').trim().length > 0) {
    return 'queued';
  }
  return 'waiting_for_source';
}

/** Training-side aggregates include document rows only after text extraction is complete (`extractionStatus=done` or legacy `isContentExtracted`). */
export function documentEligibleForTrainingBuckets(row: {
  sourceType?: string;
  extractionStatus?: string | null;
  isContentExtracted?: boolean;
}): boolean {
  if (row.sourceType !== 'document') return true;
  const ex = normalizeKnowledgeExtractionStatus(row.extractionStatus ?? undefined);
  if (ex === 'done') return true;
  return row.isContentExtracted === true;
}
