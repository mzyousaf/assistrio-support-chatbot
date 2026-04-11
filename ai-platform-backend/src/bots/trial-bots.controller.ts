import { Body, Controller, HttpException, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { normalizeUserWebsiteInputToHostname } from './embed-domain.util';
import { BotsService } from './bots.service';
import { VisitorsService } from '../visitors/visitors.service';
import { isValidPlatformVisitorIdFormat } from './widget-embed-identity.util';
import { PUBLIC_ANON_RATE_PREFIX, PUBLIC_ANONYMOUS_RATE_LIMITS } from '../rate-limit/public-anonymous-rate-limit.constants';
import { enforcePublicAnonymousRateLimit } from '../rate-limit/public-anonymous-rate-limit.util';
import { RateLimitService } from '../rate-limit/rate-limit.service';
import { LandingSiteApiKeyGuard } from '../landing-site-api-key/landing-site-api-key.guard';

type TrialBotCreateBody = {
  platformVisitorId?: unknown;
  /** @deprecated Legacy alias for `platformVisitorId` — must not be used for chat identity. */
  visitorId?: unknown;
  /** Website / URL / hostname where the widget may load (required); stored as hostname only. */
  allowedDomain?: unknown;
  /** Alternative: first entry used if allowedDomain is omitted. */
  allowedDomains?: unknown;
  name?: unknown;
  welcomeMessage?: unknown;
  shortDescription?: unknown;
  description?: unknown;
  imageUrl?: unknown;
  avatarEmoji?: unknown;
};

function sanitizeOptionalString(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLength);
}

function parseAllowedDomainForTrial(input: TrialBotCreateBody): string {
  const single = typeof input.allowedDomain === 'string' ? input.allowedDomain.trim() : '';
  if (single) return single;
  if (Array.isArray(input.allowedDomains) && input.allowedDomains.length > 0) {
    const first = input.allowedDomains[0];
    if (typeof first === 'string' && first.trim()) return first.trim();
  }
  return '';
}

function parseCreateBody(body: unknown): {
  platformVisitorId?: string;
  visitorId?: string;
  allowedDomain: string;
  name?: string;
  welcomeMessage?: string;
  shortDescription?: string;
  description?: string;
  imageUrl?: string;
  avatarEmoji?: string;
} {
  if (body == null || typeof body !== 'object') {
    return { allowedDomain: '' };
  }
  const input = body as TrialBotCreateBody;
  const platformVisitorIdRaw = typeof input.platformVisitorId === 'string' ? input.platformVisitorId.trim() : '';
  const platformVisitorId =
    platformVisitorIdRaw && isValidPlatformVisitorIdFormat(platformVisitorIdRaw) ? platformVisitorIdRaw : undefined;

  /** @deprecated Legacy platform-identity alias only (same semantics as `platformVisitorId`). */
  const visitorIdRaw = typeof input.visitorId === 'string' ? input.visitorId.trim() : '';
  const visitorId = visitorIdRaw && isValidPlatformVisitorIdFormat(visitorIdRaw) ? visitorIdRaw : undefined;

  return {
    platformVisitorId,
    visitorId,
    allowedDomain: parseAllowedDomainForTrial(input),
    name: sanitizeOptionalString(input.name, 100),
    welcomeMessage: sanitizeOptionalString(input.welcomeMessage, 500),
    shortDescription: sanitizeOptionalString(input.shortDescription, 180),
    description: sanitizeOptionalString(input.description, 1500),
    imageUrl: sanitizeOptionalString(input.imageUrl, 1000),
    avatarEmoji: sanitizeOptionalString(input.avatarEmoji, 12),
  };
}

/**
 * **Intentionally anonymous** — creates DB rows; rate-limited per IP (Mongo window, multi-instance safe).
 * Ownership/quota: `platformVisitorId` only; `allowedDomain` is runtime location, not identity proof.
 * Requires `X-API-Key` from the marketing site (`LANDING_SITE_X_API_KEY`).
 */
@Controller('api/trial/bots')
@UseGuards(LandingSiteApiKeyGuard)
export class TrialBotsController {
  constructor(
    private readonly botsService: BotsService,
    private readonly visitorsService: VisitorsService,
    private readonly rateLimitService: RateLimitService,
  ) {}

  @Post()
  async createTrialBot(@Req() req: FastifyRequest, @Body() body: unknown) {
    await enforcePublicAnonymousRateLimit(
      this.rateLimitService,
      req,
      PUBLIC_ANON_RATE_PREFIX.trialCreate,
      PUBLIC_ANONYMOUS_RATE_LIMITS.trialCreatePerIpPerMinute,
    );
    const parsed = parseCreateBody(body);
    if (body != null && typeof body === 'object') {
      const o = body as Record<string, unknown>;
      const rawPv = typeof o.platformVisitorId === 'string' ? o.platformVisitorId.trim() : '';
      const rawLegacy = typeof o.visitorId === 'string' ? o.visitorId.trim() : '';
      if (rawPv && !isValidPlatformVisitorIdFormat(rawPv)) {
        throw new HttpException(
          {
            error:
              'platformVisitorId must be a stable id (6–120 chars: letters, digits, . _ : -). Generate and persist one per site visitor.',
            errorCode: 'INVALID_PLATFORM_VISITOR_ID',
          },
          HttpStatus.BAD_REQUEST,
        );
      }
      if (rawLegacy && !isValidPlatformVisitorIdFormat(rawLegacy)) {
        throw new HttpException(
          {
            error: 'visitorId legacy alias must use the same format rules as platformVisitorId.',
            errorCode: 'INVALID_PLATFORM_VISITOR_ID',
          },
          HttpStatus.BAD_REQUEST,
        );
      }
    }
    if (
      parsed.platformVisitorId &&
      parsed.visitorId &&
      parsed.platformVisitorId !== parsed.visitorId
    ) {
      throw new HttpException(
        {
          error:
            'platformVisitorId and legacy visitorId conflict — send only one, or the same value in both fields.',
          errorCode: 'PLATFORM_VISITOR_ID_AMBIGUOUS',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
    const platformVisitorId = parsed.platformVisitorId ?? parsed.visitorId;
    if (!platformVisitorId) {
      throw new HttpException(
        {
          error:
            'platformVisitorId is required: pass the stable platform visitor id for this site visitor (trial bot ownership and quota are tied to it). Legacy field `visitorId` is accepted as an alias.',
          errorCode: 'PLATFORM_VISITOR_ID_REQUIRED',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const rawDomain = parsed.allowedDomain.trim();
    if (!rawDomain) {
      throw new HttpException(
        {
          error:
            'allowedDomain is required: your site URL, base URL, or hostname where the embedded widget will run. We store only the hostname for the runtime embed allowlist.',
          errorCode: 'TRIAL_EMBED_DOMAIN_REQUIRED',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const domainNorm = normalizeUserWebsiteInputToHostname(rawDomain);
    if (!domainNorm) {
      throw new HttpException(
        {
          error:
            'allowedDomain must be a valid public hostname for embed (e.g. www.example.com). Paste a full https URL or hostname — we store only the hostname.',
          errorCode: 'TRIAL_EMBED_DOMAIN_INVALID',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      await this.visitorsService.getOrCreateVisitor(platformVisitorId);
      const created = await this.botsService.createVisitorTrialBot({
        platformVisitorId,
        allowedDomain: domainNorm,
        name: parsed.name,
        welcomeMessage: parsed.welcomeMessage,
        shortDescription: parsed.shortDescription,
        description: parsed.description,
        imageUrl: parsed.imageUrl,
        avatarEmoji: parsed.avatarEmoji,
      });
      await this.visitorsService.createVisitorEvent({
        platformVisitorId,
        type: 'trial_bot_created',
        botId: created.botId,
        botSlug: created.slug,
      });

      return {
        ok: true,
        platformVisitorId,
        /** Same as `platformVisitorId` — explicit name for landing/snippet copy (“save this id”). */
        stableIdentity: platformVisitorId,
        /** @deprecated Use `platformVisitorId`. */
        visitorId: platformVisitorId,
        /** Normalized hostname stored on the bot embed allowlist. */
        allowedDomain: domainNorm,
        bot: {
          id: created.botId,
          slug: created.slug,
          name: created.name,
          type: created.type,
          status: created.status,
          visibility: created.visibility,
          isPublic: created.isPublic,
          accessKey: created.accessKey,
          welcomeMessage: created.welcomeMessage,
          imageUrl: created.imageUrl,
          avatarEmoji: created.avatarEmoji,
          messageLimitMode: created.messageLimitMode,
          messageLimitTotal: created.messageLimitTotal,
          messageLimitUpgradeMessage: created.messageLimitUpgradeMessage,
        },
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      console.error('Create visitor trial bot failed', error);
      const msg = error instanceof Error ? error.message : '';
      if (msg.includes('allowedDomain')) {
        throw new HttpException(
          { error: msg, errorCode: 'TRIAL_EMBED_DOMAIN_INVALID' },
          HttpStatus.BAD_REQUEST,
        );
      }
      throw new HttpException(
        { error: 'Failed to create trial bot', status: 'error', errorCode: 'INTERNAL_ERROR' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
