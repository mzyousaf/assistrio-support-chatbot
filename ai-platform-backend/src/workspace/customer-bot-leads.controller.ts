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
import {
  customerLeadFieldDefinitionsFromBot,
  parseWorkspaceLeadsListFilters,
} from '../chat/workspace-conversation-serialize.util';
import { WorkspacesService } from '../workspaces/workspaces.service';

type RequestWithUser = FastifyRequest & { user?: RequestUser };

/**
 * Tenant-scoped leads inbox backed by `Conversation` rows with `hasLead: true`.
 */
@Controller('api/customer/bots')
@UseGuards(CustomerSessionAuthGuard)
export class CustomerBotLeadsController {
  constructor(
    private readonly botsService: BotsService,
    private readonly chatEngineService: ChatEngineService,
    private readonly workspacesService: WorkspacesService,
  ) {}

  private async requireWorkspaceBot(req: RequestWithUser, botId: string) {
    const bot = await this.botsService.findOne(botId);
    if (!bot) {
      throw new NotFoundException('Bot not found');
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

  @Get(':id/leads')
  async listLeads(@Req() req: RequestWithUser, @Param('id') id: string) {
    const bot = await this.requireWorkspaceBot(req, id);
    const q = (req.query ?? {}) as Record<string, string | string[] | undefined>;
    const limitRaw = Array.isArray(q.limit) ? q.limit[0] : q.limit;
    const beforeRaw = Array.isArray(q.before) ? q.before[0] : q.before;
    const pageRaw = Array.isArray(q.page) ? q.page[0] : q.page;
    const limit = Math.min(50, Math.max(1, parseInt(String(limitRaw ?? '30'), 10) || 30));
    const beforeTrim = typeof beforeRaw === 'string' ? beforeRaw.trim() : '';
    /** Legacy cursor mode only when `before` is set and `page` is omitted. */
    const useBeforeCursor = Boolean(beforeTrim) && pageRaw === undefined;
    const beforeSortAtIso = useBeforeCursor ? beforeTrim : null;
    const page = Math.max(1, parseInt(String(pageRaw ?? '1'), 10) || 1);
    const skip = useBeforeCursor ? 0 : (page - 1) * limit;
    const pageReply = useBeforeCursor ? 1 : page;
    const filters = parseWorkspaceLeadsListFilters(q);
    const leadFieldDefinitions = customerLeadFieldDefinitionsFromBot(
      (bot as { leadCapture?: unknown }).leadCapture,
    );
    return this.chatEngineService.listBotLeadsForWorkspace({
      botOid: new Types.ObjectId(String((bot as { _id: unknown })._id)),
      limit,
      skip,
      page: pageReply,
      beforeSortAtIso,
      filters,
      leadFieldDefinitions,
    });
  }

  @Get(':id/leads/:conversationId')
  async getLeadDetail(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Param('conversationId') conversationId: string,
  ) {
    const bot = await this.requireWorkspaceBot(req, id);
    const leadFieldDefinitions = customerLeadFieldDefinitionsFromBot(
      (bot as { leadCapture?: unknown }).leadCapture,
    );
    const detail = await this.chatEngineService.getBotLeadDetailForWorkspace({
      botOid: new Types.ObjectId(String((bot as { _id: unknown })._id)),
      conversationId,
      leadFieldDefinitions,
    });
    if (!detail) {
      throw new NotFoundException('Lead not found');
    }
    return detail;
  }
}
