# Assistrio AI Support

Monorepo layout for the support product: **operator backend** (NestJS + Fastify + MongoDB + RAG) and a **Next.js** shell for the dashboard UI.

## Apps

| Path | Role |
|------|------|
| `backend/` | API: auth, bot CRUD, knowledge ingestion, widget init + chat, owner preview. |
| `frontend/` | Next.js app; calls the API via `NEXT_PUBLIC_API_BASE_URL` and `apiFetch()` (`src/lib/api.ts`). |

## Quick start

1. **Backend:** `cd backend && cp .env.example .env`, fill values, then `npm install` and `npm run dev` (default port `3001`).
2. **Frontend:** `cd frontend && cp .env.example .env.local`, then `npm install` and `npm run dev` (default port `3000`). The home page checks `GET /health` against the configured API base.

**Wiring:** Set `NEXT_PUBLIC_API_BASE_URL=http://localhost:3001` so the browser talks to Nest (CORS allows `localhost` and `127.0.0.1`). Login and other calls use `credentials: 'include'` so the `user_token` cookie set by the API is sent on subsequent requests.

Excluded from this backend (vs `ai-platform-backend`): visitors module, analytics module, limits/rate-limit modules, visitor trial bots, landing/public marketing endpoints.
