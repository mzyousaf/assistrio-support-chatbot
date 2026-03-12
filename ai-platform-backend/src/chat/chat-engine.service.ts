import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Types } from 'mongoose';
import OpenAI from 'openai';
import { Conversation, DocumentModel, Message } from '../models';
import type { CapturedLeadData, LeadCaptureMeta } from '../models';
import { RagService } from '../rag/rag.service';
import { UnifiedKnowledgeRetrievalService } from '../rag/unified-knowledge-retrieval.service';
import { extractChunkHeading, normalizeSourceExcerpt } from '../rag/retrieval-helpers';
import type { EnrichedChunk, RetrievalResult } from '../rag/retrieval.types';
import { assembleContextWithBudget } from './context-budget.helper';
import { buildChatKnowledgeContext, formatPromptFromContext } from './chat-context-builder';
import { buildModelConversationContext } from './conversation-memory.helper';
import type { BotLike, ChatDebugInfo, DebugChunkExcerpt, ChatSource, DisplaySource, RunChatInput, RunChatResult } from './chat-engine.types';
import type { ChatContextEvidenceItem } from './chat-context.types';
import type { AnswerabilityContext } from './answerability.types';
import type { RankedKnowledgeItem } from '../rag/unified-retrieval.types';
import { inferChunkKind } from '../kb/chunking.helper';
import { excerptForDebug, getChunkQualitySignals } from './chunk-quality.helper';
import {
  classifyQuestion,
  computeAnswerabilityContext,
  evaluateEvidenceStrength,
} from './answerability.helper';
import { assembleEvidencePromptWithBudget } from './evidence-budget.helper';
import { DEFAULT_SECTION_BUDGET, estimateTokens } from './token-budget.helper';
import { rankFaqsByRelevance } from './faq-relevance.helper';
import {
  buildLeadCaptureContext,
  classifyLeadIntent,
  detectDeclineResult,
  extractLeadFieldsFromMessage,
  getLeadStateFromConversation,
  mergeExtractedLeadDataWithDebug,
} from './lead-capture.helper';
import { normalizeLeadCaptureConfig } from './lead-capture-config';
import { SUMMARY_MIN_MESSAGES, SUMMARY_UPDATE_INTERVAL } from './conversation-summary.helper';
import { chatLog } from './chat-logger';
import { SummaryJobService } from './summary-job.service';
import { withRetry, withTimeout, AI_CALL_TIMEOUTS } from '../lib/ai-call.helper';

/** Max relevant FAQs to include (after ranking). */
const MAX_FAQS_IN_CONTEXT = 5;


function rankedItemToEvidenceItem(item: RankedKnowledgeItem): ChatContextEvidenceItem {
  const url =
    item.metadata != null && typeof item.metadata === 'object' && 'url' in item.metadata
      ? (item.metadata as { url?: string }).url
      : undefined;
  return {
    sourceType: item.sourceType,
    title: item.title,
    section: item.section,
    text: item.text,
    url,
  };
}

function rankedItemToEnrichedChunk(item: RankedKnowledgeItem): EnrichedChunk {
  const url =
    item.metadata != null && typeof item.metadata === 'object' && 'url' in item.metadata
      ? (item.metadata as { url?: string }).url
      : undefined;
  return {
    chunkId: item.id,
    documentId: item.sourceId,
    title: item.title,
    text: item.text,
    semanticScore: item.semanticScore,
    lexicalScore: item.lexicalScore,
    combinedScore: item.combinedScore,
    sourceType: item.sourceType,
    url,
  };
}

/** Chunk text from post-improvement chunking starts with "[Section]" and newline; legacy chunks do not. */
function chunkLooksNewFormat(chunkText: string): boolean {
  const t = (chunkText || '').trim();
  return /^\[[^\]]+\]\s*\n/.test(t) || (t.startsWith('[') && t.includes(']\n'));
}

/** Heuristic: reply overlaps substantially with at least one document snippet (admin debug). */
function answerOverlapsDocumentSnippets(
  reply: string,
  chunks: Array<{ text: string }>,
): boolean {
  const r = (reply || '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (r.length < 10) return false;
  for (const c of chunks) {
    const text = (c.text || '').toLowerCase().replace(/\s+/g, ' ').trim();
    if (text.length < 10) continue;
    for (let len = Math.min(40, text.length); len >= 15; len--) {
      for (let i = 0; i <= text.length - len; i++) {
        const sub = text.slice(i, i + len);
        if (sub.includes('  ')) continue;
        if (r.includes(sub)) return true;
      }
    }
  }
  return false;
}

type AskStrategy = 'soft' | 'balanced' | 'direct';
type CaptureMode = 'chat' | 'form' | 'hybrid';

/** Decide if we should suggest asking for a lead field this turn (strategy + capture mode + intent). */
function computeShouldAskThisTurn(
  messageCount: number,
  askStrategy: AskStrategy,
  captureMode: CaptureMode,
  intent?: string,
): boolean {
  if (messageCount < 1) return false;
  let effective: AskStrategy = captureMode === 'form' ? 'soft' : askStrategy;
  if (intent === 'buying') effective = effective === 'soft' ? 'balanced' : effective === 'balanced' ? 'direct' : effective;
  else if (intent === 'urgent' || intent === 'support') effective = 'soft';
  else if (intent === 'browsing') effective = 'soft';
  switch (effective) {
    case 'soft':
      return messageCount >= 4 && messageCount % 4 === 0;
    case 'balanced':
      return messageCount >= 2 && messageCount % 2 === 0;
    case 'direct':
      return true;
    default:
      return messageCount >= 2 && messageCount % 2 === 0;
  }
}

/** Resolve {{Name}}, {{Tagline}}, {{description}} in welcome message template. */
function resolveWelcomeMessage(
  template: string,
  bot: { name?: string; shortDescription?: string; description?: string },
): string {
  const name = String(bot.name ?? '').trim();
  const tagline = String(bot.shortDescription ?? '').trim();
  const description = String(bot.description ?? '').trim();
  return template
    .replace(/\{\{Name\}\}/g, name)
    .replace(/\{\{Tagline\}\}/g, tagline)
    .replace(/\{\{description\}\}/g, description);
}

/** Build deduped ChatSource[] from enriched chunks; excerpt text for UI safety. */
function buildDedupedSources(chunks: EnrichedChunk[]): ChatSource[] {
  const seen = new Set<string>();
  const out: ChatSource[] = [];
  for (const c of chunks) {
    if (seen.has(c.chunkId)) continue;
    seen.add(c.chunkId);
    out.push({
      documentId: c.documentId,
      chunkId: c.chunkId,
      title: c.title,
      sourceType: c.sourceType || 'document',
      url: c.url,
      text: normalizeSourceExcerpt(c.text),
      score: c.combinedScore,
    });
  }
  return out;
}

/** Build display-oriented sources grouped by document; excerpt per chunk. */
function buildDisplaySources(chunks: EnrichedChunk[]): DisplaySource[] {
  const byDoc = new Map<string, { title: string; url?: string; sourceType?: string; chunks: DisplaySource['chunks'] }>();
  for (const c of chunks) {
    if (!byDoc.has(c.documentId)) {
      byDoc.set(c.documentId, { title: c.title, url: c.url, sourceType: c.sourceType || 'document', chunks: [] });
    }
    byDoc.get(c.documentId)!.chunks.push({
      chunkId: c.chunkId,
      text: normalizeSourceExcerpt(c.text),
      score: c.combinedScore,
    });
  }
  const out: DisplaySource[] = [];
  for (const [documentId, v] of byDoc.entries()) {
    v.chunks.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    out.push({ documentId, title: v.title, sourceType: v.sourceType || 'document', url: v.url, chunks: v.chunks });
  }
  out.sort((a, b) => (b.chunks[0]?.score ?? 0) - (a.chunks[0]?.score ?? 0));
  return out;
}

/** Build admin-safe debug excerpt for a chunk (scores + short text + section + lexical breakdown). No embeddings or secrets. */
function toDebugChunkExcerpt(c: EnrichedChunk): DebugChunkExcerpt {
  const chunkHeading = extractChunkHeading(c.text);
  const chunkKind = inferChunkKind(c.text);
  const lb = c.lexicalBreakdown;
  const exactPhraseScore = lb?.phraseBonus ?? 0;
  const headingTitleScore = (lb?.headingBonus ?? 0) + (lb?.titleBonus ?? 0);
  return {
    documentId: c.documentId,
    title: c.title,
    chunkId: c.chunkId,
    sourceType: c.sourceType || 'document',
    sourceId: c.documentId,
    textExcerpt: excerptForDebug(c.text),
    semanticScore: c.semanticScore,
    lexicalScore: c.lexicalScore,
    exactPhraseScore,
    headingTitleScore,
    combinedScore: c.combinedScore,
    ...(chunkHeading ? { chunkHeading, section: chunkHeading } : {}),
    chunkKind,
    ...(lb ? { lexicalBreakdown: lb } : {}),
  };
}

/** Normalize message for duplicate check: trim, collapse whitespace, lowercase. */
function normalizeMessageForDedupe(text: string): string {
  return (text || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Dedupe window: same message within this ms is treated as duplicate. */
const DEDUPE_WINDOW_MS = 25_000;

@Injectable()
export class ChatEngineService {
  constructor(
    private readonly config: ConfigService,
    private readonly ragService: RagService,
    private readonly unifiedKnowledgeRetrievalService: UnifiedKnowledgeRetrievalService,
    @InjectModel(Conversation.name) private readonly conversationModel: Model<Conversation>,
    @InjectModel(Message.name) private readonly messageModel: Model<Message>,
    @InjectModel(DocumentModel.name) private readonly documentModel: Model<DocumentModel>,
    private readonly summaryJobService: SummaryJobService,
  ) {}

  resolveOpenAIKey(params: { userApiKey?: string; bot: BotLike }): string {
    const requestKey = String(params.userApiKey || '').trim();
    if (requestKey) return requestKey;
    const botOverride = String(params.bot.openaiApiKeyOverride || '').trim();
    if (botOverride) return botOverride;
    return String(this.config.get<string>('openaiApiKey') || '').trim();
  }

  async runChat({
    bot,
    visitorId,
    message,
    mode,
    userApiKey,
    requestId: inputRequestId,
    debug: requestDebug = false,
  }: RunChatInput): Promise<RunChatResult> {
    const requestId = inputRequestId ?? `chat-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const startTime = Date.now();
    const endpoint = mode === 'super_admin' ? 'super-admin' : mode;

    chatLog({
      event: 'chat.request_started',
      level: 'info',
      botId: bot._id.toString(),
      visitorId,
      requestId,
      endpoint,
    });

    const resolvedApiKey = this.resolveOpenAIKey({ userApiKey, bot });
    if (!resolvedApiKey) {
      chatLog({
        event: 'chat.missing_openai_key',
        level: 'warn',
        botId: bot._id.toString(),
        requestId,
      });
      return { ok: false, error: 'missing_openai_key' };
    }

    const personality = bot.personality ?? {};
    const cfg = bot.config ?? {};
    const temperature = typeof cfg.temperature === 'number' ? cfg.temperature : 0.2;
    const maxTokens = typeof cfg.maxTokens === 'number' ? cfg.maxTokens : 512;

    const now = new Date();
    let conversation = await this.conversationModel.findOne({
      botId: bot._id,
      visitorId,
    });
    let isNewConversation = false;

    if (!conversation) {
      conversation = await this.conversationModel.create({
        botId: bot._id,
        visitorId,
        createdAt: now,
      });
      isNewConversation = true;
      const rawWelcome =
        typeof bot.welcomeMessage === 'string' ? bot.welcomeMessage.trim() : '';
      if (rawWelcome) {
        const welcomeText = resolveWelcomeMessage(rawWelcome, {
          name: bot.name,
          shortDescription: bot.shortDescription,
          description: bot.description,
        });
        await this.messageModel.create({
          conversationId: conversation._id,
          botId: bot._id,
          visitorId,
          role: 'assistant',
          content: welcomeText,
          createdAt: now,
        });
      }
    } else {
      const lastTwo = await this.messageModel
        .find({ conversationId: conversation._id })
        .sort({ createdAt: -1 })
        .limit(2)
        .select({ role: 1, content: 1, createdAt: 1 })
        .lean();
      if (lastTwo.length === 2) {
        const [newest, second] = lastTwo as Array<{ role: string; content?: string; createdAt: Date }>;
        const norm = normalizeMessageForDedupe(message);
        if (
          newest.role === 'assistant' &&
          second.role === 'user' &&
          normalizeMessageForDedupe(String(second.content || '')) === norm &&
          (now.getTime() - new Date(second.createdAt).getTime() < DEDUPE_WINDOW_MS)
        ) {
          chatLog({
            event: 'chat.duplicate_request_detected',
            level: 'info',
            botId: bot._id.toString(),
            conversationId: conversation._id.toString(),
            visitorId,
            requestId,
            endpoint,
          });
          return {
            ok: true,
            conversationId: conversation._id.toString(),
            assistantMessage: String(newest.content || '').trim() || "I'm here. How can I help?",
            isNewConversation: false,
          };
        }
      }
    }

    // Persist user message first so it is part of conversation history when we load messages.
    await this.messageModel.create({
      conversationId: conversation._id,
      botId: bot._id,
      visitorId,
      role: 'user',
      content: message,
      createdAt: now,
    });

    // Load conversation messages (chronological). Memory helper will exclude current message and apply window.
    const allMessages = await this.messageModel
      .find({ conversationId: conversation._id })
      .sort({ createdAt: 1 })
      .select({ role: 1, content: 1, createdAt: 1 })
      .lean();
    const allMessagesForContext = allMessages.map((m) => ({
      role: m.role as 'user' | 'assistant' | 'system',
      content: String(m.content || ''),
    }));
    const convSummary = (conversation as { summary?: string }).summary;
    const { messages: conversationMessages, summary: conversationSummary } = buildModelConversationContext(
      allMessagesForContext,
      message,
      { recentWindow: 14, storedSummary: convSummary },
    );

    // Retrieval: unified (evidence-first) or legacy RAG.
    const useUnifiedEvidencePrompt = this.config.get<boolean>('useUnifiedEvidencePrompt') === true;
    const retrievalStart = Date.now();
    let retrievalResult: RetrievalResult;
    let unifiedResult: Awaited<ReturnType<UnifiedKnowledgeRetrievalService['getRelevantKnowledgeItemsForBot']>> | null = null;
    if (useUnifiedEvidencePrompt) {
      try {
        unifiedResult = await this.unifiedKnowledgeRetrievalService.getRelevantKnowledgeItemsForBot(
          bot._id.toString(),
          message,
          {
            limit: 25,
            apiKeyOverride: resolvedApiKey,
            debug: requestDebug ?? false,
            bot,
          },
        );
      } catch (unifiedErr) {
        const msg = unifiedErr instanceof Error ? unifiedErr.message : 'unified_retrieval_failed';
        chatLog({
          event: 'chat.unified_retrieval_failed',
          level: 'warn',
          botId: bot._id.toString(),
          conversationId: conversation._id.toString(),
          visitorId,
          requestId,
          reason: msg.slice(0, 80),
        });
        unifiedResult = { items: [] };
      }
      retrievalResult = {
        confidence: unifiedResult.items.length === 0 ? 'low' : 'medium',
        chunks: [],
        metadata: undefined,
      };
    } else {
      try {
        retrievalResult = await this.ragService.getRelevantChunksForBotWithConfidence(
          bot._id.toString(),
          message,
          12,
          resolvedApiKey,
        );
      } catch (retrievalErr) {
        const msg = retrievalErr instanceof Error ? retrievalErr.message : 'retrieval_failed';
        chatLog({
          event: 'chat.retrieval_failed',
          level: 'warn',
          botId: bot._id.toString(),
          conversationId: conversation._id.toString(),
          visitorId,
          requestId,
          reason: msg.slice(0, 80),
        });
        retrievalResult = { confidence: 'low', chunks: [] };
      }
    }
    const retrievalDurationMs = Date.now() - retrievalStart;
    const { confidence: retrievalConfidence, chunks: enrichedChunks, metadata: retrievalMetadata } = retrievalResult;
    // Safety logs: make document/chunk gaps visible
    if (retrievalMetadata) {
      const { eligibleDocumentCount, eligibleChunkCount, chunksWithValidEmbeddingCount, retrievedChunkCount } = retrievalMetadata;
      if (eligibleDocumentCount > 0 && eligibleChunkCount === 0) {
        chatLog({
          event: 'chat.rag_eligible_docs_no_chunks',
          level: 'warn',
          botId: bot._id.toString(),
          requestId,
          metadata: { eligibleDocumentCount },
        });
      }
      if (eligibleChunkCount > 0 && chunksWithValidEmbeddingCount === 0) {
        chatLog({
          event: 'chat.rag_chunks_missing_embeddings',
          level: 'warn',
          botId: bot._id.toString(),
          requestId,
          metadata: { eligibleChunkCount },
        });
      }
      if (eligibleDocumentCount > 0 && retrievedChunkCount === 0) {
        chatLog({
          event: 'chat.rag_no_document_chunks_retrieved',
          level: 'info',
          botId: bot._id.toString(),
          requestId,
          metadata: { eligibleDocumentCount, chunksWithValidEmbeddingCount },
        });
      }
      const botIds = retrievalMetadata.retrievedChunkBotIds ?? [];
      const requestBotId = bot._id.toString();
      if (botIds.length > 1 || (botIds.length === 1 && botIds[0] !== requestBotId)) {
        chatLog({
          event: 'chat.rag_bot_isolation_check',
          level: 'warn',
          botId: requestBotId,
          requestId,
          metadata: { retrievalRequestBotId: retrievalMetadata.requestBotId, retrievedChunkBotIds: botIds },
        });
      }
    }
    if (retrievalConfidence === 'low' && enrichedChunks.length > 0) {
      chatLog({
        event: 'chat.retrieval_low_confidence',
        level: 'info',
        botId: bot._id.toString(),
        conversationId: conversation._id.toString(),
        requestId,
        retrievalConfidence: 'low',
      });
    }

    // Lead capture: state from conversation + meta; extraction with last-asked context; decline detection.
    const leadConfig = bot.leadCapture;
    const conv = conversation as {
      capturedLeadData?: CapturedLeadData;
      leadCaptureMeta?: LeadCaptureMeta;
      summary?: string;
    };
    const { collected: initialCollected, requiredFields, optionalFields, fieldLabels, fieldAliases } =
      getLeadStateFromConversation(conv.capturedLeadData, leadConfig);
    const allFieldKeys = [...requiredFields, ...optionalFields];
    const { extracted, confidenceByField, matchedByField } = extractLeadFieldsFromMessage(
      message,
      allFieldKeys,
      fieldLabels,
      { lastAskedField: conv.leadCaptureMeta?.lastAskedField, fieldAliases },
    );
    const fieldTypes = Object.fromEntries(
      (normalizeLeadCaptureConfig(leadConfig).fields ?? []).map((f) => [f.key, f.type ?? 'text']),
    );
    const { collected: mergedCollected, overwritten: leadOverwritten, skipped: leadSkipped } =
      mergeExtractedLeadDataWithDebug(
        initialCollected,
        extracted,
        confidenceByField,
        undefined,
        fieldTypes,
      );

    const updates: { capturedLeadData?: CapturedLeadData; leadCaptureMeta?: LeadCaptureMeta } = {};
    const declineResult = detectDeclineResult(message);
    const lastAsked = conv.leadCaptureMeta?.lastAskedField;
    if (declineResult && lastAsked) {
      const meta = { ...conv.leadCaptureMeta };
      if (declineResult === 'declined') {
        meta.declinedFields = Array.from(new Set([...(meta.declinedFields ?? []), lastAsked]));
        updates.leadCaptureMeta = meta;
      } else if (declineResult === 'postponed') {
        meta.postponedFields = Array.from(new Set([...(meta.postponedFields ?? []), lastAsked]));
        updates.leadCaptureMeta = meta;
      }
      // partial: do not add to declined/postponed; allow re-ask after normal cooldown
    }

    const messageCount = allMessagesForContext.length;
    const normalizedLead = normalizeLeadCaptureConfig(leadConfig);
    const leadIntent = classifyLeadIntent(message);
    const shouldAskThisTurn = computeShouldAskThisTurn(
      messageCount,
      normalizedLead.askStrategy,
      normalizedLead.captureMode,
      leadIntent,
    );
    const leadCaptureContext = buildLeadCaptureContext(
      mergedCollected,
      requiredFields,
      optionalFields,
      fieldLabels,
      {
        messageCountInConversation: messageCount,
        meta: conv.leadCaptureMeta,
        shouldAskThisTurn,
        askStrategy: normalizedLead.askStrategy,
        politeMode: normalizedLead.politeMode,
      },
    );

    const leadFieldsCapturedCount = Object.keys(mergedCollected).length - Object.keys(initialCollected).length;
    if (leadFieldsCapturedCount > 0) {
      updates.capturedLeadData = mergedCollected;
      chatLog({
        event: 'chat.lead_fields_captured',
        level: 'info',
        botId: bot._id.toString(),
        conversationId: conversation._id.toString(),
        visitorId,
        requestId,
        leadFieldsCapturedCount,
      });
    }
    if (leadCaptureContext.shouldAskNow && leadCaptureContext.missingRequired.length > 0) {
      updates.leadCaptureMeta = {
        ...(updates.leadCaptureMeta ?? conv.leadCaptureMeta),
        lastAskedField: leadCaptureContext.missingRequired[0],
        lastAskedAt: now,
        lastAskedMessageCount: messageCount,
      };
    }
    if (Object.keys(updates).length > 0) {
      await this.conversationModel.updateOne({ _id: conversation._id }, { $set: updates });
    }

    let budgetResult: Awaited<ReturnType<typeof assembleContextWithBudget>>;
    let trimmedChunks: EnrichedChunk[];
    let trimmedFaqs: Array<{ question: string; answer: string }>;
    let documentDirectAnswerLikely: boolean;
    let ctx: ReturnType<typeof buildChatKnowledgeContext>;
    let evidenceTrimmedOutIds: string[] = [];
    let evidenceKeptCount = 0;
    let evidenceBlockTokensUsed = 0;
    let faqCountBeforeTrim: number | undefined;
    let protectedEvidenceCount = 0;
    let evidenceTrimReason: string | undefined;
    let conversationTrimReason: string | undefined;
    let evidenceTrimSummary: string | undefined;
    let evidencePromptTokenDistribution: ChatDebugInfo['evidencePromptTokenDistribution'];
    let conversationMessagesTrimmedOut = 0;
    let evidenceItemsKeptIds: string[] = [];
    let answerabilityContext: AnswerabilityContext | undefined;

    if (useUnifiedEvidencePrompt && unifiedResult != null) {
      const evidenceItems: ChatContextEvidenceItem[] = unifiedResult.items.map(rankedItemToEvidenceItem);
      const userMax = DEFAULT_SECTION_BUDGET.userMaxTokens;
      const currentMsgTokens = estimateTokens(message);
      const budget = assembleEvidencePromptWithBudget(
        evidenceItems,
        conversationMessages,
        currentMsgTokens,
        userMax,
        undefined,
      );

      const evidenceKept = budget.evidenceKept;
      evidenceKeptCount = evidenceKept.length;
      evidenceTrimmedOutIds = unifiedResult.items.slice(evidenceKept.length).map((item) => item.id);
      evidenceBlockTokensUsed = budget.tokenDistribution.userEvidence;
      protectedEvidenceCount = budget.protectedEvidenceCount;
      evidenceTrimReason = budget.evidenceTrimReason;
      conversationTrimReason = budget.conversationTrimReason;
      evidenceTrimSummary = budget.trimSummary;
      conversationMessagesTrimmedOut = budget.conversationTrimmedOut.length;
      evidenceItemsKeptIds = unifiedResult.items.slice(0, evidenceKeptCount).map((item) => item.id);
      evidencePromptTokenDistribution = {
        system: 0,
        userEvidence: budget.tokenDistribution.userEvidence,
        userConversation: budget.tokenDistribution.userConversation,
        userCurrentMessage: budget.tokenDistribution.userCurrentMessage,
        userTotal: budget.tokenDistribution.userTotal,
      };

      budgetResult = {
        conversationMessages: budget.conversationKept,
        documentChunks: [],
        faqs: [],
        tokenCounts: {
          conversation: budget.tokenDistribution.userConversation,
          chunks: budget.tokenDistribution.userEvidence,
          faqs: 0,
          currentMessage: currentMsgTokens,
          notes: 0,
          totalUserEstimate: budget.tokenDistribution.userTotal,
        },
        trimmed: {
          historyDropped: budget.conversationTrimmedOut.length,
          chunksDropped: budget.evidenceTrimmedOut.length,
          faqsDropped: 0,
        },
        finalDocumentChunkCount: 0,
        finalFaqCount: 0,
      };
      trimmedChunks = unifiedResult.items.slice(0, evidenceKeptCount).map(rankedItemToEnrichedChunk);
      trimmedFaqs = [];
      faqCountBeforeTrim = undefined;
      documentDirectAnswerLikely = evidenceKept.length > 0;

      const keptRankedItems = unifiedResult.items.slice(0, evidenceKeptCount);
      const questionClassification = classifyQuestion(message);
      const evidenceStrength = evaluateEvidenceStrength(keptRankedItems);
      answerabilityContext = computeAnswerabilityContext(questionClassification, evidenceStrength);

      ctx = buildChatKnowledgeContext({
        botName: (bot.name || 'Assistant').trim(),
        category: bot.category,
        personalityPreset: personality.behaviorPreset,
        personalityDescription: personality.description,
        thingsToAvoid: personality.thingsToAvoid,
        tone: personality.tone ?? 'friendly',
        language: personality.language ?? 'en',
        responseLength: cfg.responseLength ?? 'medium',
        systemPrompt: personality.systemPrompt,
        knowledgeNotes: undefined,
        leadCapture: leadCaptureContext,
        conversationMessages: budgetResult.conversationMessages as Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
        conversationSummary,
        currentUserMessage: message,
        retrievalConfidence: retrievalConfidence,
        documentDirectAnswerLikely,
        unifiedEvidence: evidenceKept,
        answerability: {
          evidenceStrongEnough: answerabilityContext.evidenceStrongEnough,
          directAnswerLikely: answerabilityContext.directAnswerLikely,
          shouldUseFallback: answerabilityContext.shouldUseFallback,
          shouldAnswerGenerally: answerabilityContext.shouldAnswerGenerally,
        },
      });
    } else {
      const rankedFaqs = rankFaqsByRelevance(bot.faqs ?? [], message, MAX_FAQS_IN_CONTEXT);
      faqCountBeforeTrim = rankedFaqs.length;
      const chunksForBudget = enrichedChunks.map((c) => ({
        ...c,
        text: c.text,
        score: c.combinedScore,
      }));
      budgetResult = assembleContextWithBudget({
        conversationMessages,
        documentChunks: chunksForBudget,
        faqs: rankedFaqs,
        currentUserMessage: message,
        knowledgeNotes: bot.knowledgeDescription,
        leadBlockChars: leadCaptureContext.enabled ? 300 : 0,
        budget: DEFAULT_SECTION_BUDGET,
      });
      trimmedChunks = budgetResult.documentChunks as EnrichedChunk[];
      trimmedFaqs = budgetResult.faqs;
      documentDirectAnswerLikely =
        trimmedChunks.length > 0 &&
        (trimmedChunks.some((c) => c.combinedScore >= 0.4) ||
          trimmedChunks.some(
            (c) =>
              c.lexicalBreakdown &&
              (c.lexicalBreakdown.headingBonus > 0 ||
                c.lexicalBreakdown.phraseBonus > 0 ||
                c.lexicalBreakdown.faqQuestionBonus > 0 ||
                c.lexicalBreakdown.titleBonus >= 0.1),
          ));

      ctx = buildChatKnowledgeContext({
        botName: (bot.name || 'Assistant').trim(),
        category: bot.category,
        personalityPreset: personality.behaviorPreset,
        personalityDescription: personality.description,
        thingsToAvoid: personality.thingsToAvoid,
        tone: personality.tone ?? 'friendly',
        language: personality.language ?? 'en',
        responseLength: cfg.responseLength ?? 'medium',
        systemPrompt: personality.systemPrompt,
        knowledgeNotes: bot.knowledgeDescription,
        faqs: trimmedFaqs.length ? trimmedFaqs : undefined,
        documentChunks:
          trimmedChunks.length > 0
            ? trimmedChunks.map((c) => ({
                documentId: c.documentId,
                title: c.title,
                chunkId: c.chunkId,
                text: c.text,
                score: c.combinedScore,
                url: c.url,
                sourceType: c.sourceType,
              }))
            : undefined,
        leadCapture: leadCaptureContext,
        conversationMessages: budgetResult.conversationMessages as Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
        conversationSummary,
        currentUserMessage: message,
        retrievalConfidence: retrievalConfidence,
        documentDirectAnswerLikely,
      });
    }

    const { systemPrompt, userPrompt } = formatPromptFromContext(ctx);

    const fallbackMessage =
      "I don't have enough information to answer that right now. Is there something else I can help with?";
    let assistantMessage = fallbackMessage;

    const completionStart = Date.now();
    try {
      const openai = new OpenAI({ apiKey: resolvedApiKey });
      const completion = await withRetry(
        (attempt) =>
          withTimeout(
            openai.chat.completions.create({
              model: 'gpt-4.1-mini',
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
              ],
              temperature,
              max_tokens: maxTokens,
            }),
            AI_CALL_TIMEOUTS.completion,
            'completion',
          ),
        { maxRetries: 2 },
      );
      assistantMessage = completion.choices[0]?.message?.content?.trim() || fallbackMessage;
    } catch (chatError) {
      const errMsg = chatError instanceof Error ? chatError.message : String(chatError);
      chatLog({
        event: 'chat.request_failed',
        level: 'error',
        botId: bot._id.toString(),
        conversationId: conversation._id.toString(),
        visitorId,
        requestId,
        endpoint,
        reason: errMsg.slice(0, 80),
      });
    }
    const completionDurationMs = Date.now() - completionStart;
    if (!assistantMessage?.trim()) {
      assistantMessage = fallbackMessage;
      chatLog({
        event: 'chat.empty_completion_fallback',
        level: 'warn',
        botId: bot._id.toString(),
        conversationId: conversation._id.toString(),
        requestId,
      });
    }

    const sources = buildDedupedSources(trimmedChunks);
    const displaySources = buildDisplaySources(trimmedChunks);
    const messageSources =
      sources.length > 0
        ? sources.map((s) => ({
            chunkId: s.chunkId,
            docId: s.documentId,
            docTitle: s.title,
            preview: s.text.slice(0, 200),
            score: s.score,
          }))
        : undefined;

    await this.messageModel.create({
      conversationId: conversation._id,
      botId: bot._id,
      visitorId,
      role: 'assistant',
      content: assistantMessage,
      sources: messageSources,
      createdAt: new Date(),
    });

    const totalMessagesNow = messageCount + 2;
    const summaryEligible =
      totalMessagesNow >= SUMMARY_MIN_MESSAGES && totalMessagesNow % SUMMARY_UPDATE_INTERVAL === 0;
    let summaryEnqueued = false;
    const enqueueStart = Date.now();
    if (summaryEligible) {
      const botOid = typeof bot._id === 'object' && 'toHexString' in bot._id ? (bot._id as Types.ObjectId) : new Types.ObjectId(bot._id.toString());
      summaryEnqueued = await this.summaryJobService.enqueue(conversation._id, botOid);
    }
    const summaryEnqueueDurationMs = summaryEligible ? Date.now() - enqueueStart : undefined;

    const totalDurationMs = Date.now() - startTime;
    chatLog({
      event: 'chat.request_completed',
      level: 'info',
      botId: bot._id.toString(),
      conversationId: conversation._id.toString(),
      visitorId,
      requestId,
      endpoint,
      retrievalConfidence: retrievalConfidence,
      messageCount: totalMessagesNow,
      durationMs: totalDurationMs,
      retrievalDurationMs,
      completionDurationMs,
      summaryEnqueueDurationMs,
      selectedChunksCount: trimmedChunks.length,
      usedFaqCount: trimmedFaqs.length,
      summaryUsed: !!conversationSummary,
    });

    const result: RunChatResult = {
      ok: true,
      conversationId: conversation._id.toString(),
      assistantMessage,
      sources: sources.length ? sources : undefined,
      displaySources: displaySources.length ? displaySources : undefined,
      isNewConversation,
    };
    if (requestDebug) {
      const debugInfo: ChatDebugInfo = {
        userQuery: message,
        eligibleCountBySourceType: {
          notes: bot.knowledgeDescription?.trim() ? 1 : 0,
          faqs: (bot.faqs ?? []).length,
          documentChunks: retrievalMetadata?.eligibleChunkCount ?? 0,
        },
        eligibleChunkCountByDocumentSourceType: retrievalMetadata?.eligibleChunkCountBySourceType,
        retrievalConfidence: retrievalConfidence,
        usedChunkIds: trimmedChunks.map((c) => c.chunkId),
        usedFaqCount: trimmedFaqs.length,
        historyMessageCount: budgetResult.conversationMessages.length,
        leadCaptureState: leadCaptureContext.enabled
          ? {
              collectedKeys: Object.keys(leadCaptureContext.collected).filter(
                (k) => leadCaptureContext.collected[k]?.trim(),
              ),
              missingRequired: leadCaptureContext.missingRequired,
              declinedFields: conv.leadCaptureMeta?.declinedFields ?? [],
              postponedFields: conv.leadCaptureMeta?.postponedFields ?? [],
              shouldAskNow: leadCaptureContext.shouldAskNow,
            }
          : undefined,
        promptSectionSizes: { systemChars: systemPrompt.length, userChars: userPrompt.length },
        lowConfidenceMode: retrievalConfidence === 'low',
        tokenBudget: {
          conversationTokens: budgetResult.tokenCounts.conversation,
          chunksTokens: budgetResult.tokenCounts.chunks,
          faqsTokens: budgetResult.tokenCounts.faqs,
          currentMessageTokens: budgetResult.tokenCounts.currentMessage,
          notesTokens: budgetResult.tokenCounts.notes,
          totalUserEstimate: budgetResult.tokenCounts.totalUserEstimate,
          historyDropped: budgetResult.trimmed.historyDropped,
          chunksDropped: budgetResult.trimmed.chunksDropped,
          faqsDropped: budgetResult.trimmed.faqsDropped,
        },
        topChunkScores: trimmedChunks.slice(0, 10).map((c) => c.combinedScore),
        extractionMethodsByField: Object.keys(matchedByField).length ? matchedByField : undefined,
        leadOverwritten: leadOverwritten.length ? leadOverwritten : undefined,
        leadSkipped: leadSkipped.length ? leadSkipped : undefined,
        intentClassification: leadIntent,
        summaryUsed: !!conversationSummary,
        summaryEligible,
        summaryAttempted: false,
        summaryGenerated: false,
        summaryEnqueued,
        retrievalDurationMs,
        completionDurationMs,
        summaryEnqueueDurationMs,
        totalDurationMs,
        retrievalRequestBotId: retrievalMetadata?.requestBotId,
        eligibleDocumentCount: retrievalMetadata?.eligibleDocumentCount,
        eligibleChunkCount: retrievalMetadata?.eligibleChunkCount,
        chunksWithValidEmbeddingCount: retrievalMetadata?.chunksWithValidEmbeddingCount,
        retrievedDocumentChunkCount: retrievalMetadata?.retrievedChunkCount,
        retrievedChunkBotIds: retrievalMetadata?.retrievedChunkBotIds,
        trimmedDocumentChunkCount: useUnifiedEvidencePrompt
          ? (unifiedResult?.items.length ?? 0) - evidenceKeptCount
          : enrichedChunks.length - trimmedChunks.length,
        finalPromptDocumentChunkCount: trimmedChunks.length,
        selectedDocumentTitles: [...new Set(trimmedChunks.map((c) => c.title))],
        selectedDocumentChunkIds: trimmedChunks.map((c) => c.chunkId),
        faqCountBeforeTrim: faqCountBeforeTrim,
        faqCountAfterTrim: trimmedFaqs.length,
        topRetrievedDocumentChunks: enrichedChunks.slice(0, 12).map(toDebugChunkExcerpt),
        finalPromptDocumentChunks: trimmedChunks.map(toDebugChunkExcerpt),
        documentChunksTrimmedOut: (() => {
          const inPrompt = new Set(trimmedChunks.map((c) => c.chunkId));
          return enrichedChunks.filter((c) => !inPrompt.has(c.chunkId)).map(toDebugChunkExcerpt);
        })(),
        faqEntriesUsed: trimmedFaqs.map((f) => ({
          questionExcerpt: excerptForDebug(f.question, 80),
          answerExcerpt: excerptForDebug(f.answer, 80),
        })),
        retrievalModeSummary: `${enrichedChunks.length} retrieved, ${trimmedChunks.length} in prompt; ${trimmedFaqs.length} FAQs; docs ${trimmedChunks.length > 0 ? 'included' : 'none'}`,
        documentChunksInPrompt: trimmedChunks.length > 0,
        chunkQualitySignals: trimmedChunks.length > 0 ? getChunkQualitySignals(trimmedChunks) : undefined,
        documentsBeforeFaqs: true,
        documentDirectAnswerLikely,
        promptKnowledgeSummary: [
          `Notes: ${bot.knowledgeDescription?.trim() ? 1 : 0}`,
          `Documents: ${trimmedChunks.length}`,
          `Supporting FAQs: ${trimmedFaqs.length}`,
        ].join(', '),
        strongestDocumentChunkScore:
          trimmedChunks.length > 0
            ? Math.max(...trimmedChunks.map((c) => c.combinedScore))
            : undefined,
        strongestFaqCount: trimmedFaqs.length,
        finalPromptContainsStrongDoc: trimmedChunks.some((c) => c.combinedScore >= 0.35),
        answerUsedDocumentLikely:
          trimmedChunks.length > 0 && assistantMessage
            ? answerOverlapsDocumentSnippets(assistantMessage, trimmedChunks)
            : false,
        reIngestionRecommended:
          trimmedChunks.length > 0 &&
          !trimmedChunks.some((c) => chunkLooksNewFormat(c.text)),
        promptTokenEstimatesByBlock: {
          system: estimateTokens(systemPrompt),
          userNotes: budgetResult.tokenCounts.notes,
          userDocuments: budgetResult.tokenCounts.chunks,
          userFaqs: budgetResult.tokenCounts.faqs,
          userConversation: budgetResult.tokenCounts.conversation,
          userCurrentMessage: budgetResult.tokenCounts.currentMessage,
          userTotal: budgetResult.tokenCounts.totalUserEstimate,
        },
        useUnifiedEvidencePrompt: useUnifiedEvidencePrompt ? true : undefined,
        evidenceItemsInPrompt: useUnifiedEvidencePrompt ? evidenceKeptCount : undefined,
        evidenceItemsTrimmedOut: useUnifiedEvidencePrompt && evidenceTrimmedOutIds.length > 0 ? evidenceTrimmedOutIds : undefined,
        evidenceBlockTokens: useUnifiedEvidencePrompt ? evidenceBlockTokensUsed : undefined,
        evidencePromptTokenDistribution:
          useUnifiedEvidencePrompt && evidencePromptTokenDistribution
            ? { ...evidencePromptTokenDistribution, system: estimateTokens(systemPrompt) }
            : undefined,
        protectedEvidenceCount: useUnifiedEvidencePrompt ? protectedEvidenceCount : undefined,
        evidenceItemsKeptIds: useUnifiedEvidencePrompt && evidenceItemsKeptIds.length > 0 ? evidenceItemsKeptIds : undefined,
        conversationMessagesTrimmedOut: useUnifiedEvidencePrompt ? conversationMessagesTrimmedOut : undefined,
        evidenceTrimReason: useUnifiedEvidencePrompt ? evidenceTrimReason : undefined,
        conversationTrimReason: useUnifiedEvidencePrompt ? conversationTrimReason : undefined,
        evidenceTrimSummary: useUnifiedEvidencePrompt ? evidenceTrimSummary : undefined,
        questionClassification: answerabilityContext?.questionClassification,
        evidenceStrengthSummary: answerabilityContext?.evidenceStrengthSummary
          ? {
              topCombinedScore: answerabilityContext.evidenceStrengthSummary.topCombinedScore,
              scoreGap: answerabilityContext.evidenceStrengthSummary.scoreGap,
              evidenceItemCount: answerabilityContext.evidenceStrengthSummary.evidenceItemCount,
              hasStrongMatchSignal: answerabilityContext.evidenceStrengthSummary.hasStrongMatchSignal,
            }
          : undefined,
        evidenceStrongEnough: answerabilityContext?.evidenceStrongEnough,
        directAnswerLikely: answerabilityContext?.directAnswerLikely,
        companySpecificQuestion: answerabilityContext?.companySpecificQuestion,
        shouldUseFallback: answerabilityContext?.shouldUseFallback,
        shouldAnswerGenerally: answerabilityContext?.shouldAnswerGenerally,
        answerabilityExplanation: answerabilityContext?.decisionExplanation,
      };
      if (useUnifiedEvidencePrompt && unifiedResult != null) {
        debugInfo.unifiedRetrievalUsed = true;
        if (unifiedResult.debug) {
          debugInfo.unifiedRetrievalEligibleCounts = unifiedResult.debug.eligibleCountBySourceType;
          if (unifiedResult.debug.retrievedBySourceType) {
            debugInfo.unifiedRetrievalBySourceType = Object.fromEntries(
              Object.entries(unifiedResult.debug.retrievedBySourceType).map(([k, arr]) => [
                k,
                (arr ?? []).map((it) => ({
                  sourceType: it.sourceType,
                  title: it.title.slice(0, 80),
                  combinedScore: it.combinedScore,
                })),
              ]),
            );
          }
          debugInfo.unifiedRetrievalScoreBreakdown = unifiedResult.debug.scoreBreakdown;
          debugInfo.unifiedRetrievalDiversityDebug = unifiedResult.debug.diversityDebug;
        }
      } else if (this.config.get<boolean>('useUnifiedKnowledgeRetrieval')) {
        try {
          const unifiedResultDebug = await this.unifiedKnowledgeRetrievalService.getRelevantKnowledgeItemsForBot(
            bot._id.toString(),
            message,
            {
              limit: 20,
              apiKeyOverride: resolvedApiKey,
              debug: true,
              bot: { faqs: bot.faqs, knowledgeDescription: bot.knowledgeDescription },
            },
          );
          debugInfo.unifiedRetrievalUsed = true;
          if (unifiedResultDebug.debug) {
            debugInfo.unifiedRetrievalEligibleCounts = unifiedResultDebug.debug.eligibleCountBySourceType;
            if (unifiedResultDebug.debug.retrievedBySourceType) {
              debugInfo.unifiedRetrievalBySourceType = Object.fromEntries(
                Object.entries(unifiedResultDebug.debug.retrievedBySourceType).map(([k, arr]) => [
                  k,
                  (arr ?? []).map((it) => ({
                    sourceType: it.sourceType,
                    title: it.title.slice(0, 80),
                    combinedScore: it.combinedScore,
                  })),
                ]),
              );
            }
            debugInfo.unifiedRetrievalScoreBreakdown = unifiedResultDebug.debug.scoreBreakdown;
            debugInfo.unifiedRetrievalDiversityDebug = unifiedResultDebug.debug.diversityDebug;
          }
        } catch (unifiedErr) {
          debugInfo.unifiedRetrievalUsed = false;
        }
      }
      result.debug = debugInfo;
    }
    return result;
  }
}
