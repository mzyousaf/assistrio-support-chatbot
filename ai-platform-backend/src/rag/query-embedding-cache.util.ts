/**
 * In-process TTL/LRU cache for query embeddings (dev/runtime memory only).
 */

export const QUERY_EMBEDDING_MODEL = 'text-embedding-3-small';
const TTL_MS = 5 * 60 * 1000;
const MAX_ENTRIES = 1000;

type CacheEntry = {
  vector: number[];
  expiresAt: number;
};

/** Normalize query text for stable cache keys. */
export function normalizeQueryForEmbeddingCache(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function buildQueryEmbeddingCacheKey(
  model: string,
  query: string,
  scope?: string,
): string {
  const norm = normalizeQueryForEmbeddingCache(query);
  const scopePart = scope?.trim() ? scope.trim() : '';
  return scopePart ? `${model}|${scopePart}|${norm}` : `${model}|${norm}`;
}

class QueryEmbeddingCache {
  private readonly map = new Map<string, CacheEntry>();

  get(key: string): number[] | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.map.delete(key);
      return undefined;
    }
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.vector;
  }

  set(key: string, vector: number[]): void {
    if (!vector.length) return;
    while (this.map.size >= MAX_ENTRIES) {
      const oldest = this.map.keys().next().value;
      if (oldest === undefined) break;
      this.map.delete(oldest);
    }
    this.map.set(key, { vector, expiresAt: Date.now() + TTL_MS });
  }

  clear(): void {
    this.map.clear();
  }

  size(): number {
    return this.map.size;
  }
}

export const queryEmbeddingCache = new QueryEmbeddingCache();
