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

const DEFAULT_LIMIT = 20;
const MAX_ITEMS_TO_SCORE = 300;

/**
 * Legacy global `.limit(500)` applied to the whole bot; with many KB items, early rows (often one huge
 * document) could consume the entire cap and starve later items. Per-item budgets guarantee each eligible
 * source contributes candidates; round-robin merge ensures {@link MAX_ITEMS_TO_SCORE} sees a mix of items,
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

/**
 * Deterministic interleaving: round 0 takes chunk 0 from every item (in stable item order), then round 1, etc.,
 * until `maxTotal` or all lists exhausted. Keeps scoring fair when {@link MAX_ITEMS_TO_SCORE} < candidate count.
 */
function mergeChunksFairRoundRobin(
  chunks: ChunkRow[],
  itemOrder: Types.ObjectId[],
  maxTotal: number,
): ChunkRow[] {
  const byItem = new Map<string, ChunkRow[]>();
  for (const id of itemOrder) {
    byItem.set(id.toString(), []);
  }
  for (const c of chunks) {
    const key = c.knowledgeBaseItemId.toString();
    const bucket = byItem.get(key);
    if (bucket) bucket.push(c);
  }
  for (const list of byItem.values()) {
    list.sort((a, b) => a.chunkIndex - b.chunkIndex);
  }
  const out: ChunkRow[] = [];
  let round = 0;
  let progressed = true;
  while (out.length < maxTotal && progressed) {
    progressed = false;
    for (const id of itemOrder) {
      if (out.length >= maxTotal) break;
      const list = byItem.get(id.toString())!;
      if (round < list.length) {
        out.push(list[round]);
        progressed = true;
      }
    }
    round++;
  }
  return out;
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

type ChunkRow = {
  _id: Types.ObjectId;
  knowledgeBaseItemId: Types.ObjectId;
  text: string;
  embedding: number[];
  chunkIndex: number;
  heading?: string;
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
    const limit = options.limit ?? DEFAULT_LIMIT;
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

    const chunks: ChunkRow[] =
      itemIds.length <= 1
        ? (rawChunks as ChunkRow[])
        : mergeChunksFairRoundRobin(rawChunks as ChunkRow[], itemIdsStable, MULTI_ITEM_TOTAL_CANDIDATE_CAP);

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

    if (itemsWithEmbedding.length === 0) {
      return this.emptyResult(eligibleCounts, options.debug ?? false);
    }

    let queryEmbedding: number[] = [];
    try {
      queryEmbedding = await this.ragService.embedText(queryTrimmed, options.apiKeyOverride);
    } catch {
      queryEmbedding = [];
    }

    const weights = options.weights ?? DEFAULT_UNIFIED_RETRIEVAL_WEIGHTS;
    const scored: Array<{ item: KnowledgeItem; breakdown: UnifiedScoreBreakdown }> = [];
    const toScore = itemsWithEmbedding.slice(0, MAX_ITEMS_TO_SCORE);
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
    const top = scored.slice(0, limit);

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

    const { selected: itemsSelected, removedAsDuplicate, skippedByCap } = applyDiversityAndDedup(
      rankedItems,
      options.diversity,
    );

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

    return { items: itemsSelected, debug };
  }

  private emptyResult(
    eligibleCounts: UnifiedRetrievalEligibleCounts,
    includeDebug: boolean,
  ): UnifiedRetrievalResult {
    const debug: UnifiedRetrievalDebug | undefined = includeDebug
      ? {
          usedUnifiedPath: true,
          knowledgeBaseItemIds: [],
          eligibleCountBySourceType: eligibleCounts,
        }
      : undefined;
    return { items: [], debug };
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
