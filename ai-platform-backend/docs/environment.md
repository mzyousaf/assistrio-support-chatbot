# Environment variables (`ai-platform-backend`)

Configuration is loaded from `.env` / `.env.local` (see `src/config/config.module.ts` and `src/config/load-env-early.ts`). **`ai-platform-backend/.env.example` lists operational variables**—use **placeholders only** there.

**Production KB worker / cron roles:** see [kb-worker-deployment.md](./kb-worker-deployment.md) (`APP_MODE=api` | `runtime` | `worker`, `ENABLE_KB_WORKER`, avoiding duplicate crons across replicas).

## Security warnings

- **Production secrets** (JWT, OAuth client secret, OpenAI key, AWS keys, shared API keys) must come from your **deployment platform or secret manager**, not from committed files.
- **Never** commit a real `.env` with production values.
- **Test-only** variables (for example `KB_INTEGRATION`, `KB_INTEGRATION_MONGODB_URI`) are **not** listed in `.env.example`; see [_Test and script-only variables_](#test-and-script-only-variables-not-in-envexample) and the integration spec file headers.
- Optional telemetry: for abuse protection, set **`TRUST_PROXY`** correctly when the API sits behind a reverse proxy (see `src/main.ts`).

### If your `.env` uses other names (not read by this backend)

Some local templates use variable names that **`ai-platform-backend` does not load**. The process only reads the names in `.env.example` / the tables below. Common mismatches:

| Template / other name | Use this backend variable instead | Notes |
|------------------------|-----------------------------------|--------|
| `PUBLIC_API_BASE_URL` | *(none)* | There is no env for “public API base URL”. The API listens on `PORT`; customers/widget use `CUSTOMER_APP_BASE_URL` for redirects. |
| `CUSTOMER_APP_URL` | `CUSTOMER_APP_BASE_URL` | Same intent; must be this exact name. No trailing slash. |
| `LANDING_SITE_URL` | *(none in backend)* | Landing **API** auth uses `LANDING_SITE_BOTS_API_KEY` (shared secret), not a base URL env. |
| `ADMIN_APP_URL` | *(none)* | No env for admin app URL in this service. |
| `COOKIE_SECRET` | *(not used)* | Sessions use **`JWT_SECRET`** (and cookie names are fixed in `session-cookie.constants.ts`). |
| `GOOGLE_CLIENT_ID` | `GOOGLE_OAUTH_CLIENT_ID` | |
| `GOOGLE_CLIENT_SECRET` | `GOOGLE_OAUTH_CLIENT_SECRET` | |
| `GOOGLE_CALLBACK_URL` | `GOOGLE_OAUTH_REDIRECT_URI` | Must match Google Console; e.g. `http://localhost:8080/api/customer/auth/google/callback` when API is on 8080. |
| `S3_BUCKET_NAME` | `S3_PUBLIC_BUCKET` and `S3_PRIVATE_BUCKET` | Both may point to the **same** bucket in dev if your policy allows. Private uploads use `S3_PRIVATE_BUCKET`. |

**Boot requirements** you still need beyond your snippet: **`JOB_RUNNER_SECRET`** (min 16 chars per Joi), and **`JWT_SECRET`** (min 16). Optional but common: **`CHAT_WIDGET_API_KEY`**, **`LANDING_SITE_BOTS_API_KEY`** when hitting those routes.

---

## 1. App / runtime

| Env var | Required? | Secret? | Development value | Production value | Reason / why |
|--------|-----------|---------|-------------------|------------------|--------------|
| `NODE_ENV` | Yes (validated) | No | `development` | `production` | Drives Nest/Joi validation, logging, CORS helper behavior (`src/config/config.schema.ts`, `src/main.ts`). If missing, treated as `development` in some code paths; Joi defaults to `development` when using ConfigModule. |
| `APP_MODE` | No | No | `all` | API hosts: `api`; worker hosts: `worker`; public embed-only: `runtime` | Selects root module and whether in-process KB/summary crons run (`src/config/app-mode.util.ts`, `src/main.ts`). Unset/blank → `all` (monolith). Invalid non-empty values throw at bootstrap. |
| `ENABLE_KB_WORKER` | No | No | `true` if you need local extract/train crons | API: `false` (ignored in `api`/`runtime`; crons never run). Worker: `true` | In `all`/`worker`, gates `JobsCronService` registration with `APP_MODE` (`resolveEnableKbWorkerFromEnv`). Prevents API containers from draining background work when using split deploys. |
| `KB_CRON_LOGS` | No | No | `false` (omit or unset) | `false` unless debugging worker | **Global fallback** for structured cron logs. Only the string **`true`** turns logging on when a per-cron variable below is **unset**. Counts, IDs, `durationMs` only—no secrets or KB body text. See `src/worker/kb-cron-log.util.ts`. |
| `KB_CRON_LOG_CONTENT_EXTRACTION` | No | No | unset | unset | Per-cron JSON logs for extract/ingest tick. `true` / `false` overrides `KB_CRON_LOGS`; unset inherits global. |
| `KB_CRON_LOG_KNOWLEDGE_TRAINING` | No | No | unset | unset | Knowledge training tick (meta + train jobs). Table import lines use `KB_CRON_LOG_TABLE_IMPORT` separately. |
| `KB_CRON_LOG_TABLE_IMPORT` | No | No | unset | unset | Table import sub-tick (nested in training cron). |
| `KB_CRON_LOG_SUMMARY_JOBS` | No | No | unset | unset | Summary job runner tick. |
| `KB_CRON_LOG_KNOWLEDGE_PURGE` | No | No | unset | unset | Soft-deleted KB item hard purge cron. |
| `KB_CRON_LOG_BOT_PURGE` | No | No | unset | unset | Soft-deleted bot hard purge cron. |
| `KB_CRON_LOG_BACKFILL` | No | No | unset | unset | `KnowledgeExtractionStatusBackfillService` on application bootstrap. |
| `KB_CRON_LOG_APP_BOOT` | No | No | unset | unset | Extra `app_boot` JSON line from `main.ts` (module / cron registration snapshot). |
| `ALLOW_APP_MODE_ALL_IN_PRODUCTION` | No | No | n/a | `true` **only** if you intentionally run a production monolith (`APP_MODE=all`) | Without it, **`NODE_ENV=production` + `APP_MODE=all` exits the process** (`enforceProductionAppModeOrExit`). |
| `SKIP_DOTENV` | No | No | unset | Usually unset | `1`/`true` skips loading `.env` files in tests or when env is injected entirely (`load-env-early.ts`). If set unexpectedly, `.env` values are ignored. |
| `PORT` | No | No | `3001` | Platform-assigned or `3001` behind LB | HTTP listen port (`src/main.ts`). Default `3001`. |
| `TRUST_PROXY` | No | No | unset behind direct laptop access | `1` or `true` when behind nginx/ALB/Cloudflare | Enables Fastify `trustProxy` so **`req.ip`** and rate limits use the real client (`src/main.ts`). **Do not** enable on a directly exposed host (client spoofing). If missing behind a proxy, many clients can share one rate-limit bucket. |

---

## 2. Database

| Env var | Required? | Secret? | Development value | Production value | Reason / why |
|--------|-----------|---------|-------------------|------------------|--------------|
| `MONGODB_URI` | Yes (Joi) | Often (credential in URI) | Local URI e.g. `mongodb://localhost:27017/assistrio-ai` | Managed cluster URI with auth + TLS | Primary MongoDB connection (`config.factory.ts`, scripts). **Boot fails** if Joi validation fails. Integration tests may use a separate DB (see appendix). |

---

## 3. Auth / session

| Env var | Required? | Secret? | Development value | Production value | Reason / why |
|--------|-----------|---------|-------------------|------------------|--------------|
| `JWT_SECRET` | Yes (Joi, min 16) | **Yes** | Long random string (dev-only) | Strong random from secret manager | Signs customer/staff JWTs (`config.factory.ts`). **Boot fails** if missing or too short per Joi. |

---

## 4. Admin / security

| Env var | Required? | Secret? | Development value | Production value | Reason / why |
|--------|-----------|---------|-------------------|------------------|--------------|
| `ADMIN_BOOTSTRAP_TOKEN` | No | **Yes** | unset unless you use bootstrap | Strong token if `POST /api/internal/admin-bootstrap/create-superadmin` is used | When unset, bootstrap route returns **503** (`config.factory.ts`, admin bootstrap controller via token check). |
| `JOB_RUNNER_SECRET` | Yes (Joi, min 16) | **Yes** | Long random (dev) | Strong random | Shields internal job-runner HTTP hooks (`config.factory.ts`). **Boot fails** if invalid per Joi. |
| `LANDING_SITE_BOTS_API_KEY` | No* | **Yes** | Set if you call landing API locally | Shared secret for marketing site | Required header `X-API-Key` for `GET /api/public/landing/bots`. If unset → **503** “not configured” (`landing-site-api-key.guard.ts`). *Optional for boot (Joi optional); required to use that route. |
| `CHAT_WIDGET_API_KEY` | No* | **Yes** | Set if you use widget test/runtime helper endpoints | Same pattern | Widget testing/runtime helpers (`chat-widget-api-key.guard.ts`). If unset → **503** for those routes. Joi optional; min length 16 when set. |

---

## 5. Customer auth / Google OAuth

| Env var | Required? | Secret? | Development value | Production value | Reason / why |
|--------|-----------|---------|-------------------|------------------|--------------|
| `GOOGLE_OAUTH_CLIENT_ID` | For OAuth flows | No | OAuth client ID | Production client ID | Customer Google sign-in (`config.factory.ts`). All three OAuth vars must be coherent when routes are used. |
| `GOOGLE_OAUTH_CLIENT_SECRET` | For OAuth flows | **Yes** | Dev secret | Prod secret | Exchanges code for tokens (`customer-google-oauth.service.ts`). |
| `GOOGLE_OAUTH_REDIRECT_URI` | For OAuth flows | No | e.g. `http://localhost:3001/api/customer/auth/google/callback` | Must match Google Console exactly | Registered redirect (`config.schema.ts` comment). |
| `CUSTOMER_APP_BASE_URL` | No* | No | e.g. `https://localhost:5173` (no trailing slash) | `https://app.example.com` | Post-OAuth redirects (`config.factory.ts`). If missing, redirects may be wrong or relative flows may fail. |

---

## 6. Landing / trial / email

| Env var | Required? | Secret? | Development value | Production value | Reason / why |
|--------|-----------|---------|-------------------|------------------|--------------|
| `LANDING_SITE_BOTS_API_KEY` | See §4 | **Yes** | If testing landing list | Production shared key | Only landing-site-related env in this repo for that surface. |

There are **no** Resend/SMTP/`MAIL_*` environment variables in this backend; outbound transactional email is not configured via env here.

---

## 7. Storage / S3

| Env var | Required? | Secret? | Development value | Production value | Reason / why |
|--------|-----------|---------|-------------------|------------------|--------------|
| `AWS_REGION` | For uploads/downloads | No | e.g. `us-east-1` | Prod region | `S3Client` construction (`src/lib/s3.ts`). **Throws** on upload if missing. |
| `AWS_ACCESS_KEY_ID` | For uploads | **Yes** | Dev IAM/user key | Scoped IAM | With secret, used for SDK credentials. **Throws** if missing when S3 is used. |
| `AWS_SECRET_ACCESS_KEY` | For uploads | **Yes** | Dev secret | Prod secret | Same as above. |
| `S3_PUBLIC_BUCKET` | For public objects | No | Dev bucket name | Prod bucket | **Throws** if missing when a public upload runs. |
| `S3_PRIVATE_BUCKET` | For private objects | No | Dev bucket | Prod bucket | **Throws** if missing when a private upload runs. |
| `S3_PUBLIC_ACL` | No | No | usually unset (many buckets block ACL) | unset unless bucket allows `public-read` | When `1`/`true`/`yes`, sets `ACL: public-read` on public uploads (`s3.ts`). If unset, object ACL not set (works with bucket policies/CloudFront). |

---

## 8. OpenAI / AI

| Env var | Required? | Secret? | Development value | Production value | Reason / why |
|--------|-----------|---------|-------------------|------------------|--------------|
| `OPENAI_API_KEY` | Yes (Joi) | **Yes** | Dev/project key | Prod key | Rag/chat embeddings (`config.factory.ts`). **Boot fails** if Joi rejects. |
| `CHAT_EMBED_TIMEOUT_MS` | No | No | unset | unset or higher for slow networks | OpenAI embedding call timeout (`ai-call.helper.ts`). Default **30000** ms if missing/invalid. |
| `CHAT_COMPLETION_TIMEOUT_MS` | No | No | unset | unset or tuned | Completion timeout. Default **60000** ms. |
| `CHAT_SUMMARY_TIMEOUT_MS` | No | No | unset | unset or tuned | Summary timeout. Default **45000** ms. |

---

## 9. Widget / CORS / public URLs

| Env var | Required? | Secret? | Development value | Production value | Reason / why |
|--------|-----------|---------|-------------------|------------------|--------------|
| `CHAT_WIDGET_ASSET_ORIGIN` | No | No | unset (uses default CDN in code) | Your widget CDN origin if overriding | Widget script URL base (`customer-bots.controller.ts`). If missing → default `https://widget.assistrio.com`. |
| `CUSTOMER_APP_BASE_URL` | No* | No | Local customer app | Prod app URL | OAuth return UX (`config.factory.ts`). *See §5. |

**CORS / allowed origins** are **not** driven by a single env list: see `src/cors/cors-origin.util.ts` and [CORS.md](./CORS.md). `TRUST_PROXY` (§1) affects how client IP is derived for rate limits on public/embed paths.

---

## 10. KB worker (cron / job runner concurrency)

Used by `src/worker/jobs-cron.service.ts`. Each value is parsed per tick; invalid/empty falls back as noted.

| Env var | Required? | Secret? | Development value | Production value | Reason / why |
|--------|-----------|---------|-------------------|------------------|--------------|
| `JOBS_RUNNER_LIMIT` | No | No | `5` | `5`–`20` tuned to CPU/IO | Max **generic** jobs processed per cron sweep. Default **5** if unset. |
| `SUMMARY_JOBS_RUNNER_LIMIT` | No | No | `5` | similar | Max **summary** jobs per tick. Default **5**. |
| `KNOWLEDGE_TRAINING_JOBS_RUNNER_LIMIT` | No | No | `3` | `3`–`10` tuned | Max **knowledge training** jobs per tick. Default **3**. |
| `KNOWLEDGE_TRAIN_KB_DRIFT_RECONCILE_BATCH` | No | No | `25` | tuned | Max **document** KB rows scanned per tick for train-vs-status drift heal (`KnowledgeTrainKbDriftReconcileService`, immediately after train stuck reset). Minimum **1** when set/invalid. |
| `KNOWLEDGE_TRAIN_KB_DRIFT_RECONCILE_DISABLED` | No | No | unset | `true` to disable | When **`true`/`1`/`yes`**, skips the drift reconcile pass entirely. |
| `TABLE_IMPORT_JOBS_RUNNER_LIMIT` | No | No | `3` | `2`–`5` tuned | Max **table import** (`TableImportJob`) jobs claimed/processed per tick (`jobs-cron.service.ts`). Default **3** if unset. |

**Table import sessions / recovery** (large datasheet preview → confirm → background parse; `table-import.service.ts`):

| Env var | Required? | Secret? | Development value | Production value | Reason / why |
|--------|-----------|---------|-------------------|------------------|--------------|
| `TABLE_IMPORT_SESSION_TTL_HOURS` | No | No | `24` | `24`–`72` | `expiresAt` on `TableImportSession` when created after preview upload. Confirm after this instant returns **`import_session_expired`** (document kept until cleanup grace). Default **24** if unset/invalid. |
| `TABLE_IMPORT_SESSION_CLEANUP_GRACE_MS` | No | No | `3600000` | `3600000`+ | Only **preview** sessions (never consumed) are deleted by the worker sweep after they have been expired or cancelled longer than this grace; temp S3 is deleted on cancel immediately and again at sweep (idempotent). Default **1h**; minimum **60s** when set. |
| `TABLE_IMPORT_SESSION_CLEANUP_BATCH` | No | No | `50` | tuned | Max stale preview sessions processed per KB worker tick (`cleanupStaleTableImportPreviewSessions`). Default **50** if unset/invalid. |
| *(table import stuck timeout & stuck retry cap)* | — | — | — | — | **`TABLE_IMPORT_STUCK_TIMEOUT_MINUTES`** and **`TABLE_IMPORT_MAX_AUTO_RETRIES`** are **not env vars**. Defaults live in **`src/knowledge/knowledge-pipeline-retry.constants.ts`** (`TABLE_IMPORT_STUCK_TIMEOUT_MINUTES`, `TABLE_IMPORT_MAX_STUCK_RECOVERIES`). |
| `TABLE_IMPORT_MAX_LIVE_JOBS_PER_BOT` | No | No | `3` | `3`–`10` | Max **queued + processing** table import jobs per bot; `import-confirm` returns **429** when exceeded. Default **3** (minimum **1** when set). |
| `TABLE_IMPORT_MAX_STARTS_PER_BOT_PER_DAY` | No | No | `0` (off) | `50`–`500` if you need abuse caps | Counts **`TableImportJob`** documents created since **UTC midnight** per bot. **`0`** disables the check. |
| `TABLE_IMPORT_XLSX_MAX_BYTES` | No | No | `10485760` | same or lower | Excel workbook size cap for the **in-memory** XLSX path (preview + worker). **CSV** uses streaming and the general 20 MB upload cap. Default **10 MiB** if unset/invalid. |

**Soft-deleted knowledge items** (`KnowledgeBaseItem` with `active: false` and `deletedAt` set on user delete; hard-removed later by `KnowledgeItemPurgeService`):

| Env var | Required? | Secret? | Development value | Production value | Reason / why |
|--------|-----------|---------|-------------------|------------------|--------------|
| `KNOWLEDGE_ITEM_PURGE_AFTER_MINUTES` | No | No | `30` | `30`–`1440` (or higher if recovery window needed) | Grace after soft-delete before **hard** purge (chunks/jobs/S3 cleanup + `deleteOne` on the KB row). Default **30** if unset/invalid. Read directly in `knowledge-item-purge.service.ts`. |
| `KNOWLEDGE_ITEM_PURGE_BATCH_LIMIT` | No | No | `100` | tuned | Max KB items processed **per purge cron tick** (capped at **500** in code). Default **100**. |
| `KNOWLEDGE_ITEM_PURGE_INTERVAL_MINUTES` | No | No | `30` | align with deploy | **Documented** for operators; the in-process schedule is **`0 */30 * * * *`** in `jobs-cron.service.ts` unless you change that expression. |

---

## 11. KB extraction / training

| Env var | Required? | Secret? | Development value | Production value | Reason / why |
|--------|-----------|---------|-------------------|------------------|--------------|
| *(stuck timeouts, extract/train auto-retry caps, stuck-recovery caps)* | — | — | — | — | **`INGESTION_STUCK_TIMEOUT_MINUTES`**, **`KNOWLEDGE_TRAINING_STUCK_TIMEOUT_MINUTES`**, **`EXTRACT_JOB_MAX_AUTO_RETRIES`**, **`EXTRACT_JOB_RETRY_BACKOFF_BASE_MS`**, and related limits are **not read from env**. Tune in **`src/knowledge/knowledge-pipeline-retry.constants.ts`**. Manual **Retry** from the customer app resets job counters (see `manualRetryExtractJob`, knowledge manual retry). |
| `DOCUMENT_TRAIN_STALE_LOOP_WINDOW_MS` | No | No | unset (20 min) or lower to test loop guard | default unless issues | Time window counting prior stale-skip `done` jobs (`ingestion.service.ts`). Default **20m** if unset/invalid; capped **60m**. |
| `DOCUMENT_TRAIN_STALE_LOOP_THRESHOLD` | No | No | `2` | `2` or `3` | Prior stale skips before failing with `stale_document_text_loop`. Default **2**. |
| `INGEST_SKIP_REQUEUE_DELAY_MS` | No | No | unset | unset | Minimum spacing for **stale-like** requeues after skip (`ingestion.service.ts`). If unset/invalid, uses **≥12000** ms (and floor **3000**). |
| `EXTRACT_JOB_IMMEDIATE_ON_UPLOAD` | No | No | `true` | `true` usually | When `false`/`0`, disables fire-and-forget immediate claim after enqueue (`ingestion.service.ts` + worker gating). |
| `EXTRACT_JOB_CLAIM_LOOKAHEAD` | No | No | `40`–`50` | `40`–`50` | Max queued extract jobs scanned per claim tick (`ingestion.service.ts`). Default **40**. |
| `KNOWLEDGE_EXTRACTION_STATUS_BACKFILL` | No | No | `true` or unset | `true`/unset during migration; then **`false`** | Idempotent boot **backfill** for `KnowledgeBaseItem.extractionStatus` (`knowledge-extraction-status-backfill.service.ts`). Only **`false`/`0`** disables. After production rows are normalized, disable to avoid a sweep every deploy. |
| `AGENT_TRAINING_PIPELINE_STALE_MINUTES` | No | No | `30` | `15`–`120` tuned | **Presentation-only** for **GET `/knowledge/training/status`**: extracting/import/training pipeline counts ignore KB rows whose **`updatedAt` / `lastQueuedAt` / `lastTrainingStartedAt` / `extractedAt`** are **all** older than this window (`agent-training-pipeline-staleness.util.ts`). **Mongo documents unchanged.** Default **30**; Joi max **1440** (`config.schema.ts`). |
| `KNOWLEDGE_INGEST_RECONCILER_LIMIT` | No | No | `20` | `20`–`50` | Rows processed per reconciler tick (`ingestion.service.ts`). With `EXTRACT_*` unset, defaults to **20**. |
| `KNOWLEDGE_INGEST_RECONCILER_DISABLED` | No | No | `false` | `false` unless emergency | `true`/`1` disables phantom heal + extract ensure pass. |
| `EXTRACT_INGEST_RECONCILER_DISABLED` | No | No | `false` | `false` | **Legacy alias** for `KNOWLEDGE_INGEST_RECONCILER_DISABLED`. |
| `EXTRACT_INGEST_RECONCILER_LIMIT` | No | No | unset | unset | **Legacy alias** for limit when `KNOWLEDGE_INGEST_RECONCILER_LIMIT` unset. |
| `KNOWLEDGE_UPLOAD_BAD_SOURCE_SWEEP_LIMIT` | No | No | `25` | tuned | Max document KB rows checked per bad-source sweep (`ingestion.service.ts`). Default **25**. |
| `KNOWLEDGE_UPLOAD_BAD_SOURCE_SWEEP_DISABLED` | No | No | `false` | `false` | `true`/`1` disables sweep (`ingestion.service.ts`). |

---

## 12. Logging / debug

| Env var | Required? | Secret? | Development value | Production value | Reason / why |
|--------|-----------|---------|-------------------|------------------|--------------|
| `KB_TRAINING_LOGS` | No | No | `true` while debugging KB; `false` normally | `false` | Enables `[kb-training]` verbose logs (`kb-training-log.util.ts`). |
| `DEBUG_KB_TRAINING` | No | No | avoid (legacy) | omit | **Legacy alias** for `KB_TRAINING_LOGS` (same helper). Prefer `KB_TRAINING_LOGS`. Not listed in `.env.example`. |

---

## 13. Rate limits / abuse protection

**No environment variables** configure global anonymous/embed rate limits. Defaults live in:

- `src/rate-limit/public-anonymous-rate-limit.constants.ts` (IP windows for landing/public list, etc.)
- `src/bots/embed-runtime-rate-limit.util.ts` (embed runtime / preview token bucket)
- Per-bot **`widgetEmbedRateLimitPerMinute`** in Mongo (`bot.schema.ts`)

Use **`TRUST_PROXY`** (§1) so these limits see the **real client IP** when behind a proxy.

---

## Test and script-only variables (not in `.env.example`)

| Env var | Where used | Notes |
|--------|------------|------|
| `KB_INTEGRATION` | Integration specs | Must be `1`/`true` plus Mongo URI (`KB_INTEGRATION_MONGODB_URI` or `MONGODB_URI`) to run opt-in tests (`npm run test:kb-integration`). CI: ephemeral Mongo + these vars on the job. |
| `KB_INTEGRATION_MONGODB_URI` | Integration specs, `scripts/dedupe-live-extract-jobs.js` | Fallback DB URI for tests / script when provided. |
| `DRY_RUN` | `scripts/dedupe-live-extract-jobs.js` | `1`/`true` for dry run. |
| `EXTRACT_JOB_DEDUPE_STALE_MS` | `scripts/dedupe-live-extract-jobs.js` | Stale window for duplicate job handling; script default **30 min** if unset. |

---

## Cross-check: `.env.example` vs code

- **Referenced in code but omitted from `.env.example` (by design):** `DEBUG_KB_TRAINING` (legacy; documented in §12), test/script vars in the appendix above.
- **Present in `.env.example` and referenced in backend code:** all keys in the current `.env.example` file (see grep `process.env` under `src/`, `src/lib/s3.ts`, and `config.factory.ts`).

---

## Related docs

- [CORS.md](./CORS.md) — browser origins vs env-based `CUSTOMER_APP_BASE_URL` / widget URLs.
- [kb-training-local-verification.md](./kb-training-local-verification.md) — local KB verification with `KB_TRAINING_LOGS`.
