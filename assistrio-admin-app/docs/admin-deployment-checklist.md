# Assistrio Admin App — internal deployment checklist

Internal v1 deployment guide for `assistrio-admin-app` (Vite + React). Use after Phase 9 IA and Phase 9A cleanup; app build should pass before go-live.

> **Security:** Never commit `.env`. Never document real API keys, passwords, bootstrap tokens, session values, or production cookies in this doc or tickets.

---

## 1. Local build

```bash
cd assistrio-admin-app
npm install
npm run build
```

- `npm run build` runs `tsc` then `vite build`.
- Production builds require `VITE_API_BASE_URL` at build time (see §2).

---

## 2. Required frontend environment

Copy `assistrio-admin-app/.env.example` to `.env` locally only — **do not commit `.env`**.

```env
VITE_API_BASE_URL=https://api.your-domain.com
VITE_CUSTOMER_APP_ORIGIN=https://app.your-domain.com
```

| Variable | Required | Purpose |
|----------|----------|---------|
| `VITE_API_BASE_URL` | **Yes** (production build) | Backend API origin (no trailing slash). Admin calls `{origin}/api/admin/*` and `{origin}/health`. |
| `VITE_CUSTOMER_APP_ORIGIN` | Optional | Customer app origin for deploy share / iframe / preview links. Omit if unused. |

**Explain:**

- `VITE_API_BASE_URL` must point to the **backend API** origin, not the admin static site host.
- `VITE_CUSTOMER_APP_ORIGIN` is optional and only needed when admin UI builds customer-app or share/iframe URLs.
- Only `VITE_*` variables are exposed to the browser bundle.

**Local dev example:**

```env
VITE_API_BASE_URL=http://localhost:8080
# VITE_CUSTOMER_APP_ORIGIN=http://localhost:5173
```

Check `vite.config.ts` `server.port` for the admin dev origin used in CORS (default `3000`; some teams use `3003`).

---

## 3. Backend requirements

Deploy **`ai-platform-backend`** in API-capable mode — **not** `APP_MODE=runtime` only.

| Requirement | Detail |
|-------------|--------|
| **App mode** | `APP_MODE=api` or `APP_MODE=all` |
| **Admin API** | `/api/admin/*` registered and reachable |
| **Health** | `GET /health` reachable from the admin app (Settings → System) |
| **MongoDB** | At least one user with `role: 'superadmin'` |
| **OpenAI** | `OPENAI_API_KEY` only required for **Settings → Developer → Test OpenAI platform key** (`POST /api/admin/openai/test-platform-key`) |

See `ai-platform-backend/.env.example` and `ai-platform-backend/docs/environment.md` for full backend env (JWT, MongoDB, etc.) — no secrets in this checklist.

---

## 4. CORS requirements

Admin routes use strict CORS. The **browser admin origin** must be allowed by the backend.

| Environment | Example admin origin |
|-------------|----------------------|
| Local dev | `http://localhost:3003` or `http://localhost:3000` (match Vite port) |
| Production | `https://admin.assistrio.com` |

Requirements:

- Backend must allow **credentials** for admin requests (`Access-Control-Allow-Credentials: true`).
- Admin app uses `fetch(..., { credentials: 'include' })` (`src/api/client.ts`).

See `ai-platform-backend/docs/CORS.md` for path rules.

---

## 5. Cookie / session requirements

| Item | Value |
|------|--------|
| Session cookie name | `ar_admin_session` |
| Client behavior | `credentials: 'include'` on admin API requests |
| Set on | `POST /api/admin/auth/login` |
| Cleared on | `POST /api/admin/auth/logout` |

**Cross-subdomain (`admin.*` + `api.*`):**

- API and admin frontend domains must allow browser cookie sharing for credentialed requests.
- Production cookies should use `Secure`; cross-site setups often need `SameSite=None` + `Secure`.
- Cookie `Domain` / `SameSite` are set by the API login response — verify in DevTools after login.
- `TRUST_PROXY=1` behind reverse proxies in production.

---

## 6. Suggested deployment domains

| Host | Service |
|------|---------|
| `https://admin.assistrio.com` | `assistrio-admin-app` static build (`dist/`) |
| `https://api.assistrio.com` | `ai-platform-backend` (API mode) |
| `https://app.assistrio.com` | `assistrio-customer-app` (optional; set `VITE_CUSTOMER_APP_ORIGIN` if admin links to it) |

Build admin with `VITE_API_BASE_URL=https://api.assistrio.com` at **build** time. Serve `dist/` with SPA fallback to `index.html` for client routes.

---

## 7. Superadmin account

The admin app requires a **superadmin** before login works. Customer accounts cannot use `/api/admin/*`.

**Bootstrap (ops only — no secrets in this doc):**

1. Set `ADMIN_BOOTSTRAP_TOKEN` on the API service (never commit).
2. `POST /api/internal/admin-bootstrap/create-superadmin` with header `x-admin-bootstrap-token` and JSON body `{ "email", "password" }`.
3. If bootstrap is disabled, API returns **503**.

Alternatively use your team’s existing internal/DB procedure to create `role: 'superadmin'`. Do not paste tokens or passwords here.

---

## 8. Post-deploy smoke test

Run as superadmin:

- [ ] Open admin app — login page loads
- [ ] Login as superadmin — redirect to **`/customers`**
- [ ] **Customers** — list loads
- [ ] Open a **customer detail** (overview, workspaces, bots)
- [ ] Open **customer analytics** (`/customers/:customerId/analytics`)
- [ ] **Bots** — list loads
- [ ] Open a **bot editor** (overview, profile, behavior)
- [ ] **Bot → Knowledge** (overview, documents, FAQs, notes)
- [ ] **Bot → Conversations** (`/bots/:id/conversations`)
- [ ] **Bot → Bot analytics** (`/bots/:id/analytics`)
- [ ] **Admin bots** — list; create or edit a platform bot if needed (`/admin-bots/new` wizard)
- [ ] **Insights → Platform analytics** (`/insights/platform-analytics`)
- [ ] **Insights → Marketing visitors** (`/insights/marketing-visitors`)
- [ ] **Settings → System** — backend **health** check shows online
- [ ] **Settings → Developer** — test OpenAI platform key (if `OPENAI_API_KEY` configured on API)
- [ ] **Logout** — returns to login; protected routes require auth

Optional:

```bash
curl -s https://api.your-domain.com/health
```

**Primary nav (v1):** Customers · Bots · Admin bots · Insights (Platform analytics, Marketing visitors) · Settings.

---

## 9. Known v1 limitations

| Area | Status |
|------|--------|
| Billing / plans | Not implemented |
| Customer plan management | Not implemented |
| Knowledge → Datasheets | Placeholder |
| Settings ops tools | Some developer/internal tools disabled or coming soon |
| Analytics caveats | Some platform cards may show in-app caveats depending on backend data scope |
| Legacy URLs | `/analytics/*` and `/visitors/*` are **redirects only** in `App.tsx` — not separate pages |

---

## 10. Rollback notes

- Keep the previous admin `dist/` artifact (or prior container image) if you need a quick rollback.
- **Login fails:** check CORS, cookie `Secure`/`SameSite`, and that `VITE_API_BASE_URL` matches the API origin.
- **App loads but no data:** confirm backend is in API mode and `GET /api/admin/me` works with session cookie.
- **OpenAI test fails:** verify `OPENAI_API_KEY` on the API service (test is optional for go-live).

---

## Related references

- `assistrio-admin-app/.env.example`
- `ai-platform-backend/.env.example`
- `ai-platform-backend/docs/environment.md`
- `ai-platform-backend/docs/CORS.md`
