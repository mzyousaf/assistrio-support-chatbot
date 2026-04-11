import {
  Body,
  Controller,
  Get,
  Headers,
  HttpException,
  HttpStatus,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { LandingSiteApiKeyGuard } from '../landing-site-api-key/landing-site-api-key.guard';
import { BotsService } from './bots.service';

/**
 * Trial Playground: read/update the created visitor bot (session + draft trialAgent.botId + ownerVisitorId).
 */
@Controller('api/landing/trial')
@UseGuards(LandingSiteApiKeyGuard)
export class LandingTrialWorkspaceAgentController {
  constructor(private readonly botsService: BotsService) {}

  private sessionHeader(raw: string | undefined): string {
    const s = typeof raw === 'string' ? raw.trim() : '';
    if (!s) {
      throw new HttpException(
        { error: 'Missing session', errorCode: 'SESSION_INVALID' },
        HttpStatus.UNAUTHORIZED,
      );
    }
    return s;
  }

  @Get('agent')
  async getAgent(@Headers('x-trial-dashboard-session-token') sessionToken: string | undefined) {
    const raw = this.sessionHeader(sessionToken);
    try {
      return await this.botsService.getTrialWorkspaceAgentForSession(raw);
    } catch (e) {
      if (e instanceof HttpException) throw e;
      console.error('[LandingTrialWorkspaceAgent GET]', e);
      throw new HttpException(
        { error: 'Could not load agent.', errorCode: 'AGENT_LOAD_FAILED' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Patch('agent/profile')
  async patchProfile(
    @Headers('x-trial-dashboard-session-token') sessionToken: string | undefined,
    @Body() body: unknown,
  ) {
    const raw = this.sessionHeader(sessionToken);
    try {
      return await this.botsService.patchTrialWorkspaceProfileForSession(raw, body);
    } catch (e) {
      if (e instanceof HttpException) throw e;
      console.error('[LandingTrialWorkspaceAgent PATCH profile]', e);
      throw new HttpException(
        { error: 'Could not save profile.', errorCode: 'AGENT_PROFILE_SAVE_FAILED' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Patch('agent/behavior')
  async patchBehavior(
    @Headers('x-trial-dashboard-session-token') sessionToken: string | undefined,
    @Body() body: unknown,
  ) {
    const raw = this.sessionHeader(sessionToken);
    try {
      return await this.botsService.patchTrialWorkspaceBehaviorForSession(raw, body);
    } catch (e) {
      if (e instanceof HttpException) throw e;
      console.error('[LandingTrialWorkspaceAgent PATCH behavior]', e);
      throw new HttpException(
        { error: 'Could not save behavior.', errorCode: 'AGENT_BEHAVIOR_SAVE_FAILED' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Patch('agent/knowledge')
  async patchKnowledge(
    @Headers('x-trial-dashboard-session-token') sessionToken: string | undefined,
    @Body() body: unknown,
  ) {
    const raw = this.sessionHeader(sessionToken);
    try {
      return await this.botsService.patchTrialWorkspaceKnowledgeForSession(raw, body);
    } catch (e) {
      if (e instanceof HttpException) throw e;
      console.error('[LandingTrialWorkspaceAgent PATCH knowledge]', e);
      throw new HttpException(
        { error: 'Could not save knowledge.', errorCode: 'AGENT_KNOWLEDGE_SAVE_FAILED' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
