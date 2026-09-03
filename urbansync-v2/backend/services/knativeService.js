/**
 * ============================================================
 * Knative proxy — receipt-annotator (serverless AI extraction)
 * ============================================================
 * The frontend's "Extract from receipt" button hits
 * POST /api/expenses/knative-extract. This module forwards the uploaded
 * file to the Knative Service `receipt-annotator` (scale-to-zero) instead
 * of calling Gemini from the backend, so the AI workload really runs in
 * the serverless tier and the cold start is observable end to end.
 *
 * Contract of the function (knative/receipt-annotator/index.js):
 *   POST /  multipart/form-data, field "receipt"  -> 200 {amount, month, year, type}
 *   Any Gemini failure                            -> 500 {error, detail}
 *
 * Resilience:
 *   PATTERN: CIRCUIT BREAKER (knativeBreaker). If the function keeps
 *   failing or hanging, calls fast-fail with a typed error and the route
 *   answers 503 instead of tying up the event loop for a full timeout.
 *   4xx answers from the function (bad input) are NOT counted as breaker
 *   failures — only 5xx, network errors and timeouts are.
 *
 * Config (all optional):
 *   RECEIPT_ANNOTATOR_URL         default http://receipt-annotator.urbansync.svc.cluster.local
 *   RECEIPT_ANNOTATOR_TIMEOUT_MS  default 60000 (cold start ~5-15s + Gemini)
 * ============================================================
 */
const { createBreaker } = require('../resilience/circuitBreaker');

const ANNOTATOR_URL =
    process.env.RECEIPT_ANNOTATOR_URL || 'http://receipt-annotator.urbansync.svc.cluster.local';
const TIMEOUT_MS = parseInt(process.env.RECEIPT_ANNOTATOR_TIMEOUT_MS, 10) || 60000;
// Anything slower than this almost certainly included a pod spin-up.
const COLD_START_HINT_MS = 3000;

/**
 * Raw call — forwards the file as multipart and returns the parsed answer.
 * Node 18 ships fetch/FormData/Blob globally, so no extra dependency.
 */
async function callAnnotator(buffer, mimeType, filename) {
    const form = new FormData();
    form.append('receipt', new Blob([buffer], { type: mimeType }), filename || 'receipt');

    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const t0    = Date.now();

    try {
        const res  = await fetch(ANNOTATOR_URL, { method: 'POST', body: form, signal: ctrl.signal });
        const ms   = Date.now() - t0;
        const text = await res.text();
        let body;
        try { body = JSON.parse(text); } catch { body = { raw: text }; }

        if (!res.ok) {
            const err  = new Error(`receipt-annotator responded ${res.status}`);
            err.status = res.status;
            err.detail = body?.detail || body?.error || text.slice(0, 200);
            throw err;
        }

        console.log(`⚡ [Knative] receipt-annotator answered in ${ms}ms` +
                    (ms > COLD_START_HINT_MS ? ' (cold start suspected)' : ''));
        return { data: body, elapsedMs: ms, coldStartSuspected: ms > COLD_START_HINT_MS };
    } catch (err) {
        if (err.name === 'AbortError') {
            const e = new Error(`receipt-annotator did not answer within ${TIMEOUT_MS}ms`);
            e.timeout = true;
            throw e;
        }
        throw err;
    } finally {
        clearTimeout(timer);
    }
}

const knativeBreaker = createBreaker(
    callAnnotator,
    'Knative-ReceiptAnnotator',
    {
        timeout:                  TIMEOUT_MS + 5000, // our AbortController fires first, with a clearer error
        resetTimeout:             30000,
        errorThresholdPercentage: 50,
        volumeThreshold:          3,
        // Client-side problems (4xx) are not the function's fault: don't trip the circuit.
        errorFilter: (err) => Boolean(err && err.status && err.status < 500),
    },
    () => {
        const e = new Error('Knative circuit OPEN — receipt-annotator unreachable');
        e.circuitOpen = true;
        throw e;
    }
);

/** Public API used by the controller. */
async function extractViaKnative(buffer, mimeType, filename) {
    return knativeBreaker.fire(buffer, mimeType, filename);
}

module.exports = { extractViaKnative, knativeBreaker, ANNOTATOR_URL, TIMEOUT_MS };
