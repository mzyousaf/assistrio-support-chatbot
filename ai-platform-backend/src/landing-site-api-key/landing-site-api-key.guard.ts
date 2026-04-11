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
 * Validates `X-API-Key` against `landingSiteXApiKey` from env `LANDING_SITE_X_API_KEY`.
 * Used for marketing-site → API calls (gallery, PV proxies, landing forms, analytics ingestion from landing).
 */
@Injectable()
export class LandingSiteApiKeyGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.configService.get<string>('landingSiteXApiKey')?.trim() ?? '';
    if (!expected) {
      throw new HttpException(
        { error: 'Landing site API is not configured (LANDING_SITE_X_API_KEY)' },
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
