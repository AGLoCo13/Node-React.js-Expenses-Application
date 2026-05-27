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
    const model = getGenAI().getGenerativeModel({ model: 'gemini-1.5-pro' });

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

    const result = await model.generateContent([
        prompt,
        { inlineData: { data: imageBuffer.toString('base64'), mimeType } }
    ]);

    const cleanJson = result.response.text()
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();

    return JSON.parse(cleanJson);
}

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`✅ receipt-annotator running on :${PORT}`);
    console.log(`   MINIO_ENDPOINT: ${process.env.MINIO_ENDPOINT}`);
    console.log(`   GEMINI key set: ${!!process.env.GEMINI_API_KEY}`);
});
