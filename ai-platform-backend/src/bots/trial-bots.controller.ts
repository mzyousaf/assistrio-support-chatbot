import { Body, Controller, HttpException, HttpStatus, Post } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { BotsService } from './bots.service';
import { VisitorsService } from '../visitors/visitors.service';

type TrialBotCreateBody = {
  platformVisitorId?: unknown;
  visitorId?: unknown;
  /** Single hostname where the widget may load (required). */
  allowedDomain?: unknown;
  /** Alternative: first entry used if allowedDomain is omitted. */
  allowedDomains?: unknown;
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

function parseAllowedDomainForTrial(input: TrialBotCreateBody): string {
  const single = typeof input.allowedDomain === 'string' ? input.allowedDomain.trim() : '';
  if (single) return single;
  if (Array.isArray(input.allowedDomains) && input.allowedDomains.length > 0) {
    const first = input.allowedDomains[0];
    if (typeof first === 'string' && first.trim()) return first.trim();
  }
  return '';
}

function parseCreateBody(body: unknown): {
  platformVisitorId?: string;
  visitorId?: string;
  allowedDomain: string;
  name?: string;
  welcomeMessage?: string;
  shortDescription?: string;
  description?: string;
  imageUrl?: string;
  avatarEmoji?: string;
} {
  if (body == null || typeof body !== 'object') {
    return { allowedDomain: '' };
  }
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
    allowedDomain: parseAllowedDomainForTrial(input),
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

    if (!parsed.allowedDomain.trim()) {
      throw new HttpException(
        {
          error:
            'allowedDomain is required: pass the hostname where the widget may load (e.g. window.location.hostname).',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      await this.visitorsService.getOrCreateVisitor(platformVisitorId);
      const created = await this.botsService.createVisitorTrialBot({
        platformVisitorId,
        allowedDomain: parsed.allowedDomain,
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
      if (error instanceof HttpException) throw error;
      console.error('Create visitor trial bot failed', error);
      const msg = error instanceof Error ? error.message : '';
      if (msg.includes('allowedDomain')) {
        throw new HttpException({ error: msg }, HttpStatus.BAD_REQUEST);
      }
      throw new HttpException(
        { error: 'Failed to create trial bot' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
