import type { FastifyReply, FastifyRequest } from 'fastify';

export function isCrossSiteRequest(request: FastifyRequest): boolean {
  const originHeader = request.headers.origin;
  const hostHeader = request.headers.host;
  if (!originHeader || !hostHeader) return false;
  try {
    const originHost = new URL(originHeader).host;
    return originHost !== hostHeader;
  } catch {
    return false;
  }
}

/**
 * HttpOnly + SameSite (+ Secure when required) for all platform session cookies.
 */
export function getCookieSecuritySuffix(
  request: FastifyRequest,
  nodeEnv: string | undefined,
): string {
  const isProduction = nodeEnv === 'production';
  const crossSite = isCrossSiteRequest(request);
  const sameSite = crossSite ? 'None' : 'Lax';
  const secure = isProduction || crossSite;
  return `HttpOnly; SameSite=${sameSite}` + (secure ? '; Secure' : '');
}

const SESSION_PATH = '/';

export function buildSessionSetCookieHeader(
  cookieName: string,
  token: string,
  maxAgeSeconds: number,
  securitySuffix: string,
): string {
  return `${cookieName}=${encodeURIComponent(token)}; Path=${SESSION_PATH}; ${securitySuffix}; Max-Age=${maxAgeSeconds}`;
}

export function buildSessionClearCookieHeader(cookieName: string, securitySuffix: string): string {
  return `${cookieName}=; Path=${SESSION_PATH}; Max-Age=0; ${securitySuffix}`;
}

/**
 * Append multiple Set-Cookie headers (Node `ServerResponse.appendHeader` — Fastify typings omit it).
 */
export function applySetCookieHeaders(reply: FastifyReply, cookieHeaderValues: string[]): void {
  if (cookieHeaderValues.length === 0) return;
  const raw = reply.raw;
  raw.setHeader('Set-Cookie', cookieHeaderValues[0]);
  for (let i = 1; i < cookieHeaderValues.length; i++) {
    raw.appendHeader('Set-Cookie', cookieHeaderValues[i]);
  }
}
