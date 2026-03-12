/**
 * Extract request ID from incoming request headers for logging and tracing.
 * Prefers x-request-id, then x-correlation-id. Safe for use with Fastify/Nest.
 */

export type RequestLike = { headers?: Record<string, string | string[] | undefined> };

const HEADERS = ['x-request-id', 'x-correlation-id'] as const;

/**
 * Get request ID from request headers if present.
 * Returns trimmed string or undefined if absent.
 */
export function getRequestId(req: RequestLike | null | undefined): string | undefined {
  if (!req?.headers || typeof req.headers !== 'object') return undefined;
  for (const name of HEADERS) {
    const val = req.headers[name];
    if (typeof val === 'string' && val.trim()) return val.trim();
    if (Array.isArray(val) && val[0] && String(val[0]).trim()) return String(val[0]).trim();
  }
  return undefined;
}
