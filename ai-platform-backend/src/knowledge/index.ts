/**
 * Unified knowledge model: shared types, normalization, and mappers.
 * Use this to represent all knowledge sources (documents, FAQs, notes, HTML)
 * as KnowledgeItem[] for future unified retrieval. Existing retrieval and
 * prompt building are unchanged.
 *
 * Example - build unified list for later retrieval:
 *   const knowledgeItems: KnowledgeItem[] = [
 *     ...documentChunks.map(mapDocumentChunkToKnowledgeItem),
 *     ...faqs.map(mapFaqToKnowledgeItem),
 *     ...notes.map(mapNoteToKnowledgeItem),
 *     ...htmlChunks.map(mapHtmlPageChunkToKnowledgeItem),
 *   ];
 */

export type {
  KnowledgeSourceType,
  KnowledgeItemStatus,
  KnowledgeItemScores,
  KnowledgeItemMetadata,
  KnowledgeItemDocumentMetadata,
  KnowledgeItemHtmlMetadata,
  KnowledgeItemFaqMetadata,
  KnowledgeItemNoteMetadata,
  KnowledgeItem,
} from './knowledge.types';

export { KNOWLEDGE_SOURCE_TYPES } from './knowledge.types';

export {
  mapDocumentChunkToKnowledgeItem,
  mapFaqToKnowledgeItem,
  mapNoteToKnowledgeItem,
  mapHtmlPageChunkToKnowledgeItem,
} from './mappers';

export type {
  DocumentChunkInput,
  FaqInput,
  NoteInput,
  HtmlPageChunkInput,
} from './mappers';

export { normalizeKnowledgeText } from './normalize';
