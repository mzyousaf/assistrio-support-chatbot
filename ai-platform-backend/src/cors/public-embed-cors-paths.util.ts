/**
 * **Public (broad cross-origin) CORS** — browser `Origin` reflected for valid HTTPS (see `isReflectablePublicEmbedOrigin`
 * in `cors-origin.util.ts`) so customer sites need not be listed in any env allowlist.
 *
 * **Strict CORS** — Assistrio hostnames + dev loopback (development only) — for preview, app auth, admin, jobs, and
 * any path not explicitly listed below.
 *
 * **Authorization** (keys, `allowedOrigins`, ownership) is enforced in controllers; CORS only exposes responses to the
 * browser. **`/api/shared/*`** is **strict** (Assistrio-hosted share preview only — see `isSharedPreviewBrowserOriginAllowed` in `main.ts`).
 *
 * ---
 * **Adding routes:** New handlers default to **strict** unless you add them here. Do not add broad prefixes under
 * `/api/widget` — list **exact** paths only. Use `pathHasApiPrefix` for subtree routes (`/api/chat/...`).
 *
 * **Never** add a single-segment public prefix like `/api` — that would widen CORS to the entire API. Subtree allows
 * must be at least `/api/<segment>/...` (see tests).
 *
 * **Route owners:** When you add a controller, decide whether browsers on arbitrary customer HTTPS origins must read
 * responses. If yes, extend the public lists below **explicitly**; if unsure, leave **strict** (default).
 *
 * @see `main.ts` — delegator applies this classifier per request.
 * @see `docs/CORS.md` — inventory + maintenance
 * @see `assistrio-landing-site/docs/RUNTIME_DEPLOYMENT.md`
 */

/** Prefix match at a path segment boundary: `prefix` or `prefix/...`, not `prefix` as substring of a longer segment. */
export function pathHasApiPrefix(path: string, prefix: string): boolean {
  if (path === prefix) return true;
  return path.startsWith(`${prefix}/`);
}

/**
 * Strips query/hash, collapses duplicate slashes (`//api/...` → `/api/...`), and trailing slash (except `/`) so
 * `/api/widget/init/` classifies like `/api/widget/init`.
 */
export function normalizeRequestPathForCors(url: string): string {
  const raw = url.split('?')[0].split('#')[0];
  let path = raw && raw.startsWith('/') ? raw : '/';
  path = path.replace(/\/{2,}/g, '/');
  if (path.length > 1 && path.endsWith('/')) {
    path = path.slice(0, -1);
  }
  return path;
}

/**
 * **Deny first.** If a path matches any strict prefix, it never gets public CORS — even if a later rule would allow.
 * Keep `/api/widget/preview` and `/api/widget/testing` as segment-prefixed so `/api/widget/previewish` is not treated as preview.
 *
 * Includes **reserved** `/api/admin` and `/api/super-admin` so future internal tooling cannot accidentally fall into
 * broad CORS if a catch-all public rule is ever mis-added. Paths not listed here still default to **strict** when they
 * are not in the public exact/subtree lists.
 *
 * **Marketing / anonymous helpers** (`GET /api/public/bots`, etc.) — strict so arbitrary
 * customer sites cannot read responses without **Assistrio** (`assistrio.com` / `*.assistrio.com`) or dev loopback. The
 * landing app and gallery on `*.assistrio.com` remain allowed via `isBrowserOriginAllowedForCors`.
 */
export const STRICT_CORS_PATH_PREFIXES: readonly string[] = [
  '/api/widget/preview',
  '/api/widget/testing',
  /** Customer app (Vite) — strict Assistrio-origin CORS (not arbitrary cross-site reads). */
  '/api/customer',
  '/api/bots',
  '/api/jobs',
  '/api/admin',
  '/api/super-admin',
  /** Gallery + landing curated lists + quota — not arbitrary cross-origin browser reads */
  '/api/public/bots',
  '/api/public/landing',
  /** Hosted share preview (`/api/shared/bots/:slug/...`) — strict Assistrio-app CORS only (see `isSharedPreviewBrowserOriginAllowed`). */
  '/api/shared',
];

function isStrictCorsPath(path: string): boolean {
  return STRICT_CORS_PATH_PREFIXES.some((p) => pathHasApiPrefix(path, p));
}

/** Exact paths only under `/api/widget` — avoids `register-website-*` typo routes accidentally widening CORS. */
export const PUBLIC_WIDGET_EMBED_EXACT_PATHS: ReadonlySet<string> = new Set(['/api/widget/init']);

/**
 * Subtree prefixes for **broad** browser CORS (segment-safe via `pathHasApiPrefix`). Do not add `/api` alone.
 */
export const PUBLIC_BROAD_CORS_SUBTREE_PREFIXES: readonly string[] = [
  '/api/chat',
  '/api/public',
  '/api/analytics',
  /** Iframe embed (`/api/widget/iframe/...`) — parent origin validated in controller body. */
  '/api/widget/iframe',
];

/**
 * `true` → reflect allowed browser origins for this path (HTTPS in prod; see `isReflectablePublicEmbedOrigin`).
 * `false` → use strict allowlist (`isBrowserOriginAllowedForCors`).
 */
export function isPublicBrowserEmbedCorsPath(rawPath: string): boolean {
  const path = normalizeRequestPathForCors(rawPath);
  if (isStrictCorsPath(path)) {
    return false;
  }
  if (PUBLIC_WIDGET_EMBED_EXACT_PATHS.has(path)) {
    return true;
  }
  return PUBLIC_BROAD_CORS_SUBTREE_PREFIXES.some((p) => pathHasApiPrefix(path, p));
}
