/**
 * Runtime and preview embed origin checks — **exact origin string match only** (no hostname/root-domain logic).
 */

export type AllowedOrigin = {
  origin: string;
  label?: string;
  isActive: boolean;
};

export function coerceAllowedOriginsFromBotDoc(raw: unknown): AllowedOrigin[] {
  if (!Array.isArray(raw)) return [];
  const out: AllowedOrigin[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const origin = typeof r.origin === 'string' ? r.origin.trim() : '';
    if (!origin) continue;
    const label = typeof r.label === 'string' ? r.label.trim() : undefined;
    const isActive = r.isActive !== false;
    out.push({ origin, ...(label ? { label } : {}), isActive });
  }
  return out;
}

export function normalizeNodeEnv(env: string | undefined): 'production' | 'development' {
  return env === 'production' ? 'production' : 'development';
}

function firstHeaderValue(v: string | string[] | undefined): string {
  if (typeof v === 'string') return v.trim();
  if (Array.isArray(v) && v.length > 0) return String(v[0]).trim();
  return '';
}

/** Browser Origin header for runtime embed authorization (not Referer, not JSON embedOrigin). */
export function resolveRuntimeEmbedOriginFromHeaders(headers: {
  origin?: string | string[];
}): string | undefined {
  const origin = firstHeaderValue(headers.origin);
  return origin || undefined;
}

function isDisallowedUserSavedEmbedHost(hostname: string): boolean {
  const h = hostname.trim().toLowerCase();
  if (!h) return true;
  const bare = h.startsWith('[') && h.endsWith(']') ? h.slice(1, -1) : h;
  if (bare === 'localhost') return true;
  if (bare === '127.0.0.1' || bare === '0.0.0.0') return true;
  if (bare === '::1') return true;
  return false;
}

/** Loopback hostnames allowed for dev-only bypass (CORS + runtime/preview localhost rules). */
export function hostnameIsLoopbackForEmbedBypass(hostname: string | null): boolean {
  if (!hostname?.trim()) return false;
  if (isDisallowedUserSavedEmbedHost(hostname)) return true;
  const h = hostname.trim().toLowerCase();
  if (h.endsWith('.localhost')) return true;
  return false;
}

function isStrictLocalhostDevOrigin(origin: string): boolean {
  try {
    const u = new URL(origin.trim());
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    return hostnameIsLoopbackForEmbedBypass(u.hostname);
  } catch {
    return false;
  }
}

/**
 * Production: exact match against active `allowedOrigins[].origin`.
 * Development: same, plus any localhost /127.0.0.1 / ::1 origin (http or https).
 */
export function isRuntimeOriginAllowed(
  requestOrigin: string,
  allowedOrigins: AllowedOrigin[],
  env: string,
): boolean {
  const ro = requestOrigin.trim();
  if (!ro) return false;
  if (normalizeNodeEnv(env) === 'development' && isStrictLocalhostDevOrigin(ro)) {
    return true;
  }
  const active = (allowedOrigins ?? []).filter(
    (o) => o && o.isActive === true && typeof o.origin === 'string' && o.origin.trim(),
  );
  return active.some((o) => o.origin.trim() === ro);
}

/** Assistrio-hosted preview pages (exact origins, production). */
export const ASSISTRIO_PREVIEW_ORIGINS_PRODUCTION = [
  'https://assistrio.com',
  'https://www.assistrio.com',
  'https://app.assistrio.com',
] as const;

/**
 * Production: only Assistrio preview origins (exact).
 * Development: same plus localhost-style origins.
 */
export function isPreviewOriginAllowed(origin: string, env: string): boolean {
  const o = origin.trim();
  if (!o) return false;
  if (normalizeNodeEnv(env) === 'development' && isStrictLocalhostDevOrigin(o)) {
    return true;
  }
  return (ASSISTRIO_PREVIEW_ORIGINS_PRODUCTION as readonly string[]).includes(o);
}

/** Normalize user/API input to a stored origin; rejects loopback (use dev bypass instead). */
export function normalizeUserAllowedOriginInput(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    if (isDisallowedUserSavedEmbedHost(u.hostname)) return null;
    return u.origin;
  } catch {
    return null;
  }
}

export function isPreviewRequestOriginAllowed(
  headers: { origin?: string | string[] },
  nodeEnv: string,
): boolean {
  const origin = resolveRuntimeEmbedOriginFromHeaders(headers);
  if (!origin) return false;
  return isPreviewOriginAllowed(origin, nodeEnv);
}
