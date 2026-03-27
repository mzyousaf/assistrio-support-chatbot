/**
 * Unified internal knowledge model: types and normalization.
 * All knowledge sources (documents, FAQs, notes, HTML) can be represented as KnowledgeItem
 * for future unified retrieval, ranking, and prompt building.
 */

/** Source type for the unified knowledge model (documents, FAQs, notes, URL, HTML). */
export type KnowledgeSourceType = 'document' | 'faq' | 'note' | 'url' | 'html';

/** All valid KnowledgeSourceType values (for schema enums and validation). */
export const KNOWLEDGE_SOURCE_TYPES: KnowledgeSourceType[] = ['document', 'faq', 'note', 'url', 'html'];

/** Status of a knowledge item (ready for use, failed, or pending). */
export type KnowledgeItemStatus = 'ready' | 'failed' | 'pending';

/** Optional score fields for future ranking (lexical, semantic, combined). */
export interface KnowledgeItemScores {
  semanticScore?: number;
  lexicalScore?: number;
  combinedScore?: number;
}

/** Metadata for document-derived knowledge. */
export interface KnowledgeItemDocumentMetadata {
  url?: string;
  fileName?: string;
  fileType?: string;
  sourceType?: 'upload' | 'url' | 'manual';
}

/** Metadata for HTML-derived knowledge. */
export interface KnowledgeItemHtmlMetadata {
  url: string;
  pageTitle: string;
  sourceType: 'html';
}

/** Metadata for FAQ (optional, for provenance). */
export interface KnowledgeItemFaqMetadata {
  sourceType: 'faq';
}

/** Metadata for note (optional). */
export interface KnowledgeItemNoteMetadata {
  sourceType: 'note';
}

export type KnowledgeItemMetadata =
  | KnowledgeItemDocumentMetadata
  | KnowledgeItemHtmlMetadata
  | KnowledgeItemFaqMetadata
  | KnowledgeItemNoteMetadata
  | Record<string, unknown>;

/**
 * Unified knowledge item: single unit of knowledge from any source.
 * Used for retrieval, ranking, and prompt building without replacing existing pipelines.
 */
export interface KnowledgeItem {
  /** Unique id (chunk id, faq id, note id, or html chunk id). */
  id: string;
  /** Bot this item belongs to. */
  botId: string;
  /** Source type. */
  sourceType: KnowledgeSourceType;
  /** Id of the source entity (documentId, faqId, noteId, or htmlPageId). */
  sourceId: string;
  /** Display title (document title, FAQ question, note title, or HTML page title). */
  title: string;
  /** Section or heading if available (e.g. document section, HTML heading). */
  section?: string;
  /** Original content (kept unchanged for prompt use). */
  text: string;
  /** Normalized text for lexical scoring (lowercase, trimmed, whitespace collapsed). */
  normalizedText: string;
  /** Optional structured metadata (URL, page title, etc.). */
  metadata?: KnowledgeItemMetadata;
  /** Whether this item is active for retrieval. */
  active: boolean;
  /** Item status. */
  status: KnowledgeItemStatus;
  /** Optional scores for ranking (filled during retrieval). */
  scores?: KnowledgeItemScores;
}
