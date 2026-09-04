// Idempotency middleware  (Idempotency pattern)
//
// Problem it solves: a client that times out, retries, or double-clicks "Submit"
// sends the SAME non-idempotent request (POST) twice. Without protection the
// server creates two expenses and, in our case, uploads the receipt to MinIO
// twice. With this middleware the client attaches a unique `Idempotency-Key`
// header per *intent* (one per filled-in form); the first request is executed
// and its response stored, every repeat with the same key gets the stored
// response back (HTTP status and body identical) plus `Idempotency-Replayed: true`.
//
// Lifecycle of a key (see models/idempotencyRecord.js for the unique index):
//   1. INSERT (scope,key) as `in_progress`   -> we own the key, run the handler
//        - handler answers 2xx/4xx -> store status+body, mark `completed`
//        - handler answers 5xx     -> DELETE the record, so the client MAY retry
//   2. INSERT fails with E11000 (duplicate)  -> someone got there first
//        - record `in_progress`  -> 409 "still processing, retry shortly"
//        - record `completed` and same payload hash -> replay stored response
//        - record `completed` but DIFFERENT payload -> 422 (key reused for another request)
//   3. Records expire after IDEMPOTENCY_TTL_SECONDS (default 24h) via a TTL index.
//
// Usage:  app.post('/api/expenses', authenticateUser, upload.single('document'),
//                  idempotent(), controller.createExpense);
// Place it AFTER auth (so the key is scoped per user) and AFTER multer (so the
// payload hash covers the parsed fields and the uploaded file).
const crypto = require('crypto');
const IdempotencyRecord = require('../models/idempotencyRecord');

const HEADER = 'idempotency-key';
const MAX_KEY_LENGTH = 128;

function hashRequest(req) {
  const h = crypto.createHash('sha256');
  // Sort keys so field order does not change the hash.
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const sortedBody = Object.keys(body).sort().reduce((acc, k) => { acc[k] = body[k]; return acc; }, {});
  h.update(JSON.stringify(sortedBody));
  if (req.file) {
    // Cheap identity for the uploaded file: name + size + content hash.
    h.update(`|file:${req.file.originalname}|${req.file.size}|`);
    if (req.file.buffer) h.update(crypto.createHash('sha256').update(req.file.buffer).digest('hex'));
  }
  return h.digest('hex');
}

function scopeFor(req) {
  const who = req.user && (req.user.userId || req.user.id) ? String(req.user.userId || req.user.id) : 'anonymous';
  return `${req.method} ${req.baseUrl || ''}${req.path} user:${who}`;
}

/**
 * @param {object} [opts]
 * @param {boolean} [opts.required=false]  When true, a missing header is a 400.
 *                                         Default false keeps old clients (k6 scripts, curl) working.
 */
function idempotent(opts = {}) {
  const required = opts.required === true;

  return async function idempotencyMiddleware(req, res, next) {
    const key = req.get(HEADER);

    if (!key) {
      if (required) return res.status(400).json({ error: `Missing ${HEADER} header` });
      return next(); // opt-in: no key, no protection (logged so we can spot old clients)
    }
    if (key.length > MAX_KEY_LENGTH) {
      return res.status(400).json({ error: `${HEADER} must be at most ${MAX_KEY_LENGTH} characters` });
    }

    const scope = scopeFor(req);
    const requestHash = hashRequest(req);
    let record;

    try {
      // Step 1: try to claim the key. The unique index makes this atomic.
      record = await IdempotencyRecord.create({ scope, key, requestHash, status: 'in_progress' });
    } catch (err) {
      if (err && err.code === 11000) {
        // Step 2: somebody already claimed it.
        const existing = await IdempotencyRecord.findOne({ scope, key }).lean();
        if (!existing) return next(); // raced with TTL/cleanup: just run it
        if (existing.status === 'in_progress') {
          res.set('Retry-After', '2');
          return res.status(409).json({
            error: 'A request with this Idempotency-Key is still being processed',
            retryAfterSeconds: 2
          });
        }
        if (existing.requestHash !== requestHash) {
          return res.status(422).json({
            error: 'Idempotency-Key was already used for a different request payload'
          });
        }
        console.log(`[idempotency] replay  key=${key.slice(0, 8)}… -> ${existing.statusCode}`);
        res.set('Idempotency-Replayed', 'true');
        res.set('Idempotency-Key', key);
        return res.status(existing.statusCode).json(existing.responseBody);
      }
      // Any other DB error: do not block the business request, degrade to "no idempotency".
      console.error('[idempotency] store unavailable, continuing without protection:', err.message);
      return next();
    }

    // We own the key. Capture whatever the handler sends.
    res.set('Idempotency-Key', key);
    const originalJson = res.json.bind(res);
    let captured = null;

    res.json = function patchedJson(body) {
      captured = { statusCode: res.statusCode, body };
      return originalJson(body);
    };

    res.on('finish', async () => {
      try {
        const code = res.statusCode;
        if (code >= 500 || !captured) {
          // Failed or non-JSON answer: release the key so the client can retry.
          await IdempotencyRecord.deleteOne({ _id: record._id });
          console.log(`[idempotency] release key=${key.slice(0, 8)}… after ${code}`);
        } else {
          await IdempotencyRecord.updateOne(
            { _id: record._id },
            { $set: { status: 'completed', statusCode: code, responseBody: captured.body } }
          );
          console.log(`[idempotency] stored  key=${key.slice(0, 8)}… -> ${code}`);
        }
      } catch (e) {
        console.error('[idempotency] failed to persist outcome:', e.message);
      }
    });

    next();
  };
}

module.exports = { idempotent, hashRequest, HEADER };
