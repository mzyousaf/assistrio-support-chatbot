# AI Platform Backend

NestJS API with Fastify adapter (optimized for Cloud Run).

## Scripts

- `npm run dev` - start with watch mode
- `npm run build` - compile to `dist/`
- `npm run start` - run production build

## Environment

Copy `.env.example` to `.env` and set:

- `MONGODB_URI` - MongoDB connection string
- `JWT_SECRET` - JWT signing secret for admin auth (unified User table; min 16 chars)
- `OPENAI_API_KEY` - OpenAI API key
- `JOB_RUNNER_SECRET` - secret for ingestion job runner (min 16 chars)
- `LANDING_SITE_X_API_KEY` - shared with marketing site (same value as assistrio-landing-site `NEXT_ASSISTRIO_LANDING_SITE_X_API_KEY`): `X-API-Key` for `GET /api/public/bots*` and `GET /api/public/landing/bots`; `Authorization: Bearer` for `POST /api/landing/trial/request-access` and `POST /api/landing/contact`
- `CHAT_WIDGET_API_KEY` - shared key for widget testing endpoint `GET /api/widget/testing/bot`

## Runtime Access Contract

External runtime endpoints:

- `POST /api/widget/init`
- `POST /api/chat/message`

Credential rules:

- Public bot: `accessKey` required
- Private bot: `accessKey` + `secretKey` required
- Visitor-owned trial bot chat: `visitorId` required on `/api/chat/message`

## Runtime Error Codes

Stable error codes are returned in runtime error payloads (`errorCode`), with safe user-facing messages.

Common codes:

- `BOT_NOT_PUBLISHED`
- `INVALID_ACCESS_KEY`
- `INVALID_SECRET_KEY`
- `VISITOR_ID_REQUIRED`
- `MESSAGE_LIMIT_REACHED`

Additional transport/validation codes currently used:

- `BAD_REQUEST`
- `BOT_NOT_FOUND`

## Chat architecture

- Chat answering uses a single Unified pipeline: unified knowledge retrieval + evidence-first prompting.
- Answerability logic determines whether the assistant answers in grounded mode, general mode, or safe fallback mode.
- Super-admin chat supports `?debug=true` and returns admin-safe Unified debug payload fields (retrieval/evidence/answerability diagnostics).

## Health

- `GET /health` - returns `{ status: "ok", timestamp: "..." }`

## Admin auth

Admin panel auth uses the unified **User** model (collection `users`) with roles `superadmin`, `admin`, `viewer`. Only `superadmin` and `admin` can access guarded routes. Login: `POST /api/super-admin/login`. First user: `POST /api/super-admin/seed` when no users exist.

## Modules

| Module        | Scope                | Description     |
|---------------|----------------------|-----------------|
| AuthModule    | super-admin          | Legacy auth stub (optional) |
| BotsModule    | public + super-admin | Bots CRUD       |
| DocumentsModule | super-admin        | Bot documents   |
| IngestionModule | super-admin        | Jobs runner     |
| ChatModule    | public               | Demo / trial chat |
| AnalyticsModule | super-admin        | Analytics       |
| VisitorsModule | super-admin         | Visitors        |
| RateLimitModule | global             | Rate limiting   |
