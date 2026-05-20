import { Controller, Get, Header, HttpException, HttpStatus, Param, Query, Req } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { BotsService } from './bots.service';
import {
  shapePublicPlatformBotDetailResponse,
  shapePublicPlatformBotListResponse,
} from './public-platform-bot-response.util';
import {
  PUBLIC_ANON_RATE_PREFIX,
  PUBLIC_ANONYMOUS_RATE_LIMITS,
} from '../rate-limit/public-anonymous-rate-limit.constants';
import { enforcePublicAnonymousRateLimit } from '../rate-limit/public-anonymous-rate-limit.util';
import { RateLimitService } from '../rate-limit/rate-limit.service';

/**
 * Anonymous published **platform** bots for landing demos, showcase, and support surfaces.
 * Does not expose secretKey, workspace, owner, or knowledge internals.
 */
@Controller('api/public/platform-bots')
export class PublicPlatformBotsController {
  constructor(
    private readonly botsService: BotsService,
    private readonly rateLimitService: RateLimitService,
  ) {}

  @Get()
  @Header('Cache-Control', 'public, max-age=60')
  async list(@Req() req: FastifyRequest, @Query('type') type?: string) {
    await enforcePublicAnonymousRateLimit(
      this.rateLimitService,
      req,
      PUBLIC_ANON_RATE_PREFIX.publicPlatformBotsList,
      PUBLIC_ANONYMOUS_RATE_LIMITS.publicPlatformBotsListPerIpPerMinute,
    );
    try {
      const rows = await this.botsService.findPublishedPublicPlatformBots({ type });
      return shapePublicPlatformBotListResponse(rows);
    } catch (error) {
      console.error('[public/platform-bots] list', error);
      throw new HttpException(
        { error: 'Failed to fetch platform bots', status: 'error', errorCode: 'INTERNAL_ERROR' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':idOrSlug')
  @Header('Cache-Control', 'public, max-age=60')
  async getOne(@Req() req: FastifyRequest, @Param('idOrSlug') idOrSlug: string) {
    await enforcePublicAnonymousRateLimit(
      this.rateLimitService,
      req,
      PUBLIC_ANON_RATE_PREFIX.publicPlatformBotsDetail,
      PUBLIC_ANONYMOUS_RATE_LIMITS.publicPlatformBotsDetailPerIpPerMinute,
    );
    try {
      const doc = await this.botsService.findPublishedPublicPlatformBotByIdOrSlug(idOrSlug);
      const shaped = shapePublicPlatformBotDetailResponse(doc);
      if (!shaped) {
        throw new HttpException(
          { error: 'Platform bot not found', status: 'error', errorCode: 'NOT_FOUND' },
          HttpStatus.NOT_FOUND,
        );
      }
      return shaped;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      console.error('[public/platform-bots] detail', error);
      throw new HttpException(
        { error: 'Failed to fetch platform bot', status: 'error', errorCode: 'INTERNAL_ERROR' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
