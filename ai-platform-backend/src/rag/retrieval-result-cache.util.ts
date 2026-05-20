/**
 * Short-TTL in-memory cache for full unified retrieval results (post-scoring/diversity).
 */

import { normalizeQueryForEmbeddingCache } from './query-embedding-cache.util';
import type { UnifiedRetrievalResult } from './unified-retrieval.types';

export type RetrievalResultCacheKeyInput = {
  botId: string;
  query: string;
  answerMode: string;
  retrievalLimit: number;
  maxItemsToScore: number;
  maxEvidenceItems: number;
  maxEvidenceTokens: number;
  /** Stable KB + retrieval-config stamp (not bot.updatedAt). */
  knowledgeVersion: string;
  restrictToKnowledgeBaseItemId?: string;
};

export type RetrievalResultCacheLookup = {
  result?: UnifiedRetrievalResult;
  missReason?: 'not_found' | 'expired';
};

function retrievalResultCacheTtlMs(): number {
  return process.env.NODE_ENV === 'development' ? 60_000 : 30_000;
}

const MAX_ENTRIES = 500;

type CacheEntry = {
  result: UnifiedRetrievalResult;
  expiresAt: number;
};

class RetrievalResultCache {
  private readonly map = new Map<string, CacheEntry>();

  buildKey(input: RetrievalResultCacheKeyInput): string {
    if (input.restrictToKnowledgeBaseItemId?.trim()) {
      return [
        input.botId,
        input.restrictToKnowledgeBaseItemId.trim(),
        normalizeQueryForEmbeddingCache(input.query),
        input.knowledgeVersion,
      ].join('|');
    }
    return [
      input.botId,
      normalizeQueryForEmbeddingCache(input.query),
      input.answerMode,
      String(input.retrievalLimit),
      String(input.maxItemsToScore),
      String(input.maxEvidenceItems),
      String(input.maxEvidenceTokens),
      input.knowledgeVersion,
    ].join('|');
  }

  lookup(key: string): RetrievalResultCacheLookup {
    const entry = this.map.get(key);
    if (!entry) return { missReason: 'not_found' };
    if (Date.now() > entry.expiresAt) {
      this.map.delete(key);
      return { missReason: 'expired' };
    }
    this.map.delete(key);
    this.map.set(key, entry);
    return { result: cloneRetrievalResult(entry.result) };
  }

  get(key: string): UnifiedRetrievalResult | undefined {
    return this.lookup(key).result;
  }

  set(key: string, result: UnifiedRetrievalResult): void {
    if (!result.items?.length) {
      return;
    }
    while (this.map.size >= MAX_ENTRIES) {
      const oldest = this.map.keys().next().value;
      if (oldest === undefined) break;
      this.map.delete(oldest);
    }
    this.map.set(key, {
      result: cloneRetrievalResult(result),
      expiresAt: Date.now() + retrievalResultCacheTtlMs(),
    });
  }

  clear(): void {
    this.map.clear();
  }
}

function cloneRetrievalResult(result: UnifiedRetrievalResult): UnifiedRetrievalResult {
  return {
    items: result.items.map((item) => ({ ...item })),
    ...(result.debug ? { debug: JSON.parse(JSON.stringify(result.debug)) } : {}),
    ...(result.timing ? { timing: { ...result.timing } } : {}),
  };
}

export const retrievalResultCache = new RetrievalResultCache();

export function applyRetrievalResultCacheHitTiming(
  result: UnifiedRetrievalResult,
): UnifiedRetrievalResult {
  const candidateChunksCount = result.timing?.candidateChunksCount ?? result.items.length;
  return {
    ...result,
    timing: {
      queryEmbeddingMs: 0,
      chunkAggregateMs: 0,
      scoringMs: 0,
      diversityDedupMs: 0,
      candidateChunksCount,
      scoredChunksCount: result.timing?.scoredChunksCount ?? result.items.length,
      queryEmbeddingCacheHit: result.timing?.queryEmbeddingCacheHit ?? false,
      retrievalResultCacheHit: true,
    },
  };
}
