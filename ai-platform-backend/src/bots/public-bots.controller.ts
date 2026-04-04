import { Controller, Get, Header, HttpException, HttpStatus, Param, Req } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { BotsService } from './bots.service';
import { shapePublicBotDetail, shapePublicBotListItem } from './public-bot-response.util';
import { PUBLIC_ANON_RATE_PREFIX, PUBLIC_ANONYMOUS_RATE_LIMITS } from '../rate-limit/public-anonymous-rate-limit.constants';
import { enforcePublicAnonymousRateLimit } from '../rate-limit/public-anonymous-rate-limit.util';
import { RateLimitService } from '../rate-limit/rate-limit.service';

/** Slug path segment for public gallery detail — no slashes or unicode (matches slugify output). */
const PUBLIC_BOT_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function assertPublicGallerySlug(slug: string): string {
  const s = String(slug ?? '').trim().toLowerCase();
  if (!s || s.length > 160 || !PUBLIC_BOT_SLUG_RE.test(s)) {
    throw new HttpException(
      { error: 'Invalid slug', status: 'error', errorCode: 'BAD_REQUEST' },
      HttpStatus.BAD_REQUEST,
    );
  }
  return s;
}

/**
 * **Anonymous** marketing gallery — showcase bots only (`findPublicShowcase`).
 * Rate-limited per IP; responses are cacheable (`Cache-Control: public`).
 */
@Controller('api/public/bots')
export class PublicBotsController {
  constructor(
    private readonly botsService: BotsService,
    private readonly rateLimitService: RateLimitService,
  ) {}

  @Get()
  @Header('Cache-Control', 'public, max-age=60')
  async list(@Req() req: FastifyRequest) {
    await enforcePublicAnonymousRateLimit(
      this.rateLimitService,
      req,
      PUBLIC_ANON_RATE_PREFIX.publicBotsList,
      PUBLIC_ANONYMOUS_RATE_LIMITS.publicBotsListPerIpPerMinute,
    );
    try {
      const rows = await this.botsService.findPublicShowcase();
      return rows
        .map((row) => shapePublicBotListItem(row))
        .filter((row): row is NonNullable<typeof row> => row !== null);
    } catch (error) {
      console.error('[public/bots] list', error);
      throw new HttpException(
        { error: 'Failed to fetch bots', status: 'error', errorCode: 'INTERNAL_ERROR' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':slug')
  @Header('Cache-Control', 'public, max-age=60')
  async getBySlug(@Req() req: FastifyRequest, @Param('slug') slug: string) {
    await enforcePublicAnonymousRateLimit(
      this.rateLimitService,
      req,
      PUBLIC_ANON_RATE_PREFIX.publicBotsSlug,
      PUBLIC_ANONYMOUS_RATE_LIMITS.publicBotsDetailPerIpPerMinute,
    );
    const normalized = assertPublicGallerySlug(slug);
    const bot = await this.botsService.findOneBySlugForPage(normalized, 'showcase');
    const shaped = bot ? shapePublicBotDetail(bot) : null;
    if (!shaped) {
      throw new HttpException(
        { error: 'Bot not found', status: 'error', errorCode: 'NOT_FOUND' },
        HttpStatus.NOT_FOUND,
      );
    }
    return shaped;
  }
}
