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
