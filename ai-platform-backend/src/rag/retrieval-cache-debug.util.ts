import { createHash } from 'crypto';
import { chatLog } from '../chat/chat-logger';
import { normalizeQueryForEmbeddingCache } from './query-embedding-cache.util';
import type { RetrievalResultCacheKeyInput } from './retrieval-result-cache.util';

export function isRetrievalCacheDebugEnabled(): boolean {
  return process.env.DEBUG_RETRIEVAL_CACHE?.trim().toLowerCase() === 'true';
}

export type RetrievalCacheMissReason =
  | 'not_found'
  | 'expired'
  | 'empty_query'
  | 'cache_disabled'
  | 'set_skipped_empty_items';

export type RetrievalCacheDebugPayload = {
  cacheKeyHash: string;
  normalizedQueryHash: string;
  botId: string;
  answerMode: string;
  retrievalLimit: number;
  maxItemsToScore: number;
  maxEvidenceItems: number;
  maxEvidenceTokens: number;
  knowledgeVersion: string;
  retrievalConfigFingerprint?: string;
  cacheHit: boolean;
  cacheMissReason?: RetrievalCacheMissReason;
  cacheSet?: boolean;
};

export function hashCacheKeyString(key: string): string {
  return createHash('sha256').update(key).digest('hex').slice(0, 16);
}

export function hashNormalizedQuery(query: string): string {
  return hashCacheKeyString(normalizeQueryForEmbeddingCache(query));
}

export function logRetrievalCacheDebug(
  input: RetrievalResultCacheKeyInput,
  cacheKey: string,
  opts: {
    cacheHit: boolean;
    cacheMissReason?: RetrievalCacheMissReason;
    cacheSet?: boolean;
    retrievalConfigFingerprint?: string;
  },
): void {
  if (!isRetrievalCacheDebugEnabled()) return;
  const payload: RetrievalCacheDebugPayload = {
    cacheKeyHash: hashCacheKeyString(cacheKey),
    normalizedQueryHash: hashNormalizedQuery(input.query),
    botId: input.botId,
    answerMode: input.answerMode,
    retrievalLimit: input.retrievalLimit,
    maxItemsToScore: input.maxItemsToScore,
    maxEvidenceItems: input.maxEvidenceItems,
    maxEvidenceTokens: input.maxEvidenceTokens,
    knowledgeVersion: input.knowledgeVersion,
    retrievalConfigFingerprint: opts.retrievalConfigFingerprint,
    cacheHit: opts.cacheHit,
    cacheMissReason: opts.cacheMissReason,
    cacheSet: opts.cacheSet,
  };
  chatLog({
    event: 'retrieval_cache_debug',
    level: 'info',
    botId: input.botId,
    metadata: payload as unknown as Record<string, unknown>,
  });
}
