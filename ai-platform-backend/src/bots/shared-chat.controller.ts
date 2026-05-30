import { Controller, Get, HttpException, HttpStatus, Param, Post, Query, Req } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { FastifyRequest } from 'fastify';
import { Types } from 'mongoose';
import { VisitorsService } from '../visitors/visitors.service';
import { isWelcomeMessageActive } from './welcome-message-display.util';
import { BotsService } from './bots.service';
import { normalizeVisitorMultiChatMax } from './visitor-multi-chat.util';
import {
  consumeEmbedRuntimeRateLimitToken,
  EMBED_RUNTIME_RATE_LIMIT_KEY_PREFIX,
  EMBED_RUNTIME_RATE_LIMIT_WINDOW_MS,
  getClientIpForRateLimit,
} from './embed-runtime-rate-limit.util';
import { throwEmbedRuntimeIpRateLimited } from '../rate-limit/rate-limit-http-exception.util';
import { resolveWidgetEmbedRateLimitPerMinute } from '../models/bot.schema';
import { exampleQuestionsToPublicLabels } from '../workspace/shared/example-questions.util';
import { KnowledgeBaseItemService } from '../knowledge/knowledge-base-item.service';
import { WorkspaceBotLimitService } from '../entitlements/workspace-bot-limit.service';
import { ChatEngineService } from '../chat/chat-engine.service';
import { WidgetSpeechService } from '../chat/widget-speech.service';
import {
  buildAnalyticsRequestMetaForChat,
  parseAnalyticsContextFromUnknown,
} from '../chat/conversation-analytics-location-device.util';
import { parseMessageAnalyticsFromUnknown } from '../chat/message-input-analytics.util';
import { getRequestId } from '../lib/request-id.helper';
import { resolveEmbedChatVisitorIdFromBody } from './widget-embed-identity.util';
import { buildBotLikeFromRuntimeDoc } from '../chat/runtime-bot-like.util';
import type { MessageAttachment, MessageSpeechInput } from '../models/message.schema';
import type { AnalyticsContextPayload } from '../chat/chat-engine.types';
import { normalizeSpeechInputFromBody } from '../chat/speech-input.normalize';
import { assertSharePreviewPolicy } from './share-preview-policy.util';
import {
  assertEmbedChatHasUserTurn,
  parseEmbedChatMultipartRequest,
  uploadWidgetChatAttachments,
} from '../chat/widget-embed-chat-multipart.util';

function mergeSharePageMetadata(
  req: FastifyRequest,
  body: { pageUrl?: string; referrer?: string; origin?: string },
): { pageUrl?: string; referrer?: string; origin?: string } {
  const hOrigin = typeof req.headers.origin === 'string' ? req.headers.origin.slice(0, 256) : undefined;
  const hRef =
    typeof req.headers.referer === 'string'
      ? req.headers.referer.slice(0, 1024)
      : typeof req.headers.referrer === 'string'
        ? req.headers.referrer.slice(0, 1024)
        : undefined;
  const pageUrl = body.pageUrl?.trim() ? body.pageUrl.trim().slice(0, 2048) : undefined;
  const referrer = body.referrer?.trim() ? body.referrer.trim().slice(0, 2048) : hRef;
  const origin = body.origin?.trim() ? body.origin.trim().slice(0, 256) : hOrigin;
  return {
    ...(pageUrl ? { pageUrl } : {}),
    ...(referrer ? { referrer } : {}),
    ...(origin ? { origin } : {}),
  };
}

function parseSharedChatBody(body: unknown): {
  message: string;
  chatVisitorId?: string;
  visitorId?: string;
  conversationId?: string;
  startNewConversation?: boolean;
  speechInput?: MessageSpeechInput;
  suggestionId?: string;
  shareToken?: string;
  pageUrl?: string;
  referrer?: string;
  origin?: string;
  analyticsContext?: AnalyticsContextPayload;
  messageAnalytics?: ReturnType<typeof parseMessageAnalyticsFromUnknown>;
} | null {
  if (body == null || typeof body !== 'object') return null;
  const o = body as Record<string, unknown>;
  const message = typeof o.message === 'string' ? o.message.trim() : '';
  if (!message) return null;
  const chatVisitorId = typeof o.chatVisitorId === 'string' ? o.chatVisitorId.trim() : '';
  const visitorId = typeof o.visitorId === 'string' ? o.visitorId.trim() : '';
  const conversationId = typeof o.conversationId === 'string' ? o.conversationId.trim() : '';
  const startNewConversation = o.startNewConversation === true;
  const speechInput = normalizeSpeechInputFromBody(o.speechInput);
  const suggestionId = typeof o.suggestionId === 'string' ? o.suggestionId.trim() : '';
  const shareToken = typeof o.shareToken === 'string' ? o.shareToken.trim() : '';
  const pageUrl = typeof o.pageUrl === 'string' ? o.pageUrl.trim() : '';
  const referrer = typeof o.referrer === 'string' ? o.referrer.trim() : '';
  const origin = typeof o.origin === 'string' ? o.origin.trim() : '';
  const analyticsContext = parseAnalyticsContextFromUnknown(o.analyticsContext);
  const messageAnalytics = parseMessageAnalyticsFromUnknown(o.messageAnalytics);
  return {
    message,
    ...(chatVisitorId ? { chatVisitorId } : {}),
    ...(visitorId ? { visitorId } : {}),
    ...(conversationId ? { conversationId } : {}),
    ...(startNewConversation ? { startNewConversation: true } : {}),
    ...(speechInput ? { speechInput } : {}),
    ...(suggestionId ? { suggestionId } : {}),
    ...(shareToken ? { shareToken } : {}),
    ...(pageUrl ? { pageUrl } : {}),
    ...(referrer ? { referrer } : {}),
    ...(origin ? { origin } : {}),
    ...(analyticsContext ? { analyticsContext } : {}),
    ...(messageAnalytics ? { messageAnalytics } : {}),
  };
}

/** Multipart shared chat: `message` may be empty until combined with uploaded files. */
function parseSharedChatPayloadRecord(o: Record<string, unknown>): {
  message: string;
  chatVisitorId?: string;
  visitorId?: string;
  conversationId?: string;
  startNewConversation?: boolean;
  speechInput?: MessageSpeechInput;
  suggestionId?: string;
  shareToken?: string;
  pageUrl?: string;
  referrer?: string;
  origin?: string;
  analyticsContext?: AnalyticsContextPayload;
  messageAnalytics?: ReturnType<typeof parseMessageAnalyticsFromUnknown>;
} | null {
  if (o == null || typeof o !== 'object') return null;
  const message = typeof o.message === 'string' ? o.message.trim() : '';
  const chatVisitorId = typeof o.chatVisitorId === 'string' ? o.chatVisitorId.trim() : '';
  const visitorId = typeof o.visitorId === 'string' ? o.visitorId.trim() : '';
  const conversationId = typeof o.conversationId === 'string' ? o.conversationId.trim() : '';
  const startNewConversation = o.startNewConversation === true;
  const speechInput = normalizeSpeechInputFromBody(o.speechInput);
  const suggestionId = typeof o.suggestionId === 'string' ? o.suggestionId.trim() : '';
  const shareToken = typeof o.shareToken === 'string' ? o.shareToken.trim() : '';
  const pageUrl = typeof o.pageUrl === 'string' ? o.pageUrl.trim() : '';
  const referrer = typeof o.referrer === 'string' ? o.referrer.trim() : '';
  const origin = typeof o.origin === 'string' ? o.origin.trim() : '';
  const analyticsContext = parseAnalyticsContextFromUnknown(o.analyticsContext);
  const messageAnalytics = parseMessageAnalyticsFromUnknown(o.messageAnalytics);
  return {
    message,
    ...(chatVisitorId ? { chatVisitorId } : {}),
    ...(visitorId ? { visitorId } : {}),
    ...(conversationId ? { conversationId } : {}),
    ...(startNewConversation ? { startNewConversation: true } : {}),
    ...(speechInput ? { speechInput } : {}),
    ...(suggestionId ? { suggestionId } : {}),
    ...(shareToken ? { shareToken } : {}),
    ...(pageUrl ? { pageUrl } : {}),
    ...(referrer ? { referrer } : {}),
    ...(origin ? { origin } : {}),
    ...(analyticsContext ? { analyticsContext } : {}),
    ...(messageAnalytics ? { messageAnalytics } : {}),
  };
}

function parseSharedListBody(body: unknown): {
  chatVisitorId?: string;
  visitorId?: string;
  shareToken?: string;
} | null {
  if (body == null || typeof body !== 'object') return null;
  const o = body as Record<string, unknown>;
  const chatVisitorId = typeof o.chatVisitorId === 'string' ? o.chatVisitorId.trim() : '';
  const visitorId = typeof o.visitorId === 'string' ? o.visitorId.trim() : '';
  const shareToken = typeof o.shareToken === 'string' ? o.shareToken.trim() : '';
  if (!chatVisitorId && !visitorId) return null;
  return {
    ...(chatVisitorId ? { chatVisitorId } : {}),
    ...(visitorId ? { visitorId } : {}),
    ...(shareToken ? { shareToken } : {}),
  };
}

function parseSharedMessagesBody(body: unknown): {
  conversationId: string;
  chatVisitorId?: string;
  visitorId?: string;
  shareToken?: string;
} | null {
  if (body == null || typeof body !== 'object') return null;
  const o = body as Record<string, unknown>;
  const conversationId = typeof o.conversationId === 'string' ? o.conversationId.trim() : '';
  const chatVisitorId = typeof o.chatVisitorId === 'string' ? o.chatVisitorId.trim() : '';
  const visitorId = typeof o.visitorId === 'string' ? o.visitorId.trim() : '';
  const shareToken = typeof o.shareToken === 'string' ? o.shareToken.trim() : '';
  if (!conversationId || (!chatVisitorId && !visitorId)) return null;
  return {
    conversationId,
    ...(chatVisitorId ? { chatVisitorId } : {}),
    ...(visitorId ? { visitorId } : {}),
    ...(shareToken ? { shareToken } : {}),
  };
}

/**
 * Assistrio-hosted share preview (`/share/:slug`) — preview policy, no runtime keys / no `allowedOrigins`.
 */
@Controller('api/shared/bots')
export class SharedChatController {
  constructor(
    private readonly botsService: BotsService,
    private readonly visitorsService: VisitorsService,
    private readonly knowledgeBaseItemService: KnowledgeBaseItemService,
    private readonly chatEngineService: ChatEngineService,
    private readonly widgetSpeechService: WidgetSpeechService,
    private readonly workspaceBotLimitService: WorkspaceBotLimitService,
  ) {}

  @Get(':slug/init')
  async init(
    @Param('slug') slug: string,
    @Query('chatVisitorId') chatVisitorIdQuery: string | undefined,
    @Query('shareToken') shareTokenQuery: string | undefined,
    @Req() req: FastifyRequest,
  ) {
    const slugNorm = String(slug ?? '').trim().toLowerCase();
    const row = await this.botsService.findShareBotByShareSlug(slugNorm);
    const token = typeof shareTokenQuery === 'string' ? shareTokenQuery.trim() : '';
    assertSharePreviewPolicy(row, slugNorm, token || undefined);

    await this.workspaceBotLimitService.assertBotDocWithinEffectiveLimitIfWorkspaceScoped(
      row as Record<string, unknown>,
    );

    const limit = resolveWidgetEmbedRateLimitPerMinute(row);
    const ip = getClientIpForRateLimit(req);
    if (!consumeEmbedRuntimeRateLimitToken(`${EMBED_RUNTIME_RATE_LIMIT_KEY_PREFIX}:${ip}`, limit)) {
      throwEmbedRuntimeIpRateLimited(EMBED_RUNTIME_RATE_LIMIT_WINDOW_MS);
    }

    const chatUI = await this.botsService.sanitizeRuntimeChatUiForBot(row as { workspaceId?: unknown; chatUI?: unknown });
    const brandingMessage =
      typeof chatUI.brandingMessage === 'string' ? chatUI.brandingMessage.trim() : undefined;
    const privacyText =
      typeof chatUI.privacyText === 'string' ? chatUI.privacyText.trim() : undefined;
    const visitorMultiChatEnabled = (row as { visitorMultiChatEnabled?: unknown }).visitorMultiChatEnabled === true;
    const visitorMultiChatMax = normalizeVisitorMultiChatMax(
      (row as { visitorMultiChatMax?: unknown }).visitorMultiChatMax,
    );

    const q = typeof chatVisitorIdQuery === 'string' ? chatVisitorIdQuery.trim() : '';
    const chatVisitorId =
      q && q.length > 0 ? q : `c_${randomUUID().replace(/-/g, '')}`;

    try {
      await this.visitorsService.getOrCreateChatVisitor(chatVisitorId);
    } catch (err) {
      console.error('[shared/init] getOrCreateChatVisitor failed', err);
    }

    const botIdStr = String(row._id ?? '');
    const suggestedQuestionChips = await this.knowledgeBaseItemService.getPublicSuggestionChipsForBot(botIdStr);
    const shareSlug = String((row as { shareChat?: { slug?: string } }).shareChat?.slug ?? slug).toLowerCase();

    return {
      status: 'ok' as const,
      shareSlug,
      bot: {
        id: botIdStr,
        name: String(row.name ?? ''),
        imageUrl: typeof row.imageUrl === 'string' ? row.imageUrl : undefined,
        avatarEmoji: typeof row.avatarEmoji === 'string' ? row.avatarEmoji : undefined,
        tagline: typeof row.shortDescription === 'string' ? row.shortDescription : undefined,
        description: typeof row.description === 'string' ? row.description : undefined,
        welcomeMessage: isWelcomeMessageActive(row as { welcomeMessage?: string; welcomeMessageEnabled?: boolean })
          ? typeof row.welcomeMessage === 'string'
            ? row.welcomeMessage
            : undefined
          : undefined,
        welcomeMessageEnabled: (row as { welcomeMessageEnabled?: boolean }).welcomeMessageEnabled !== false,
        suggestedQuestions: exampleQuestionsToPublicLabels(row.exampleQuestions),
        exampleQuestions: exampleQuestionsToPublicLabels(row.exampleQuestions),
        suggestedQuestionChips,
      },
      settings: {
        chatUI,
        ...(brandingMessage ? { brandingMessage } : {}),
        ...(privacyText ? { privacyText } : {}),
        visitorMultiChatEnabled,
        visitorMultiChatMax,
      },
      chatVisitorId,
    };
  }

  @Post(':slug/chat')
  async chat(@Param('slug') slug: string, @Req() req: FastifyRequest) {
    const slugNorm = String(slug ?? '').trim().toLowerCase();
    const shareRow = await this.botsService.findShareBotByShareSlug(slugNorm);

    let uploadedAttachments: MessageAttachment[] = [];
    let parsedBody: NonNullable<ReturnType<typeof parseSharedChatBody>>;

    if (typeof req.isMultipart === 'function' && req.isMultipart()) {
      const { payloadRecord, rawFiles } = await parseEmbedChatMultipartRequest(req);
      const fromPayload = parseSharedChatPayloadRecord(payloadRecord);
      if (!fromPayload) {
        throw new HttpException(
          { error: 'Invalid request body', errorCode: 'BAD_REQUEST' },
          HttpStatus.BAD_REQUEST,
        );
      }
      assertSharePreviewPolicy(shareRow, slugNorm, fromPayload.shareToken);
      const botId = String(shareRow._id ?? '');
      if (rawFiles.length > 0) {
        uploadedAttachments = await uploadWidgetChatAttachments(botId, rawFiles);
      }
      assertEmbedChatHasUserTurn(fromPayload.message, fromPayload.speechInput, uploadedAttachments);
      parsedBody = fromPayload as NonNullable<ReturnType<typeof parseSharedChatBody>>;
    } else {
      const jsonParsed = parseSharedChatBody((req as { body?: unknown }).body);
      if (!jsonParsed) {
        throw new HttpException(
          { error: 'Invalid request body', errorCode: 'BAD_REQUEST' },
          HttpStatus.BAD_REQUEST,
        );
      }
      assertSharePreviewPolicy(shareRow, slugNorm, jsonParsed.shareToken);
      parsedBody = jsonParsed;
    }

    const limit = resolveWidgetEmbedRateLimitPerMinute(shareRow);
    const ip = getClientIpForRateLimit(req);
    if (!consumeEmbedRuntimeRateLimitToken(`${EMBED_RUNTIME_RATE_LIMIT_KEY_PREFIX}:${ip}`, limit)) {
      throwEmbedRuntimeIpRateLimited(EMBED_RUNTIME_RATE_LIMIT_WINDOW_MS);
    }

    const botId = String(shareRow._id ?? '');
    const fullBot = await this.botsService.findOneByIdForExternalRuntime(botId);
    if (!fullBot) {
      throw new HttpException({ error: 'Bot not found', errorCode: 'BOT_NOT_FOUND' }, HttpStatus.NOT_FOUND);
    }

    const resolvedChatVisitorId = resolveEmbedChatVisitorIdFromBody(parsedBody.chatVisitorId, parsedBody.visitorId);
    if (!resolvedChatVisitorId) {
      throw new HttpException(
        { error: 'chatVisitorId is required', errorCode: 'CHAT_VISITOR_ID_REQUIRED' },
        HttpStatus.BAD_REQUEST,
      );
    }

    const ownerId = (fullBot as { ownerId?: unknown }).ownerId;
    if (ownerId == null || String(ownerId).trim() === '') {
      throw new HttpException(
        { error: 'Bot is missing workspace ownership', errorCode: 'BOT_OWNER_REQUIRED' },
        HttpStatus.FORBIDDEN,
      );
    }

    const shareSlug = String((shareRow as { shareChat?: { slug?: string } }).shareChat?.slug ?? slug).toLowerCase();
    const pageMeta = mergeSharePageMetadata(req, {
      pageUrl: parsedBody.pageUrl,
      referrer: parsedBody.referrer,
      origin: parsedBody.origin,
    });

    const b = fullBot as Record<string, unknown>;
    const botLike = buildBotLikeFromRuntimeDoc(b);
    const chatUi = (fullBot as { chatUI?: Record<string, unknown> }).chatUI ?? {};
    if (uploadedAttachments.length > 0 && chatUi.allowFileUpload !== true) {
      throw new HttpException(
        { error: 'File uploads are disabled for this bot.', errorCode: 'FILE_UPLOAD_DISABLED' },
        HttpStatus.FORBIDDEN,
      );
    }

    const chatResult = await this.chatEngineService.runChat({
      bot: botLike,
      chatVisitorId: resolvedChatVisitorId,
      message: parsedBody.message,
      mode: 'user',
      requestId: getRequestId(req),
      debug: false,
      ...(parsedBody.analyticsContext ? { analyticsContext: parsedBody.analyticsContext } : {}),
      analyticsRequestMeta: buildAnalyticsRequestMetaForChat(req),
      sessionSource: 'shared_preview',
      conversationOrigin: {
        source: 'shared_preview',
        mode: 'preview',
        embedType: 'shared_preview',
        surface: 'assistrio_share_page',
        shareSlug,
        ...(pageMeta.pageUrl ? { sharedUrl: pageMeta.pageUrl, pageUrl: pageMeta.pageUrl } : {}),
        ...(pageMeta.referrer ? { referrer: pageMeta.referrer } : {}),
        ...(pageMeta.origin ? { origin: pageMeta.origin, websiteOrigin: pageMeta.origin } : {}),
      },
      ...(parsedBody.conversationId ? { conversationId: parsedBody.conversationId } : {}),
      ...(parsedBody.startNewConversation ? { startNewConversation: true } : {}),
      ...(parsedBody.speechInput ? { speechInput: parsedBody.speechInput } : {}),
      ...(parsedBody.suggestionId ? { suggestionId: parsedBody.suggestionId } : {}),
      ...(parsedBody.messageAnalytics ? { messageAnalytics: parsedBody.messageAnalytics } : {}),
      ...(uploadedAttachments.length > 0 ? { attachments: uploadedAttachments } : {}),
    });

    if (!chatResult.ok) {
      if (chatResult.error === 'conversation_not_found') {
        throw new HttpException(
          { error: 'Conversation not found', errorCode: 'CONVERSATION_NOT_FOUND' },
          HttpStatus.BAD_REQUEST,
        );
      }
      if (chatResult.error === 'visitor_multi_chat_limit_reached') {
        throw new HttpException(
          {
            error: 'Maximum number of chat threads reached for this bot.',
            errorCode: 'VISITOR_MULTI_CHAT_LIMIT_REACHED',
          },
          HttpStatus.BAD_REQUEST,
        );
      }
      throw new HttpException(chatResult, HttpStatus.BAD_REQUEST);
    }

    return {
      ok: true,
      conversationId: chatResult.conversationId,
      assistantMessage: chatResult.assistantMessage,
      assistantMessageId: chatResult.assistantMessageId,
      sources: chatResult.sources,
      ...(chatResult.userAttachments?.length ? { userAttachments: chatResult.userAttachments } : {}),
    };
  }

  @Post(':slug/speech')
  async sharedSpeech(@Param('slug') slug: string, @Req() req: FastifyRequest) {
    const slugNorm = String(slug ?? '').trim().toLowerCase();
    const shareRow = await this.botsService.findShareBotByShareSlug(slugNorm);
    const parsed = await this.widgetSpeechService.parseMultipart(req);
    assertSharePreviewPolicy(shareRow, slugNorm, parsed.shareToken);

    const limit = resolveWidgetEmbedRateLimitPerMinute(shareRow);
    const ip = getClientIpForRateLimit(req);
    if (!consumeEmbedRuntimeRateLimitToken(`${EMBED_RUNTIME_RATE_LIMIT_KEY_PREFIX}:${ip}`, limit)) {
      throwEmbedRuntimeIpRateLimited(EMBED_RUNTIME_RATE_LIMIT_WINDOW_MS);
    }

    const botId = String(shareRow._id ?? '');
    const fullBot = await this.botsService.findOneByIdForExternalRuntime(botId);
    if (!fullBot) {
      throw new HttpException({ error: 'Bot not found', errorCode: 'BOT_NOT_FOUND' }, HttpStatus.NOT_FOUND);
    }

    const ownerId = (fullBot as { ownerId?: unknown }).ownerId;
    if (ownerId == null || String(ownerId).trim() === '') {
      throw new HttpException(
        { error: 'Bot is missing workspace ownership', errorCode: 'BOT_OWNER_REQUIRED' },
        HttpStatus.FORBIDDEN,
      );
    }

    return this.widgetSpeechService.handlePreview(fullBot as Record<string, unknown>, parsed);
  }

  @Post(':slug/conversations/list')
  async listConversations(@Param('slug') slug: string, @Req() req: FastifyRequest) {
    const slugNorm = String(slug ?? '').trim().toLowerCase();
    const shareRow = await this.botsService.findShareBotByShareSlug(slugNorm);
    const parsed = parseSharedListBody((req as { body?: unknown }).body);
    if (!parsed) {
      throw new HttpException(
        { error: 'Invalid request body', errorCode: 'BAD_REQUEST' },
        HttpStatus.BAD_REQUEST,
      );
    }
    assertSharePreviewPolicy(shareRow, slugNorm, parsed.shareToken);

    const limit = resolveWidgetEmbedRateLimitPerMinute(shareRow);
    const ip = getClientIpForRateLimit(req);
    if (!consumeEmbedRuntimeRateLimitToken(`${EMBED_RUNTIME_RATE_LIMIT_KEY_PREFIX}:${ip}`, limit)) {
      throwEmbedRuntimeIpRateLimited(EMBED_RUNTIME_RATE_LIMIT_WINDOW_MS);
    }

    const botId = String(shareRow._id ?? '');
    const fullBot = await this.botsService.findOneByIdForExternalRuntime(botId);
    if (!fullBot) {
      throw new HttpException({ error: 'Bot not found', errorCode: 'BOT_NOT_FOUND' }, HttpStatus.NOT_FOUND);
    }

    const resolvedChatVisitorId = resolveEmbedChatVisitorIdFromBody(parsed.chatVisitorId, parsed.visitorId);
    if (!resolvedChatVisitorId) {
      throw new HttpException(
        { error: 'chatVisitorId is required', errorCode: 'CHAT_VISITOR_ID_REQUIRED' },
        HttpStatus.BAD_REQUEST,
      );
    }

    const ownerId = (fullBot as { ownerId?: unknown }).ownerId;
    if (ownerId == null || String(ownerId).trim() === '') {
      throw new HttpException(
        { error: 'Bot is missing workspace ownership', errorCode: 'BOT_OWNER_REQUIRED' },
        HttpStatus.FORBIDDEN,
      );
    }

    const botOid = new Types.ObjectId(botId);
    const conversations = await this.chatEngineService.listVisitorConversations({
      botOid,
      chatVisitorId: resolvedChatVisitorId,
      limit: 25,
    });

    return { ok: true, conversations };
  }

  @Post(':slug/conversations/messages')
  async conversationMessages(@Param('slug') slug: string, @Req() req: FastifyRequest) {
    const slugNorm = String(slug ?? '').trim().toLowerCase();
    const shareRow = await this.botsService.findShareBotByShareSlug(slugNorm);
    const parsed = parseSharedMessagesBody((req as { body?: unknown }).body);
    if (!parsed) {
      throw new HttpException(
        { error: 'Invalid request body', errorCode: 'BAD_REQUEST' },
        HttpStatus.BAD_REQUEST,
      );
    }
    assertSharePreviewPolicy(shareRow, slugNorm, parsed.shareToken);

    const limit = resolveWidgetEmbedRateLimitPerMinute(shareRow);
    const ip = getClientIpForRateLimit(req);
    if (!consumeEmbedRuntimeRateLimitToken(`${EMBED_RUNTIME_RATE_LIMIT_KEY_PREFIX}:${ip}`, limit)) {
      throwEmbedRuntimeIpRateLimited(EMBED_RUNTIME_RATE_LIMIT_WINDOW_MS);
    }

    const botId = String(shareRow._id ?? '');
    const fullBot = await this.botsService.findOneByIdForExternalRuntime(botId);
    if (!fullBot) {
      throw new HttpException({ error: 'Bot not found', errorCode: 'BOT_NOT_FOUND' }, HttpStatus.NOT_FOUND);
    }

    const resolvedChatVisitorId = resolveEmbedChatVisitorIdFromBody(parsed.chatVisitorId, parsed.visitorId);
    if (!resolvedChatVisitorId) {
      throw new HttpException(
        { error: 'chatVisitorId is required', errorCode: 'CHAT_VISITOR_ID_REQUIRED' },
        HttpStatus.BAD_REQUEST,
      );
    }

    const ownerId = (fullBot as { ownerId?: unknown }).ownerId;
    if (ownerId == null || String(ownerId).trim() === '') {
      throw new HttpException(
        { error: 'Bot is missing workspace ownership', errorCode: 'BOT_OWNER_REQUIRED' },
        HttpStatus.FORBIDDEN,
      );
    }

    const botOid = new Types.ObjectId(botId);
    const messages = await this.chatEngineService.getConversationMessagesForEmbed({
      botOid,
      chatVisitorId: resolvedChatVisitorId,
      conversationId: parsed.conversationId,
    });
    if (!messages) {
      throw new HttpException(
        { error: 'Conversation not found', errorCode: 'CONVERSATION_NOT_FOUND' },
        HttpStatus.NOT_FOUND,
      );
    }

    return { ok: true, messages };
  }
}
