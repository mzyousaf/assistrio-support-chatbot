import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { AdminSessionAuthGuard } from '../auth/admin/admin-session.guard';
import { SuperAdminGuard } from '../auth/admin/super-admin.guard';
import { BotsService } from '../bots/bots.service';
import { ChatEngineService } from '../chat/chat-engine.service';

/**
 * List / read visitor conversations for a bot (staff superadmin session).
 * Routes must stay under `api/admin/bots/:id/...` so they do not shadow `GET :id` on the shared workspace controller.
 */
@Controller('api/admin/bots')
@UseGuards(AdminSessionAuthGuard, SuperAdminGuard)
export class AdminBotConversationsController {
  constructor(
    private readonly botsService: BotsService,
    private readonly chatEngineService: ChatEngineService,
  ) {}

  @Get(':id/conversations')
  async listConversations(
    @Param('id') id: string,
    @Query('limit') limitRaw?: string,
    @Query('before') before?: string,
  ) {
    const bot = await this.botsService.findOne(id);
    if (!bot) {
      throw new NotFoundException('Bot not found');
    }
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
    @Param('id') id: string,
    @Param('conversationId') conversationId: string,
  ) {
    const bot = await this.botsService.findOne(id);
    if (!bot) {
      throw new NotFoundException('Bot not found');
    }
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
