import { Body, Controller, HttpException, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { VisitorsService } from '../visitors/visitors.service';
import { isValidPlatformVisitorIdFormat } from './widget-embed-identity.util';
import { PUBLIC_ANON_RATE_PREFIX, PUBLIC_ANONYMOUS_RATE_LIMITS } from '../rate-limit/public-anonymous-rate-limit.constants';
import { enforcePublicAnonymousRateLimit } from '../rate-limit/public-anonymous-rate-limit.util';
import { RateLimitService } from '../rate-limit/rate-limit.service';
import { LandingSiteApiKeyGuard } from '../landing-site-api-key/landing-site-api-key.guard';

/**
 * **PV-safe** (platform visitor) summaries for **visitor-owned** bots — separate from internal analytics.
 *
 * - Scoped by `platformVisitorId` + `botId` with ownership verification (`ownerVisitorId`, `type: visitor-own`).
 * - No raw `VisitorEvent` streams, no `GET /api/user/analytics` shapes, no `secretKey`.
 *
 * @see docs/ANALYTICS_BOUNDARIES.md
 * @see docs/PV_SAFE_PUBLIC_APIS.md
 *
 * `X-API-Key` required (`LANDING_SITE_X_API_KEY`) — marketing site proxies browser calls.
 */
@Controller('api/public/visitor-bot')
@UseGuards(LandingSiteApiKeyGuard)
export class PublicVisitorBotController {
  constructor(
    private readonly visitorsService: VisitorsService,
    private readonly rateLimitService: RateLimitService,
  ) {}

  private async enforceRate(req: FastifyRequest) {
    await enforcePublicAnonymousRateLimit(
      this.rateLimitService,
      req,
      PUBLIC_ANON_RATE_PREFIX.visitorBotPv,
      PUBLIC_ANONYMOUS_RATE_LIMITS.visitorBotPvPerIpPerMinute,
    );
  }

  private parsePvBody(body: unknown): { platformVisitorId: string; botId: string } {
    if (body == null || typeof body !== 'object') {
      throw new HttpException(
        { error: 'Invalid request body', status: 'error', errorCode: 'BAD_REQUEST' },
        HttpStatus.BAD_REQUEST,
      );
    }
    const o = body as { platformVisitorId?: unknown; visitorId?: unknown; botId?: unknown };
    const legacyVisitorId = typeof o.visitorId === 'string' ? o.visitorId.trim() : '';
    if (legacyVisitorId) {
      throw new HttpException(
        {
          error:
            'Use platformVisitorId only. visitorId is reserved for chat identity on other APIs.',
          status: 'error',
          errorCode: 'USE_PLATFORM_VISITOR_ID',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
    const platformVisitorId = String(o.platformVisitorId ?? '').trim();
    const botId = String(o.botId ?? '').trim();
    if (!platformVisitorId) {
      throw new HttpException(
        { error: 'platformVisitorId is required.', errorCode: 'PLATFORM_VISITOR_ID_REQUIRED', status: 'error' },
        HttpStatus.BAD_REQUEST,
      );
    }
    if (!isValidPlatformVisitorIdFormat(platformVisitorId)) {
      throw new HttpException(
        { error: 'platformVisitorId format is invalid.', errorCode: 'INVALID_PLATFORM_VISITOR_ID', status: 'error' },
        HttpStatus.BAD_REQUEST,
      );
    }
    if (!botId) {
      throw new HttpException(
        { error: 'botId is required.', errorCode: 'BOT_ID_REQUIRED', status: 'error' },
        HttpStatus.BAD_REQUEST,
      );
    }
    return { platformVisitorId, botId };
  }

  private notOwned() {
    return new HttpException(
      {
        error: 'Bot not found or not owned by this platform visitor.',
        errorCode: 'PV_BOT_NOT_FOUND_OR_FORBIDDEN',
        status: 'error',
      },
      HttpStatus.NOT_FOUND,
    );
  }

  @Post('summary')
  async summary(@Req() req: FastifyRequest, @Body() body: unknown) {
    await this.enforceRate(req);
    const { platformVisitorId, botId } = this.parsePvBody(body);
    const data = await this.visitorsService.getPvSafeVisitorBotSummary(platformVisitorId, botId);
    if (!data) throw this.notOwned();
    return { ok: true as const, ...data };
  }

  @Post('basic-insights')
  async basicInsights(@Req() req: FastifyRequest, @Body() body: unknown) {
    await this.enforceRate(req);
    const { platformVisitorId, botId } = this.parsePvBody(body);
    const data = await this.visitorsService.getPvSafeVisitorBotBasicInsights(platformVisitorId, botId);
    if (!data) throw this.notOwned();
    return { ok: true as const, ...data };
  }

  @Post('leads-summary')
  async leadsSummary(@Req() req: FastifyRequest, @Body() body: unknown) {
    await this.enforceRate(req);
    const { platformVisitorId, botId } = this.parsePvBody(body);
    const data = await this.visitorsService.getPvSafeVisitorBotLeadsSummary(platformVisitorId, botId);
    if (!data) throw this.notOwned();
    return { ok: true as const, ...data };
  }
}
