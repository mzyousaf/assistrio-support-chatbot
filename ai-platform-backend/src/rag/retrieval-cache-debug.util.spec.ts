import { chatLog } from '../chat/chat-logger';
import {
  hashNormalizedQuery,
  isRetrievalCacheDebugEnabled,
  logRetrievalCacheDebug,
} from './retrieval-cache-debug.util';
import { retrievalResultCache } from './retrieval-result-cache.util';

jest.mock('../chat/chat-logger', () => ({
  chatLog: jest.fn(),
}));

describe('retrieval-cache-debug.util', () => {
  const prev = process.env.DEBUG_RETRIEVAL_CACHE;

  afterEach(() => {
    process.env.DEBUG_RETRIEVAL_CACHE = prev;
    jest.clearAllMocks();
  });

  it('is disabled by default', () => {
    delete process.env.DEBUG_RETRIEVAL_CACHE;
    expect(isRetrievalCacheDebugEnabled()).toBe(false);
  });

  it('logs hashes without raw query text', () => {
    process.env.DEBUG_RETRIEVAL_CACHE = 'true';
    const input = {
      botId: 'bot1',
      query: 'Tell me about Assistrio',
      answerMode: 'knowledge_first',
      retrievalLimit: 25,
      maxItemsToScore: 300,
      maxEvidenceItems: 8,
      maxEvidenceTokens: 2200,
      knowledgeVersion: 'notes:1|prio:default|faq,note,table,document,suggestion|kb:1',
    };
    const key = retrievalResultCache.buildKey(input);
    logRetrievalCacheDebug(input, key, { cacheHit: false, cacheMissReason: 'not_found' });

    expect(chatLog).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'retrieval_cache_debug',
        metadata: expect.objectContaining({
          cacheHit: false,
          cacheMissReason: 'not_found',
          normalizedQueryHash: hashNormalizedQuery('Tell me about Assistrio'),
        }),
      }),
    );
    const serialized = JSON.stringify((chatLog as jest.Mock).mock.calls[0][0]);
    expect(serialized).not.toContain('Tell me about Assistrio');
  });
});
