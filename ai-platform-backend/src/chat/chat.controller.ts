import { Body, Controller, HttpException, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { Types } from 'mongoose';
import { BotsService } from '../bots/bots.service';
import { EmbedSessionService } from '../bots/embed-session.service';
import { validateRuntimeBotAccess } from '../bots/runtime-bot-access.util';
import { toRuntimeCredentialErrorCode } from '../bots/runtime-error-codes.util';
import {
  checkEmbedDomainGate,
  parseAllowedDomainRulesFromStoredArray,
  resolveRuntimeEmbedOriginFromHeaders,
} from '../bots/embed-domain.util';
import {
  consumeEmbedRuntimeRateLimitToken,
  EMBED_RUNTIME_RATE_LIMIT_KEY_PREFIX,
  getClientIpForRateLimit,
} from '../bots/embed-runtime-rate-limit.util';
import { normalizeVisitorMultiChatMax } from '../bots/visitor-multi-chat.util';
import { getRequestId } from '../lib/request-id.helper';
import { VisitorsService } from '../visitors/visitors.service';
import { ChatEngineService } from './chat-engine.service';
import type { BotLike } from './chat-engine.types';

@Controller('api/chat')
export class ChatController {
  constructor(
    private readonly configService: ConfigService,
    private readonly botsService: BotsService,
    private readonly visitorsService: VisitorsService,
    private readonly chatEngineService: ChatEngineService,
    private readonly embedSessionService: EmbedSessionService,
  ) { }

  /**
   * Published bot + either valid HttpOnly embed session cookie (from `/api/widget/init`, bound to `chatVisitorId`) or access/secret keys.
   */
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

  private assertEmbedDomainGateForBot(bot: { allowedDomains?: unknown }, req: FastifyRequest): void {
    const limit = this.configService.get<number>('widgetEmbedRateLimitPerMinute') ?? 0;
    const ip = getClientIpForRateLimit(req);
    if (
      !consumeEmbedRuntimeRateLimitToken(`${EMBED_RUNTIME_RATE_LIMIT_KEY_PREFIX}:${ip}`, limit)
    ) {
      throw new HttpException(
        { error: 'Too many requests', errorCode: 'RATE_LIMITED' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const embedOriginResolved = resolveRuntimeEmbedOriginFromHeaders(req.headers);
    if (!embedOriginResolved) {
      throw new HttpException(
        {
          error: 'Origin header is required for embed requests',
          errorCode: 'EMBED_ORIGIN_HEADER_REQUIRED',
        },
        HttpStatus.FORBIDDEN,
      );
    }

    const rules = parseAllowedDomainRulesFromStoredArray(bot.allowedDomains);
    const allowLoopback =
      this.configService.get<boolean>('allowLoopbackEmbedOrigin') === true;
    const domainGate = checkEmbedDomainGate(rules, embedOriginResolved, {
      allowLoopbackOriginWhenLocalDev: allowLoopback,
    });
    if (!domainGate.ok) {
      const errorCode =
        domainGate.reason === 'no_allowlist'
          ? 'EMBED_NO_ALLOWLIST'
          : domainGate.reason === 'missing_origin'
            ? 'EMBED_ORIGIN_REQUIRED'
            : domainGate.reason === 'bad_origin'
              ? 'EMBED_ORIGIN_INVALID'
              : 'EMBED_DOMAIN_NOT_ALLOWED';
      const error =
        domainGate.reason === 'no_allowlist'
          ? 'This bot has no valid allowed embed rules configured'
          : domainGate.reason === 'missing_origin'
            ? 'Origin header is required for embed requests'
            : domainGate.reason === 'bad_origin'
              ? 'Origin could not be parsed'
              : 'This chat widget is not allowed on this site';
      throw new HttpException({ error, errorCode }, HttpStatus.FORBIDDEN);
    }
  }

  private parseBody(body: unknown): {
    botId: string;
    message: string;
    accessKey?: string;
    secretKey?: string;
    embedOrigin?: string;
    chatVisitorId?: string;
    platformVisitorId?: string;
    conversationId?: string;
    startNewConversation?: boolean;
    /**
     * @deprecated Legacy payload field (ambiguous).
     *
     * For this chat endpoint:
     * - legacy `visitorId` is treated as `chatVisitorId` only (chat identity).
     * - platform visitor identity is derived separately (only when bot.creatorType === 'visitor').
     */
    visitorId?: string;
  } | null {
    if (body == null || typeof body !== 'object') return null;
    const o = body as Record<string, unknown>;
    const botId = typeof o.botId === 'string' ? o.botId.trim() : '';
    const message = typeof o.message === 'string' ? o.message.trim() : '';
    if (!botId || !message) return null;
    const accessKey = typeof o.accessKey === 'string' ? o.accessKey.trim() : '';
    const secretKey = typeof o.secretKey === 'string' ? o.secretKey.trim() : '';
    const embedOrigin = typeof o.embedOrigin === 'string' ? o.embedOrigin.trim() : '';
    const chatVisitorId = typeof o.chatVisitorId === 'string' ? o.chatVisitorId.trim() : '';
    const platformVisitorId = typeof o.platformVisitorId === 'string' ? o.platformVisitorId.trim() : '';
    const visitorId = typeof o.visitorId === 'string' ? o.visitorId.trim() : '';
    const conversationId = typeof o.conversationId === 'string' ? o.conversationId.trim() : '';
    const startNewConversation = o.startNewConversation === true;
    return {
      botId,
      message,
      ...(accessKey ? { accessKey } : {}),
      ...(secretKey ? { secretKey } : {}),
      ...(embedOrigin ? { embedOrigin } : {}),
      ...(chatVisitorId ? { chatVisitorId } : {}),
      ...(platformVisitorId ? { platformVisitorId } : {}),
      ...(visitorId ? { visitorId } : {}),
      ...(conversationId ? { conversationId } : {}),
      ...(startNewConversation ? { startNewConversation: true } : {}),
    };
  }

  private parseListBody(body: unknown): {
    botId: string;
    accessKey?: string;
    secretKey?: string;
    embedOrigin?: string;
    chatVisitorId?: string;
    platformVisitorId?: string;
    visitorId?: string;
  } | null {
    if (body == null || typeof body !== 'object') return null;
    const o = body as Record<string, unknown>;
    const botId = typeof o.botId === 'string' ? o.botId.trim() : '';
    const chatVisitorId = typeof o.chatVisitorId === 'string' ? o.chatVisitorId.trim() : '';
    if (!botId || !chatVisitorId) return null;
    const accessKey = typeof o.accessKey === 'string' ? o.accessKey.trim() : '';
    const secretKey = typeof o.secretKey === 'string' ? o.secretKey.trim() : '';
    const embedOrigin = typeof o.embedOrigin === 'string' ? o.embedOrigin.trim() : '';
    const platformVisitorId = typeof o.platformVisitorId === 'string' ? o.platformVisitorId.trim() : '';
    const visitorId = typeof o.visitorId === 'string' ? o.visitorId.trim() : '';
    return {
      botId,
      chatVisitorId,
      ...(accessKey ? { accessKey } : {}),
      ...(secretKey ? { secretKey } : {}),
      ...(embedOrigin ? { embedOrigin } : {}),
      ...(platformVisitorId ? { platformVisitorId } : {}),
      ...(visitorId ? { visitorId } : {}),
    };
  }

  @Post('conversations/list')
  async listConversations(
    @Body() body: unknown,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const parsed = this.parseListBody(body);
    if (!parsed) {
      throw new HttpException(
        { error: 'Invalid request body', errorCode: 'BAD_REQUEST' },
        HttpStatus.BAD_REQUEST,
      );
    }

    const bot = await this.botsService.findOneByIdForExternalRuntime(parsed.botId);
    if (!bot) {
      throw new HttpException(
        { error: 'Bot not found', errorCode: 'BOT_NOT_FOUND' },
        HttpStatus.NOT_FOUND,
      );
    }

    const resolvedChatVisitorId = parsed.chatVisitorId ?? parsed.visitorId;
    if (!resolvedChatVisitorId) {
      throw new HttpException(
        { error: 'chatVisitorId is required', errorCode: 'CHAT_VISITOR_ID_REQUIRED' },
        HttpStatus.BAD_REQUEST,
      );
    }

    this.assertRuntimeEmbedAccessOrThrow(req, bot as Record<string, unknown>, {
      accessKey: parsed.accessKey,
      secretKey: parsed.secretKey,
    }, resolvedChatVisitorId);

    this.assertEmbedDomainGateForBot(bot as { allowedDomains?: unknown }, req);

    const creatorType = bot.creatorType === 'visitor' ? 'visitor' : 'user';
    const resolvedPlatformVisitorId =
      creatorType === 'visitor'
        ? (parsed.platformVisitorId ?? parsed.visitorId ?? '')
        : (parsed.platformVisitorId ?? parsed.visitorId ?? 'anonymous');

    if (creatorType === 'visitor' && !resolvedPlatformVisitorId) {
      throw new HttpException(
        { error: 'platformVisitorId is required for trial bots', errorCode: 'VISITOR_ID_REQUIRED' },
        HttpStatus.BAD_REQUEST,
      );
    }

    if (creatorType === 'visitor' && resolvedPlatformVisitorId) {
      await this.visitorsService.getOrCreateVisitor(resolvedPlatformVisitorId);
    }

    const botOid = new Types.ObjectId(String((bot as { _id: unknown })._id));
    const conversations = await this.chatEngineService.listVisitorConversations({
      botOid,
      chatVisitorId: resolvedChatVisitorId,
      limit: 25,
    });

    this.embedSessionService.refreshSessionCookie(
      res,
      String((bot as { _id: unknown })._id),
      resolvedChatVisitorId,
    );
    return { ok: true, conversations };
  }

  private parseMessagesBody(body: unknown): {
    botId: string;
    conversationId: string;
    accessKey?: string;
    secretKey?: string;
    embedOrigin?: string;
    chatVisitorId?: string;
    platformVisitorId?: string;
    visitorId?: string;
  } | null {
    if (body == null || typeof body !== 'object') return null;
    const o = body as Record<string, unknown>;
    const botId = typeof o.botId === 'string' ? o.botId.trim() : '';
    const conversationId = typeof o.conversationId === 'string' ? o.conversationId.trim() : '';
    const chatVisitorId = typeof o.chatVisitorId === 'string' ? o.chatVisitorId.trim() : '';
    if (!botId || !conversationId || !chatVisitorId) return null;
    const accessKey = typeof o.accessKey === 'string' ? o.accessKey.trim() : '';
    const secretKey = typeof o.secretKey === 'string' ? o.secretKey.trim() : '';
    const embedOrigin = typeof o.embedOrigin === 'string' ? o.embedOrigin.trim() : '';
    const platformVisitorId = typeof o.platformVisitorId === 'string' ? o.platformVisitorId.trim() : '';
    const visitorId = typeof o.visitorId === 'string' ? o.visitorId.trim() : '';
    return {
      botId,
      conversationId,
      chatVisitorId,
      ...(accessKey ? { accessKey } : {}),
      ...(secretKey ? { secretKey } : {}),
      ...(embedOrigin ? { embedOrigin } : {}),
      ...(platformVisitorId ? { platformVisitorId } : {}),
      ...(visitorId ? { visitorId } : {}),
    };
  }

  @Post('conversations/messages')
  async conversationMessages(
    @Body() body: unknown,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const parsed = this.parseMessagesBody(body);
    if (!parsed) {
      throw new HttpException(
        { error: 'Invalid request body', errorCode: 'BAD_REQUEST' },
        HttpStatus.BAD_REQUEST,
      );
    }

    const bot = await this.botsService.findOneByIdForExternalRuntime(parsed.botId);
    if (!bot) {
      throw new HttpException(
        { error: 'Bot not found', errorCode: 'BOT_NOT_FOUND' },
        HttpStatus.NOT_FOUND,
      );
    }

    const resolvedChatVisitorId = parsed.chatVisitorId ?? parsed.visitorId;
    if (!resolvedChatVisitorId) {
      throw new HttpException(
        { error: 'chatVisitorId is required', errorCode: 'CHAT_VISITOR_ID_REQUIRED' },
        HttpStatus.BAD_REQUEST,
      );
    }

    this.assertRuntimeEmbedAccessOrThrow(req, bot as Record<string, unknown>, {
      accessKey: parsed.accessKey,
      secretKey: parsed.secretKey,
    }, resolvedChatVisitorId);

    this.assertEmbedDomainGateForBot(bot as { allowedDomains?: unknown }, req);

    const creatorType = bot.creatorType === 'visitor' ? 'visitor' : 'user';
    const resolvedPlatformVisitorId =
      creatorType === 'visitor'
        ? (parsed.platformVisitorId ?? parsed.visitorId ?? '')
        : (parsed.platformVisitorId ?? parsed.visitorId ?? 'anonymous');

    if (creatorType === 'visitor' && !resolvedPlatformVisitorId) {
      throw new HttpException(
        { error: 'platformVisitorId is required for trial bots', errorCode: 'VISITOR_ID_REQUIRED' },
        HttpStatus.BAD_REQUEST,
      );
    }

    if (creatorType === 'visitor' && resolvedPlatformVisitorId) {
      await this.visitorsService.getOrCreateVisitor(resolvedPlatformVisitorId);
    }

    const botOid = new Types.ObjectId(String((bot as { _id: unknown })._id));
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

    this.embedSessionService.refreshSessionCookie(
      res,
      String((bot as { _id: unknown })._id),
      resolvedChatVisitorId,
    );
    return { ok: true, messages };
  }

  @Post('message')
  async message(
    @Body() body: unknown,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const parsed = this.parseBody(body);
    if (!parsed) {
      throw new HttpException(
        { error: 'Invalid request body', errorCode: 'BAD_REQUEST' },
        HttpStatus.BAD_REQUEST,
      );
    }

    const bot = await this.botsService.findOneByIdForExternalRuntime(parsed.botId);
    if (!bot) {
      throw new HttpException(
        { error: 'Bot not found', errorCode: 'BOT_NOT_FOUND' },
        HttpStatus.NOT_FOUND,
      );
    }

    // Resolve chat visitor id (chat history + conversation/message association).
    // Critical boundary: chatVisitorId must NEVER be derived from platformVisitorId.
    const resolvedChatVisitorId = parsed.chatVisitorId ?? parsed.visitorId;
    if (!resolvedChatVisitorId) {
      throw new HttpException(
        { error: 'chatVisitorId is required', errorCode: 'CHAT_VISITOR_ID_REQUIRED' },
        HttpStatus.BAD_REQUEST,
      );
    }

    this.assertRuntimeEmbedAccessOrThrow(req, bot as Record<string, unknown>, {
      accessKey: parsed.accessKey,
      secretKey: parsed.secretKey,
    }, resolvedChatVisitorId);

    this.assertEmbedDomainGateForBot(bot as { allowedDomains?: unknown }, req);

    const creatorType = bot.creatorType === 'visitor' ? 'visitor' : 'user';

    // Resolve platform visitor id (trial owner + platform quota/analytics).
    const resolvedPlatformVisitorId =
      creatorType === 'visitor'
        ? (parsed.platformVisitorId ?? parsed.visitorId ?? '')
        : (parsed.platformVisitorId ?? parsed.visitorId ?? 'anonymous');

    if (creatorType === 'visitor' && !resolvedPlatformVisitorId) {
      throw new HttpException(
        { error: 'platformVisitorId is required for trial bots', errorCode: 'VISITOR_ID_REQUIRED' },
        HttpStatus.BAD_REQUEST,
      );
    }

    if (creatorType === 'visitor' && resolvedPlatformVisitorId) {
      await this.visitorsService.getOrCreateVisitor(resolvedPlatformVisitorId);
    }

    const b = bot as Record<string, unknown>;
    const botLike: BotLike = {
      _id: (b._id as { toString(): string }),
      name: (b.name as string) ?? '',
      shortDescription: (b.shortDescription as string) ?? '',
      description: (b.description as string) ?? '',
      category: (b.category as string) ?? '',
      openaiApiKeyOverride: (b.openaiApiKeyOverride as string) ?? undefined,
      welcomeMessage: (b.welcomeMessage as string) ?? '',
      knowledgeDescription: (b.knowledgeDescription as string) ?? '',
      leadCapture: (b.leadCapture as BotLike['leadCapture']) ?? undefined,
      personality: (b.personality as BotLike['personality']) ?? undefined,
      config: (b.config as BotLike['config']) ?? undefined,
      faqs: (b.faqs as BotLike['faqs']) ?? undefined,
      visitorMultiChatEnabled:
        (b.visitorMultiChatEnabled as boolean | undefined) === true ? true : undefined,
      visitorMultiChatMax: normalizeVisitorMultiChatMax(b.visitorMultiChatMax),
    };

    const chatResult = await this.chatEngineService.runChat({
      bot: botLike,
      chatVisitorId: resolvedChatVisitorId,
      platformVisitorId: creatorType === 'visitor' ? resolvedPlatformVisitorId : undefined,
      message: parsed.message,
      mode: 'user',
      requestId: getRequestId(req),
      debug: false,
      ...(parsed.conversationId ? { conversationId: parsed.conversationId } : {}),
      ...(parsed.startNewConversation ? { startNewConversation: true } : {}),
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

    this.embedSessionService.refreshSessionCookie(
      res,
      String((bot as { _id: unknown })._id),
      resolvedChatVisitorId,
    );
    return {
      ok: true,
      limitReached: false,
      conversationId: chatResult.conversationId,
      assistantMessage: chatResult.assistantMessage,
      sources: chatResult.sources,
    };
  }
}
