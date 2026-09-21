/**
 * ============================================================
 * UrbanSync — receipt-annotator
 * Knative Serving Function (Serverless Computation)
 * ============================================================
 * Exposes a single HTTP endpoint that:
 *
 *  Path A (Sync / Interactive):
 *    POST /  with multipart file
 *    ← Called by the backend proxy (/api/expenses/knative-extract)
 *    ← Downloads receipt, runs Gemini AI, returns JSON
 *
 *  Path B (Event-Driven / MinIO Webhook):
 *    POST /  with JSON body (MinIO S3 notification)
 *    ← Triggered automatically when a file lands in the MinIO
 *      'receipts' bucket (via mc event webhook)
 *    ← Demonstrates scale-to-zero + cold start behaviour
 * ============================================================
 */
const express  = require('express');
const multer   = require('multer');
const Minio    = require('minio');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app    = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(express.json());

// ── Clients ──────────────────────────────────────────────────────────────────
// Lazy-init: validate key at startup (log warning but don't crash),
// then instantiate inside the request handler to avoid a top-level throw
// if the secret is temporarily missing during a cold-start race condition.
if (!process.env.GEMINI_API_KEY) {
    console.warn('[receipt-annotator] ⚠️  GEMINI_API_KEY is not set — AI extraction will fail at runtime.');
}

// ── Gemini tuning (all via environment → ConfigMap, no rebuild needed) ───────
//   GEMINI_MODEL              model id, or a COMMA-SEPARATED FALLBACK LIST. The previous
//                             hardcoded ids (2.0-flash, 1.5-pro) were shut down by Google and
//                             broke extraction silently. The free-tier quota is
//                             GenerateRequestsPerDayPerProjectPerModel: 20 requests per day
//                             PER MODEL, so when the first is exhausted the next one in the
//                             list still has its own budget. Only a 429 moves to the next.
//   GEMINI_THINKING_LEVEL     Gemini 3.x Flash "thinks" by default (medium), which cost
//                             ~30-40s per receipt on 3/9. 'low' or 'minimal' cuts most of
//                             it; set 'default' to leave the model's own default.
//   GEMINI_MAX_OUTPUT_TOKENS  upper bound for the answer (4 JSON fields need ~60).
//   GEMINI_HEDGE_AFTER_MS     PATTERN: HEDGED REQUESTS (Dean & Barroso, "The Tail at
//   GEMINI_MAX_HEDGES         Scale", CACM 2013). Measured 3/9 with thinking off and 0
//                             thinking tokens: ~57% of calls answer in 0.5-1.1s, ~43%
//                             sit in a Google-side queue for 13-24s (bimodal). If the
//                             first call has not answered after HEDGE_AFTER_MS we send an
//                             identical second one and keep whichever answers first,
//                             aborting the loser. P(all slow) = 0.43^(1+hedges), so two
//                             hedges take p95 from ~24s to ~4s for ~+50% API calls.
//                             GEMINI_MAX_HEDGES=0 disables hedging (for A/B measurements).
const GEMINI_MODELS            = (process.env.GEMINI_MODEL || 'gemini-3.6-flash')
    .split(',').map((m) => m.trim()).filter(Boolean);
const GEMINI_THINKING_LEVEL    = (process.env.GEMINI_THINKING_LEVEL || 'low').toLowerCase();
const GEMINI_MAX_OUTPUT_TOKENS = parseInt(process.env.GEMINI_MAX_OUTPUT_TOKENS, 10) || 1024;
const GEMINI_HEDGE_AFTER_MS    = parseInt(process.env.GEMINI_HEDGE_AFTER_MS, 10) || 3000;
const GEMINI_MAX_HEDGES        = Number.isFinite(parseInt(process.env.GEMINI_MAX_HEDGES, 10))
    ? Math.max(0, parseInt(process.env.GEMINI_MAX_HEDGES, 10)) : 2;

function buildGenerationConfig(withThinking) {
    const cfg = {
        responseMimeType: 'application/json', // no markdown fences to strip, fewer tokens
        temperature:      0,                  // extraction, not creativity
        maxOutputTokens:  GEMINI_MAX_OUTPUT_TOKENS,
    };
    if (withThinking && GEMINI_THINKING_LEVEL && GEMINI_THINKING_LEVEL !== 'default') {
        cfg.thinkingConfig = { thinkingLevel: GEMINI_THINKING_LEVEL };
    }
    return cfg;
}

/**
 * One generateContent call with a safety net: if this model rejects thinkingConfig
 * (HTTP 400 mentioning "thinking"), retry once without it so extraction keeps
 * working even when GEMINI_THINKING_LEVEL is not valid for the configured model.
 * `signal` lets the hedging layer abort a call that lost the race.
 */
async function generateWithFallback(genAI, parts, signal, model) {
    const attempt = (withThinking) =>
        genAI.getGenerativeModel({ model, generationConfig: buildGenerationConfig(withThinking) })
             .generateContent(parts, { signal });
    try {
        return await attempt(true);
    } catch (err) {
        if (err?.status === 400 && /thinking/i.test(String(err?.message || ''))) {
            console.warn(`[gemini] ${model} rejected thinkingConfig(${GEMINI_THINKING_LEVEL}) — retrying without it`);
            return attempt(false);
        }
        throw err;
    }
}

/**
 * A 4xx from Google means the call was REJECTED, not that it was slow. Hedging or
 * retrying it cannot help and costs another quota unit. 429 (rate limit / quota
 * exhausted) is the one that bites in practice; 400 for a bad model id is the other.
 */
function isTerminalError(err) {
    return Number.isInteger(err?.status) && err.status >= 400 && err.status < 500;
}

/**
 * PATTERN: HEDGED REQUESTS — see the config comment above.
 * Launches attempt #0; every GEMINI_HEDGE_AFTER_MS without an answer launches one
 * more identical attempt (up to GEMINI_MAX_HEDGES). First success wins and aborts
 * the rest. Rejects only when every launched attempt has failed, or as soon as one
 * attempt comes back with a terminal 4xx.
 */
function generateHedged(genAI, parts, model) {
    const maxInFlight = 1 + GEMINI_MAX_HEDGES;
    const tStart = Date.now();
    return new Promise((resolve, reject) => {
        const ctrls = [];
        let launched = 0, failed = 0, done = false, timer = null, lastErr = null;

        const settle = (fn, value) => {
            if (done) return;
            done = true;
            if (timer) clearTimeout(timer);
            ctrls.forEach((c) => { try { c.abort(); } catch (_) { /* ignore */ } });
            fn(value);
        };

        const schedule = () => {
            if (timer) clearTimeout(timer);
            if (done || launched >= maxInFlight || GEMINI_HEDGE_AFTER_MS <= 0) return;
            timer = setTimeout(() => { if (!done && launched < maxInFlight) { launch(); schedule(); } }, GEMINI_HEDGE_AFTER_MS);
        };

        const launch = () => {
            const idx  = launched++;
            const ctrl = new AbortController();
            ctrls.push(ctrl);
            const t0 = Date.now();
            if (idx > 0) console.log(`[gemini] hedge #${idx} sent at +${t0 - tStart}ms (no answer yet)`);
            generateWithFallback(genAI, parts, ctrl.signal, model)
                .then((res) => {
                    if (done) return;
                    console.log(`[gemini] attempt #${idx} won in ${Date.now() - t0}ms (${launched} in flight, ${launched - 1} aborted)`);
                    settle(resolve, res);
                })
                .catch((err) => {
                    if (done || err?.name === 'AbortError') return;
                    failed++; lastErr = err;
                    console.warn(`[gemini] attempt #${idx} failed after ${Date.now() - t0}ms: ${err?.message}`);
                    // A rejection is not slowness. A 429 comes back in ~200ms, well inside
                    // GEMINI_HEDGE_AFTER_MS, so the line below would fire the remaining
                    // hedges immediately and spend 3 quota units on one receipt at exactly
                    // the moment the quota is already gone. Give up now instead.
                    if (isTerminalError(err)) return settle(reject, err);
                    if (launched < maxInFlight) { launch(); schedule(); }   // slow or flaky: hedging is the right answer
                    else if (failed >= launched) settle(reject, lastErr);
                });
        };

        launch();
        schedule();
    });
}

/**
 * PATTERN: FAILOVER. Hedging cannot rescue a 429, because every duplicate lands in the same
 * exhausted bucket. A *different model* is a different bucket (the free-tier quota is per
 * model per day), so switching model is the one retry that can actually change the answer.
 * Only a 429 moves on; any other error is the request's own fault and fails straight out.
 */
async function generateWithModelFailover(genAI, parts) {
    let lastErr;
    for (let i = 0; i < GEMINI_MODELS.length; i++) {
        const model = GEMINI_MODELS[i];
        try {
            return { result: await generateHedged(genAI, parts, model), model };
        } catch (err) {
            lastErr = err;
            if (err?.status !== 429) throw err;
            const next = GEMINI_MODELS[i + 1];
            console.warn(`[gemini] ${model} is out of quota (429)` +
                         (next ? ` — failing over to ${next}` : ' — no models left'));
        }
    }
    throw lastErr;
}

/** Returns a ready GoogleGenerativeAI client, throwing a clear error if key missing. */
function getGenAI() {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error('GEMINI_API_KEY environment variable is not configured.');
    return new GoogleGenerativeAI(key);
}

const minioClient = new Minio.Client({
    endPoint:  process.env.MINIO_ENDPOINT  || 'minio',
    port:      parseInt(process.env.MINIO_PORT) || 9000,
    useSSL:    process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY,
    secretKey: process.env.MINIO_SECRET_KEY,
});

// ── Health probe (Knative liveness check) ────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'UP', service: 'receipt-annotator' }));

// ── Main handler ─────────────────────────────────────────────────────────────
app.post('/', upload.single('receipt'), async (req, res) => {
    console.log(`[receipt-annotator] POST / — content-type: ${req.headers['content-type']}`);

    try {
        // ── PATH B: MinIO webhook / CloudEvent ────────────────────────────────
        // MinIO sends a JSON body with an "EventName" or "Records" field.
        const isMinioEvent = !req.file && (req.body?.EventName || req.body?.Records);
        if (isMinioEvent) {
            return handleMinioEvent(req, res);
        }

        // ── PATH A: Synchronous call from backend proxy ───────────────────────
        let imageBuffer, mimeType;

        if (req.file) {
            // Sub-path A1: file buffer forwarded directly from backend
            imageBuffer = req.file.buffer;
            mimeType    = req.file.mimetype;
            console.log(`[receipt-annotator] Processing uploaded file: ${req.file.originalname} (${mimeType})`);
        } else if (req.body?.bucket && req.body?.key) {
            // Sub-path A2: MinIO coordinates provided → download first
            const { bucket, key } = req.body;
            mimeType    = req.body.mimeType || 'application/pdf';
            console.log(`[receipt-annotator] Downloading from MinIO: ${bucket}/${key}`);
            imageBuffer = await streamToBuffer(bucket, key);
        } else {
            return res.status(400).json({ error: 'No file or MinIO coordinates provided.' });
        }

        const extracted = await extractReceiptData(imageBuffer, mimeType);
        console.log(`[receipt-annotator] Extracted:`, extracted);
        return res.status(200).json(extracted);

    } catch (err) {
        // Pass a Gemini rate limit through as 429 instead of flattening it to 500. The
        // backend maps an upstream 4xx straight to the client and its circuit breaker
        // ignores anything below 500, so an exhausted quota reads as "rate limited, try
        // later" rather than tripping the breaker and blaming the function for 30s.
        const status = err?.status === 429 ? 429 : 500;
        console.error(`[receipt-annotator] Error (answering ${status}):`, err.message);
        return res.status(status).json({
            error: status === 429 ? 'AI extraction rate limited by Gemini' : 'AI extraction failed',
            detail: err.message,
        });
    }
});

// ── MinIO event handler (async — returns 202 immediately) ────────────────────
async function handleMinioEvent(req, res) {
    // Acknowledge immediately — Knative/MinIO don't wait for processing
    res.status(202).json({ message: 'MinIO event accepted' });

    try {
        const records = req.body?.Records || [];
        for (const record of records) {
            const bucket    = record?.s3?.bucket?.name;
            const key       = decodeURIComponent(record?.s3?.object?.key || '');
            const eventName = record?.eventName;
            const size      = record?.s3?.object?.size;

            console.log(`[receipt-annotator] 📦 MinIO Event: ${eventName}`);
            console.log(`   Bucket: ${bucket}  |  File: ${key}  |  Size: ${size} bytes`);

            // Skip non-image/pdf files
            if (!key.match(/\.(jpg|jpeg|png|pdf|gif)$/i)) {
                console.log(`[receipt-annotator] Skipping non-receipt file: ${key}`);
                continue;
            }

            // Demonstrate: download + run AI extraction asynchronously
            const mimeType    = key.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg';
            const imageBuffer = await streamToBuffer(bucket, key);
            const extracted   = await extractReceiptData(imageBuffer, mimeType);

            console.log(`[receipt-annotator] ✅ Async extraction for ${key}:`, extracted);
            // In production: PATCH /api/expenses/:id with extracted data via internal API call
        }
    } catch (err) {
        console.error('[receipt-annotator] Async MinIO processing error:', err.message);
    }
}

// ── MinIO download helper ─────────────────────────────────────────────────────
function streamToBuffer(bucket, key) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        minioClient.getObject(bucket, key, (err, stream) => {
            if (err) return reject(err);
            stream.on('data',  (chunk) => chunks.push(chunk));
            stream.on('end',   () => resolve(Buffer.concat(chunks)));
            stream.on('error', reject);
        });
    });
}

// ── Gemini AI extraction ──────────────────────────────────────────────────────
async function extractReceiptData(imageBuffer, mimeType) {

    const prompt = `You are an expert accounting AI for a building management system.
Analyze this receipt and extract the details.

RULES FOR THE "type" FIELD (STRICT CLASSIFICATION):
- If the receipt is for gas, oil, or heating maintenance -> return "Heating"
- If the receipt is for elevator repair, certification, or maintenance -> return "Elevator"
- For ALL other expenses (electricity/power, water, cleaning services, building repairs, hardware) -> return "General"

Return ONLY a raw JSON object (no markdown, no backticks). Exact keys:
{
    "amount": <Number, the total cost>,
    "month":  <String, month name e.g. "January">,
    "year":   <String, e.g. "2025">,
    "type":   <String, ONLY "Heating", "Elevator", or "General">
}`;

    const tGemini = Date.now();
    const { result, model } = await generateWithModelFailover(getGenAI(), [
        prompt,
        { inlineData: { data: imageBuffer.toString('base64'), mimeType } }
    ]);

    console.log(`[receipt-annotator] Gemini ${model} (thinking=${GEMINI_THINKING_LEVEL}, hedges<=${GEMINI_MAX_HEDGES}) answered in ${Date.now() - tGemini}ms`);
    const cleanJson = result.response.text()
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();

    return JSON.parse(cleanJson);
}

// ── Start ─────────────────────────────────────────────────────────────────────
function start() {
    const PORT = process.env.PORT || 8080;
    const server = app.listen(PORT, () => {
        console.log(`✅ receipt-annotator running on :${PORT}`);
        console.log(`   MINIO_ENDPOINT: ${process.env.MINIO_ENDPOINT}`);
        console.log(`   GEMINI key set: ${!!process.env.GEMINI_API_KEY}`);
        console.log(`   GEMINI models: ${GEMINI_MODELS.join(' -> ')}  thinking: ${GEMINI_THINKING_LEVEL}  hedge: after ${GEMINI_HEDGE_AFTER_MS}ms, max ${GEMINI_MAX_HEDGES}`);
    });

    // Graceful shutdown: Knative scales to zero by sending SIGTERM. Without a handler
    // Node dies with a non-zero exit code and the pod ends in "Error" instead of
    // "Completed", which looks like a crash in `kubectl get pods`. Stop accepting new
    // connections, let in-flight extractions finish, then exit 0.
    function shutdown(signal) {
        console.log(`[receipt-annotator] ${signal} received — draining and exiting`);
        server.close(() => process.exit(0));
        setTimeout(() => process.exit(0), 25000).unref(); // hard stop before the 30s grace period
    }
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT',  () => shutdown('SIGINT'));
    return server;
}

// `node index.js` (the Dockerfile CMD) still starts the server exactly as before.
// The guard only exists so index.selfcheck.js can require the hedging logic without
// binding a port.
if (require.main === module) start();

module.exports = { app, start, generateHedged, generateWithModelFailover, isTerminalError, GEMINI_MODELS };
