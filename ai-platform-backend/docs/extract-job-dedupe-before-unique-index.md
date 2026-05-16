# Deduplicate live `content_extraction_jobs` before the partial unique index

The app enforces **at most one extract job row per document KB route** `(botId, knowledgeBaseItemId)` via a **partial unique index** (`knowledgeBaseItemId` present), covering **all** statuses (`queued`, `processing`, `done`, `failed`) — see `extract-job.schema.ts`. MongoDB will **refuse to build that index** if duplicate rows for the same pair already exist (any status). Legacy installs may still have duplicates from older code that inserted a second job after `done`; collapse those before syncing indexes.

Previously the partial unique index applied only to **live** jobs (`queued`/`processing`). If you still have the old index **`botId_1_knowledgeBaseItemId_1_live_extract_unique`**, drop it after migrating so only **`botId_1_knowledgeBaseItemId_1_document_extract_unique`** remains.

Use the **idempotent** cleanup script **first**, then deploy code (or create the index explicitly).

## What the script does

- Finds groups with the same `botId` + `knowledgeBaseItemId` where **both** rows are `queued` or `processing`.
- **Keeps one “canonical” job:**
  - Prefers **non-stale** `processing` (newest `processingStartedAt` / `startedAt`).
  - Otherwise prefers the **newest** `queued` (`createdAt`).
  - If every `processing` is **stale** (no start time, or older than `EXTRACT_JOB_DEDUPE_STALE_MS`, default **30 minutes**), keeps the **newest** `processing` by start time.
- **Resolves** all other rows in the group by setting `status: 'done'`, `finishedAt`, and `error: 'skipped:dedupe_live_extract_cleanup'` (aligned with `finishIngestJobSkippedQuiet` — **not** a hard delete).
- Does **not** blindly delete rows; non-keepers are terminal `done` with a clear `error` for auditing.
- **Idempotent:** re-running after cleanup finds no duplicate groups; already-resolved jobs stay `done`.

## Run order (production)

1. **Dry run** (log only):

   ```bash
   cd ai-platform-backend
   DRY_RUN=1 MONGODB_URI="mongodb://USER:PASS@host:27017/yourdb" node scripts/dedupe-live-extract-jobs.js
   ```

2. **Apply cleanup** (writes):

   ```bash
   MONGODB_URI="mongodb://USER:PASS@host:27017/yourdb" node scripts/dedupe-live-extract-jobs.js
   ```

   Confirm logs: `duplicateGroupsRemaining` is **`0`** and `event` is `dedupe_complete`.

3. **Create the partial unique index** (optional explicit step — the app will also sync indexes on startup):

   ```bash
   MONGODB_URI="mongodb://USER:PASS@host:27017/yourdb" node scripts/dedupe-live-extract-jobs.js --create-index
   ```

   Or combine cleanup + index in one run after you trust the dry run:

   ```bash
   MONGODB_URI="..." node scripts/dedupe-live-extract-jobs.js --create-index
   ```

   If duplicates remain, the script exits with code **`2`** and **does not** create the index.

4. **Verify** — successful run logs:

   - `event: "index_created"` or `event: "index_already_exists"`
   - `event: "partial_unique_index_verified"` with `"ok": true`

## npm shortcut

```bash
cd ai-platform-backend
DRY_RUN=1 MONGODB_URI="mongodb://..." npm run migrate:dedupe-extract-jobs
```

Flags after the script name (e.g. `--create-index`) require an extra `--`:

```bash
MONGODB_URI="mongodb://..." npm run migrate:dedupe-extract-jobs -- --create-index
```

PowerShell:

```powershell
cd ai-platform-backend
$env:DRY_RUN = '1'; $env:MONGODB_URI = 'mongodb://...'; npm run migrate:dedupe-extract-jobs
$env:MONGODB_URI = 'mongodb://...'; npm run migrate:dedupe-extract-jobs -- --create-index
```

(`npm run` requires `--` before script-only flags.)

## Environment

| Variable | Purpose |
|---------|---------|
| `MONGODB_URI` | Primary connection string (or `KB_INTEGRATION_MONGODB_URI`) |
| `DRY_RUN=1` | Log actions only |
| `EXTRACT_JOB_DEDUPE_STALE_MS` | Stale threshold for `processing` (default: 30 minutes, minimum enforced: 60 seconds) |

## If index creation still fails

- Ensure `dedupe_complete.duplicateGroupsRemaining` is **0**.
- Check for an **old** non-unique index on the same key pattern with a **different name**; drop conflicting duplicates in MongoDB shell if needed, then re-run `--create-index`.
- Index name in schema: **`botId_1_knowledgeBaseItemId_1_document_extract_unique`** (old installs: **`botId_1_knowledgeBaseItemId_1_live_extract_unique`** — drop after migration).

## Post-deploy

After cleanup and index creation, **deploy** the backend that includes `ExtractJobSchema` with this index. `syncIndexes` / startup index maintenance should then see the index as already present.
