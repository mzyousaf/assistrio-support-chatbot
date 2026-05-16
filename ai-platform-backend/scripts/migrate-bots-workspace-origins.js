/**
 * One-time migration: legacy bot documents → workspace model + allowedOrigins.
 *
 * - Copies ownerUserId → ownerId when ownerId is missing
 * - Maps allowedDomains[] strings → allowedOrigins[{ origin, isActive: true }] when allowedOrigins is empty
 * - Unsets: allowedDomains, creatorType, ownerVisitorId, ownerUserId (after copy), platformVisitorWebsiteAllowlist
 *
 * Mapping rules (best-effort; logs warning when nothing usable is produced):
 * - exact:https://host… → origin
 * - hosts:a,b,c → https://a, https://b, …
 * - plain hostname → https://hostname
 *
 * Usage (PowerShell):
 *   $env:MONGODB_URI="mongodb://..."; node scripts/migrate-bots-workspace-origins.js
 */
const mongoose = require('mongoose');

function domainsToOrigins(arr) {
  const out = [];
  for (const raw of arr) {
    const s = String(raw ?? '').trim();
    if (!s) continue;
    const lower = s.toLowerCase();
    if (lower.startsWith('exact:')) {
      const rest = s.slice(6).trim();
      try {
        const u = new URL(/:\/\//.test(rest) ? rest : `https://${rest}`);
        out.push(u.origin);
      } catch {
        console.warn('[migrate-bots] exact: parse failed:', rest);
      }
      continue;
    }
    if (lower.startsWith('hosts:')) {
      for (const part of s.slice(6).split(',')) {
        const h = part.trim();
        if (!h) continue;
        try {
          out.push(new URL(`https://${h}`).origin);
        } catch {
          console.warn('[migrate-bots] hosts: entry parse failed:', h);
        }
      }
      continue;
    }
    try {
      const host = s.replace(/^https?:\/\//i, '');
      out.push(new URL(`https://${host}`).origin);
    } catch {
      console.warn('[migrate-bots] could not infer origin from:', s);
    }
  }
  return [...new Set(out)];
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is required');
    process.exit(1);
  }

  await mongoose.connect(uri);
  const bots = mongoose.connection.db.collection('bots');

  const cursor = bots.find({
    $or: [
      { allowedDomains: { $exists: true, $not: { $size: 0 } } },
      { ownerUserId: { $exists: true } },
      { creatorType: { $exists: true } },
      { ownerVisitorId: { $exists: true } },
      { platformVisitorWebsiteAllowlist: { $exists: true } },
      { type: { $exists: true } },
    ],
  });

  let n = 0;
  for await (const doc of cursor) {
    const $set = {};
    const $unset = {};

    if (doc.ownerUserId != null && doc.ownerId == null) {
      $set.ownerId = doc.ownerUserId;
      $unset.ownerUserId = '';
    }

    const hasOrigins = Array.isArray(doc.allowedOrigins) && doc.allowedOrigins.length > 0;
    const legacyDomains = Array.isArray(doc.allowedDomains) ? doc.allowedDomains : [];
    if (!hasOrigins && legacyDomains.length > 0) {
      const origins = domainsToOrigins(legacyDomains);
      if (origins.length) {
        $set.allowedOrigins = origins.map((origin) => ({ origin, isActive: true }));
      } else {
        console.warn(
          '[migrate-bots] bot',
          String(doc._id),
          'allowedDomains could not be mapped to origins:',
          legacyDomains,
        );
      }
    }

    if (Object.prototype.hasOwnProperty.call(doc, 'allowedDomains')) $unset.allowedDomains = '';
    if (doc.creatorType != null) $unset.creatorType = '';
    if (doc.ownerVisitorId != null) $unset.ownerVisitorId = '';
    if (doc.platformVisitorWebsiteAllowlist != null) $unset.platformVisitorWebsiteAllowlist = '';
    if (Object.prototype.hasOwnProperty.call(doc, 'type')) $unset.type = '';

    const update = {};
    if (Object.keys($set).length) update.$set = $set;
    if (Object.keys($unset).length) update.$unset = $unset;

    if (Object.keys(update).length === 0) continue;

    await bots.updateOne({ _id: doc._id }, update);
    n += 1;

    if ($set.ownerId == null && doc.ownerId == null && doc.ownerUserId == null) {
      console.warn('[migrate-bots] bot', String(doc._id), 'still has no ownerId — runtime embed will fail until set.');
    }
  }

  await mongoose.disconnect();
  console.log('migrate-bots-workspace-origins: updated', n, 'documents');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
