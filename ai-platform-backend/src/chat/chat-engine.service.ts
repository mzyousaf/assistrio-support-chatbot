import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, type PipelineStage } from 'mongoose';
import { Types } from 'mongoose';
import OpenAI from 'openai';
import { Conversation, Message, UsageLedger } from '../models';
import type { CapturedLeadData, LeadCaptureMeta } from '../models';
import { UnifiedKnowledgeRetrievalService } from '../rag/unified-knowledge-retrieval.service';
import { extractChunkHeading, normalizeSourceExcerpt } from '../rag/retrieval-helpers';
import type { EnrichedChunk } from '../rag/retrieval.types';
import { buildChatKnowledgeContext, formatPromptFromContext } from './chat-context-builder';
import { resolvePersonalityLanguageForPrompt } from './response-language.util';
import { buildModelConversationContext } from './conversation-memory.helper';
import type {
  BotLike,
  ChatDebugInfo,
  DebugChunkExcerpt,
  ChatSource,
  DisplaySource,
  ConversationOriginPayload,
  RunChatInput,
  RunChatResult,
} from './chat-engine.types';
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
  messageProbablyRefusesLeadQuestion,
} from './lead-capture.helper';
import { normalizeLeadCaptureConfig } from './lead-capture-config';
import { EMBED_CONVERSATION_MESSAGE_PROJECT } from './embed-conversation-message-fields.constant';
import { SUMMARY_MIN_MESSAGES, SUMMARY_UPDATE_INTERVAL } from './conversation-summary.helper';
import { chatLog } from './chat-logger';
import { TopicSentimentClassificationService } from '../analytics/topic-sentiment-classification.service';
import { SummaryJobService } from './summary-job.service';
import { withRetry, withTimeout, AI_CALL_TIMEOUTS } from '../lib/ai-call.helper';
import { isWelcomeMessageActive } from '../bots/welcome-message-display.util';
import { normalizeVisitorMultiChatMax } from '../bots/visitor-multi-chat.util';
import type {
  MessageAttachment,
  MessageInputType,
  MessageSource,
  MessageSpeechInput,
  MessageVoiceMeta,
} from '../models/message.schema';
import { userMessageTextForLlm } from './user-message-text-for-llm';
import { findMatchingSuggestionContext, parseExampleQuestionsFromDoc } from '../workspace/shared/example-questions.util';
import { buildSuggestionScopedRankedItem } from './suggestion-scoped.util';
import { KnowledgeBaseItemService } from '../knowledge/knowledge-base-item.service';
import { resolveEffectiveTranslationSettings } from './translation-runtime.util';
import {
  mergeConversationOriginRecords,
  resolveConversationStartedFrom,
  sanitizeConversationOriginForPersistence,
} from './conversation-analytics-origin.util';
import {
  buildConversationAnalyticsPersistence,
  mergeConversationDeviceInfoRecords,
  mergeConversationLocationRecords,
} from './conversation-analytics-location-device.util';
import {
  inferSuggestedQuestionForFirstTurn,
  messageInputRouteDefaultsFromRunChatInput,
  resolveMessageInputAnalytics,
} from './message-input-analytics.util';
import { getServerLocalMonthlyBillingPeriod } from './chat-billing-period.util';
import { calculateMessageCreditUsage } from './message-credit.util';
import type { MessageCreditCalculation } from './message-credit.util';
import { normalizeAssistantMessageSourcesForPersistence } from './assistant-message-sources.normalize';
import {
  buildConversationTurnAnalyticsPatch,
  mergeLeadFieldKeys,
} from './conversation-turn-analytics.util';
import {
  buildWorkspaceConversationListMatch,
  buildWorkspaceLeadsListFacetPipeline,
  collectCapturedLeadDataKeysUnionFromLeadRows,
  collectCapturedLeadDataKeysWithValues,
  mergeCapturedLeadFieldMetaSnapshot,
  mergeCustomerLeadFieldDefinitions,
  serializeCustomerWorkspaceLeadDetail,
  serializeCustomerWorkspaceLeadListRow,
  serializeMessageFeedbackForWorkspace,
  serializeWorkspaceConversationDetail,
  serializeWorkspaceConversationListRow,
  serializeWorkspaceMessageAttachment,
  serializeWorkspaceMessageRow,
  type WorkspaceConversationListFilters,
  type WorkspaceLeadsListFilters,
} from './workspace-conversation-serialize.util';

function mergeCapturedLeadFieldMessageIds(
  existingRaw: unknown,
  userMsgId: Types.ObjectId,
  appliedFieldKeys: string[],
): Record<string, Types.ObjectId> {
  const next: Record<string, Types.ObjectId> = {};
  if (existingRaw && typeof existingRaw === 'object' && !Array.isArray(existingRaw)) {
    for (const [k, v] of Object.entries(existingRaw as Record<string, unknown>)) {
      const key = k?.trim();
      if (!key) continue;
      if (v instanceof Types.ObjectId) next[key] = v;
      else if (typeof v === 'string' && Types.ObjectId.isValid(v.trim())) next[key] = new Types.ObjectId(v.trim());
    }
  }
  for (const k of appliedFieldKeys) {
    const key = k?.trim();
    if (!key) continue;
    next[key] = userMsgId;
  }
  return next;
}

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
  const kbId = String(item.sourceId ?? '').trim();
  return {
    chunkId: item.id,
    documentId: item.sourceId,
    ...(Types.ObjectId.isValid(kbId) ? { knowledgeBaseItemId: kbId } : {}),
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

function parseJsonObjectFromText(text: string): Record<string, unknown> | null {
  const raw = String(text || '').trim();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      const parsed = JSON.parse(match[0]);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
}

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

const CHAT_COMPLETION_MODEL = 'gpt-4.1-mini';

@Injectable()
export class ChatEngineService {
  constructor(
    private readonly config: ConfigService,
    private readonly unifiedKnowledgeRetrievalService: UnifiedKnowledgeRetrievalService,
    private readonly knowledgeBaseItemService: KnowledgeBaseItemService,
    @InjectModel(Conversation.name) private readonly conversationModel: Model<Conversation>,
    @InjectModel(Message.name) private readonly messageModel: Model<Message>,
    @InjectModel(UsageLedger.name) private readonly usageLedgerModel: Model<UsageLedger>,
    private readonly summaryJobService: SummaryJobService,
    private readonly topicSentimentClassificationService: TopicSentimentClassificationService,
  ) { }

  private parseOptionalObjectId(s?: string): Types.ObjectId | null {
    if (!s || !String(s).trim()) return null;
    try {
      return new Types.ObjectId(String(s).trim());
    } catch {
      return null;
    }
  }

  private static readonly LEAD_SOURCE_MESSAGE_PREVIEW_MAX = 400;

  private truncateLeadSourceMessagePreview(text: string): string {
    const t = text.trim();
    const max = ChatEngineService.LEAD_SOURCE_MESSAGE_PREVIEW_MAX;
    if (t.length <= max) return t;
    return `${t.slice(0, max - 1)}…`;
  }

  /** User message text that triggered lead capture (truncated for workspace JSON). */
  private async resolveLeadSourceMessagePreview(
    conversationId: Types.ObjectId,
    leadSourceMessageIdRaw: unknown,
  ): Promise<string | undefined> {
    let mid: Types.ObjectId | null = null;
    if (leadSourceMessageIdRaw instanceof Types.ObjectId) {
      mid = leadSourceMessageIdRaw;
    } else if (typeof leadSourceMessageIdRaw === 'string' && Types.ObjectId.isValid(leadSourceMessageIdRaw.trim())) {
      try {
        mid = new Types.ObjectId(leadSourceMessageIdRaw.trim());
      } catch {
        mid = null;
      }
    }
    if (!mid) return undefined;
    const doc = await this.messageModel
      .findOne({ _id: mid, conversationId })
      .select({ role: 1, content: 1, speechInput: 1, attachments: 1 })
      .lean();
    if (!doc || doc.role !== 'user') return undefined;
    const line = userMessageTextForLlm(
      typeof doc.content === 'string' ? doc.content : '',
      doc.speechInput ?? null,
      Array.isArray(doc.attachments) ? doc.attachments : null,
    ).trim();
    if (!line) return undefined;
    return this.truncateLeadSourceMessagePreview(line);
  }

  /**
   * Best-effort ledger append: failures are logged and must not affect chat completion.
   */
  private async safeAppendMessageUsageLedger(params: {
    bot: BotLike;
    conversation: Conversation & { _id: Types.ObjectId };
    chatVisitorId: string;
    messageId: Types.ObjectId;
    credit: MessageCreditCalculation;
    billingPeriodStart: Date;
    billingPeriodEnd: Date;
    now: Date;
    sessionSource: string;
    inputType?: MessageInputType;
    inputMethod?: string;
    voiceMeta?: MessageVoiceMeta;
    hasAttachments: boolean;
    previewInitiatedByUserId?: string;
  }): Promise<void> {
    try {
      const workspaceOid = this.parseOptionalObjectId(params.bot.workspaceId?.trim());
      const previewCust = this.parseOptionalObjectId(String(params.previewInitiatedByUserId ?? '').trim());
      const ownerOid = this.parseOptionalObjectId(params.bot.ownerId?.trim());
      const customerOid = previewCust ?? ownerOid;
      const startedFrom = (params.conversation as { startedFrom?: string }).startedFrom;
      const vm = params.voiceMeta;
      await this.usageLedgerModel.create({
        ...(workspaceOid ? { workspaceId: workspaceOid } : {}),
        ...(customerOid ? { customerId: customerOid } : {}),
        botId: new Types.ObjectId(params.bot._id.toString()),
        conversationId: params.conversation._id,
        messageId: params.messageId,
        visitorId: params.chatVisitorId,
        usageType: params.credit.usageType,
        creditsUsed: params.credit.creditsUsed,
        creditRule: params.credit.creditRule,
        planAtTime: 'free',
        billingPeriodStart: params.billingPeriodStart,
        billingPeriodEnd: params.billingPeriodEnd,
        chargedAt: params.now,
        metadata: {
          inputType: params.inputType,
          inputMethod: params.inputMethod,
          startedFrom: startedFrom ?? undefined,
          sessionSource: params.sessionSource,
          hasVoice: vm?.isVoiceMessage === true,
          hasDictation: vm?.isDictationMessage === true,
          hasAttachment: params.hasAttachments,
          dictationSessionCount:
            typeof vm?.dictationSessionCount === 'number' && Number.isFinite(vm.dictationSessionCount)
              ? Math.trunc(vm.dictationSessionCount)
              : undefined,
          billable: params.credit.billable,
          configuredCredits: params.credit.configuredCredits,
          creditRuleVersion: params.credit.creditRuleVersion,
          creditBreakdown: params.credit.breakdown,
        },
        createdAt: params.now,
      });
    } catch (err) {
      chatLog({
        event: 'usage_ledger.write_failed',
        level: 'warn',
        botId: params.bot._id.toString(),
        conversationId: params.conversation._id.toString(),
        chatVisitorId: params.chatVisitorId,
        metadata: {
          reason: err instanceof Error ? err.message.slice(0, 240) : String(err).slice(0, 240),
        },
      });
    }
  }

  /** Conversation counters / flags; must not fail chat if Mongo rejects an update. */
  private async safeApplyConversationTurnRollup(params: {
    conversationId: Types.ObjectId;
    botId: string;
    chatVisitorId: string;
    userMessage: {
      createdAt: Date;
      inputType?: MessageInputType;
      inputMethod?: string;
      voiceMeta?: MessageVoiceMeta | null;
      attachmentCount?: number;
      hasTextContent?: boolean;
      creditCost?: number;
    };
    assistantMessage: {
      createdAt: Date;
      sources?: MessageSource[];
    };
    conversationBefore: { firstUserMessageAt?: Date };
  }): Promise<void> {
    try {
      const patch = buildConversationTurnAnalyticsPatch({
        userMessage: params.userMessage,
        assistantMessage: {
          createdAt: params.assistantMessage.createdAt,
          sources: params.assistantMessage.sources,
        },
        conversationBefore: params.conversationBefore,
      });
      await this.conversationModel.updateOne({ _id: params.conversationId }, patch);
    } catch (err) {
      chatLog({
        event: 'conversation.turn_rollup_failed',
        level: 'warn',
        botId: params.botId,
        conversationId: params.conversationId.toString(),
        chatVisitorId: params.chatVisitorId,
        metadata: {
          reason: err instanceof Error ? err.message.slice(0, 240) : String(err).slice(0, 240),
        },
      });
    }
  }

  resolveOpenAIKey(params: { userApiKey?: string; bot: BotLike }): string {
    const requestKey = String(params.userApiKey || '').trim();
    if (requestKey) return requestKey;
    const botOverride = String(params.bot.openaiApiKeyOverride || '').trim();
    if (botOverride) return botOverride;
    return String(this.config.get<string>('openaiApiKey') || '').trim();
  }

  /**
   * Backfill `startedFrom` / `conversationOrigin` on resumed threads (additive; does not overwrite a known startedFrom).
   */
  private async patchConversationAnalyticsOnResume(
    conversation: Conversation & { _id: Types.ObjectId },
    sessionSource: 'runtime' | 'widget_preview' | 'shared_link' | 'shared_preview' | 'iframe_embed',
    incoming?: ConversationOriginPayload,
  ): Promise<void> {
    const rawExisting = conversation.conversationOrigin;
    const existingOrigin =
      rawExisting && typeof rawExisting === 'object' && !Array.isArray(rawExisting)
        ? { ...(rawExisting as unknown as Record<string, unknown>) }
        : undefined;
    const sanitizedIncoming = sanitizeConversationOriginForPersistence(incoming);
    const mergedOrigin = mergeConversationOriginRecords(existingOrigin, sanitizedIncoming);
    const mergedForResolve: ConversationOriginPayload = {
      ...(mergedOrigin as unknown as ConversationOriginPayload),
    };
    const startedFromResolved = resolveConversationStartedFrom({
      sessionSource,
      conversationOrigin: mergedForResolve,
    });
    const currentSf = (conversation as { startedFrom?: string }).startedFrom;
    const shouldSetStartedFrom = !currentSf || currentSf === 'unknown';

    const $set: Record<string, unknown> = {};
    if (mergedOrigin && Object.keys(mergedOrigin).length > 0) {
      $set.conversationOrigin = mergedOrigin;
    }
    if (shouldSetStartedFrom) {
      $set.startedFrom = startedFromResolved;
    }
    const created = (conversation as { createdAt?: Date }).createdAt;
    if (!(conversation as { startedAt?: Date }).startedAt && created instanceof Date) {
      $set.startedAt = created;
    }

    if (Object.keys($set).length === 0) return;

    await this.conversationModel.updateOne({ _id: conversation._id }, { $set });
    if ($set.conversationOrigin) {
      (conversation as { conversationOrigin?: unknown }).conversationOrigin = $set.conversationOrigin;
    }
    if ($set.startedFrom) {
      (conversation as { startedFrom?: unknown }).startedFrom = $set.startedFrom;
    }
    if ($set.startedAt) {
      (conversation as { startedAt?: unknown }).startedAt = $set.startedAt as Date;
    }
  }

  private async patchConversationLocationDeviceOnResume(
    conversation: Conversation & { _id: Types.ObjectId },
    incoming: { location?: Record<string, unknown>; deviceInfo?: Record<string, unknown> },
  ): Promise<void> {
    if (!incoming.location && !incoming.deviceInfo) return;
    const rawLoc = conversation.location;
    const existingLoc =
      rawLoc && typeof rawLoc === 'object' && !Array.isArray(rawLoc)
        ? { ...(rawLoc as unknown as Record<string, unknown>) }
        : undefined;
    const rawDev = conversation.deviceInfo;
    const existingDev =
      rawDev && typeof rawDev === 'object' && !Array.isArray(rawDev)
        ? { ...(rawDev as unknown as Record<string, unknown>) }
        : undefined;
    const mergedLoc = mergeConversationLocationRecords(existingLoc, incoming.location);
    const mergedDev = mergeConversationDeviceInfoRecords(existingDev, incoming.deviceInfo);
    const $set: Record<string, unknown> = {};
    if (mergedLoc && Object.keys(mergedLoc).length > 0) $set.location = mergedLoc;
    if (mergedDev && Object.keys(mergedDev).length > 0) $set.deviceInfo = mergedDev;
    if (Object.keys($set).length === 0) return;
    await this.conversationModel.updateOne({ _id: conversation._id }, { $set });
    if ($set.location) (conversation as { location?: unknown }).location = $set.location;
    if ($set.deviceInfo) (conversation as { deviceInfo?: unknown }).deviceInfo = $set.deviceInfo;
  }

  private async resolveMongoConversation(
    bot: BotLike,
    chatVisitorId: string,
    now: Date,
    inputConversationId: string | undefined,
    inputStartNew: boolean | undefined,
    multiEnabled: boolean,
    multiMax: number | null,
    sessionSource: 'runtime' | 'widget_preview' | 'shared_link' | 'shared_preview' | 'iframe_embed',
    previewInitiatedByUserId?: string,
    conversationOrigin?: ConversationOriginPayload,
    analyticsPersistence?: { location?: Record<string, unknown>; deviceInfo?: Record<string, unknown> } | null,
  ): Promise<
    | { ok: true; conversation: Conversation; isNewConversation: boolean }
    | { ok: false; error: 'conversation_not_found' | 'visitor_multi_chat_limit_reached' }
  > {
    const botOid =
      typeof bot._id === 'object' && 'toHexString' in bot._id
        ? (bot._id as Types.ObjectId)
        : new Types.ObjectId(bot._id.toString());

    const initiatorOid =
      sessionSource === 'widget_preview' &&
      previewInitiatedByUserId &&
      Types.ObjectId.isValid(previewInitiatedByUserId.trim())
        ? new Types.ObjectId(previewInitiatedByUserId.trim())
        : undefined;

    const originDoc = sanitizeConversationOriginForPersistence(conversationOrigin);
    const startedFrom = resolveConversationStartedFrom({ sessionSource, conversationOrigin });

    const createWithWelcome = async (): Promise<Conversation> => {
      const conv = await this.conversationModel.create({
        botId: botOid,
        chatVisitorId,
        createdAt: now,
        lastActivityAt: now,
        sessionSource,
        startedFrom,
        startedAt: now,
        lastMessageAt: now,
        ...(initiatorOid ? { previewInitiatedByUserId: initiatorOid } : {}),
        ...(originDoc ? { conversationOrigin: originDoc } : {}),
        ...(analyticsPersistence?.location ? { location: analyticsPersistence.location } : {}),
        ...(analyticsPersistence?.deviceInfo ? { deviceInfo: analyticsPersistence.deviceInfo } : {}),
      });
      if (sessionSource !== 'widget_preview') {
        const rawWelcome = typeof bot.welcomeMessage === 'string' ? bot.welcomeMessage.trim() : '';
        if (rawWelcome && isWelcomeMessageActive(bot)) {
          const welcomeText = resolveWelcomeMessage(rawWelcome, {
            name: bot.name,
            shortDescription: bot.shortDescription,
            description: bot.description,
          });
          await this.messageModel.create({
            conversationId: conv._id,
            botId: botOid,
            chatVisitorId,
            role: 'assistant',
            content: welcomeText,
            createdAt: now,
          });
        }
      }
      return conv;
    };

    if (!multiEnabled) {
      if (sessionSource === 'widget_preview') {
        const parsedPrevSingle = inputConversationId?.trim()
          ? this.parseOptionalObjectId(inputConversationId)
          : null;
        if (parsedPrevSingle) {
          let conversation = await this.conversationModel.findOne({
            _id: parsedPrevSingle,
            botId: botOid,
            chatVisitorId,
          });
          if (!conversation) {
            conversation = await this.conversationModel.findOne({
              _id: parsedPrevSingle,
              botId: botOid,
              visitorId: chatVisitorId,
            });
          }
          if (conversation) {
            return { ok: true, conversation, isNewConversation: false };
          }
          return { ok: false, error: 'conversation_not_found' };
        }
        if (inputStartNew) {
          const conv = await createWithWelcome();
          return { ok: true, conversation: conv, isNewConversation: true };
        }
        let conversation = await this.conversationModel.findOne({ botId: botOid, chatVisitorId });
        if (!conversation) {
          conversation = await this.conversationModel.findOne({ botId: botOid, visitorId: chatVisitorId });
        }
        if (!conversation) {
          const conv = await createWithWelcome();
          return { ok: true, conversation: conv, isNewConversation: true };
        }
        return { ok: true, conversation, isNewConversation: false };
      }
      let conversation = await this.conversationModel.findOne({
        botId: botOid,
        chatVisitorId,
      });
      if (!conversation) {
        conversation = await this.conversationModel.findOne({
          botId: botOid,
          visitorId: chatVisitorId,
        });
      }
      if (!conversation) {
        const conv = await createWithWelcome();
        return { ok: true, conversation: conv, isNewConversation: true };
      }
      return { ok: true, conversation, isNewConversation: false };
    }

    if (inputStartNew) {
      if (multiMax != null) {
        const count = await this.conversationModel.countDocuments({ botId: botOid, chatVisitorId });
        if (count >= multiMax) {
          return { ok: false, error: 'visitor_multi_chat_limit_reached' };
        }
      }
      const conv = await createWithWelcome();
      return { ok: true, conversation: conv, isNewConversation: true };
    }

    const parsedOid = inputConversationId?.trim() ? this.parseOptionalObjectId(inputConversationId) : null;
    if (parsedOid) {
      const conversation = await this.conversationModel.findOne({
        _id: parsedOid,
        botId: botOid,
        chatVisitorId,
      });
      if (!conversation) {
        return { ok: false, error: 'conversation_not_found' };
      }
      return { ok: true, conversation, isNewConversation: false };
    }

    let conversation = await this.conversationModel
      .findOne({ botId: botOid, chatVisitorId })
      .sort({ lastActivityAt: -1, createdAt: -1 })
      .exec();
    if (!conversation) {
      conversation = await this.conversationModel
        .findOne({ botId: botOid, visitorId: chatVisitorId })
        .sort({ lastActivityAt: -1, createdAt: -1 })
        .exec();
    }
    if (!conversation) {
      const conv = await createWithWelcome();
      return { ok: true, conversation: conv, isNewConversation: true };
    }
    return { ok: true, conversation, isNewConversation: false };
  }

  async runChat(input: RunChatInput): Promise<RunChatResult> {
    const {
      bot,
      chatVisitorId,
      message,
      mode,
      userApiKey,
      requestId: inputRequestId,
      debug: requestDebug = false,
      conversationId: inputConversationId,
      startNewConversation: inputStartNew,
      speechInput: inputSpeechInput,
      attachments: inputAttachments = [],
      previewInitiatedByUserId: inputPreviewInitiatedBy,
      previewMessageContext: inputPreviewMessageContext,
      conversationOrigin: inputConversationOrigin,
      analyticsContext: inputAnalyticsContext,
      analyticsRequestMeta: inputAnalyticsRequestMeta,
      messageAnalytics: inputMessageAnalytics,
    } = input;
    const sessionSource: 'runtime' | 'widget_preview' | 'shared_link' | 'shared_preview' | 'iframe_embed' =
      input.sessionSource ?? 'runtime';
    const previewMsgPersist =
      sessionSource === 'widget_preview' && inputPreviewMessageContext
        ? {
            ...(inputPreviewMessageContext.sourcePage?.trim()
              ? { previewSourcePage: inputPreviewMessageContext.sourcePage.trim().slice(0, 512) }
              : {}),
            ...(inputPreviewMessageContext.origin?.trim()
              ? { previewOrigin: inputPreviewMessageContext.origin.trim().slice(0, 256) }
              : {}),
          }
        : {};
    const messageForLlm = userMessageTextForLlm(message, inputSpeechInput, inputAttachments);
    const requestId = inputRequestId ?? `chat-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const startTime = Date.now();
    const endpoint = mode === 'user' ? 'user' : mode;

    chatLog({
      event: 'chat.request_started',
      level: 'info',
      botId: bot._id.toString(),
      chatVisitorId,
      requestId,
      endpoint,
      metadata: { sessionSource },
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
    const translation = resolveEffectiveTranslationSettings(bot);
    const temperature = typeof cfg.temperature === 'number' ? cfg.temperature : 0.2;
    const maxTokens = typeof cfg.maxTokens === 'number' ? cfg.maxTokens : 512;

    const now = new Date();
    const multiEnabled = bot.visitorMultiChatEnabled === true;
    const multiMax = normalizeVisitorMultiChatMax(bot.visitorMultiChatMax);

    const analyticsHashSecret =
      String(this.config.get<string>('analyticsHashSalt') ?? '').trim() ||
      String(this.config.get<string>('jwtSecret') ?? '').trim() ||
      'assistrio-analytics-dev-fallback';
    const analyticsPersistence = buildConversationAnalyticsPersistence({
      clientContext: inputAnalyticsContext,
      requestMeta: inputAnalyticsRequestMeta,
      hashSecret: analyticsHashSecret,
    });

    let conversation: Conversation & { _id: Types.ObjectId };
    let isNewConversation = false;

    const resolved = await this.resolveMongoConversation(
      bot,
      chatVisitorId,
      now,
      inputConversationId,
      inputStartNew,
      multiEnabled,
      multiMax,
      sessionSource,
      inputPreviewInitiatedBy,
      inputConversationOrigin,
      analyticsPersistence,
    );
    if (resolved.ok === false) return resolved;
    conversation = resolved.conversation as Conversation & { _id: Types.ObjectId };
    isNewConversation = resolved.isNewConversation;
    const firstUserMessageAtBeforeTurn = (conversation as { firstUserMessageAt?: Date }).firstUserMessageAt;

    if (!isNewConversation) {
      await this.patchConversationAnalyticsOnResume(conversation, sessionSource, inputConversationOrigin);
      await this.patchConversationLocationDeviceOnResume(conversation, analyticsPersistence);
    }

    const lastTwo = await this.messageModel
      .find({ conversationId: conversation._id })
      .sort({ createdAt: -1 })
      .limit(2)
      .select({ _id: 1, role: 1, content: 1, createdAt: 1, speechInput: 1 })
      .lean();
    if (lastTwo.length === 2) {
      const [newest, second] = lastTwo as Array<{
        _id: Types.ObjectId;
        role: string;
        content?: string;
        createdAt: Date;
        speechInput?: MessageSpeechInput;
      }>;
      const norm = normalizeMessageForDedupe(messageForLlm);
      if (
        newest.role === 'assistant' &&
        second.role === 'user' &&
        normalizeMessageForDedupe(
          userMessageTextForLlm(
            String(second.content || ''),
            second.speechInput,
            (second as { attachments?: MessageAttachment[] }).attachments,
          ),
        ) === norm &&
        now.getTime() - new Date(second.createdAt).getTime() < DEDUPE_WINDOW_MS
      ) {
        chatLog({
          event: 'chat.duplicate_request_detected',
          level: 'info',
          botId: bot._id.toString(),
          conversationId: conversation._id.toString(),
          chatVisitorId,
          requestId,
          endpoint,
        });
        return {
          ok: true,
          conversationId: conversation._id.toString(),
          assistantMessage: String(newest.content || '').trim() || "I'm here. How can I help?",
          assistantMessageId: newest._id.toString(),
          isNewConversation: false,
        };
      }
    }

    const priorUserMessageCount = await this.messageModel.countDocuments({
      conversationId: conversation._id,
      role: 'user',
    });
    const exampleQ = parseExampleQuestionsFromDoc((bot as { exampleQuestions?: unknown }).exampleQuestions);
    const inferredSuggestedQuestion = inferSuggestedQuestionForFirstTurn({
      priorUserMessageCount,
      suggestionId: input.suggestionId,
      messageForMatch: messageForLlm,
      exampleQuestions: exampleQ,
    });
    const messageInputResolved = resolveMessageInputAnalytics({
      messageAnalytics: inputMessageAnalytics,
      routeDefault: messageInputRouteDefaultsFromRunChatInput({ conversationOrigin: inputConversationOrigin }),
      hasAttachments: Boolean(inputAttachments?.length),
      text: message,
      speechInput: inputSpeechInput,
      inferredSuggestedQuestion,
    });
    const billingPeriod = getServerLocalMonthlyBillingPeriod(now);
    const userTextTrimmed = String(message ?? '').trim();
    const hasTextContent = userTextTrimmed.length > 0;
    const creditCalc = calculateMessageCreditUsage({
      inputType: messageInputResolved.inputType,
      inputMethod: messageInputResolved.inputMethod,
      voiceMeta: messageInputResolved.voiceMeta,
      hasAttachments: Boolean(inputAttachments?.length),
      hasTextContent,
    });

    const userMessageDoc = await this.messageModel.create({
      conversationId: conversation._id,
      botId: bot._id,
      chatVisitorId,
      role: 'user',
      content: message,
      originalText: message,
      englishText: message,
      englishTranscriptText: message,
      inputType: messageInputResolved.inputType,
      inputMethod: messageInputResolved.inputMethod,
      ...(messageInputResolved.voiceMeta ? { voiceMeta: messageInputResolved.voiceMeta } : {}),
      creditCost: creditCalc.creditsUsed,
      creditReason: creditCalc.creditReason,
      billingType: creditCalc.billingType,
      quotaPeriod: billingPeriod.quotaPeriod,
      chargedAt: now,
      creditBreakdown: creditCalc.breakdown,
      ...(inputSpeechInput ? { speechInput: inputSpeechInput } : {}),
      ...(inputAttachments?.length ? { attachments: inputAttachments } : {}),
      createdAt: now,
      ...previewMsgPersist,
    });
    await this.safeAppendMessageUsageLedger({
      bot,
      conversation,
      chatVisitorId,
      messageId: (userMessageDoc as { _id: Types.ObjectId })._id,
      credit: creditCalc,
      billingPeriodStart: billingPeriod.billingPeriodStart,
      billingPeriodEnd: billingPeriod.billingPeriodEnd,
      now,
      sessionSource,
      inputType: messageInputResolved.inputType,
      inputMethod: messageInputResolved.inputMethod,
      voiceMeta: messageInputResolved.voiceMeta,
      hasAttachments: Boolean(inputAttachments?.length),
      previewInitiatedByUserId: inputPreviewInitiatedBy,
    });

    const allMessages = await this.messageModel
      .find({ conversationId: conversation._id })
      .sort({ createdAt: 1 })
      .select({ role: 1, content: 1, createdAt: 1, speechInput: 1, attachments: 1 })
      .lean();
    const allMessagesForContext = allMessages.map((m) => ({
      role: m.role as 'user' | 'assistant' | 'system',
      content: userMessageTextForLlm(
        String(m.content || ''),
        (m as { speechInput?: MessageSpeechInput }).speechInput,
        (m as { attachments?: MessageAttachment[] }).attachments,
      ),
    }));
    const convSummary = (conversation as { summary?: string }).summary;
    const { messages: conversationMessages, summary: conversationSummary } = buildModelConversationContext(
      allMessagesForContext,
      messageForLlm,
      { recentWindow: 14, storedSummary: convSummary },
    );

    const userMessageCount = allMessagesForContext.filter((m) => m.role === 'user').length;
    const sidRaw = String(input.suggestionId ?? '').trim();
    let useKbSuggestionScope = false;
    let invalidSuggestionPayload = false;

    if (sidRaw && userMessageCount === 1) {
      if (!Types.ObjectId.isValid(sidRaw)) {
        invalidSuggestionPayload = true;
      } else {
        useKbSuggestionScope = await this.knowledgeBaseItemService.isValidSuggestionForScopedRetrieval(
          bot._id.toString(),
          sidRaw,
        );
        if (!useKbSuggestionScope) {
          invalidSuggestionPayload = true;
        }
      }
    }

    const matchedSuggestionContext = invalidSuggestionPayload
      ? null
      : findMatchingSuggestionContext(exampleQ, messageForLlm, userMessageCount);
    const suggestionScopeOnly = invalidSuggestionPayload || useKbSuggestionScope || Boolean(matchedSuggestionContext);

    if (suggestionScopeOnly) {
      chatLog({
        event: 'chat.suggestion_scoped',
        level: 'info',
        botId: bot._id.toString(),
        conversationId: conversation._id.toString(),
        chatVisitorId,
        requestId,
        ...(sidRaw ? { suggestionId: sidRaw } : {}),
        ...(invalidSuggestionPayload ? { invalidSuggestionPayload: true } : {}),
        ...(useKbSuggestionScope ? { knowledgeSuggestionScope: true } : {}),
      });
    }

    // Unified knowledge retrieval. KB suggestion id: only that item's chunks. Legacy: inline `context` on example question. Invalid id: empty evidence (no full KB).
    const retrievalStart = Date.now();
    let unifiedResult: Awaited<ReturnType<UnifiedKnowledgeRetrievalService['getRelevantKnowledgeItemsForBot']>>;
    if (invalidSuggestionPayload) {
      unifiedResult = { items: [] };
    } else if (useKbSuggestionScope && sidRaw) {
      try {
        unifiedResult = await this.unifiedKnowledgeRetrievalService.getRelevantKnowledgeItemsForBot(
          bot._id.toString(),
          messageForLlm,
          {
            limit: 25,
            apiKeyOverride: resolvedApiKey,
            debug: requestDebug ?? false,
            restrictToKnowledgeBaseItemId: sidRaw,
          },
        );
      } catch (unifiedErr) {
        const msg = unifiedErr instanceof Error ? unifiedErr.message : 'unified_retrieval_failed';
        chatLog({
          event: 'chat.unified_retrieval_failed',
          level: 'warn',
          botId: bot._id.toString(),
          conversationId: conversation._id.toString(),
          chatVisitorId,
          requestId,
          reason: msg.slice(0, 80),
        });
        unifiedResult = { items: [] };
      }
    } else if (suggestionScopeOnly && matchedSuggestionContext) {
      unifiedResult = {
        items: [buildSuggestionScopedRankedItem(matchedSuggestionContext, bot._id.toString())],
      };
    } else {
      try {
        unifiedResult = await this.unifiedKnowledgeRetrievalService.getRelevantKnowledgeItemsForBot(
          bot._id.toString(),
          messageForLlm,
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
          chatVisitorId,
          requestId,
          reason: msg.slice(0, 80),
        });
        unifiedResult = { items: [] };
      }
    }
    const retrievalDurationMs = Date.now() - retrievalStart;
    const retrievalConfidence: 'high' | 'medium' | 'low' = invalidSuggestionPayload
      ? 'low'
      : useKbSuggestionScope
        ? unifiedResult.items.length === 0
          ? 'low'
          : 'medium'
        : suggestionScopeOnly
          ? 'high'
          : unifiedResult.items.length === 0
            ? 'low'
            : 'medium';

    // Lead capture: state from conversation + meta; extraction with last-asked context; decline detection.
    const leadConfig = bot.leadCapture;
    const conv = conversation as {
      capturedLeadData?: CapturedLeadData;
      capturedLeadFieldMeta?: Record<string, unknown>;
      leadCaptureMeta?: LeadCaptureMeta;
      summary?: string;
      leadCapturedAt?: Date;
      leadFieldKeys?: string[];
      leadSourceMessageId?: Types.ObjectId;
      capturedLeadFieldMessageIds?: Record<string, Types.ObjectId>;
    };
    const { collected: initialCollected, requiredFields, optionalFields, fieldLabels, fieldAliases } =
      getLeadStateFromConversation(conv.capturedLeadData, leadConfig);
    const allFieldKeys = [...requiredFields, ...optionalFields];
    const declineResultForLead = detectDeclineResult(messageForLlm);
    let { extracted, confidenceByField, matchedByField } = extractLeadFieldsFromMessage(
      messageForLlm,
      allFieldKeys,
      fieldLabels,
      { lastAskedField: conv.leadCaptureMeta?.lastAskedField, fieldAliases },
    );
    const lastAskedLeadField = conv.leadCaptureMeta?.lastAskedField;
    if (
      lastAskedLeadField &&
      messageProbablyRefusesLeadQuestion(messageForLlm, declineResultForLead)
    ) {
      delete extracted[lastAskedLeadField];
      delete confidenceByField[lastAskedLeadField];
      delete matchedByField[lastAskedLeadField];
    }
    const fieldTypes = Object.fromEntries(
      (normalizeLeadCaptureConfig(leadConfig).fields ?? [])
        .filter((f) => !f.disabled)
        .map((f) => [f.key, f.type ?? 'text']),
    );
    const { collected: mergedCollected, overwritten: leadOverwritten, skipped: leadSkipped } =
      mergeExtractedLeadDataWithDebug(
        initialCollected,
        extracted,
        confidenceByField,
        undefined,
        fieldTypes,
      );

    const appliedLeadValueKeys = Object.keys(mergedCollected).filter((k) => {
      const newV = String(mergedCollected[k] ?? '').trim();
      const oldV = String(initialCollected[k] ?? '').trim();
      return newV.length > 0 && newV !== oldV;
    });
    const leadFieldsCapturedCount = Object.keys(mergedCollected).length - Object.keys(initialCollected).length;
    const leadCaptureDataUpdated = leadFieldsCapturedCount > 0 || appliedLeadValueKeys.length > 0;

    const updates: {
      capturedLeadData?: CapturedLeadData;
      capturedLeadFieldMeta?: Record<string, { label: string; type: string }>;
      leadCaptureMeta?: LeadCaptureMeta;
      hasLead?: boolean;
      leadCapturedAt?: Date;
      leadFieldKeys?: string[];
      leadSourceMessageId?: Types.ObjectId;
      capturedLeadFieldMessageIds?: Record<string, Types.ObjectId>;
    } = {};
    const declineResult = declineResultForLead;
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
      },
    );

    if (leadCaptureDataUpdated) {
      updates.capturedLeadData = mergedCollected;
      updates.hasLead = true;
      const capturedKeys = Object.keys(mergedCollected).filter((k) => String(mergedCollected[k] ?? '').trim());
      updates.leadFieldKeys = mergeLeadFieldKeys(conv.leadFieldKeys, capturedKeys);
      if (!conv.leadCapturedAt) {
        updates.leadCapturedAt = now;
      }
      if (!conv.leadSourceMessageId) {
        updates.leadSourceMessageId = (userMessageDoc as { _id: Types.ObjectId })._id;
      }
      if (appliedLeadValueKeys.length > 0) {
        updates.capturedLeadFieldMessageIds = mergeCapturedLeadFieldMessageIds(
          conv.capturedLeadFieldMessageIds,
          (userMessageDoc as { _id: Types.ObjectId })._id,
          appliedLeadValueKeys,
        );
      }
      const metaSnap = mergeCapturedLeadFieldMetaSnapshot(
        conv.capturedLeadFieldMeta,
        normalizedLead.fields.map((f) => ({
          key: f.key,
          label: f.label,
          type: f.type,
          disabled: f.disabled,
        })),
        appliedLeadValueKeys,
      );
      if (metaSnap) updates.capturedLeadFieldMeta = metaSnap;
      chatLog({
        event: 'chat.lead_fields_captured',
        level: 'info',
        botId: bot._id.toString(),
        conversationId: conversation._id.toString(),
        chatVisitorId,
        requestId,
        leadFieldsCapturedCount: appliedLeadValueKeys.length || leadFieldsCapturedCount,
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
    const currentMsgTokens = estimateTokens(messageForLlm);
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
    const questionClassification = classifyQuestion(messageForLlm);
    const evidenceStrength = evaluateEvidenceStrength(keptRankedItems);
    const answerabilityContext = computeAnswerabilityContext(questionClassification, evidenceStrength);

    const ctx = buildChatKnowledgeContext({
      botName: (bot.name || 'Assistant').trim(),
      category: bot.category,
      personalityPreset: personality.behaviorPreset,
      personalityDescription: personality.description,
      thingsToAvoid: personality.thingsToAvoid,
      tone: personality.tone ?? 'friendly',
      language: resolvePersonalityLanguageForPrompt(personality.language),
      responseLength: cfg.responseLength ?? 'medium',
      systemPrompt: personality.systemPrompt,
      leadCapture: leadCaptureContext,
      conversationMessages: budgetResult.conversationMessages as Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
      conversationSummary,
      currentUserMessage: messageForLlm,
      retrievalConfidence,
      documentDirectAnswerLikely,
      unifiedEvidence: evidenceKept,
      answerability: {
        evidenceStrongEnough: answerabilityContext.evidenceStrongEnough,
        directAnswerLikely: answerabilityContext.directAnswerLikely,
        shouldUseFallback: answerabilityContext.shouldUseFallback,
        shouldAnswerGenerally: answerabilityContext.shouldAnswerGenerally,
      },
      suggestionScopeOnly,
    });

    const { systemPrompt, userPrompt } = formatPromptFromContext(ctx);

    const fallbackMessage =
      "I don't have enough information to answer that right now. Is there something else I can help with?";
    let assistantMessage = fallbackMessage;
    let userEnglishText = String(message || '').trim() || message;
    let userOriginalLanguage = 'en';
    let assistantDisplayMessage = fallbackMessage;
    let assistantReplyLanguage = translation.mode === 'fixed' ? (translation.fixedLanguage ?? 'English') : 'English';

    const completionStart = Date.now();
    let completionModel: string | undefined;
    let completionUsage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined;
    let completionErrorBrief: string | undefined;
    try {
      const openai = new OpenAI({ apiKey: resolvedApiKey });
      const completion = await withRetry(
        (attempt) =>
          withTimeout(
            openai.chat.completions.create({
              model: CHAT_COMPLETION_MODEL,
              messages: [
                {
                  role: 'system',
                  content:
                    `${systemPrompt}\n\n` +
                    '--- Translation contract ---\n' +
                    'Return ONLY JSON (no markdown, no prose) with this exact schema: ' +
                    '{"userEnglishText":string,"userOriginalLanguage":string,"assistantReplyText":string,"assistantReplyLanguage":string,"assistantEnglishText":string}.\n' +
                    'Rules:\n' +
                    '- userEnglishText MUST be faithful English translation/paraphrase of the current user message.\n' +
                    '- assistantEnglishText MUST be faithful English version of the assistant answer.\n' +
                    '- assistantReplyText is the visitor-facing answer.\n' +
                    '- If mode is english_only: assistantReplyText and assistantEnglishText should both be English.\n' +
                    '- If mode is auto: assistantReplyText should match the user original language.\n' +
                    '- If mode is fixed: assistantReplyText should be in fixed language.\n' +
                    '- Never leave fields empty.',
                },
                {
                  role: 'user',
                  content:
                    `${userPrompt}\n\n` +
                    `Translation mode: ${translation.mode}\n` +
                    `Fixed language: ${translation.fixedLanguage ?? ''}\n` +
                    'Transcript language: english',
                },
              ],
              temperature,
              max_tokens: maxTokens,
            }),
            AI_CALL_TIMEOUTS.completion,
            'completion',
          ),
        { maxRetries: 2 },
      );
      completionModel = (completion as { model?: string }).model;
      const u = (completion as { usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } })
        .usage;
      if (u && typeof u === 'object') {
        completionUsage = {
          prompt_tokens: u.prompt_tokens,
          completion_tokens: u.completion_tokens,
          total_tokens: u.total_tokens,
        };
      }
      const rawModel = completion.choices[0]?.message?.content?.trim() || '';
      const parsed = parseJsonObjectFromText(rawModel);
      const parsedUserEnglish =
        typeof parsed?.userEnglishText === 'string' ? parsed.userEnglishText.trim() : '';
      const parsedUserLanguage =
        typeof parsed?.userOriginalLanguage === 'string' ? parsed.userOriginalLanguage.trim() : '';
      const parsedReply =
        typeof parsed?.assistantReplyText === 'string' ? parsed.assistantReplyText.trim() : '';
      const parsedReplyLang =
        typeof parsed?.assistantReplyLanguage === 'string' ? parsed.assistantReplyLanguage.trim() : '';
      const parsedAssistantEnglish =
        typeof parsed?.assistantEnglishText === 'string' ? parsed.assistantEnglishText.trim() : '';
      userEnglishText = parsedUserEnglish || userEnglishText;
      userOriginalLanguage = parsedUserLanguage || userOriginalLanguage;
      assistantDisplayMessage = parsedReply || parsedAssistantEnglish || fallbackMessage;
      assistantReplyLanguage = parsedReplyLang || assistantReplyLanguage;
      assistantMessage = parsedAssistantEnglish || assistantDisplayMessage || fallbackMessage;
    } catch (chatError) {
      const errMsg = chatError instanceof Error ? chatError.message : String(chatError);
      completionErrorBrief = errMsg.slice(0, 240);
      chatLog({
        event: 'chat.request_failed',
        level: 'error',
        botId: bot._id.toString(),
        conversationId: conversation._id.toString(),
        chatVisitorId,
        requestId,
        endpoint,
        reason: errMsg.slice(0, 80),
      });
    }
    const completionDurationMs = Date.now() - completionStart;
    if (!assistantMessage?.trim()) {
      assistantMessage = fallbackMessage;
      assistantDisplayMessage = fallbackMessage;
      chatLog({
        event: 'chat.empty_completion_fallback',
        level: 'warn',
        botId: bot._id.toString(),
        conversationId: conversation._id.toString(),
        requestId,
      });
    }

    await this.messageModel.updateOne(
      { _id: (userMessageDoc as { _id: Types.ObjectId })._id },
      {
        $set: {
          content: userEnglishText || message,
          originalText: message,
          originalLanguage: userOriginalLanguage || 'en',
          englishText: userEnglishText || message,
          englishTranscriptText: userEnglishText || message,
        },
      },
    );

    const userMessageOid = (userMessageDoc as { _id: Types.ObjectId })._id;
    void this.topicSentimentClassificationService.safeClassifyUserMessageById(userMessageOid.toString());

    const sources = buildDedupedSources(trimmedChunks);
    const displaySources = buildDisplaySources(trimmedChunks);
    const assistantCreatedAt = new Date();
    const messageSources = normalizeAssistantMessageSourcesForPersistence({
      sources: trimmedChunks,
      assistantMessageCreatedAt: assistantCreatedAt,
    });
    const sourcesCount = messageSources.length;
    const ragUsed = trimmedChunks.length > 0;
    const fallbackUsed =
      Boolean(completionErrorBrief) ||
      normalizeMessageForDedupe(assistantMessage) === normalizeMessageForDedupe(fallbackMessage);
    const assistantTurnElapsedMs = Date.now() - startTime;

    const assistantDoc = await this.messageModel.create({
      conversationId: conversation._id,
      botId: bot._id,
      chatVisitorId,
      role: 'assistant',
      content: assistantMessage,
      originalText: assistantDisplayMessage,
      englishText: assistantMessage,
      replyText: assistantDisplayMessage,
      replyLanguage: assistantReplyLanguage,
      englishTranscriptText: assistantMessage,
      ...(messageSources.length > 0 ? { sources: messageSources } : {}),
      aiMeta: {
        modelUsed: completionModel ?? CHAT_COMPLETION_MODEL,
        responseTimeMs: assistantTurnElapsedMs,
        ...(completionUsage?.prompt_tokens != null ? { promptTokens: completionUsage.prompt_tokens } : {}),
        ...(completionUsage?.completion_tokens != null ? { completionTokens: completionUsage.completion_tokens } : {}),
        ...(completionUsage?.total_tokens != null ? { totalTokens: completionUsage.total_tokens } : {}),
        ragUsed,
        sourcesCount,
        fallbackUsed,
        ...(completionErrorBrief
          ? { errorCode: 'completion_failed', errorMessage: completionErrorBrief }
          : {}),
      },
      createdAt: assistantCreatedAt,
      ...previewMsgPersist,
    });
    const assistantMessageId = (assistantDoc as { _id: Types.ObjectId })._id.toString();

    await this.safeApplyConversationTurnRollup({
      conversationId: conversation._id,
      botId: bot._id.toString(),
      chatVisitorId,
      userMessage: {
        createdAt: now,
        inputType: messageInputResolved.inputType,
        inputMethod: messageInputResolved.inputMethod,
        voiceMeta: messageInputResolved.voiceMeta,
        attachmentCount: inputAttachments?.length ?? 0,
        hasTextContent: Boolean(String(message ?? '').trim().length > 0),
        creditCost: creditCalc.creditsUsed,
      },
      assistantMessage: {
        createdAt: assistantCreatedAt,
        sources: messageSources,
      },
      conversationBefore: { firstUserMessageAt: firstUserMessageAtBeforeTurn },
    });

    const totalMessagesNow = messageCount + 2;
    const summaryEligible =
      totalMessagesNow >= SUMMARY_MIN_MESSAGES && totalMessagesNow % SUMMARY_UPDATE_INTERVAL === 0;
    let summaryEnqueued = false;
    const enqueueStart = Date.now();
    if (summaryEligible && sessionSource !== 'widget_preview' && sessionSource !== 'shared_preview') {
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
      chatVisitorId,
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
      assistantMessage: assistantDisplayMessage,
      assistantMessageId,
      sources: sources.length ? sources : undefined,
      displaySources: displaySources.length ? displaySources : undefined,
      isNewConversation,
      ...(inputAttachments?.length ? { userAttachments: inputAttachments } : {}),
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
        userQuery: messageForLlm,
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

  /**
   * Recent conversations for an embed visitor (runtime widget “recent chats”).
   */
  async listVisitorConversations(params: {
    botOid: Types.ObjectId;
    chatVisitorId: string;
    limit?: number;
  }): Promise<Array<{ id: string; lastActivityAt: string; preview: string }>> {
    const limit = Math.min(50, Math.max(1, params.limit ?? 20));
    const convs = await this.conversationModel
      .find({ botId: params.botOid, chatVisitorId: params.chatVisitorId })
      .sort({ lastActivityAt: -1, createdAt: -1 })
      .limit(limit)
      .lean();
    const out: Array<{ id: string; lastActivityAt: string; preview: string }> = [];
    for (const c of convs) {
      const cid = (c as { _id: Types.ObjectId })._id;
      const lastUser = await this.messageModel
        .findOne({ conversationId: cid, role: 'user' })
        .sort({ createdAt: -1 })
        .select({ content: 1 })
        .lean();
      const preview = String((lastUser as { content?: string })?.content ?? '').trim().slice(0, 80);
      const lastAt =
        (c as { lastActivityAt?: Date; createdAt?: Date }).lastActivityAt ??
        (c as { createdAt?: Date }).createdAt;
      out.push({
        id: cid.toString(),
        lastActivityAt: lastAt ? new Date(lastAt).toISOString() : new Date().toISOString(),
        preview: preview || 'Chat',
      });
    }
    return out;
  }

  /**
   * Load persisted messages for a conversation (embed “open recent chat”).
   */
  async getConversationMessagesForEmbed(params: {
    botOid: Types.ObjectId;
    chatVisitorId: string;
    conversationId: string;
    /** When set, only return if the conversation is a widget preview session. */
    requireSessionSource?: 'widget_preview';
  }): Promise<
    | Array<{
        /** Persisted Mongo Message `_id` — required for thumbs feedback + reload parity. */
        id: string;
        role: 'user' | 'assistant' | 'system';
        content: string;
        createdAt: string;
        speechInput?: {
          mode: 'dictate' | 'voice';
          transcript?: string;
          audioUrl?: string;
          mimeType?: string;
          durationMs?: number;
        };
        attachments?: Array<Record<string, unknown>>;
        feedback?: { rating: 'up' | 'down'; createdAt?: string; updatedAt?: string };
      }>
    | null
  > {
    let cid: Types.ObjectId;
    try {
      cid = new Types.ObjectId(String(params.conversationId).trim());
    } catch {
      return null;
    }
    const convFilter: Record<string, unknown> = {
      _id: cid,
      botId: params.botOid,
      chatVisitorId: params.chatVisitorId,
    };
    if (params.requireSessionSource) {
      convFilter.sessionSource = params.requireSessionSource;
    }
    const conv = await this.conversationModel.findOne(convFilter);
    if (!conv) {
      return null;
    }
    const msgs = await this.messageModel
      .find({ conversationId: cid })
      .sort({ createdAt: 1 })
      .select(EMBED_CONVERSATION_MESSAGE_PROJECT)
      .lean();
    return msgs.map((m) => {
      const raw = m as {
        _id: Types.ObjectId;
        role?: string;
        content?: string;
        createdAt?: Date;
        speechInput?: {
          mode?: string;
          transcript?: string;
          audioUrl?: string;
          mimeType?: string;
          durationMs?: number;
        };
        attachments?: Array<{ name?: string; mimeType?: string; url?: string; size?: number }>;
        feedback?: unknown;
      };
      const si = raw.speechInput;
      const speechOut =
        si && (si.mode === 'voice' || si.mode === 'dictate')
          ? {
              mode: si.mode as 'dictate' | 'voice',
              ...(typeof si.transcript === 'string' && si.transcript.trim() ? { transcript: si.transcript.trim() } : {}),
              ...(typeof si.audioUrl === 'string' && si.audioUrl.trim() ? { audioUrl: si.audioUrl.trim() } : {}),
              ...(typeof si.mimeType === 'string' && si.mimeType.trim() ? { mimeType: si.mimeType.trim() } : {}),
              ...(typeof si.durationMs === 'number' && Number.isFinite(si.durationMs) && si.durationMs >= 0
                ? { durationMs: Math.round(si.durationMs) }
                : {}),
            }
          : undefined;
      const attRaw = Array.isArray(raw.attachments) ? raw.attachments : [];
      const attachmentsOut =
        attRaw.length > 0
          ? attRaw
              .map((a) => serializeWorkspaceMessageAttachment(a as Record<string, unknown>))
              .filter((row): row is Record<string, unknown> => row != null && Object.keys(row).length > 0)
          : undefined;
      const fbRow = serializeMessageFeedbackForWorkspace(raw.feedback as Parameters<typeof serializeMessageFeedbackForWorkspace>[0]);
      const row: {
        id: string;
        role: 'user' | 'assistant' | 'system';
        content: string;
        createdAt: string;
        speechInput?: typeof speechOut;
        attachments?: Array<Record<string, unknown>>;
        feedback?: { rating: 'up' | 'down'; createdAt?: string; updatedAt?: string };
      } = {
        id: raw._id.toString(),
        role: raw.role as 'user' | 'assistant' | 'system',
        content: String(raw.content || ''),
        createdAt: new Date(raw.createdAt ?? Date.now()).toISOString(),
        ...(speechOut ? { speechInput: speechOut } : {}),
        ...(attachmentsOut?.length ? { attachments: attachmentsOut } : {}),
      };
      if (
        fbRow &&
        typeof fbRow === 'object' &&
        (fbRow.rating === 'up' || fbRow.rating === 'down')
      ) {
        row.feedback = {
          rating: fbRow.rating,
          ...(typeof fbRow.createdAt === 'string' ? { createdAt: fbRow.createdAt } : {}),
          ...(typeof fbRow.updatedAt === 'string' ? { updatedAt: fbRow.updatedAt } : {}),
        };
      }
      return row;
    });
  }

  /**
   * All conversations for a bot (operator workspace — admin or tenant customer).
   * Newest first; optional cursor on `lastActivityAt` (strictly older than `beforeIso`).
   */
  async listBotConversationsForWorkspace(params: {
    botOid: Types.ObjectId;
    limit: number;
    beforeIso?: string | null;
    filters?: WorkspaceConversationListFilters;
  }): Promise<{
    conversations: Array<Record<string, unknown>>;
    nextCursor: string | null;
  }> {
    const limit = Math.min(50, Math.max(1, params.limit));
    const match = buildWorkspaceConversationListMatch(params.botOid, params.filters, params.beforeIso ?? null);
    const take = limit + 1;
    const convs = await this.conversationModel
      .find(match)
      .sort({ lastActivityAt: -1, createdAt: -1 })
      .limit(take)
      .lean();
    const slice = convs.slice(0, limit);
    const hasMore = convs.length > limit;
    const ids = slice.map((c) => (c as { _id: Types.ObjectId })._id);

    const userByC = new Map<string, string>();
    const asstByC = new Map<string, string>();
    if (ids.length) {
      const [userRows, asstRows] = await Promise.all([
        this.messageModel.aggregate<{ _id: Types.ObjectId; c: string }>([
          { $match: { conversationId: { $in: ids }, role: 'user' } },
          { $sort: { createdAt: -1 } },
          { $group: { _id: '$conversationId', c: { $first: '$content' } } },
        ]),
        this.messageModel.aggregate<{ _id: Types.ObjectId; c: string }>([
          { $match: { conversationId: { $in: ids }, role: 'assistant' } },
          { $sort: { createdAt: -1 } },
          { $group: { _id: '$conversationId', c: { $first: '$content' } } },
        ]),
      ]);
      for (const r of userRows) {
        userByC.set(String(r._id), String(r.c ?? '').trim().slice(0, 200));
      }
      for (const r of asstRows) {
        asstByC.set(String(r._id), String(r.c ?? '').trim().slice(0, 200));
      }
    }

    const conversations = slice.map((c) => {
      const _id = (c as { _id: Types.ObjectId })._id;
      const id = _id.toString();
      return serializeWorkspaceConversationListRow(c as Record<string, unknown>, {
        userPreview: userByC.get(id) ?? '',
        assistantPreview: asstByC.get(id) ?? '',
      });
    });

    const last = slice[slice.length - 1];
    let nextCursor: string | null = null;
    if (hasMore && last) {
      const la =
        (last as { lastActivityAt?: Date; createdAt?: Date }).lastActivityAt ??
        (last as { createdAt?: Date }).createdAt;
      nextCursor = la ? new Date(la).toISOString() : null;
    }
    return { conversations, nextCursor };
  }

  /**
   * Conversation metadata for workspace dashboards (customer/admin). No message bodies beyond previews on list.
   */
  async getBotConversationDetailForWorkspace(params: {
    botOid: Types.ObjectId;
    conversationId: string;
  }): Promise<Record<string, unknown> | null> {
    let cid: Types.ObjectId;
    try {
      cid = new Types.ObjectId(String(params.conversationId).trim());
    } catch {
      return null;
    }
    const conv = await this.conversationModel.findOne({ _id: cid, botId: params.botOid }).lean();
    if (!conv) {
      return null;
    }
    const base = serializeWorkspaceConversationDetail(conv as Record<string, unknown>, params.botOid.toString());
    const leadSourceMessagePreview = await this.resolveLeadSourceMessagePreview(
      cid,
      (conv as { leadSourceMessageId?: unknown }).leadSourceMessageId,
    );
    return {
      ...base,
      ...(leadSourceMessagePreview ? { leadSourceMessagePreview } : {}),
    };
  }

  /**
   * Load messages for a conversation when the caller has already proven access to the bot.
   * Rich workspace shape (credits, sources, aiMeta); embed/public APIs use {@link getConversationMessagesForEmbed} only.
   */
  async getBotConversationMessagesForWorkspace(params: {
    botOid: Types.ObjectId;
    conversationId: string;
  }): Promise<Array<Record<string, unknown>> | null> {
    let cid: Types.ObjectId;
    try {
      cid = new Types.ObjectId(String(params.conversationId).trim());
    } catch {
      return null;
    }
    const conv = await this.conversationModel.findOne({ _id: cid, botId: params.botOid });
    if (!conv) {
      return null;
    }
    const msgs = await this.messageModel
      .find({ conversationId: cid })
      .sort({ createdAt: 1 })
      // Include `feedback` so workspace Insights can show visitor thumbs on assistant rows.
      .select({
        role: 1,
        content: 1,
        createdAt: 1,
        speechInput: 1,
        attachments: 1,
        inputType: 1,
        inputMethod: 1,
        voiceMeta: 1,
        creditCost: 1,
        creditReason: 1,
        billingType: 1,
        quotaPeriod: 1,
        chargedAt: 1,
        creditBreakdown: 1,
        sources: 1,
        aiMeta: 1,
        feedback: 1,
        topics: 1,
        sentiment: 1,
      })
      .lean();
    return msgs.map((m) => serializeWorkspaceMessageRow(m as Record<string, unknown>));
  }

  /**
   * Customer/workspace leads inbox: conversations with `hasLead`, sorted by first capture time (fallback activity).
   */
  async listBotLeadsForWorkspace(params: {
    botOid: Types.ObjectId;
    limit: number;
    skip: number;
    page: number;
    beforeSortAtIso?: string | null;
    filters?: WorkspaceLeadsListFilters | null;
    leadCapture: unknown;
  }): Promise<{
    leadFieldDefinitions: Array<Record<string, unknown>>;
    leads: Array<Record<string, unknown>>;
    nextCursor: string | null;
    totalMatching: number;
    page: number;
    hasNextPage: boolean;
    matchingWithNameCount: number;
    matchingWithEmailCount: number;
    latestMatchingCapturedAt: string | null;
  }> {
    const limit = Math.min(50, Math.max(1, params.limit));
    const skip = Math.max(0, params.skip);
    const pipeline = buildWorkspaceLeadsListFacetPipeline({
      botOid: params.botOid,
      filters: params.filters ?? null,
      beforeSortAtIso: params.beforeSortAtIso ?? null,
      limit,
      skip,
    });
    const rows = await this.conversationModel
      .aggregate<Record<string, unknown>>(pipeline as unknown as PipelineStage[])
      .exec();
    const bucket = rows[0] as
      | {
          pageRows?: Record<string, unknown>[];
          total?: { n?: number }[];
          withName?: { n?: number }[];
          withEmail?: { n?: number }[];
          latest?: { d?: Date }[];
        }
      | undefined;
    const pageRows = bucket?.pageRows ?? [];
    const totalMatching = bucket?.total?.[0]?.n ?? 0;
    const matchingWithNameCount = bucket?.withName?.[0]?.n ?? 0;
    const matchingWithEmailCount = bucket?.withEmail?.[0]?.n ?? 0;
    const latestD = bucket?.latest?.[0]?.d;
    const latestMatchingCapturedAt =
      latestD instanceof Date && Number.isFinite(latestD.getTime()) ? latestD.toISOString() : null;

    const hasMore = pageRows.length > limit;
    const slice = pageRows.slice(0, limit);
    const botId = params.botOid.toString();
    const leads = slice.map((raw) => {
      const { _leadSortAt: _, ...rest } = raw;
      void _;
      return serializeCustomerWorkspaceLeadListRow(rest as Record<string, unknown>, botId);
    });
    const capturedUnion = collectCapturedLeadDataKeysUnionFromLeadRows(
      leads as Array<{ capturedLeadData?: Record<string, unknown> }>,
    );
    const leadFieldDefinitions = mergeCustomerLeadFieldDefinitions(params.leadCapture, capturedUnion);
    let nextCursor: string | null = null;
    if (hasMore && slice.length > 0) {
      const last = slice[slice.length - 1] as { _leadSortAt?: Date };
      const t = last._leadSortAt;
      nextCursor = t instanceof Date && Number.isFinite(t.getTime()) ? t.toISOString() : null;
    }

    return {
      leadFieldDefinitions,
      leads,
      nextCursor,
      totalMatching,
      page: params.page,
      hasNextPage: hasMore,
      matchingWithNameCount,
      matchingWithEmailCount,
      latestMatchingCapturedAt,
    };
  }

  /** Lead detail for customer workspace; conversation must exist and `hasLead` must be true. */
  async getBotLeadDetailForWorkspace(params: {
    botOid: Types.ObjectId;
    conversationId: string;
    leadCapture: unknown;
  }): Promise<Record<string, unknown> | null> {
    let cid: Types.ObjectId;
    try {
      cid = new Types.ObjectId(String(params.conversationId).trim());
    } catch {
      return null;
    }
    const conv = await this.conversationModel.findOne({ _id: cid, botId: params.botOid, hasLead: true }).lean();
    if (!conv) {
      return null;
    }
    const base = serializeCustomerWorkspaceLeadDetail(conv as Record<string, unknown>, params.botOid.toString());
    const capturedKeys = collectCapturedLeadDataKeysWithValues(
      base.capturedLeadData as Record<string, unknown> | undefined,
    );
    const metaRaw = base.capturedLeadFieldMeta as Record<string, { label?: string; type?: string }> | undefined;
    const leadFieldDefinitions = mergeCustomerLeadFieldDefinitions(params.leadCapture, capturedKeys, metaRaw);
    const leadSourceMessagePreview = await this.resolveLeadSourceMessagePreview(
      cid,
      (conv as { leadSourceMessageId?: unknown }).leadSourceMessageId,
    );
    return {
      ...base,
      leadFieldDefinitions,
      ...(leadSourceMessagePreview ? { leadSourceMessagePreview } : {}),
    };
  }
}
