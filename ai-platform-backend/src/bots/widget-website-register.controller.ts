import { Body, Controller, HttpException, HttpStatus, Post, Req } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { BotsService } from './bots.service';
import { toRuntimeCredentialErrorCode } from './runtime-error-codes.util';
import { isValidPlatformVisitorIdFormat } from './widget-embed-identity.util';
import { PUBLIC_ANON_RATE_PREFIX, PUBLIC_ANONYMOUS_RATE_LIMITS } from '../rate-limit/public-anonymous-rate-limit.constants';
import { enforcePublicAnonymousRateLimit } from '../rate-limit/public-anonymous-rate-limit.util';
import { RateLimitService } from '../rate-limit/rate-limit.service';

type RegisterWebsiteBody = {
  botId?: unknown;
  accessKey?: unknown;
  secretKey?: unknown;
  platformVisitorId?: unknown;
  websiteUrl?: unknown;
};

/**
 * Showcase-only: register `{ platformVisitorId, websiteUrl }` on a bot using **embed keys** (install proof).
 * Does **not** replace sending `platformVisitorId` in widget config — it only authorizes *where* that id may bypass `allowedDomains`.
 *
 * Trial bots: use `allowedDomains` + trial creation; this endpoint returns `TRIAL_BOT_NOT_SUPPORTED`.
 *
 * **Intentionally anonymous** (credentials + rate limit per IP) — still mutates allowlist; see `PUBLIC_ANONYMOUS_RATE_LIMITS`.
 */
@Controller('api/widget')
export class WidgetWebsiteRegisterController {
  constructor(
    private readonly botsService: BotsService,
    private readonly rateLimitService: RateLimitService,
  ) {}

  @Post('register-website')
  async registerWebsite(@Req() req: FastifyRequest, @Body() body: unknown) {
    await enforcePublicAnonymousRateLimit(
      this.rateLimitService,
      req,
      PUBLIC_ANON_RATE_PREFIX.registerWebsite,
      PUBLIC_ANONYMOUS_RATE_LIMITS.registerWebsitePerIpPerMinute,
    );
    if (body == null || typeof body !== 'object') {
      throw new HttpException(
        { error: 'Invalid request body', status: 'error', errorCode: 'BAD_REQUEST' },
        HttpStatus.BAD_REQUEST,
      );
    }
    const o = body as RegisterWebsiteBody;
    const botId = typeof o.botId === 'string' ? o.botId.trim() : '';
    const accessKey = typeof o.accessKey === 'string' ? o.accessKey.trim() : '';
    const secretKey = typeof o.secretKey === 'string' ? o.secretKey.trim() : '';
    const platformVisitorId = typeof o.platformVisitorId === 'string' ? o.platformVisitorId.trim() : '';
    const websiteUrl = typeof o.websiteUrl === 'string' ? o.websiteUrl.trim() : '';
    if (websiteUrl.length > 2048) {
      throw new HttpException(
        { error: 'websiteUrl is too long.', status: 'error', errorCode: 'BAD_REQUEST' },
        HttpStatus.BAD_REQUEST,
      );
    }
    if (!botId || !accessKey || !platformVisitorId || !websiteUrl) {
      throw new HttpException(
        {
          error: 'botId, accessKey, platformVisitorId, and websiteUrl are required (secretKey required when bot is private).',
          status: 'error',
          errorCode: 'BAD_REQUEST',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
    if (!isValidPlatformVisitorIdFormat(platformVisitorId)) {
      throw new HttpException(
        {
          error: 'platformVisitorId format is invalid.',
          status: 'error',
          errorCode: 'INVALID_PLATFORM_VISITOR_ID',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const result = await this.botsService.registerShowcaseEmbedWebsiteAllowlistForRuntime({
        botId,
        accessKey,
        ...(secretKey ? { secretKey } : {}),
        platformVisitorId,
        websiteUrl,
      });
      return {
        ok: true,
        botId: result.botId,
        platformVisitorWebsiteAllowlist: result.platformVisitorWebsiteAllowlist,
      };
    } catch (err) {
      const code = err instanceof Error ? err.message : '';
      if (code === 'E_INVALID_BOT_ID') {
        throw new HttpException(
          { error: 'Invalid bot id.', status: 'error', errorCode: 'BAD_REQUEST' },
          HttpStatus.BAD_REQUEST,
        );
      }
      if (code === 'E_BOT_NOT_FOUND') {
        throw new HttpException(
          { error: 'Bot not found.', status: 'error', errorCode: 'BOT_NOT_FOUND' },
          HttpStatus.NOT_FOUND,
        );
      }
      if (code === 'E_SHOWCASE_ONLY') {
        throw new HttpException(
          {
            error: 'Website allowlist registration is only available for showcase bots.',
            status: 'error',
            errorCode: 'WEBSITE_REGISTER_SHOWCASE_ONLY',
          },
          HttpStatus.BAD_REQUEST,
        );
      }
      if (code === 'E_TRIAL_BOT_NOT_SUPPORTED') {
        throw new HttpException(
          {
            error:
              'Trial bots do not use per-visitor website allowlist. Configure allowedDomain at trial creation instead.',
            status: 'error',
            errorCode: 'WEBSITE_REGISTER_TRIAL_NOT_SUPPORTED',
          },
          HttpStatus.BAD_REQUEST,
        );
      }
      if (code.startsWith('E_ACCESS_')) {
        const r = code.replace('E_ACCESS_', '');
        const reasonMap: Record<
          string,
          'unpublished' | 'missing_access_key' | 'invalid_access_key' | 'missing_secret_key' | 'invalid_secret_key'
        > = {
          unpublished: 'unpublished',
          missing_access_key: 'missing_access_key',
          invalid_access_key: 'invalid_access_key',
          missing_secret_key: 'missing_secret_key',
          invalid_secret_key: 'invalid_secret_key',
        };
        const reason = reasonMap[r];
        if (reason) {
          throw new HttpException(
            {
              error: 'Invalid embed credentials.',
              status: 'error',
              errorCode: toRuntimeCredentialErrorCode({ ok: false, reason }),
            },
            HttpStatus.FORBIDDEN,
          );
        }
      }
      if (
        code === 'PLATFORM_VISITOR_WEBSITE_ALLOWLIST_ROW_INCOMPLETE' ||
        code === 'PLATFORM_VISITOR_WEBSITE_ALLOWLIST_INVALID_URL' ||
        code === 'PLATFORM_VISITOR_WEBSITE_LOCALHOST_DISALLOWED'
      ) {
        throw new HttpException(
          {
            error:
              code === 'PLATFORM_VISITOR_WEBSITE_LOCALHOST_DISALLOWED'
                ? 'That URL cannot be used for production website registration.'
                : 'websiteUrl must be a valid public site URL or hostname (we store only the hostname).',
            status: 'error',
            errorCode: 'WEBSITE_REGISTER_INVALID_URL',
          },
          HttpStatus.BAD_REQUEST,
        );
      }
      if (code.includes('At most one platform visitor')) {
        throw new HttpException(
          { error: err instanceof Error ? err.message : 'Allowlist policy error', status: 'error', errorCode: 'BAD_REQUEST' },
          HttpStatus.BAD_REQUEST,
        );
      }
      console.error('[widget/register-website]', err);
      throw new HttpException(
        { error: 'Failed to register website.', status: 'error', errorCode: 'INTERNAL_ERROR' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
