/**
 * Types for diversity control and deduplication in unified retrieval.
 */

import type { RankedKnowledgeItem } from './unified-retrieval.types';
import type { KnowledgeSourceType } from '../knowledge';

/** Configurable diversity and deduplication options. */
export interface UnifiedRetrievalDiversityOptions {
  /** Max chunks per document (same sourceId). Default 4. */
  maxChunksPerDocument?: number;
  /** Max FAQ items in the final list. Default 6. */
  maxFaqs?: number;
  /** Max note items. Default 2. */
  maxNotes?: number;
  /** Max HTML items per page/source (for future). Default 4. */
  maxHtmlPerPage?: number;
  /** Text overlap threshold (Jaccard) above which two items are treated as duplicates. 0–1, default 0.85. */
  textOverlapDuplicateThreshold?: number;
  /** Min token count for text-overlap dedup (ignore very short snippets). Default 20. */
  minTokensForDedup?: number;
}

export const DEFAULT_DIVERSITY_OPTIONS: Required<UnifiedRetrievalDiversityOptions> = {
  maxChunksPerDocument: 4,
  maxFaqs: 6,
  maxNotes: 2,
  maxHtmlPerPage: 4,
  textOverlapDuplicateThreshold: 0.85,
  minTokensForDedup: 20,
};

/** Reason an item was skipped by diversity cap. */
export type SkippedReason =
  | 'max_chunks_per_document'
  | 'max_faqs'
  | 'max_notes'
  | 'max_html_per_page';

/** Result of applyDiversityAndDedup. */
export interface DiversitySelectionResult {
  /** Items after diversity and deduplication (order preserved). */
  selected: RankedKnowledgeItem[];
  /** Item ids removed as near-duplicates of an already-selected item. */
  removedAsDuplicate: string[];
  /** Item ids skipped due to diversity caps, with reason. */
  skippedByCap: Array<{ id: string; reason: SkippedReason }>;
}
