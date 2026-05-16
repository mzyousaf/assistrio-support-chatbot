import type { FastifyRequest } from 'fastify';
import {
  AR_ADMIN_SESSION_COOKIE_NAME,
  AR_CUSTOMER_SESSION_COOKIE_NAME,
} from './session-cookie.constants';

/**
 * Raw cookie value (may be URL-encoded), or null if absent.
 */
export function getCookieValueFromHeader(
  cookieHeader: string | undefined,
  cookieName: string,
): string | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(';').map((s) => s.trim());
  for (const part of parts) {
    const [name, ...valueParts] = part.split('=');
    if (name?.trim() === cookieName && valueParts.length > 0) {
      return valueParts.join('=').trim();
    }
  }
  return null;
}

export function getAdminSessionTokenFromCookieHeader(cookieHeader: string | undefined): string | null {
  return getCookieValueFromHeader(cookieHeader, AR_ADMIN_SESSION_COOKIE_NAME);
}

export function getCustomerSessionTokenFromCookieHeader(cookieHeader: string | undefined): string | null {
  return getCookieValueFromHeader(cookieHeader, AR_CUSTOMER_SESSION_COOKIE_NAME);
}

export type PlatformSessionCookieSources = {
  customerToken: string | null;
  adminToken: string | null;
};

/**
 * Reads typed platform session slots without validating JWTs.
 * Order for resolution is defined in {@link resolveUserFromPlatformCookieHeader}.
 */
export function readPlatformSessionCookieTokens(
  cookieHeader: string | undefined,
): PlatformSessionCookieSources {
  return {
    customerToken: getCustomerSessionTokenFromCookieHeader(cookieHeader),
    adminToken: getAdminSessionTokenFromCookieHeader(cookieHeader),
  };
}

export function getRequestCookieHeader(request: FastifyRequest): string | undefined {
  return request.headers.cookie;
}
