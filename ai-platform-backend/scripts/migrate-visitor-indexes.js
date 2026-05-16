/**
 * One-time migration for `visitors` collection:
 * 1) Set `visitorType: 'platform'` on legacy docs missing it.
 * 2) Drop the old unique index on `visitorId` only (visitorId_1).
 *
 * After this, restart the API so Mongoose can create the compound unique
 * index `{ visitorId: 1, visitorType: 1 }` from visitor.schema.ts.
 *
 * Usage (PowerShell):
 *   $env:MONGODB_URI="mongodb://..."; node scripts/migrate-visitor-indexes.js
 */
const mongoose = require('mongoose');

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is required');
    process.exit(1);
  }

  await mongoose.connect(uri);
  const col = mongoose.connection.db.collection('visitors');

  const backfill = await col.updateMany(
    { visitorType: { $exists: false } },
    { $set: { visitorType: 'platform' } },
  );
  console.log('Backfill visitorType:', backfill.modifiedCount, 'documents updated');

  const indexes = await col.indexes();
  const hasOld = indexes.some((i) => i.name === 'visitorId_1');
  if (hasOld) {
    await col.dropIndex('visitorId_1');
    console.log('Dropped index visitorId_1');
  } else {
    console.log('Index visitorId_1 not present (already migrated or empty DB)');
  }

  await mongoose.disconnect();
  console.log('Done. Restart the Nest app to sync the new compound index.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
