# Assistrio AI Support — Backend

NestJS API (Fastify) for operator auth, bot CRUD, knowledge ingestion, and embed/widget chat with RAG.

## Scope

- **In:** Auth, user bot CRUD, KB + RAG, `POST /api/widget/init`, `POST /api/chat/message`, owner preview (`/api/widget/preview/*`).
- **Out:** Platform visitor module, analytics module, limits/rate-limit modules, visitor trial bots, landing/public marketing endpoints.

## Scripts

- `npm run dev` — watch mode
- `npm run build` — compile to `dist/`
- `npm run start` — production
- `npm test` — run tests

## Environment

Copy `.env.example` to `.env` and set at least `MONGODB_URI`, `JWT_SECRET`, `OPENAI_API_KEY`, `JOB_RUNNER_SECRET`.

## Health

`GET /health` → `{ status: "ok", timestamp: "..." }`

## Admin auth

Login: `POST /api/user/login` (see `AuthController`). Seed first user when none exist: `POST /api/super-admin/seed` (see `UserSeedController`).
