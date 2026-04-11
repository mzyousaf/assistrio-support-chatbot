import { Body, Controller, HttpException, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { VisitorsService } from '../visitors/visitors.service';
import { BotsService } from './bots.service';
import { validateRuntimeBotAccess } from './runtime-bot-access.util';
import { toRuntimeCredentialErrorCode } from './runtime-error-codes.util';
import {
  checkEmbedDomainGate,
  parseAllowedDomainRulesFromStoredArray,
  resolveRuntimeEmbedOriginFromHeaders,
} from './embed-domain.util';
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
  assertPlatformVisitorWebsiteMatchesBotAllowlist,
  platformVisitorEmbedCanBypassAllowedDomainsGate,
} from './platform-visitor-website-allowlist.util';
import { trialRuntimePlatformVisitorMatchesOwner } from './trial-runtime-embed.util';
import {
  getEmbedRuntimePlatformIdentityViolation,
  PLATFORM_VISITOR_EMBED_ANONYMOUS_SENTINEL,
} from './widget-embed-identity.util';
import { RUNTIME_INIT_DEPLOYMENT_HINTS } from './runtime-deployment-hints';

type WidgetInitBody = {
  botId?: unknown;
  accessKey?: unknown;
  secretKey?: unknown;
  /**
   * Page origin of the embedding site (e.g. https://www.example.com). Required when the bot has allowedDomains configured.
   */
  embedOrigin?: unknown;
  /**
   * Chat/session identity only (`chatVisitorId`).
   * When omitted, the backend mints a **chat** id (not a platform ownership id).
   */
  chatVisitorId?: unknown;
  /**
   * Stable saved identity (`platformVisitorId`) — must match snippet/config for reconnect and quota continuity.
   * Domain/origin checks are separate. Required for trial bots (`creatorType === 'visitor'`).
   */
  platformVisitorId?: unknown;
};

function parseInitBody(
  body: unknown,
): {
  botId: string;
  accessKey?: string;
  secretKey?: string;
  chatVisitorId?: string;
  embedOrigin?: string;
  platformVisitorId?: string;
} | null {
  if (body == null || typeof body !== 'object') return null;
  const o = body as WidgetInitBody;
  const botId = typeof o.botId === 'string' ? o.botId.trim() : '';
  if (!botId) return null;
  const accessKey = typeof o.accessKey === 'string' ? o.accessKey.trim() : '';
  const secretKey = typeof o.secretKey === 'string' ? o.secretKey.trim() : '';
  const chatVisitorId = typeof o.chatVisitorId === 'string' ? o.chatVisitorId.trim() : '';
  const embedOrigin = typeof o.embedOrigin === 'string' ? o.embedOrigin.trim() : '';
  const platformVisitorId = typeof o.platformVisitorId === 'string' ? o.platformVisitorId.trim() : '';
  return {
    botId,
    ...(accessKey ? { accessKey } : {}),
    ...(secretKey ? { secretKey } : {}),
    ...(chatVisitorId ? { chatVisitorId } : {}),
    ...(embedOrigin ? { embedOrigin } : {}),
    ...(platformVisitorId ? { platformVisitorId } : {}),
  };
}

/**
 * Standalone embeddable widget bootstrap. Public — key-authenticated at runtime.
 */
@Controller('api/widget')
export class WidgetInitController {
  constructor(
    private readonly configService: ConfigService,
    private readonly botsService: BotsService,
    private readonly visitorsService: VisitorsService,
    private readonly embedSessionService: EmbedSessionService,
  ) { }

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
          status: 'error' as const,
          errorCode: 'EMBED_ORIGIN_HEADER_REQUIRED',
          deploymentHint: RUNTIME_INIT_DEPLOYMENT_HINTS.originHeader,
        },
        HttpStatus.FORBIDDEN,
      );
    }

    const pv = parsed.platformVisitorId?.trim();
    const isTrialBot = (row as { creatorType?: string }).creatorType === 'visitor';
    if (isTrialBot) {
      if (!pv) {
        throw new HttpException(
          {
            error: 'platformVisitorId is required for trial bots',
            status: 'error' as const,
            errorCode: 'VISITOR_ID_REQUIRED',
          },
          HttpStatus.BAD_REQUEST,
        );
      }
      if (
        !trialRuntimePlatformVisitorMatchesOwner({
          ownerVisitorId: (row as { ownerVisitorId?: unknown }).ownerVisitorId,
          resolvedPlatformVisitorId: pv,
        })
      ) {
        throw new HttpException(
          {
            error: 'platformVisitorId does not match this trial bot owner.',
            status: 'error' as const,
            errorCode: 'TRIAL_PLATFORM_VISITOR_OWNER_MISMATCH',
            deploymentHint: RUNTIME_INIT_DEPLOYMENT_HINTS.trialOwner,
          },
          HttpStatus.FORBIDDEN,
        );
      }
    }

    const creatorType = (row as { creatorType?: string }).creatorType === 'visitor' ? 'visitor' : 'user';
    const botType = String((row as { type?: string }).type ?? '');
    const resolvedPvForIdentity = (pv ?? '').trim() || PLATFORM_VISITOR_EMBED_ANONYMOUS_SENTINEL;
    const embedIdentityErr = getEmbedRuntimePlatformIdentityViolation({
      botType,
      creatorType,
      resolvedPlatformVisitorId: resolvedPvForIdentity,
    });
    if (!embedIdentityErr.ok) {
      throw new HttpException(
        {
          error: embedIdentityErr.message,
          status: 'error' as const,
          errorCode: embedIdentityErr.errorCode,
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    /** Domain / origin: where the widget may run (separate from platform identity above). */
    const bypassAllowedDomains =
      !isTrialBot &&
      platformVisitorEmbedCanBypassAllowedDomainsGate({
        bot: row as { websiteURLAllowlist?: unknown },
        platformVisitorId: pv,
      });

    if (!bypassAllowedDomains) {
      const allowedRules = parseAllowedDomainRulesFromStoredArray((row as { allowedDomains?: unknown }).allowedDomains);
      const allowLoopback =
        this.configService.get<boolean>('allowLoopbackEmbedOrigin') === true;
      const domainGate = checkEmbedDomainGate(allowedRules, embedOriginResolved, {
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
                ? 'embedOrigin could not be parsed'
                : 'This chat widget is not allowed on this site';
        const deploymentHint =
          domainGate.reason === 'no_allowlist'
            ? RUNTIME_INIT_DEPLOYMENT_HINTS.noAllowlist
            : domainGate.reason === 'missing_origin' || domainGate.reason === 'bad_origin'
              ? RUNTIME_INIT_DEPLOYMENT_HINTS.originHeader
              : `${RUNTIME_INIT_DEPLOYMENT_HINTS.embedDomain} ${RUNTIME_INIT_DEPLOYMENT_HINTS.corsPrerequisite}`;
        throw new HttpException(
          { error, status: 'error' as const, errorCode, deploymentHint },
          HttpStatus.FORBIDDEN,
        );
      }
    }
    if (pv && !isTrialBot) {
      try {
        assertPlatformVisitorWebsiteMatchesBotAllowlist({
          bot: row as { websiteURLAllowlist?: unknown },
          platformVisitorId: pv,
          requestOrigin: embedOriginResolved,
        });
      } catch (err) {
        const code = err instanceof Error ? err.message : '';
        if (code === 'PLATFORM_EMBED_ORIGIN_REQUIRED') {
          throw new HttpException(
            {
              error: 'Origin header is required when using platformVisitorId',
              status: 'error' as const,
              errorCode: 'PLATFORM_EMBED_ORIGIN_REQUIRED',
              deploymentHint: RUNTIME_INIT_DEPLOYMENT_HINTS.originHeader,
            },
            HttpStatus.FORBIDDEN,
          );
        }
        if (code === 'PLATFORM_VISITOR_NOT_IN_BOT_ALLOWLIST') {
          throw new HttpException(
            {
              error:
                'This platform visitor id is not listed for this bot. Add it (with its website URL) in the bot website allowlist.',
              status: 'error' as const,
              errorCode: 'PLATFORM_VISITOR_NOT_IN_BOT_ALLOWLIST',
              deploymentHint: RUNTIME_INIT_DEPLOYMENT_HINTS.platformVisitorAllowlist,
            },
            HttpStatus.FORBIDDEN,
          );
        }
        if (code === 'PLATFORM_VISITOR_WEBSITE_ORIGIN_MISMATCH') {
          throw new HttpException(
            {
              error:
                'This page origin does not match the website URL configured for this platform visitor on this bot.',
              status: 'error' as const,
              errorCode: 'PLATFORM_VISITOR_WEBSITE_ORIGIN_MISMATCH',
              deploymentHint: RUNTIME_INIT_DEPLOYMENT_HINTS.platformVisitorAllowlist,
            },
            HttpStatus.FORBIDDEN,
          );
        }
        throw err;
      }
    }

    const chatUI = (row.chatUI ?? {}) as Record<string, unknown>;

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

    return {
      status: 'ok' as const,
      bot: {
        id: String(row._id ?? ''),
        name: String(row.name ?? ''),
        imageUrl: typeof row.imageUrl === 'string' ? row.imageUrl : undefined,
        avatarEmoji: typeof row.avatarEmoji === 'string' ? row.avatarEmoji : undefined,
        tagline: typeof row.shortDescription === 'string' ? row.shortDescription : undefined,
        description: typeof row.description === 'string' ? row.description : undefined,
        welcomeMessage: typeof row.welcomeMessage === 'string' ? row.welcomeMessage : undefined,
        suggestedQuestions: Array.isArray(row.exampleQuestions) ? row.exampleQuestions : [],
        exampleQuestions: Array.isArray(row.exampleQuestions) ? row.exampleQuestions : [],
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
