/**
 * Shared retrieval types: EnrichedChunk (used by chat-engine debug and sources).
 * Unified retrieval uses unified-retrieval.types for ranked items.
 */

/** Lexical score component breakdown for debug (admin-safe). */
export interface LexicalBreakdown {
  titleBonus: number;
  headingBonus: number;
  phraseBonus: number;
  faqQuestionBonus: number;
}

/** Chunk with scores; used by chat-engine for sources and debug (from unified retrieval). */
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
