import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { Types } from 'mongoose';
import { AdminSessionAuthGuard } from '../auth/admin/admin-session.guard';
import { SuperAdminGuard } from '../auth/admin/super-admin.guard';
import type { RequestUser } from '../auth/shared/request-user.types';
import { BotsService } from '../bots/bots.service';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { KnowledgeOverviewService } from './knowledge-overview.service';
import { RateLimitService } from '../rate-limit/rate-limit.service';
import { assertKnowledgeTrainQueueRateLimit } from './shared/knowledge-train-queue-rate-limit.util';
import { KnowledgeBaseItemService } from '../knowledge/knowledge-base-item.service';
import { KnowledgeItemManualRetryService } from './knowledge-item-manual-retry.service';

type RequestWithUser = FastifyRequest & { user?: RequestUser };

function parseKbRowIndexParam(raw: string, label: string): number {
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
    throw new HttpException({ error: `Invalid ${label}` }, HttpStatus.BAD_REQUEST);
  }
  return n;
}

function parseJsonObjectBody(body: unknown): Record<string, unknown> {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpException({ error: 'Invalid body' }, HttpStatus.BAD_REQUEST);
  }
  return body as Record<string, unknown>;
}

function parseJsonArrayBody(body: unknown): unknown[] {
  if (!Array.isArray(body)) {
    throw new HttpException({ error: 'Body must be a JSON array', errorCode: 'invalid_body' }, HttpStatus.BAD_REQUEST);
  }
  return body;
}

@Controller('api/admin/bots/:id/knowledge')
@UseGuards(AdminSessionAuthGuard, SuperAdminGuard)
export class AdminKnowledgeController {
  constructor(
    private readonly knowledgeOverview: KnowledgeOverviewService,
    private readonly botsService: BotsService,
    private readonly workspacesService: WorkspacesService,
    private readonly rateLimitService: RateLimitService,
    private readonly knowledgeBaseItemService: KnowledgeBaseItemService,
    private readonly knowledgeItemManualRetry: KnowledgeItemManualRetryService,
  ) {}

  private async assertCanAccess(req: RequestWithUser, botId: string): Promise<void> {
    if (!Types.ObjectId.isValid(botId)) {
      throw new HttpException({ error: 'Invalid id' }, HttpStatus.BAD_REQUEST);
    }
    const bot = await this.botsService.findOne(botId);
    if (!bot) {
      throw new HttpException({ error: 'Bot not found' }, HttpStatus.NOT_FOUND);
    }
    const uid = req.user?._id != null ? String(req.user._id) : '';
    const ok = await this.workspacesService.canUserAccessWorkspaceBot(uid, req.user?.role ?? '', bot as Record<string, unknown>);
    if (!ok) {
      throw new HttpException({ error: 'Forbidden' }, HttpStatus.FORBIDDEN);
    }
  }

  @Post('items/bulk-delete')
  async bulkDeleteKnowledgeItems(@Param('id') id: string, @Body() body: unknown, @Req() req: RequestWithUser) {
    await this.assertCanAccess(req, id);
    try {
      const o = parseJsonObjectBody(body);
      const raw = o.itemIds;
      if (!Array.isArray(raw) || raw.length === 0) {
        throw new HttpException(
          { error: 'itemIds must be a non-empty array', errorCode: 'invalid_body' },
          HttpStatus.BAD_REQUEST,
        );
      }
      const itemIds = raw.map((x) => String(x ?? '').trim());
      return await this.knowledgeBaseItemService.workspaceBulkDeleteKnowledgeItemsByRouteIds(id, itemIds);
    } catch (e) {
      if (e instanceof HttpException) throw e;
      console.error('[admin-knowledge] POST items/bulk-delete', e);
      throw new HttpException({ error: 'Internal server error' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('items/:itemId/retry')
  async retryKnowledgeItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Req() req: RequestWithUser,
  ) {
    await this.assertCanAccess(req, id);
    try {
      return await this.knowledgeItemManualRetry.manualRetry(id, itemId);
    } catch (e) {
      if (e instanceof HttpException) throw e;
      console.error('[admin-knowledge] items/:itemId/retry', e);
      throw new HttpException({ error: 'Internal server error' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Patch('items/:itemId/use-in-replies')
  async patchKnowledgeItemUseInReplies(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() body: unknown,
    @Req() req: RequestWithUser,
  ) {
    await this.assertCanAccess(req, id);
    try {
      const o = parseJsonObjectBody(body);
      const useInReplies = o.useInReplies;
      if (typeof useInReplies !== 'boolean') {
        throw new HttpException(
          { error: 'useInReplies must be boolean', errorCode: 'invalid_body' },
          HttpStatus.BAD_REQUEST,
        );
      }
      const ok = await this.knowledgeBaseItemService.setKnowledgeItemActiveById(id, itemId, useInReplies);
      if (!ok) {
        throw new HttpException(
          { error: 'Knowledge item not found', errorCode: 'kb_item_not_found' },
          HttpStatus.NOT_FOUND,
        );
      }
      return { ok: true };
    } catch (e) {
      if (e instanceof HttpException) throw e;
      console.error('[admin-knowledge] PATCH items/:itemId/use-in-replies', e);
      throw new HttpException({ error: 'Internal server error' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('training/status')
  async getTrainingStatusAggregate(@Param('id') id: string, @Req() req: RequestWithUser) {
    await this.assertCanAccess(req, id);
    try {
      return await this.knowledgeOverview.getAgentTrainingStatus(id);
    } catch (e) {
      if (e instanceof HttpException) throw e;
      console.error('[admin-knowledge] training/status', e);
      throw new HttpException({ error: 'Internal server error' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('training/pending-items')
  async getPendingTrainingItems(@Param('id') id: string, @Req() req: RequestWithUser) {
    await this.assertCanAccess(req, id);
    try {
      return await this.knowledgeOverview.getPendingTrainingItems(id);
    } catch (e) {
      if (e instanceof HttpException) throw e;
      console.error('[admin-knowledge] training/pending-items', e);
      throw new HttpException({ error: 'Internal server error' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('training/retrain-agent')
  async retrainAgent(@Param('id') id: string, @Body() body: unknown, @Req() req: RequestWithUser) {
    await this.assertCanAccess(req, id);
    await assertKnowledgeTrainQueueRateLimit(
      this.rateLimitService,
      id,
      req.user?._id != null ? String(req.user._id) : '',
    );
    try {
      return await this.knowledgeOverview.retrainAgent(id, body);
    } catch (e) {
      if (e instanceof HttpException) throw e;
      console.error('[admin-knowledge] retrain-agent', e);
      throw new HttpException({ error: 'Internal server error' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Delete('items/:itemId')
  async deleteKnowledgeItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Req() req: RequestWithUser,
  ) {
    await this.assertCanAccess(req, id);
    try {
      return await this.knowledgeBaseItemService.workspaceDeleteKnowledgeItemByRouteId(id, itemId);
    } catch (e) {
      if (e instanceof HttpException) throw e;
      console.error('[admin-knowledge] DELETE items/:itemId', e);
      throw new HttpException({ error: 'Internal server error' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('overview')
  async getOverview(@Param('id') id: string, @Req() req: RequestWithUser) {
    await this.assertCanAccess(req, id);
    try {
      return await this.knowledgeOverview.getOverviewForBot(id);
    } catch (e) {
      if (e instanceof HttpException) throw e;
      console.error('[admin-knowledge] overview', e);
      throw new HttpException({ error: 'Internal server error' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('status')
  async getKnowledgeStatus(
    @Param('id') id: string,
    @Query('type') type: string | undefined,
    @Query('itemId') itemId: string | undefined,
    @Req() req: RequestWithUser,
  ) {
    await this.assertCanAccess(req, id);
    try {
      return await this.knowledgeOverview.listKnowledgeItemStatus(id, type, itemId);
    } catch (e) {
      if (e instanceof HttpException) throw e;
      console.error('[admin-knowledge] status', e);
      throw new HttpException({ error: 'Internal server error' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Patch('faqs/:faqIndex')
  async patchFaqRow(
    @Param('id') id: string,
    @Param('faqIndex') faqIndex: string,
    @Body() body: unknown,
    @Req() req: RequestWithUser,
  ) {
    await this.assertCanAccess(req, id);
    try {
      const idx = parseKbRowIndexParam(faqIndex, 'FAQ index');
      const payload = parseJsonObjectBody(body);
      await this.botsService.patchWorkspaceBotKnowledgeFaqAtIndex(id, idx, payload);
      return { ok: true as const };
    } catch (e) {
      if (e instanceof HttpException) throw e;
      console.error('[admin-knowledge] faqs/:faqIndex', e);
      throw new HttpException({ error: 'Internal server error' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Patch('snippets/:snippetIndex')
  async patchSnippetRow(
    @Param('id') id: string,
    @Param('snippetIndex') snippetIndex: string,
    @Body() body: unknown,
    @Req() req: RequestWithUser,
  ) {
    await this.assertCanAccess(req, id);
    try {
      const idx = parseKbRowIndexParam(snippetIndex, 'snippet index');
      const payload = parseJsonObjectBody(body);
      await this.botsService.patchWorkspaceBotKnowledgeSnippetAtIndex(id, idx, payload);
      return { ok: true as const };
    } catch (e) {
      if (e instanceof HttpException) throw e;
      console.error('[admin-knowledge] snippets/:snippetIndex', e);
      throw new HttpException({ error: 'Internal server error' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Patch('datasheets/:tableIndex')
  async patchDatasheetRow(
    @Param('id') id: string,
    @Param('tableIndex') tableIndex: string,
    @Body() body: unknown,
    @Req() req: RequestWithUser,
  ) {
    await this.assertCanAccess(req, id);
    try {
      const idx = parseKbRowIndexParam(tableIndex, 'datasheet index');
      const payload = parseJsonObjectBody(body);
      await this.botsService.patchWorkspaceBotKnowledgeTableAtIndex(id, idx, payload);
      return { ok: true as const };
    } catch (e) {
      if (e instanceof HttpException) throw e;
      console.error('[admin-knowledge] datasheets/:tableIndex', e);
      throw new HttpException({ error: 'Internal server error' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('faqs')
  async postFaqAppend(@Param('id') id: string, @Body() body: unknown, @Req() req: RequestWithUser) {
    await this.assertCanAccess(req, id);
    try {
      const payload = parseJsonObjectBody(body);
      return await this.botsService.postWorkspaceBotKnowledgeFaqAppend(id, payload);
    } catch (e) {
      if (e instanceof HttpException) throw e;
      console.error('[admin-knowledge] POST faqs', e);
      throw new HttpException({ error: 'Internal server error' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('snippets')
  async postSnippetAppend(@Param('id') id: string, @Body() body: unknown, @Req() req: RequestWithUser) {
    await this.assertCanAccess(req, id);
    try {
      const payload = parseJsonObjectBody(body);
      return await this.botsService.postWorkspaceBotKnowledgeSnippetAppend(id, payload);
    } catch (e) {
      if (e instanceof HttpException) throw e;
      console.error('[admin-knowledge] POST snippets', e);
      throw new HttpException({ error: 'Internal server error' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('datasheets')
  async postDatasheetAppend(@Param('id') id: string, @Body() body: unknown, @Req() req: RequestWithUser) {
    await this.assertCanAccess(req, id);
    try {
      const payload = parseJsonObjectBody(body);
      return await this.botsService.postWorkspaceBotKnowledgeDatasheetAppend(id, payload);
    } catch (e) {
      if (e instanceof HttpException) throw e;
      console.error('[admin-knowledge] POST datasheets', e);
      throw new HttpException({ error: 'Internal server error' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('suggestions/sync')
  async postSuggestionsSync(@Param('id') id: string, @Body() body: unknown, @Req() req: RequestWithUser) {
    await this.assertCanAccess(req, id);
    try {
      const list = parseJsonArrayBody(body);
      await this.botsService.syncWorkspaceBotKnowledgeSuggestionsFromPayload(id, list);
      return { ok: true as const };
    } catch (e) {
      if (e instanceof HttpException) throw e;
      console.error('[admin-knowledge] POST suggestions/sync', e);
      throw new HttpException({ error: 'Internal server error' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('suggestions')
  async postSuggestionAppend(@Param('id') id: string, @Body() body: unknown, @Req() req: RequestWithUser) {
    await this.assertCanAccess(req, id);
    try {
      const payload = parseJsonObjectBody(body);
      return await this.botsService.postWorkspaceBotKnowledgeSuggestionAppend(id, payload);
    } catch (e) {
      if (e instanceof HttpException) throw e;
      console.error('[admin-knowledge] POST suggestions', e);
      throw new HttpException({ error: 'Internal server error' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Patch('description')
  async patchKnowledgeDescription(@Param('id') id: string, @Body() body: unknown, @Req() req: RequestWithUser) {
    await this.assertCanAccess(req, id);
    try {
      await this.botsService.patchWorkspaceBotKnowledgeDescription(id, body);
      return { ok: true as const };
    } catch (e) {
      if (e instanceof HttpException) throw e;
      console.error('[admin-knowledge] PATCH description', e);
      throw new HttpException({ error: 'Internal server error' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Patch('training-settings')
  async patchTrainingSettings(@Param('id') id: string, @Body() body: unknown, @Req() req: RequestWithUser) {
    await this.assertCanAccess(req, id);
    try {
      return await this.knowledgeOverview.patchTrainingSettings(id, body);
    } catch (e) {
      if (e instanceof HttpException) throw e;
      console.error('[admin-knowledge] training-settings', e);
      throw new HttpException({ error: 'Internal server error' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('training/train-now')
  async trainNow(@Param('id') id: string, @Body() body: unknown, @Req() req: RequestWithUser) {
    await this.assertCanAccess(req, id);
    await assertKnowledgeTrainQueueRateLimit(
      this.rateLimitService,
      id,
      req.user?._id != null ? String(req.user._id) : '',
    );
    try {
      return await this.knowledgeOverview.trainKnowledgeNow(id, body);
    } catch (e) {
      if (e instanceof HttpException) throw e;
      console.error('[admin-knowledge] train-now', e);
      throw new HttpException({ error: 'Internal server error' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('training/queue-pending')
  async queuePending(@Param('id') id: string, @Req() req: RequestWithUser) {
    await this.assertCanAccess(req, id);
    await assertKnowledgeTrainQueueRateLimit(
      this.rateLimitService,
      id,
      req.user?._id != null ? String(req.user._id) : '',
    );
    try {
      return await this.knowledgeOverview.queuePendingItems(id);
    } catch (e) {
      if (e instanceof HttpException) throw e;
      console.error('[admin-knowledge] queue-pending', e);
      throw new HttpException({ error: 'Internal server error' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('training/retry-failed')
  async retryFailed(@Param('id') id: string, @Req() req: RequestWithUser) {
    await this.assertCanAccess(req, id);
    await assertKnowledgeTrainQueueRateLimit(
      this.rateLimitService,
      id,
      req.user?._id != null ? String(req.user._id) : '',
    );
    try {
      return await this.knowledgeOverview.retryFailedItems(id);
    } catch (e) {
      if (e instanceof HttpException) throw e;
      console.error('[admin-knowledge] retry-failed', e);
      throw new HttpException({ error: 'Internal server error' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
