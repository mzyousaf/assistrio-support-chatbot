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
import { EmailService } from '../email/email.service';
import { RateLimitService } from '../rate-limit/rate-limit.service';
import { LandingSiteApiKeyGuard } from '../landing-site-api-key/landing-site-api-key.guard';

const RATE_KEY_PREFIX = 'anon_pub:landing_contact';
const RATE_LIMIT_PER_HOUR = 12;
const RATE_WINDOW_MS = 60 * 60 * 1000;

const MAX = { name: 120, email: 254, subject: 200, message: 12_000 } as const;

/**
 * Server-to-server: assistrio-landing-site `POST /api/contact` proxies here with `X-API-Key`.
 */
@Controller('api/landing')
@UseGuards(LandingSiteApiKeyGuard)
export class LandingContactController {
  constructor(
    private readonly emailService: EmailService,
    private readonly rateLimitService: RateLimitService,
  ) {}

  @Post('contact')
  async contact(@Req() req: FastifyRequest, @Body() body: unknown) {
    if (body == null || typeof body !== 'object') {
      throw new HttpException(
        { error: 'Invalid JSON body', status: 'error', errorCode: 'BAD_REQUEST' },
        HttpStatus.BAD_REQUEST,
      );
    }
    const o = body as Record<string, unknown>;

    const name = typeof o.name === 'string' ? o.name.trim() : '';
    const email = typeof o.email === 'string' ? o.email.trim() : '';
    const message = typeof o.message === 'string' ? o.message.trim() : '';
    const subjectRaw = typeof o.subject === 'string' ? o.subject.trim() : '';

    if (!name || name.length > MAX.name) {
      throw new HttpException(
        { error: 'Name is required (max 120 characters).', status: 'error', errorCode: 'INVALID_NAME' },
        HttpStatus.BAD_REQUEST,
      );
    }
    if (!email || email.length > MAX.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new HttpException(
        { error: 'A valid email address is required.', status: 'error', errorCode: 'INVALID_EMAIL' },
        HttpStatus.BAD_REQUEST,
      );
    }
    if (!message || message.length > MAX.message) {
      throw new HttpException(
        { error: 'Message is required.', status: 'error', errorCode: 'INVALID_MESSAGE' },
        HttpStatus.BAD_REQUEST,
      );
    }

    const emailNormalized = email.toLowerCase();
    const composite = createHash('sha256')
      .update(`${emailNormalized}|${name.slice(0, MAX.name)}`, 'utf8')
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

    const subject =
      subjectRaw.length > 0
        ? subjectRaw.slice(0, MAX.subject)
        : `Contact form: ${name.slice(0, 40)}${name.length > 40 ? '…' : ''}`;

    const result = await this.emailService.sendContactToSupport({
      name,
      email: emailNormalized,
      message,
      subject: subject.slice(0, MAX.subject),
    });

    if (!result.ok) {
      const isMissingKey = result.reason === 'missing_api_key';
      throw new HttpException(
        {
          error: isMissingKey
            ? 'Contact delivery is not configured (RESEND_API_KEY).'
            : result.message,
          status: 'error',
          errorCode: isMissingKey ? 'EMAIL_NOT_CONFIGURED' : 'EMAIL_SEND_FAILED',
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    return { ok: true as const, id: result.id };
  }
}
