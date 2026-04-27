import { Controller, HttpException, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { Types } from 'mongoose';
import { BotsService } from '../bots/bots.service';
import { EmbedSessionService } from '../bots/embed-session.service';
import { validateRuntimeBotAccess } from '../bots/runtime-bot-access.util';
import { toRuntimeCredentialErrorCode } from '../bots/runtime-error-codes.util';
import {
  consumeEmbedRuntimeRateLimitToken,
  EMBED_RUNTIME_RATE_LIMIT_KEY_PREFIX,
  EMBED_RUNTIME_RATE_LIMIT_WINDOW_MS,
  getClientIpForRateLimit,
} from '../bots/embed-runtime-rate-limit.util';
import { throwEmbedRuntimeIpRateLimited } from '../rate-limit/rate-limit-http-exception.util';
import { normalizeVisitorMultiChatMax } from '../bots/visitor-multi-chat.util';
import { resolveEmbedChatVisitorIdFromBody } from '../bots/widget-embed-identity.util';
import {
  coerceAllowedOriginsFromBotDoc,
  isRuntimeOriginAllowed,
  resolveRuntimeEmbedOriginFromHeaders,
} from '../bots/origin-validation.util';
import { resolveWidgetEmbedRateLimitPerMinute } from '../models/bot.schema';
import type { MessageAttachment, MessageSpeechInput } from '../models/message.schema';
import { getRequestId } from '../lib/request-id.helper';
import { ChatEngineService } from './chat-engine.service';
import type { BotLike } from './chat-engine.types';
import { normalizeSpeechInputFromBody } from './speech-input.normalize';
import { WidgetSpeechService } from './widget-speech.service';
import {
  assertEmbedChatHasUserTurn,
  parseEmbedChatMultipartRequest,
  parseEmbedChatPayloadRecord,
  uploadWidgetChatAttachments,
} from './widget-embed-chat-multipart.util';

@Controller('api/chat')
export class ChatController {
  constructor(
    private readonly configService: ConfigService,
    private readonly botsService: BotsService,
    private readonly chatEngineService: ChatEngineService,
    private readonly embedSessionService: EmbedSessionService,
    private readonly widgetSpeechService: WidgetSpeechService,
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

  private assertRuntimeEmbedOriginOrThrow(bot: Record<string, unknown>, req: FastifyRequest): void {
    const limit = resolveWidgetEmbedRateLimitPerMinute(bot);
    const ip = getClientIpForRateLimit(req);
    if (!consumeEmbedRuntimeRateLimitToken(`${EMBED_RUNTIME_RATE_LIMIT_KEY_PREFIX}:${ip}`, limit)) {
      throwEmbedRuntimeIpRateLimited(EMBED_RUNTIME_RATE_LIMIT_WINDOW_MS);
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

    const nodeEnv = this.configService.get<string>('nodeEnv') ?? 'development';
    const allowedOrigins = coerceAllowedOriginsFromBotDoc(bot.allowedOrigins);
    if (!isRuntimeOriginAllowed(embedOriginResolved, allowedOrigins, nodeEnv)) {
      throw new HttpException(
        { error: 'This chat widget is not allowed on this site', errorCode: 'EMBED_ORIGIN_NOT_ALLOWED' },
        HttpStatus.FORBIDDEN,
      );
    }
  }

  private parseBody(body: unknown): {
    botId: string;
    message: string;
    accessKey?: string;
    secretKey?: string;
    chatVisitorId?: string;
    conversationId?: string;
    startNewConversation?: boolean;
    /** @deprecated Chat/session identity alias only. */
    visitorId?: string;
    speechInput?: MessageSpeechInput;
  } | null {
    if (body == null || typeof body !== 'object') return null;
    const o = body as Record<string, unknown>;
    const botId = typeof o.botId === 'string' ? o.botId.trim() : '';
    const message = typeof o.message === 'string' ? o.message.trim() : '';
    if (!botId || !message) return null;
    const accessKey = typeof o.accessKey === 'string' ? o.accessKey.trim() : '';
    const secretKey = typeof o.secretKey === 'string' ? o.secretKey.trim() : '';
    const chatVisitorId = typeof o.chatVisitorId === 'string' ? o.chatVisitorId.trim() : '';
    const visitorId = typeof o.visitorId === 'string' ? o.visitorId.trim() : '';
    const conversationId = typeof o.conversationId === 'string' ? o.conversationId.trim() : '';
    const startNewConversation = o.startNewConversation === true;
    const speechInput = normalizeSpeechInputFromBody(o.speechInput);
    return {
      botId,
      message,
      ...(accessKey ? { accessKey } : {}),
      ...(secretKey ? { secretKey } : {}),
      ...(chatVisitorId ? { chatVisitorId } : {}),
      ...(visitorId ? { visitorId } : {}),
      ...(conversationId ? { conversationId } : {}),
      ...(startNewConversation ? { startNewConversation: true } : {}),
      ...(speechInput ? { speechInput } : {}),
    };
  }

  private parseListBody(body: unknown): {
    botId: string;
    accessKey?: string;
    secretKey?: string;
    chatVisitorId?: string;
    visitorId?: string;
  } | null {
    if (body == null || typeof body !== 'object') return null;
    const o = body as Record<string, unknown>;
    const botId = typeof o.botId === 'string' ? o.botId.trim() : '';
    const chatVisitorId = typeof o.chatVisitorId === 'string' ? o.chatVisitorId.trim() : '';
    const visitorId = typeof o.visitorId === 'string' ? o.visitorId.trim() : '';
    if (!botId || (!chatVisitorId && !visitorId)) return null;
    const accessKey = typeof o.accessKey === 'string' ? o.accessKey.trim() : '';
    const secretKey = typeof o.secretKey === 'string' ? o.secretKey.trim() : '';
    return {
      botId,
      ...(chatVisitorId ? { chatVisitorId } : {}),
      ...(visitorId ? { visitorId } : {}),
      ...(accessKey ? { accessKey } : {}),
      ...(secretKey ? { secretKey } : {}),
    };
  }

  @Post('conversations/list')
  async listConversations(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const parsed = this.parseListBody((req as { body?: unknown }).body);
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

    const resolvedChatVisitorId = resolveEmbedChatVisitorIdFromBody(parsed.chatVisitorId, parsed.visitorId);
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

    this.assertBotOwnerPresent(bot as Record<string, unknown>);
    this.assertRuntimeEmbedOriginOrThrow(bot as Record<string, unknown>, req);

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
    chatVisitorId?: string;
    visitorId?: string;
  } | null {
    if (body == null || typeof body !== 'object') return null;
    const o = body as Record<string, unknown>;
    const botId = typeof o.botId === 'string' ? o.botId.trim() : '';
    const conversationId = typeof o.conversationId === 'string' ? o.conversationId.trim() : '';
    const chatVisitorId = typeof o.chatVisitorId === 'string' ? o.chatVisitorId.trim() : '';
    const visitorId = typeof o.visitorId === 'string' ? o.visitorId.trim() : '';
    if (!botId || !conversationId || (!chatVisitorId && !visitorId)) return null;
    const accessKey = typeof o.accessKey === 'string' ? o.accessKey.trim() : '';
    const secretKey = typeof o.secretKey === 'string' ? o.secretKey.trim() : '';
    return {
      botId,
      conversationId,
      ...(chatVisitorId ? { chatVisitorId } : {}),
      ...(accessKey ? { accessKey } : {}),
      ...(secretKey ? { secretKey } : {}),
      ...(visitorId ? { visitorId } : {}),
    };
  }

  @Post('conversations/messages')
  async conversationMessages(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const parsed = this.parseMessagesBody((req as { body?: unknown }).body);
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

    const resolvedChatVisitorId = resolveEmbedChatVisitorIdFromBody(parsed.chatVisitorId, parsed.visitorId);
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

    this.assertBotOwnerPresent(bot as Record<string, unknown>);
    this.assertRuntimeEmbedOriginOrThrow(bot as Record<string, unknown>, req);

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
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    let parsed: NonNullable<ReturnType<ChatController['parseBody']>> | null = null;
    let uploadedAttachments: MessageAttachment[] = [];

    if (typeof req.isMultipart === 'function' && req.isMultipart()) {
      const { payloadRecord, rawFiles } = await parseEmbedChatMultipartRequest(req);
      const payload = parseEmbedChatPayloadRecord(payloadRecord);
      if (!payload) {
        throw new HttpException(
          { error: 'Invalid request body', errorCode: 'BAD_REQUEST' },
          HttpStatus.BAD_REQUEST,
        );
      }
      parsed = {
        botId: payload.botId,
        message: payload.message,
        ...(payload.accessKey ? { accessKey: payload.accessKey } : {}),
        ...(payload.secretKey ? { secretKey: payload.secretKey } : {}),
        ...(payload.chatVisitorId ? { chatVisitorId: payload.chatVisitorId } : {}),
        ...(payload.visitorId ? { visitorId: payload.visitorId } : {}),
        ...(payload.conversationId ? { conversationId: payload.conversationId } : {}),
        ...(payload.startNewConversation ? { startNewConversation: true } : {}),
        ...(payload.speechInput ? { speechInput: payload.speechInput } : {}),
      };
      if (rawFiles.length > 0) {
        uploadedAttachments = await uploadWidgetChatAttachments(payload.botId, rawFiles);
      }
      assertEmbedChatHasUserTurn(parsed.message, parsed.speechInput, uploadedAttachments);
    } else {
      parsed = this.parseBody((req as { body?: unknown }).body);
      if (!parsed) {
        throw new HttpException(
          { error: 'Invalid request body', errorCode: 'BAD_REQUEST' },
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    const bot = await this.botsService.findOneByIdForExternalRuntime(parsed.botId);
    if (!bot) {
      throw new HttpException(
        { error: 'Bot not found', errorCode: 'BOT_NOT_FOUND' },
        HttpStatus.NOT_FOUND,
      );
    }

    const resolvedChatVisitorId = resolveEmbedChatVisitorIdFromBody(parsed.chatVisitorId, parsed.visitorId);
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

    this.assertBotOwnerPresent(bot as Record<string, unknown>);
    this.assertRuntimeEmbedOriginOrThrow(bot as Record<string, unknown>, req);

    const b = bot as Record<string, unknown>;
    const chatUi = (b.chatUI ?? {}) as Record<string, unknown>;
    if (uploadedAttachments.length > 0 && chatUi.allowFileUpload !== true) {
      throw new HttpException(
        { error: 'File uploads are disabled for this bot.', errorCode: 'FILE_UPLOAD_DISABLED' },
        HttpStatus.FORBIDDEN,
      );
    }

    const botLike: BotLike = {
      _id: (b._id as { toString(): string }),
      name: (b.name as string) ?? '',
      shortDescription: (b.shortDescription as string) ?? '',
      description: (b.description as string) ?? '',
      category: (b.category as string) ?? '',
      openaiApiKeyOverride: (b.openaiApiKeyOverride as string) ?? undefined,
      welcomeMessage: (b.welcomeMessage as string) ?? '',
      welcomeMessageEnabled:
        (b.welcomeMessageEnabled as boolean | undefined) === false ? false : undefined,
      knowledgeDescription: (b.knowledgeDescription as string) ?? '',
      leadCapture: (b.leadCapture as BotLike['leadCapture']) ?? undefined,
      personality: (b.personality as BotLike['personality']) ?? undefined,
      config: (b.config as BotLike['config']) ?? undefined,
      faqs: (b.faqs as BotLike['faqs']) ?? undefined,
      visitorMultiChatEnabled:
        (b.visitorMultiChatEnabled as boolean | undefined) === true ? true : undefined,
      visitorMultiChatMax: normalizeVisitorMultiChatMax(b.visitorMultiChatMax),
      exampleQuestions: b.exampleQuestions,
    };

    const chatResult = await this.chatEngineService.runChat({
      bot: botLike,
      chatVisitorId: resolvedChatVisitorId,
      message: parsed.message,
      mode: 'user',
      requestId: getRequestId(req),
      debug: false,
      ...(parsed.conversationId ? { conversationId: parsed.conversationId } : {}),
      ...(parsed.startNewConversation ? { startNewConversation: true } : {}),
      ...(parsed.speechInput ? { speechInput: parsed.speechInput } : {}),
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

    this.embedSessionService.refreshSessionCookie(
      res,
      String((bot as { _id: unknown })._id),
      resolvedChatVisitorId,
    );
    return {
      ok: true,
      conversationId: chatResult.conversationId,
      assistantMessage: chatResult.assistantMessage,
      sources: chatResult.sources,
      ...(chatResult.userAttachments?.length ? { userAttachments: chatResult.userAttachments } : {}),
    };
  }

  /** Multipart: `file`, `botId`, `mode` (dictate|voice), `chatVisitorId`, optional keys/origin — same embed rules as POST message. */
  @Post('speech')
  async speech(@Req() req: FastifyRequest) {
    return this.widgetSpeechService.handleRuntime(req);
  }
}
