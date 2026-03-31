import type { FastifyRequest } from 'fastify';

const buckets = new Map<string, { count: number; windowStart: number }>();
const WINDOW_MS = 60_000;
const MAX_BUCKETS = 50_000;

/** Client IP for runtime embed rate limiting (trust proxy must be configured for req.ip / X-Forwarded-For). */
export function getClientIpForRateLimit(req: FastifyRequest): string {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string') {
    const first = xf.split(',')[0]?.trim();
    if (first) return first;
  } else if (Array.isArray(xf) && xf.length > 0) {
    const first = String(xf[0]).split(',')[0]?.trim();
    if (first) return first;
  }
  const ip = req.ip;
  if (typeof ip === 'string' && ip.trim()) return ip.trim();
  return 'unknown';
}

/**
 * Fixed-window limiter for runtime embed traffic (in-process only; use a shared store in multi-instance deployments).
 * @returns true if the request is allowed, false if rate limited.
 */
export function consumeEmbedRuntimeRateLimitToken(clientKey: string, maxPerMinute: number): boolean {
  if (maxPerMinute <= 0) return true;
  if (buckets.size > MAX_BUCKETS) {
    buckets.clear();
  }
  const now = Date.now();
  const k = clientKey || 'unknown';
  const b = buckets.get(k);
  if (!b || now - b.windowStart >= WINDOW_MS) {
    buckets.set(k, { count: 1, windowStart: now });
    return true;
  }
  if (b.count >= maxPerMinute) {
    return false;
  }
  b.count += 1;
  return true;
}

export const EMBED_RUNTIME_RATE_LIMIT_KEY_PREFIX = 'embed_rt';
