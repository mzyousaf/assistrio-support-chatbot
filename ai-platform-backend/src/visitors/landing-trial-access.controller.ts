import { createHash } from 'crypto';
import {
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { isValidPlatformVisitorIdFormat } from '../bots/widget-embed-identity.util';
import { RateLimitService } from '../rate-limit/rate-limit.service';
import { EmailService } from '../email/email.service';
import { VisitorsService } from './visitors.service';
import { LandingSiteApiKeyGuard } from '../landing-site-api-key/landing-site-api-key.guard';

const RATE_KEY_PREFIX = 'anon_pub:landing_trial_req';
/** Per (platformVisitorId + email) rolling window — reduces abuse without trusting proxy IP from Next.js. */
const RATE_LIMIT_PER_HOUR = 8;
const RATE_WINDOW_MS = 60 * 60 * 1000;

function trimStr(v: unknown, max: number): string {
  if (typeof v !== 'string') return '';
  return v.trim().slice(0, max);
}

function parseCta(body: Record<string, unknown>): Record<string, unknown> {
  const raw = body.cta;
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }
  const o = raw as Record<string, unknown>;
  return {
    label: trimStr(o.label, 200),
    location: trimStr(o.location, 120),
    href: trimStr(o.href, 500),
    sourcePath: trimStr(o.sourcePath, 500),
    showcaseSlug: o.showcaseSlug == null ? null : trimStr(o.showcaseSlug, 200) || null,
    showcaseBotId: o.showcaseBotId == null ? null : trimStr(o.showcaseBotId, 40) || null,
  };
}

/**
 * **Server-to-server only:** called by assistrio-landing-site `POST /api/trial/request-access`
 * with `X-API-Key: LANDING_SITE_X_API_KEY`. Not for browser CORS use.
 */
@Controller('api/landing/trial')
@UseGuards(LandingSiteApiKeyGuard)
export class LandingTrialAccessController {
  constructor(
    private readonly visitorsService: VisitorsService,
    private readonly rateLimitService: RateLimitService,
    private readonly emailService: EmailService,
  ) {}

  @Post('request-access')
  async requestAccess(@Req() req: FastifyRequest, @Body() body: unknown) {
    if (body == null || typeof body !== 'object') {
      throw new HttpException(
        { error: 'Invalid JSON body', status: 'error', errorCode: 'BAD_REQUEST' },
        HttpStatus.BAD_REQUEST,
      );
    }
    const o = body as Record<string, unknown>;
    const platformVisitorId = typeof o.platformVisitorId === 'string' ? o.platformVisitorId.trim() : '';
    const name = typeof o.name === 'string' ? o.name.trim() : '';
    const email = typeof o.email === 'string' ? o.email.trim() : '';

    if (!platformVisitorId || !isValidPlatformVisitorIdFormat(platformVisitorId)) {
      throw new HttpException(
        {
          error: 'platformVisitorId is required and must be a valid stable id.',
          status: 'error',
          errorCode: 'INVALID_PLATFORM_VISITOR_ID',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
    if (!name || name.length > 120) {
      throw new HttpException(
        { error: 'Name is required (max 120 characters).', status: 'error', errorCode: 'INVALID_NAME' },
        HttpStatus.BAD_REQUEST,
      );
    }
    if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new HttpException(
        { error: 'A valid email address is required.', status: 'error', errorCode: 'INVALID_EMAIL' },
        HttpStatus.BAD_REQUEST,
      );
    }

    const emailNormalized = email.toLowerCase();
    const composite = createHash('sha256')
      .update(`${platformVisitorId}|${emailNormalized}`, 'utf8')
      .digest('hex')
      .slice(0, 48);
    const rateKey = `${RATE_KEY_PREFIX}:${composite}`;
    const rate = await this.rateLimitService.check({
      key: rateKey,
      limit: RATE_LIMIT_PER_HOUR,
      windowMs: RATE_WINDOW_MS,
    });
    if (!rate.allowed) {
      throw new HttpException(
        {
          error: 'Too many requests. Try again later.',
          status: 'error',
          errorCode: 'RATE_LIMITED',
          retryAfterSeconds: 3600,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const ctaContext = parseCta(o);

    try {
      const { rawToken } = await this.visitorsService.issueLandingTrialAccessToken({
        platformVisitorId,
        name,
        emailNormalized,
        ctaContext,
      });

      const verifyUrl = this.emailService.buildTrialVerifyUrl(rawToken);
      if (!verifyUrl) {
        throw new HttpException(
          {
            error:
              'Email links are not configured (set LANDING_PUBLIC_SITE_URL to your marketing site origin, e.g. https://www.assistrio.com).',
            status: 'error',
            errorCode: 'NOT_CONFIGURED',
          },
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      const emailResult = await this.emailService.sendTrialAccessEmail({
        toEmail: emailNormalized,
        recipientName: name,
        verifyUrl,
      });

      if (!emailResult.ok) {
        const isMissingKey = emailResult.reason === 'missing_api_key';
        throw new HttpException(
          {
            error: isMissingKey
              ? 'Email delivery is not configured (RESEND_API_KEY).'
              : emailResult.message,
            status: 'error',
            errorCode: isMissingKey ? 'EMAIL_NOT_CONFIGURED' : 'EMAIL_SEND_FAILED',
          },
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      return {
        ok: true as const,
        emailId: emailResult.id,
      };
    } catch (e) {
      if (e instanceof HttpException) throw e;
      const msg = e instanceof Error ? e.message : 'Failed to issue access token';
      console.error('[LandingTrialAccess] issueLandingTrialAccessToken', e);
      throw new HttpException(
        { error: msg, status: 'error', errorCode: 'INTERNAL_ERROR' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
