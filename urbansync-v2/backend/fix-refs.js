/**
 * fix-refs.js
 * -----------
 * Heals ObjectId reference fields that were imported by mongoimport as plain
 * nested objects  { $oid: "..." }  or plain strings instead of real BSON
 * ObjectIds.  Run this inside the backend container after a fresh seed:
 *
 *   docker cp fix-refs.js urbansync-v2-backend:/app/fix-refs.js
 *   docker exec urbansync-v2-backend node /app/fix-refs.js
 */

'use strict';

const mongoose = require('mongoose');

const MONGODB_URI =
  process.env.MONGODB_URI ||
  'mongodb://admin:admin123@mongodb:27017/commons?authSource=admin';

// ─── helpers ────────────────────────────────────────────────────────────────

const { ObjectId } = mongoose.Types;

/**
 * Returns true when `v` is already a real BSON ObjectId instance.
 */
const isObjectId = (v) =>
  v != null && (v instanceof ObjectId || v?._bsontype === 'ObjectID' || v?._bsontype === 'ObjectId');

/**
 * Converts a value to ObjectId if possible.
 * Handles:
 *   - already ObjectId              → returned as-is
 *   - plain 24-char hex string      → new ObjectId(string)
 *   - { $oid: "24-char-hex" }       → new ObjectId($oid)  (mongoimport artefact)
 * Returns null if the value cannot be converted.
 */
const toObjectId = (v) => {
  if (!v) return null;
  if (isObjectId(v)) return v;

  // Extended JSON object: { "$oid": "..." } or { $oid: "..." }
  const raw = v['$oid'] ?? v.$oid;
  if (raw && ObjectId.isValid(raw)) return new ObjectId(raw);

  // Plain string
  if (typeof v === 'string' && ObjectId.isValid(v)) return new ObjectId(v);

  return null;
};

/**
 * Converts a value to a JS Date if possible.
 * Handles:
 *   - already a Date                → returned as-is
 *   - { $date: "ISO string" }       → new Date(...)
 *   - ISO string                    → new Date(...)
 */
const toDate = (v) => {
  if (!v) return null;
  if (v instanceof Date) return v;
  const raw = v['$date'] ?? v.$date;
  if (raw) return new Date(raw);
  if (typeof v === 'string') return new Date(v);
  return null;
};

// ─── collection definitions ─────────────────────────────────────────────────

const COLLECTIONS = [
  {
    name: 'apartments',
    oidFields: ['building', 'tenant'],
    dateFields: [],
  },
  {
    name: 'buildings',
    oidFields: ['profile'],
    dateFields: [],
  },
  {
    name: 'profiles',
    oidFields: ['user'],
    dateFields: [],
  },
  {
    name: 'consumptions',
    oidFields: ['apartment'],
    dateFields: [],
  },
  {
    name: 'payments',
    oidFields: ['apartment'],
    dateFields: [],
  },
  {
    name: 'expenses',
    oidFields: ['profile'],
    dateFields: ['date_created'],
  },
];

// ─── core fix logic ─────────────────────────────────────────────────────────

async function fixCollection(db, { name, oidFields, dateFields }) {
  const col = db.collection(name);
  const docs = await col.find({}).toArray();

  let fixed = 0;

  for (const doc of docs) {
    const $set = {};

    for (const field of oidFields) {
      const val = doc[field];
      if (isObjectId(val)) continue;          // already correct → skip
      const converted = toObjectId(val);
      if (converted) {
        $set[field] = converted;
      } else if (val != null) {
        console.warn(
          `  ⚠️  [${name}] doc ${doc._id}: cannot convert field "${field}" value:`,
          JSON.stringify(val),
        );
      }
    }

    for (const field of dateFields) {
      const val = doc[field];
      if (val instanceof Date) continue;      // already correct → skip
      const converted = toDate(val);
      if (converted && !isNaN(converted.getTime())) {
        $set[field] = converted;
      } else if (val != null) {
        console.warn(
          `  ⚠️  [${name}] doc ${doc._id}: cannot convert date field "${field}" value:`,
          JSON.stringify(val),
        );
      }
    }

    if (Object.keys($set).length > 0) {
      await col.updateOne({ _id: doc._id }, { $set });
      fixed++;
    }
  }

  const status = fixed > 0 ? '🔧' : '✅';
  console.log(
    `  ${status}  ${name.padEnd(14)} — checked ${String(docs.length).padStart(3)} docs,  fixed ${fixed}`,
  );
  return fixed;
}

// ─── entry point ────────────────────────────────────────────────────────────

async function main() {
  console.log('\n════════════════════════════════════════════');
  console.log('  UrbanSync — Reference Healer (fix-refs.js)');
  console.log('════════════════════════════════════════════\n');

  console.log(`🔌 Connecting to: ${MONGODB_URI}\n`);
  await mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  console.log('✅ Connected to MongoDB.\n');

  const db = mongoose.connection.db;

  let totalFixed = 0;
  for (const colDef of COLLECTIONS) {
    totalFixed += await fixCollection(db, colDef);
  }

  console.log('\n════════════════════════════════════════════');
  console.log(`  Total documents repaired : ${totalFixed}`);
  console.log('════════════════════════════════════════════\n');

  await mongoose.disconnect();
  console.log('🔌 Disconnected. Done!\n');
}

main().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
