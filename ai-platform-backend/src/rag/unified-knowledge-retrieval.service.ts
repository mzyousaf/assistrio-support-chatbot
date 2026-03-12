/**
 * Unified knowledge retrieval: load and rank document chunks, FAQs, notes, and HTML together.
 * Behind feature flag; does not replace existing RAG flow.
 */

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Types } from 'mongoose';
import type { KnowledgeItem } from '../knowledge';
import {
  mapDocumentChunkToKnowledgeItem,
  mapFaqToKnowledgeItem,
  mapNoteToKnowledgeItem,
} from '../knowledge';
import { Chunk, DocumentModel } from '../models';
import { Bot } from '../models';
import { RagService } from './rag.service';
import { lexicalScore } from './retrieval-helpers';
import type {
  RankedKnowledgeItem,
  UnifiedRetrievalResult,
  UnifiedRetrievalOptions,
  UnifiedRetrievalEligibleCounts,
  UnifiedRetrievalDebug,
  RankedItemScoreBreakdown,
} from './unified-retrieval.types';
import { extractChunkHeading } from './retrieval-helpers';
import type { UnifiedScoreBreakdown } from './unified-retrieval-scoring';
import {
  scoreKnowledgeItem,
  DEFAULT_UNIFIED_RETRIEVAL_WEIGHTS,
} from './unified-retrieval-scoring';
import { applyDiversityAndDedup } from './unified-retrieval-selection';
import {
  buildFaqEmbeddingText,
  buildNoteEmbeddingText,
  computeEmbeddingInputHash,
  isEmbeddingValidForSemantic,
} from '../embedding/faq-note-embedding.helper';

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

@Injectable()
export class UnifiedKnowledgeRetrievalService {
  constructor(
    private readonly config: ConfigService,
    private readonly ragService: RagService,
    @InjectModel(Chunk.name) private readonly chunkModel: Model<Chunk>,
    @InjectModel(DocumentModel.name) private readonly documentModel: Model<DocumentModel>,
    @InjectModel(Bot.name) private readonly botModel: Model<Bot>,
  ) {}

  /**
   * Load all eligible knowledge for the bot, convert to KnowledgeItem[], score with query embedding + lexical,
   * and return one ranked list. Does not replace existing retrieval; use behind feature flag.
   */
  async getRelevantKnowledgeItemsForBot(
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

    // 1) Load bot FAQs and note from DB only (current list; no stale or deleted items)
    const bot = await this.botModel
      .findById(botOid)
      .select('faqs knowledgeDescription noteEmbedding noteEmbeddingStatus noteEmbeddingInputHash')
      .select('+faqs.embedding')
      .select('+faqs.embeddingStatus')
      .select('+faqs.embeddingInputHash')
      .lean();
    type FaqRow = { question?: string; answer?: string; embedding?: number[]; embeddingStatus?: string; embeddingInputHash?: string };
    type BotShape = {
      faqs?: FaqRow[];
      knowledgeDescription?: string;
      noteEmbedding?: number[];
      noteEmbeddingStatus?: string;
      noteEmbeddingInputHash?: string;
    };
    const b = (bot as BotShape) ?? {};
    const faqsRaw = Array.isArray(b.faqs) ? b.faqs : [];
    const knowledgeDescription = (b.knowledgeDescription ?? '').trim();
    const noteEmbeddingRaw = Array.isArray(b.noteEmbedding) && b.noteEmbedding.length > 0 ? b.noteEmbedding : null;
    const noteStatus = b.noteEmbeddingStatus;
    const noteStoredHash = b.noteEmbeddingInputHash;

    // 2) Load eligible documents + chunks (same rules as RAG: ready, active, this bot)
    const eligibleDocs = await this.documentModel
      .find({
        botId: botOid,
        status: 'ready',
        active: { $ne: false },
      })
      .select({ _id: 1, title: 1, url: 1, sourceType: 1 })
      .lean();
    const eligibleDocIds = eligibleDocs.map((d) => (d as { _id: Types.ObjectId })._id);
    const docMeta = new Map<string, { title: string; url?: string; sourceType?: string }>();
    for (const d of eligibleDocs) {
      const id = String((d as { _id: Types.ObjectId })._id);
      docMeta.set(id, {
        title: String((d as { title?: string }).title ?? 'Document'),
        url: (d as { url?: string }).url,
        sourceType: (d as { sourceType?: string }).sourceType ?? 'document',
      });
    }

    const chunks = await this.chunkModel
      .find({ botId: botOid, documentId: { $in: eligibleDocIds } })
      .select({ _id: 1, documentId: 1, text: 1, embedding: 1 })
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    // 3) Build KnowledgeItem[] and keep embeddings for doc chunks
    const itemsWithEmbedding: Array<{ item: KnowledgeItem; embedding: number[] | null }> = [];

    for (const c of chunks as Array<{ _id: unknown; documentId: unknown; text?: string; embedding?: number[] }>) {
      const docId = String(c.documentId);
      const meta = docMeta.get(docId) ?? { title: 'Document', sourceType: 'document' };
      const rawText = String(c.text ?? '').trim();
      const section = extractChunkHeading(rawText) ?? undefined;
      const item = mapDocumentChunkToKnowledgeItem({
        id: String(c._id),
        documentId: docId,
        botId,
        text: rawText,
        title: meta.title,
        section,
        url: meta.url,
        sourceType: meta.sourceType,
        status: 'ready',
        active: true,
      });
      const embedding = Array.isArray(c.embedding) && c.embedding.length > 0 ? c.embedding : null;
      itemsWithEmbedding.push({ item, embedding });
    }
    eligibleCounts.document = itemsWithEmbedding.length;

    for (let i = 0; i < faqsRaw.length; i++) {
      const f = faqsRaw[i];
      const question = String(f?.question ?? '').trim();
      const answer = String(f?.answer ?? '').trim();
      if (!question && !answer) continue;
      const currentHash = computeEmbeddingInputHash(buildFaqEmbeddingText(question, answer));
      const useEmbedding = isEmbeddingValidForSemantic(
        f?.embeddingStatus,
        f?.embeddingInputHash,
        currentHash,
        f?.embedding,
      );
      const embedding = useEmbedding && Array.isArray(f?.embedding) && f.embedding.length > 0 ? f.embedding : null;
      if (options.debug && !useEmbedding && (f?.embeddingStatus || f?.embeddingInputHash)) {
        console.log(
          `[unified-retrieval] faq semantic skipped botId=${botId} index=${i} status=${f?.embeddingStatus ?? 'n/a'} hashMatch=${f?.embeddingInputHash === currentHash}`,
        );
      }
      const item = mapFaqToKnowledgeItem({
        botId,
        question,
        answer,
        id: `faq-${botId}-${i}`,
        active: true,
      });
      itemsWithEmbedding.push({ item, embedding });
    }
    eligibleCounts.faq = faqsRaw.filter((f) => (f?.question ?? '').trim() || (f?.answer ?? '').trim()).length;

    if (knowledgeDescription) {
      const noteCurrentHash = computeEmbeddingInputHash(buildNoteEmbeddingText(undefined, knowledgeDescription));
      const useNoteEmbedding = isEmbeddingValidForSemantic(
        noteStatus,
        noteStoredHash,
        noteCurrentHash,
        noteEmbeddingRaw,
      );
      const noteEmbedding = useNoteEmbedding && noteEmbeddingRaw?.length ? noteEmbeddingRaw : null;
      if (options.debug && !useNoteEmbedding && (noteStatus || noteStoredHash)) {
        console.log(
          `[unified-retrieval] note semantic skipped botId=${botId} status=${noteStatus ?? 'n/a'} hashMatch=${noteStoredHash === noteCurrentHash}`,
        );
      }
      const item = mapNoteToKnowledgeItem({
        botId,
        title: 'Knowledge overview',
        text: knowledgeDescription,
        id: `note-${botId}-overview`,
        active: true,
      });
      itemsWithEmbedding.push({ item, embedding: noteEmbedding });
      eligibleCounts.note = 1;
    }

    // HTML: no storage yet; eligibleCounts.html stays 0
    eligibleCounts.html = 0;

    if (itemsWithEmbedding.length === 0) {
      return this.emptyResult(eligibleCounts, options.debug ?? false);
    }

    // 4) Embed query
    let queryEmbedding: number[] = [];
    try {
      queryEmbedding = await this.ragService.embedText(queryTrimmed, options.apiKeyOverride);
    } catch {
      queryEmbedding = [];
    }

    // 5) Score: modular hybrid (semantic, lexical, exact phrase, heading, title, FAQ question)
    const weights = options.weights ?? DEFAULT_UNIFIED_RETRIEVAL_WEIGHTS;
    const scored: Array<{ item: KnowledgeItem; breakdown: UnifiedScoreBreakdown }> = [];
    const toScore = itemsWithEmbedding.slice(0, MAX_ITEMS_TO_SCORE);
    for (const { item, embedding } of toScore) {
      const semanticScore = embedding && queryEmbedding.length
        ? cosineSimilarity(queryEmbedding, embedding)
        : 0;
      const lexScore = lexicalScore(queryTrimmed, item.normalizedText);
      const breakdown = scoreKnowledgeItem(queryTrimmed, item, semanticScore, lexScore, weights);
      scored.push({ item, breakdown });
    }

    // 6) Rank and limit
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

    // 7) Diversity and deduplication: caps per source, remove near-duplicate text
    const { selected: items, removedAsDuplicate, skippedByCap } = applyDiversityAndDedup(
      rankedItems,
      options.diversity,
    );

    const debug: UnifiedRetrievalDebug | undefined = options.debug
      ? {
          usedUnifiedPath: true,
          eligibleCountBySourceType: eligibleCounts,
          retrievedBySourceType: this.groupBySourceType(items),
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
            finalSelectedCount: items.length,
            finalSelectedIds: items.map((i) => i.id),
          },
        }
      : undefined;

    return { items, debug };
  }

  private emptyResult(eligibleCounts: UnifiedRetrievalEligibleCounts, includeDebug: boolean): UnifiedRetrievalResult {
    const debug: UnifiedRetrievalDebug | undefined = includeDebug
      ? { usedUnifiedPath: true, eligibleCountBySourceType: eligibleCounts }
      : undefined;
    return { items: [], debug };
  }

  private groupBySourceType(items: RankedKnowledgeItem[]): UnifiedRetrievalDebug['retrievedBySourceType'] {
    const out: NonNullable<UnifiedRetrievalDebug['retrievedBySourceType']> = {};
    for (const item of items) {
      const key = item.sourceType;
      if (!out[key]) out[key] = [];
      out[key].push(item);
    }
    return out;
  }
}
