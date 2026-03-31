/** Super admins may whitelist up to this many embed origins per bot. */
export const ALLOWED_DOMAINS_MAX_SUPERADMIN = 10;
/** All other authenticated roles (admin, user, etc.) may whitelist up to this many. Same cap applies to platform-visitor trial bots at creation. */
export const ALLOWED_DOMAINS_MAX_DEFAULT = 1;

export function maxAllowedDomainsForRole(role: string | undefined): number {
  return role === 'superadmin' ? ALLOWED_DOMAINS_MAX_SUPERADMIN : ALLOWED_DOMAINS_MAX_DEFAULT;
}

export function assertAllowedDomainsPolicy(domains: string[], role: string | undefined): void {
  const max = maxAllowedDomainsForRole(role);
  if (domains.length > max) {
    throw new Error(`At most ${max} allowed domain(s) for your account.`);
  }
}
