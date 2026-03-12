import {
  Body,
  Controller,
  HttpCode,
  HttpException,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { getRequestId } from '../lib/request-id.helper';
import { AnalyticsService } from '../analytics/analytics.service';
import { BotsService } from '../bots/bots.service';
import { ChatEngineService } from '../chat/chat-engine.service';
import type { BotLike } from '../chat/chat-engine.types';
import { LimitsService } from '../limits/limits.service';
import { RateLimitService } from '../rate-limit/rate-limit.service';
import { VisitorsService } from '../visitors/visitors.service';
import {
  getDemoRateLimitKey,
  getDemoRateLimitWindowMs,
  getNextUtcMidnightIso,
  parseDemoChatBody,
} from './demo-chat.dto';

@Controller('api/demo')
export class DemoChatController {
  constructor(
    private readonly botsService: BotsService,
    private readonly visitorsService: VisitorsService,
    private readonly limitsService: LimitsService,
    private readonly rateLimitService: RateLimitService,
    private readonly chatEngineService: ChatEngineService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  @Post('chat')
  @HttpCode(HttpStatus.OK)
  async chat(@Body() body: unknown, @Req() req: FastifyRequest) {
    const parsed = parseDemoChatBody(body);
    if (!parsed) {
      throw new HttpException(
        { error: 'Invalid request body' },
        HttpStatus.BAD_REQUEST,
      );
    }

    const { botSlug, message, visitorId, userApiKey, openaiApiKey, apiKey } = parsed;
    const requestApiKey =
      (openaiApiKey && openaiApiKey.length > 0 ? openaiApiKey : undefined) ||
      (userApiKey && userApiKey.length > 0 ? userApiKey : undefined) ||
      (apiKey && apiKey.length > 0 ? apiKey : undefined);

    const bot = await this.botsService.findOneBySlugForChat(botSlug);
    if (!bot) {
      throw new HttpException({ error: 'Bot not found' }, HttpStatus.NOT_FOUND);
    }

    const visitor = await this.visitorsService.getOrCreateVisitor(visitorId);
    const hasUserApiKey = Boolean(requestApiKey);
    const limit = this.limitsService.getMessageLimit({
      bot: {
        type: (bot as { type?: string }).type,
        limitOverrideMessages: (bot as { limitOverrideMessages?: number }).limitOverrideMessages,
      },
      visitor: {
        limitOverrideMessages: (visitor as { limitOverrideMessages?: number }).limitOverrideMessages,
      },
      hasUserApiKey,
    });

    const now = new Date();
    const rateKey = getDemoRateLimitKey(visitorId, String((bot as { _id: unknown })._id), now);
    const rate = await this.rateLimitService.check({
      key: rateKey,
      limit,
      windowMs: getDemoRateLimitWindowMs(),
    });

    if (!rate.allowed) {
      throw new HttpException(
        {
          ok: false,
          error: 'rate_limited',
          limit,
          resetAt: getNextUtcMidnightIso(now),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const botLike: BotLike = {
      _id: (bot as { _id: { toString(): string } })._id,
      name: (bot as { name?: string }).name,
      shortDescription: (bot as { shortDescription?: string }).shortDescription,
      description: (bot as { description?: string }).description,
      category: (bot as { category?: string }).category,
      openaiApiKeyOverride: (bot as { openaiApiKeyOverride?: string }).openaiApiKeyOverride,
      welcomeMessage: (bot as { welcomeMessage?: string }).welcomeMessage,
      knowledgeDescription: (bot as { knowledgeDescription?: string }).knowledgeDescription,
      leadCapture: (bot as { leadCapture?: unknown }).leadCapture as BotLike['leadCapture'],
      personality: (bot as { personality?: unknown }).personality as BotLike['personality'],
      config: (bot as { config?: unknown }).config as BotLike['config'],
      faqs: (bot as { faqs?: unknown }).faqs as BotLike['faqs'],
    };
    const chatResult = await this.chatEngineService.runChat({
      bot: botLike,
      visitorId,
      message,
      mode: 'demo',
      userApiKey: requestApiKey,
      requestId: getRequestId(req),
    });

    if (!chatResult.ok) {
      throw new HttpException(chatResult, HttpStatus.BAD_REQUEST);
    }

    if (chatResult.isNewConversation) {
      await this.analyticsService.logVisitorEvent({
        visitorId,
        type: 'demo_chat_started',
        botSlug: (bot as { slug: string }).slug,
        botId: String((bot as { _id: unknown })._id),
        metadata: { source: 'demo_chat_api' },
      });
    }

    return {
      ok: true,
      conversationId: chatResult.conversationId,
      assistantMessage: chatResult.assistantMessage,
      sources: chatResult.sources,
    };
  }
}
