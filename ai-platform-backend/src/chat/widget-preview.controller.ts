import { Body, Controller, HttpException, HttpStatus, Post, Req } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { FastifyRequest } from 'fastify';
import { getRequestId } from '../lib/request-id.helper';
import { AuthService } from '../auth/shared/auth.service';
import { resolveUserFromPlatformCookieHeader } from '../auth/shared/platform-session.resolve';
import { BotsService } from '../bots/bots.service';
import { VisitorsService } from '../visitors/visitors.service';
import { ChatEngineService } from './chat-engine.service';
import type { BotLike } from './chat-engine.types';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { normalizeVisitorMultiChatMax } from '../bots/visitor-multi-chat.util';
import { resolveEmbedChatVisitorIdFromBody } from '../bots/widget-embed-identity.util';
import { isPreviewRequestOriginAllowed } from '../bots/preview-origin.util';

type PreviewOverrides = {
  botName?: string;
  avatarUrl?: string;
  avatarEmoji?: string;
  tagline?: string;
  description?: string;
  welcomeMessage?: string;
  suggestedQuestions?: string[];
  brandingMessage?: string;
  privacyText?: string;
  launcherPosition?: 'bottom-left' | 'bottom-right';
  chatUI?: Record<string, unknown>;
  leadCapture?: BotLike['leadCapture'];
  personality?: BotLike['personality'];
  config?: BotLike['config'];
};

type PreviewInitBody = {
  botId?: unknown;
  accessKey?: unknown;
  secretKey?: unknown;
  chatVisitorId?: unknown;
  authToken?: unknown;
  previewOverrides?: unknown;
};

type PreviewChatBody = PreviewInitBody & {
  message?: unknown;
  visitorId?: unknown;
  conversationId?: unknown;
  startNewConversation?: boolean;
};

function toNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const s = value.trim();
  return s ? s : undefined;
}

function getBearerToken(request: FastifyRequest): string | undefined {
  const authHeader = request.headers.authorization;
  if (!authHeader) return undefined;
  const prefix = 'Bearer ';
  if (!authHeader.startsWith(prefix)) return undefined;
  return toNonEmptyString(authHeader.slice(prefix.length));
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function mergePlainRecords(
  base: Record<string, unknown>,
  override: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [key, val] of Object.entries(override)) {
    if (val === undefined) continue;
    const prev = out[key];
    if (isPlainRecord(prev) && isPlainRecord(val)) {
      out[key] = mergePlainRecords(prev, val);
      continue;
    }
    out[key] = val;
  }
  return out;
}

function parsePreviewOverrides(input: unknown): PreviewOverrides | undefined {
  if (!isPlainRecord(input)) return undefined;
  return {
    ...(toNonEmptyString(input.botName) ? { botName: toNonEmptyString(input.botName) } : {}),
    ...(toNonEmptyString(input.avatarUrl) ? { avatarUrl: toNonEmptyString(input.avatarUrl) } : {}),
    ...(toNonEmptyString(input.avatarEmoji) ? { avatarEmoji: toNonEmptyString(input.avatarEmoji) } : {}),
    ...(toNonEmptyString(input.tagline) ? { tagline: toNonEmptyString(input.tagline) } : {}),
    ...(toNonEmptyString(input.description) ? { description: toNonEmptyString(input.description) } : {}),
    ...(toNonEmptyString(input.welcomeMessage)
      ? { welcomeMessage: toNonEmptyString(input.welcomeMessage) }
      : {}),
    ...(Array.isArray(input.suggestedQuestions)
      ? {
          suggestedQuestions: input.suggestedQuestions
            .map((v) => toNonEmptyString(v))
            .filter((v): v is string => typeof v === 'string')
            .slice(0, 6),
        }
      : {}),
    ...(toNonEmptyString(input.brandingMessage)
      ? { brandingMessage: toNonEmptyString(input.brandingMessage) }
      : {}),
    ...(toNonEmptyString(input.privacyText) ? { privacyText: toNonEmptyString(input.privacyText) } : {}),
    ...(input.launcherPosition === 'bottom-left' || input.launcherPosition === 'bottom-right'
      ? { launcherPosition: input.launcherPosition }
      : {}),
    ...(isPlainRecord(input.chatUI) ? { chatUI: input.chatUI } : {}),
    ...(isPlainRecord(input.leadCapture) ? { leadCapture: input.leadCapture as BotLike['leadCapture'] } : {}),
    ...(isPlainRecord(input.personality) ? { personality: input.personality as BotLike['personality'] } : {}),
    ...(isPlainRecord(input.config) ? { config: input.config as BotLike['config'] } : {}),
  };
}

function parseInitBody(
  body: unknown,
): {
  botId: string;
  accessKey?: string;
  secretKey?: string;
  chatVisitorId?: string;
  authToken?: string;
  previewOverrides?: PreviewOverrides;
} | null {
  if (!isPlainRecord(body)) return null;
  const botId = toNonEmptyString((body as PreviewInitBody).botId);
  if (!botId) return null;
  const accessKey = toNonEmptyString((body as PreviewInitBody).accessKey);
  const secretKey = toNonEmptyString((body as PreviewInitBody).secretKey);
  const chatVisitorId = toNonEmptyString((body as PreviewInitBody).chatVisitorId);
  const authToken = toNonEmptyString((body as PreviewInitBody).authToken);
  const previewOverrides = parsePreviewOverrides((body as PreviewInitBody).previewOverrides);
  return {
    botId,
    ...(accessKey ? { accessKey } : {}),
    ...(secretKey ? { secretKey } : {}),
    ...(chatVisitorId ? { chatVisitorId } : {}),
    ...(authToken ? { authToken } : {}),
    ...(previewOverrides ? { previewOverrides } : {}),
  };
}

function parseChatBody(
  body: unknown,
): {
  botId: string;
  message: string;
  accessKey?: string;
  secretKey?: string;
  chatVisitorId?: string;
  visitorId?: string;
  authToken?: string;
  previewOverrides?: PreviewOverrides;
  conversationId?: string;
  startNewConversation?: boolean;
} | null {
  if (!isPlainRecord(body)) return null;
  const parsed = parseInitBody(body);
  if (!parsed) return null;
  const message = toNonEmptyString((body as PreviewChatBody).message);
  if (!message) return null;
  const visitorId = toNonEmptyString((body as PreviewChatBody).visitorId);
  const conversationId = toNonEmptyString((body as Record<string, unknown>).conversationId);
  const startNewConversation = (body as Record<string, unknown>).startNewConversation === true;
  return {
    ...parsed,
    message,
    ...(visitorId ? { visitorId } : {}),
    ...(conversationId ? { conversationId } : {}),
    ...(startNewConversation ? { startNewConversation: true } : {}),
  };
}

function normalizeObjectIdString(value: unknown): string {
  return String(value ?? '').trim();
}

/** Stable preview chat visitor id (never equal to platform visitor id). */
function previewAuthenticatedChatVisitorId(userId: string): string {
  const id = userId.trim() || 'owner';
  return `pa_${id}`;
}

@Controller('api/widget/preview')
export class WidgetPreviewController {
  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
    private readonly botsService: BotsService,
    private readonly visitorsService: VisitorsService,
    private readonly chatEngineService: ChatEngineService,
    private readonly workspacesService: WorkspacesService,
  ) {}

  private assertPreviewOriginAllowed(request: FastifyRequest): void {
    const nodeEnv = this.configService.get<string>('nodeEnv') ?? 'development';
    if (!isPreviewRequestOriginAllowed(request.headers, nodeEnv)) {
      const devHint = nodeEnv === 'development' ? ' In development, localhost is also allowed.' : '';
      throw new HttpException(
        {
          error: `Preview is only allowed from Assistrio app origins (exact match).${devHint}`,
          status: 'error' as const,
          errorCode: 'PREVIEW_ORIGIN_NOT_ALLOWED',
        },
        HttpStatus.FORBIDDEN,
      );
    }
  }

  private async resolveAuthenticatedUser(
    request: FastifyRequest,
    bodyAuthToken?: string,
  ): Promise<{ _id: unknown; email: string; role: string } | null> {
    const bearerToken = getBearerToken(request);
    const explicitToken = bodyAuthToken ?? bearerToken;
    if (explicitToken) {
      const user = await this.authService.getAuthenticatedUser(explicitToken);
      if (!user) return null;
      const u = user as unknown as { _id: unknown; email: string; role: string };
      return { _id: u._id, email: u.email, role: u.role };
    }
    const fromCookies = await resolveUserFromPlatformCookieHeader(
      this.authService,
      request.headers.cookie,
    );
    if (!fromCookies) return null;
    const u = fromCookies as unknown as { _id: unknown; email: string; role: string };
    return { _id: u._id, email: u.email, role: u.role };
  }

  private async verifyPreviewOwnerOrThrow(
    request: FastifyRequest,
    bot: Record<string, unknown>,
    authToken?: string,
  ): Promise<string> {
    const user = await this.resolveAuthenticatedUser(request, authToken);
    if (!user) {
      throw new HttpException(
        { error: 'Authentication required for preview mode.', errorCode: 'PREVIEW_UNAUTHORIZED' },
        HttpStatus.UNAUTHORIZED,
      );
    }
    const userId = normalizeObjectIdString(user._id);
    const allowed = this.workspacesService.canUserPreviewBotAsOwner(userId, user.role, bot);
    if (!allowed) {
      throw new HttpException(
        {
          error: 'Preview is only available to the bot owner. Sign in as the account that owns this agent.',
          errorCode: 'PREVIEW_FORBIDDEN',
        },
        HttpStatus.FORBIDDEN,
      );
    }
    return userId || 'owner';
  }

  private buildInitResponse(
    bot: Record<string, unknown>,
    previewOverrides?: PreviewOverrides,
  ): {
    status: 'ok';
    bot: {
      id: string;
      name: string;
      imageUrl?: string;
      avatarEmoji?: string;
      tagline?: string;
      description?: string;
      welcomeMessage?: string;
      suggestedQuestions: string[];
      exampleQuestions: string[];
    };
    settings: {
      chatUI: Record<string, unknown>;
      brandingMessage?: string;
      privacyText?: string;
      visitorMultiChatEnabled?: boolean;
      visitorMultiChatMax?: number | null;
    };
  } {
    const baseChatUI =
      isPlainRecord(bot.chatUI) ? (bot.chatUI as Record<string, unknown>) : {};
    const mergedChatUI = previewOverrides?.chatUI
      ? mergePlainRecords(baseChatUI, previewOverrides.chatUI)
      : baseChatUI;
    if (previewOverrides?.launcherPosition) {
      mergedChatUI.launcherPosition = previewOverrides.launcherPosition;
    }

    const savedSuggestedQuestions = Array.isArray(bot.exampleQuestions)
      ? (bot.exampleQuestions as unknown[])
          .map((q) => toNonEmptyString(q))
          .filter((q): q is string => typeof q === 'string')
          .slice(0, 6)
      : [];
    const suggestedQuestions = Array.isArray(previewOverrides?.suggestedQuestions)
      ? previewOverrides.suggestedQuestions
      : savedSuggestedQuestions;

    const brandingMessage =
      toNonEmptyString(previewOverrides?.brandingMessage) ??
      toNonEmptyString(mergedChatUI.brandingMessage);
    const privacyText =
      toNonEmptyString(previewOverrides?.privacyText) ?? toNonEmptyString(mergedChatUI.privacyText);

    const visitorMultiChatEnabled = (bot as { visitorMultiChatEnabled?: unknown }).visitorMultiChatEnabled === true;
    const visitorMultiChatMax = normalizeVisitorMultiChatMax(
      (bot as { visitorMultiChatMax?: unknown }).visitorMultiChatMax,
    );

    return {
      status: 'ok',
      bot: {
        id: String(bot._id ?? ''),
        name: toNonEmptyString(previewOverrides?.botName) ?? String(bot.name ?? ''),
        imageUrl:
          toNonEmptyString(previewOverrides?.avatarUrl) ?? toNonEmptyString(bot.imageUrl),
        avatarEmoji:
          toNonEmptyString(previewOverrides?.avatarEmoji) ?? toNonEmptyString(bot.avatarEmoji),
        tagline:
          toNonEmptyString(previewOverrides?.tagline) ?? toNonEmptyString(bot.shortDescription),
        description:
          toNonEmptyString(previewOverrides?.description) ?? toNonEmptyString(bot.description),
        welcomeMessage:
          toNonEmptyString(previewOverrides?.welcomeMessage) ??
          toNonEmptyString(bot.welcomeMessage),
        suggestedQuestions,
        exampleQuestions: suggestedQuestions,
      },
      settings: {
        chatUI: mergedChatUI,
        ...(brandingMessage ? { brandingMessage } : {}),
        ...(privacyText ? { privacyText } : {}),
        visitorMultiChatEnabled,
        visitorMultiChatMax,
      },
    };
  }

  private buildPreviewBotLike(bot: Record<string, unknown>, previewOverrides?: PreviewOverrides): BotLike {
    const mergedLeadCapture =
      isPlainRecord(bot.leadCapture) && isPlainRecord(previewOverrides?.leadCapture)
        ? (mergePlainRecords(
            bot.leadCapture as Record<string, unknown>,
            previewOverrides?.leadCapture as Record<string, unknown>,
          ) as BotLike['leadCapture'])
        : (previewOverrides?.leadCapture ?? (bot.leadCapture as BotLike['leadCapture']));
    const mergedPersonality =
      isPlainRecord(bot.personality) && isPlainRecord(previewOverrides?.personality)
        ? (mergePlainRecords(
            bot.personality as Record<string, unknown>,
            previewOverrides?.personality as Record<string, unknown>,
          ) as BotLike['personality'])
        : (previewOverrides?.personality ?? (bot.personality as BotLike['personality']));
    const mergedConfig =
      isPlainRecord(bot.config) && isPlainRecord(previewOverrides?.config)
        ? (mergePlainRecords(
            bot.config as Record<string, unknown>,
            previewOverrides?.config as Record<string, unknown>,
          ) as BotLike['config'])
        : (previewOverrides?.config ?? (bot.config as BotLike['config']));

    return {
      _id: (bot._id as { toString(): string }),
      name: toNonEmptyString(previewOverrides?.botName) ?? String(bot.name ?? ''),
      shortDescription:
        toNonEmptyString(previewOverrides?.tagline) ?? (toNonEmptyString(bot.shortDescription) ?? ''),
      description:
        toNonEmptyString(previewOverrides?.description) ?? (toNonEmptyString(bot.description) ?? ''),
      category: toNonEmptyString(bot.category) ?? '',
      openaiApiKeyOverride: toNonEmptyString(bot.openaiApiKeyOverride),
      welcomeMessage:
        toNonEmptyString(previewOverrides?.welcomeMessage) ??
        (toNonEmptyString(bot.welcomeMessage) ?? ''),
      knowledgeDescription: toNonEmptyString(bot.knowledgeDescription) ?? '',
      leadCapture: mergedLeadCapture,
      personality: mergedPersonality,
      config: mergedConfig,
      faqs: (bot.faqs as BotLike['faqs']) ?? undefined,
      visitorMultiChatEnabled:
        (bot as { visitorMultiChatEnabled?: unknown }).visitorMultiChatEnabled === true ? true : undefined,
      visitorMultiChatMax: normalizeVisitorMultiChatMax((bot as { visitorMultiChatMax?: unknown }).visitorMultiChatMax),
    };
  }

  @Post('init')
  async init(@Body() body: unknown, @Req() request: FastifyRequest) {
    this.assertPreviewOriginAllowed(request);
    const parsed = parseInitBody(body);
    if (!parsed) {
      throw new HttpException(
        { error: 'Invalid request body', status: 'error', errorCode: 'BAD_REQUEST' },
        HttpStatus.BAD_REQUEST,
      );
    }

    const bot = await this.botsService.findOneByIdForExternalRuntime(parsed.botId);
    if (!bot) {
      throw new HttpException(
        {
          error: 'Bot not found',
          status: 'error',
          errorCode: 'BOT_NOT_FOUND',
        },
        HttpStatus.NOT_FOUND,
      );
    }

    await this.verifyPreviewOwnerOrThrow(request, bot as Record<string, unknown>, parsed.authToken);

    const chatVisitorId =
      parsed.chatVisitorId && parsed.chatVisitorId.trim()
        ? parsed.chatVisitorId
        : `c_${randomUUID().replace(/-/g, '')}`;

    try {
      await this.visitorsService.getOrCreateChatVisitor(chatVisitorId);
    } catch (err) {
      console.error('[widget/preview/init] getOrCreateChatVisitor failed', err);
    }

    return { ...this.buildInitResponse(bot, parsed.previewOverrides), chatVisitorId };
  }

  @Post('chat')
  async chat(@Body() body: unknown, @Req() request: FastifyRequest) {
    this.assertPreviewOriginAllowed(request);
    const parsed = parseChatBody(body);
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

    const ownerUserId = await this.verifyPreviewOwnerOrThrow(request, bot as Record<string, unknown>, parsed.authToken);

    let chatVisitorResolved = resolveEmbedChatVisitorIdFromBody(parsed.chatVisitorId, parsed.visitorId)?.trim();
    if (!chatVisitorResolved) {
      chatVisitorResolved = previewAuthenticatedChatVisitorId(ownerUserId);
    }
    try {
      await this.visitorsService.getOrCreateChatVisitor(chatVisitorResolved);
    } catch (err) {
      console.error('[widget/preview/chat] getOrCreateChatVisitor failed', err);
    }

    const previewQuotaUserId = String(ownerUserId ?? '').trim();
    if (previewQuotaUserId) {
      await this.visitorsService.ensureOwnerPreviewVisitor(previewQuotaUserId);
      const previewQuota = await this.visitorsService.checkOwnerPreviewMessageQuota(previewQuotaUserId);
      if (!previewQuota.allowed) {
        throw new HttpException(
          {
            error: 'Preview message limit reached for this account.',
            errorCode: 'PREVIEW_MESSAGE_QUOTA_EXCEEDED',
            current: previewQuota.current,
            limit: previewQuota.limit,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    const botLike = this.buildPreviewBotLike(bot, parsed.previewOverrides);
    const result = await this.chatEngineService.runChat({
      bot: botLike,
      chatVisitorId: chatVisitorResolved,
      message: parsed.message,
      mode: 'user',
      requestId: getRequestId(request),
      debug: false,
      ephemeral: true,
      ...(parsed.conversationId ? { conversationId: parsed.conversationId } : {}),
      ...(parsed.startNewConversation ? { startNewConversation: true } : {}),
    });
    if (!result.ok) {
      throw new HttpException(result, HttpStatus.BAD_REQUEST);
    }

    if (previewQuotaUserId) {
      await this.visitorsService.incrementOwnerPreviewMessageCount(previewQuotaUserId);
    }

    return {
      ok: true,
      conversationId: result.conversationId,
      assistantMessage: result.assistantMessage,
      sources: result.sources,
    };
  }
}
