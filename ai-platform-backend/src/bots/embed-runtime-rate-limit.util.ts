import type { FastifyRequest } from 'fastify';

const buckets = new Map<string, { count: number; windowStart: number }>();
const WINDOW_MS = 60_000;
const MAX_BUCKETS = 50_000;

/** Fixed window for {@link consumeEmbedRuntimeRateLimitToken} (in-process; per API instance). */
export const EMBED_RUNTIME_RATE_LIMIT_WINDOW_MS = WINDOW_MS;

/**
 * Client IP for rate limiting.
 *
 * **Primary:** `req.ip` (Fastify). When `trustProxy` is enabled on the adapter (`main.ts` + `TRUST_PROXY=1`),
 * this is derived from `X-Forwarded-For` / `X-Real-IP` per Fastify’s trusted proxy rules — **not** raw socket address.
 *
 * **When `trustProxy` is false:** `req.ip` is typically the **direct TCP peer** (often the load balancer). All
 * customers behind that LB then **share one rate-limit bucket** unless you enable `TRUST_PROXY` and your proxy
 * sends `X-Forwarded-For`.
 *
 * **Fallback:** If `req.ip` is empty, first hop of `x-forwarded-for` (useful in some tests; production should rely on `req.ip`).
 */
export function getClientIpForRateLimit(req: FastifyRequest): string {
  const direct = req.ip;
  if (typeof direct === 'string' && direct.trim()) return direct.trim();
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string') {
    const first = xf.split(',')[0]?.trim();
    if (first) return first;
  } else if (Array.isArray(xf) && xf.length > 0) {
    const first = String(xf[0]).split(',')[0]?.trim();
    if (first) return first;
  }
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
