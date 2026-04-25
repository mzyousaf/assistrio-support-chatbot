import {
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { Types } from 'mongoose';
import { CustomerSessionAuthGuard } from '../auth/customer/customer-session.guard';
import type { RequestUser } from '../auth/shared/request-user.types';
import { BotsService } from '../bots/bots.service';
import { ChatEngineService } from '../chat/chat-engine.service';
import { WorkspacesService } from '../workspaces/workspaces.service';

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

  @Get(':id/conversations')
  async listConversations(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Query('limit') limitRaw?: string,
    @Query('before') before?: string,
  ) {
    const bot = await this.requireWorkspaceBot(req, id);
    const limit = Math.min(50, Math.max(1, parseInt(String(limitRaw ?? '30'), 10) || 30));
    const beforeIso = typeof before === 'string' && before.trim() ? before.trim() : null;
    return this.chatEngineService.listBotConversationsForWorkspace({
      botOid: new Types.ObjectId(String((bot as { _id: unknown })._id)),
      limit,
      beforeIso,
    });
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
