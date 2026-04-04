import type { FastifyRequest } from 'fastify';
import { getClientIpForRateLimit } from '../bots/embed-runtime-rate-limit.util';
import { PUBLIC_ANONYMOUS_RATE_LIMIT_WINDOW_MS } from './public-anonymous-rate-limit.constants';
import { throwPublicAnonymousRateLimited } from './rate-limit-http-exception.util';
import { RateLimitService } from './rate-limit.service';

/**
 * Enforces a per-IP fixed window limit for anonymous public routes (Mongo-backed; shared across instances).
 * @throws HttpException 429 with `errorCode: RATE_LIMITED`, `retryAfterSeconds`, `deploymentHint` when exceeded.
 */
export async function enforcePublicAnonymousRateLimit(
  rateLimitService: RateLimitService,
  req: FastifyRequest,
  keyPrefix: string,
  maxPerWindow: number,
): Promise<void> {
  if (maxPerWindow <= 0) return;
  const ip = getClientIpForRateLimit(req);
  const key = `${keyPrefix}:${ip}`;
  const r = await rateLimitService.check({
    key,
    limit: maxPerWindow,
    windowMs: PUBLIC_ANONYMOUS_RATE_LIMIT_WINDOW_MS,
  });
  if (!r.allowed) {
    throwPublicAnonymousRateLimited();
  }
}
