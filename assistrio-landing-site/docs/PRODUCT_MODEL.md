# Assistrio anonymous landing & embed — product model

Developer reference for the **assistrio-landing-site** and how it lines up with the **embed / trial / public** APIs.  
Keep this aligned with `ai-platform-backend/src/bots/widget-embed-identity.util.ts` (identity resolution).

**Analytics layers:** `ai-platform-backend/docs/ANALYTICS_BOUNDARIES.md` — ingestion vs internal (`/api/user/analytics`) vs PV-safe (`/api/public/visitor-*`); landing site reads only the PV-safe layer for summary-style data.

## Core identities (do not blur)

| Concept | Role |
|--------|------|
| **`platformVisitorId`** | Stable anonymous id (client-generated, persisted by the host). Drives **ownership**, **quota**, and **continuity** for visitor/trial/showcase flows. **Not** proof of real-world identity — anyone who knows the string can use the same anonymous bucket. |
| **`chatVisitorId`** | Chat thread / history inside the widget only. Created by the widget runtime — **not** set by the landing app in HTML snippets. |
| **Domain / origin** | **Where** the runtime widget may run (`allowedDomains`, allowlists, `embedOrigin`). Separate from **whose** quota applies. |

## Surfaces

| Surface | Meaning |
|---------|---------|
| **Showcase gallery (`/gallery`, `/bots/[slug]`)** | **Runtime demo** of **published showcase** bots. Uses `mode: "runtime"` on the landing page. Messages draw from the **showcase runtime** quota slice for this `platformVisitorId`. Not owner preview. |
| **Trial (`/trial`)** | Creates a **visitor-owned trial bot** tied to `platformVisitorId` + **allowed hostname** for runtime. |
| **Trial preview (Assistrio product UIs)** | Owners test drafts in **Assistrio-hosted preview**. **Not** embedded on this marketing site. |
| **Trial runtime (customer site)** | Widget on **allowlisted domain** only; backend enforces origin + bot access. Snippet is **runtime** config only (no preview mode on landing). |

## Landing behavior (honest limits)

- **No** account system or server-side “prove you own this id” for anonymous flows — reconnect is **paste id → localStorage** + format validation.
- **No** preview embed on the marketing site — preview stays in Assistrio app UIs.
- **No** `secretKey` in public snippets. **PV-facing** read-only summaries use **only** `POST /api/public/visitor-quota/summary` (e.g. trial step “Usage”) and `POST /api/public/visitor-bot/*` (trial success **Your bot snapshot** — `components/visitor/pv-trial-bot-summary.tsx`). Raw values stay off the page; **no** internal `/api/user/analytics` or event streams on the landing site.
- **Internal analytics** (`POST /api/analytics/track`, authenticated `/api/user/analytics`) are **not** PV product APIs — see `ai-platform-backend/docs/PV_SAFE_PUBLIC_APIS.md`.
- **Public bot list/detail** only exposes what the backend allows (`GET /api/public/bots` …) — no admin data.
- **Trial resume (browser only):** `lib/identity/pv-last-trial-bot.ts` stores the last `{ platformVisitorId, botId }` for this profile so `/trial` can show **Your last trial bot** after reload/revisit when the id still matches. Not synced server-side; clearing on id mismatch is automatic; **Forget this bot** removes local memory only. **`PvTrialBotSummary`** offers **Update numbers** (re-fetches the same three PV-safe POSTs without a page reload).

## What to save (trial handoff)

Users should treat **`platformVisitorId`**, **access key**, and **allowed domain** as **private access material** (plus bot id for integration). Sharing the id or a full snippet lets others affect the **same** quota/ownership state.

## Landing vs customer-site snippet (avoid confusion)

- **Marketing site (assistrio landing)** stores `platformVisitorId` in **browser storage** for quota, reconnect, and trial flows on **this origin only**.
- **Customer website embed** uses the id from **`AssistrioChatConfig`** in the pasted **HTML snippet** — not from landing `localStorage`.
- If a user **reconnects** on the landing site to a **different** id but leaves an old **snippet** on their site unchanged, **landing** quota/trial UI and **runtime** can temporarily reflect **different** anonymous buckets until the snippet (or config) is updated to match.

## Known tradeoffs (by design)

- **Anonymous stable id** = continuity convenience, not cryptographic ownership verification.
- **Reconnect** = anyone with the string can switch this browser to that bucket — same as backend.
- **Website registration** (`register-website`) records URL + id for allowlisting; it does **not** prove DNS ownership by itself (backend policy may add more checks elsewhere).
- **Same-domain confusion**: two users on the same machine/browser profile **share** one stored id unless one reconnects — acceptable for anonymous demos; real accounts would differ.

## Related code

- Landing identity: `lib/identity/platform-visitor.ts`, `contexts/platform-visitor-context.tsx`
- Embed contract: `lib/widget/cdn-mount.ts`, `lib/trial/build-trial-runtime-snippet.ts`
- Backend: `widget-embed-identity.util.ts`, trial / widget / public controllers
- **Customer-site runtime (CORS + allowlist):** [`RUNTIME_DEPLOYMENT.md`](./RUNTIME_DEPLOYMENT.md)

## CORS vs authorization (split public runtime)

The API **reflects many HTTPS origins** on selected **public** routes so browsers on customer sites can read responses **without** putting every customer domain in `CORS_EXTRA_ORIGINS`. That does **not** replace embed rules: **allowedDomains**, keys, **platformVisitorId** / trial / showcase checks, and rate limits are still enforced **server-side** on init, chat, trial, quota, etc. See **`RUNTIME_DEPLOYMENT.md`** and `ai-platform-backend/docs/CORS.md`.

## Risk posture (anonymous model — be honest)

| Area | Notes |
|------|--------|
| **Stable id secrecy** | **Still risky if leaked** — knowing `platformVisitorId` is enough for anonymous APIs; no password layer. |
| **Reconnect** | **Acceptable tradeoff** — paste-to-assume-bucket matches backend; not “verified ownership.” |
| **Same browser / profile** | **Acceptable tradeoff** — one stored id per profile; two people sharing a browser share quota context. |
| **register-website** | **Domain authorization ≠ title deed** — records URL + id for allowlisting; DNS proof is a separate product concern. |
| **Public routes** | **Scoped** — gallery uses `GET /api/public/bots` (CORS **strict** — Assistrio / `CORS_EXTRA_ORIGINS`); detail exposes only public DTO fields the backend returns. |
| **Snippet misuse** | **User responsibility** — full snippet includes access key + id; treat as confidential operational material. |

## Next: release QA

See **[`RELEASE_CHECKLIST.md`](./RELEASE_CHECKLIST.md)** — manual QA lists, deploy config (split CORS for public embed vs strict routes, `TRUST_PROXY`), and post-launch watchlist.
