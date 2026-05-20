/**
 * Retrieval from KnowledgeBaseChunk + KnowledgeBaseItem.
 * Single source of truth for unified knowledge retrieval at runtime.
 */

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import type { KnowledgeItem } from './knowledge.types';
import { normalizeKnowledgeText } from './normalize';
import { KnowledgeBaseChunk } from '../models/knowledge-base-chunk.schema';
import { KnowledgeBaseItem } from '../models/knowledge-base-item.schema';
import { Bot } from '../models';
import { RagService } from '../rag/rag.service';
import { lexicalScore } from '../rag/retrieval-helpers';
import {
  scoreKnowledgeItem,
  DEFAULT_UNIFIED_RETRIEVAL_WEIGHTS,
} from '../rag/unified-retrieval-scoring';
import { applyDiversityAndDedup } from '../rag/unified-retrieval-selection';
import { effectiveKbDocumentFileMetaLean } from './knowledge-base-document-sync-fields.util';
import {
  knowledgeBaseItemEligibleForRuntimeRetrieval,
  knowledgeRuntimeRetrievalMatchParts,
} from './knowledge-runtime-retrieval-eligibility.util';
import type {
  RankedKnowledgeItem,
  UnifiedRetrievalResult,
  UnifiedRetrievalOptions,
  UnifiedRetrievalEligibleCounts,
  UnifiedRetrievalDebug,
  RankedItemScoreBreakdown,
} from '../rag/unified-retrieval.types';
import type { UnifiedScoreBreakdown } from '../rag/unified-retrieval-scoring';
import {
  normalizeKnowledgeReplyPrioritySettings,
  sourcePriorityRankMap,
} from './knowledge-reply-priority.util';
import {
  getChatMaxEvidenceItems,
  getChatMaxEvidenceTokens,
  getChatMaxItemsToScore,
} from '../chat/chat-retrieval-config.util';
import { embedQueryWithCache } from '../rag/embed-query-with-cache.util';
import {
  applyRetrievalResultCacheHitTiming,
  retrievalResultCache,
  type RetrievalResultCacheKeyInput,
} from '../rag/retrieval-result-cache.util';
import { logChatRetrievalMongoDebug } from './chat-retrieval-mongo-debug.util';
import { buildRetrievalKnowledgeVersionStamp } from './knowledge-retrieval-version.util';
import {
  logRetrievalCacheDebug,
  type RetrievalCacheMissReason,
} from '../rag/retrieval-cache-debug.util';
import {
  loadChunksWithPerItemCap,
  mergeChunksFairRoundRobin,
  shouldUseSimpleChunkLoad,
  type ChunkRow,
} from './knowledge-chunk-load.util';

const DEFAULT_LIMIT = 20;

/**
 * Legacy global `.limit(500)` applied to the whole bot; with many KB items, early rows (often one huge
 * document) could consume the entire cap and starve later items. Per-item budgets guarantee each eligible
 * source contributes candidates; round-robin merge ensures the scoring cap sees a mix of items,
 * not only the first KB item in cursor order.
 */
const SINGLE_ELIGIBLE_ITEM_CHUNK_CAP = 500;

/** Upper bound on chunk rows passed to embedding similarity after fair merge (latency / memory). */
const MULTI_ITEM_TOTAL_CANDIDATE_CAP = 900;

/** When several KB items compete, no single item may take the whole merged candidate set. */
const MULTI_ITEM_PER_ITEM_MAX = 120;

/** Floor so many small sources still get a minimal slice of the global budget. */
const MULTI_ITEM_PER_ITEM_MIN = 8;
const PRIORITY_TIE_BREAK_DELTA = 0.05;

function multiItemPerItemChunkBudget(itemCount: number): number {
  if (itemCount <= 0) return MULTI_ITEM_PER_ITEM_MAX;
  const split = Math.ceil(MULTI_ITEM_TOTAL_CANDIDATE_CAP / itemCount);
  return Math.min(MULTI_ITEM_PER_ITEM_MAX, Math.max(MULTI_ITEM_PER_ITEM_MIN, split));
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

type ItemRow = {
  _id: Types.ObjectId;
  botId: Types.ObjectId;
  title: string;
  sourceType: string;
  content?: string;
  fileMeta?: { url?: string };
  faqMeta?: { questions?: string[] };
};

@Injectable()
export class KnowledgeBaseRetrievalService {
  constructor(
    private readonly ragService: RagService,
    @InjectModel(Bot.name) private readonly botModel: Model<Bot>,
    @InjectModel(KnowledgeBaseItem.name) private readonly itemModel: Model<KnowledgeBaseItem>,
    @InjectModel(KnowledgeBaseChunk.name) private readonly chunkModel: Model<KnowledgeBaseChunk>,
  ) {}

  /**
   * Load and rank knowledge from KnowledgeBaseChunk + KnowledgeBaseItem.
   * Only items that pass {@link knowledgeRuntimeRetrievalMatchParts} are included; chunk rows are
   * skipped unless the parent row still passes {@link knowledgeBaseItemEligibleForRuntimeRetrieval}.
   */
  async getRelevantKnowledgeItemsFromKnowledgeBase(
    botId: string,
    query: string,
    options: UnifiedRetrievalOptions = {},
  ): Promise<UnifiedRetrievalResult> {
    const queryTrimmed = (query ?? '').trim();
    const emptyCounts = (): UnifiedRetrievalEligibleCounts => ({
      document: 0,
      faq: 0,
      note: 0,
      html: 0,
      table: 0,
      suggestion: 0,
    });
    const eligibleCounts: UnifiedRetrievalEligibleCounts = emptyCounts();

    if (!Types.ObjectId.isValid(botId)) {
      return this.emptyResult(eligibleCounts, options.debug ?? false);
    }

    const botOid = new Types.ObjectId(botId);
    const botFlags = await this.botModel
      .findById(botOid)
      .select('includeNotesInKnowledge knowledgeReplyPriority')
      .lean();

    const includeNotes = (botFlags?.includeNotesInKnowledge as boolean | undefined) !== false;
    const knowledgeVersion = await buildRetrievalKnowledgeVersionStamp(this.itemModel, botOid, {
      includeNotesInKnowledge: includeNotes,
      knowledgeReplyPriority: (botFlags as { knowledgeReplyPriority?: unknown } | null)
        ?.knowledgeReplyPriority,
    });
    const retrievalLimit = options.limit ?? DEFAULT_LIMIT;
    const cacheKeyInput: RetrievalResultCacheKeyInput | undefined =
      options.disableRetrievalResultCache
        ? undefined
        : {
            botId,
            query: queryTrimmed,
            answerMode: options.answerMode ?? 'knowledge_first',
            retrievalLimit,
            maxItemsToScore: getChatMaxItemsToScore(),
            maxEvidenceItems: options.maxEvidenceItems ?? getChatMaxEvidenceItems(),
            maxEvidenceTokens: options.maxEvidenceTokens ?? getChatMaxEvidenceTokens(),
            knowledgeVersion,
            restrictToKnowledgeBaseItemId: options.restrictToKnowledgeBaseItemId,
          };
    if (!cacheKeyInput) {
      logRetrievalCacheDebug(
        {
          botId,
          query: queryTrimmed,
          answerMode: options.answerMode ?? 'knowledge_first',
          retrievalLimit,
          maxItemsToScore: getChatMaxItemsToScore(),
          maxEvidenceItems: options.maxEvidenceItems ?? getChatMaxEvidenceItems(),
          maxEvidenceTokens: options.maxEvidenceTokens ?? getChatMaxEvidenceTokens(),
          knowledgeVersion,
        },
        '',
        { cacheHit: false, cacheMissReason: 'cache_disabled' },
      );
    } else if (!queryTrimmed) {
      const cacheKey = retrievalResultCache.buildKey(cacheKeyInput);
      logRetrievalCacheDebug(cacheKeyInput, cacheKey, {
        cacheHit: false,
        cacheMissReason: 'empty_query',
      });
    } else {
      const cacheKey = retrievalResultCache.buildKey(cacheKeyInput);
      const lookup = retrievalResultCache.lookup(cacheKey);
      if (lookup.result) {
        logRetrievalCacheDebug(cacheKeyInput, cacheKey, { cacheHit: true });
        return applyRetrievalResultCacheHitTiming(lookup.result);
      }
      logRetrievalCacheDebug(cacheKeyInput, cacheKey, {
        cacheHit: false,
        cacheMissReason: (lookup.missReason ?? 'not_found') as RetrievalCacheMissReason,
      });
    }
    const replyPrioritySettings = normalizeKnowledgeReplyPrioritySettings(
      (botFlags as { knowledgeReplyPriority?: unknown } | null)?.knowledgeReplyPriority,
    );
    const priorityRankBySource = sourcePriorityRankMap(replyPrioritySettings);

    const restrictRaw = options.restrictToKnowledgeBaseItemId?.trim();
    let items: ItemRow[];

    if (restrictRaw) {
      if (!Types.ObjectId.isValid(restrictRaw)) {
        return this.emptyResult(emptyCounts(), options.debug ?? false);
      }
      const one = await this.itemModel
        .findOne({
          _id: new Types.ObjectId(restrictRaw),
          botId: botOid,
          sourceType: 'suggestion',
          $and: knowledgeRuntimeRetrievalMatchParts(),
        })
        .select('_id botId title sourceType content fileMeta file sourceMeta faqMeta active deletedAt status extractionStatus isContentExtracted')
        .lean();
      if (!one) {
        return this.emptyResult(emptyCounts(), options.debug ?? false);
      }
      items = [one] as ItemRow[];
    } else {
      const excludedSourceTypes: Array<'note'> = [];
      if (!includeNotes) excludedSourceTypes.push('note');

      items = (await this.itemModel
        .find({
          botId: botOid,
          $and: [
            ...knowledgeRuntimeRetrievalMatchParts(),
            ...(excludedSourceTypes.length ? [{ sourceType: { $nin: excludedSourceTypes } }] : []),
          ],
        })
        .select(
          '_id botId title sourceType content fileMeta file sourceMeta faqMeta active deletedAt status extractionStatus isContentExtracted',
        )
        .lean()) as ItemRow[];
    }

    if (items.length === 0) {
      return this.emptyResult(eligibleCounts, options.debug ?? false);
    }

    const itemIds = items.map((i) => (i as { _id: Types.ObjectId })._id);
    const itemIdsStable = [...itemIds].sort((a, b) => a.toString().localeCompare(b.toString()));

    const perItemCap =
      itemIds.length <= 1
        ? SINGLE_ELIGIBLE_ITEM_CHUNK_CAP
        : multiItemPerItemChunkBudget(itemIds.length);

    const {
      chunks,
      chunkAggregateMs,
      usedSetWindowFields,
      aggregateStrategy,
      candidateChunkCount,
    } = await this.loadCandidateChunks(
      botOid,
      itemIds,
      itemIdsStable,
      perItemCap,
      itemIds.length,
    );
    logChatRetrievalMongoDebug({
      botId,
      collection: this.chunkModel.collection.name,
      candidateChunkCount,
      aggregateDurationMs: chunkAggregateMs,
      usedSetWindowFields,
      aggregateStrategy,
      botIdFilterPresent: true,
      eligibleItemCount: itemIds.length,
      perItemCap,
      indexHint: 'botId_1_knowledgeBaseItemId_1_chunkIndex_1',
    });

    const itemMap = new Map<string, ItemRow>();
    for (const i of items) {
      const row = i as ItemRow;
      itemMap.set(row._id.toString(), row);
    }

    const itemsWithEmbedding: Array<{ item: KnowledgeItem; embedding: number[] | null }> = [];

    for (const c of chunks as ChunkRow[]) {
      const item = itemMap.get(c.knowledgeBaseItemId.toString());
      if (!item) continue;
      if (
        !knowledgeBaseItemEligibleForRuntimeRetrieval(
          item as unknown as {
            active?: boolean;
            deletedAt?: Date | null;
            status?: string;
            sourceType?: string;
            extractionStatus?: string | null;
            isContentExtracted?: boolean;
          },
        )
      ) {
        continue;
      }
      const emb = (c as ChunkRow).embedding;
      if (!Array.isArray(emb) || emb.length === 0) continue;
      const itemIdStr = item._id.toString();
      const chunkIdStr = c._id.toString();
      const text = (c.text ?? '').trim();
      const normalizedText = normalizeKnowledgeText(text);
      const sourceType = item.sourceType as KnowledgeItem['sourceType'];
      const title = (item.title ?? '').trim() || 'Untitled';
      const section = (c.heading ?? '').trim() || undefined;
      const rowRec = item as unknown as Record<string, unknown>;
      const url = effectiveKbDocumentFileMetaLean(rowRec).url;
      const sourceId = itemIdStr;

      const knowledgeItem: KnowledgeItem = {
        id: chunkIdStr,
        botId: botId,
        sourceType,
        sourceId,
        title,
        section,
        text,
        normalizedText,
        metadata: url ? { url } : undefined,
        active: true,
        status: 'ready',
      };
      itemsWithEmbedding.push({
        item: knowledgeItem,
        embedding: emb,
      });
    }

    eligibleCounts.document = items.filter((i) => (i as ItemRow).sourceType === 'document').length;
    eligibleCounts.faq = items.filter((i) => (i as ItemRow).sourceType === 'faq').length;
    eligibleCounts.note = items.filter((i) => (i as ItemRow).sourceType === 'note').length;
    eligibleCounts.table = items.filter((i) => (i as ItemRow).sourceType === 'table').length;
    eligibleCounts.suggestion = items.filter((i) => (i as ItemRow).sourceType === 'suggestion').length;

    const candidateChunksCount = itemsWithEmbedding.length;

    if (itemsWithEmbedding.length === 0) {
      return this.emptyResult(eligibleCounts, options.debug ?? false, {
        queryEmbeddingMs: 0,
        chunkAggregateMs,
        scoringMs: 0,
        diversityDedupMs: 0,
        candidateChunksCount: 0,
        scoredChunksCount: 0,
        queryEmbeddingCacheHit: false,
      });
    }

    let queryEmbedding: number[] = [];
    let queryEmbeddingMs = 0;
    let queryEmbeddingCacheHit = false;
    try {
      const embedResult = await embedQueryWithCache(this.ragService, queryTrimmed, {
        apiKeyOverride: options.apiKeyOverride,
        cacheScope: botId,
      });
      queryEmbedding = embedResult.embedding;
      queryEmbeddingMs = embedResult.durationMs;
      queryEmbeddingCacheHit = embedResult.cacheHit;
    } catch {
      queryEmbedding = [];
    }

    const maxItemsToScore = getChatMaxItemsToScore();
    const scoringStart = Date.now();
    const weights = options.weights ?? DEFAULT_UNIFIED_RETRIEVAL_WEIGHTS;
    const scored: Array<{ item: KnowledgeItem; breakdown: UnifiedScoreBreakdown }> = [];
    const toScore = itemsWithEmbedding.slice(0, maxItemsToScore);
    for (const { item, embedding } of toScore) {
      const semanticScore =
        embedding && queryEmbedding.length ? cosineSimilarity(queryEmbedding, embedding) : 0;
      const lexScore = lexicalScore(queryTrimmed, item.normalizedText);
      const breakdown = scoreKnowledgeItem(
        queryTrimmed,
        item,
        semanticScore,
        lexScore,
        weights,
      );
      scored.push({ item, breakdown });
    }

    scored.sort((a, b) => {
      const scoreDiff = b.breakdown.combinedScore - a.breakdown.combinedScore;
      if (replyPrioritySettings.mode !== 'priority') return scoreDiff;
      if (Math.abs(scoreDiff) > PRIORITY_TIE_BREAK_DELTA) return scoreDiff;
      const rankA = priorityRankBySource.get(a.item.sourceType) ?? Number.MAX_SAFE_INTEGER;
      const rankB = priorityRankBySource.get(b.item.sourceType) ?? Number.MAX_SAFE_INTEGER;
      if (rankA !== rankB) return rankA - rankB;
      return scoreDiff;
    });
    const scoringMs = Date.now() - scoringStart;
    const top = scored.slice(0, retrievalLimit);

    const rankedItems: RankedKnowledgeItem[] = top.map(({ item, breakdown }) => ({
      ...item,
      sourceType: item.sourceType,
      sourceId: item.sourceId,
      title: item.title,
      section: item.section,
      text: item.text,
      metadata: item.metadata,
      semanticScore: breakdown.semanticScore,
      lexicalScore: breakdown.lexicalScore,
      combinedScore: breakdown.combinedScore,
    }));

    const diversityStart = Date.now();
    const { selected: itemsSelected, removedAsDuplicate, skippedByCap } = applyDiversityAndDedup(
      rankedItems,
      options.diversity,
    );
    const diversityDedupMs = Date.now() - diversityStart;

    const timing = {
      queryEmbeddingMs,
      chunkAggregateMs,
      scoringMs,
      diversityDedupMs,
      candidateChunksCount,
      scoredChunksCount: toScore.length,
      queryEmbeddingCacheHit,
      retrievalResultCacheHit: false,
    };

    const debug: UnifiedRetrievalDebug | undefined = options.debug
      ? {
          usedUnifiedPath: true,
          knowledgeBaseItemIds: [...new Set(itemsSelected.map((i) => i.sourceId))],
          eligibleCountBySourceType: eligibleCounts,
          retrievedBySourceType: this.groupBySourceType(itemsSelected),
          scoreBreakdown: top.slice(0, 15).map((s) => ({
            id: s.item.id,
            sourceType: s.item.sourceType,
            title: s.item.title.slice(0, 60),
            semanticScore: s.breakdown.semanticScore,
            lexicalScore: s.breakdown.lexicalScore,
            exactPhraseScore: s.breakdown.exactPhraseScore,
            headingMatchScore: s.breakdown.headingMatchScore,
            titleMatchScore: s.breakdown.titleMatchScore,
            faqQuestionMatchScore: s.breakdown.faqQuestionMatchScore,
            combinedScore: s.breakdown.combinedScore,
          })) as RankedItemScoreBreakdown[],
          diversityDebug: {
            removedAsDuplicate,
            skippedByCap: skippedByCap.map((s) => ({ id: s.id, reason: s.reason })),
            finalSelectedCount: itemsSelected.length,
            finalSelectedIds: itemsSelected.map((i) => i.id),
          },
        }
      : undefined;

    const result: UnifiedRetrievalResult = { items: itemsSelected, debug, timing };
    if (cacheKeyInput && queryTrimmed) {
      const cacheKey = retrievalResultCache.buildKey(cacheKeyInput);
      if (itemsSelected.length > 0) {
        retrievalResultCache.set(cacheKey, result);
        logRetrievalCacheDebug(cacheKeyInput, cacheKey, { cacheHit: false, cacheSet: true });
      } else {
        logRetrievalCacheDebug(cacheKeyInput, cacheKey, {
          cacheHit: false,
          cacheMissReason: 'set_skipped_empty_items',
          cacheSet: false,
        });
      }
    }
    return result;
  }

  private async loadCandidateChunks(
    botOid: Types.ObjectId,
    itemIds: Types.ObjectId[],
    itemIdsStable: Types.ObjectId[],
    perItemCap: number,
    itemCount: number,
  ): Promise<{
    chunks: ChunkRow[];
    chunkAggregateMs: number;
    usedSetWindowFields: boolean;
    aggregateStrategy: 'window_fields' | 'simple_find';
    candidateChunkCount: number;
  }> {
    const useSimple = shouldUseSimpleChunkLoad(itemCount, perItemCap);
    const chunkAggregateStart = Date.now();

    if (useSimple) {
      const rows = (await this.chunkModel
        .find({
          botId: botOid,
          knowledgeBaseItemId: { $in: itemIds },
        })
        .select('_id knowledgeBaseItemId text embedding chunkIndex heading')
        .sort({ knowledgeBaseItemId: 1, chunkIndex: 1 })
        .lean()) as ChunkRow[];
      const chunkAggregateMs = Date.now() - chunkAggregateStart;
      const chunks =
        itemCount <= 1
          ? loadChunksWithPerItemCap(rows, itemIdsStable, perItemCap, SINGLE_ELIGIBLE_ITEM_CHUNK_CAP)
          : loadChunksWithPerItemCap(
              rows,
              itemIdsStable,
              perItemCap,
              MULTI_ITEM_TOTAL_CANDIDATE_CAP,
            );
      return {
        chunks,
        chunkAggregateMs,
        usedSetWindowFields: false,
        aggregateStrategy: 'simple_find',
        candidateChunkCount: rows.length,
      };
    }

    const rawChunks = await this.chunkModel
      .aggregate<ChunkRow & { rowNumber?: number }>([
        { $match: { botId: botOid, knowledgeBaseItemId: { $in: itemIds } } },
        { $sort: { knowledgeBaseItemId: 1, chunkIndex: 1 } },
        {
          $setWindowFields: {
            partitionBy: '$knowledgeBaseItemId',
            sortBy: { chunkIndex: 1 },
            output: {
              rowNumber: { $documentNumber: {} },
            },
          },
        },
        { $match: { rowNumber: { $lte: perItemCap } } },
        {
          $project: {
            _id: 1,
            knowledgeBaseItemId: 1,
            text: 1,
            embedding: 1,
            chunkIndex: 1,
            heading: 1,
          },
        },
      ])
      .exec();
    const chunkAggregateMs = Date.now() - chunkAggregateStart;
    const chunks: ChunkRow[] =
      itemCount <= 1
        ? (rawChunks as ChunkRow[])
        : mergeChunksFairRoundRobin(rawChunks as ChunkRow[], itemIdsStable, MULTI_ITEM_TOTAL_CANDIDATE_CAP);

    return {
      chunks,
      chunkAggregateMs,
      usedSetWindowFields: true,
      aggregateStrategy: 'window_fields',
      candidateChunkCount: rawChunks.length,
    };
  }

  private emptyResult(
    eligibleCounts: UnifiedRetrievalEligibleCounts,
    includeDebug: boolean,
    timing?: UnifiedRetrievalResult['timing'],
  ): UnifiedRetrievalResult {
    const debug: UnifiedRetrievalDebug | undefined = includeDebug
      ? {
          usedUnifiedPath: true,
          knowledgeBaseItemIds: [],
          eligibleCountBySourceType: eligibleCounts,
        }
      : undefined;
    return { items: [], debug, timing };
  }

  private groupBySourceType(
    items: RankedKnowledgeItem[],
  ): UnifiedRetrievalDebug['retrievedBySourceType'] {
    const out: NonNullable<UnifiedRetrievalDebug['retrievedBySourceType']> = {};
    for (const item of items) {
      const key = item.sourceType;
      if (!out[key]) out[key] = [];
      out[key].push(item);
    }
    return out;
  }
}
