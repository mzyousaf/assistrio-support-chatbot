import {
  applyRetrievalResultCacheHitTiming,
  retrievalResultCache,
  type RetrievalResultCacheKeyInput,
} from './retrieval-result-cache.util';
import type { UnifiedRetrievalResult } from './unified-retrieval.types';

describe('retrievalResultCache', () => {
  const baseKey: RetrievalResultCacheKeyInput = {
    botId: 'bot1',
    query: 'What does Assistrio do?',
    answerMode: 'knowledge_first',
    retrievalLimit: 25,
    maxItemsToScore: 300,
    maxEvidenceItems: 8,
    maxEvidenceTokens: 2200,
    knowledgeVersion: 'v1',
  };

  const sampleResult: UnifiedRetrievalResult = {
    items: [
      {
        id: 'c1',
        botId: 'bot1',
        sourceType: 'document',
        sourceId: 'item1',
        title: 'Doc',
        text: 'Assistrio helps teams.',
        normalizedText: 'assistrio helps teams',
        semanticScore: 0.9,
        lexicalScore: 0.5,
        combinedScore: 0.8,
        active: true,
        status: 'ready',
      },
    ],
    timing: {
      queryEmbeddingMs: 800,
      chunkAggregateMs: 1800,
      scoringMs: 50,
      diversityDedupMs: 5,
      candidateChunksCount: 10,
      scoredChunksCount: 10,
      queryEmbeddingCacheHit: false,
      retrievalResultCacheHit: false,
    },
  };

  beforeEach(() => {
    retrievalResultCache.clear();
  });

  it('returns cached result and zeros retrieval timings on hit', () => {
    const key = retrievalResultCache.buildKey(baseKey);
    retrievalResultCache.set(key, sampleResult);
    const hit = retrievalResultCache.get(key);
    expect(hit?.items).toHaveLength(1);
    const timed = applyRetrievalResultCacheHitTiming(hit!);
    expect(timed.timing?.retrievalResultCacheHit).toBe(true);
    expect(timed.timing?.queryEmbeddingMs).toBe(0);
    expect(timed.timing?.chunkAggregateMs).toBe(0);
    expect(timed.timing?.scoringMs).toBe(0);
  });

  it('changes cache key when answerMode changes', () => {
    const k1 = retrievalResultCache.buildKey(baseKey);
    const k2 = retrievalResultCache.buildKey({ ...baseKey, answerMode: 'knowledge_only' });
    expect(k1).not.toBe(k2);
  });

  it('does not cache empty retrieval results', () => {
    const key = retrievalResultCache.buildKey(baseKey);
    retrievalResultCache.set(key, { items: [] });
    expect(retrievalResultCache.get(key)).toBeUndefined();
  });

  it('cache key normalizes query whitespace and casing', () => {
    const k1 = retrievalResultCache.buildKey(baseKey);
    const k2 = retrievalResultCache.buildKey({
      ...baseKey,
      query: '  What Does Assistrio Do?  ',
    });
    expect(k1).toBe(k2);
  });

  it('cache key does not include conversation or request ids', () => {
    const key = retrievalResultCache.buildKey(baseKey);
    expect(key).not.toMatch(/conversation|request|messageCount/i);
    expect(key.split('|')).toHaveLength(8);
  });

  it('lookup reports expired vs not_found', () => {
    const key = retrievalResultCache.buildKey(baseKey);
    expect(retrievalResultCache.lookup(key).missReason).toBe('not_found');
    retrievalResultCache.set(key, sampleResult);
    expect(retrievalResultCache.lookup(key).result).toBeDefined();
  });
});
