import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Types } from 'mongoose';
import OpenAI from 'openai';
import { Conversation, Message } from '../models';
import type { CapturedLeadData, LeadCaptureMeta } from '../models';
import { UnifiedKnowledgeRetrievalService } from '../rag/unified-knowledge-retrieval.service';
import { extractChunkHeading, normalizeSourceExcerpt } from '../rag/retrieval-helpers';
import type { EnrichedChunk } from '../rag/retrieval.types';
import { buildChatKnowledgeContext, formatPromptFromContext } from './chat-context-builder';
import { buildModelConversationContext } from './conversation-memory.helper';
import type { BotLike, ChatDebugInfo, DebugChunkExcerpt, ChatSource, DisplaySource, RunChatInput, RunChatResult } from './chat-engine.types';
import type { ChatContextEvidenceItem } from './chat-context.types';
import type { AnswerabilityContext } from './answerability.types';
import type { RankedKnowledgeItem } from '../rag/unified-retrieval.types';
import { inferChunkKind } from '../knowledge/chunking.helper';
import { excerptForDebug, getChunkQualitySignals } from './chunk-quality.helper';
import {
  classifyQuestion,
  computeAnswerabilityContext,
  evaluateEvidenceStrength,
} from './answerability.helper';
import { assembleEvidencePromptWithBudget } from './evidence-budget.helper';
import { DEFAULT_SECTION_BUDGET, estimateTokens } from './token-budget.helper';
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

/** Chunk text from post-improvement chunking starts with "[Section]" and newline; older chunks may not. */
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
    private readonly unifiedKnowledgeRetrievalService: UnifiedKnowledgeRetrievalService,
    @InjectModel(Conversation.name) private readonly conversationModel: Model<Conversation>,
    @InjectModel(Message.name) private readonly messageModel: Model<Message>,
    private readonly summaryJobService: SummaryJobService,
  ) { }

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
    const endpoint = mode === 'user' ? 'user' : mode;

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

    // Unified knowledge retrieval (evidence-first prompt).
    const retrievalStart = Date.now();
    let unifiedResult: Awaited<ReturnType<UnifiedKnowledgeRetrievalService['getRelevantKnowledgeItemsForBot']>>;
    try {
      unifiedResult = await this.unifiedKnowledgeRetrievalService.getRelevantKnowledgeItemsForBot(
        bot._id.toString(),
        message,
        {
          limit: 25,
          apiKeyOverride: resolvedApiKey,
          debug: requestDebug ?? false,
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
    const retrievalDurationMs = Date.now() - retrievalStart;
    const retrievalConfidence = unifiedResult.items.length === 0 ? 'low' : 'medium';

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
    const evidenceKeptCount = evidenceKept.length;
    const evidenceTrimmedOutIds = unifiedResult.items.slice(evidenceKeptCount).map((item) => item.id);
    const evidenceBlockTokensUsed = budget.tokenDistribution.userEvidence;
    const protectedEvidenceCount = budget.protectedEvidenceCount;
    const evidenceTrimReason = budget.evidenceTrimReason;
    const conversationTrimReason = budget.conversationTrimReason;
    const evidenceTrimSummary = budget.trimSummary;
    const conversationMessagesTrimmedOut = budget.conversationTrimmedOut.length;
    const evidenceItemsKeptIds = unifiedResult.items.slice(0, evidenceKeptCount).map((item) => item.id);
    const evidencePromptTokenDistribution: ChatDebugInfo['evidencePromptTokenDistribution'] = {
      system: 0,
      userEvidence: budget.tokenDistribution.userEvidence,
      userConversation: budget.tokenDistribution.userConversation,
      userCurrentMessage: budget.tokenDistribution.userCurrentMessage,
      userTotal: budget.tokenDistribution.userTotal,
    };

    const budgetResult = {
      conversationMessages: budget.conversationKept,
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
    };

    const trimmedChunks: EnrichedChunk[] = unifiedResult.items.slice(0, evidenceKeptCount).map(rankedItemToEnrichedChunk);
    const documentDirectAnswerLikely = evidenceKept.length > 0;

    const keptRankedItems = unifiedResult.items.slice(0, evidenceKeptCount);
    const questionClassification = classifyQuestion(message);
    const evidenceStrength = evaluateEvidenceStrength(keptRankedItems);
    const answerabilityContext = computeAnswerabilityContext(questionClassification, evidenceStrength);

    const ctx = buildChatKnowledgeContext({
      botName: (bot.name || 'Assistant').trim(),
      category: bot.category,
      personalityPreset: personality.behaviorPreset,
      personalityDescription: personality.description,
      thingsToAvoid: personality.thingsToAvoid,
      tone: personality.tone ?? 'friendly',
      language: personality.language ?? 'en',
      responseLength: cfg.responseLength ?? 'medium',
      systemPrompt: personality.systemPrompt,
      leadCapture: leadCaptureContext,
      conversationMessages: budgetResult.conversationMessages as Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
      conversationSummary,
      currentUserMessage: message,
      retrievalConfidence,
      documentDirectAnswerLikely,
      unifiedEvidence: evidenceKept,
      answerability: {
        evidenceStrongEnough: answerabilityContext.evidenceStrongEnough,
        directAnswerLikely: answerabilityContext.directAnswerLikely,
        shouldUseFallback: answerabilityContext.shouldUseFallback,
        shouldAnswerGenerally: answerabilityContext.shouldAnswerGenerally,
      },
    });

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
      retrievalConfidence,
      messageCount: totalMessagesNow,
      durationMs: totalDurationMs,
      retrievalDurationMs,
      completionDurationMs,
      summaryEnqueueDurationMs,
      selectedChunksCount: trimmedChunks.length,
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
      const topRetrievedForDebug = unifiedResult.items.slice(0, 12).map(rankedItemToEnrichedChunk);
      const documentChunksTrimmedOutForDebug = unifiedResult.items
        .slice(evidenceKeptCount)
        .map(rankedItemToEnrichedChunk)
        .map(toDebugChunkExcerpt);

      const finalAnswerMode: ChatDebugInfo['finalAnswerMode'] =
        answerabilityContext?.shouldUseFallback === true
          ? 'safe_fallback'
          : answerabilityContext?.shouldAnswerGenerally === true
            ? 'general'
            : 'grounded';
      const retrievalOutcome: ChatDebugInfo['retrievalOutcome'] =
        unifiedResult.items.length === 0
          ? 'none'
          : (answerabilityContext?.evidenceStrongEnough === true ? 'strong' : 'weak');

      const debugInfo: ChatDebugInfo = {
        userQuery: message,
        finalAnswerPipeline: 'unified',
        finalAnswerMode,
        retrievalOutcome,
        retrievalConfidence,
        usedChunkIds: trimmedChunks.map((c) => c.chunkId),
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
          evidenceTokens: budgetResult.tokenCounts.chunks,
          currentMessageTokens: budgetResult.tokenCounts.currentMessage,
          totalUserEstimate: budgetResult.tokenCounts.totalUserEstimate,
          historyDropped: budgetResult.trimmed.historyDropped,
          evidenceDropped: budgetResult.trimmed.chunksDropped,
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
        trimmedEvidenceCount: unifiedResult.items.length - evidenceKeptCount,
        evidenceItemsInFinalPrompt: trimmedChunks.length,
        selectedDocumentTitles: [...new Set(trimmedChunks.map((c) => c.title))],
        selectedDocumentChunkIds: trimmedChunks.map((c) => c.chunkId),
        topRetrievedDocumentChunks: topRetrievedForDebug.map(toDebugChunkExcerpt),
        finalPromptDocumentChunks: trimmedChunks.map(toDebugChunkExcerpt),
        documentChunksTrimmedOut: documentChunksTrimmedOutForDebug,
        retrievalModeSummary: `${unifiedResult.items.length} retrieved, ${trimmedChunks.length} in prompt; ${trimmedChunks.length > 0 ? 'included' : 'none'}`,
        documentChunksInPrompt: trimmedChunks.length > 0,
        chunkQualitySignals: trimmedChunks.length > 0 ? getChunkQualitySignals(trimmedChunks) : undefined,
        documentDirectAnswerLikely,
        strongestDocumentChunkScore:
          trimmedChunks.length > 0
            ? Math.max(...trimmedChunks.map((c) => c.combinedScore))
            : undefined,
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
          userEvidence: budgetResult.tokenCounts.chunks,
          userConversation: budgetResult.tokenCounts.conversation,
          userCurrentMessage: budgetResult.tokenCounts.currentMessage,
          userTotal: budgetResult.tokenCounts.totalUserEstimate,
        },
        unifiedRetrievalUsed: true,
        evidenceItemsInPrompt: evidenceKeptCount,
        evidenceItemsTrimmedOut: evidenceTrimmedOutIds.length > 0 ? evidenceTrimmedOutIds : undefined,
        evidenceBlockTokens: evidenceBlockTokensUsed,
        evidencePromptTokenDistribution: {
          ...evidencePromptTokenDistribution,
          system: estimateTokens(systemPrompt),
        },
        protectedEvidenceCount,
        evidenceItemsKeptIds: evidenceItemsKeptIds.length > 0 ? evidenceItemsKeptIds : undefined,
        conversationMessagesTrimmedOut,
        evidenceTrimReason,
        conversationTrimReason,
        evidenceTrimSummary,
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
      if (unifiedResult.debug) {
        debugInfo.knowledgeBaseItemIds = unifiedResult.debug.knowledgeBaseItemIds;
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
      result.debug = debugInfo;
    }
    return result;
  }
}
