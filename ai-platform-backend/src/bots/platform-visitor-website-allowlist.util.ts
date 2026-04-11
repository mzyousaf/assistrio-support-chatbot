import {
  extractHostnameFromUserWebsiteInputLoose,
  getHostnameStrictFromEmbedOrigin,
  hostnameFromShowcaseWebsiteAllowlistStoredValue,
  isDisallowedUserEmbedHost,
  normalizeUserWebsiteInputToHostname,
} from './embed-domain.util';
import { PLATFORM_VISITOR_EMBED_ANONYMOUS_SENTINEL } from './widget-embed-identity.util';

/**
 * **Domain vs identity (do not merge):** origin/hostname checks only authorize *where* the embed may run.
 * **`platformVisitorId`** names *which saved* identity is paired with a site for this bot. Quota/ownership use
 * that id in API payloads, not hostname alone — same domain does not imply same bucket without the same id.
 *
 * Per-bot allowlist: each platform visitor id maps to exactly one **hostname** (stored in `websiteUrl`; legacy rows
 * may still hold a canonical origin string). Matching compares the request **Origin** hostname to that stored hostname
 * (exact host only — e.g. `www.app.alibaba.com` does not match `www.alibaba.com`).
 *
 * API: trial bots (`creatorType === 'visitor'`) may not have any entries. Showcase bots may have
 * at most one `{ platformVisitorId, websiteUrl }` row.
 *
 * When the allowlist is empty or missing, no per-visitor URL check is applied (only bot `allowedDomains`).
 *
 * When the request includes a `platformVisitorId` that has a row on this allowlist, the generic
 * `allowedDomains` embed gate may be skipped: only the per-visitor registered **hostname** must match the
 * request **Origin** hostname (see {@link platformVisitorEmbedCanBypassAllowedDomainsGate}).
 *
 * Persisted via user bot update APIs (`user-bots.controller` + `bot-payload` normalization) or
 * `POST /api/widget/register-website` (embed keys + showcase bots).
 */
export function platformVisitorEmbedCanBypassAllowedDomainsGate(params: {
  bot: { websiteURLAllowlist?: unknown };
  platformVisitorId?: string;
}): boolean {
  const pv = params.platformVisitorId?.trim();
  if (!pv || pv === PLATFORM_VISITOR_EMBED_ANONYMOUS_SENTINEL) return false;
  const list = params.bot.websiteURLAllowlist;
  if (!Array.isArray(list) || list.length === 0) return false;
  return list.some((e: unknown) => {
    if (!e || typeof e !== 'object') return false;
    return String((e as { platformVisitorId?: string }).platformVisitorId ?? '').trim() === pv;
  });
}

export function assertPlatformVisitorWebsiteMatchesBotAllowlist(params: {
  bot: { websiteURLAllowlist?: unknown };
  platformVisitorId?: string;
  requestOrigin: string | undefined;
}): void {
  const pv = params.platformVisitorId?.trim();
  if (!pv || pv === PLATFORM_VISITOR_EMBED_ANONYMOUS_SENTINEL) return;
  const list = params.bot.websiteURLAllowlist;
  if (!Array.isArray(list) || list.length === 0) return;

  const originRaw = typeof params.requestOrigin === 'string' ? params.requestOrigin.trim() : '';
  const reqHost = getHostnameStrictFromEmbedOrigin(originRaw);
  if (!reqHost) {
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
  const storedHost = hostnameFromShowcaseWebsiteAllowlistStoredValue(wu);
  if (!storedHost || storedHost !== reqHost) {
    throw new Error('PLATFORM_VISITOR_WEBSITE_ORIGIN_MISMATCH');
  }
}

/**
 * Normalize a single showcase allowlist row (same rules as admin `bot-payload`).
 * Used by runtime `POST /api/widget/register-website` — **not** a substitute for `platformVisitorId` identity proof.
 */
export function normalizeWebsiteURLAllowlistRowPublic(params: {
  platformVisitorId: string;
  websiteUrl: string;
}): { platformVisitorId: string; websiteUrl: string } {
  const pv = String(params.platformVisitorId ?? '').trim();
  const wuRaw = String(params.websiteUrl ?? '').trim();
  if (!pv || !wuRaw) {
    throw new Error('PLATFORM_VISITOR_WEBSITE_ALLOWLIST_ROW_INCOMPLETE');
  }
  const loose = extractHostnameFromUserWebsiteInputLoose(wuRaw);
  if (loose && isDisallowedUserEmbedHost(loose)) {
    throw new Error('PLATFORM_VISITOR_WEBSITE_LOCALHOST_DISALLOWED');
  }
  const host = normalizeUserWebsiteInputToHostname(wuRaw);
  if (!host) {
    throw new Error('PLATFORM_VISITOR_WEBSITE_ALLOWLIST_INVALID_URL');
  }
  /** Field name kept for API compatibility; value is hostname only (no scheme/path/port). */
  return { platformVisitorId: pv, websiteUrl: host };
}

/** Reject invalid payloads before persisting `websiteURLAllowlist`. */
export function assertWebsiteURLAllowlistWritePolicy(
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
