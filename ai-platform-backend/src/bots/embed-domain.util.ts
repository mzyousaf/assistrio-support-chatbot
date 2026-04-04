/**
 * Allowed embed origins for runtime (and serialization for the admin UI).
 *
 * **Vs CORS:** These rules authorize **which site may embed** after the browser is allowed to call the API. For
 * **public runtime** routes (`/api/widget/init`, `/api/chat/*`, …), CORS reflects valid HTTPS origins without
 * per-customer env entries; see `public-embed-cors-paths.util.ts`. Failure modes: CORS block (no response body) vs 403
 * `EMBED_*` / `deploymentHint` from `/api/widget/init`.
 *
 * Storage (`allowedDomains: string[]`):
 * - **Single hostname** (exact match only, no wildcard subdomains): `www.example.com` or `example.com`
 * - **Multiple hostnames** (comma list): `hosts:example.com,www.example.com,app.example.com`
 * - **Exact origin**: `exact:https://example.com:3000` (canonical origin after `exact:`)
 *
 * User-facing website fields (trial `allowedDomain`, showcase `websiteUrl`) are normalized to **hostname only** via
 * {@link normalizeUserWebsiteInputToHostname} before storage.
 */

const LABEL = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

function isValidHostnameShape(host: string): boolean {
  if (host === 'localhost') return true;
  const parts = host.split('.');
  if (parts.length < 2) return false;
  return parts.every((p) => LABEL.test(p));
}

/** Strip leading www. for comparison only (preview / legacy helpers). */
export function normalizeHostnameForMatch(host: string): string | null {
  const h = host.trim().toLowerCase();
  if (!h) return null;
  const noWww = h.startsWith('www.') ? h.slice(4) : h;
  return noWww || null;
}

/**
 * Parse hostname from a page origin (`https://app.example.com`) or bare host (`app.example.com`).
 * Strips a leading `www.` label for legacy / preview matching.
 */
export function hostnameFromEmbedOrigin(embedOrigin: string): string | null {
  const raw = embedOrigin.trim();
  if (!raw) return null;
  try {
    const withScheme = /:\/\//.test(raw) ? raw : `https://${raw}`;
    const u = new URL(withScheme);
    if (u.hostname) return normalizeHostnameForMatch(u.hostname);
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Extract hostname from user-entered website / URL / hostname-with-path (lowercase). No validation.
 * Returns null when the string cannot be parsed as a URL with a host.
 */
export function extractHostnameFromUserWebsiteInputLoose(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  try {
    const withScheme = /:\/\//.test(t) ? t : `https://${t}`;
    const u = new URL(withScheme);
    if (!u.hostname) return null;
    return u.hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Normalize user-entered website / base URL (or bare hostname) to a single hostname for storage and allowlists.
 * Strips scheme, path, query, hash, and port. Preserves subdomains. Rejects invalid or disallowed hosts.
 */
export function normalizeUserWebsiteInputToHostname(raw: string): string | null {
  const t = raw.trim();
  if (!t || t.length > 2048) return null;
  const loose = extractHostnameFromUserWebsiteInputLoose(t);
  if (!loose) return null;
  return validateAllowedDomainHostStrict(loose);
}

/**
 * Read hostname from a showcase allowlist `websiteUrl` value: either hostname-only (new) or legacy canonical origin
 * string (`https://host:port`). Used for runtime matching against the browser Origin hostname.
 */
export function hostnameFromShowcaseWebsiteAllowlistStoredValue(stored: string): string | null {
  const t = stored.trim();
  if (!t) return null;
  const co = canonicalOriginFromString(t) ?? canonicalOriginFromString(`https://${t}`);
  if (co) {
    try {
      return new URL(co).hostname.toLowerCase();
    } catch {
      return null;
    }
  }
  return validateAllowedDomainHostStrict(t);
}

/** Full request hostname from an origin string (lowercase, no www stripping). Used for runtime embed gate. */
export function getHostnameStrictFromEmbedOrigin(embedOrigin: string): string | null {
  const raw = embedOrigin.trim();
  if (!raw) return null;
  try {
    const withScheme = /:\/\//.test(raw) ? raw : `https://${raw}`;
    const u = new URL(withScheme);
    if (u.hostname) return u.hostname.toLowerCase();
  } catch {
    /* ignore */
  }
  return null;
}

/** Canonical origin (scheme + host + port), same as `URL#origin`. */
export function canonicalOriginFromString(input: string): string | null {
  try {
    const raw = input.trim();
    if (!raw) return null;
    const withScheme = /:\/\//.test(raw) ? raw : `https://${raw}`;
    return new URL(withScheme).origin;
  } catch {
    return null;
  }
}

export function hostnameMatchesAllowed(requestHost: string, allowed: string): boolean {
  const req = normalizeHostnameForMatch(requestHost);
  const al = normalizeHostnameForMatch(allowed);
  if (!req || !al) return false;
  if (req === al) return true;
  return req.endsWith(`.${al}`);
}

export function isHostnameAllowed(requestHost: string, allowedList: string[]): boolean {
  if (!allowedList.length) return true;
  for (const a of allowedList) {
    if (hostnameMatchesAllowed(requestHost, a)) return true;
  }
  return false;
}

/** Hostnames users may not add as embed allowlist (use server-side loopback bypass in dev instead). */
export function isDisallowedUserEmbedHost(host: string): boolean {
  const raw = host.trim();
  if (!raw) return true;
  const h = raw.toLowerCase().startsWith('[') && raw.endsWith(']') ? raw.slice(1, -1).toLowerCase() : raw.toLowerCase();
  if (h === 'localhost') return true;
  if (h === '127.0.0.1' || h === '0.0.0.0') return true;
  if (h === '::1') return true;
  return false;
}

/** Request host from embed origin is loopback (dev bypass for runtime gate). */
export function hostnameIsLoopbackForEmbedBypass(hostname: string | null): boolean {
  if (!hostname?.trim()) return false;
  if (isDisallowedUserEmbedHost(hostname)) return true;
  const h = hostname.trim().toLowerCase();
  if (h.endsWith('.localhost')) return true;
  return false;
}

/**
 * Validates a single hostname for allowlist storage (exact match at runtime; no wildcard subdomains).
 */
export function validateAllowedDomainHostStrict(raw: string): string | null {
  const host = raw.trim().toLowerCase();
  if (!host) return null;
  if (isDisallowedUserEmbedHost(host)) return null;
  if (host === 'localhost') return 'localhost';
  if (!isValidHostnameShape(host)) return null;
  return host;
}

/** @deprecated Use {@link validateAllowedDomainHostStrict}. Kept name for existing imports; no longer strips www. */
export function validateAllowedDomainEntry(raw: string): string | null {
  return validateAllowedDomainHostStrict(raw);
}

export type AllowedDomainRule =
  | { kind: 'domain'; host: string }
  | { kind: 'exact'; origin: string };

const EXACT_PREFIX = 'exact:';
const HOSTS_PREFIX = 'hosts:';

/**
 * Serialize one user/API string into stored form, or null if invalid.
 * - Single hostname: exact host match at runtime.
 * - `hosts:a,b,c`: multiple hostnames (still one array slot).
 * - Exact: `exact:<origin>` with canonical origin.
 */
export function parseAllowedDomainStringForStorage(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  if (s.toLowerCase().startsWith(EXACT_PREFIX)) {
    const rest = s.slice(EXACT_PREFIX.length).trim();
    const co = canonicalOriginFromString(rest);
    if (!co) return null;
    try {
      const urlHost = new URL(co).hostname;
      if (isDisallowedUserEmbedHost(urlHost)) return null;
    } catch {
      return null;
    }
    return `${EXACT_PREFIX}${co}`;
  }
  if (s.toLowerCase().startsWith(HOSTS_PREFIX)) {
    const rest = s.slice(HOSTS_PREFIX.length).trim();
    const segments = rest.split(',').map((x) => x.trim()).filter(Boolean);
    if (segments.length === 0) return null;
    const normalized: string[] = [];
    for (const seg of segments) {
      const h = validateAllowedDomainHostStrict(seg);
      if (!h) return null;
      normalized.push(h);
    }
    normalized.sort();
    return `${HOSTS_PREFIX}${normalized.join(',')}`;
  }
  return validateAllowedDomainHostStrict(s);
}

/**
 * True when the user clearly tried to save localhost/loopback but it was rejected (for API error messages).
 */
export function isEmbedDomainInputDisallowedLocalhost(raw: string): boolean {
  const t = raw.trim();
  if (!t) return false;
  if (parseAllowedDomainStringForStorage(t)) return false;
  if (t.toLowerCase().startsWith(EXACT_PREFIX)) {
    const rest = t.slice(EXACT_PREFIX.length).trim();
    const co = canonicalOriginFromString(rest);
    if (!co) return false;
    try {
      return isDisallowedUserEmbedHost(new URL(co).hostname);
    } catch {
      return false;
    }
  }
  if (t.toLowerCase().startsWith(HOSTS_PREFIX)) {
    const rest = t.slice(HOSTS_PREFIX.length).trim();
    for (const seg of rest.split(',')) {
      const h = validateAllowedDomainHostStrict(seg.trim());
      if (h && isDisallowedUserEmbedHost(h)) return true;
    }
    return false;
  }
  const hostGuess = getHostnameStrictFromEmbedOrigin(t) ?? validateAllowedDomainHostStrict(t);
  return !!(hostGuess && isDisallowedUserEmbedHost(hostGuess));
}

function parseStoredStringToRule(stored: string): AllowedDomainRule | null {
  const s = stored.trim();
  if (!s) return null;
  if (s.toLowerCase().startsWith(EXACT_PREFIX)) {
    const rest = s.slice(EXACT_PREFIX.length).trim();
    const co = canonicalOriginFromString(rest);
    if (!co) return null;
    try {
      if (isDisallowedUserEmbedHost(new URL(co).hostname)) return null;
    } catch {
      return null;
    }
    return { kind: 'exact', origin: co };
  }
  if (s.toLowerCase().startsWith(HOSTS_PREFIX)) {
    return null;
  }
  const host = validateAllowedDomainHostStrict(s);
  return host ? { kind: 'domain', host } : null;
}

/**
 * Parse DB `allowedDomains` into rules. Invalid entries are dropped.
 * Expands `hosts:a,b,c` into multiple domain rules.
 */
export function parseAllowedDomainRulesFromStoredArray(raw: unknown): AllowedDomainRule[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: AllowedDomainRule[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const s = item.trim();
    const lower = s.toLowerCase();
    if (lower.startsWith(HOSTS_PREFIX)) {
      const rest = s.slice(HOSTS_PREFIX.length).trim();
      for (const seg of rest.split(',')) {
        const h = validateAllowedDomainHostStrict(seg.trim());
        if (!h) continue;
        const key = `d:${h}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ kind: 'domain', host: h });
      }
      continue;
    }
    const rule = parseStoredStringToRule(item);
    if (!rule) continue;
    const key = rule.kind === 'exact' ? `e:${rule.origin}` : `d:${rule.host}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(rule);
  }
  return out;
}

function firstHeaderValue(v: string | string[] | undefined): string {
  if (typeof v === 'string') return v.trim();
  if (Array.isArray(v) && v.length > 0) return String(v[0]).trim();
  return '';
}

/**
 * Resolves the page origin for **runtime** embed allowlist checks.
 * Only the browser **`Origin`** header is used (not `Referer`, not JSON `embedOrigin`).
 * Local development: when `NODE_ENV` is `development`, {@link checkEmbedDomainGate} may still
 * allow loopback hosts (`localhost`, etc.) via `allowLoopbackOriginWhenLocalDev` without listing them on the bot.
 */
export function resolveRuntimeEmbedOriginFromHeaders(headers: {
  origin?: string | string[];
  referer?: string | string[];
}): string | undefined {
  const origin = firstHeaderValue(headers.origin);
  return origin || undefined;
}

export type EmbedDomainGateResult =
  | { ok: true }
  | { ok: false; reason: 'no_allowlist' | 'missing_origin' | 'bad_origin' | 'not_allowed' };

export type EmbedDomainGateOptions = {
  /** When true (local dev server), allow loopback browser origins without a matching rule. */
  allowLoopbackOriginWhenLocalDev?: boolean;
};

/**
 * Runtime embed gate: **no** legacy “empty list = allow all”.
 * Every published bot must have at least one valid rule; otherwise `no_allowlist`.
 * Domain rules match **only** the exact hostname (no automatic subdomains).
 *
 * **Not identity:** passing this gate means the **origin** is allowed for the bot — it does **not** assign
 * or prove `platformVisitorId` / quota ownership (those come from request identity fields).
 */
export function checkEmbedDomainGate(
  rules: AllowedDomainRule[],
  embedOrigin: string | undefined,
  opts?: EmbedDomainGateOptions,
): EmbedDomainGateResult {
  if (rules.length === 0) {
    return { ok: false, reason: 'no_allowlist' };
  }

  const originRaw = typeof embedOrigin === 'string' ? embedOrigin.trim() : '';
  if (!originRaw) return { ok: false, reason: 'missing_origin' };

  const reqOrigin = canonicalOriginFromString(originRaw);
  if (!reqOrigin) return { ok: false, reason: 'bad_origin' };

  const requestHostStrict = getHostnameStrictFromEmbedOrigin(originRaw);
  if (!requestHostStrict) return { ok: false, reason: 'bad_origin' };

  if (opts?.allowLoopbackOriginWhenLocalDev && hostnameIsLoopbackForEmbedBypass(requestHostStrict)) {
    return { ok: true };
  }

  for (const rule of rules) {
    if (rule.kind === 'exact') {
      if (reqOrigin === rule.origin) return { ok: true };
    } else if (rule.kind === 'domain') {
      if (requestHostStrict === rule.host.toLowerCase()) return { ok: true };
    }
  }
  return { ok: false, reason: 'not_allowed' };
}
