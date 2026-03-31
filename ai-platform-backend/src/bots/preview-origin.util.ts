import type { FastifyRequest } from 'fastify';
import { hostnameFromEmbedOrigin, isHostnameAllowed, resolveRuntimeEmbedOriginFromHeaders } from './embed-domain.util';

/**
 * True when the browser `Origin` resolves to a host allowed for `/api/widget/preview/*`.
 * `allowedBaseHosts` are base hostnames (e.g. `assistrio.com`); subdomains match the same rules as runtime embed domains.
 */
export function isPreviewRequestOriginAllowed(
  headers: FastifyRequest['headers'],
  allowedBaseHosts: string[],
): boolean {
  if (!Array.isArray(allowedBaseHosts) || allowedBaseHosts.length === 0) return false;
  const resolved = resolveRuntimeEmbedOriginFromHeaders(headers);
  if (!resolved) return false;
  const host = hostnameFromEmbedOrigin(resolved);
  if (!host) return false;
  return isHostnameAllowed(host, allowedBaseHosts);
}
