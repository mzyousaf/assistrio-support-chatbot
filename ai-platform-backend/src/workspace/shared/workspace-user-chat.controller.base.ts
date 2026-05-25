import {
  Body,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { getRequestId } from '../../lib/request-id.helper';
import { BotsService } from '../../bots/bots.service';
import { ChatEngineService } from '../../chat/chat-engine.service';
import type { AnalyticsContextPayload, BotLike, ConversationOriginPayload } from '../../chat/chat-engine.types';
import {
  buildAnalyticsRequestMetaForChat,
  parseAnalyticsContextFromUnknown,
} from '../../chat/conversation-analytics-location-device.util';
import { parseMessageAnalyticsFromUnknown } from '../../chat/message-input-analytics.util';
import {
  mergeSanitizedConversationOrigins,
  parseConversationOriginFromUnknown,
  resolvePageUrlFromSourcePage,
} from '../../chat/conversation-analytics-origin.util';
import type { RequestUser } from '../../auth/shared/request-user.types';
import { WorkspacesService } from '../../workspaces/workspaces.service';

type RequestWithUser = FastifyRequest & { user?: RequestUser };

function parseBody(body: unknown): {
  message: string;
  analyticsContext?: AnalyticsContextPayload;
  messageAnalytics?: ReturnType<typeof parseMessageAnalyticsFromUnknown>;
  conversationOrigin?: ReturnType<typeof parseConversationOriginFromUnknown>;
  previewContext?: { sourcePage?: string };
} | null {
  if (body == null || typeof body !== 'object') return null;
  const o = body as Record<string, unknown>;
  const message = typeof o.message === 'string' ? o.message.trim() : '';
  if (!message) return null;
  const analyticsContext = parseAnalyticsContextFromUnknown(o.analyticsContext);
  const messageAnalytics = parseMessageAnalyticsFromUnknown(o.messageAnalytics);
  const conversationOrigin = parseConversationOriginFromUnknown(o.conversationOrigin);
  const previewCtx = o.previewContext;
  const sourcePage =
    previewCtx != null &&
    typeof previewCtx === 'object' &&
    !Array.isArray(previewCtx) &&
    typeof (previewCtx as { sourcePage?: unknown }).sourcePage === 'string'
      ? (previewCtx as { sourcePage: string }).sourcePage.trim().slice(0, 512)
      : '';
  return {
    message,
    ...(analyticsContext ? { analyticsContext } : {}),
    ...(messageAnalytics ? { messageAnalytics } : {}),
    ...(conversationOrigin ? { conversationOrigin } : {}),
    ...(sourcePage ? { previewContext: { sourcePage } } : {}),
  };
}

function buildWorkspacePlaygroundConversationOrigin(
  req: FastifyRequest,
  parsed: NonNullable<ReturnType<typeof parseBody>>,
): Record<string, unknown> | undefined {
  const websiteOrigin =
    typeof req.headers.origin === 'string'
      ? req.headers.origin.trim().slice(0, 256)
      : undefined;
  const pageFromClient = parsed.conversationOrigin?.pageUrl?.trim();
  const pageFromSource = resolvePageUrlFromSourcePage(parsed.previewContext?.sourcePage, websiteOrigin);
  const refererRaw = req.headers.referer;
  const referrer =
    parsed.conversationOrigin?.referrer?.trim() ||
    (typeof refererRaw === 'string' ? refererRaw.trim().slice(0, 2048) : undefined);
  return mergeSanitizedConversationOrigins(
    {
      source: 'playground_preview',
      mode: 'preview',
      embedType: 'workspace_chat',
    },
    parsed.conversationOrigin,
    {
      ...(pageFromClient ? { pageUrl: pageFromClient } : {}),
      ...(pageFromSource && !pageFromClient ? { pageUrl: pageFromSource } : {}),
      ...(websiteOrigin ? { websiteOrigin } : {}),
      ...(referrer ? { referrer } : {}),
    },
  );
}

/** Authenticated owner/builder playground chat (not embed runtime). */
export abstract class WorkspaceUserChatControllerBase {
  constructor(
    private readonly botsService: BotsService,
    private readonly chatEngineService: ChatEngineService,
    private readonly workspacesService: WorkspacesService,
  ) {}

  @Post(':botId/chat')
  async runChat(
    @Param('botId') botId: string,
    @Body() body: unknown,
    @Query('debug') debugQuery: string | undefined,
    @Req() req: RequestWithUser,
  ) {
    const parsed = parseBody(body);
    if (!parsed) {
      throw new HttpException({ error: 'Invalid request body' }, HttpStatus.BAD_REQUEST);
    }
    const adminUser = req.user;
    const chatVisitorId = adminUser?._id != null ? String(adminUser._id) : 'anonymous';

    const bot = await this.botsService.findOneWorkspaceForAdmin(botId);
    if (!bot) {
      throw new HttpException({ error: 'Bot not found' }, HttpStatus.NOT_FOUND);
    }
    const uid = adminUser?._id != null ? String(adminUser._id) : '';
    try {
      await this.workspacesService.assertCanPreviewWorkspaceBot(
        uid,
        adminUser?.role ?? 'customer',
        bot as Record<string, unknown>,
      );
    } catch (err) {
      if (err instanceof ForbiddenException) {
        const response = (err as ForbiddenException).getResponse() as Record<string, unknown>;
        throw new HttpException(response, HttpStatus.FORBIDDEN);
      }
      throw err;
    }

    const b = bot as Record<string, unknown>;
    const botLike: BotLike = {
      _id: (b._id as { toString(): string }),
      ...(b.workspaceId != null ? { workspaceId: String(b.workspaceId) } : {}),
      ...(b.ownerId != null ? { ownerId: String(b.ownerId) } : {}),
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

    const debug = debugQuery === 'true' || debugQuery === '1';
    const chatResult = await this.chatEngineService.runChat({
      bot: botLike,
      chatVisitorId,
      message: parsed.message,
      mode: 'user',
      requestId: getRequestId(req),
      debug,
      sessionSource: 'widget_preview',
      ...(parsed.analyticsContext ? { analyticsContext: parsed.analyticsContext } : {}),
      ...(parsed.messageAnalytics ? { messageAnalytics: parsed.messageAnalytics } : {}),
      analyticsRequestMeta: buildAnalyticsRequestMetaForChat(req),
      conversationOrigin: buildWorkspacePlaygroundConversationOrigin(req, parsed) as
        | ConversationOriginPayload
        | undefined,
    });

    if (!chatResult.ok) {
      throw new HttpException(chatResult, HttpStatus.BAD_REQUEST);
    }

    return {
      ok: true,
      conversationId: chatResult.conversationId,
      assistantMessage: chatResult.assistantMessage,
      assistantMessageId: chatResult.assistantMessageId,
      sources: chatResult.sources,
      ...(debug && chatResult.debug != null && { debug: chatResult.debug }),
    };
  }
}
