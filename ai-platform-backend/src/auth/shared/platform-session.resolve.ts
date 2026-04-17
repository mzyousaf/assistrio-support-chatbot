import type { User } from '../../models';
import type { AuthService } from './auth.service';
import { readPlatformSessionCookieTokens } from './session-cookie.read';

const PLATFORM_COOKIE_TRY_ORDER = ['customer', 'admin'] as const;

/**
 * Resolves an authenticated user from browser cookies for **cross-role** surfaces (e.g. widget preview):
 * tries `ar_customer_session`, then `ar_admin_session`.
 *
 * @see AdminSessionAuthGuard
 * @see CustomerSessionAuthGuard
 */
export async function resolveUserFromPlatformCookieHeader(
  authService: AuthService,
  cookieHeader: string | undefined,
): Promise<User | null> {
  const { customerToken, adminToken } = readPlatformSessionCookieTokens(cookieHeader);
  const byKey = {
    customer: customerToken,
    admin: adminToken,
  } as const;
  for (const key of PLATFORM_COOKIE_TRY_ORDER) {
    const token = byKey[key];
    if (!token) continue;
    const user = await authService.getAuthenticatedUser(token);
    if (user) return user;
  }
  return null;
}
