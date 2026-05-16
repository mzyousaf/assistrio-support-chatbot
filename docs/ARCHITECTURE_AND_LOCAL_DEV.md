# Assistrio platform — architecture and local development

Concise reference for how the apps fit together, how auth works, and how to run everything locally.

## Applications and responsibilities

| App | Role |
|-----|------|
| **assistrio-landing-site** | Marketing site, public showcase (`/api/public/bots`), entry points to the customer product, browser calls to customer session (`GET /api/customer/me` with credentials). |
| **assistrio-customer-app** | Customer workspace (Vite/React): bots, onboarding, knowledge, playground, go-live. Uses **`/api/customer/*`** only. |
| **ai-platform-app-admin** | Internal staff UI (`/admin/*`). Uses **`/api/admin/*`**. Password login; **`ar_admin_session`** cookie. |
| **ai-platform-backend** | NestJS API: admin auth, customer auth (incl. Google OAuth), **`/api/admin/*`** and **`/api/customer/*`** workspace routes, public/widget routes, bots, documents, chat. |
| **chat-widget** | Published **`@assistrio/chat-widget`** bundle (JS/CSS). Consumes widget runtime APIs; **`apiBaseUrl`** is supplied by the host snippet, not a build-time env in the package. |

## Backend route grouping (canonical)

- **`/api/admin/*`** — Staff portal: session from **`AdminSessionAuthGuard`** (`ar_admin_session` only). Password login at **`POST /api/admin/auth/login`** (logout also clears stale `user_token` cookies when present).
- **`/api/customer/*`** — Customer portal: **`CustomerSessionAuthGuard`** (`ar_customer_session` only). Google OAuth under **`/api/customer/auth/google/*`**; **`POST /api/customer/auth/logout`**.
- **`/api/public/*`** — Public bots/gallery (rate-limited; some paths key-guarded).
- **`/api/public/landing/*`** — Curated list for integrations that use **`X-API-Key`** matching Nest **`LANDING_SITE_BOTS_API_KEY`** (optional; marketing site may use **`/api/public/bots`** without a key instead).
- **Widget / chat** — e.g. **`/api/widget/*`**, **`/api/chat/*`** as configured in the backend (CORS and embed rules documented in `ai-platform-backend/docs/CORS.md`).

## Admin vs customer auth split

- **Different cookies:** `ar_admin_session` vs `ar_customer_session` (a legacy `user_token` cookie may still be cleared on admin sign-out but is **not** accepted for authentication).
- **Different guards:** Admin routes never accept a customer-only session and vice versa (see `src/auth/admin` vs `src/auth/customer` in the backend).
- **Google OAuth:** Customer-only; redirect URI is on the **API** host (e.g. `https://<api>/api/customer/auth/google/callback`). After success, Nest redirects to **`CUSTOMER_APP_BASE_URL`** (dashboard/onboarding).

## Customer Google auth flow (high level)

1. Browser opens **`GET {API}/api/customer/auth/google`** (e.g. from customer app or landing).
2. User signs in with Google; Google redirects to **`GOOGLE_OAUTH_REDIRECT_URI`** on the API.
3. API sets **`ar_customer_session`** and redirects to **`CUSTOMER_APP_BASE_URL`** (path chosen by backend logic).
4. Customer app and landing use **`credentials: 'include'`** for **`GET /api/customer/me`** so the cookie is sent (same-site or appropriate CORS).

## Session / cookie expectations

- **Production:** API, customer app, and landing origins must match how cookies are scoped (**`SameSite`**, **`Secure`**, domain). `TRUST_PROXY=1` when the API sits behind a reverse proxy.
- **Local dev:** Prefer API on **one origin** (e.g. `http://localhost:3001`). Customer Vite app on another port is normal; ensure **`VITE_API_BASE_URL`** / **`NEXT_PUBLIC_*`** point at that API and CORS allows credentials from the dev UI origins (backend dev CORS typically allows localhost).
- **Middleware (admin app):** Edge middleware calls **`GET {NEXT_PUBLIC_API_BASE_URL}/api/admin/me`** with forwarded cookies. If **`NEXT_PUBLIC_API_BASE_URL`** is unset, verification is skipped (routes still load; configure for real checks).

## Retired `/api/user/*`

The combined Nest prefix **`/api/user/*`** (unified login, duplicate staff routes, etc.) has been **removed**. Use **`/api/admin/*`** and **`/api/customer/*`** per the table above. See **`ai-platform-backend/docs/API_USER_LEGACY_RETIREMENT_RUNBOOK.md`** for a replacement map.

Admin Next app still redirects old **app** paths **`/user/*`** and **`/super-admin/*`** to **`/admin/*`** (those are frontend routes, not the removed API prefix).

---

## Local development — recommended setup

### Ports (defaults used in `.env.example` files)

| Service | Default URL |
|---------|-------------|
| **Nest API** | `http://localhost:3001` |
| **Landing (Next)** | `http://localhost:3000` |
| **Customer app (Vite)** | `http://localhost:5174` (see `assistrio-customer-app/vite.config.ts`) |
| **Admin app (Next)** | `http://localhost:3000` if run alone — **conflicts with landing**; run admin on another port when both are needed, e.g. `next dev -p 3002` |

### Environment alignment checklist

1. **Backend** `CUSTOMER_APP_BASE_URL` = customer app origin (no trailing slash), e.g. `http://localhost:5174`.
2. **Backend** `LANDING_SITE_BASE_URL` = marketing site origin, e.g. `http://localhost:3000`.
3. **Backend** `GOOGLE_OAUTH_REDIRECT_URI` = **`{API}/api/customer/auth/google/callback`** (must match Google Cloud Console).
4. **Customer app** `VITE_API_BASE_URL` = Nest origin, e.g. `http://localhost:3001`.
5. **Landing** `NEXT_PUBLIC_ASSISTRIO_API_BASE_URL` = same Nest origin.
6. **Landing** `NEXT_PUBLIC_CUSTOMER_APP_URL` = same as `CUSTOMER_APP_BASE_URL`.
7. **Admin app** `NEXT_PUBLIC_API_BASE_URL` = same Nest origin.

### Where to log in locally

- **Customer:** Use **customer app** or **landing** “Continue with Google” → both hit **`/api/customer/auth/google`** on the API. Do not use admin login for customers.
- **Staff:** Use **admin app** **`/admin/login`** → **`POST /api/admin/auth/login`** on the API.

### Caveats

- **OAuth locally:** Google redirect URI must be exactly the API callback URL (not the Vite port).
- **Multiple Next apps:** Avoid two apps on the same port; set **`-p`** for one of them.
- **Secrets:** Never commit real OAuth client secrets; use placeholders in `.env.example` only.

---

## Related backend docs

- `ai-platform-backend/docs/CORS.md`
- `ai-platform-backend/docs/PV_SAFE_PUBLIC_APIS.md`

## Suggested next phase

- Single **docker-compose** (or script) that starts API + Mongo + optional apps with ports and env wired.
- Optional **validated `return_to`** after customer OAuth for deep links back into the customer app.
