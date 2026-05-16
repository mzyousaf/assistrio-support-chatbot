import { Controller, HttpException, HttpStatus, Post, Req } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { FastifyRequest } from 'fastify';
import { Types } from 'mongoose';
import { getRequestId } from '../lib/request-id.helper';
import {
  buildAnalyticsRequestMetaForChat,
  parseAnalyticsContextFromUnknown,
} from './conversation-analytics-location-device.util';
import { parseMessageAnalyticsFromUnknown } from './message-input-analytics.util';
import { AuthService } from '../auth/shared/auth.service';
import { resolveUserFromPlatformCookieHeader } from '../auth/shared/platform-session.resolve';
import { BotsService } from '../bots/bots.service';
import { VisitorsService } from '../visitors/visitors.service';
import { ChatEngineService } from './chat-engine.service';
import type { AnalyticsContextPayload, BotLike } from './chat-engine.types';
import { exampleQuestionsToPublicLabels } from '../workspace/shared/example-questions.util';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { normalizeVisitorMultiChatMax } from '../bots/visitor-multi-chat.util';
import { resolveEmbedChatVisitorIdFromBody } from '../bots/widget-embed-identity.util';
import { isPreviewRequestOriginAllowed } from '../bots/preview-origin.util';
import {
  consumeEmbedRuntimeRateLimitToken,
  EMBED_PREVIEW_RATE_LIMIT_KEY_PREFIX,
  EMBED_RUNTIME_RATE_LIMIT_WINDOW_MS,
  getClientIpForRateLimit,
} from '../bots/embed-runtime-rate-limit.util';
import { resolveWidgetEmbedRateLimitPerMinute } from '../models/bot.schema';
import { throwEmbedRuntimeIpRateLimited } from '../rate-limit/rate-limit-http-exception.util';
import { isWelcomeMessageActive } from '../bots/welcome-message-display.util';
import { normalizeSpeechInputFromBody } from './speech-input.normalize';
import { WidgetSpeechService } from './widget-speech.service';
import {
  assertEmbedChatHasUserTurn,
  parseEmbedChatMultipartRequest,
  uploadWidgetChatAttachments,
} from './widget-embed-chat-multipart.util';
import type { MessageAttachment, MessageSpeechInput } from '../models/message.schema';
import { KnowledgeBaseItemService } from '../knowledge/knowledge-base-item.service';
import {
  mergeSanitizedConversationOrigins,
  parseConversationOriginFromUnknown,
  resolvePageUrlFromSourcePage,
} from './conversation-analytics-origin.util';
import type { ConversationOriginPayload } from './chat-engine.types';

type PreviewOverrides = {
  botName?: string;
  avatarUrl?: string;
  avatarEmoji?: string;
  tagline?: string;
  description?: string;
  welcomeMessage?: string;
  welcomeMessageEnabled?: boolean;
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
  previewContext?: unknown;
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
    ...(typeof input.welcomeMessageEnabled === 'boolean' ? { welcomeMessageEnabled: input.welcomeMessageEnabled } : {}),
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

type PreviewListMessagesBody = {
  botId: string;
  conversationId: string;
  authToken?: string;
  chatVisitorId?: string;
  visitorId?: string;
};

function parsePreviewListMessagesBody(body: unknown): PreviewListMessagesBody | null {
  if (body == null || typeof body !== 'object') return null;
  const o = body as Record<string, unknown>;
  const botId = typeof o.botId === 'string' ? o.botId.trim() : '';
  const conversationId = typeof o.conversationId === 'string' ? o.conversationId.trim() : '';
  if (!botId || !conversationId) return null;
  const authToken = toNonEmptyString((o as { authToken?: unknown }).authToken);
  const chatVisitorId = toNonEmptyString((o as { chatVisitorId?: unknown }).chatVisitorId);
  const visitorId = toNonEmptyString((o as { visitorId?: unknown }).visitorId);
  return {
    botId,
    conversationId,
    ...(authToken ? { authToken } : {}),
    ...(chatVisitorId ? { chatVisitorId } : {}),
    ...(visitorId ? { visitorId } : {}),
  };
}

function parseChatBody(
  body: unknown,
  opts?: { allowEmptyMessage?: boolean },
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
  speechInput?: MessageSpeechInput;
  previewContext?: { sourcePage?: string };
  conversationOrigin?: ConversationOriginPayload;
  suggestionId?: string;
  analyticsContext?: AnalyticsContextPayload;
  messageAnalytics?: ReturnType<typeof parseMessageAnalyticsFromUnknown>;
} | null {
  if (!isPlainRecord(body)) return null;
  const parsed = parseInitBody(body);
  if (!parsed) return null;
  const messageField = (body as PreviewChatBody).message;
  const messageRaw = typeof messageField === 'string' ? messageField.trim() : '';
  if (!messageRaw && !opts?.allowEmptyMessage) return null;
  const visitorId = toNonEmptyString((body as PreviewChatBody).visitorId);
  const conversationId = toNonEmptyString((body as Record<string, unknown>).conversationId);
  const startNewConversation = (body as Record<string, unknown>).startNewConversation === true;
  const speechInput = normalizeSpeechInputFromBody((body as Record<string, unknown>).speechInput);
  const previewContext = parsePreviewContextField(body);
  const conversationOrigin = parseConversationOriginFromUnknown(
    (body as Record<string, unknown>).conversationOrigin,
  );
  const suggestionId = toNonEmptyString((body as Record<string, unknown>).suggestionId);
  const analyticsContext = parseAnalyticsContextFromUnknown((body as Record<string, unknown>).analyticsContext);
  const messageAnalytics = parseMessageAnalyticsFromUnknown((body as Record<string, unknown>).messageAnalytics);
  return {
    ...parsed,
    message: messageRaw,
    ...(visitorId ? { visitorId } : {}),
    ...(conversationId ? { conversationId } : {}),
    ...(startNewConversation ? { startNewConversation: true } : {}),
    ...(speechInput ? { speechInput } : {}),
    ...(previewContext ? { previewContext } : {}),
    ...(conversationOrigin ? { conversationOrigin } : {}),
    ...(suggestionId ? { suggestionId } : {}),
    ...(analyticsContext ? { analyticsContext } : {}),
    ...(messageAnalytics ? { messageAnalytics } : {}),
  };
}

function normalizeObjectIdString(value: unknown): string {
  return String(value ?? '').trim();
}

function parsePreviewContextField(body: unknown): { sourcePage?: string } | undefined {
  if (!isPlainRecord(body)) return undefined;
  const ctx = (body as { previewContext?: unknown }).previewContext;
  if (!isPlainRecord(ctx)) return undefined;
  const sp = toNonEmptyString((ctx as { sourcePage?: unknown }).sourcePage);
  if (!sp) return undefined;
  return { sourcePage: sp.slice(0, 512) };
}

function buildPlaygroundPreviewConversationOrigin(
  request: FastifyRequest,
  previewContext?: { sourcePage?: string },
  clientOrigin?: ConversationOriginPayload,
): Record<string, unknown> | undefined {
  const websiteOrigin = previewMessageOriginFromRequest(request);
  const pageFromClient = clientOrigin?.pageUrl?.trim();
  const pageFromSource = resolvePageUrlFromSourcePage(previewContext?.sourcePage, websiteOrigin);
  const refererRaw = request.headers.referer;
  const referrer =
    clientOrigin?.referrer?.trim() ||
    (typeof refererRaw === 'string' ? refererRaw.trim().slice(0, 2048) : undefined);
  return mergeSanitizedConversationOrigins(
    {
      source: 'playground_preview',
      mode: 'preview',
      embedType: 'playground',
    },
    clientOrigin,
    {
      ...(pageFromClient ? { pageUrl: pageFromClient } : {}),
      ...(pageFromSource && !pageFromClient ? { pageUrl: pageFromSource } : {}),
      ...(websiteOrigin ? { websiteOrigin } : {}),
      ...(referrer ? { referrer } : {}),
      ...(previewContext?.sourcePage?.trim() ? { surface: previewContext.sourcePage.trim() } : {}),
    },
  );
}

function previewMessageOriginFromRequest(request: FastifyRequest): string | undefined {
  const origin = toNonEmptyString(request.headers.origin);
  if (origin) return origin.slice(0, 256);
  const refererRaw = request.headers.referer;
  const referer = typeof refererRaw === 'string' ? toNonEmptyString(refererRaw) : undefined;
  if (!referer) return undefined;
  try {
    return new URL(referer).origin.slice(0, 256);
  } catch {
    return referer.slice(0, 256);
  }
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
    private readonly widgetSpeechService: WidgetSpeechService,
    private readonly knowledgeBaseItemService: KnowledgeBaseItemService,
  ) {}

  /**
   * Same token bucket as public embed: `widgetEmbedRateLimitPerMinute` (default 90), 60s window, per client IP.
   * Uses a separate key prefix from runtime so admin preview and live embed do not share one bucket.
   */
  private assertPreviewWidgetIpRateLimitOrThrow(request: FastifyRequest, bot: Record<string, unknown>): void {
    const limit = resolveWidgetEmbedRateLimitPerMinute(bot);
    const ip = getClientIpForRateLimit(request);
    if (!consumeEmbedRuntimeRateLimitToken(`${EMBED_PREVIEW_RATE_LIMIT_KEY_PREFIX}:${ip}`, limit)) {
      throwEmbedRuntimeIpRateLimited(EMBED_RUNTIME_RATE_LIMIT_WINDOW_MS);
    }
  }

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

  private async buildInitResponse(
    bot: Record<string, unknown>,
    previewOverrides?: PreviewOverrides,
  ): Promise<{
    status: 'ok';
    bot: {
      id: string;
      name: string;
      imageUrl?: string;
      avatarEmoji?: string;
      tagline?: string;
      description?: string;
      welcomeMessage?: string;
      welcomeMessageEnabled?: boolean;
      suggestedQuestions: string[];
      exampleQuestions: string[];
      suggestedQuestionChips: Array<{ label: string; suggestionId?: string }>;
    };
    settings: {
      chatUI: Record<string, unknown>;
      brandingMessage?: string;
      privacyText?: string;
      visitorMultiChatEnabled?: boolean;
      visitorMultiChatMax?: number | null;
    };
  }> {
    const baseChatUI =
      isPlainRecord(bot.chatUI) ? (bot.chatUI as Record<string, unknown>) : {};
    const mergedChatUI = previewOverrides?.chatUI
      ? mergePlainRecords(baseChatUI, previewOverrides.chatUI)
      : baseChatUI;
    if (previewOverrides?.launcherPosition) {
      mergedChatUI.launcherPosition = previewOverrides.launcherPosition;
    }

    const savedSuggestedQuestions = exampleQuestionsToPublicLabels(bot.exampleQuestions);
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

    const baseWelcomeText = toNonEmptyString(bot.welcomeMessage);
    const baseWelcomeOn = (bot as { welcomeMessageEnabled?: boolean }).welcomeMessageEnabled !== false;
    const o = previewOverrides;
    const overrideWelcomeText =
      o && 'welcomeMessage' in o ? toNonEmptyString(o.welcomeMessage) : undefined;
    const overrideWelcomeOn =
      o && typeof o.welcomeMessageEnabled === 'boolean' ? o.welcomeMessageEnabled : undefined;
    const mergedWelcomeText =
      overrideWelcomeText !== undefined ? overrideWelcomeText : baseWelcomeText;
    const mergedWelcomeOn =
      overrideWelcomeOn !== undefined ? overrideWelcomeOn !== false : baseWelcomeOn;
    const showWelcome = isWelcomeMessageActive({
      welcomeMessage: mergedWelcomeText,
      welcomeMessageEnabled: mergedWelcomeOn,
    });

    const botIdStr = String(bot._id ?? '');
    const baseChips = await this.knowledgeBaseItemService.getPublicSuggestionChipsForBot(botIdStr);
    const suggestedQuestionChips = suggestedQuestions.map((label) => {
      const found = baseChips.find((c) => c.label === label);
      return {
        label,
        ...(found?.suggestionId ? { suggestionId: found.suggestionId } : {}),
        ...(found?.hideChipTextInChat === true ? { hideChipTextInChat: true } : {}),
      };
    });

    return {
      status: 'ok',
      bot: {
        id: botIdStr,
        name: toNonEmptyString(previewOverrides?.botName) ?? String(bot.name ?? ''),
        imageUrl:
          toNonEmptyString(previewOverrides?.avatarUrl) ?? toNonEmptyString(bot.imageUrl),
        avatarEmoji:
          toNonEmptyString(previewOverrides?.avatarEmoji) ?? toNonEmptyString(bot.avatarEmoji),
        tagline:
          toNonEmptyString(previewOverrides?.tagline) ?? toNonEmptyString(bot.shortDescription),
        description:
          toNonEmptyString(previewOverrides?.description) ?? toNonEmptyString(bot.description),
        welcomeMessage: showWelcome ? mergedWelcomeText : undefined,
        welcomeMessageEnabled: mergedWelcomeOn,
        suggestedQuestions,
        exampleQuestions: suggestedQuestions,
        suggestedQuestionChips,
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

    const mergedWelcomeText =
      previewOverrides && 'welcomeMessage' in previewOverrides
        ? toNonEmptyString(previewOverrides.welcomeMessage) ?? ''
        : (toNonEmptyString(bot.welcomeMessage) ?? '');
    const mergedWelcomeOn =
      previewOverrides && typeof previewOverrides.welcomeMessageEnabled === 'boolean'
        ? previewOverrides.welcomeMessageEnabled
        : (bot as { welcomeMessageEnabled?: boolean }).welcomeMessageEnabled !== false;

    return {
      _id: (bot._id as { toString(): string }),
      ...(bot.workspaceId != null ? { workspaceId: String(bot.workspaceId) } : {}),
      ...(bot.ownerId != null ? { ownerId: String(bot.ownerId) } : {}),
      name: toNonEmptyString(previewOverrides?.botName) ?? String(bot.name ?? ''),
      shortDescription:
        toNonEmptyString(previewOverrides?.tagline) ?? (toNonEmptyString(bot.shortDescription) ?? ''),
      description:
        toNonEmptyString(previewOverrides?.description) ?? (toNonEmptyString(bot.description) ?? ''),
      category: toNonEmptyString(bot.category) ?? '',
      openaiApiKeyOverride: toNonEmptyString(bot.openaiApiKeyOverride),
      welcomeMessage: mergedWelcomeText,
      welcomeMessageEnabled: mergedWelcomeOn,
      knowledgeDescription: toNonEmptyString(bot.knowledgeDescription) ?? '',
      leadCapture: mergedLeadCapture,
      personality: mergedPersonality,
      config: mergedConfig,
      translationSettings: (bot.translationSettings as BotLike['translationSettings']) ?? undefined,
      faqs: (bot.faqs as BotLike['faqs']) ?? undefined,
      visitorMultiChatEnabled:
        (bot as { visitorMultiChatEnabled?: unknown }).visitorMultiChatEnabled === true ? true : undefined,
      visitorMultiChatMax: normalizeVisitorMultiChatMax((bot as { visitorMultiChatMax?: unknown }).visitorMultiChatMax),
      exampleQuestions: (bot as { exampleQuestions?: unknown }).exampleQuestions,
    };
  }

  @Post('init')
  async init(@Req() request: FastifyRequest) {
    this.assertPreviewOriginAllowed(request);
    const parsed = parseInitBody((request as { body?: unknown }).body);
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

    this.assertPreviewWidgetIpRateLimitOrThrow(request, bot as Record<string, unknown>);

    const ownerUserId = await this.verifyPreviewOwnerOrThrow(
      request,
      bot as Record<string, unknown>,
      parsed.authToken,
    );

    const chatVisitorId =
      parsed.chatVisitorId && parsed.chatVisitorId.trim()
        ? parsed.chatVisitorId
        : `c_${randomUUID().replace(/-/g, '')}`;

    try {
      await this.visitorsService.getOrCreateChatVisitor(chatVisitorId);
    } catch (err) {
      console.error('[widget/preview/init] getOrCreateChatVisitor failed', err);
    }

    return {
      ...(await this.buildInitResponse(bot, parsed.previewOverrides)),
      chatVisitorId,
    };
  }

  /** Load persisted thread for a preview session (same rows as /api/chat/conversations/messages, owner auth + `widget_preview` only). */
  @Post('conversations/messages')
  async conversationMessages(@Req() request: FastifyRequest) {
    this.assertPreviewOriginAllowed(request);
    const parsed = parsePreviewListMessagesBody((request as { body?: unknown }).body);
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

    this.assertPreviewWidgetIpRateLimitOrThrow(request, bot as Record<string, unknown>);

    await this.verifyPreviewOwnerOrThrow(request, bot as Record<string, unknown>, parsed.authToken);

    const resolvedChatVisitorId = resolveEmbedChatVisitorIdFromBody(
      parsed.chatVisitorId,
      parsed.visitorId,
    )?.trim();
    if (!resolvedChatVisitorId) {
      throw new HttpException(
        { error: 'chatVisitorId is required', errorCode: 'CHAT_VISITOR_ID_REQUIRED' },
        HttpStatus.BAD_REQUEST,
      );
    }

    const botOid = new Types.ObjectId(String((bot as { _id: unknown })._id));
    const messages = await this.chatEngineService.getConversationMessagesForEmbed({
      botOid,
      chatVisitorId: resolvedChatVisitorId,
      conversationId: parsed.conversationId,
      requireSessionSource: 'widget_preview',
    });
    if (!messages) {
      throw new HttpException(
        { error: 'Conversation not found', errorCode: 'CONVERSATION_NOT_FOUND' },
        HttpStatus.NOT_FOUND,
      );
    }

    return { ok: true, messages };
  }

  @Post('chat')
  async chat(@Req() request: FastifyRequest) {
    this.assertPreviewOriginAllowed(request);
    let parsed: NonNullable<ReturnType<typeof parseChatBody>> | null = null;
    let uploadedAttachments: MessageAttachment[] = [];

    if (typeof request.isMultipart === 'function' && request.isMultipart()) {
      const { payloadRecord, rawFiles } = await parseEmbedChatMultipartRequest(request);
      parsed = parseChatBody(payloadRecord, { allowEmptyMessage: true });
      if (!parsed) {
        throw new HttpException(
          { error: 'Invalid request body', errorCode: 'BAD_REQUEST' },
          HttpStatus.BAD_REQUEST,
        );
      }
      if (rawFiles.length > 0) {
        uploadedAttachments = await uploadWidgetChatAttachments(parsed.botId, rawFiles);
      }
      assertEmbedChatHasUserTurn(parsed.message, parsed.speechInput, uploadedAttachments);
    } else {
      parsed = parseChatBody((request as { body?: unknown }).body);
      if (!parsed) {
        throw new HttpException(
          { error: 'Invalid request body', errorCode: 'BAD_REQUEST' },
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    const bot = await this.botsService.findOneByIdForExternalRuntime(parsed.botId);
    if (!bot) {
      throw new HttpException({ error: 'Bot not found', errorCode: 'BOT_NOT_FOUND' }, HttpStatus.NOT_FOUND);
    }

    this.assertPreviewWidgetIpRateLimitOrThrow(request, bot as Record<string, unknown>);

    const mergedChatUiForUpload: Record<string, unknown> = {
      ...((bot as { chatUI?: Record<string, unknown> }).chatUI ?? {}),
      ...(typeof parsed.previewOverrides?.chatUI === 'object' && parsed.previewOverrides.chatUI
        ? (parsed.previewOverrides.chatUI as Record<string, unknown>)
        : {}),
    };
    if (uploadedAttachments.length > 0 && mergedChatUiForUpload.allowFileUpload !== true) {
      throw new HttpException(
        { error: 'File uploads are disabled for this bot.', errorCode: 'FILE_UPLOAD_DISABLED' },
        HttpStatus.FORBIDDEN,
      );
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

    const botLike = this.buildPreviewBotLike(bot, parsed.previewOverrides);
    const msgOrigin = previewMessageOriginFromRequest(request);
    const previewCtx: { sourcePage?: string; origin?: string } = {
      ...(parsed.previewContext?.sourcePage?.trim() ? { sourcePage: parsed.previewContext.sourcePage.trim() } : {}),
      ...(msgOrigin?.trim() ? { origin: msgOrigin.trim() } : {}),
    };
    // Persisted like embed runtime, tagged `sessionSource: 'widget_preview'` for analytics. Abuse
    // control uses the same per-IP limit as public embed (see `assertPreviewWidgetIpRateLimitOrThrow`).
    const result = await this.chatEngineService.runChat({
      bot: botLike,
      chatVisitorId: chatVisitorResolved,
      message: parsed.message,
      mode: 'user',
      requestId: getRequestId(request),
      debug: false,
      sessionSource: 'widget_preview',
      conversationOrigin: buildPlaygroundPreviewConversationOrigin(
        request,
        parsed.previewContext,
        parsed.conversationOrigin,
      ) as ConversationOriginPayload | undefined,
      ...(parsed.analyticsContext ? { analyticsContext: parsed.analyticsContext } : {}),
      analyticsRequestMeta: buildAnalyticsRequestMetaForChat(request),
      previewInitiatedByUserId: ownerUserId,
      ...(Object.keys(previewCtx).length > 0 ? { previewMessageContext: previewCtx } : {}),
      ...(parsed.conversationId ? { conversationId: parsed.conversationId } : {}),
      ...(parsed.startNewConversation ? { startNewConversation: true } : {}),
      ...(parsed.speechInput ? { speechInput: parsed.speechInput } : {}),
      ...(uploadedAttachments.length > 0 ? { attachments: uploadedAttachments } : {}),
      ...(parsed.suggestionId ? { suggestionId: parsed.suggestionId } : {}),
      ...(parsed.messageAnalytics ? { messageAnalytics: parsed.messageAnalytics } : {}),
    });
    if (!result.ok) {
      throw new HttpException(result, HttpStatus.BAD_REQUEST);
    }

    return {
      ok: true,
      conversationId: result.conversationId,
      assistantMessage: result.assistantMessage,
      assistantMessageId: result.assistantMessageId,
      sources: result.sources,
      ...(result.userAttachments?.length ? { userAttachments: result.userAttachments } : {}),
    };
  }

  @Post('speech')
  async speech(@Req() request: FastifyRequest) {
    this.assertPreviewOriginAllowed(request);
    const parsed = await this.widgetSpeechService.parseMultipart(request);
    const bot = await this.botsService.findOneByIdForExternalRuntime(parsed.botId);
    if (!bot) {
      throw new HttpException({ error: 'Bot not found', errorCode: 'BOT_NOT_FOUND' }, HttpStatus.NOT_FOUND);
    }
    this.assertPreviewWidgetIpRateLimitOrThrow(request, bot as Record<string, unknown>);
    await this.verifyPreviewOwnerOrThrow(request, bot as Record<string, unknown>, parsed.authToken);
    return this.widgetSpeechService.handlePreview(bot as Record<string, unknown>, parsed);
  }
}
