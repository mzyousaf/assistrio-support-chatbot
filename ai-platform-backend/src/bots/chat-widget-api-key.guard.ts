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

function safeCompare(expected: string, provided: string): boolean {
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(provided, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Guard for widget-only testing endpoints.
 * Expects header `X-API-Key: <CHAT_WIDGET_API_KEY value>`.
 */
@Injectable()
export class ChatWidgetApiKeyGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.configService.get<string>('chatWidgetApiKey')?.trim() ?? '';
    if (!expected) {
      throw new HttpException(
        { error: 'Chat widget testing API is not configured' },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const raw = request.headers['x-api-key'];
    const provided = Array.isArray(raw) ? raw[0] : raw;

    if (typeof provided !== 'string' || !safeCompare(expected, provided.trim())) {
      throw new UnauthorizedException({ error: 'Unauthorized' });
    }

    return true;
  }
}

