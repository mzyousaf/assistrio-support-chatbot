/**
 * Retrieval result types for RAG: hybrid scoring, confidence, and structured chunks.
 * Isolated for future vector DB migration.
 */

export type RetrievalConfidence = 'high' | 'medium' | 'low';

/** Lexical score component breakdown for debug (admin-safe). */
export interface LexicalBreakdown {
  titleBonus: number;
  headingBonus: number;
  phraseBonus: number;
  faqQuestionBonus: number;
}

/** Chunk with hybrid scores; title/url/sourceType may be filled by RAG or by caller from doc map. */
export interface EnrichedChunk {
  chunkId: string;
  documentId: string;
  title: string;
  text: string;
  semanticScore: number;
  lexicalScore: number;
  combinedScore: number;
  sourceType: string;
  url?: string;
  /** Present when retrieval computed breakdown for debug. */
  lexicalBreakdown?: LexicalBreakdown;
}

/** Counts by document sourceType (upload | url | manual). Admin/test debug only. */
export interface EligibleCountByDocumentSourceType {
  upload?: number;
  url?: number;
  manual?: number;
}

/** Optional metadata for RAG retrieval (admin debug / observability). No embeddings or secrets. */
export interface RetrievalMetadata {
  /** Bot ID used for the request (isolation check). */
  requestBotId: string;
  eligibleDocumentCount: number;
  eligibleChunkCount: number;
  chunksWithValidEmbeddingCount: number;
  retrievedChunkCount: number;
  /** Unique bot IDs in the retrieved chunks; should equal [requestBotId] when retrieval is isolated. */
  retrievedChunkBotIds: string[];
  /** Eligible document count by sourceType (upload, url, manual). Admin/test only. */
  eligibleDocumentCountBySourceType?: EligibleCountByDocumentSourceType;
  /** Eligible chunk count by document sourceType. Admin/test only. */
  eligibleChunkCountBySourceType?: EligibleCountByDocumentSourceType;
}

/** Result of getRelevantChunksForBotWithConfidence: chunks + confidence for grounding. */
export interface RetrievalResult {
  confidence: RetrievalConfidence;
  chunks: EnrichedChunk[];
  /** Present when caller needs doc/chunk counts for debug. */
  metadata?: RetrievalMetadata;
}

/** Configurable weights for hybrid scoring (semantic + lexical). */
export interface HybridScoreWeights {
  semantic: number;
  lexical: number;
}

export const DEFAULT_HYBRID_WEIGHTS: HybridScoreWeights = {
  semantic: 0.85,
  lexical: 0.15,
};

/** Thresholds for retrieval confidence (based on top combined score). */
export interface RetrievalConfidenceThresholds {
  highMin: number;
  mediumMin: number;
}

export const DEFAULT_CONFIDENCE_THRESHOLDS: RetrievalConfidenceThresholds = {
  highMin: 0.5,
  mediumMin: 0.25,
};
