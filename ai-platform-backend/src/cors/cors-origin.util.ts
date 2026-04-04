import { hostnameIsLoopbackForEmbedBypass } from '../bots/embed-domain.util';

/**
 * **Two CORS modes** (see `main.ts` + `public-embed-cors-paths.util.ts`):
 *
 * 1. **Public browser embed** (`isPublicBrowserEmbedCorsPath`): `POST /api/widget/init`, `/api/chat/*`,
 *    `/api/widget/register-website`, `/api/analytics/*`, and **selected** `/api/public/*` / `/api/trial/*` subtrees
 *    (deny-first excludes gallery, landing list, quota summary, trial create — see `public-embed-cors-paths.util.ts`).
 *    **Any valid HTTPS browser origin** is reflected for those paths. Runtime authorization remains **keys + domain rules**
 *    in the API, not CORS.
 *
 * 2. **Strict allowlist** (everything else, including `/api/widget/preview/*`, `/api/user/*`, `/api/bots`): Assistrio
 *    hostnames + `CORS_EXTRA_ORIGINS` + dev loopback — same behavior as before for admin/auth/preview.
 *
 * **Preview** stays on the strict bucket (`/api/widget/preview/*`).
 *
 * **Credentials + CORS:** The server uses `credentials: true` so browsers may send cookies for the **API host** on
 * cross-site XHR/fetch. `Access-Control-Allow-Origin` reflects the request `Origin` (never `*`). This does **not**
 * bypass bot keys, `allowedDomains`, or identity checks — those are enforced in controllers. Embed session cookies use
 * `SameSite=None; Secure` in production (`embed-session-cookie.util.ts`) so they are scoped to the API origin, not
 * arbitrary third-party origins.
 *
 * @see `assistrio-landing-site/docs/RUNTIME_DEPLOYMENT.md`
 */
export function parseCorsExtraOriginsEnv(raw: string | undefined): Set<string> {
  if (!raw?.trim()) return new Set();
  const set = new Set<string>();
  for (const part of raw.split(',')) {
    const o = part.trim();
    if (!o) continue;
    try {
      set.add(new URL(o).origin);
    } catch {
      /* skip invalid */
    }
  }
  return set;
}

function isAssistrioHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return h === 'assistrio.com' || h.endsWith('.assistrio.com');
}

/**
 * CORS allowlist (see module JSDoc above for customer vs Assistrio-owned vs `CORS_EXTRA_ORIGINS`):
 * - **development** (`NODE_ENV === 'development'`): loopback / local dev origins only (localhost, 127.0.0.1, ::1, `*.localhost`).
 * - **production / staging** (else): `assistrio.com` and any `*.assistrio.com` origin.
 * - **Any env**: plus exact origins from `CORS_EXTRA_ORIGINS`.
 */
/**
 * Origins allowed for **public embed** routes: valid `https:` (production) or dev loopback `http:`.
 * Rejects `file:`, `data:`, etc. Does not validate DNS — only URL shape.
 */
export function isReflectablePublicEmbedOrigin(origin: string, nodeEnv: string): boolean {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  const scheme = url.protocol.toLowerCase();
  if (scheme === 'https:') return true;
  if (scheme === 'http:') {
    return nodeEnv === 'development' && hostnameIsLoopbackForEmbedBypass(url.hostname);
  }
  return false;
}

export function isBrowserOriginAllowedForCors(
  origin: string,
  nodeEnv: string,
  extraOrigins: Set<string>,
): boolean {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  if (extraOrigins.has(url.origin)) return true;
  const host = url.hostname;
  if (nodeEnv === 'development') {
    return hostnameIsLoopbackForEmbedBypass(host);
  }
  return isAssistrioHostname(host);
}
