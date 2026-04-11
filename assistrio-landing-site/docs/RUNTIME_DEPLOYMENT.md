# Runtime deployment — customer origins, CORS, and embed rules

Code-grounded guide for **widget runtime** on **real customer sites** (not `*.assistrio.com` only). Complements [`PRODUCT_MODEL.md`](./PRODUCT_MODEL.md) and [`RELEASE_CHECKLIST.md`](./RELEASE_CHECKLIST.md).

## What must be true (both)

| Layer | Controls | Typical failure |
|-------|----------|-----------------|
| **CORS** (split by route — see below) | Whether the **browser** may read the API response from the **page origin** | Network tab: CORS / preflight failed — **no JSON body**, no `deploymentHint` |
| **Bot embed rules** (`allowedDomains`, showcase allowlist / `register-website`) | Whether **this bot** may run on **this hostname/origin** after CORS succeeds | HTTP **403** from `POST /api/widget/init` with `errorCode` and optional `deploymentHint` |

**Order of operations:** CORS first (browser), then init/chat authorization (server). **Authorization** for who may embed is **not** CORS — it is keys, `allowedDomains`, trial/showcase identity rules, etc.

## Split CORS (backend)

Implemented in `ai-platform-backend/src/main.ts` with `public-embed-cors-paths.util.ts` + `cors-origin.util.ts`:

| Bucket | Routes (prefix examples) | Browser origins |
|--------|--------------------------|-----------------|
| **Public embed (broad)** | Exact: `/api/widget/init`, `/api/widget/register-website`. Subtrees: `/api/chat/*`, `/api/public/*`, `/api/trial/*`, `/api/analytics/*` **minus** deny-first paths in `public-embed-cors-paths.util.ts` | **Any valid HTTPS `Origin`** is reflected in production for those paths. |
| **Strict** | Preview, user, jobs, admin, gallery/listing/quota/trial-create paths (`/api/public/bots`, `/api/public/landing`, `/api/public/visitor-quota`, `/api/trial/bots`, … — see `STRICT_CORS_PATH_PREFIXES`), `/health`, anything not broad | Assistrio production hosts + **`CORS_EXTRA_ORIGINS`** + dev loopback. |

**Maintainers:** When adding API routes, read `ai-platform-backend/docs/CORS.md` — new paths default to **strict**; only update `public-embed-cors-paths.util.ts` for intentional public browser traffic. Run **`npm test`** in `ai-platform-backend` (`public-embed-cors-paths.util.spec.ts`) after changing the classifier.

**Preview** (`/api/widget/preview/*`) stays **strict** — Assistrio app UIs and configured hosts, not arbitrary customer sites.

**`CORS_EXTRA_ORIGINS`** is used for **strict** routes (including gallery, landing bot list, quota summary, trial creation) and staging — **not** needed for **broad** runtime paths (`/api/widget/init`, `/api/chat/*`, …) on customer HTTPS sites.

## Assistrio-owned vs customer vs preview

| Surface | Typical origin | CORS |
|---------|----------------|------|
| Marketing / gallery on `*.assistrio.com` | Covered by default production allowlist for **strict** routes; public routes also work via HTTPS reflect | No per-customer env for **runtime init/chat** on customer HTTPS sites |
| **Customer production site** | `https://shop.example.com` | **Public runtime routes:** reflected automatically if HTTPS. **Strict routes** (e.g. logged-in app calls from that origin) may still need `CORS_EXTRA_ORIGINS` if not `*.assistrio.com`. |
| Assistrio **preview** (app UIs) | Usually `*.assistrio.com` or dev loopback | **Strict bucket** for `/api/widget/preview/*` |

**Runtime allowed domains** (trial `allowedDomain`, showcase `allowedDomains`, `exact:…`, `register-website`) are checked **inside** the API after the request arrives — they do **not** replace embed authorization.

## Environment (API process)

| Variable | Role |
|----------|------|
| `CORS_EXTRA_ORIGINS` | Comma-separated **full** origins for **strict** CORS routes — not required for every customer widget domain. |
| `NODE_ENV` | `development` → loopback HTTP allowed for public reflect + strict dev rules; production → HTTPS-only for public reflect. |
| `TRUST_PROXY` | `1` / `true` / `yes` → Fastify `trustProxy` (`main.ts`) for correct **client IP** (rate limits, `getClientIpForRateLimit`). |

## Widget assets (CDN)

Landing defaults: `https://widget.assistrio.com/assistrio-chat.{js,css}` (`assistrio-landing-site/lib/widget/cdn-urls.ts`). Override with `NEXT_PUBLIC_ASSISTRIO_WIDGET_*` at **build** time. Script load failures are separate from API CORS (check Network tab for 404/blocked).

## Diagnosing failures

1. **CORS / preflight** — Browser console + Network: failed preflight or missing `Access-Control-Allow-Origin`. For **public** routes, confirm **HTTPS** in production and a normal browser `Origin`. For **strict** routes, fix **`CORS_EXTRA_ORIGINS`** / Assistrio host.
2. **403 init with JSON** — Read `errorCode` and `deploymentHint` (see `runtime-deployment-hints.ts` on backend). Widget surfaces the hint in the thrown error message (`chat-widget/src/api.ts`).
3. **429 with JSON (`RATE_LIMITED`)** — Request **reached** the API (unlike CORS). Body includes `retryAfterSeconds` and `deploymentHint` for IP-based limits (`rate-limit-http-exception.util.ts`). Wait before retry. If **everyone** hits 429 unfairly, check **`TRUST_PROXY`** — without it behind a load balancer, `req.ip` may be the proxy (`getClientIpForRateLimit`).
4. **Works on assistrio.com, fails on customer** — For **init/chat**, check **403** / `allowedDomains` first. CORS on public routes should not require listing the customer origin.

## Credentials / cookies (embed session)

`POST /api/widget/init` may set an **HttpOnly** embed session cookie (`embed-session.service.ts`) with `SameSite=None; Secure` for cross-site API responses. The browser still sends `credentials: true` on follow-up `/api/chat/*` requests. **Split CORS** continues to use **reflected `Access-Control-Allow-Origin`** (not `*`) so credentialed cross-origin requests remain valid. This does not replace server-side session verification.

## Rate limits & `TRUST_PROXY`

| Mechanism | Storage | Key shape | Window |
|-----------|---------|-----------|--------|
| Public anonymous (`enforcePublicAnonymousRateLimit`) | Mongo | `prefix:clientIp` | 60s (`PUBLIC_ANONYMOUS_RATE_LIMIT_WINDOW_MS`) |
| Embed IP (`consumeEmbedRuntimeRateLimitToken`) | In-memory per API process | `embed_rt:clientIp` | 60s (`EMBED_RUNTIME_RATE_LIMIT_WINDOW_MS`) |

**`clientIp`** = `getClientIpForRateLimit(req)` → **`req.ip`** when possible. Enable **`TRUST_PROXY=1`** in production when the app is **behind** a reverse proxy so `req.ip` reflects the **end user**, not the LB. Do **not** enable if Node is directly exposed without a proxy (spoofing risk).

**Multi-user NAT:** One public IP ⇒ one per-IP bucket for anonymous limits — acceptable tradeoff.

## Verification checklist (operator)

- [ ] Customer page uses **HTTPS** in production (required for reflected public CORS + secure cookies).
- [ ] Bot `allowedDomains` (or showcase registration) includes the **hostname** for runtime.
- [ ] `TRUST_PROXY` set if API is behind a reverse proxy.
- [ ] Widget JS/CSS load (200) from CDN or env override.

## End-to-end traces (what runs first)

### A) Trial runtime (snippet on customer site)

1. **Build** — Landing (or your CMS) inlines `NEXT_PUBLIC_API_BASE_URL` into the snippet (`buildTrialRuntimeEmbedSnippet` / `TrialRuntimeSnippet`).
2. **Page load** — Browser loads HTML; widget script/CSS from CDN (`getAssistrioWidgetCdnUrls`). Failure here: **CDN / ad blocker** — not CORS to API yet.
3. **Mount** — `AssistrioChat.mount` → `validateAndInitWidget` → `POST {apiBaseUrl}/api/widget/init` with body including `embedOrigin` from `window.location.origin` (`chat-widget/src/api.ts`, `toInitRequest`).
4. **Browser** — For cross-origin API, sends `Origin: <page origin>`. **CORS preflight** may run first. Public route → **HTTPS origin reflected** without env allowlist.
5. **Server** — `WidgetInitController.init` (`widget-init.controller.ts`): credentials → rate limit → **Origin header** → trial `platformVisitorId` owner match → identity rules → **domain gate** (`checkEmbedDomainGate` vs trial `allowedDomains`).

**Landing UI** does not run on the customer page — only the snippet does. Operators use DevTools + this doc.

### B) Showcase runtime after `register-website`

1. **Registration** — `POST /api/widget/register-website` (`ShowcaseWebsiteRegistration`) stores **hostname** (from pasted URL or hostname) + `platformVisitorId` for allowlist bypass (`platformVisitorEmbedCanBypassAllowedDomainsGate` path in init).
2. **Customer page** — Same as (A) steps 2–4: CDN → mount → init with `Origin`.
3. **Server** — Domain gate may bypass via allowlist; else `allowedDomains` on bot. Additional checks: `assertPlatformVisitorWebsiteMatchesBotAllowlist` compares registered **hostname** to the request **Origin** hostname (`PLATFORM_VISITOR_*` errors).

**How to tell which layer failed** — See `lib/embed/runtime-failure-layers.ts` and UI component `components/visitor/runtime-failure-hints.tsx` (static triage copy).

## Related files

| Area | Path |
|------|------|
| CORS split + strict allowlist | `ai-platform-backend/src/main.ts`, `cors/public-embed-cors-paths.util.ts`, `cors/cors-origin.util.ts` |
| Init errors + `deploymentHint` | `ai-platform-backend/src/bots/widget-init.controller.ts`, `runtime-deployment-hints.ts` |
| Domain gate | `ai-platform-backend/src/bots/embed-domain.util.ts` |
| Widget init client | `chat-widget/src/api.ts`, `types.ts` |
| Landing triage copy | `assistrio-landing-site/lib/embed/runtime-failure-layers.ts`, `runtime-failure-messages.ts` |
