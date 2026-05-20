import {
  buildQueryEmbeddingCacheKey,
  normalizeQueryForEmbeddingCache,
  queryEmbeddingCache,
  QUERY_EMBEDDING_MODEL,
} from './query-embedding-cache.util';

describe('query-embedding-cache', () => {
  beforeEach(() => {
    queryEmbeddingCache.clear();
  });

  it('normalizes query text for cache keys', () => {
    expect(normalizeQueryForEmbeddingCache('  Tell   Me   About  ')).toBe('tell me about');
  });

  it('returns cache hit for repeated normalized query', () => {
    const key = buildQueryEmbeddingCacheKey(QUERY_EMBEDDING_MODEL, 'Tell me about Assistrio');
    queryEmbeddingCache.set(key, [0.1, 0.2]);
    expect(queryEmbeddingCache.get(key)).toEqual([0.1, 0.2]);
  });

  it('cache miss for different query', () => {
    const keyA = buildQueryEmbeddingCacheKey(QUERY_EMBEDDING_MODEL, 'query a');
    const keyB = buildQueryEmbeddingCacheKey(QUERY_EMBEDDING_MODEL, 'query b');
    queryEmbeddingCache.set(keyA, [0.1]);
    expect(queryEmbeddingCache.get(keyB)).toBeUndefined();
  });

  it('cache miss for different model key', () => {
    const key = buildQueryEmbeddingCacheKey('other-model', 'same query');
    queryEmbeddingCache.set(
      buildQueryEmbeddingCacheKey(QUERY_EMBEDDING_MODEL, 'same query'),
      [0.5],
    );
    expect(queryEmbeddingCache.get(key)).toBeUndefined();
  });

  it('expires entries after TTL', () => {
    const key = buildQueryEmbeddingCacheKey(QUERY_EMBEDDING_MODEL, 'ttl test');
    const now = Date.now();
    jest.spyOn(Date, 'now').mockReturnValue(now);
    queryEmbeddingCache.set(key, [1]);
    jest.spyOn(Date, 'now').mockReturnValue(now + 5 * 60 * 1000 + 1);
    expect(queryEmbeddingCache.get(key)).toBeUndefined();
    jest.restoreAllMocks();
  });
});
