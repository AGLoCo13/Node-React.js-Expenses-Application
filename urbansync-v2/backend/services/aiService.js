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
        const result = await generateWithFallback(genAI, [prompt, dataPart]);
        console.log(`[gemini] ${GEMINI_MODEL} (thinking=${GEMINI_THINKING_LEVEL}) answered in ${Date.now() - t0}ms`);
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
