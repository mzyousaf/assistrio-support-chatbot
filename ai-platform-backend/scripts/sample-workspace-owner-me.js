/**
 * Samples workspace membership roles for /me-style QA (no HTTP).
 *
 * Usage:
 *   node scripts/sample-workspace-owner-me.js [limit]
 */
const mongoose = require('mongoose');

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('Set MONGODB_URI before running.');
    process.exit(1);
  }

  const limit = Math.max(1, Number(process.argv[2] ?? 10) || 10);
  const dbName = process.env.MONGODB_DB_NAME || 'assistrio-ai';
  await mongoose.connect(uri, { dbName });

  const db = mongoose.connection.db;
  const workspaces = db.collection('workspaces');
  const memberships = db.collection('workspace_memberships');
  const users = db.collection('users');

  const docs = await workspaces.find({}).limit(limit).toArray();
  const samples = [];

  for (const ws of docs) {
    const rows = await memberships.find({ workspaceId: ws._id }).toArray();
    const byRole = {
      owner: rows.filter((r) => r.role === 'owner'),
      admin: rows.filter((r) => r.role === 'admin'),
      member: rows.filter((r) => r.role === 'member'),
    };

    let ownerUser = null;
    if (byRole.owner[0]) {
      ownerUser = await users.findOne({ _id: byRole.owner[0].userId }, { projection: { email: 1 } });
    }

    samples.push({
      workspaceId: String(ws._id),
      name: ws.name,
      ownerCount: byRole.owner.length,
      adminCount: byRole.admin.length,
      memberCount: byRole.member.length,
      ownerEmail: ownerUser?.email ?? null,
    });
  }

  console.log('[sample-me] database:', dbName);
  console.log(JSON.stringify(samples, null, 2));

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('[sample-me] failed:', err);
  process.exit(1);
});
