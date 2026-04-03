import { canonicalOriginFromString } from './embed-domain.util';

/**
 * Per-bot allowlist: each platform visitor id maps to exactly one canonical website origin
 * (scheme + host + port). Matching is exact — e.g. `https://www.alibaba.com` does not allow
 * `https://www.app.alibaba.com`.
 *
 * API: trial bots (`creatorType === 'visitor'`) may not have any entries. Showcase bots may have
 * at most one `{ platformVisitorId, websiteUrl }` row.
 *
 * When the allowlist is empty or missing, no per-visitor URL check is applied (only bot `allowedDomains`).
 *
 * When the request includes a `platformVisitorId` that has a row on this allowlist, the generic
 * `allowedDomains` embed gate may be skipped: only the per-visitor website URL must match the
 * request origin (see {@link platformVisitorEmbedCanBypassAllowedDomainsGate}).
 */
export function platformVisitorEmbedCanBypassAllowedDomainsGate(params: {
  bot: { platformVisitorWebsiteAllowlist?: unknown };
  platformVisitorId?: string;
}): boolean {
  const pv = params.platformVisitorId?.trim();
  if (!pv || pv === 'anonymous') return false;
  const list = params.bot.platformVisitorWebsiteAllowlist;
  if (!Array.isArray(list) || list.length === 0) return false;
  return list.some((e: unknown) => {
    if (!e || typeof e !== 'object') return false;
    return String((e as { platformVisitorId?: string }).platformVisitorId ?? '').trim() === pv;
  });
}

export function assertPlatformVisitorWebsiteMatchesBotAllowlist(params: {
  bot: { platformVisitorWebsiteAllowlist?: unknown };
  platformVisitorId?: string;
  requestOrigin: string | undefined;
}): void {
  const pv = params.platformVisitorId?.trim();
  if (!pv || pv === 'anonymous') return;
  const list = params.bot.platformVisitorWebsiteAllowlist;
  if (!Array.isArray(list) || list.length === 0) return;

  const reqCanon = canonicalOriginFromString(typeof params.requestOrigin === 'string' ? params.requestOrigin : '');
  if (!reqCanon) {
    throw new Error('PLATFORM_EMBED_ORIGIN_REQUIRED');
  }

  const entry = list.find((e: unknown) => {
    if (!e || typeof e !== 'object') return false;
    return String((e as { platformVisitorId?: string }).platformVisitorId ?? '').trim() === pv;
  });
  if (!entry) {
    throw new Error('PLATFORM_VISITOR_NOT_IN_BOT_ALLOWLIST');
  }
  const wu = String((entry as { websiteUrl?: string }).websiteUrl ?? '').trim();
  const allowCanon = canonicalOriginFromString(wu) ?? wu;
  if (allowCanon !== reqCanon) {
    throw new Error('PLATFORM_VISITOR_WEBSITE_ORIGIN_MISMATCH');
  }
}

/** Reject invalid payloads before persisting `platformVisitorWebsiteAllowlist`. */
export function assertPlatformVisitorWebsiteAllowlistWritePolicy(
  creatorType: 'user' | 'visitor' | undefined,
  allowlist: Array<{ platformVisitorId: string; websiteUrl: string }> | undefined,
): void {
  if (allowlist === undefined) return;
  if (creatorType === 'visitor') {
    if (allowlist.length > 0) {
      throw new Error('Platform visitor website URLs are not allowed on trial bots.');
    }
    return;
  }
  if (allowlist.length > 1) {
    throw new Error('At most one platform visitor website URL is allowed per bot.');
  }
}

/** Trial bots (`creatorType === 'visitor'`) may list at most one embed domain in `allowedDomains`. */
export function assertTrialBotAllowedDomainsPolicy(
  creatorType: 'user' | 'visitor' | undefined,
  allowedDomains: string[] | undefined,
): void {
  if (creatorType !== 'visitor' || allowedDomains === undefined) return;
  if (allowedDomains.length > 1) {
    throw new Error('Trial bots may have at most one allowed embed domain.');
  }
}
