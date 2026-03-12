/**
 * Unit tests for retrieval helpers: confidence, diversity, excerpt normalization.
 */

import {
  applyChunkDiversity,
  combinedScore,
  getRetrievalConfidence,
  lexicalScore,
  normalizeSourceExcerpt,
  SOURCE_EXCERPT_MAX_CHARS,
} from './retrieval-helpers';

describe('lexicalScore', () => {
  it('returns 0 for empty', () => {
    expect(lexicalScore('', 'hello')).toBe(0);
    expect(lexicalScore('hi', '')).toBe(0);
  });

  it('returns higher when query tokens appear in chunk', () => {
    expect(lexicalScore('pricing plan', 'our pricing plan is simple')).toBeGreaterThan(0);
    expect(lexicalScore('xyz', 'hello world')).toBe(0);
  });
});

describe('combinedScore', () => {
  it('combines semantic and lexical within 0-1', () => {
    const s = combinedScore(0.8, 0.2);
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(1);
  });
});

describe('getRetrievalConfidence', () => {
  it('returns high for score >= highMin', () => {
    expect(getRetrievalConfidence(0.6)).toBe('high');
    expect(getRetrievalConfidence(0.5)).toBe('high');
  });

  it('returns medium for score in [mediumMin, highMin)', () => {
    expect(getRetrievalConfidence(0.3)).toBe('medium');
    expect(getRetrievalConfidence(0.25)).toBe('medium');
  });

  it('returns low for score < mediumMin', () => {
    expect(getRetrievalConfidence(0.2)).toBe('low');
    expect(getRetrievalConfidence(0)).toBe('low');
  });
});

describe('applyChunkDiversity', () => {
  it('caps chunks per document', () => {
    const chunks = [
      { chunkId: '1', documentId: 'doc1', title: 'A', text: 'a', semanticScore: 0.9, lexicalScore: 0, combinedScore: 0.9, sourceType: 'doc' },
      { chunkId: '2', documentId: 'doc1', title: 'A', text: 'b', semanticScore: 0.85, lexicalScore: 0, combinedScore: 0.85, sourceType: 'doc' },
      { chunkId: '3', documentId: 'doc1', title: 'A', text: 'c', semanticScore: 0.8, lexicalScore: 0, combinedScore: 0.8, sourceType: 'doc' },
      { chunkId: '4', documentId: 'doc2', title: 'B', text: 'd', semanticScore: 0.7, lexicalScore: 0, combinedScore: 0.7, sourceType: 'doc' },
    ];
    const out = applyChunkDiversity(chunks, 2);
    const doc1Count = out.filter((c) => c.documentId === 'doc1').length;
    expect(doc1Count).toBe(2);
    expect(out.length).toBe(3);
  });
});

describe('normalizeSourceExcerpt', () => {
  it('trims and collapses whitespace', () => {
    expect(normalizeSourceExcerpt('  hello   world  ')).toBe('hello world');
  });

  it('caps at maxChars with ellipsis', () => {
    const long = 'a'.repeat(500);
    const out = normalizeSourceExcerpt(long, 100);
    expect(out.length).toBeLessThanOrEqual(101);
    expect(out.endsWith('…')).toBe(true);
  });

  it('uses default SOURCE_EXCERPT_MAX_CHARS when not provided', () => {
    const long = 'a'.repeat(1000);
    const out = normalizeSourceExcerpt(long);
    expect(out.length).toBeLessThanOrEqual(SOURCE_EXCERPT_MAX_CHARS + 2);
  });
});
