import {
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { Types } from 'mongoose';
import { CustomerSessionAuthGuard } from '../auth/customer/customer-session.guard';
import type { RequestUser } from '../auth/shared/request-user.types';
import { BotsService } from '../bots/bots.service';
import { ChatEngineService } from '../chat/chat-engine.service';
import { parseWorkspaceConversationListFilters } from '../chat/workspace-conversation-serialize.util';
import { WorkspaceAnalyticsEntitlementService } from '../entitlements/workspace-analytics-entitlement.service';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { workspaceIdFromBotRecord } from './shared/customer-analytics-entitlement.types';

type RequestWithUser = FastifyRequest & { user?: RequestUser };

/**
 * Tenant-scoped conversation read APIs (`ar_customer_session`). Same data shape as admin, without global analytics.
 */
@Controller('api/customer/bots')
@UseGuards(CustomerSessionAuthGuard)
export class CustomerBotConversationsController {
  constructor(
    private readonly botsService: BotsService,
    private readonly chatEngineService: ChatEngineService,
    private readonly workspacesService: WorkspacesService,
    private readonly analyticsEntitlementService: WorkspaceAnalyticsEntitlementService,
  ) {}

  private async requireWorkspaceBot(req: RequestWithUser, botId: string) {
    const bot = await this.botsService.findOne(botId);
    if (!bot) {
      throw new NotFoundException('AI Agent not found');
    }
    const uid = req.user?._id != null ? String(req.user._id) : '';
    const ok = await this.workspacesService.canUserAccessWorkspaceBot(
      uid,
      req.user?.role ?? '',
      bot as Record<string, unknown>,
    );
    if (!ok) {
      throw new ForbiddenException({ error: 'Forbidden' });
    }
    return bot;
  }

  @Get(':id/conversations')
  async listConversations(@Req() req: RequestWithUser, @Param('id') id: string) {
    const bot = await this.requireWorkspaceBot(req, id);
    const q = (req.query ?? {}) as Record<string, string | string[] | undefined>;
    const limitRaw = Array.isArray(q.limit) ? q.limit[0] : q.limit;
    const beforeRaw = Array.isArray(q.before) ? q.before[0] : q.before;
    const limit = Math.min(50, Math.max(1, parseInt(String(limitRaw ?? '30'), 10) || 30));
    const beforeIso = typeof beforeRaw === 'string' && beforeRaw.trim() ? beforeRaw.trim() : null;
    const filtersRaw = parseWorkspaceConversationListFilters(q);
    const workspaceId = workspaceIdFromBotRecord(bot as Record<string, unknown>);
    let filters = filtersRaw;
    let analyticsWindow: Awaited<
      ReturnType<WorkspaceAnalyticsEntitlementService['clampListDateFrom']>
    >['window'] = null;
    if (workspaceId) {
      const clamped = await this.analyticsEntitlementService.clampListDateFrom(
        workspaceId,
        filtersRaw.dateFrom,
      );
      filters = { ...filtersRaw, dateFrom: clamped.dateFrom };
      analyticsWindow = clamped.window;
    }
    const result = await this.chatEngineService.listBotConversationsForWorkspace({
      botOid: new Types.ObjectId(String((bot as { _id: unknown })._id)),
      limit,
      beforeIso,
      filters,
    });
    return analyticsWindow ? { ...result, analyticsWindow } : result;
  }

  @Get(':id/conversations/:conversationId')
  async getConversationDetail(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Param('conversationId') conversationId: string,
  ) {
    const bot = await this.requireWorkspaceBot(req, id);
    const detail = await this.chatEngineService.getBotConversationDetailForWorkspace({
      botOid: new Types.ObjectId(String((bot as { _id: unknown })._id)),
      conversationId,
    });
    if (!detail) {
      throw new NotFoundException('Conversation not found');
    }
    return detail;
  }

  @Get(':id/conversations/:conversationId/messages')
  async conversationMessages(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Param('conversationId') conversationId: string,
  ) {
    const bot = await this.requireWorkspaceBot(req, id);
    const messages = await this.chatEngineService.getBotConversationMessagesForWorkspace({
      botOid: new Types.ObjectId(String((bot as { _id: unknown })._id)),
      conversationId,
    });
    if (!messages) {
      throw new NotFoundException('Conversation not found');
    }
    return { ok: true, messages };
  }
}
