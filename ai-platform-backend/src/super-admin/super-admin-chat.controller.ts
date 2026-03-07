import {
  Body,
  Controller,
  HttpCode,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { Types } from 'mongoose';
import { BotsService } from '../bots/bots.service';
import { ChatEngineService } from '../chat/chat-engine.service';
import type { BotLike } from '../chat/chat-engine.types';
import { SuperAdminGuard } from './super-admin.guard';

const ADMIN_VISITOR_ID_PREFIX = 'sa:';

interface SuperAdminChatBody {
  message?: string;
}

@Controller('api/super-admin/bots')
@UseGuards(SuperAdminGuard)
export class SuperAdminChatController {
  constructor(
    private readonly botsService: BotsService,
    private readonly chatEngineService: ChatEngineService,
  ) {}

  @Post(':id/chat')
  @HttpCode(HttpStatus.OK)
  async chat(
    @Param('id') id: string,
    @Body() body: SuperAdminChatBody,
    @Req() request: FastifyRequest,
  ) {
    if (!Types.ObjectId.isValid(id)) {
      throw new HttpException({ error: 'Invalid bot id' }, HttpStatus.BAD_REQUEST);
    }

    const message = typeof body?.message === 'string' ? body.message.trim() : '';
    if (!message) {
      throw new HttpException(
        { error: 'message is required' },
        HttpStatus.BAD_REQUEST,
      );
    }

    const bot = await this.botsService.findOneShowcaseForAdmin(id);
    if (!bot || (bot as { type?: string }).type !== 'showcase') {
      throw new HttpException({ error: 'Bot not found' }, HttpStatus.NOT_FOUND);
    }

    const adminUser = (request as unknown as { superAdminUser?: { _id: unknown } }).superAdminUser;
    const adminId = adminUser?._id != null ? String(adminUser._id) : 'anonymous';
    const visitorId = `${ADMIN_VISITOR_ID_PREFIX}${adminId}`;

    const botLike: BotLike = {
      _id: (bot as { _id: { toString(): string } })._id,
      openaiApiKeyOverride: (bot as { openaiApiKeyOverride?: string }).openaiApiKeyOverride,
      welcomeMessage: (bot as { welcomeMessage?: string }).welcomeMessage,
      personality: (bot as { personality?: unknown }).personality as BotLike['personality'],
      config: (bot as { config?: unknown }).config as BotLike['config'],
      faqs: (bot as { faqs?: unknown }).faqs as BotLike['faqs'],
    };

    const chatResult = await this.chatEngineService.runChat({
      bot: botLike,
      visitorId,
      message,
      mode: 'super_admin',
      userApiKey: undefined,
    });

    if (!chatResult.ok) {
      throw new HttpException(chatResult, HttpStatus.BAD_REQUEST);
    }

    return {
      ok: true,
      conversationId: chatResult.conversationId,
      assistantMessage: chatResult.assistantMessage,
      sources: chatResult.sources,
    };
  }
}
