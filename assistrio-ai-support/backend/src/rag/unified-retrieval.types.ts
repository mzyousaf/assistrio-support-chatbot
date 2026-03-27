/**
 * Types for unified knowledge retrieval: one ranked list across documents, FAQs, notes, HTML.
 */

import type { KnowledgeItem, KnowledgeItemMetadata, KnowledgeSourceType } from '../knowledge';

/** A knowledge item with required score fields from retrieval. */
export interface RankedKnowledgeItem extends Omit<KnowledgeItem, 'scores'> {
  sourceType: KnowledgeSourceType;
  sourceId: string;
  title: string;
  section?: string;
  text: string;
  metadata?: KnowledgeItemMetadata;
  semanticScore: number;
  lexicalScore: number;
  combinedScore: number;
}

/** Eligible counts by source type (debug). */
export interface UnifiedRetrievalEligibleCounts {
  document?: number;
  faq?: number;
  note?: number;
  html?: number;
}

/** Full score breakdown for one item (debug). */
export interface RankedItemScoreBreakdown {
  id: string;
  sourceType: KnowledgeSourceType;
  title: string;
  semanticScore: number;
  lexicalScore: number;
  exactPhraseScore: number;
  headingMatchScore: number;
  titleMatchScore: number;
  faqQuestionMatchScore: number;
  combinedScore: number;
}

/** Diversity/dedup selection debug (when debug is requested). */
export interface UnifiedRetrievalDiversityDebug {
  /** Item ids removed as near-duplicates. */
  removedAsDuplicate: string[];
  /** Item ids skipped due to diversity caps, with reason. */
  skippedByCap: Array<{ id: string; reason: string }>;
  /** Final selected count after diversity and dedup. */
  finalSelectedCount: number;
  /** Final selected items (same as result.items; for inspection when debug). */
  finalSelectedIds?: string[];
}

/** Debug info when unified retrieval is run (e.g. debug mode). */
export interface UnifiedRetrievalDebug {
  /** Whether unified retrieval was used this request. */
  usedUnifiedPath: boolean;
  /** Distinct knowledge base item ids in the result (for source/debug). */
  knowledgeBaseItemIds?: string[];
  /** Eligible item counts by source type. */
  eligibleCountBySourceType: UnifiedRetrievalEligibleCounts;
  /** Retrieved ranked items grouped by source type (for inspection). */
  retrievedBySourceType?: Partial<Record<KnowledgeSourceType, RankedKnowledgeItem[]>>;
  /** Score breakdown per item (top N). */
  scoreBreakdown?: RankedItemScoreBreakdown[];
  /** Diversity/dedup: removed duplicates, skipped by cap, final count. */
  diversityDebug?: UnifiedRetrievalDiversityDebug;
}

/** Result of getRelevantKnowledgeItemsForBot. */
export interface UnifiedRetrievalResult {
  /** Ranked knowledge items (all sources combined). */
  items: RankedKnowledgeItem[];
  /** Present when debug is requested. */
  debug?: UnifiedRetrievalDebug;
}

import type { UnifiedRetrievalWeights } from './unified-retrieval-scoring';
import type { UnifiedRetrievalDiversityOptions } from './unified-retrieval-selection.types';

/** Re-export for callers. */
export type { UnifiedRetrievalWeights };
export type { UnifiedRetrievalDiversityOptions } from './unified-retrieval-selection.types';

/** Options for unified retrieval. */
export interface UnifiedRetrievalOptions {
  limit?: number;
  apiKeyOverride?: string;
  /** When true, include debug info in result. */
  debug?: boolean;
  /** Optional weights override for combined score (default: balanced hybrid). */
  weights?: UnifiedRetrievalWeights;
  /** Optional diversity and deduplication options (default: sensible caps and 0.85 text overlap threshold). */
  diversity?: UnifiedRetrievalDiversityOptions;
}
