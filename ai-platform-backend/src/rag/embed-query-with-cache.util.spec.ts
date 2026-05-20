import { embedQueryWithCache } from './embed-query-with-cache.util';
import { queryEmbeddingCache } from './query-embedding-cache.util';

describe('embedQueryWithCache', () => {
  beforeEach(() => {
    queryEmbeddingCache.clear();
  });

  it('returns cache hit without calling rag embed', async () => {
    const rag = { embedText: jest.fn() };
    queryEmbeddingCache.set('text-embedding-3-small|b1|hello', [0.9]);
    const result = await embedQueryWithCache(rag as never, 'Hello', {
      cacheScope: 'b1',
    });
    expect(result.cacheHit).toBe(true);
    expect(result.durationMs).toBe(0);
    expect(rag.embedText).not.toHaveBeenCalled();
  });

  it('calls rag on miss and stores vector', async () => {
    const rag = { embedText: jest.fn().mockResolvedValue([0.3, 0.4]) };
    const result = await embedQueryWithCache(rag as never, 'New query', {
      cacheScope: 'bot-x',
    });
    expect(result.cacheHit).toBe(false);
    expect(result.embedding).toEqual([0.3, 0.4]);
    expect(rag.embedText).toHaveBeenCalledTimes(1);
    const second = await embedQueryWithCache(rag as never, 'New query', {
      cacheScope: 'bot-x',
    });
    expect(second.cacheHit).toBe(true);
    expect(rag.embedText).toHaveBeenCalledTimes(1);
  });
});
