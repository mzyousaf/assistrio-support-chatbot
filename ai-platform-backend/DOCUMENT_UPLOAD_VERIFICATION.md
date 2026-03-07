# Document Upload & Ingestion – Verification Guide

## Summary of changes

- **upload-doc** now returns a verification payload and guarantees that every successful upload creates both a `Document` (status `queued`) and an `IngestJob` (status `queued`). If job creation fails, the document is marked `failed` and the error is returned.
- **Runner** response includes `processedCount`, `claimedJobId`, and `finalDocStatus` for single-step testing (`?limit=1` or `body: { limit: 1 }`).
- **FE** shows `documentStatus` and `ingestJobStatus` from the upload response and refreshes the docs list after upload.

## Root cause (why jobs might not have been queued)

The code path already called `ingestionService.createQueuedJob(botId, docId)` after creating the document. Possible causes for “doc exists but no job”:

1. **Unhandled exception** – If `createQueuedJob` threw (e.g. DB/network), the controller could return 500 and the client might still refresh the doc list, so the document would exist without a job. **Fix:** wrap job creation in try/catch, on failure call `documentsService.setFailed(botId, docId, 'job_queue_failed')` and rethrow so the client gets a clear error and no orphan “queued” document is left.
2. **Environment** – Ensure the backend that serves the app has `IngestionModule` and the correct DB connection so `IngestJob` is written.

## Final upload-doc response shape

```json
{
  "ok": true,
  "documentId": "<doc ObjectId>",
  "documentStatus": "queued",
  "ingestJobId": "<job ObjectId>",
  "ingestJobStatus": "queued",
  "s3Key": "bots/docs/<botId>/YYYY/MM/<uuid>-<filename>",
  "originalName": "example.pdf"
}
```

## Files changed

### Backend (ai-platform-backend)

- `src/super-admin/super-admin-documents.controller.ts` – upload-doc: try/catch around `createQueuedJob`, cleanup via `setFailed` on failure; response shape: `ok`, `documentId`, `documentStatus`, `ingestJobId`, `ingestJobStatus`, `s3Key`, `originalName`; embed endpoint returns same shape.
- `src/documents/documents.service.ts` – added `setFailed(botId, docId, errorMessage)`.
- `src/ingestion/ingestion.service.ts` – `runQueuedIngestionJobs` return value now includes `processedCount`, `claimedJobId`, `finalDocStatus`.
- `src/ingestion/ingestion-runner.types.ts` – `IngestionRunResult` extended with `processedCount`, `claimedJobId`, `finalDocStatus`.

### Frontend (ai-platform-app)

- `src/components/admin/BotDocumentsManager.tsx` – upload response type and message use `documentStatus` / `ingestJobStatus`; job run message uses `processedCount`, `claimedJobId`, `finalDocStatus`; refresh after upload unchanged.

## How to test with curl

Assume backend at `http://localhost:3001` and cookie auth (`sa_token`). Replace `BOT_ID` and paths as needed.

### 1) Login (get cookie)

```bash
curl -s -c cookies.txt -X POST "http://localhost:3001/api/super-admin/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"YOUR_EMAIL","password":"YOUR_PASSWORD"}'
```

### 2) Upload a document

```bash
curl -s -b cookies.txt -X POST "http://localhost:3001/api/super-admin/bots/BOT_ID/upload-doc" \
  -F "file=@/path/to/test.pdf" \
  -F "title=Test PDF"
```

Expect JSON with `documentStatus: "queued"`, `ingestJobStatus: "queued"`, `documentId`, `ingestJobId`, `s3Key`, `originalName`.

### 3) Run runner (single job, for verification)

**Option A – super-admin (cookie auth):**

```bash
curl -s -b cookies.txt -X POST "http://localhost:3001/api/super-admin/jobs/run?limit=1" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Option B – auto-run (secret):**

```bash
curl -s -X POST "http://localhost:3001/api/jobs/auto-run?limit=1&secret=YOUR_JOB_RUNNER_SECRET" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Expect `processedCount: 1`, `claimedJobId`, `finalDocStatus: "ready"` (or `"failed"` if ingestion failed).

### 4) List documents

```bash
curl -s -b cookies.txt "http://localhost:3001/api/super-admin/bots/BOT_ID/documents"
```

The uploaded doc should show `status: "ready"` (or `"failed"`) after the runner has processed it.

### 5) Chunks count (API)

```bash
curl -s -b cookies.txt "http://localhost:3001/api/super-admin/documents/DOCUMENT_ID/chunks-count"
```

Returns `{ "count": <number> }`. Replace `DOCUMENT_ID` with the document `_id` from the upload or list response.

## Proof checklist

1. **Upload doc → response shows queued doc + queued job**  
   POST upload-doc; response includes `documentStatus: "queued"`, `ingestJobStatus: "queued"`, `documentId`, `ingestJobId`.

2. **Call runner → response shows processedCount = 1**  
   POST jobs/run (or auto-run) with `limit=1`; response has `processedCount: 1`, `claimedJobId`, `finalDocStatus`.

3. **GET docs list → doc becomes ready**  
   GET bots/:id/documents; the uploaded document has `status: "ready"` (or `"failed"` with `error`).

4. **Chunks for that doc > 0**  
   GET `api/super-admin/documents/:docId/chunks-count` (with cookie) returns `{ count: N }` with N > 0 for the ingested document.
