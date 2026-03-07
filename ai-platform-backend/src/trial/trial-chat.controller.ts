import {
  Body,
  Controller,
  HttpCode,
  HttpException,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { AnalyticsService } from '../analytics/analytics.service';
import { BotsService } from '../bots/bots.service';
import { ChatEngineService } from '../chat/chat-engine.service';
import type { BotLike } from '../chat/chat-engine.types';
import { LimitsService } from '../limits/limits.service';
import { RateLimitService } from '../rate-limit/rate-limit.service';
import { VisitorsService } from '../visitors/visitors.service';
import {
  getNextUtcMidnightIso,
  getTrialRateLimitKey,
  getTrialRateLimitWindowMs,
  parseTrialChatBody,
} from './trial-chat.dto';

@Controller('api/trial')
export class TrialChatController {
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
  async chat(@Body() body: unknown) {
    const parsed = parseTrialChatBody(body);
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

    const bot = await this.botsService.findOneBySlugTrial(botSlug);
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
    const rateKey = getTrialRateLimitKey(visitorId, String((bot as { _id: unknown })._id), now);
    const rate = await this.rateLimitService.check({
      key: rateKey,
      limit,
      windowMs: getTrialRateLimitWindowMs(),
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
      mode: 'trial',
      userApiKey: requestApiKey,
    });

    if (!chatResult.ok) {
      throw new HttpException(chatResult, HttpStatus.BAD_REQUEST);
    }

    if (chatResult.isNewConversation) {
      await this.analyticsService.logVisitorEvent({
        visitorId,
        type: 'trial_chat_started',
        botSlug: (bot as { slug: string }).slug,
        botId: String((bot as { _id: unknown })._id),
        metadata: { source: 'trial_chat_api' },
      });
    }

    return {
      ok: true,
      assistantMessage: chatResult.assistantMessage,
      sources: chatResult.sources,
      reply: chatResult.assistantMessage,
      usage: { allowed: true, current: rate.count, limit },
      conversationId: chatResult.conversationId,
    };
  }
}
