import type { RagService } from './rag.service';
import {
  buildQueryEmbeddingCacheKey,
  QUERY_EMBEDDING_MODEL,
  queryEmbeddingCache,
} from './query-embedding-cache.util';

export type EmbedQueryWithCacheResult = {
  embedding: number[];
  cacheHit: boolean;
  durationMs: number;
};

/**
 * Embed a user query with in-memory TTL cache (successful vectors only).
 */
export async function embedQueryWithCache(
  ragService: RagService,
  query: string,
  options?: { apiKeyOverride?: string; cacheScope?: string },
): Promise<EmbedQueryWithCacheResult> {
  const trimmed = (query ?? '').trim();
  if (!trimmed) {
    return { embedding: [], cacheHit: false, durationMs: 0 };
  }

  const key = buildQueryEmbeddingCacheKey(
    QUERY_EMBEDDING_MODEL,
    trimmed,
    options?.cacheScope,
  );
  const cached = queryEmbeddingCache.get(key);
  if (cached) {
    return { embedding: cached, cacheHit: true, durationMs: 0 };
  }

  const start = Date.now();
  const embedding = await ragService.embedText(trimmed, options?.apiKeyOverride);
  const durationMs = Date.now() - start;
  if (embedding.length > 0) {
    queryEmbeddingCache.set(key, embedding);
  }
  return { embedding, cacheHit: false, durationMs };
}
