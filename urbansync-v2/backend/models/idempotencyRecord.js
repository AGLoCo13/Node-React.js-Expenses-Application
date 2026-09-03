// Idempotency Record Model
//
// One document per (scope, key). "scope" is the route plus the caller's user id,
// so two different users can legitimately reuse the same key without colliding,
// while the same user cannot create the same expense twice.
//
// The UNIQUE compound index is what makes the pattern safe under concurrency:
// two identical requests racing each other both try to insert the same
// (scope, key); MongoDB lets exactly one insert succeed, the other gets a
// duplicate-key error (E11000) and is served the stored response instead.
// This also works across several backend replicas (the backend stays stateless).
const mongoose = require('mongoose');

const IDEMPOTENCY_TTL_SECONDS = parseInt(process.env.IDEMPOTENCY_TTL_SECONDS, 10) || 24 * 60 * 60;

const idempotencyRecordSchema = new mongoose.Schema({
  scope:       { type: String, required: true },           // e.g. "POST /api/expenses user:64ab..."
  key:         { type: String, required: true },           // the Idempotency-Key header
  requestHash: { type: String, required: true },           // sha256 of the request payload
  status:      { type: String, enum: ['in_progress', 'completed'], default: 'in_progress' },
  statusCode:  { type: Number },                           // stored response
  responseBody:{ type: mongoose.Schema.Types.Mixed },
  createdAt:   { type: Date, default: Date.now, expires: IDEMPOTENCY_TTL_SECONDS } // TTL index
});

idempotencyRecordSchema.index({ scope: 1, key: 1 }, { unique: true });

const IdempotencyRecord = mongoose.model('IdempotencyRecord', idempotencyRecordSchema);
module.exports = IdempotencyRecord;
module.exports.IDEMPOTENCY_TTL_SECONDS = IDEMPOTENCY_TTL_SECONDS;
