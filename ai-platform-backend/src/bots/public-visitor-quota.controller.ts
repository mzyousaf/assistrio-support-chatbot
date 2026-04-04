import { Body, Controller, HttpException, HttpStatus, Post, Req } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { VisitorsService } from '../visitors/visitors.service';
import { isValidPlatformVisitorIdFormat } from './widget-embed-identity.util';
import { PUBLIC_ANON_RATE_PREFIX, PUBLIC_ANONYMOUS_RATE_LIMITS } from '../rate-limit/public-anonymous-rate-limit.constants';
import { enforcePublicAnonymousRateLimit } from '../rate-limit/public-anonymous-rate-limit.util';
import { RateLimitService } from '../rate-limit/rate-limit.service';

/**
 * **PV-safe** read-only quota aggregates for a known `platformVisitorId` (product-shaped summary).
 *
 * **Not** internal analytics (`GET /api/user/analytics`) and **not** ingestion (`POST /api/analytics/track`).
 *
 * Security model: anyone who knows the id can read the same aggregates (no secrets).
 * Does not expose access keys, admin data, raw `VisitorEvent` streams, or per-bot lead values.
 * Rate-limited per IP to reduce scraping; **not** a substitute for keeping `platformVisitorId` private.
 *
 * **Do not** accept legacy `visitorId` here — it collides with chat/session naming elsewhere; use `platformVisitorId` only.
 *
 * @see docs/ANALYTICS_BOUNDARIES.md
 * @see docs/PV_SAFE_PUBLIC_APIS.md
 */
@Controller('api/public/visitor-quota')
export class PublicVisitorQuotaController {
  constructor(
    private readonly visitorsService: VisitorsService,
    private readonly rateLimitService: RateLimitService,
  ) {}

  @Post('summary')
  async summary(@Req() req: FastifyRequest, @Body() body: unknown) {
    await enforcePublicAnonymousRateLimit(
      this.rateLimitService,
      req,
      PUBLIC_ANON_RATE_PREFIX.visitorQuotaSummary,
      PUBLIC_ANONYMOUS_RATE_LIMITS.visitorQuotaSummaryPerIpPerMinute,
    );
    if (body == null || typeof body !== 'object') {
      throw new HttpException(
        { error: 'Invalid request body', status: 'error', errorCode: 'BAD_REQUEST' },
        HttpStatus.BAD_REQUEST,
      );
    }
    const o = body as { platformVisitorId?: unknown; visitorId?: unknown };
    const legacyVisitorId =
      typeof o.visitorId === 'string' ? o.visitorId.trim() : '';
    if (legacyVisitorId) {
      throw new HttpException(
        {
          error:
            'Use platformVisitorId only. The visitorId field is not accepted on this route (it is reserved for chat identity on other APIs).',
          status: 'error',
          errorCode: 'USE_PLATFORM_VISITOR_ID',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
    const platformVisitorId = String(o.platformVisitorId ?? '').trim();
    if (!platformVisitorId) {
      throw new HttpException(
        {
          error: 'platformVisitorId is required.',
          errorCode: 'PLATFORM_VISITOR_ID_REQUIRED',
          status: 'error',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
    if (!isValidPlatformVisitorIdFormat(platformVisitorId)) {
      throw new HttpException(
        {
          error: 'platformVisitorId format is invalid.',
          errorCode: 'INVALID_PLATFORM_VISITOR_ID',
          status: 'error',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const quotas = await this.visitorsService.getPublicVisitorQuotaSummary(platformVisitorId);
    return {
      ok: true as const,
      platformVisitorId,
      quotas,
    };
  }
}
