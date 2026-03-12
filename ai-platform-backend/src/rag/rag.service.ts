import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import OpenAI from 'openai';
import { Types } from 'mongoose';
import { Chunk, DocumentModel } from '../models';
import {
  applyChunkDiversity,
  combinedScore,
  documentLexicalScoreWithBreakdown,
  extractChunkHeading,
  getRetrievalConfidence,
} from './retrieval-helpers';
import { DEFAULT_HYBRID_WEIGHTS } from './retrieval.types';
import type { EnrichedChunk, RetrievalResult, RetrievalMetadata } from './retrieval.types';
import { withTimeout, withRetry, AI_CALL_TIMEOUTS } from '../lib/ai-call.helper';
import { normalizeChunkText } from '../chat/chunk-quality.helper';

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

/** Max chunks per document for diversity; allow 4 so later sections and strong FAQ chunks are not over-pruned. */
const MAX_CHUNKS_PER_DOC = 4;

@Injectable()
export class RagService {
  constructor(
    private readonly config: ConfigService,
    @InjectModel(Chunk.name) private readonly chunkModel: Model<Chunk>,
    @InjectModel(DocumentModel.name) private readonly documentModel: Model<DocumentModel>,
  ) {}

  private getOpenAIClient(apiKeyOverride?: string): OpenAI {
    const apiKey = (apiKeyOverride || this.config.get<string>('openaiApiKey') || '').trim();
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not set');
    }
    return new OpenAI({ apiKey });
  }

  async embedText(text: string, apiKeyOverride?: string): Promise<number[]> {
    const trimmed = text.trim();
    if (!trimmed) return [];
    const openai = this.getOpenAIClient(apiKeyOverride);
    const res = await withRetry(
      () =>
        withTimeout(
          openai.embeddings.create({
            model: 'text-embedding-3-small',
            input: trimmed,
          }),
          AI_CALL_TIMEOUTS.embedding,
          'embedding',
        ),
      { maxRetries: 1 },
    );
    return res.data[0].embedding;
  }

  /**
   * Embed multiple texts in one API call. Much faster than calling embedText in a loop.
   * Batch size kept modest to stay under token limits (~8k tokens per input).
   */
  async embedTexts(texts: string[], apiKeyOverride?: string): Promise<number[][]> {
    const trimmed = texts.map((t) => t.trim()).filter((t) => t.length > 0);
    if (trimmed.length === 0) return [];
    const openai = this.getOpenAIClient(apiKeyOverride);
    const res = await withRetry(
      () =>
        withTimeout(
          openai.embeddings.create({
            model: 'text-embedding-3-small',
            input: trimmed,
          }),
          AI_CALL_TIMEOUTS.embedding,
          'embedding_batch',
        ),
      { maxRetries: 1 },
    );
    const byIndex = new Map<number, number[]>();
    for (const item of res.data) {
      if (item.index != null && item.embedding) {
        byIndex.set(item.index, item.embedding);
      }
    }
    return trimmed.map((_, i) => byIndex.get(i) ?? []);
  }

  /**
   * Production retrieval: hybrid semantic + lexical scoring, diversity, confidence.
   * Isolation: only documents for this bot (botId, status='ready', active) and only chunks for this bot in those documents.
   */
  async getRelevantChunksForBotWithConfidence(
    botId: string,
    query: string,
    limit = 6,
    apiKeyOverride?: string,
  ): Promise<RetrievalResult> {
    const queryEmbedding = await this.embedText(query, apiKeyOverride);
    if (!queryEmbedding.length) {
      return { confidence: 'low', chunks: [], metadata: { requestBotId: botId, eligibleDocumentCount: 0, eligibleChunkCount: 0, chunksWithValidEmbeddingCount: 0, retrievedChunkCount: 0, retrievedChunkBotIds: [] } };
    }

    if (!Types.ObjectId.isValid(botId)) {
      return { confidence: 'low', chunks: [], metadata: { requestBotId: botId, eligibleDocumentCount: 0, eligibleChunkCount: 0, chunksWithValidEmbeddingCount: 0, retrievedChunkCount: 0, retrievedChunkBotIds: [] } };
    }

    const botOid = new Types.ObjectId(botId);
    // 1) Eligible documents: this bot only, ready, active
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
        title: String((d as { title?: string }).title || 'Document'),
        url: (d as { url?: string }).url,
        sourceType: (d as { sourceType?: string }).sourceType || 'document',
      });
    }
    if (eligibleDocIds.length === 0) {
      return { confidence: 'low', chunks: [], metadata: { requestBotId: botId, eligibleDocumentCount: 0, eligibleChunkCount: 0, chunksWithValidEmbeddingCount: 0, retrievedChunkCount: 0, retrievedChunkBotIds: [] } };
    }

    // 2) Chunks: this bot only, documentId must be in eligible doc list (double isolation)
    const chunks = await this.chunkModel
      .find({ botId: botOid, documentId: { $in: eligibleDocIds } })
      .select({ _id: 1, documentId: 1, text: 1, embedding: 1, botId: 1 })
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    const queryTrimmed = (query || '').trim();
    // Only score chunks with valid embeddings; skip others so we don't get NaN or silent zeros.
    const chunksWithEmbedding = (chunks as Array<{ _id: unknown; documentId: unknown; text?: string; embedding?: number[] }>).filter(
      (c) => Array.isArray(c.embedding) && c.embedding.length > 0,
    );
    const enriched: EnrichedChunk[] = chunksWithEmbedding.map((chunk) => {
      const c = chunk;
      const docId = String(c.documentId);
      const meta = docMeta.get(docId) || { title: 'Document', sourceType: 'document' };
      const rawText = String(c.text || '').trim();
      const textForScoring = normalizeChunkText(rawText) || rawText;
      const chunkHeading = extractChunkHeading(rawText);
      const sem = cosineSimilarity(queryEmbedding, c.embedding!);
      const { score: lex, breakdown: lexicalBreakdown } = documentLexicalScoreWithBreakdown(
        queryTrimmed,
        textForScoring,
        meta.title,
        chunkHeading,
      );
      let comb = combinedScore(sem, lex, DEFAULT_HYBRID_WEIGHTS);
      if (lex >= 0.35) comb = Math.min(1, comb + 0.05);
      return {
        chunkId: String(c._id),
        documentId: docId,
        title: meta.title,
        text: rawText,
        semanticScore: sem,
        lexicalScore: lex,
        combinedScore: comb,
        sourceType: meta.sourceType || 'document',
        url: meta.url,
        lexicalBreakdown,
      };
    });

    enriched.sort((a, b) => b.combinedScore - a.combinedScore);
    const diversified = applyChunkDiversity(enriched, MAX_CHUNKS_PER_DOC);
    const topChunks = diversified.slice(0, limit);
    const topScore = topChunks[0]?.combinedScore ?? 0;
    const confidence = getRetrievalConfidence(topScore);

    const topChunkIds = new Set(topChunks.map((c) => c.chunkId));
    const rawChunksWithBotId = chunks as Array<{ _id: unknown; documentId: unknown; text?: string; embedding?: number[]; botId?: unknown }>;
    const retrievedChunkBotIds = [...new Set(
      rawChunksWithBotId
        .filter((r) => topChunkIds.has(String(r._id)) && r.botId != null)
        .map((r) => String(r.botId)),
    )];

    // Admin/test debug: counts by document sourceType (upload | url | manual)
    const docSourceTypeCount: Record<string, number> = {};
    for (const d of eligibleDocs) {
      const st = String((d as { sourceType?: string }).sourceType || 'upload').toLowerCase();
      const key = st === 'upload' || st === 'url' || st === 'manual' ? st : 'upload';
      docSourceTypeCount[key] = (docSourceTypeCount[key] ?? 0) + 1;
    }
    const eligibleDocumentCountBySourceType: RetrievalMetadata['eligibleDocumentCountBySourceType'] = {};
    if (docSourceTypeCount.upload != null) eligibleDocumentCountBySourceType.upload = docSourceTypeCount.upload;
    if (docSourceTypeCount.url != null) eligibleDocumentCountBySourceType.url = docSourceTypeCount.url;
    if (docSourceTypeCount.manual != null) eligibleDocumentCountBySourceType.manual = docSourceTypeCount.manual;

    const chunkSourceTypeCount: Record<string, number> = {};
    for (const c of chunks as Array<{ documentId: unknown }>) {
      const docId = String(c.documentId);
      const meta = docMeta.get(docId);
      const st = (meta?.sourceType || 'upload').toLowerCase();
      const key = st === 'upload' || st === 'url' || st === 'manual' ? st : 'upload';
      chunkSourceTypeCount[key] = (chunkSourceTypeCount[key] ?? 0) + 1;
    }
    const eligibleChunkCountBySourceType: RetrievalMetadata['eligibleChunkCountBySourceType'] = {};
    if (chunkSourceTypeCount.upload != null) eligibleChunkCountBySourceType.upload = chunkSourceTypeCount.upload;
    if (chunkSourceTypeCount.url != null) eligibleChunkCountBySourceType.url = chunkSourceTypeCount.url;
    if (chunkSourceTypeCount.manual != null) eligibleChunkCountBySourceType.manual = chunkSourceTypeCount.manual;

    const metadata: RetrievalMetadata = {
      requestBotId: botId,
      eligibleDocumentCount: eligibleDocIds.length,
      eligibleChunkCount: chunks.length,
      chunksWithValidEmbeddingCount: chunksWithEmbedding.length,
      retrievedChunkCount: topChunks.length,
      retrievedChunkBotIds,
      ...(Object.keys(eligibleDocumentCountBySourceType).length > 0 ? { eligibleDocumentCountBySourceType } : {}),
      ...(Object.keys(eligibleChunkCountBySourceType).length > 0 ? { eligibleChunkCountBySourceType } : {}),
    };
    return { confidence, chunks: topChunks, metadata };
  }
}
