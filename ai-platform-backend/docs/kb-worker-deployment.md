# Knowledge Base worker, crons, and production process roles

This document describes how **Assistrio** should split **API**, **public runtime (widget/chat)**, and **background KB work** (ingestion, extraction, training, table import, purges) across processes in production.

Related: [environment.md](./environment.md) (all env vars), [kb-training-local-verification.md](./kb-training-local-verification.md) (local KB training checks).

---

## A. Production process roles

### API service (customer + admin HTTP)

| Setting | Value |
|--------|--------|
| `APP_MODE` | `api` |
| `ENABLE_KB_WORKER` | `false` (explicit recommended; also forced off in code for `api`) |

Handles workspace CRUD, documents, knowledge APIs, auth, etc. **Does not** register `JobsCronService` or run KB crons.

### Runtime service (embed + chat + analytics track)

| Setting | Value |
|--------|--------|
| `APP_MODE` | `runtime` |
| `ENABLE_KB_WORKER` | `false` (explicit recommended; also forced off in code for `runtime`) |

Loads `RuntimeAppModule` only: public/widget/chat paths. **No** `ScheduleModule`, **no** ingestion HTTP controllers, **no** KB crons.

### Worker service (background jobs)

| Setting | Value |
|--------|--------|
| `APP_MODE` | `worker` |
| `ENABLE_KB_WORKER` | `true` |

Loads `WorkerAppModule`: `ScheduleModule` + `JobsCronService` when `ENABLE_KB_WORKER=true`, plus ingestion/knowledge modules with **`registerHttpControllers: false`** (no `POST /api/jobs/auto-run` on the worker). Exposes **`HealthController`** only for ops checks—not customer dashboard traffic.

---

## B. Why this matters

1. **Do not** run **multiple** production replicas of **`APP_MODE=all`** with **`ENABLE_KB_WORKER=true`** unless you intentionally accept duplicate work: each replica registers the same Nest `@Cron` handlers, so **every replica** runs extraction, summary, training/table-import, and purge ticks on the same schedule.
2. **Job claiming** (e.g. `findOneAndUpdate` on queued jobs) is **mostly atomic**, so duplicate workers usually **do not** process the **same** queue item twice—but you still get **duplicate cron scans**, **duplicate reconcile/purge passes**, extra Mongo load, and noisy logs.
3. **API and chat runtime** should stay **isolated** from CPU-heavy CSV/XLSX table import, embedding batches, and purge sweeps so latency stays predictable.
4. **Purge and reconcile** paths are safer and easier to reason about when **one dedicated worker fleet** (or a **single** replica until you validate idempotency) runs them.

---

## C. Which code enforces this

| Concern | File(s) |
|--------|---------|
| `APP_MODE` values, `ENABLE_KB_WORKER` resolution, “can this process run jobs?”, production `APP_MODE=all` gate | `src/config/app-mode.util.ts` |
| Root module selection (`AppModule` vs `WorkerAppModule` vs `RuntimeAppModule`), bootstrap log | `src/main.ts` |
| Register `ScheduleModule` + `JobsCronService` only for monolith **all** + KB worker | `src/app.module.ts` (`shouldRegisterKbInProcessCronsForAppModule`) |
| Worker: same crons only for **`worker`** + KB worker | `src/worker/worker.app.module.ts` (`shouldRegisterKbInProcessCronsForWorkerApp`) |
| Runtime: no crons, no job HTTP | `src/runtime/runtime.app.module.ts` |
| **Defense in depth:** each cron method skips unless `appMode` is `all` or `worker` **and** `enableKbWorker` is true | `src/worker/jobs-cron.service.ts` (`shouldRunInProcessCrons` / `cronDisabledReason`) |
| `POST /api/jobs/auto-run` secret + mode/worker guard | `src/ingestion/jobs-auto-run.controller.ts`, `src/ingestion/http-job-processing.guard.ts` (`assertHttpJobProcessingAllowed`) |
| Worker does **not** mount job HTTP controllers | `src/ingestion/ingestion.module.ts` (`IngestionModule.forRoot({ registerHttpControllers: false })`) |

Configured values are injected from the same rules in `src/config/config.factory.ts` / `src/config/config.schema.ts` (Joi).

---

## D. Environment matrix

| Service | `APP_MODE` | `ENABLE_KB_WORKER` | Public HTTP? | Runs in-process KB crons? | Purpose |
|--------|------------|--------------------|--------------|-----------------------------|---------|
| API | `api` | `false` (recommended) | Yes (full API) | **No** | Customers, admin, uploads |
| Runtime | `runtime` | `false` (recommended) | Yes (widget/chat/track only) | **No** | Embeds, visitors, chat |
| Worker | `worker` | `true` | Health (minimal); not for app traffic | **Yes** (if flag true) | Extract, train, table import, summary, purges |
| Monolith (dev / exceptional prod) | `all` | `true` / `false` | Yes | **Yes** iff `ENABLE_KB_WORKER=true` | Local dev; production only with `ALLOW_APP_MODE_ALL_IN_PRODUCTION=true` |

**Production:** `NODE_ENV=production` with `APP_MODE=all` **exits** unless `ALLOW_APP_MODE_ALL_IN_PRODUCTION=true` (see `enforceProductionAppModeOrExit` in `app-mode.util.ts`).

---

## E. Local development

- **`APP_MODE=all`** with **`ENABLE_KB_WORKER=true`** is the usual **single-process** dev setup (crons + API together).
- **`APP_MODE=api`** locally with a separate **`APP_MODE=worker`** process is a good rehearsal for production.
- **Production** should use **`api`**, **`runtime`**, and **`worker`** as separate deployables, not multiple `all+KB` replicas.

---

## F. Scaling workers

1. **Start with one worker replica.** Confirm behavior under load before scaling out.
2. **Multiple worker replicas:** queue **claims** are designed to be **atomic**, so the same **queued** extract/train/table job should not be processed twice. Non-claimed work (reconcile, purge eligibility scans, stuck-job resets) may still run **on every replica**—extra load and log volume.
3. **Distributed locking** for crons is **not** implemented; do not assume “only one cron tick globally” across replicas.

---

## G. HTTP auto-run endpoint

- **`POST /api/jobs/auto-run`** (header **`x-job-runner-secret`**) is implemented in `src/ingestion/jobs-auto-run.controller.ts`.
- It must match **`JOB_RUNNER_SECRET`** from config (Joi-validated at boot).
- **`assertHttpJobProcessingAllowed`** rejects **`APP_MODE=api`**, **`APP_MODE=runtime`**, and **`ENABLE_KB_WORKER=false`** (so the hook is only meaningful on a monolith **`all`** process with KB worker enabled, or similar).
- **Do not** expose this route to the public internet without **network policy** (private network, allowlist, or mesh). It is **not** a substitute for **`APP_MODE=worker`** crons in production.

---

## Crons registered by `JobsCronService` (when enabled)

All use the same in-process guard (`cronDisabledReason`):

| Cron | Schedule | Work |
|------|----------|------|
| `runContentExtractionCron` | every 10s | Stuck extract recovery, ingest reconcile, bad upload sweep, claim/run extract jobs |
| `runSummaryCron` | every 10s | Conversation summary jobs |
| `runKnowledgeTrainingCron` | every 10s | Stuck train reset, KB drift reconcile, stuck table import reset, session cleanup, **table import batch**, train job claims, nested logging for table import |
| `runKnowledgeItemPurgeCron` | every 30m | Hard-purge soft-deleted KB items |
| `runBotPurgeCron` | every 30m (offset) | Hard-purge soft-deleted bots |

Env caps include `JOBS_RUNNER_LIMIT`, `SUMMARY_JOBS_RUNNER_LIMIT`, `KNOWLEDGE_TRAINING_JOBS_RUNNER_LIMIT`, `TABLE_IMPORT_JOBS_RUNNER_LIMIT`, etc. (see `.env.example` and `jobs-cron.service.ts`).
