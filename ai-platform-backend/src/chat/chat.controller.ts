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
  EMBED_RUNTIME_RATE_LIMIT_WINDOW_MS,
  getClientIpForRateLimit,
} from '../bots/embed-runtime-rate-limit.util';
import { throwEmbedRuntimeIpRateLimited } from '../rate-limit/rate-limit-http-exception.util';
import { normalizeVisitorMultiChatMax } from '../bots/visitor-multi-chat.util';
import {
  assertPlatformVisitorWebsiteMatchesBotAllowlist,
  platformVisitorEmbedCanBypassAllowedDomainsGate,
} from '../bots/platform-visitor-website-allowlist.util';
import { trialRuntimePlatformVisitorMatchesOwner } from '../bots/trial-runtime-embed.util';
import {
  getEmbedRuntimePlatformIdentityViolation,
  PLATFORM_VISITOR_EMBED_ANONYMOUS_SENTINEL,
  resolveEmbedChatVisitorIdFromBody,
  resolveRuntimeEmbedPlatformVisitorIdForChat,
} from '../bots/widget-embed-identity.util';
import { resolveWidgetEmbedRateLimitPerMinute } from '../models/bot.schema';
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

  /**
   * **Domain / origin authorization** — whether this embed origin may load the widget (allowedDomains,
   * optional per-visitor website allowlist bypass). Independent of quota identity; see
   * {@link getEmbedRuntimePlatformIdentityViolation} for platformVisitorId rules.
   */
  private assertEmbedDomainGateForBot(
    bot: {
      allowedDomains?: unknown;
      widgetEmbedRateLimitPerMinute?: unknown;
      websiteURLAllowlist?: unknown;
    },
    req: FastifyRequest,
    embedContext: { creatorType: 'visitor' | 'user'; platformVisitorId: string },
  ): void {
    const limit = resolveWidgetEmbedRateLimitPerMinute(bot);
    const ip = getClientIpForRateLimit(req);
    if (
      !consumeEmbedRuntimeRateLimitToken(`${EMBED_RUNTIME_RATE_LIMIT_KEY_PREFIX}:${ip}`, limit)
    ) {
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

    const bypassAllowedDomains =
      embedContext.creatorType !== 'visitor' &&
      platformVisitorEmbedCanBypassAllowedDomainsGate({
        bot,
        platformVisitorId: embedContext.platformVisitorId,
      });

    if (!bypassAllowedDomains) {
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
     * @deprecated Legacy payload field — **chat/session identity only** on this route.
     * Never mixed into `platformVisitorId` resolution here (see {@link resolveRuntimeEmbedPlatformVisitorIdForChat}).
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
    /** @deprecated Chat identity alias only — see {@link resolveEmbedChatVisitorIdFromBody}. */
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
    const embedOrigin = typeof o.embedOrigin === 'string' ? o.embedOrigin.trim() : '';
    const platformVisitorId = typeof o.platformVisitorId === 'string' ? o.platformVisitorId.trim() : '';
    return {
      botId,
      ...(chatVisitorId ? { chatVisitorId } : {}),
      ...(visitorId ? { visitorId } : {}),
      ...(accessKey ? { accessKey } : {}),
      ...(secretKey ? { secretKey } : {}),
      ...(embedOrigin ? { embedOrigin } : {}),
      ...(platformVisitorId ? { platformVisitorId } : {}),
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

    const creatorType = bot.creatorType === 'visitor' ? 'visitor' : 'user';
    const botType = String((bot as { type?: string }).type ?? '');
    const resolvedPlatformVisitorId = resolveRuntimeEmbedPlatformVisitorIdForChat({
      creatorType,
      platformVisitorId: parsed.platformVisitorId,
    });

    if (creatorType === 'visitor' && !resolvedPlatformVisitorId) {
      throw new HttpException(
        { error: 'platformVisitorId is required for trial bots', errorCode: 'VISITOR_ID_REQUIRED' },
        HttpStatus.BAD_REQUEST,
      );
    }

    const embedIdentityErr = getEmbedRuntimePlatformIdentityViolation({
      botType,
      creatorType,
      resolvedPlatformVisitorId,
    });
    if (!embedIdentityErr.ok) {
      throw new HttpException(
        { error: embedIdentityErr.message, errorCode: embedIdentityErr.errorCode },
        HttpStatus.BAD_REQUEST,
      );
    }

    if (
      creatorType === 'visitor' &&
      !trialRuntimePlatformVisitorMatchesOwner({
        ownerVisitorId: (bot as { ownerVisitorId?: unknown }).ownerVisitorId,
        resolvedPlatformVisitorId,
      })
    ) {
      throw new HttpException(
        {
          error: 'platformVisitorId does not match this trial bot owner.',
          errorCode: 'TRIAL_PLATFORM_VISITOR_OWNER_MISMATCH',
        },
        HttpStatus.FORBIDDEN,
      );
    }

    this.assertEmbedDomainGateForBot(
      bot as {
        allowedDomains?: unknown;
        widgetEmbedRateLimitPerMinute?: unknown;
        websiteURLAllowlist?: unknown;
      },
      req,
      { creatorType, platformVisitorId: resolvedPlatformVisitorId },
    );

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
    /** @deprecated Chat identity alias only — see {@link resolveEmbedChatVisitorIdFromBody}. */
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
    const embedOrigin = typeof o.embedOrigin === 'string' ? o.embedOrigin.trim() : '';
    const platformVisitorId = typeof o.platformVisitorId === 'string' ? o.platformVisitorId.trim() : '';
    return {
      botId,
      conversationId,
      ...(chatVisitorId ? { chatVisitorId } : {}),
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

    const creatorType = bot.creatorType === 'visitor' ? 'visitor' : 'user';
    const botType = String((bot as { type?: string }).type ?? '');
    const resolvedPlatformVisitorId = resolveRuntimeEmbedPlatformVisitorIdForChat({
      creatorType,
      platformVisitorId: parsed.platformVisitorId,
    });

    if (creatorType === 'visitor' && !resolvedPlatformVisitorId) {
      throw new HttpException(
        { error: 'platformVisitorId is required for trial bots', errorCode: 'VISITOR_ID_REQUIRED' },
        HttpStatus.BAD_REQUEST,
      );
    }

    const embedIdentityErr = getEmbedRuntimePlatformIdentityViolation({
      botType,
      creatorType,
      resolvedPlatformVisitorId,
    });
    if (!embedIdentityErr.ok) {
      throw new HttpException(
        { error: embedIdentityErr.message, errorCode: embedIdentityErr.errorCode },
        HttpStatus.BAD_REQUEST,
      );
    }

    if (
      creatorType === 'visitor' &&
      !trialRuntimePlatformVisitorMatchesOwner({
        ownerVisitorId: (bot as { ownerVisitorId?: unknown }).ownerVisitorId,
        resolvedPlatformVisitorId,
      })
    ) {
      throw new HttpException(
        {
          error: 'platformVisitorId does not match this trial bot owner.',
          errorCode: 'TRIAL_PLATFORM_VISITOR_OWNER_MISMATCH',
        },
        HttpStatus.FORBIDDEN,
      );
    }

    this.assertEmbedDomainGateForBot(
      bot as {
        allowedDomains?: unknown;
        widgetEmbedRateLimitPerMinute?: unknown;
        websiteURLAllowlist?: unknown;
      },
      req,
      { creatorType, platformVisitorId: resolvedPlatformVisitorId },
    );

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

    const creatorType = bot.creatorType === 'visitor' ? 'visitor' : 'user';
    const botType = String((bot as { type?: string }).type ?? '');

    /** Platform identity: explicit `platformVisitorId` only (legacy `visitorId` is chat-only on this route). */
    const resolvedPlatformVisitorId = resolveRuntimeEmbedPlatformVisitorIdForChat({
      creatorType,
      platformVisitorId: parsed.platformVisitorId,
    });

    if (creatorType === 'visitor' && !resolvedPlatformVisitorId) {
      throw new HttpException(
        { error: 'platformVisitorId is required for trial bots', errorCode: 'VISITOR_ID_REQUIRED' },
        HttpStatus.BAD_REQUEST,
      );
    }

    const embedIdentityErr = getEmbedRuntimePlatformIdentityViolation({
      botType,
      creatorType,
      resolvedPlatformVisitorId,
    });
    if (!embedIdentityErr.ok) {
      throw new HttpException(
        { error: embedIdentityErr.message, errorCode: embedIdentityErr.errorCode },
        HttpStatus.BAD_REQUEST,
      );
    }

    if (
      creatorType === 'visitor' &&
      !trialRuntimePlatformVisitorMatchesOwner({
        ownerVisitorId: (bot as { ownerVisitorId?: unknown }).ownerVisitorId,
        resolvedPlatformVisitorId,
      })
    ) {
      throw new HttpException(
        {
          error: 'platformVisitorId does not match this trial bot owner.',
          errorCode: 'TRIAL_PLATFORM_VISITOR_OWNER_MISMATCH',
        },
        HttpStatus.FORBIDDEN,
      );
    }

    this.assertEmbedDomainGateForBot(
      bot as {
        allowedDomains?: unknown;
        widgetEmbedRateLimitPerMinute?: unknown;
        websiteURLAllowlist?: unknown;
      },
      req,
      { creatorType, platformVisitorId: resolvedPlatformVisitorId },
    );

    if (creatorType === 'visitor' && resolvedPlatformVisitorId) {
      await this.visitorsService.getOrCreateVisitor(resolvedPlatformVisitorId);
    }

    const pvPolicy = String(resolvedPlatformVisitorId ?? '').trim();
    if (pvPolicy && pvPolicy !== PLATFORM_VISITOR_EMBED_ANONYMOUS_SENTINEL) {
      await this.visitorsService.getOrCreateVisitor(pvPolicy);
      const originHeader = resolveRuntimeEmbedOriginFromHeaders(req.headers);
      /** Per-visitor website URL allowlist applies to authenticated users' bots only, not trial bots. */
      if (creatorType !== 'visitor') {
        try {
          assertPlatformVisitorWebsiteMatchesBotAllowlist({
            bot: bot as { websiteURLAllowlist?: unknown },
            platformVisitorId: pvPolicy,
            requestOrigin: originHeader ?? undefined,
          });
        } catch (err) {
          const code = err instanceof Error ? err.message : '';
          if (code === 'PLATFORM_EMBED_ORIGIN_REQUIRED') {
            throw new HttpException(
              { error: 'Origin header is required when using platformVisitorId', errorCode: 'PLATFORM_EMBED_ORIGIN_REQUIRED' },
              HttpStatus.FORBIDDEN,
            );
          }
          if (code === 'PLATFORM_VISITOR_NOT_IN_BOT_ALLOWLIST') {
            throw new HttpException(
              {
                error:
                  'This platform visitor id is not listed in this bot website allowlist (superadmin must add it with the correct website URL).',
                errorCode: 'PLATFORM_VISITOR_NOT_IN_BOT_ALLOWLIST',
              },
              HttpStatus.FORBIDDEN,
            );
          }
          if (code === 'PLATFORM_VISITOR_WEBSITE_ORIGIN_MISMATCH') {
            throw new HttpException(
              {
                error: 'This site does not match the website URL configured for this platform visitor on this bot.',
                errorCode: 'PLATFORM_VISITOR_WEBSITE_ORIGIN_MISMATCH',
              },
              HttpStatus.FORBIDDEN,
            );
          }
          throw err;
        }
      }
      /** Trial bots: 30 user messages at runtime (embed) across all trial bots for this platform visitor. */
      if (creatorType === 'visitor') {
        const quota = await this.visitorsService.checkTrialVisitorRuntimeMessageQuota(pvPolicy);
        if (!quota.allowed) {
          throw new HttpException(
            {
              error: 'Trial message limit reached for this visitor (runtime embed).',
              errorCode: 'PLATFORM_VISITOR_MESSAGE_QUOTA_EXCEEDED',
              current: quota.current,
              limit: quota.limit,
            },
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }
      } else if (botType === 'showcase' && creatorType === 'user') {
        /** Showcase bots: 30 user messages at runtime (embed) for this platform visitor. */
        const quota = await this.visitorsService.checkShowcaseRuntimeMessageQuota(pvPolicy);
        if (!quota.allowed) {
          throw new HttpException(
            {
              error: 'Showcase message limit reached for this visitor (runtime embed).',
              errorCode: 'SHOWCASE_RUNTIME_MESSAGE_QUOTA_EXCEEDED',
              current: quota.current,
              limit: quota.limit,
            },
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }
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
      visitorMultiChatEnabled:
        (b.visitorMultiChatEnabled as boolean | undefined) === true ? true : undefined,
      visitorMultiChatMax: normalizeVisitorMultiChatMax(b.visitorMultiChatMax),
    };

    const pvForEmbed =
      String(resolvedPlatformVisitorId ?? '').trim() &&
      String(resolvedPlatformVisitorId ?? '').trim() !== PLATFORM_VISITOR_EMBED_ANONYMOUS_SENTINEL
        ? String(resolvedPlatformVisitorId ?? '').trim()
        : undefined;

    const chatResult = await this.chatEngineService.runChat({
      bot: botLike,
      chatVisitorId: resolvedChatVisitorId,
      platformVisitorId:
        creatorType === 'visitor' ? resolvedPlatformVisitorId : pvForEmbed,
      countTowardTrialRuntimeQuota: creatorType === 'visitor',
      countTowardShowcaseRuntimeQuota:
        botType === 'showcase' && creatorType === 'user' && !!pvForEmbed,
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
