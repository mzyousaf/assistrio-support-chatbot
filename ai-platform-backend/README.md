# AI Platform Backend

NestJS API with Fastify adapter (optimized for Cloud Run).

## Scripts

- `npm run dev` — start with watch mode
- `npm run build` — compile to `dist/`
- `npm run start` — run production build

## Environment

Copy `.env.example` to `.env` and set:

- `MONGODB_URI` — MongoDB connection string
- `JWT_SECRET` — super-admin JWT signing secret (min 16 chars)
- `OPENAI_API_KEY` — OpenAI API key
- `JOB_RUNNER_SECRET` — secret for ingestion job runner (min 16 chars)

## Health

- `GET /health` — returns `{ status: "ok", timestamp: "..." }`

## Modules

| Module        | Scope              | Description                    |
|---------------|--------------------|--------------------------------|
| AuthModule    | super-admin        | Login / JWT                    |
| BotsModule    | public + super-admin | Bots CRUD                    |
| DocumentsModule | super-admin      | Bot documents                  |
| IngestionModule | super-admin      | Jobs runner                    |
| ChatModule    | public             | Demo / trial chat              |
| AnalyticsModule | super-admin      | Analytics                      |
| VisitorsModule | super-admin       | Visitors                       |
| RateLimitModule | global            | Rate limiting                  |
