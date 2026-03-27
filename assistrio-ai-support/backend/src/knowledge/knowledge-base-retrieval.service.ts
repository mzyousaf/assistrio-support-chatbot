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
import type {
  RankedKnowledgeItem,
  UnifiedRetrievalResult,
  UnifiedRetrievalOptions,
  UnifiedRetrievalEligibleCounts,
  UnifiedRetrievalDebug,
  RankedItemScoreBreakdown,
} from '../rag/unified-retrieval.types';
import type { UnifiedScoreBreakdown } from '../rag/unified-retrieval-scoring';

const DEFAULT_LIMIT = 20;
const MAX_ITEMS_TO_SCORE = 300;

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
  documentId?: Types.ObjectId;
  title: string;
  sourceType: string;
  content?: string;
  sourceMeta?: { url?: string };
  faqMeta?: { question?: string };
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
   * Only items with active=true and status='ready' are included.
   */
  async getRelevantKnowledgeItemsFromKnowledgeBase(
    botId: string,
    query: string,
    options: UnifiedRetrievalOptions = {},
  ): Promise<UnifiedRetrievalResult> {
    const limit = options.limit ?? DEFAULT_LIMIT;
    const queryTrimmed = (query ?? '').trim();
    const eligibleCounts: UnifiedRetrievalEligibleCounts = { document: 0, faq: 0, note: 0, html: 0 };

    if (!Types.ObjectId.isValid(botId)) {
      return this.emptyResult(eligibleCounts, options.debug ?? false);
    }

    const botOid = new Types.ObjectId(botId);

    const botFlags = await this.botModel
      .findById(botOid)
      .select('includeNotesInKnowledge')
      .lean();

    const includeNotes = (botFlags?.includeNotesInKnowledge as boolean | undefined) !== false;

    const excludedSourceTypes: Array<'note'> = [];
    if (!includeNotes) excludedSourceTypes.push('note');

    const items = await this.itemModel
      .find({
        botId: botOid,
        active: true,
        status: 'ready',
        ...(excludedSourceTypes.length ? { sourceType: { $nin: excludedSourceTypes } } : {}),
      })
      .select('_id botId documentId title sourceType content sourceMeta faqMeta')
      .lean();

    if (items.length === 0) {
      return this.emptyResult(eligibleCounts, options.debug ?? false);
    }

    const itemIds = items.map((i) => (i as { _id: Types.ObjectId })._id);
    const chunks = await this.chunkModel
      .find({ botId: botOid, knowledgeBaseItemId: { $in: itemIds } })
      .select('_id knowledgeBaseItemId text embedding chunkIndex heading')
      .sort({ chunkIndex: 1 })
      .limit(500)
      .lean();

    const itemMap = new Map<string, ItemRow>();
    for (const i of items) {
      const row = i as ItemRow;
      itemMap.set(row._id.toString(), row);
    }

    const itemsWithEmbedding: Array<{ item: KnowledgeItem; embedding: number[] | null }> = [];

    for (const c of chunks as ChunkRow[]) {
      const item = itemMap.get(c.knowledgeBaseItemId.toString());
      if (!item) continue;
      const itemIdStr = item._id.toString();
      const chunkIdStr = c._id.toString();
      const text = (c.text ?? '').trim();
      const normalizedText = normalizeKnowledgeText(text);
      const sourceType = item.sourceType as KnowledgeItem['sourceType'];
      const title = (item.title ?? '').trim() || 'Untitled';
      const section = (c.heading ?? '').trim() || undefined;
      const url = item.sourceMeta?.url;
      const sourceId =
        sourceType === 'document' && item.documentId
          ? item.documentId.toString()
          : itemIdStr;

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
        embedding: Array.isArray(c.embedding) && c.embedding.length > 0 ? c.embedding : null,
      });
    }

    eligibleCounts.document = items.filter((i) => (i as ItemRow).sourceType === 'document').length;
    eligibleCounts.faq = items.filter((i) => (i as ItemRow).sourceType === 'faq').length;
    eligibleCounts.note = items.filter((i) => (i as ItemRow).sourceType === 'note').length;

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

    scored.sort((a, b) => b.breakdown.combinedScore - a.breakdown.combinedScore);
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
