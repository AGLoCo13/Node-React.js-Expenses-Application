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
//   GEMINI_MODEL              model id; the previous hardcoded ids (2.0-flash, 1.5-pro)
//                             were shut down by Google and broke extraction silently.
//   GEMINI_THINKING_LEVEL     Gemini 3.x Flash "thinks" by default (medium), which cost
//                             ~30-40s per receipt on 3/9. 'low' or 'minimal' cuts most of
//                             it; set 'default' to leave the model's own default.
//   GEMINI_MAX_OUTPUT_TOKENS  upper bound for the answer (4 JSON fields need ~60).
const GEMINI_MODEL             = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
const GEMINI_THINKING_LEVEL    = (process.env.GEMINI_THINKING_LEVEL || 'low').toLowerCase();
const GEMINI_MAX_OUTPUT_TOKENS = parseInt(process.env.GEMINI_MAX_OUTPUT_TOKENS, 10) || 1024;

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
 * generateContent with a safety net: if this model rejects thinkingConfig
 * (HTTP 400 mentioning "thinking"), retry once without it so extraction keeps
 * working even when GEMINI_THINKING_LEVEL is not valid for the configured model.
 */
async function generateWithFallback(genAI, parts) {
    const attempt = (withThinking) =>
        genAI.getGenerativeModel({ model: GEMINI_MODEL, generationConfig: buildGenerationConfig(withThinking) })
             .generateContent(parts);
    try {
        return await attempt(true);
    } catch (err) {
        if (err?.status === 400 && /thinking/i.test(String(err?.message || ''))) {
            console.warn(`[gemini] ${GEMINI_MODEL} rejected thinkingConfig(${GEMINI_THINKING_LEVEL}) — retrying without it`);
            return attempt(false);
        }
        throw err;
    }
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
        console.error('[receipt-annotator] Error:', err.message);
        return res.status(500).json({ error: 'AI extraction failed', detail: err.message });
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
    const result = await generateWithFallback(getGenAI(), [
        prompt,
        { inlineData: { data: imageBuffer.toString('base64'), mimeType } }
    ]);

    console.log(`[receipt-annotator] Gemini ${GEMINI_MODEL} (thinking=${GEMINI_THINKING_LEVEL}) answered in ${Date.now() - tGemini}ms`);
    const cleanJson = result.response.text()
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();

    return JSON.parse(cleanJson);
}

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 8080;
const server = app.listen(PORT, () => {
    console.log(`✅ receipt-annotator running on :${PORT}`);
    console.log(`   MINIO_ENDPOINT: ${process.env.MINIO_ENDPOINT}`);
    console.log(`   GEMINI key set: ${!!process.env.GEMINI_API_KEY}`);
    console.log(`   GEMINI model: ${GEMINI_MODEL}  thinking: ${GEMINI_THINKING_LEVEL}`);
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
