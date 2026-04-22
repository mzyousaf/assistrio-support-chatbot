import { Body, Controller, HttpException, HttpStatus, Param, Post, Req, UseGuards } from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { Types } from 'mongoose';
import { CustomerSessionAuthGuard } from '../auth/customer/customer-session.guard';
import type { RequestUser } from '../auth/shared/request-user.types';
import { BotsService } from '../bots/bots.service';
import { DocumentsService } from '../documents/documents.service';
import { KnowledgeBaseItemService } from '../knowledge/knowledge-base-item.service';
import { KnowledgeBaseChunkService } from '../knowledge/knowledge-base-chunk.service';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { BotOnboardingService } from './shared/bot-onboarding.service';
import { parseBotLifecycleActionBody } from './shared/bot-lifecycle-action.dto';
import { publicApiBaseUrlFromRequest } from './shared/public-api-url.util';
import { WorkspaceBotsControllerBase } from './shared/workspace-bots.controller.base';

type RequestWithUser = FastifyRequest & { user?: RequestUser };

/** Customer workspace bot APIs (`/api/customer/bots/*`; `ar_customer_session` only). */
@Controller('api/customer/bots')
@UseGuards(CustomerSessionAuthGuard)
export class CustomerBotsController extends WorkspaceBotsControllerBase {
  constructor(
    botsService: BotsService,
    documentsService: DocumentsService,
    botOnboardingService: BotOnboardingService,
    knowledgeBaseItemService: KnowledgeBaseItemService,
    knowledgeBaseChunkService: KnowledgeBaseChunkService,
    workspacesService: WorkspacesService,
  ) {
    super(
      botsService,
      documentsService,
      botOnboardingService,
      knowledgeBaseItemService,
      knowledgeBaseChunkService,
      workspacesService,
    );
  }

  /**
   * Dedicated publish/draft lifecycle (not sparse PATCH). Validates business rules, updates `status`, returns embed snippet on publish.
   */
  @Post(':id/lifecycle-action')
  async postBotLifecycleAction(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: RequestWithUser,
  ) {
    if (!Types.ObjectId.isValid(id)) {
      throw new HttpException({ error: 'Invalid id' }, HttpStatus.BAD_REQUEST);
    }
    const parsed = parseBotLifecycleActionBody(body);
    if (!parsed) {
      throw new HttpException({ error: 'action must be "publish" or "draft"' }, HttpStatus.BAD_REQUEST);
    }
    await this.assertCanAccessWorkspaceBot(req, id);
    const publicApiBase = publicApiBaseUrlFromRequest(req);
    const widgetAsset =
      process.env.CHAT_WIDGET_ASSET_ORIGIN?.trim().replace(/\/$/, '') || 'https://widget.assistrio.com';
    try {
      return await this.botsService.customerBotLifecycleAction(id, parsed.action, {
        publicApiBaseUrl: publicApiBase,
        widgetAssetOrigin: widgetAsset,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Lifecycle action failed';
      if (msg === 'Bot not found') {
        throw new HttpException({ error: 'Bot not found' }, HttpStatus.NOT_FOUND);
      }
      if (
        msg.includes('Name is required') ||
        msg.includes('Description is required') ||
        msg.includes('allowed embed origin')
      ) {
        throw new HttpException({ error: msg }, HttpStatus.BAD_REQUEST);
      }
      console.error('[customer-bots] lifecycle-action failed', err);
      throw new HttpException({ error: 'Internal server error' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
