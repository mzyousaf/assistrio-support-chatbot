import { Body, Controller, HttpException, HttpStatus, Post, Req } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { FastifyRequest } from 'fastify';
import { getRequestId } from '../lib/request-id.helper';
import { AuthService } from '../auth/auth.service';
import { BotsService } from '../bots/bots.service';
import { ChatEngineService } from './chat-engine.service';
import type { BotLike } from './chat-engine.types';

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
  platformVisitorId?: unknown;
  chatVisitorId?: unknown;
  /**
   * @deprecated Legacy payload field (ambiguous).
   *
   * - On preview `init`: treated as `platformVisitorId` (ownership / preview authorization).
   * - On preview `chat`: treated as `chatVisitorId` (chat identity) for backward compatibility.
   */
  visitorId?: unknown;
  authToken?: unknown;
  previewOverrides?: unknown;
};

type PreviewChatBody = PreviewInitBody & {
  message?: unknown;
};

const COOKIE_NAME = 'user_token';

function toNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const s = value.trim();
  return s ? s : undefined;
}

function getCookieFromHeader(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(';').map((s) => s.trim());
  for (const part of parts) {
    const [name, ...valueParts] = part.split('=');
    if (name?.trim() === COOKIE_NAME && valueParts.length > 0) {
      return valueParts.join('=').trim();
    }
  }
  return null;
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
  platformVisitorId?: string;
  chatVisitorId?: string;
  authToken?: string;
  previewOverrides?: PreviewOverrides;
  /**
   * @deprecated Legacy field. Treated as `platformVisitorId` for preview `init`.
   * (For preview `chat`, the controller will treat it as `chatVisitorId`.)
   */
  visitorId?: string;
} | null {
  if (!isPlainRecord(body)) return null;
  const botId = toNonEmptyString((body as PreviewInitBody).botId);
  if (!botId) return null;
  const platformVisitorId = toNonEmptyString((body as PreviewInitBody).platformVisitorId);
  const chatVisitorId = toNonEmptyString((body as PreviewInitBody).chatVisitorId);
  // legacy mapping
  const visitorId = toNonEmptyString((body as PreviewInitBody).visitorId);
  const authToken = toNonEmptyString((body as PreviewInitBody).authToken);
  const previewOverrides = parsePreviewOverrides((body as PreviewInitBody).previewOverrides);
  return {
    botId,
    ...(platformVisitorId ? { platformVisitorId } : {}),
    ...(chatVisitorId ? { chatVisitorId } : {}),
    ...(visitorId ? { visitorId } : {}),
    ...(authToken ? { authToken } : {}),
    ...(previewOverrides ? { previewOverrides } : {}),
  };
}

function parseChatBody(
  body: unknown,
): {
  botId: string;
  message: string;
  platformVisitorId?: string;
  chatVisitorId?: string;
  visitorId?: string;
  authToken?: string;
  previewOverrides?: PreviewOverrides;
} | null {
  if (!isPlainRecord(body)) return null;
  const parsed = parseInitBody(body);
  if (!parsed) return null;
  const message = toNonEmptyString((body as PreviewChatBody).message);
  if (!message) return null;
  return { ...parsed, message };
}

function normalizeObjectIdString(value: unknown): string {
  return String(value ?? '').trim();
}

function hasAdminBypassRole(role: string | undefined): boolean {
  return role === 'admin' || role === 'superadmin';
}

@Controller('api/widget/preview')
export class WidgetPreviewController {
  constructor(
    private readonly authService: AuthService,
    private readonly botsService: BotsService,
    private readonly chatEngineService: ChatEngineService,
  ) {}

  private async resolveAuthenticatedUser(
    request: FastifyRequest,
    bodyAuthToken?: string,
  ): Promise<{ _id: unknown; email: string; role: string } | null> {
    const cookieToken = getCookieFromHeader(request.headers.cookie);
    const bearerToken = getBearerToken(request);
    const token = bodyAuthToken ?? bearerToken ?? cookieToken ?? undefined;
    if (!token) return null;
    const user = await this.authService.getAuthenticatedUser(token);
    if (!user) return null;
    const u = user as unknown as { _id: unknown; email: string; role: string };
    return { _id: u._id, email: u.email, role: u.role };
  }

  private async verifyPreviewOwnershipOrThrow(
    request: FastifyRequest,
    bot: Record<string, unknown>,
    authToken?: string,
  ): Promise<{ runtimeVisitorId: string }> {
    const user = await this.resolveAuthenticatedUser(request, authToken);
    if (!user) {
      throw new HttpException(
        { error: 'Authentication required for preview mode.', errorCode: 'PREVIEW_UNAUTHORIZED' },
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (hasAdminBypassRole(user.role)) {
      return { runtimeVisitorId: normalizeObjectIdString(user._id) || 'admin' };
    }

    const userId = normalizeObjectIdString(user._id);
    const ownerUserId = normalizeObjectIdString(bot.ownerUserId);
    const createdByUserId = normalizeObjectIdString(bot.createdByUserId);
    const isOwner = Boolean(userId && (ownerUserId === userId || createdByUserId === userId));
    if (!isOwner) {
      throw new HttpException(
        { error: 'Preview allowed only for bot owner.', errorCode: 'PREVIEW_FORBIDDEN' },
        HttpStatus.FORBIDDEN,
      );
    }

    return { runtimeVisitorId: userId || 'owner' };
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
    const privacyText = toNonEmptyString(previewOverrides?.privacyText);

    return {
      status: 'ok',
      bot: {
        id: String(bot._id ?? ''),
        name: toNonEmptyString(previewOverrides?.botName) ?? String(bot.name ?? ''),
        imageUrl:
          toNonEmptyString(previewOverrides?.avatarUrl) ??
          toNonEmptyString(bot.imageUrl),
        avatarEmoji:
          toNonEmptyString(previewOverrides?.avatarEmoji) ??
          toNonEmptyString(bot.avatarEmoji),
        tagline:
          toNonEmptyString(previewOverrides?.tagline) ??
          toNonEmptyString(bot.shortDescription),
        description:
          toNonEmptyString(previewOverrides?.description) ??
          toNonEmptyString(bot.description),
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
        toNonEmptyString(previewOverrides?.tagline) ??
        (toNonEmptyString(bot.shortDescription) ?? ''),
      description:
        toNonEmptyString(previewOverrides?.description) ??
        (toNonEmptyString(bot.description) ?? ''),
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
    };
  }

  @Post('init')
  async init(@Body() body: unknown, @Req() request: FastifyRequest) {
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

    await this.verifyPreviewOwnershipOrThrow(request, bot, parsed.authToken);

    const chatVisitorId =
      parsed.chatVisitorId && parsed.chatVisitorId.trim()
        ? parsed.chatVisitorId
        : `c_${randomUUID().replace(/-/g, '')}`;

    return { ...this.buildInitResponse(bot, parsed.previewOverrides), chatVisitorId };
  }

  @Post('chat')
  async chat(@Body() body: unknown, @Req() request: FastifyRequest) {
    const parsed = parseChatBody(body);
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

    const { runtimeVisitorId } = await this.verifyPreviewOwnershipOrThrow(
      request,
      bot,
      parsed.authToken,
    );

    // Critical boundary: chatVisitorId must NEVER be derived from platformVisitorId.
    // It must be supplied via preview init response (preferred) or via legacy `visitorId`.
    const chatVisitorId = parsed.chatVisitorId ?? parsed.visitorId;

    if (!chatVisitorId) {
      throw new HttpException(
        { error: 'chatVisitorId is required', errorCode: 'CHAT_VISITOR_ID_REQUIRED' },
        HttpStatus.BAD_REQUEST,
      );
    }

    const botLike = this.buildPreviewBotLike(bot, parsed.previewOverrides);
    const result = await this.chatEngineService.runChat({
      bot: botLike,
      chatVisitorId,
      platformVisitorId: runtimeVisitorId || undefined,
      message: parsed.message,
      mode: 'user',
      requestId: getRequestId(request),
      debug: false,
    });
    if (!result.ok) {
      throw new HttpException(result, HttpStatus.BAD_REQUEST);
    }

    return {
      ok: true,
      conversationId: result.conversationId,
      assistantMessage: result.assistantMessage,
      sources: result.sources,
    };
  }
}

