import type { AuthStatus } from '../auth/CustomerAuthContext';

/** Canonical customer-app paths for auth redirects and navigation. */
export const CUSTOMER_ROUTES = {
  login: '/login',
  home: '/',
  dashboard: '/dashboard',
  /** Main agents list — default destination after onboarding is complete. */
  agents: '/bots',
  onboarding: '/onboarding',
  invitePath: '/invite',
} as const;

export function customerInvitePath(token: string): string {
  return `/invite/${encodeURIComponent(token)}`;
}

export const CUSTOMER_POST_LOGIN_DEST = CUSTOMER_ROUTES.agents;

export const AUTH_BOOTSTRAP_LOADER_TITLE = 'Loading your account…';

/** True while session or post-login onboarding heuristic is not ready. */
export function isCustomerAuthBootstrapPending(
  status: AuthStatus,
  needsOnboarding: boolean | null,
): boolean {
  return status === 'loading' || (status === 'authenticated' && needsOnboarding === null);
}
