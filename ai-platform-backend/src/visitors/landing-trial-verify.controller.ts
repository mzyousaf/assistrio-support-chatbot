import { Body, Controller, HttpException, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { LandingSiteApiKeyGuard } from '../landing-site-api-key/landing-site-api-key.guard';
import { VisitorsService } from './visitors.service';

/**
 * Marketing-site-only: magic-link verify and trial dashboard session validation.
 * All routes require `X-API-Key` (landing server → Nest).
 */
@Controller('api/landing/trial')
@UseGuards(LandingSiteApiKeyGuard)
export class LandingTrialVerifyController {
  constructor(private readonly visitorsService: VisitorsService) {}

  /**
   * Consumes a one-time magic link token and returns an opaque session token for httpOnly cookie (landing sets cookie).
   */
  @Post('verify')
  async verify(@Body() body: unknown) {
    if (body == null || typeof body !== 'object') {
      throw new HttpException(
        { error: 'Invalid body', errorCode: 'BAD_REQUEST' },
        HttpStatus.BAD_REQUEST,
      );
    }
    const token = typeof (body as { token?: unknown }).token === 'string' ? (body as { token: string }).token : '';
    const out = await this.visitorsService.verifyLandingTrialMagicLink(token);
    return {
      ok: true as const,
      sessionToken: out.sessionToken,
      maxAgeSeconds: out.maxAgeSeconds,
    };
  }

  /**
   * Validates an existing dashboard session token (opaque cookie value).
   */
  @Post('session/validate')
  async validateSession(@Body() body: unknown) {
    if (body == null || typeof body !== 'object') {
      throw new HttpException(
        { error: 'Invalid body', errorCode: 'BAD_REQUEST' },
        HttpStatus.BAD_REQUEST,
      );
    }
    const sessionToken =
      typeof (body as { sessionToken?: unknown }).sessionToken === 'string'
        ? (body as { sessionToken: string }).sessionToken
        : '';
    const row = await this.visitorsService.validateTrialDashboardSession(sessionToken);
    if (!row) {
      throw new HttpException({ error: 'Invalid or expired session', errorCode: 'SESSION_INVALID' }, HttpStatus.UNAUTHORIZED);
    }
    return {
      ok: true as const,
      platformVisitorId: row.platformVisitorId,
      emailNormalized: row.emailNormalized,
      name: row.name,
      sessionExpiresAt: row.expiresAt.toISOString(),
    };
  }
}
