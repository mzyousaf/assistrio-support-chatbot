# Release & QA checklist — landing + public API integration

Final handoff before shipping the marketing site and anonymous public flows. Grounded in `docs/PRODUCT_MODEL.md` and backend controllers under `ai-platform-backend/src/bots/`.

**Verdict to fill after QA:** use § [Release recommendation](#release-recommendation) at the bottom.

---

## 1. Code-grounded release audit

Classifications: **Verified in code** | **Needs manual QA** | **Acceptable tradeoff** | **Follow-up / blocked**

### Identity (`platformVisitorId`)

| Item | Status | Notes |
|------|--------|--------|
| Landing generates & persists id | **Verified in code** | `lib/identity/platform-visitor.ts` + `contexts/platform-visitor-context.tsx` (`localStorage`, optional `?platformVisitorId=`). |
| Reconnect via saved ID | **Verified in code** | `reconnectWithPlatformVisitorId` persists + validates format. |
| `chatVisitorId` widget-only | **Verified in code** | Landing snippets omit it; `cdn-mount.ts` / trial snippet match widget contract. Quota API rejects legacy `visitorId` on quota summary (`public-visitor-quota.controller.ts`). |

### Showcase

| Item | Status | Notes |
|------|--------|--------|
| Gallery lists showcase only | **Verified in code** | `PublicBotsController` → `findPublicShowcase()` + `shapePublicBotListItem`. |
| Detail loads runtime widget only | **Verified in code** | `AssistrioShowcaseRuntimeEmbed` + `mountAssistrioRuntimeFromCdn` with `mode: "runtime"` — no preview embed. |
| Showcase runtime requires `platformVisitorId` | **Verified in code** | Embed waits for identity; backend `getEmbedRuntimePlatformIdentityViolation` requires real id for showcase user bots. **Needs manual QA** on live init. |
| Showcase quota shared across gallery bots | **Verified in code** | UX + quota DTO labels; backend buckets per visitors service. **Needs manual QA** to confirm numbers move when switching bots. |
| Website registration → correct route | **Verified in code** | Landing `POST /api/widget/register-website` (`lib/api/website.ts`). Trial explicitly not supported on that route (controller comments). |

### Trial

| Item | Status | Notes |
|------|--------|--------|
| Trial requires `platformVisitorId` + allowed domain | **Verified in code** | `trial-bots.controller.ts` validates format + domain. |
| Success UI + copy package | **Verified in code** | `trial-success-panel.tsx` + `trial-runtime-snippet.tsx`. |
| Runtime snippet vs widget | **Verified in code** | Same config keys as `mountAssistrioRuntimeFromCdn` / `buildTrialRuntimeEmbedSnippet` (`mode`, `botId`, `apiBaseUrl`, `accessKey`, `platformVisitorId`, `position`). |
| Preview explained, not on landing | **Verified in code** | Copy only; no preview mount in landing codebase. |

### Safety / exposure

| Item | Status | Notes |
|------|--------|--------|
| Quota summary uses `platformVisitorId` | **Verified in code** | `fetchPublicVisitorQuotaSummary` POST body; server rejects `visitorId` alias. |
| PV product views use PV-safe APIs, not internal analytics | **Verified in code** | Internal: `POST /api/analytics/track`, `GET /api/user/analytics`. PV summaries: `POST /api/public/visitor-quota/summary`, `POST /api/public/visitor-bot/*` — see `ai-platform-backend/docs/PV_SAFE_PUBLIC_APIS.md`. |
| Internal routes not exposed anonymously | **Acceptable tradeoff** | Public controllers are a **deliberate** subset; full audit = **needs manual QA** + security review of non-public routes separately. |
| Public DTOs limited | **Verified in code** | `shapePublicBotListItem` / `shapePublicBotDetail` — **no `secretKey`**. **`accessKey` is included** for public showcase embeds (required for runtime; treat as public embed credential). |
| Rate limits on anonymous endpoints | **Verified in code** | `public-anonymous-rate-limit.constants.ts` + `enforcePublicAnonymousRateLimit` on trial, quota summary, register-website, public bots GET. |

### Cross-cutting

| Item | Status | Notes |
|------|--------|--------|
| CORS for browser → API | **Needs manual QA** | **Broad** routes (`/api/widget/init`, `/api/chat/*`, … — see `public-embed-cors-paths.util.ts`) reflect **HTTPS** customer origins without per-site env. **Gallery / landing bots / quota / trial create** are **strict** (`*.assistrio.com` + `CORS_EXTRA_ORIGINS`). After classifier edits, run **`npm test`** in `ai-platform-backend`. See `ai-platform-backend/docs/CORS.md`. |
| Rate limit IP correctness behind proxy | **Needs manual QA** | Set `TRUST_PROXY=1` (or `true`) in production + `main.ts` Fastify `trustProxy`. |
| Widget CDN reachability | **Needs manual QA** | Default `widget.assistrio.com` (`cdn-urls.ts`) or overrides. |

### Proxy / `TRUST_PROXY` / rate limits (production)

| Item | Status | Notes |
|------|--------|--------|
| Client IP for limits | **Verified in code** | `getClientIpForRateLimit` → `req.ip` (Fastify), fallback XFF (`embed-runtime-rate-limit.util.ts`). |
| Public anonymous limits | **Verified in code** | Mongo `RateLimitService`, key `prefix:ip`, window `PUBLIC_ANONYMOUS_RATE_LIMIT_WINDOW_MS` (`public-anonymous-rate-limit.util.ts`). |
| Embed IP limits | **Verified in code** | In-process `consumeEmbedRuntimeRateLimitToken` per instance (`embed-runtime-rate-limit.util.ts`). |
| 429 payload | **Verified in code** | `throwPublicAnonymousRateLimited` / `throwEmbedRuntimeIpRateLimited` include `retryAfterSeconds` + `deploymentHint` (`rate-limit-http-exception.util.ts`). |

#### Operator verification (before launch)

1. With API behind the **real** load balancer, `TRUST_PROXY=1`, call any anonymous route from a browser and confirm **distinct clients get distinct** behavior under burst (or inspect logs if you log sanitized `req.ip` in staging only).
2. Trigger 429 (e.g. burst `POST /api/public/visitor-quota/summary`) and confirm JSON includes `retryAfterSeconds` and `deploymentHint` — **not** a CORS error.
3. **Wrong config:** `TRUST_PROXY` off behind LB → `req.ip` ≈ LB IP → **all users share one bucket** (too aggressive) or odd fairness.
4. **NAT:** Many users on one public IP **correctly** share one per-IP bucket — expected tradeoff for anonymous throttling.

---

## 2. Manual QA (run before launch)

### Env / config sanity

| Step | Expected | If broken |
|------|------------|-------------|
| Build landing with `NEXT_PUBLIC_ASSISTRIO_API_BASE_URL` pointing at staging/prod API. | Site loads; gallery/trial/quota paths don’t show “configure API URL” amber states. | Missing or wrong origin; fix env and rebuild (Next inlines public env at build time). |
| Optional: set `NEXT_PUBLIC_ASSISTRIO_WIDGET_*` overrides if not using defaults. | Widget script/css load from intended URLs. | 404 or CSP; check Network tab. |

### Homepage

| Step | Expected | If broken |
|------|------------|-------------|
| Open `/`. | Hero + Identity & usage render; stable id appears after brief load. | JS error or provider missing — check layout wraps `PlatformVisitorProvider`. |
| Copy stable id. | Clipboard contains `platformVisitorId`. | Clipboard API blocked (non-HTTPS or permissions). |

### Gallery

| Step | Expected | If broken |
|------|------------|-------------|
| Open `/gallery`. | List of showcase bots; no private/trial-only bots. | API error, empty DB, or wrong `findPublicShowcase` data. |
| Click a bot. | Detail page loads metadata + runtime section. | 404 slug or API failure. |

### Showcase detail + runtime

| Step | Expected | If broken |
|------|------------|-------------|
| On `/bots/[slug]`, wait for “Widget mounted” / launcher. | Floating launcher appears; chat can open if origin allowed. | CORS, domain allowlist, missing accessKey from API, or script blocked. |
| Send a message (if allowed). | Response or clear init error — not silent hang. | Init/chat route errors; check API logs. |

### Website registration

| Step | Expected | If broken |
|------|------------|-------------|
| Submit HTTPS page URL on showcase detail. | Success card or clear API error (e.g. invalid URL). | Wrong bot keys, CORS, rate limit 429. |

### Quota summary

| Step | Expected | If broken |
|------|------------|-------------|
| View quota on homepage or `/trial`. | Three buckets: Preview / Trial runtime / Showcase demos (labels may vary slightly). | API error, 429, or invalid id format. |

### Trial creation

| Step | Expected | If broken |
|------|------------|-------------|
| `/trial` → enter allowed domain (or blank for current host) → Create. | Success panel with copy fields + snippet section. | 400 domain validation, 429, or identity not ready. |

### Trial success + snippet

| Step | Expected | If broken |
|------|------------|-------------|
| Copy runtime snippet; compare to `buildTrialRuntimeEmbedSnippet` output. | `AssistrioChatConfig` has `mode: "runtime"`, `botId`, `apiBaseUrl`, `accessKey`, `platformVisitorId`; no `secretKey`. | Env missing API base → amber “set NEXT_PUBLIC…” instead of snippet. |

### Reconnect

| Step | Expected | If broken |
|------|------------|-------------|
| Paste a **different** valid id → Use this ID. | Quota reloads; trial success clears if id no longer matches. | Context not updating — check `PlatformVisitorProvider`. |

### Cross-device reconnect & snippet QA (second browser)

Use two profiles or devices (or one normal + one private window) so **saved ids differ** unless you reconnect.

1. **Device A:** Open `/trial` (or homepage). Note the **stable id** from DevTools → Application → Local Storage, or copy it from the reconnect panel after expand.
2. **Device A:** Complete trial creation. Confirm success panel shows **bot id**, **access key**, **snippet** with the **same** `platformVisitorId` as step 1.
3. **Device A:** Copy **only** `platformVisitorId` (or the full snippet) to a safe place — password manager, note, or send to Device B.
4. **Device B:** Open the landing site fresh (new profile has a **different** auto id). Open **Reconnect with a saved ID**, paste the id from step 3 → **Use this ID**.
5. **Device B:** Confirm quota summary / anonymous bucket matches Device A (same visitor slice — usage counters should align for that id).
6. **Device B:** Visit `/trial` — you should **not** see the trial success panel unless you create again; the handoff is **id + credentials**, not automatic UI sync. Optional: paste `?platformVisitorId=` from step 3 in the URL and reload to confirm query + storage agree.
7. **Embed check (optional):** On an allowlisted test page, paste the **snippet from Device A**. The live site uses `AssistrioChatConfig.platformVisitorId` from the snippet — it does **not** read landing `localStorage`. If you change the id in the landing Reconnect panel but **not** in the snippet, landing quota UI and customer-site runtime can show **different** buckets until you align them.

**Pass criteria:** Same `platformVisitorId` on B after reconnect; quota API reflects that id; trial success only when id matches bot owner; no misleading “success” after switching to another id.

### Invalid / missing `platformVisitorId`

| Step | Expected | If broken |
|------|------------|-------------|
| Visit `?platformVisitorId=!!!`. | Amber: invalid query; new id generated (trial/home copy). | Query incorrectly accepted. |
| Reconnect with empty / malformed id. | Inline validation error. | Should not persist bad id. |

### Invalid domain (trial)

| Step | Expected | If broken |
|------|------------|-------------|
| Enter hostname backend rejects (per `validateAllowedDomainHostStrict` / trial rules). | Clear 400 + message from API. | Generic error — improve client copy if needed. |

### Rate limits

| Step | Expected | If broken |
|------|------------|-------------|
| Burst trial creates or quota calls from one IP (staging only). | Eventually **429** or rate-limit behavior per `PUBLIC_ANONYMOUS_RATE_LIMITS`. | Limits too loose/tight — tune constants; ensure Mongo rate-limit store works in prod. |

### Responsive / mobile

| Step | Expected | If broken |
|------|------------|-------------|
| Resize or device mode on `/trial`, `/gallery`, `/bots/...`. | Readable layout; reconnect + forms usable. | Overflow/CSS issues — fix as needed. |

---

## 3. Release configuration checklist

### Landing (build-time)

| Variable | Required | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_ASSISTRIO_API_BASE_URL` | **Yes** | API origin for RSC fetch + browser calls. No trailing slash. |
| `NEXT_PUBLIC_ASSISTRIO_WIDGET_JS_URL` / `NEXT_PUBLIC_ASSISTRIO_WIDGET_CSS_URL` | No | Full override of widget assets. |
| `NEXT_PUBLIC_ASSISTRIO_WIDGET_CDN_BASE_URL` | No | Base URL; defaults append `/assistrio-chat.js` and `.css`. |
| Default widget host | Fallback | `https://widget.assistrio.com/...` (`cdn-urls.ts`). |

### Backend (runtime)

| Variable / setting | Notes |
|------------------|--------|
| `CORS_EXTRA_ORIGINS` | Comma-separated **exact** origins for **strict** CORS routes (preview, user app, admin flows). **Not** required to list every customer widget domain — public embed routes use split CORS (`main.ts`, `public-embed-cors-paths.util.ts`). When adding new backend routes, see `ai-platform-backend/docs/CORS.md` so public vs strict classification stays correct. |
| `NODE_ENV` | Production uses stricter CORS than development loopback. |
| `TRUST_PROXY` | Set `1` / `true` / `yes` when behind a reverse proxy so **client IP** for rate limits matches real users (`main.ts` + `embed-runtime-rate-limit.util.ts` / public anonymous limits). |
| MongoDB (or rate-limit store) | Rate limits rely on `RateLimitService` — ensure prod connectivity. |
| Showcase bots | Each public showcase bot needs correct **`allowedDomains`** / access state so embed + register-website behave as intended. **`accessKey`** is exposed in public DTOs by design for embed. |
| Secrets | **Do not** expose `secretKey` via public gallery DTOs — current shapers omit it. |

### Smoke tests before go-live

- [ ] Landing origin loads and calls API without CORS errors (browser DevTools). Gallery, quota, trial-create, and landing bot list are **strict** CORS — use an Assistrio hostname or add the preview origin to **`CORS_EXTRA_ORIGINS`**.
- [ ] Widget init from a **customer HTTPS origin** works **without** adding that origin to `CORS_EXTRA_ORIGINS` (**broad** runtime routes); 403s should be domain/key identity, not CORS.
- [ ] `TRUST_PROXY` verified if using a load balancer (spot-check rate limit not keyed only on LB IP).

---

## 4. Post-launch operational watchlist

| Signal | Why it matters |
|--------|----------------|
| Spike in `POST /api/trial/bots` | Abuse, viral traffic, or broken client loop. |
| Spike in `POST /api/widget/register-website` | Allowlist spam or scraping. |
| High `POST /api/public/visitor-quota/summary` volume | Quota scraping if ids leak; tune limits / monitoring. |
| 403 / domain errors on `widget/init` or chat | Misconfigured `allowedDomains` or wrong `embedOrigin`. |
| 429 responses | Expected under abuse; tune if legitimate users hit caps. |
| Widget asset 404 / script errors | CDN outage or wrong `NEXT_PUBLIC_ASSISTRIO_WIDGET_*` in build. |
| Support themes: “lost my trial” | Users didn’t save `platformVisitorId` — copy already warns; track FAQ needs. |
| Support: “someone used my quota” | Shared id/snippet — inherent anonymous model. |

---

## 5. Known tradeoffs (remain after ship)

- **Anonymous `platformVisitorId`** — anyone with the string can use the same quota APIs; not account auth.
- **Public showcase `accessKey` in JSON** — required for client-side runtime demo; still an embed credential (protect KB content via backend auth on data, not by hiding key from browser).
- **Website registration** — records intent; does not prove DNS ownership by itself.
- **CORS** — **broad** embed paths (`init`, `chat`, …) reflect HTTPS customer origins; gallery/trial/quota/landing list are **strict**; staging still uses `CORS_EXTRA_ORIGINS` as needed.

---

## 6. Related docs

- [`PRODUCT_MODEL.md`](./PRODUCT_MODEL.md) — identity & surface rules.
- [`RUNTIME_DEPLOYMENT.md`](./RUNTIME_DEPLOYMENT.md) — customer origins, CORS vs embed rules, diagnosis.
- [`../README.md`](../README.md) — env overview.

---

## Release recommendation

Choose one after QA:

- **Ready** — manual QA above passed on staging; CORS + `TRUST_PROXY` confirmed for your deployment shape.
- **Ready with caveats** — code paths OK but embed CORS / rate limits / data not fully exercised (typical first ship).
- **Not ready** — blocking failures in manual QA or missing prod config.

**Default honest stance for first ship:** **Ready with caveats** until manual E2E and CORS/embed checks complete on real origins.
