const { GoogleGenerativeAI } = require('@google/generative-ai');

// Αρχικοποίηση με το κλειδί από το .env
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ── Gemini tuning (all via environment → ConfigMap, no rebuild needed) ───────
//   GEMINI_MODEL              model id; the previous hardcoded ids (2.0-flash, 1.5-pro)
//                             were shut down by Google and broke extraction silently.
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
const GEMINI_MODEL             = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
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
async function generateWithFallback(genAI, parts, signal) {
    const attempt = (withThinking) =>
        genAI.getGenerativeModel({ model: GEMINI_MODEL, generationConfig: buildGenerationConfig(withThinking) })
             .generateContent(parts, { signal });
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

/**
 * PATTERN: HEDGED REQUESTS — see the config comment above.
 * Launches attempt #0; every GEMINI_HEDGE_AFTER_MS without an answer launches one
 * more identical attempt (up to GEMINI_MAX_HEDGES). First success wins and aborts
 * the rest. Rejects only when every launched attempt has failed.
 */
function generateHedged(genAI, parts) {
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
            generateWithFallback(genAI, parts, ctrl.signal)
                .then((res) => {
                    if (done) return;
                    console.log(`[gemini] attempt #${idx} won in ${Date.now() - t0}ms (${launched} in flight, ${launched - 1} aborted)`);
                    settle(resolve, res);
                })
                .catch((err) => {
                    if (done || err?.name === 'AbortError') return;
                    failed++; lastErr = err;
                    console.warn(`[gemini] attempt #${idx} failed after ${Date.now() - t0}ms: ${err?.message}`);
                    if (launched < maxInFlight) { launch(); schedule(); }   // a failure is a good reason to hedge now
                    else if (failed >= launched) settle(reject, lastErr);
                });
        };

        launch();
        schedule();
    });
}

async function extractReceiptData(imageBuffer, mimeType) {
    try {
        // Μοντέλο + thinking level από το ConfigMap (βλ. helper παραπάνω)

        // Το αυστηρό System Prompt
        const prompt = `You are an expert accounting AI for a building management system.
        Analyze this receipt and extract the details.
        
        RULES FOR THE "type" FIELD (STRICT CLASSIFICATION):
        - If the receipt is for gas, oil, or heating maintenance -> return "Heating"
        - If the receipt is for elevator repair, certification, or maintenance -> return "Elevator"
        - For ALL other expenses (electricity/power, water, cleaning services, building repairs, hardware) -> return "General"

        Return ONLY a raw JSON object (no markdown, no backticks). It must have these exact keys:
        {
            "amount": <Number, the total cost>,
            "month": <String, the month name e.g. "January", "February", etc.>,
            "year": <String, the year e.g. "2024">,
            "type": <String, ONLY "Heating", "Elevator", or "General">
        }`;

        // Προετοιμασία της εικόνας για το Gemini
        const dataPart = {
            inlineData: {
                data: imageBuffer.toString("base64"),
                mimeType: mimeType
            }
        };

        // Στέλνουμε το αίτημα στο AI
        const t0 = Date.now();
        const result = await generateHedged(genAI, [prompt, dataPart]);
        console.log(`[gemini] ${GEMINI_MODEL} (thinking=${GEMINI_THINKING_LEVEL}, hedges<=${GEMINI_MAX_HEDGES}) answered in ${Date.now() - t0}ms`);
        const responseText = result.response.text();
        
        // Καθαρίζουμε το κείμενο σε περίπτωση που το AI βάλει ```json
        const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        
        return JSON.parse(cleanJson);

    } catch (error) {
        const status = error?.status;
        const isQuota = status === 429 || (error?.message && error.message.includes('429'));

        if (isQuota) {
            // Quota exceeded — return empty placeholders so the UI stays usable.
            // The user can fill in the fields manually.
            console.warn("⚠️  AI quota exceeded (429). Returning empty placeholders.");
            return {
                amount: null,
                month: "",
                year: "",
                type: "General",
                _aiError: "AI quota exceeded — please fill in the fields manually."
            };
        }

        console.error("AI Extraction Error:", error);
        throw new Error("Failed to extract data from receipt");
    }
}

module.exports = { extractReceiptData };
