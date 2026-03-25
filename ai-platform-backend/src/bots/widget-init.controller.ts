import { Body, Controller, HttpException, HttpStatus, Post } from '@nestjs/common';
import { BotsService } from './bots.service';

type WidgetInitBody = {
  botId?: unknown;
  accessKey?: unknown;
};

function parseInitBody(body: unknown): { botId: string } | null {
  if (body == null || typeof body !== 'object') return null;
  const o = body as WidgetInitBody;
  const botId = typeof o.botId === 'string' ? o.botId.trim() : '';
  if (!botId) return null;
  return { botId };
}

/**
 * Standalone embeddable widget bootstrap. Public — no auth.
 * Request may include `accessKey` (ignored until optional embed auth is added on Bot).
 */
@Controller('api/widget')
export class WidgetInitController {
  constructor(private readonly botsService: BotsService) {}

  @Post('init')
  async init(@Body() body: unknown) {
    const parsed = parseInitBody(body);
    if (!parsed) {
      throw new HttpException({ error: 'Invalid request body', status: 'error' }, HttpStatus.BAD_REQUEST);
    }

    const row = await this.botsService.findOneForPublicWidgetById(parsed.botId);
    if (!row) {
      throw new HttpException(
        { error: 'Bot not found or not available for embedding', status: 'error' },
        HttpStatus.NOT_FOUND,
      );
    }

    const brandingMessage =
      typeof row.chatUI.brandingMessage === 'string' ? row.chatUI.brandingMessage.trim() : undefined;

    return {
      status: 'ok' as const,
      bot: {
        id: row.id,
        name: row.name,
        imageUrl: row.imageUrl,
        avatarEmoji: row.avatarEmoji,
        tagline: row.shortDescription,
        description: row.description,
        welcomeMessage: row.welcomeMessage,
        suggestedQuestions: row.exampleQuestions,
        exampleQuestions: row.exampleQuestions,
      },
      settings: {
        chatUI: row.chatUI,
        ...(brandingMessage ? { brandingMessage } : {}),
      },
    };
  }
}
