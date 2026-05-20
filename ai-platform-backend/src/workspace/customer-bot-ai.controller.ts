import {
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { Types } from 'mongoose';
import { CustomerSessionAuthGuard } from '../auth/customer/customer-session.guard';
import type { RequestUser } from '../auth/shared/request-user.types';
import { BotsService } from '../bots/bots.service';
import { ResponseStyleRefineService } from '../chat/response-style-refine.service';
import { WorkspacesService } from '../workspaces/workspaces.service';

type RequestWithUser = FastifyRequest & { user?: RequestUser };

function parseRefineBody(body: unknown): { description: string } | null {
  if (!body || typeof body !== 'object') return null;
  const description = typeof (body as { description?: unknown }).description === 'string'
    ? (body as { description: string }).description
    : '';
  if (!description.trim()) return null;
  return { description };
}

@Controller('api/customer/bots')
@UseGuards(CustomerSessionAuthGuard)
export class CustomerBotAiController {
  constructor(
    private readonly botsService: BotsService,
    private readonly workspacesService: WorkspacesService,
    private readonly responseStyleRefineService: ResponseStyleRefineService,
  ) {}

  private async assertCanAccessWorkspaceBot(req: RequestWithUser, botId: string): Promise<void> {
    const bot = await this.botsService.findOne(botId);
    if (!bot) {
      throw new HttpException({ error: 'Bot not found', errorCode: 'bot_not_found' }, HttpStatus.NOT_FOUND);
    }
    const uid = req.user?._id != null ? String(req.user._id) : '';
    const ok = await this.workspacesService.canUserAccessWorkspaceBot(
      uid,
      req.user?.role ?? '',
      bot as Record<string, unknown>,
    );
    if (!ok) {
      throw new HttpException({ error: 'Forbidden' }, HttpStatus.FORBIDDEN);
    }
  }

  /**
   * Refine a natural-language response format description into locked instructions (does not persist).
   */
  @Post(':botId/ai/response-style/refine')
  async refineResponseStyle(
    @Param('botId') botId: string,
    @Body() body: unknown,
    @Req() req: RequestWithUser,
  ) {
    if (!Types.ObjectId.isValid(botId)) {
      throw new HttpException({ error: 'Invalid bot id' }, HttpStatus.BAD_REQUEST);
    }
    await this.assertCanAccessWorkspaceBot(req, botId);
    const parsed = parseRefineBody(body);
    if (!parsed) {
      throw new HttpException({ error: 'description is required' }, HttpStatus.BAD_REQUEST);
    }

    const bot = await this.botsService.findOne(botId);
    const apiKey =
      typeof bot?.openaiApiKeyOverride === 'string' ? bot.openaiApiKeyOverride.trim() : undefined;

    try {
      const result = await this.responseStyleRefineService.refine(parsed.description, apiKey);
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === 'description_required' || msg === 'description_too_long') {
        throw new HttpException({ error: msg }, HttpStatus.BAD_REQUEST);
      }
      if (msg === 'missing_openai_key') {
        throw new HttpException({ error: 'OpenAI API key is not configured' }, HttpStatus.SERVICE_UNAVAILABLE);
      }
      if (msg === 'refine_parse_failed') {
        throw new HttpException({ error: 'Could not refine response style' }, HttpStatus.UNPROCESSABLE_ENTITY);
      }
      throw new HttpException({ error: 'Could not refine response style' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
