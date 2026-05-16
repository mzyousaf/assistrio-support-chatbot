/**
 * Unit tests for diversity and deduplication in unified retrieval selection.
 */

import { applyDiversityAndDedup } from './unified-retrieval-selection';
import type { RankedKnowledgeItem } from './unified-retrieval.types';
import type { KnowledgeSourceType } from '../knowledge';

function item(
  id: string,
  sourceType: KnowledgeSourceType,
  sourceId: string,
  text: string,
  normalizedText: string,
  score: number,
): RankedKnowledgeItem {
  return {
    id,
    botId: 'bot1',
    sourceType,
    sourceId,
    title: `Title ${id}`,
    text,
    normalizedText,
    active: true,
    status: 'ready',
    semanticScore: score * 0.5,
    lexicalScore: score * 0.5,
    combinedScore: score,
  };
}

describe('applyDiversityAndDedup', () => {
  it('returns all items when under caps and no duplicates', () => {
    const items: RankedKnowledgeItem[] = [
      item('1', 'document', 'doc1', 'First chunk.', 'first chunk', 0.9),
      item('2', 'faq', 'faq1', 'Q: A?\nA: B', 'q a a b', 0.8),
      item('3', 'note', 'note1', 'Overview.', 'overview', 0.7),
    ];
    const result = applyDiversityAndDedup(items);
    expect(result.selected).toHaveLength(3);
    expect(result.removedAsDuplicate).toHaveLength(0);
    expect(result.skippedByCap).toHaveLength(0);
  });

  it('caps chunks per document', () => {
    const items: RankedKnowledgeItem[] = [
      item('1', 'document', 'doc1', 'Chunk A', 'chunk a', 0.95),
      item('2', 'document', 'doc1', 'Chunk B', 'chunk b', 0.9),
      item('3', 'document', 'doc1', 'Chunk C', 'chunk c', 0.85),
      item('4', 'document', 'doc1', 'Chunk D', 'chunk d', 0.8),
      item('5', 'document', 'doc1', 'Chunk E', 'chunk e', 0.75),
    ];
    const result = applyDiversityAndDedup(items, { maxChunksPerDocument: 3 });
    expect(result.selected).toHaveLength(3);
    expect(result.skippedByCap).toHaveLength(2);
    expect(result.skippedByCap.every((s) => s.reason === 'max_chunks_per_document')).toBe(true);
    expect(result.selected.map((s) => s.id)).toEqual(['1', '2', '3']);
  });

  it('caps FAQ items', () => {
    const items: RankedKnowledgeItem[] = [
      item('f1', 'faq', 'faq1', 'Q1\nA1', 'q1 a1', 0.9),
      item('f2', 'faq', 'faq2', 'Q2\nA2', 'q2 a2', 0.8),
      item('f3', 'faq', 'faq3', 'Q3\nA3', 'q3 a3', 0.7),
      item('f4', 'faq', 'faq4', 'Q4\nA4', 'q4 a4', 0.6),
      item('f5', 'faq', 'faq5', 'Q5\nA5', 'q5 a5', 0.5),
      item('f6', 'faq', 'faq6', 'Q6\nA6', 'q6 a6', 0.4),
      item('f7', 'faq', 'faq7', 'Q7\nA7', 'q7 a7', 0.3),
    ];
    const result = applyDiversityAndDedup(items, { maxFaqs: 4 });
    expect(result.selected).toHaveLength(4);
    expect(result.skippedByCap.filter((s) => s.reason === 'max_faqs')).toHaveLength(3);
  });

  it('removes near-duplicate by text overlap', () => {
    const sameContent = 'our refund policy allows returns within 30 days of purchase no questions asked';
    const items: RankedKnowledgeItem[] = [
      item('1', 'document', 'doc1', sameContent, sameContent, 0.9),
      item('2', 'document', 'doc1', sameContent + ' contact support', sameContent + ' contact support', 0.85),
    ];
    const result = applyDiversityAndDedup(items, {
      maxChunksPerDocument: 5,
      textOverlapDuplicateThreshold: 0.8,
      minTokensForDedup: 5,
    });
    expect(result.selected).toHaveLength(1);
    expect(result.removedAsDuplicate).toContain('2');
  });

  it('preserves complementary evidence across source types', () => {
    const items: RankedKnowledgeItem[] = [
      item('d1', 'document', 'doc1', 'Doc chunk.', 'doc chunk', 0.9),
      item('f1', 'faq', 'faq1', 'Q?\nA:', 'q a', 0.85),
      item('n1', 'note', 'note1', 'Note.', 'note', 0.8),
      item('d2', 'document', 'doc2', 'Other doc.', 'other doc', 0.75),
    ];
    const result = applyDiversityAndDedup(items);
    expect(result.selected).toHaveLength(4);
    expect(result.selected.map((s) => s.sourceType)).toEqual(['document', 'faq', 'note', 'document']);
  });

  it('uses default options when not provided', () => {
    const items: RankedKnowledgeItem[] = [
      item('1', 'document', 'doc1', 'A', 'a', 0.9),
    ];
    const result = applyDiversityAndDedup(items);
    expect(result.selected).toHaveLength(1);
    expect(result.removedAsDuplicate).toHaveLength(0);
    expect(result.skippedByCap).toHaveLength(0);
  });
});
