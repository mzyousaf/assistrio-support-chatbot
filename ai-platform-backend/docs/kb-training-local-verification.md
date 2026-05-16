# Local KB training verification

Minimal guide for exercising documents, FAQs, snippets, datasheets, and suggestions with the backend worker.

## Environment

| Variable | Purpose |
|----------|--------|
| `MONGODB_URI` | Local (or dev) MongoDB |
| `APP_MODE` | `all` (monolith) or `worker` (background process) |
| `ENABLE_KB_WORKER` | `true` to run in-process extraction + training crons (`false` disables even when `APP_MODE=all`) |
| `KB_TRAINING_LOGS` | `true` or `1` for detailed `[kb-training]` logs (same intent as `DEBUG_KB_TRAINING`) |
| `OPENAI_API_KEY` | Required for **real** embeddings in local dev (integration tests mock embeddings) |

`APP_MODE=api` never runs KB crons in-process (API-only deployment).

## Run backend with worker

Monolith:

```bash
cd ai-platform-backend
set APP_MODE=all
set ENABLE_KB_WORKER=true
set KB_TRAINING_LOGS=1

npm run dev
```

Dedicated worker process (if you use split mode):

```bash
set APP_MODE=worker
set ENABLE_KB_WORKER=true
node dist/main
```

*(Exact bootstrap depends on your `main.ts` worker entry.)*

## Enable verbose KB logs

```bash
set KB_TRAINING_LOGS=true
```

or

```bash
set DEBUG_KB_TRAINING=true
```

## Manual checks (one item each)

Use the customer/admin UI or API you normally use to:

1. **Document** — Upload a small `.txt` or `.pdf`, wait for extract + train (or extract only if auto-train off), then confirm the document KB item shows `ready` and retrieval returns chunks.
2. **FAQ** — Add Q&A, trigger training; confirm `KnowledgeBaseItem` `sourceType: faq` is `ready` and one chunk exists.
3. **Snippet** — Add a titled snippet; confirm `sourceType: note` with `noteMeta.kind: snippet` trains to `ready`.
4. **Datasheet** — Import or edit a table; confirm `sourceType: table` trains and table text appears in chunk content.
5. **Suggestion (scoped)** — Set chip **label + context** (scoped information); confirm a `sourceType: suggestion` row exists and trains to `ready` with a chunk (retrieval can use it).
6. **Suggestion (label-only)** — Chip with **label only** (no context): sync removes trainable suggestion rows — UI chips still work; nothing extra in `knowledge_base_chunks` for that chip.

## Document extraction & sources (manual smoke)

`KbService` handles **local file paths** only (after download). Supported extensions: **PDF**, **DOCX**, **DOC**, **TXT**, **MD** (see `KbService.extractTextFromUpload`).

| Check | Action |
|-------|--------|
| S3 upload | Upload a small PDF/TXT; confirm extract job completes (`done`), text on KB row, train job runs when auto-train on. |
| URL source | If your product supports URL-backed docs, confirm URL is fetched to temp file then same extension logic applies; unsupported MIME/extension fails with a clear KB/training error, not a stuck `queued` extract. |
| Oversized text | Very large extract truncates per `MAX_EXTRACTED_CHARS` with extract result still `extracted: true` and `reason: 'truncated'`. |
| Bad file | Corrupt PDF or wrong extension → extract fails, job `failed`, KB item not `ready`. |

## Datasheet import (manual)

| Check | Expectation |
|-------|-------------|
| `.csv` / `.xlsx` / `.xls` | Accepted (see multipart reader). |
| Other extension | `422` unsupported file type. |
| Header-only | Preview/import return **422** (“No data rows…”). |
| Empty sheet | Parse error / no headers → **422**. |

## Automated integration tests (optional)

Uses **local Mongo** + **mocked** OpenAI/S3/file extraction (no real API keys required for the test itself).

```bash
cd ai-platform-backend
set KB_INTEGRATION=1
set KB_INTEGRATION_MONGODB_URI=mongodb://127.0.0.1:27017/kb_training_verify

npm run test:kb-integration
```

Use a **dedicated database** name so tests do not clash with dev data. Run `--runInBand` is already set on the script to avoid cross-test interference.

## Unit / audit tests (no Mongo)

```bash
npm run test:kb-audit
```

Runs static architecture checks + app-mode gating tests.
