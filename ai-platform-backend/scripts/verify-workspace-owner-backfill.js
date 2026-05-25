/**
 * Post-backfill verification for workspace owner roles.
 *
 * Usage (PowerShell):
 *   $env:MONGODB_URI="mongodb://..."; node scripts/verify-workspace-owner-backfill.js
 */
const mongoose = require('mongoose');

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('Set MONGODB_URI (or MONGO_URI) before running.');
    process.exit(1);
  }

  await mongoose.connect(uri, { dbName: process.env.MONGODB_DB_NAME || 'assistrio-ai' });
  const db = mongoose.connection.db;
  const workspaces = db.collection('workspaces');
  const memberships = db.collection('workspace_memberships');

  const workspaceCount = await workspaces.countDocuments();
  const membershipCount = await memberships.countDocuments();
  const ownerCount = await memberships.countDocuments({ role: 'owner' });
  const adminCount = await memberships.countDocuments({ role: 'admin' });
  const memberCount = await memberships.countDocuments({ role: 'member' });

  console.log('[verify-owner] database:', db.databaseName);
  console.log('[verify-owner] counts:', {
    workspaces: workspaceCount,
    memberships: membershipCount,
    owners: ownerCount,
    admins: adminCount,
    members: memberCount,
  });

  const issues = [];
  const workspaceCursor = workspaces.find({}, { projection: { _id: 1, name: 1 } });

  for await (const workspace of workspaceCursor) {
    const rows = await memberships.find({ workspaceId: workspace._id }).toArray();
    if (!rows.length) {
      issues.push({ type: 'zero_memberships', workspaceId: String(workspace._id), name: workspace.name });
      continue;
    }

    const owners = rows.filter((row) => row.role === 'owner');
    if (owners.length === 0) {
      issues.push({ type: 'missing_owner', workspaceId: String(workspace._id), name: workspace.name });
    } else if (owners.length > 1) {
      issues.push({
        type: 'multiple_owners',
        workspaceId: String(workspace._id),
        name: workspace.name,
        ownerUserIds: owners.map((row) => String(row.userId)),
      });
    }
  }

  if (issues.length) {
    console.error('[verify-owner] FAILED issues:', JSON.stringify(issues, null, 2));
    process.exitCode = 1;
  } else {
    console.log('[verify-owner] PASSED: each workspace has exactly one owner (or no workspaces).');
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('[verify-owner] failed:', err);
  process.exit(1);
});
