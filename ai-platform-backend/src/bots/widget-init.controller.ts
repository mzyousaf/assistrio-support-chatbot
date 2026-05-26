import { Body, Controller, HttpException, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { VisitorsService } from '../visitors/visitors.service';
import { isWelcomeMessageActive } from './welcome-message-display.util';
import { BotsService } from './bots.service';
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
import { EmbedSessionService } from './embed-session.service';
import { resolveWidgetEmbedRateLimitPerMinute } from '../models/bot.schema';
import {
  coerceAllowedOriginsFromBotDoc,
  isRuntimeOriginAllowed,
  resolveRuntimeEmbedOriginFromHeaders,
} from './origin-validation.util';
import { RUNTIME_INIT_DEPLOYMENT_HINTS } from './runtime-deployment-hints';
import { exampleQuestionsToPublicLabels } from '../workspace/shared/example-questions.util';
import { KnowledgeBaseItemService } from '../knowledge/knowledge-base-item.service';

type WidgetInitBody = {
  botId?: unknown;
  accessKey?: unknown;
  secretKey?: unknown;
  chatVisitorId?: unknown;
};

function parseInitBody(body: unknown): {
  botId: string;
  accessKey?: string;
  secretKey?: string;
  chatVisitorId?: string;
} | null {
  if (body == null || typeof body !== 'object') return null;
  const o = body as WidgetInitBody;
  const botId = typeof o.botId === 'string' ? o.botId.trim() : '';
  if (!botId) return null;
  const accessKey = typeof o.accessKey === 'string' ? o.accessKey.trim() : '';
  const secretKey = typeof o.secretKey === 'string' ? o.secretKey.trim() : '';
  const chatVisitorId = typeof o.chatVisitorId === 'string' ? o.chatVisitorId.trim() : '';
  return {
    botId,
    ...(accessKey ? { accessKey } : {}),
    ...(secretKey ? { secretKey } : {}),
    ...(chatVisitorId ? { chatVisitorId } : {}),
  };
}

/**
 * Embeddable widget bootstrap. Public — key-authenticated at runtime; origin must match `allowedOrigins` exactly.
 */
@Controller('api/widget')
export class WidgetInitController {
  constructor(
    private readonly configService: ConfigService,
    private readonly botsService: BotsService,
    private readonly visitorsService: VisitorsService,
    private readonly embedSessionService: EmbedSessionService,
    private readonly knowledgeBaseItemService: KnowledgeBaseItemService,
  ) {}

  @Post('init')
  async init(
    @Body() body: unknown,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const parsed = parseInitBody(body);
    if (!parsed) {
      throw new HttpException(
        { error: 'Invalid request body', status: 'error', errorCode: 'BAD_REQUEST' },
        HttpStatus.BAD_REQUEST,
      );
    }

    const row = await this.botsService.findOneByIdForExternalRuntime(parsed.botId);
    if (!row) {
      throw new HttpException(
        {
          error: 'Bot not found or not available for embedding',
          status: 'error',
          errorCode: 'BOT_NOT_FOUND',
        },
        HttpStatus.NOT_FOUND,
      );
    }

    const ownerId = (row as { ownerId?: unknown }).ownerId;
    if (ownerId == null || String(ownerId).trim() === '') {
      throw new HttpException(
        {
          error: 'Bot is missing workspace ownership',
          status: 'error' as const,
          errorCode: 'BOT_OWNER_REQUIRED',
        },
        HttpStatus.FORBIDDEN,
      );
    }

    const access = validateRuntimeBotAccess(
      {
        status: (row.status as string | undefined) ?? undefined,
        visibility: (row.visibility as 'public' | 'private' | undefined) ?? undefined,
        accessKey: (row.accessKey as string | undefined) ?? undefined,
        secretKey: (row.secretKey as string | undefined) ?? undefined,
      },
      { accessKey: parsed.accessKey, secretKey: parsed.secretKey },
    );
    if (!access.ok) {
      if (access.reason === 'unpublished') {
        throw new HttpException(
          {
            error: 'Bot not found or not available for embedding',
            status: 'error',
            errorCode: 'BOT_NOT_PUBLISHED',
          },
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

    const limit = resolveWidgetEmbedRateLimitPerMinute(row);
    const ip = getClientIpForRateLimit(req);
    if (!consumeEmbedRuntimeRateLimitToken(`${EMBED_RUNTIME_RATE_LIMIT_KEY_PREFIX}:${ip}`, limit)) {
      throwEmbedRuntimeIpRateLimited(EMBED_RUNTIME_RATE_LIMIT_WINDOW_MS);
    }

    const embedOriginResolved = resolveRuntimeEmbedOriginFromHeaders(req.headers);
    if (!embedOriginResolved) {
      throw new HttpException(
        {
          error: 'Origin header is required for embed requests',
          status: 'error' as const,
          errorCode: 'EMBED_ORIGIN_HEADER_REQUIRED',
          deploymentHint: RUNTIME_INIT_DEPLOYMENT_HINTS.originHeader,
        },
        HttpStatus.FORBIDDEN,
      );
    }

    const nodeEnv = this.configService.get<string>('nodeEnv') ?? 'development';
    const allowedOrigins = coerceAllowedOriginsFromBotDoc((row as { allowedOrigins?: unknown }).allowedOrigins);
    if (!isRuntimeOriginAllowed(embedOriginResolved, allowedOrigins, nodeEnv)) {
      throw new HttpException(
        {
          error: 'This chat widget is not allowed on this site',
          status: 'error' as const,
          errorCode: 'EMBED_ORIGIN_NOT_ALLOWED',
          deploymentHint: `${RUNTIME_INIT_DEPLOYMENT_HINTS.embedDomain} ${RUNTIME_INIT_DEPLOYMENT_HINTS.corsPrerequisite}`,
        },
        HttpStatus.FORBIDDEN,
      );
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

    const chatVisitorId =
      parsed.chatVisitorId && parsed.chatVisitorId.trim()
        ? parsed.chatVisitorId
        : `c_${randomUUID().replace(/-/g, '')}`;

    try {
      await this.visitorsService.getOrCreateChatVisitor(chatVisitorId);
    } catch (err) {
      console.error('[widget/init] getOrCreateChatVisitor failed', err);
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
}
