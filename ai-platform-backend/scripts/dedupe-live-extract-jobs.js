#!/usr/bin/env node
/**
 * One-time, idempotent cleanup: duplicate *live* rows in `content_extraction_jobs`
 * (same botId + knowledgeBaseItemId, status queued or processing).
 *
 * Safe to re-run: groups with only one live row are untouched; resolved rows are `done`
 * with `error` prefixed with `skipped:` (same convention as `finishIngestJobSkippedQuiet`).
 *
 * Run this BEFORE creating the partial unique index on live extract jobs (see docs).
 *
 * Usage:
 *   MONGODB_URI="mongodb://..." node scripts/dedupe-live-extract-jobs.js
 *   DRY_RUN=1 MONGODB_URI="..." node scripts/dedupe-live-extract-jobs.js
 *   MONGODB_URI="..." node scripts/dedupe-live-extract-jobs.js --create-index
 *
 * Env:
 *   MONGODB_URI (or KB_INTEGRATION_MONGODB_URI) — required
 *   DRY_RUN=1|true — log actions only
 *   EXTRACT_JOB_DEDUPE_STALE_MS — processing rows with no start time or older than this are "stale" (default: 30m)
 */

const mongoose = require('mongoose');

const COLLECTION = 'content_extraction_jobs';
const SKIP_REASON = 'skipped:dedupe_live_extract_cleanup';
const INDEX_NAME = 'botId_1_knowledgeBaseItemId_1_live_extract_unique';

function parseArgs(argv) {
  const dryRun = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true' || argv.includes('--dry-run');
  const createIndex = argv.includes('--create-index');
  return { dryRun, createIndex };
}

function timeMs(d) {
  if (!d) return 0;
  const t = new Date(d).getTime();
  return Number.isFinite(t) ? t : 0;
}

function isStaleProcessing(doc, staleMs) {
  if (doc.status !== 'processing') return false;
  const t = doc.processingStartedAt || doc.startedAt;
  if (!t) return true;
  return Date.now() - new Date(t).getTime() > staleMs;
}

function pickKeeper(docs, staleMs) {
  const processing = docs.filter((d) => d.status === 'processing');
  const queued = docs.filter((d) => d.status === 'queued');
  const nonStaleProc = processing.filter((d) => !isStaleProcessing(d, staleMs));

  if (nonStaleProc.length > 0) {
    return [...nonStaleProc].sort((a, b) => timeMs(b.processingStartedAt || b.startedAt) - timeMs(a.processingStartedAt || a.startedAt))[0];
  }
  if (queued.length > 0) {
    return [...queued].sort((a, b) => timeMs(b.createdAt) - timeMs(a.createdAt))[0];
  }
  return [...processing].sort((a, b) => timeMs(b.processingStartedAt || b.startedAt) - timeMs(a.processingStartedAt || a.startedAt))[0];
}

async function findDuplicateGroups(coll) {
  return coll
    .aggregate([
      {
        $match: {
          status: { $in: ['queued', 'processing'] },
          knowledgeBaseItemId: { $exists: true, $ne: null },
        },
      },
      {
        $group: {
          _id: { botId: '$botId', knowledgeBaseItemId: '$knowledgeBaseItemId' },
          docs: { $push: '$$ROOT' },
          count: { $sum: 1 },
        },
      },
      { $match: { count: { $gt: 1 } } },
    ])
    .toArray();
}

async function listIndexes(coll) {
  return coll.indexes();
}

async function createPartialUniqueIndex(coll, dryRun) {
  const spec = {
    unique: true,
    name: INDEX_NAME,
    partialFilterExpression: {
      status: { $in: ['queued', 'processing'] },
      knowledgeBaseItemId: { $exists: true, $type: 'objectId' },
    },
  };
  if (dryRun) {
    console.log(JSON.stringify({ event: 'index_dry_run', index: { keys: { botId: 1, knowledgeBaseItemId: 1 }, ...spec } }));
    return { created: false, dryRun: true };
  }
  try {
    await coll.createIndex({ botId: 1, knowledgeBaseItemId: 1 }, spec);
    console.log(JSON.stringify({ event: 'index_created', name: INDEX_NAME }));
    return { created: true };
  } catch (e) {
    const code = e && e.code;
    const msg = e instanceof Error ? e.message : String(e);
    if (code === 85 || code === 86 || /already exists|already have/i.test(msg)) {
      console.log(JSON.stringify({ event: 'index_already_exists', name: INDEX_NAME }));
      return { created: false, alreadyExists: true };
    }
    console.error(JSON.stringify({ event: 'index_create_failed', code, message: msg }));
    throw e;
  }
}

async function main() {
  const { dryRun, createIndex } = parseArgs(process.argv.slice(2));
  const uri = process.env.MONGODB_URI || process.env.KB_INTEGRATION_MONGODB_URI;
  if (!uri) {
    console.error('Missing MONGODB_URI (or KB_INTEGRATION_MONGODB_URI).');
    process.exit(1);
  }

  const staleMs = Math.max(60_000, Number(process.env.EXTRACT_JOB_DEDUPE_STALE_MS) || 30 * 60 * 1000);

  await mongoose.connect(uri);
  const coll = mongoose.connection.db.collection(COLLECTION);

  console.log(
    JSON.stringify({
      event: 'dedupe_start',
      collection: COLLECTION,
      dryRun,
      staleProcessingMs: staleMs,
    }),
  );

  const groups = await findDuplicateGroups(coll);
  let groupsCleaned = 0;
  let jobsResolved = 0;
  let jobsWouldResolve = 0;

  const now = new Date();

  for (const g of groups) {
    const { botId, knowledgeBaseItemId } = g._id;
    const docs = g.docs;
    const keeper = pickKeeper(docs, staleMs);
    const keeperId = String(keeper._id);
    const toResolve = docs.filter((d) => String(d._id) !== keeperId);

    console.log(
      JSON.stringify({
        event: 'duplicate_group',
        botId: String(botId),
        knowledgeBaseItemId: String(knowledgeBaseItemId),
        count: docs.length,
        keeperId,
        keeperStatus: keeper.status,
        resolveIds: toResolve.map((d) => ({ id: String(d._id), status: d.status })),
      }),
    );

    groupsCleaned += 1;

    for (const doc of toResolve) {
      const id = doc._id;
      jobsResolved += 1;
      if (dryRun) {
        jobsWouldResolve += 1;
        console.log(
          JSON.stringify({
            event: 'would_mark_done',
            id: String(id),
            fromStatus: doc.status,
            reason: SKIP_REASON,
          }),
        );
        continue;
      }
      const res = await coll.updateOne(
        { _id: id, status: { $in: ['queued', 'processing'] } },
        {
          $set: {
            status: 'done',
            finishedAt: now,
            error: SKIP_REASON,
            extractAutoRetryCycles: 0,
          },
        },
      );
      console.log(
        JSON.stringify({
          event: 'marked_done',
          id: String(id),
          fromStatus: doc.status,
          matched: res.matchedCount,
          modified: res.modifiedCount,
          reason: SKIP_REASON,
        }),
      );
    }
  }

  const remaining = await findDuplicateGroups(coll);

  console.log(
    JSON.stringify({
      event: 'dedupe_complete',
      duplicateGroupsFound: groups.length,
      groupsProcessed: groupsCleaned,
      jobsMarkedDone: dryRun ? jobsWouldResolve : jobsResolved,
      duplicateGroupsRemaining: remaining.length,
      dryRun,
    }),
  );

  if (remaining.length > 0) {
    console.error(
      JSON.stringify({
        event: 'dedupe_incomplete',
        message: 'Still have duplicate live groups; not creating index.',
        remaining: remaining.map((r) => ({
          botId: String(r._id.botId),
          knowledgeBaseItemId: String(r._id.knowledgeBaseItemId),
          count: r.count,
        })),
      }),
    );
    if (createIndex && !dryRun) {
      await mongoose.disconnect();
      process.exit(2);
    }
  }

  if (createIndex) {
    if (remaining.length > 0 && dryRun) {
      console.log(JSON.stringify({ event: 'skip_index_dry_run_duplicates_remain', remaining: remaining.length }));
    } else if (remaining.length === 0 || dryRun) {
      const indexesBefore = await listIndexes(coll);
      const hasIndex = indexesBefore.some((ix) => ix.name === INDEX_NAME);
      console.log(
        JSON.stringify({
          event: 'indexes_before_create',
          hasPartialUnique: hasIndex,
        }),
      );
      await createPartialUniqueIndex(coll, dryRun);
      if (!dryRun) {
        const indexesAfter = await listIndexes(coll);
        const ok = indexesAfter.some((ix) => ix.name === INDEX_NAME && ix.unique === true);
        console.log(JSON.stringify({ event: 'partial_unique_index_verified', ok, name: INDEX_NAME }));
        if (!ok) {
          console.error(JSON.stringify({ event: 'partial_unique_index_missing_after_create' }));
          await mongoose.disconnect();
          process.exit(3);
        }
      }
    }
  }

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
