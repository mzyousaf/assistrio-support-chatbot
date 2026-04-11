import { Body, Controller, Headers, HttpException, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { LandingSiteApiKeyGuard } from '../landing-site-api-key/landing-site-api-key.guard';
import { BotsService } from './bots.service';

/**
 * Session-authenticated trial agent creation from persisted onboarding draft (landing BFF only).
 */
@Controller('api/landing/trial')
@UseGuards(LandingSiteApiKeyGuard)
export class LandingTrialCreateAgentController {
  constructor(private readonly botsService: BotsService) {}

  /**
   * Optional body: `{ "persistGoLive": true }` — reserved; go-live data should already be PATCHed from the client.
   */
  @Post('create-agent')
  async createAgent(
    @Headers('x-trial-dashboard-session-token') sessionToken: string | undefined,
    @Body() _body: unknown,
  ) {
    const raw = typeof sessionToken === 'string' ? sessionToken.trim() : '';
    if (!raw) {
      throw new HttpException(
        { error: 'Missing session', errorCode: 'SESSION_INVALID' },
        HttpStatus.UNAUTHORIZED,
      );
    }
    try {
      return await this.botsService.createTrialAgentFromOnboardingSession(raw);
    } catch (e) {
      if (e instanceof HttpException) throw e;
      const msg = e instanceof Error ? e.message : 'Failed to create agent';
      console.error('[LandingTrialCreateAgent]', e);
      throw new HttpException(
        { error: msg, errorCode: 'CREATE_AGENT_FAILED' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
