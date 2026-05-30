import { Body, Controller, HttpException, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { Types } from 'mongoose';
import { BotsService } from './bots.service';
import { EmbedSessionService } from './embed-session.service';
import { validateRuntimeBotAccess } from './runtime-bot-access.util';
import { toRuntimeCredentialErrorCode } from './runtime-error-codes.util';
import {
  consumeEmbedRuntimeRateLimitToken,
  EMBED_RUNTIME_RATE_LIMIT_KEY_PREFIX,
  EMBED_RUNTIME_RATE_LIMIT_WINDOW_MS,
  getClientIpForRateLimit,
} from './embed-runtime-rate-limit.util';
import { throwEmbedRuntimeIpRateLimited } from '../rate-limit/rate-limit-http-exception.util';
import { normalizeVisitorMultiChatMax } from './visitor-multi-chat.util';
import { resolveEmbedChatVisitorIdFromBody } from './widget-embed-identity.util';
import {
  coerceAllowedOriginsFromBotDoc,
  isPreviewOriginAllowed,
  isRuntimeOriginAllowed,
} from './origin-validation.util';
import { resolveWidgetEmbedRateLimitPerMinute } from '../models/bot.schema';
import { isWelcomeMessageActive } from './welcome-message-display.util';
import { VisitorsService } from '../visitors/visitors.service';
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
import type { AnalyticsContextPayload } from '../chat/chat-engine.types';
import type { MessageAttachment, MessageSpeechInput } from '../models/message.schema';
import { normalizeSpeechInputFromBody } from '../chat/speech-input.normalize';
import { buildBotLikeFromRuntimeDoc } from '../chat/runtime-bot-like.util';
import { normalizeIframeParentOriginInput } from './iframe-parent-origin.util';
import {
  assertEmbedChatHasUserTurn,
  parseEmbedChatMultipartRequest,
  uploadWidgetChatAttachments,
} from '../chat/widget-embed-chat-multipart.util';

type IframeInitBody = {
  botId?: unknown;
  accessKey?: unknown;
  secretKey?: unknown;
  chatVisitorId?: unknown;
  parentOrigin?: unknown;
  parentPageUrl?: unknown;
  pageUrl?: unknown;
  referrer?: unknown;
};

function parseIframeInitBody(body: unknown): {
  botId: string;
  accessKey?: string;
  secretKey?: string;
  chatVisitorId?: string;
  parentOrigin: string;
  parentPageUrl?: string;
  pageUrl?: string;
  referrer?: string;
} | null {
  if (body == null || typeof body !== 'object') return null;
  const o = body as IframeInitBody;
  const botId = typeof o.botId === 'string' ? o.botId.trim() : '';
  const parentOriginRaw = normalizeIframeParentOriginInput(o.parentOrigin);
  if (!botId || !parentOriginRaw) return null;
  const accessKey = typeof o.accessKey === 'string' ? o.accessKey.trim() : '';
  const secretKey = typeof o.secretKey === 'string' ? o.secretKey.trim() : '';
  const chatVisitorId = typeof o.chatVisitorId === 'string' ? o.chatVisitorId.trim() : '';
  const parentPageUrl =
    typeof o.parentPageUrl === 'string' ? o.parentPageUrl.trim().slice(0, 2048) : undefined;
  const pageUrl = typeof o.pageUrl === 'string' ? o.pageUrl.trim().slice(0, 2048) : undefined;
  const referrer = typeof o.referrer === 'string' ? o.referrer.trim().slice(0, 2048) : undefined;
  return {
    botId,
    parentOrigin: parentOriginRaw,
    ...(accessKey ? { accessKey } : {}),
    ...(secretKey ? { secretKey } : {}),
    ...(chatVisitorId ? { chatVisitorId } : {}),
    ...(parentPageUrl ? { parentPageUrl } : {}),
    ...(pageUrl ? { pageUrl } : {}),
    ...(referrer ? { referrer } : {}),
  };
}

function parseIframeChatBody(body: unknown): {
  botId: string;
  message: string;
  accessKey?: string;
  secretKey?: string;
  chatVisitorId?: string;
  visitorId?: string;
  conversationId?: string;
  startNewConversation?: boolean;
  speechInput?: MessageSpeechInput;
  suggestionId?: string;
  parentOrigin: string;
  parentPageUrl?: string;
  pageUrl?: string;
  referrer?: string;
  analyticsContext?: AnalyticsContextPayload;
  messageAnalytics?: ReturnType<typeof parseMessageAnalyticsFromUnknown>;
} | null {
  if (body == null || typeof body !== 'object') return null;
  const o = body as Record<string, unknown>;
  const botId = typeof o.botId === 'string' ? o.botId.trim() : '';
  const message = typeof o.message === 'string' ? o.message.trim() : '';
  const parentOriginRaw = normalizeIframeParentOriginInput(o.parentOrigin);
  if (!botId || !message || !parentOriginRaw) return null;
  const accessKey = typeof o.accessKey === 'string' ? o.accessKey.trim() : '';
  const secretKey = typeof o.secretKey === 'string' ? o.secretKey.trim() : '';
  const chatVisitorId = typeof o.chatVisitorId === 'string' ? o.chatVisitorId.trim() : '';
  const visitorId = typeof o.visitorId === 'string' ? o.visitorId.trim() : '';
  const conversationId = typeof o.conversationId === 'string' ? o.conversationId.trim() : '';
  const startNewConversation = o.startNewConversation === true;
  const speechInput = normalizeSpeechInputFromBody(o.speechInput);
  const suggestionId = typeof o.suggestionId === 'string' ? o.suggestionId.trim() : '';
  const parentPageUrl =
    typeof o.parentPageUrl === 'string' ? o.parentPageUrl.trim().slice(0, 2048) : undefined;
  const pageUrl = typeof o.pageUrl === 'string' ? o.pageUrl.trim().slice(0, 2048) : undefined;
  const referrer = typeof o.referrer === 'string' ? o.referrer.trim().slice(0, 2048) : undefined;
  const analyticsContext = parseAnalyticsContextFromUnknown(o.analyticsContext);
  const messageAnalytics = parseMessageAnalyticsFromUnknown(o.messageAnalytics);
  return {
    botId,
    message,
    parentOrigin: parentOriginRaw,
    ...(accessKey ? { accessKey } : {}),
    ...(secretKey ? { secretKey } : {}),
    ...(chatVisitorId ? { chatVisitorId } : {}),
    ...(visitorId ? { visitorId } : {}),
    ...(conversationId ? { conversationId } : {}),
    ...(startNewConversation ? { startNewConversation: true } : {}),
    ...(speechInput ? { speechInput } : {}),
    ...(suggestionId ? { suggestionId } : {}),
    ...(parentPageUrl ? { parentPageUrl } : {}),
    ...(pageUrl ? { pageUrl } : {}),
    ...(referrer ? { referrer } : {}),
    ...(analyticsContext ? { analyticsContext } : {}),
    ...(messageAnalytics ? { messageAnalytics } : {}),
  };
}

/** Multipart iframe payload: message may be empty until combined with uploaded files (see assertEmbedChatHasUserTurn). */
function parseIframeChatPayloadRecord(o: Record<string, unknown>): {
  botId: string;
  message: string;
  accessKey?: string;
  secretKey?: string;
  chatVisitorId?: string;
  visitorId?: string;
  conversationId?: string;
  startNewConversation?: boolean;
  speechInput?: MessageSpeechInput;
  suggestionId?: string;
  parentOrigin: string;
  parentPageUrl?: string;
  pageUrl?: string;
  referrer?: string;
  analyticsContext?: AnalyticsContextPayload;
  messageAnalytics?: ReturnType<typeof parseMessageAnalyticsFromUnknown>;
} | null {
  const botId = typeof o.botId === 'string' ? o.botId.trim() : '';
  const message = typeof o.message === 'string' ? o.message.trim() : '';
  const parentOriginRaw = normalizeIframeParentOriginInput(o.parentOrigin);
  if (!botId || !parentOriginRaw) return null;
  const accessKey = typeof o.accessKey === 'string' ? o.accessKey.trim() : '';
  const secretKey = typeof o.secretKey === 'string' ? o.secretKey.trim() : '';
  const chatVisitorId = typeof o.chatVisitorId === 'string' ? o.chatVisitorId.trim() : '';
  const visitorId = typeof o.visitorId === 'string' ? o.visitorId.trim() : '';
  const conversationId = typeof o.conversationId === 'string' ? o.conversationId.trim() : '';
  const startNewConversation = o.startNewConversation === true;
  const speechInput = normalizeSpeechInputFromBody(o.speechInput);
  const suggestionId = typeof o.suggestionId === 'string' ? o.suggestionId.trim() : '';
  const parentPageUrl =
    typeof o.parentPageUrl === 'string' ? o.parentPageUrl.trim().slice(0, 2048) : undefined;
  const pageUrl = typeof o.pageUrl === 'string' ? o.pageUrl.trim().slice(0, 2048) : undefined;
  const referrer = typeof o.referrer === 'string' ? o.referrer.trim().slice(0, 2048) : undefined;
  const analyticsContext = parseAnalyticsContextFromUnknown(o.analyticsContext);
  const messageAnalytics = parseMessageAnalyticsFromUnknown(o.messageAnalytics);
  return {
    botId,
    message,
    parentOrigin: parentOriginRaw,
    ...(accessKey ? { accessKey } : {}),
    ...(secretKey ? { secretKey } : {}),
    ...(chatVisitorId ? { chatVisitorId } : {}),
    ...(visitorId ? { visitorId } : {}),
    ...(conversationId ? { conversationId } : {}),
    ...(startNewConversation ? { startNewConversation: true } : {}),
    ...(speechInput ? { speechInput } : {}),
    ...(suggestionId ? { suggestionId } : {}),
    ...(parentPageUrl ? { parentPageUrl } : {}),
    ...(pageUrl ? { pageUrl } : {}),
    ...(referrer ? { referrer } : {}),
    ...(analyticsContext ? { analyticsContext } : {}),
    ...(messageAnalytics ? { messageAnalytics } : {}),
  };
}

function parseIframeListBody(body: unknown): {
  botId: string;
  accessKey?: string;
  secretKey?: string;
  chatVisitorId?: string;
  visitorId?: string;
  parentOrigin: string;
} | null {
  if (body == null || typeof body !== 'object') return null;
  const o = body as Record<string, unknown>;
  const botId = typeof o.botId === 'string' ? o.botId.trim() : '';
  const parentOriginRaw = normalizeIframeParentOriginInput(o.parentOrigin);
  if (!botId || !parentOriginRaw) return null;
  const accessKey = typeof o.accessKey === 'string' ? o.accessKey.trim() : '';
  const secretKey = typeof o.secretKey === 'string' ? o.secretKey.trim() : '';
  const chatVisitorId = typeof o.chatVisitorId === 'string' ? o.chatVisitorId.trim() : '';
  const visitorId = typeof o.visitorId === 'string' ? o.visitorId.trim() : '';
  return {
    botId,
    parentOrigin: parentOriginRaw,
    ...(accessKey ? { accessKey } : {}),
    ...(secretKey ? { secretKey } : {}),
    ...(chatVisitorId ? { chatVisitorId } : {}),
    ...(visitorId ? { visitorId } : {}),
  };
}

function parseIframeMessagesBody(body: unknown): {
  botId: string;
  conversationId: string;
  accessKey?: string;
  secretKey?: string;
  chatVisitorId?: string;
  visitorId?: string;
  parentOrigin: string;
} | null {
  if (body == null || typeof body !== 'object') return null;
  const o = body as Record<string, unknown>;
  const botId = typeof o.botId === 'string' ? o.botId.trim() : '';
  const conversationId = typeof o.conversationId === 'string' ? o.conversationId.trim() : '';
  const parentOriginRaw = normalizeIframeParentOriginInput(o.parentOrigin);
  if (!botId || !conversationId || !parentOriginRaw) return null;
  const accessKey = typeof o.accessKey === 'string' ? o.accessKey.trim() : '';
  const secretKey = typeof o.secretKey === 'string' ? o.secretKey.trim() : '';
  const chatVisitorId = typeof o.chatVisitorId === 'string' ? o.chatVisitorId.trim() : '';
  const visitorId = typeof o.visitorId === 'string' ? o.visitorId.trim() : '';
  return {
    botId,
    conversationId,
    parentOrigin: parentOriginRaw,
    ...(accessKey ? { accessKey } : {}),
    ...(secretKey ? { secretKey } : {}),
    ...(chatVisitorId ? { chatVisitorId } : {}),
    ...(visitorId ? { visitorId } : {}),
  };
}

/**
 * Live iframe embed: validates **parent** page origin against `allowedOrigins` (not the Assistrio iframe host).
 */
@Controller('api/widget')
export class WidgetIframeController {
  constructor(
    private readonly configService: ConfigService,
    private readonly botsService: BotsService,
    private readonly embedSessionService: EmbedSessionService,
    private readonly visitorsService: VisitorsService,
    private readonly knowledgeBaseItemService: KnowledgeBaseItemService,
    private readonly chatEngineService: ChatEngineService,
    private readonly widgetSpeechService: WidgetSpeechService,
    private readonly workspaceBotLimitService: WorkspaceBotLimitService,
  ) {}

  private assertBotOwnerPresent(bot: Record<string, unknown>): void {
    const ownerId = bot.ownerId;
    if (ownerId == null || String(ownerId).trim() === '') {
      throw new HttpException(
        { error: 'Bot is missing workspace ownership', errorCode: 'BOT_OWNER_REQUIRED' },
        HttpStatus.FORBIDDEN,
      );
    }
  }

  private assertRuntimeEmbedAccessOrThrow(
    req: FastifyRequest,
    bot: Record<string, unknown>,
    creds: { accessKey?: string; secretKey?: string },
    chatVisitorId: string,
  ): void {
    if ((bot.status as string | undefined) !== 'published') {
      throw new HttpException(
        { error: 'Bot not available', errorCode: 'BOT_NOT_PUBLISHED' },
        HttpStatus.NOT_FOUND,
      );
    }
    const botId = String(bot._id ?? '');
    if (this.embedSessionService.verifyRequestForBot(req, botId, chatVisitorId)) {
      return;
    }
    const access = validateRuntimeBotAccess(
      {
        status: (bot.status as string | undefined) ?? undefined,
        visibility: (bot.visibility as 'public' | 'private' | undefined) ?? undefined,
        accessKey: (bot.accessKey as string | undefined) ?? undefined,
        secretKey: (bot.secretKey as string | undefined) ?? undefined,
      },
      creds,
    );
    if (!access.ok) {
      if (access.reason === 'unpublished') {
        throw new HttpException(
          { error: 'Bot not available', errorCode: 'BOT_NOT_PUBLISHED' },
          HttpStatus.NOT_FOUND,
        );
      }
      throw new HttpException(
        {
          error: 'Invalid bot access credentials',
          errorCode: toRuntimeCredentialErrorCode(access),
        },
        HttpStatus.FORBIDDEN,
      );
    }
  }

  private assertIframeRateLimit(bot: Record<string, unknown>, req: FastifyRequest): void {
    const limit = resolveWidgetEmbedRateLimitPerMinute(bot);
    const ip = getClientIpForRateLimit(req);
    if (!consumeEmbedRuntimeRateLimitToken(`${EMBED_RUNTIME_RATE_LIMIT_KEY_PREFIX}:${ip}`, limit)) {
      throwEmbedRuntimeIpRateLimited(EMBED_RUNTIME_RATE_LIMIT_WINDOW_MS);
    }
  }

  private assertIframeParentOriginOrThrow(
    bot: Record<string, unknown>,
    parentOrigin: string,
    req: FastifyRequest,
  ): void {
    const referer =
      typeof req.headers.referer === 'string'
        ? req.headers.referer
        : typeof req.headers.referrer === 'string'
          ? req.headers.referrer
          : undefined;
    const nodeEnv = this.configService.get<string>('nodeEnv') ?? 'development';
    if (referer?.trim()) {
      try {
        const refOrigin = new URL(referer.trim()).origin;
        if (refOrigin !== parentOrigin) {
          const base = this.configService.get<string>('customerAppBaseUrl')?.trim().replace(/\/$/, '') ?? '';
          let baseOrigin: string | null = null;
          if (base) {
            try {
              baseOrigin = new URL(base).origin;
            } catch {
              baseOrigin = null;
            }
          }
          const trustedIframeDoc =
            isPreviewOriginAllowed(refOrigin, nodeEnv) || (baseOrigin != null && refOrigin === baseOrigin);
          if (!trustedIframeDoc) {
            throw new HttpException(
              {
                error: 'This chatbot is not allowed on this site',
                errorCode: 'IFRAME_REFERER_UNTRUSTED',
              },
              HttpStatus.FORBIDDEN,
            );
          }
        }
      } catch (e) {
        if (e instanceof HttpException) throw e;
        throw new HttpException(
          { error: 'Invalid Referer', errorCode: 'IFRAME_REFERER_INVALID' },
          HttpStatus.BAD_REQUEST,
        );
      }
    }
    const allowedOrigins = coerceAllowedOriginsFromBotDoc(bot.allowedOrigins);
    if (!isRuntimeOriginAllowed(parentOrigin, allowedOrigins, nodeEnv)) {
      throw new HttpException(
        {
          error: 'This chatbot is not allowed on this site',
          errorCode: 'EMBED_ORIGIN_NOT_ALLOWED',
        },
        HttpStatus.FORBIDDEN,
      );
    }
  }

  @Post('iframe/init')
  async iframeInit(
    @Body() body: unknown,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const parsed = parseIframeInitBody(body);
    if (!parsed) {
      throw new HttpException(
        { error: 'Invalid request body', status: 'error', errorCode: 'BAD_REQUEST' },
        HttpStatus.BAD_REQUEST,
      );
    }

    const row = await this.botsService.findOneByIdForExternalRuntime(parsed.botId);
    if (!row) {
      throw new HttpException(
        { error: 'Bot not found or not available for embedding', status: 'error', errorCode: 'BOT_NOT_FOUND' },
        HttpStatus.NOT_FOUND,
      );
    }

    const b = row as Record<string, unknown>;
    this.assertBotOwnerPresent(b);

    const access = validateRuntimeBotAccess(
      {
        status: (b.status as string | undefined) ?? undefined,
        visibility: (b.visibility as 'public' | 'private' | undefined) ?? undefined,
        accessKey: (b.accessKey as string | undefined) ?? undefined,
        secretKey: (b.secretKey as string | undefined) ?? undefined,
      },
      { accessKey: parsed.accessKey, secretKey: parsed.secretKey },
    );
    if (!access.ok) {
      if (access.reason === 'unpublished') {
        throw new HttpException(
          { error: 'Bot not found or not available for embedding', status: 'error', errorCode: 'BOT_NOT_PUBLISHED' },
          HttpStatus.NOT_FOUND,
        );
      }
      throw new HttpException(
        {
          error: 'Invalid bot access credentials',
          status: 'error',
          errorCode: toRuntimeCredentialErrorCode(access),
        },
        HttpStatus.FORBIDDEN,
      );
    }

    this.assertIframeRateLimit(b, req);
    this.assertIframeParentOriginOrThrow(b, parsed.parentOrigin, req);

    await this.workspaceBotLimitService.assertBotDocWithinEffectiveLimitIfWorkspaceScoped(b);

    const chatUI = await this.botsService.sanitizeRuntimeChatUiForBot(row as { workspaceId?: unknown; chatUI?: unknown });
    const brandingMessage =
      typeof chatUI.brandingMessage === 'string' ? chatUI.brandingMessage.trim() : undefined;
    const privacyText =
      typeof chatUI.privacyText === 'string' ? chatUI.privacyText.trim() : undefined;
    const visitorMultiChatEnabled = (row as { visitorMultiChatEnabled?: unknown }).visitorMultiChatEnabled === true;
    const visitorMultiChatMax = normalizeVisitorMultiChatMax(
      (row as { visitorMultiChatMax?: unknown }).visitorMultiChatMax,
    );

    const chatVisitorId =
      parsed.chatVisitorId && parsed.chatVisitorId.trim()
        ? parsed.chatVisitorId.trim()
        : `c_${randomUUID().replace(/-/g, '')}`;

    try {
      await this.visitorsService.getOrCreateChatVisitor(chatVisitorId);
    } catch (err) {
      console.error('[widget/iframe/init] getOrCreateChatVisitor failed', err);
    }

    this.embedSessionService.refreshSessionCookie(res, String(row._id ?? ''), chatVisitorId);

    const botIdStr = String(row._id ?? '');
    const suggestedQuestionChips = await this.knowledgeBaseItemService.getPublicSuggestionChipsForBot(botIdStr);

    return {
      status: 'ok' as const,
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

  @Post('iframe/chat')
  async iframeChat(
    @Body() body: unknown,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    let uploadedAttachments: MessageAttachment[] = [];
    let parsed: NonNullable<ReturnType<typeof parseIframeChatBody>>;

    if (typeof req.isMultipart === 'function' && req.isMultipart()) {
      const { payloadRecord, rawFiles } = await parseEmbedChatMultipartRequest(req);
      const fromPayload = parseIframeChatPayloadRecord(payloadRecord);
      if (!fromPayload) {
        throw new HttpException(
          { error: 'Invalid request body', errorCode: 'BAD_REQUEST' },
          HttpStatus.BAD_REQUEST,
        );
      }
      if (rawFiles.length > 0) {
        uploadedAttachments = await uploadWidgetChatAttachments(fromPayload.botId, rawFiles);
      }
      assertEmbedChatHasUserTurn(fromPayload.message, fromPayload.speechInput, uploadedAttachments);
      parsed = fromPayload;
    } else {
      const jsonParsed = parseIframeChatBody(body);
      if (!jsonParsed) {
        throw new HttpException(
          { error: 'Invalid request body', errorCode: 'BAD_REQUEST' },
          HttpStatus.BAD_REQUEST,
        );
      }
      parsed = jsonParsed;
    }

    const bot = await this.botsService.findOneByIdForExternalRuntime(parsed.botId);
    if (!bot) {
      throw new HttpException({ error: 'Bot not found', errorCode: 'BOT_NOT_FOUND' }, HttpStatus.NOT_FOUND);
    }

    const b = bot as Record<string, unknown>;
    this.assertBotOwnerPresent(b);

    const resolvedChatVisitorId = resolveEmbedChatVisitorIdFromBody(parsed.chatVisitorId, parsed.visitorId);
    if (!resolvedChatVisitorId) {
      throw new HttpException(
        { error: 'chatVisitorId is required', errorCode: 'CHAT_VISITOR_ID_REQUIRED' },
        HttpStatus.BAD_REQUEST,
      );
    }

    this.assertRuntimeEmbedAccessOrThrow(req, b, { accessKey: parsed.accessKey, secretKey: parsed.secretKey }, resolvedChatVisitorId);
    this.assertIframeRateLimit(b, req);
    this.assertIframeParentOriginOrThrow(b, parsed.parentOrigin, req);

    const botLike = buildBotLikeFromRuntimeDoc(b);
    const chatUi = (b.chatUI ?? {}) as Record<string, unknown>;
    if (uploadedAttachments.length > 0 && chatUi.allowFileUpload !== true) {
      throw new HttpException(
        { error: 'File uploads are disabled for this bot.', errorCode: 'FILE_UPLOAD_DISABLED' },
        HttpStatus.FORBIDDEN,
      );
    }

    const chatResult = await this.chatEngineService.runChat({
      bot: botLike,
      chatVisitorId: resolvedChatVisitorId,
      message: parsed.message,
      mode: 'user',
      requestId: getRequestId(req),
      debug: false,
      ...(parsed.analyticsContext ? { analyticsContext: parsed.analyticsContext } : {}),
      analyticsRequestMeta: buildAnalyticsRequestMetaForChat(req),
      sessionSource: 'iframe_embed',
      conversationOrigin: {
        source: 'iframe_embed',
        mode: 'runtime',
        embedType: 'iframe',
        surface: 'iframe',
        parentOrigin: parsed.parentOrigin,
        pageUrl: parsed.parentPageUrl ?? parsed.pageUrl,
        iframeUrl: parsed.pageUrl,
        websiteOrigin: parsed.parentOrigin,
        referrer: parsed.referrer,
        origin: typeof req.headers.origin === 'string' ? req.headers.origin.slice(0, 256) : undefined,
      },
      ...(parsed.conversationId ? { conversationId: parsed.conversationId } : {}),
      ...(parsed.startNewConversation ? { startNewConversation: true } : {}),
      ...(parsed.speechInput ? { speechInput: parsed.speechInput } : {}),
      ...(parsed.suggestionId ? { suggestionId: parsed.suggestionId } : {}),
      ...(parsed.messageAnalytics ? { messageAnalytics: parsed.messageAnalytics } : {}),
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

    this.embedSessionService.refreshSessionCookie(res, String(b._id ?? ''), resolvedChatVisitorId);

    return {
      ok: true,
      conversationId: chatResult.conversationId,
      assistantMessage: chatResult.assistantMessage,
      assistantMessageId: chatResult.assistantMessageId,
      sources: chatResult.sources,
      ...(chatResult.userAttachments?.length ? { userAttachments: chatResult.userAttachments } : {}),
    };
  }

  /** Multipart speech transcription (same body as `/api/chat/speech`); iframe parent-origin rules apply. */
  @Post('iframe/speech')
  async iframeSpeech(@Req() req: FastifyRequest, @Res({ passthrough: true }) res: FastifyReply) {
    const parsed = await this.widgetSpeechService.parseMultipart(req);
    const bot = await this.botsService.findOneByIdForExternalRuntime(parsed.botId);
    if (!bot) {
      throw new HttpException({ error: 'Bot not found', errorCode: 'BOT_NOT_FOUND' }, HttpStatus.NOT_FOUND);
    }
    const b = bot as Record<string, unknown>;
    if ((b.status as string | undefined) !== 'published') {
      throw new HttpException({ error: 'Bot not available', errorCode: 'BOT_NOT_PUBLISHED' }, HttpStatus.NOT_FOUND);
    }

    const resolvedChatVisitorId = resolveEmbedChatVisitorIdFromBody(parsed.chatVisitorId, parsed.visitorId);
    if (!resolvedChatVisitorId) {
      throw new HttpException(
        { error: 'chatVisitorId is required', errorCode: 'CHAT_VISITOR_ID_REQUIRED' },
        HttpStatus.BAD_REQUEST,
      );
    }

    this.assertRuntimeEmbedAccessOrThrow(req, b, { accessKey: parsed.accessKey, secretKey: parsed.secretKey }, resolvedChatVisitorId);
    this.assertIframeRateLimit(b, req);
    const parentOrigin = String(parsed.parentOrigin ?? '').trim();
    if (!parentOrigin) {
      throw new HttpException(
        { error: 'parentOrigin is required', errorCode: 'PARENT_ORIGIN_REQUIRED' },
        HttpStatus.BAD_REQUEST,
      );
    }
    this.assertIframeParentOriginOrThrow(b, parentOrigin, req);
    this.assertBotOwnerPresent(b);

    const result = await this.widgetSpeechService.handlePreview(b, parsed);
    this.embedSessionService.refreshSessionCookie(res, String(b._id ?? ''), resolvedChatVisitorId);
    return result;
  }

  @Post('iframe/conversations/list')
  async iframeList(
    @Body() body: unknown,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const parsed = parseIframeListBody(body);
    if (!parsed) {
      throw new HttpException(
        { error: 'Invalid request body', errorCode: 'BAD_REQUEST' },
        HttpStatus.BAD_REQUEST,
      );
    }

    const bot = await this.botsService.findOneByIdForExternalRuntime(parsed.botId);
    if (!bot) {
      throw new HttpException({ error: 'Bot not found', errorCode: 'BOT_NOT_FOUND' }, HttpStatus.NOT_FOUND);
    }

    const b = bot as Record<string, unknown>;
    this.assertBotOwnerPresent(b);

    const resolvedChatVisitorId = resolveEmbedChatVisitorIdFromBody(parsed.chatVisitorId, parsed.visitorId);
    if (!resolvedChatVisitorId) {
      throw new HttpException(
        { error: 'chatVisitorId is required', errorCode: 'CHAT_VISITOR_ID_REQUIRED' },
        HttpStatus.BAD_REQUEST,
      );
    }

    this.assertRuntimeEmbedAccessOrThrow(req, b, { accessKey: parsed.accessKey, secretKey: parsed.secretKey }, resolvedChatVisitorId);
    this.assertIframeRateLimit(b, req);
    this.assertIframeParentOriginOrThrow(b, parsed.parentOrigin, req);

    const botOid = new Types.ObjectId(String(b._id ?? ''));
    const conversations = await this.chatEngineService.listVisitorConversations({
      botOid,
      chatVisitorId: resolvedChatVisitorId,
      limit: 25,
    });

    this.embedSessionService.refreshSessionCookie(res, String(b._id ?? ''), resolvedChatVisitorId);
    return { ok: true, conversations };
  }

  @Post('iframe/conversations/messages')
  async iframeMessages(
    @Body() body: unknown,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const parsed = parseIframeMessagesBody(body);
    if (!parsed) {
      throw new HttpException(
        { error: 'Invalid request body', errorCode: 'BAD_REQUEST' },
        HttpStatus.BAD_REQUEST,
      );
    }

    const bot = await this.botsService.findOneByIdForExternalRuntime(parsed.botId);
    if (!bot) {
      throw new HttpException({ error: 'Bot not found', errorCode: 'BOT_NOT_FOUND' }, HttpStatus.NOT_FOUND);
    }

    const b = bot as Record<string, unknown>;
    this.assertBotOwnerPresent(b);

    const resolvedChatVisitorId = resolveEmbedChatVisitorIdFromBody(parsed.chatVisitorId, parsed.visitorId);
    if (!resolvedChatVisitorId) {
      throw new HttpException(
        { error: 'chatVisitorId is required', errorCode: 'CHAT_VISITOR_ID_REQUIRED' },
        HttpStatus.BAD_REQUEST,
      );
    }

    this.assertRuntimeEmbedAccessOrThrow(req, b, { accessKey: parsed.accessKey, secretKey: parsed.secretKey }, resolvedChatVisitorId);
    this.assertIframeRateLimit(b, req);
    this.assertIframeParentOriginOrThrow(b, parsed.parentOrigin, req);

    const botOid = new Types.ObjectId(String(b._id ?? ''));
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

    this.embedSessionService.refreshSessionCookie(res, String(b._id ?? ''), resolvedChatVisitorId);
    return { ok: true, messages };
  }
}
