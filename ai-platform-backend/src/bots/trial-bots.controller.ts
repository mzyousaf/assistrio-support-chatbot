import { Body, Controller, HttpException, HttpStatus, Post } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { BotsService } from './bots.service';
import { VisitorsService } from '../visitors/visitors.service';

type TrialBotCreateBody = {
  platformVisitorId?: unknown;
  visitorId?: unknown;
  name?: unknown;
  welcomeMessage?: unknown;
  shortDescription?: unknown;
  description?: unknown;
  imageUrl?: unknown;
  avatarEmoji?: unknown;
};

function sanitizeOptionalString(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLength);
}

function isLikelyVisitorId(value: string): boolean {
  return /^[a-zA-Z0-9._:-]{6,120}$/.test(value);
}

function parseCreateBody(body: unknown): {
  platformVisitorId?: string;
  visitorId?: string;
  name?: string;
  welcomeMessage?: string;
  shortDescription?: string;
  description?: string;
  imageUrl?: string;
  avatarEmoji?: string;
} {
  if (body == null || typeof body !== 'object') return {};
  const input = body as TrialBotCreateBody;
  const platformVisitorIdRaw = typeof input.platformVisitorId === 'string' ? input.platformVisitorId.trim() : '';
  const platformVisitorId =
    platformVisitorIdRaw && isLikelyVisitorId(platformVisitorIdRaw) ? platformVisitorIdRaw : undefined;

  // Deprecated legacy payload field.
  const visitorIdRaw = typeof input.visitorId === 'string' ? input.visitorId.trim() : '';
  const visitorId = visitorIdRaw && isLikelyVisitorId(visitorIdRaw) ? visitorIdRaw : undefined;

  return {
    platformVisitorId,
    visitorId,
    name: sanitizeOptionalString(input.name, 100),
    welcomeMessage: sanitizeOptionalString(input.welcomeMessage, 500),
    shortDescription: sanitizeOptionalString(input.shortDescription, 180),
    description: sanitizeOptionalString(input.description, 1500),
    imageUrl: sanitizeOptionalString(input.imageUrl, 1000),
    avatarEmoji: sanitizeOptionalString(input.avatarEmoji, 12),
  };
}

@Controller('api/trial/bots')
export class TrialBotsController {
  constructor(
    private readonly botsService: BotsService,
    private readonly visitorsService: VisitorsService,
  ) {}

  @Post()
  async createTrialBot(@Body() body: unknown) {
    const parsed = parseCreateBody(body);
    const platformVisitorId = parsed.platformVisitorId ?? parsed.visitorId ?? `v_${randomUUID().replace(/-/g, '')}`;

    try {
      await this.visitorsService.getOrCreateVisitor(platformVisitorId);
      const created = await this.botsService.createVisitorTrialBot({
        platformVisitorId,
        name: parsed.name,
        welcomeMessage: parsed.welcomeMessage,
        shortDescription: parsed.shortDescription,
        description: parsed.description,
        imageUrl: parsed.imageUrl,
        avatarEmoji: parsed.avatarEmoji,
      });
      await this.visitorsService.createVisitorEvent({
        platformVisitorId,
        type: 'trial_bot_created',
        botId: created.botId,
        botSlug: created.slug,
      });

      return {
        ok: true,
        // New field name:
        platformVisitorId: platformVisitorId,
        // Deprecated alias:
        visitorId: platformVisitorId,
        bot: {
          id: created.botId,
          slug: created.slug,
          name: created.name,
          type: created.type,
          status: created.status,
          visibility: created.visibility,
          isPublic: created.isPublic,
          accessKey: created.accessKey,
          welcomeMessage: created.welcomeMessage,
          imageUrl: created.imageUrl,
          avatarEmoji: created.avatarEmoji,
          messageLimitMode: created.messageLimitMode,
          messageLimitTotal: created.messageLimitTotal,
          messageLimitUpgradeMessage: created.messageLimitUpgradeMessage,
        },
      };
    } catch (error) {
      console.error('Create visitor trial bot failed', error);
      throw new HttpException(
        { error: 'Failed to create trial bot' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
