import { Body, Controller, Get, Headers, HttpException, HttpStatus, Patch, UseGuards } from '@nestjs/common';
import { LandingSiteApiKeyGuard } from '../landing-site-api-key/landing-site-api-key.guard';
import { VisitorsService } from './visitors.service';

/**
 * Trial onboarding draft — **server-to-server only** (assistrio-landing-site with `X-API-Key`).
 * Session token (`X-Trial-Dashboard-Session-Token`) **authorizes** access; draft data is keyed by
 * normalized email workspace (stable across devices), not by session alone.
 */
@Controller('api/landing/trial')
@UseGuards(LandingSiteApiKeyGuard)
export class LandingTrialDraftController {
  constructor(private readonly visitorsService: VisitorsService) {}

  @Get('draft')
  async getDraft(@Headers('x-trial-dashboard-session-token') sessionToken: string | undefined) {
    const raw = typeof sessionToken === 'string' ? sessionToken.trim() : '';
    if (!raw) {
      throw new HttpException(
        { error: 'Missing session', errorCode: 'SESSION_INVALID' },
        HttpStatus.UNAUTHORIZED,
      );
    }
    return this.visitorsService.getTrialOnboardingDraftForSessionToken(raw);
  }

  @Patch('draft')
  async patchDraft(
    @Headers('x-trial-dashboard-session-token') sessionToken: string | undefined,
    @Body() body: unknown,
  ) {
    const raw = typeof sessionToken === 'string' ? sessionToken.trim() : '';
    if (!raw) {
      throw new HttpException(
        { error: 'Missing session', errorCode: 'SESSION_INVALID' },
        HttpStatus.UNAUTHORIZED,
      );
    }
    return this.visitorsService.patchTrialOnboardingDraftForSessionToken(raw, body);
  }
}
