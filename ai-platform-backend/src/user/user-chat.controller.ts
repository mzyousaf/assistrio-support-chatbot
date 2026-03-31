import {
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { getRequestId } from '../lib/request-id.helper';
import { BotsService } from '../bots/bots.service';
import { ChatEngineService } from '../chat/chat-engine.service';
import type { BotLike } from '../chat/chat-engine.types';
import { AuthGuard, type RequestUser } from '../auth/auth.guard';
import { WorkspacesService } from '../workspaces/workspaces.service';

type RequestWithUser = FastifyRequest & { user?: RequestUser };

function parseBody(body: unknown): { message: string } | null {
  if (body == null || typeof body !== 'object') return null;
  const o = body as Record<string, unknown>;
  const message = typeof o.message === 'string' ? o.message.trim() : '';
  if (!message) return null;
  return { message };
}

@Controller('api/user/bots')
@UseGuards(AuthGuard)
export class UserChatController {
  constructor(
    private readonly botsService: BotsService,
    private readonly chatEngineService: ChatEngineService,
    private readonly workspacesService: WorkspacesService,
  ) {}

  @Post(':botId/chat')
  async runChat(
    @Param('botId') botId: string,
    @Body() body: unknown,
    @Query('debug') debugQuery: string | undefined,
    @Req() req: RequestWithUser,
  ) {
    const parsed = parseBody(body);
    if (!parsed) {
      throw new HttpException({ error: 'Invalid request body' }, HttpStatus.BAD_REQUEST);
    }
    const adminUser = req.user;
    const chatVisitorId = adminUser?._id != null ? String(adminUser._id) : 'anonymous';

    const bot = await this.botsService.findOneShowcaseForAdmin(botId);
    if (!bot || (bot as { type?: string }).type !== 'showcase') {
      throw new HttpException({ error: 'Bot not found' }, HttpStatus.NOT_FOUND);
    }
    const uid = adminUser?._id != null ? String(adminUser._id) : '';
    const can = await this.workspacesService.canUserAccessShowcaseBot(
      uid,
      adminUser?.role ?? 'customer',
      bot as Record<string, unknown>,
    );
    if (!can) {
      throw new HttpException({ error: 'Forbidden' }, HttpStatus.FORBIDDEN);
    }

    const b = bot as Record<string, unknown>;
    const botLike: BotLike = {
      _id: (b._id as { toString(): string }),
      name: (b.name as string) ?? '',
      shortDescription: (b.shortDescription as string) ?? '',
      description: (b.description as string) ?? '',
      category: (b.category as string) ?? '',
      openaiApiKeyOverride: (b.openaiApiKeyOverride as string) ?? undefined,
      welcomeMessage: (b.welcomeMessage as string) ?? '',
      knowledgeDescription: (b.knowledgeDescription as string) ?? '',
      leadCapture: (b.leadCapture as BotLike['leadCapture']) ?? undefined,
      personality: (b.personality as BotLike['personality']) ?? undefined,
      config: (b.config as BotLike['config']) ?? undefined,
      faqs: (b.faqs as BotLike['faqs']) ?? undefined,
    };

    const debug = debugQuery === 'true' || debugQuery === '1';
    const chatResult = await this.chatEngineService.runChat({
      bot: botLike,
      chatVisitorId,
      // For admin chat we treat the platform identity as both identities temporarily.
      // (chat identity migration can be made stricter later.)
      platformVisitorId: chatVisitorId,
      message: parsed.message,
      mode: 'user',
      requestId: getRequestId(req),
      debug,
    });

    if (!chatResult.ok) {
      throw new HttpException(chatResult, HttpStatus.BAD_REQUEST);
    }

    return {
      ok: true,
      conversationId: chatResult.conversationId,
      assistantMessage: chatResult.assistantMessage,
      sources: chatResult.sources,
      ...(debug && chatResult.debug != null && { debug: chatResult.debug }),
    };
  }
}
