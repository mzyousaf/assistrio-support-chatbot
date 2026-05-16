import type { FastifyRequest } from 'fastify';

/**
 * Public base URL for the API (matches browser `VITE_API_BASE_URL` / widget `apiBaseUrl`).
 * Uses proxy headers when present.
 */
export function publicApiBaseUrlFromRequest(req: FastifyRequest): string {
  const xfProto = req.headers['x-forwarded-proto'];
  const rawProto = Array.isArray(xfProto) ? xfProto[0] : xfProto;
  const proto =
    (typeof rawProto === 'string' && rawProto.trim() ? rawProto.split(',')[0].trim() : '') || 'http';
  const xfHost = req.headers['x-forwarded-host'];
  const rawHost = Array.isArray(xfHost) ? xfHost[0] : xfHost;
  const host =
    (typeof rawHost === 'string' && rawHost.trim() ? rawHost.trim() : '') ||
    (typeof req.headers.host === 'string' ? req.headers.host : '') ||
    `localhost:${process.env.PORT ?? '3001'}`;
  return `${proto}://${host}`.replace(/\/$/, '');
}
