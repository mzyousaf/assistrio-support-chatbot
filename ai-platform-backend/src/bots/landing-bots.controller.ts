import { Controller, Get, Header, HttpException, HttpStatus, Req, UseGuards } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { BotsService } from './bots.service';
import { LandingSiteApiKeyGuard } from './landing-site-api-key.guard';
import { shapePublicBotListItem } from './public-bot-response.util';
import { PUBLIC_ANON_RATE_PREFIX, PUBLIC_ANONYMOUS_RATE_LIMITS } from '../rate-limit/public-anonymous-rate-limit.constants';
import { enforcePublicAnonymousRateLimit } from '../rate-limit/public-anonymous-rate-limit.util';
import { RateLimitService } from '../rate-limit/rate-limit.service';

/**
 * Curated list for the marketing landing app — requires `X-API-Key` ({@link LandingSiteApiKeyGuard})
 * **and** per-IP rate limiting (defense in depth if the key leaks).
 */
@Controller('api/public/landing')
@UseGuards(LandingSiteApiKeyGuard)
export class LandingBotsController {
  constructor(
    private readonly botsService: BotsService,
    private readonly rateLimitService: RateLimitService,
  ) {}

  @Get('bots')
  @Header('Cache-Control', 'private, max-age=60')
  async list(@Req() req: FastifyRequest) {
    await enforcePublicAnonymousRateLimit(
      this.rateLimitService,
      req,
      PUBLIC_ANON_RATE_PREFIX.landingBotsList,
      PUBLIC_ANONYMOUS_RATE_LIMITS.landingBotsListPerIpPerMinute,
    );
    try {
      const rows = await this.botsService.findPublicShowcaseBySuperAdminCreators();
      return rows
        .map((row) => shapePublicBotListItem(row))
        .filter((row): row is NonNullable<typeof row> => row !== null);
    } catch (error) {
      console.error('[public/landing/bots]', error);
      throw new HttpException(
        { error: 'Failed to fetch bots', status: 'error', errorCode: 'INTERNAL_ERROR' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
