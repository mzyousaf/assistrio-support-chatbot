import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import { FastifyRequest } from 'fastify';
import { ENV_CHAT_WIDGET_API_KEY } from '../lib/env-var-names';

function safeCompare(expected: string, provided: string): boolean {
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(provided, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Guard for widget runtime + testing endpoints.
 * Accepts `X-API-Key` or `Authorization: Bearer` using the key from `ENV_CHAT_WIDGET_API_KEY` (see `src/lib/env-var-names.ts`).
 */
@Injectable()
export class ChatWidgetApiKeyGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  private extractProvidedKey(request: FastifyRequest): string {
    const raw = request.headers['x-api-key'];
    const fromX = typeof raw === 'string' ? raw.trim() : Array.isArray(raw) ? String(raw[0]).trim() : '';
    if (fromX) return fromX;
    const auth = request.headers.authorization;
    if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
      return auth.slice(7).trim();
    }
    return '';
  }

  canActivate(context: ExecutionContext): boolean {
    const expected = this.configService.get<string>('chatWidgetApiKey')?.trim() ?? '';
    if (!expected) {
      throw new HttpException(
        { error: `Chat widget runtime API is not configured (set ${ENV_CHAT_WIDGET_API_KEY})` },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const provided = this.extractProvidedKey(request);

    if (!provided || !safeCompare(expected, provided)) {
      throw new UnauthorizedException({ error: 'Invalid or missing widget API key' });
    }

    return true;
  }
}

