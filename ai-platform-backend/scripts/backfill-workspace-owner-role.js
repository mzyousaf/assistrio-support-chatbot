/**
 * Idempotent backfill: promote one owner per workspace.
 *
 * Algorithm (per workspace):
 * - Skip if an owner membership already exists
 * - Else pick earliest admin by membership `_id` timestamp
 * - Else pick earliest membership by `_id` timestamp
 * - Set chosen membership role = owner
 *
 * Run after deploying owner role schema. Safe to re-run.
 *
 * Usage (PowerShell):
 *   $env:MONGODB_URI="mongodb://..."; node scripts/backfill-workspace-owner-role.js
 *
 * Optional dry run:
 *   $env:DRY_RUN="1"; node scripts/backfill-workspace-owner-role.js
 *
 * Database name defaults to assistrio-ai (same as NestJS MongooseModule).
 * Override: MONGODB_DB_NAME=other_db
 */
const mongoose = require('mongoose');

const OWNER_ROLE = 'owner';
const ADMIN_ROLE = 'admin';

function membershipCreatedAt(membership) {
  const id = membership._id;
  if (id && typeof id.getTimestamp === 'function') {
    return id.getTimestamp();
  }
  return new Date(0);
}

function pickEarliestMembership(memberships) {
  if (!memberships.length) return null;
  return [...memberships].sort((a, b) => membershipCreatedAt(a) - membershipCreatedAt(b))[0];
}

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('Set MONGODB_URI (or MONGO_URI) before running.');
    process.exit(1);
  }

  const dryRun = String(process.env.DRY_RUN ?? '').trim() === '1';
  const dbName = process.env.MONGODB_DB_NAME || 'assistrio-ai';
  await mongoose.connect(uri, { dbName });

  const db = mongoose.connection.db;
  const workspaces = db.collection('workspaces');
  const memberships = db.collection('workspace_memberships');

  let processed = 0;
  let promoted = 0;
  let skippedHasOwner = 0;
  let skippedNoMemberships = 0;

  const workspaceCursor = workspaces.find({}, { projection: { _id: 1 } });
  for await (const workspace of workspaceCursor) {
    processed += 1;
    const workspaceId = workspace._id;

    const rows = await memberships.find({ workspaceId }).toArray();
    if (!rows.length) {
      skippedNoMemberships += 1;
      console.warn('[backfill-owner] workspace has zero memberships:', String(workspaceId));
      continue;
    }

    const existingOwner = rows.find((row) => row.role === OWNER_ROLE);
    if (existingOwner) {
      skippedHasOwner += 1;
      continue;
    }

    const admins = rows.filter((row) => row.role === ADMIN_ROLE);
    const chosen = pickEarliestMembership(admins.length ? admins : rows);
    if (!chosen) {
      skippedNoMemberships += 1;
      continue;
    }

    const previousRole = chosen.role ?? 'member';
    console.log(
      `[backfill-owner] workspace=${String(workspaceId)} user=${String(chosen.userId)} previousRole=${previousRole} -> owner`,
    );

    if (!dryRun) {
      await memberships.updateOne({ _id: chosen._id }, { $set: { role: OWNER_ROLE } });
    }
    promoted += 1;
  }

  console.log(
    `[backfill-owner] done processed=${processed} promoted=${promoted} skippedHasOwner=${skippedHasOwner} skippedNoMemberships=${skippedNoMemberships} dryRun=${dryRun}`,
  );

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('[backfill-owner] failed:', err);
  process.exit(1);
});
