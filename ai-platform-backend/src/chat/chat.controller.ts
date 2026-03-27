import { Body, Controller, HttpException, HttpStatus, Post, Req } from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { BotsService } from '../bots/bots.service';
import { validateRuntimeBotAccess } from '../bots/runtime-bot-access.util';
import { toRuntimeCredentialErrorCode } from '../bots/runtime-error-codes.util';
import { getRequestId } from '../lib/request-id.helper';
import { VisitorsService } from '../visitors/visitors.service';
import { ChatEngineService } from './chat-engine.service';
import type { BotLike } from './chat-engine.types';

@Controller('api/chat')
export class ChatController {
  constructor(
    private readonly botsService: BotsService,
    private readonly visitorsService: VisitorsService,
    private readonly chatEngineService: ChatEngineService,
  ) { }

  private parseBody(body: unknown): {
    botId: string;
    message: string;
    accessKey?: string;
    secretKey?: string;
    chatVisitorId?: string;
    platformVisitorId?: string;
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
    const chatVisitorId = typeof o.chatVisitorId === 'string' ? o.chatVisitorId.trim() : '';
    const platformVisitorId = typeof o.platformVisitorId === 'string' ? o.platformVisitorId.trim() : '';
    const visitorId = typeof o.visitorId === 'string' ? o.visitorId.trim() : '';
    return {
      botId,
      message,
      ...(accessKey ? { accessKey } : {}),
      ...(secretKey ? { secretKey } : {}),
      ...(chatVisitorId ? { chatVisitorId } : {}),
      ...(platformVisitorId ? { platformVisitorId } : {}),
      ...(visitorId ? { visitorId } : {}),
    };
  }

  @Post('message')
  async message(@Body() body: unknown, @Req() req: FastifyRequest) {
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

    const access = validateRuntimeBotAccess(
      {
        status: (bot.status as string | undefined) ?? undefined,
        visibility: (bot.visibility as 'public' | 'private' | undefined) ?? undefined,
        accessKey: (bot.accessKey as string | undefined) ?? undefined,
        secretKey: (bot.secretKey as string | undefined) ?? undefined,
      },
      { accessKey: parsed.accessKey, secretKey: parsed.secretKey },
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

    // Resolve chat visitor id (chat history + conversation/message association).
    // Critical boundary: chatVisitorId must NEVER be derived from platformVisitorId.
    const resolvedChatVisitorId = parsed.chatVisitorId ?? parsed.visitorId;

    if (!resolvedChatVisitorId) {
      throw new HttpException(
        { error: 'chatVisitorId is required', errorCode: 'CHAT_VISITOR_ID_REQUIRED' },
        HttpStatus.BAD_REQUEST,
      );
    }

    if (creatorType === 'visitor' && resolvedPlatformVisitorId) {
      await this.visitorsService.getOrCreateVisitor(resolvedPlatformVisitorId);
    }

    const policyMode =
      bot.messageLimitMode === 'fixed_total' ? 'fixed_total' : 'none';
    const policyTotal =
      typeof bot.messageLimitTotal === 'number' && Number.isFinite(bot.messageLimitTotal)
        ? Math.max(0, Math.floor(bot.messageLimitTotal))
        : null;

    /**
     * Precedence rule (step-3):
     * For external visitor-created trial bots, bot-level fixed_total policy takes priority.
     * Legacy/global limits remain unchanged for other flows and are not used here.
     */
    if (creatorType === 'visitor' && policyMode === 'fixed_total' && policyTotal != null) {
      const usage = await this.visitorsService.checkVisitorTrialBotUsage({
        botId: String(bot._id),
        platformVisitorId: resolvedPlatformVisitorId,
        limitTotal: policyTotal,
      });
      if (!usage.allowed) {
        const fallback =
          'This trial bot has reached its message limit. Please contact Assistrio to continue.';
        const upgradeMessage =
          typeof bot.messageLimitUpgradeMessage === 'string' &&
            bot.messageLimitUpgradeMessage.trim()
            ? bot.messageLimitUpgradeMessage.trim()
            : fallback;
        return {
          ok: true,
          limitReached: true,
          errorCode: 'MESSAGE_LIMIT_REACHED' as const,
          assistantMessage: upgradeMessage,
          limit: usage.limit,
          used: usage.current,
          remaining: Math.max(0, usage.limit - usage.current),
          sources: [],
        };
      }
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
    };

    const chatResult = await this.chatEngineService.runChat({
      bot: botLike,
      chatVisitorId: resolvedChatVisitorId,
      platformVisitorId: creatorType === 'visitor' ? resolvedPlatformVisitorId : undefined,
      message: parsed.message,
      mode: 'user',
      requestId: getRequestId(req),
      debug: false,
    });
    if (!chatResult.ok) {
      throw new HttpException(chatResult, HttpStatus.BAD_REQUEST);
    }

    let usageMeta:
      | { limit: number; used: number; remaining: number }
      | undefined;
    if (creatorType === 'visitor' && policyMode === 'fixed_total' && policyTotal != null) {
      const used = await this.visitorsService.getAcceptedUserMessageCountForBotVisitor(
        String(bot._id),
        resolvedPlatformVisitorId,
      );
      usageMeta = {
        limit: policyTotal,
        used,
        remaining: Math.max(0, policyTotal - used),
      };
    }

    return {
      ok: true,
      limitReached: false,
      conversationId: chatResult.conversationId,
      assistantMessage: chatResult.assistantMessage,
      sources: chatResult.sources,
      ...(usageMeta ? usageMeta : {}),
    };
  }
}
