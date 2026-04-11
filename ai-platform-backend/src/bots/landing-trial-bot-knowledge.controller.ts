import { Body, Controller, Get, Headers, HttpException, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { LandingSiteApiKeyGuard } from '../landing-site-api-key/landing-site-api-key.guard';
import { BotsService } from './bots.service';

/**
 * Session-authenticated trial playground: real knowledge state for the created visitor bot.
 */
@Controller('api/landing/trial')
@UseGuards(LandingSiteApiKeyGuard)
export class LandingTrialBotKnowledgeController {
  constructor(private readonly botsService: BotsService) {}

  @Get('bot-knowledge')
  async getKnowledge(@Headers('x-trial-dashboard-session-token') sessionToken: string | undefined) {
    const raw = typeof sessionToken === 'string' ? sessionToken.trim() : '';
    if (!raw) {
      throw new HttpException(
        { error: 'Missing session', errorCode: 'SESSION_INVALID' },
        HttpStatus.UNAUTHORIZED,
      );
    }
    try {
      return await this.botsService.getTrialBotKnowledgeSummaryForSession(raw);
    } catch (e) {
      if (e instanceof HttpException) throw e;
      const msg = e instanceof Error ? e.message : 'Failed to load knowledge';
      console.error('[LandingTrialBotKnowledge]', e);
      throw new HttpException(
        { error: msg, errorCode: 'BOT_KNOWLEDGE_FAILED' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('bot-knowledge/retry')
  async retryDocument(
    @Headers('x-trial-dashboard-session-token') sessionToken: string | undefined,
    @Body() body: { documentId?: string },
  ) {
    const raw = typeof sessionToken === 'string' ? sessionToken.trim() : '';
    if (!raw) {
      throw new HttpException(
        { error: 'Missing session', errorCode: 'SESSION_INVALID' },
        HttpStatus.UNAUTHORIZED,
      );
    }
    const documentId = typeof body?.documentId === 'string' ? body.documentId.trim() : '';
    if (!documentId) {
      throw new HttpException(
        { error: 'documentId is required.', errorCode: 'INVALID_BODY' },
        HttpStatus.BAD_REQUEST,
      );
    }
    try {
      return await this.botsService.retryTrialBotFailedDocumentIngestForSession(raw, documentId);
    } catch (e) {
      if (e instanceof HttpException) throw e;
      const msg = e instanceof Error ? e.message : 'Retry failed';
      console.error('[LandingTrialBotKnowledge retry]', e);
      throw new HttpException(
        { error: msg, errorCode: 'BOT_KNOWLEDGE_RETRY_FAILED' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
