/**
 * Central cookie names for browser sessions.
 *
 * - Admin staff use {@link AR_ADMIN_SESSION_COOKIE_NAME} (password login).
 * - Customers use {@link AR_CUSTOMER_SESSION_COOKIE_NAME} (Google OAuth).
 * - {@link LEGACY_USER_SESSION_COOKIE_NAME} is no longer issued; it may still be cleared on admin sign-out
 *   so stale cookies from older deployments are removed.
 */
export const AR_ADMIN_SESSION_COOKIE_NAME = 'ar_admin_session' as const;
export const AR_CUSTOMER_SESSION_COOKIE_NAME = 'ar_customer_session' as const;

/** Stale-cookie cleanup only — not read for authentication after legacy `/api/user/*` retirement. */
export const LEGACY_USER_SESSION_COOKIE_NAME = 'user_token' as const;

/** @deprecated Use {@link LEGACY_USER_SESSION_COOKIE_NAME}. */
export const LEGACY_SESSION_COOKIE_NAME = LEGACY_USER_SESSION_COOKIE_NAME;
