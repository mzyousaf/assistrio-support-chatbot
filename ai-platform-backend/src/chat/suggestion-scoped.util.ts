import type { RankedKnowledgeItem } from '../rag/unified-retrieval.types';

/**
 * Single synthetic retrieval item: visitor chose a chip with scoped `context` — no full KB for this turn.
 */
export function buildSuggestionScopedRankedItem(contextText: string, botId: string): RankedKnowledgeItem {
  const text = contextText.trim();
  return {
    id: 'suggestion-scoped',
    botId: String(botId),
    sourceType: 'note',
    sourceId: 'suggestion-scoped',
    title: 'Visitor-selected suggestion',
    section: 'Use only the text below for company-specific facts in this reply. Do not use the rest of the knowledge base for this turn.',
    text,
    normalizedText: text.toLowerCase().replace(/\s+/g, ' ').trim(),
    active: true,
    status: 'ready',
    semanticScore: 1,
    lexicalScore: 1,
    combinedScore: 1,
  };
}
