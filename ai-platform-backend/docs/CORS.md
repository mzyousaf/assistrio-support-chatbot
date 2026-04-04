# CORS strategy (split public vs strict)

The API uses **`@fastify/cors`** with a **per-request delegator** (`src/main.ts`) that chooses:

1. **Public browser embed / marketing** — any valid **HTTPS** `Origin` is reflected for paths classified in `src/cors/public-embed-cors-paths.util.ts` (see `isPublicBrowserEmbedCorsPath`). Customer domains do **not** need to be listed in `CORS_EXTRA_ORIGINS` for these routes.

2. **Strict** — `Assistrio` hostnames + `CORS_EXTRA_ORIGINS` + dev loopback (`isBrowserOriginAllowedForCors`). Used for preview, authenticated app routes, admin bots listing, jobs, etc.

## Code-grounded route inventory (maintain when controllers change)

**Broad CORS (explicit only)**

| Kind | Paths | Notes |
|------|--------|--------|
| Exact | `/api/widget/init`, `/api/widget/register-website` | No other `/api/widget/*` is broad — avoids prefix typos. |
| Subtrees | `/api/chat/*`, `/api/public/*`, `/api/trial/*`, `/api/analytics/*` | Deny-first excludes paths listed below. Segment-safe: `/api/chats` is **not** included. Never add `/api` alone. |

**Deny-first (strict, even though under `/api/public` or `/api/trial`):** `GET /api/public/bots`, `GET /api/public/bots/:slug`, `GET /api/public/landing/bots`, `POST /api/public/visitor-quota/summary`, `POST /api/public/visitor-bot/*` (PV-safe owned-bot summaries), `POST /api/trial/bots` — **Assistrio / `CORS_EXTRA_ORIGINS` / dev loopback** only; not arbitrary customer origins.

**Note:** `POST /api/analytics/track` is **internal analytics ingestion**, not a PV product summary API — see `docs/PV_SAFE_PUBLIC_APIS.md`. It accepts typed events only; it has **no** per-IP rate limit in the controller today — monitor for abuse; tightening would be a separate change.

**Strict prefixes (deny-first; checked before broad rules)**

| Prefix | Why |
|--------|-----|
| `/api/widget/preview/*` | Owner preview — Assistrio app / configured hosts, not arbitrary customer sites. |
| `/api/widget/testing/*` | Internal testing helper. |
| `/api/user/*` | Auth + app APIs (`/api/user/analytics` is **strict**; contrast with **broad** `/api/analytics/track`). |
| `/api/bots/*` | Authenticated bot listing / admin-style access. |
| `/api/jobs/*` | Ingestion / cron triggers. |
| `/api/admin/*`, `/api/super-admin/*` | Reserved — no controllers yet; stays strict so future routes cannot drift into broad CORS by mistake. |
| `/api/public/bots`, `/api/public/landing`, `/api/public/visitor-quota`, `/api/public/visitor-bot` | Gallery + landing list + quota + PV-safe bot summaries — marketing/anonymous; not arbitrary cross-origin. |
| `/api/trial/bots` | Trial bot creation — same. |

**Default:** Any path not in the broad lists is **strict** (e.g. `/health`, `/api/unknown`, future `/api/admin/...`).

## Maintaining the classifier

When you add a new HTTP route:

- **Default:** it falls into **strict** unless you extend `public-embed-cors-paths.util.ts`.
- **Under `/api/widget`:** only **`/api/widget/init`** and **`/api/widget/register-website`** are public (exact paths). New widget routes must **not** use a broad prefix allow — add an **exact** path or keep them strict.
- **Deny-first:** `isStrictCorsPath` runs first. Preview (`/api/widget/preview/...`) and testing (`/api/widget/testing/...`) are always strict.
- **Segment boundaries:** `pathHasApiPrefix` ensures `/api/user` does not match `/api/users`, and `/api/widget/preview` does not match `/api/widget/previewish`.
- **Tests:** `src/cors/public-embed-cors-paths.util.spec.ts` — run `npm test` after changing paths.

Authorization (bot keys, `allowedDomains`, rate limits) is unchanged; CORS is not an auth layer.

## Final security posture (many-origin public runtime)

- **Public (broad) routes** exist so **customer HTTPS sites** can call **widget init, chat,** and **analytics track** from the browser **without** listing each domain in `CORS_EXTRA_ORIGINS`. Gallery, landing bot list, quota summary, and trial creation are **strict** — use Assistrio hosts + `CORS_EXTRA_ORIGINS` for staging/tooling.
- **Private / preview / app** traffic stays **strict** (`/api/widget/preview/*`, `/api/user/*`, …).
- **Runtime authorization is not CORS:** embed domain gates, keys, `platformVisitorId` / trial ownership, showcase registration, and rate limits are enforced **in controllers** after the request arrives. Misconfigured CORS blocks the response **before** the handler; it does **not** replace 403/401 from business rules.

## Related

- `src/cors/cors-origin.util.ts` — `isReflectablePublicEmbedOrigin`, `isBrowserOriginAllowedForCors`
- `assistrio-landing-site/docs/RUNTIME_DEPLOYMENT.md` — operator-facing deploy notes
