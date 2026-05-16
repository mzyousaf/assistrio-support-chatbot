/** Super admins may whitelist up to this many embed origins per bot. */
export const ALLOWED_ORIGINS_MAX_SUPERADMIN = 10;
/** All other authenticated roles may whitelist up to this many. */
export const ALLOWED_ORIGINS_MAX_DEFAULT = 3;

export function maxAllowedOriginsForRole(role: string | undefined): number {
  return role === 'superadmin' ? ALLOWED_ORIGINS_MAX_SUPERADMIN : ALLOWED_ORIGINS_MAX_DEFAULT;
}

export function assertAllowedOriginsPolicy(count: number, role: string | undefined): void {
  const max = maxAllowedOriginsForRole(role);
  if (count > max) {
    throw new Error(`At most ${max} allowed origin(s) for your account.`);
  }
}
