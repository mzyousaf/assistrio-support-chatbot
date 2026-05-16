import { hostnameIsLoopbackForEmbedBypass, isPreviewOriginAllowed } from '../bots/origin-validation.util';

/**
 * **Two CORS modes** (see `main.ts` + `public-embed-cors-paths.util.ts`):
 *
 * 1. **Public browser embed** (`isPublicBrowserEmbedCorsPath`): `POST /api/widget/init`, `/api/chat/*`,
 *    `/api/analytics/*`, and **selected** `/api/public/*` / `/api/trial/*` subtrees
 *    (deny-first excludes gallery, landing list, trial create — see `public-embed-cors-paths.util.ts`).
 *    **Any valid HTTPS browser origin** is reflected for those paths. Runtime authorization remains **keys + allowed origins**
 *    in the API, not CORS.
 *
 * 2. **Strict allowlist** (everything else, including `/api/widget/preview/*`, `/api/customer/*`, `/api/bots`): Assistrio
 *    hostnames + dev loopback (development only) — admin/auth/preview.
 *
 * **Preview** stays on the strict bucket (`/api/widget/preview/*`).
 *
 * **Credentials + CORS:** The server uses `credentials: true` so browsers may send cookies for the **API host** on
 * cross-site XHR/fetch. `Access-Control-Allow-Origin` reflects the request `Origin` (never `*`). This does **not**
 * bypass bot keys, `allowedOrigins`, or ownership checks — those are enforced in controllers. Embed session cookies use
 * `SameSite=None; Secure` in production (`embed-session-cookie.util.ts`) so they are scoped to the API origin, not
 * arbitrary third-party origins.
 *
 * @see `assistrio-landing-site/docs/RUNTIME_DEPLOYMENT.md`
 */
function isAssistrioHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return h === 'assistrio.com' || h.endsWith('.assistrio.com');
}

/**
 * Strict CORS allowlist:
 * - **development** (`NODE_ENV === 'development'`): loopback / local dev origins only (localhost, 127.0.0.1, ::1, `*.localhost`).
 * - **production / staging** (else): `assistrio.com` and any `*.assistrio.com` origin.
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

function sharedPreviewEnvBaseOrigins(): string[] {
  const keys = ['CUSTOMER_APP_BASE_URL', 'LANDING_SITE_BASE_URL'] as const;
  const out: string[] = [];
  for (const k of keys) {
    const raw = process.env[k]?.trim().replace(/\/$/, '');
    if (!raw) continue;
    try {
      out.push(new URL(raw).origin);
    } catch {
      /* ignore invalid env */
    }
  }
  return out;
}

/**
 * Browser CORS for `/api/shared/*` only: Assistrio-hosted apps (preview list + configured base URLs) and dev loopback.
 * Must not reflect arbitrary third-party HTTPS origins (share is not a public embed API).
 */
export function isSharedPreviewBrowserOriginAllowed(origin: string, nodeEnv: string): boolean {
  const o = origin.trim();
  if (!o) return false;
  if (isPreviewOriginAllowed(o, nodeEnv)) return true;
  for (const allowed of sharedPreviewEnvBaseOrigins()) {
    if (o === allowed) return true;
  }
  return false;
}

export function isBrowserOriginAllowedForCors(origin: string, nodeEnv: string): boolean {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  const host = url.hostname;
  if (nodeEnv === 'development') {
    return hostnameIsLoopbackForEmbedBypass(host);
  }
  return isAssistrioHostname(host);
}
