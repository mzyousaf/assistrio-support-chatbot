import { Body, Controller, HttpException, HttpStatus, Post } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { BotsService } from './bots.service';
import { validateRuntimeBotAccess } from './runtime-bot-access.util';
import { toRuntimeCredentialErrorCode } from './runtime-error-codes.util';

type WidgetInitBody = {
  botId?: unknown;
  accessKey?: unknown;
  secretKey?: unknown;
  /**
   * Optional chat identity (chatVisitorId).
   * When omitted, backend generates one so the widget can persist it locally.
   */
  chatVisitorId?: unknown;
};

function parseInitBody(
  body: unknown,
): { botId: string; accessKey?: string; secretKey?: string; chatVisitorId?: string } | null {
  if (body == null || typeof body !== 'object') return null;
  const o = body as WidgetInitBody;
  const botId = typeof o.botId === 'string' ? o.botId.trim() : '';
  if (!botId) return null;
  const accessKey = typeof o.accessKey === 'string' ? o.accessKey.trim() : '';
  const secretKey = typeof o.secretKey === 'string' ? o.secretKey.trim() : '';
  const chatVisitorId = typeof o.chatVisitorId === 'string' ? o.chatVisitorId.trim() : '';
  return {
    botId,
    ...(accessKey ? { accessKey } : {}),
    ...(secretKey ? { secretKey } : {}),
    ...(chatVisitorId ? { chatVisitorId } : {}),
  };
}

/**
 * Standalone embeddable widget bootstrap. Public — key-authenticated at runtime.
 */
@Controller('api/widget')
export class WidgetInitController {
  constructor(private readonly botsService: BotsService) {}

  @Post('init')
  async init(@Body() body: unknown) {
    const parsed = parseInitBody(body);
    if (!parsed) {
      throw new HttpException(
        { error: 'Invalid request body', status: 'error', errorCode: 'BAD_REQUEST' },
        HttpStatus.BAD_REQUEST,
      );
    }

    const row = await this.botsService.findOneByIdForExternalRuntime(parsed.botId);
    if (!row) {
      throw new HttpException(
        {
          error: 'Bot not found or not available for embedding',
          status: 'error',
          errorCode: 'BOT_NOT_FOUND',
        },
        HttpStatus.NOT_FOUND,
      );
    }
    const access = validateRuntimeBotAccess(
      {
        status: (row.status as string | undefined) ?? undefined,
        visibility: (row.visibility as 'public' | 'private' | undefined) ?? undefined,
        accessKey: (row.accessKey as string | undefined) ?? undefined,
        secretKey: (row.secretKey as string | undefined) ?? undefined,
      },
      { accessKey: parsed.accessKey, secretKey: parsed.secretKey },
    );
    if (!access.ok) {
      if (access.reason === 'unpublished') {
        throw new HttpException(
          {
            error: 'Bot not found or not available for embedding',
            status: 'error',
            errorCode: 'BOT_NOT_PUBLISHED',
          },
          HttpStatus.NOT_FOUND,
        );
      }
      throw new HttpException(
        {
          error: 'Invalid bot access credentials',
          status: 'error',
          errorCode: toRuntimeCredentialErrorCode(access),
        },
        HttpStatus.FORBIDDEN,
      );
    }

    const chatUI = (row.chatUI ?? {}) as Record<string, unknown>;

    const brandingMessage =
      typeof chatUI.brandingMessage === 'string' ? chatUI.brandingMessage.trim() : undefined;

    const chatVisitorId =
      parsed.chatVisitorId && parsed.chatVisitorId.trim()
        ? parsed.chatVisitorId
        : `c_${randomUUID().replace(/-/g, '')}`;

    return {
      status: 'ok' as const,
      bot: {
        id: String(row._id ?? ''),
        name: String(row.name ?? ''),
        imageUrl: typeof row.imageUrl === 'string' ? row.imageUrl : undefined,
        avatarEmoji: typeof row.avatarEmoji === 'string' ? row.avatarEmoji : undefined,
        tagline: typeof row.shortDescription === 'string' ? row.shortDescription : undefined,
        description: typeof row.description === 'string' ? row.description : undefined,
        welcomeMessage: typeof row.welcomeMessage === 'string' ? row.welcomeMessage : undefined,
        suggestedQuestions: Array.isArray(row.exampleQuestions) ? row.exampleQuestions : [],
        exampleQuestions: Array.isArray(row.exampleQuestions) ? row.exampleQuestions : [],
      },
      settings: {
        chatUI,
        ...(brandingMessage ? { brandingMessage } : {}),
      },
      chatVisitorId,
    };
  }
}
