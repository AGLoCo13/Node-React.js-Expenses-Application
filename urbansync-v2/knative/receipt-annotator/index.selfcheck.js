/**
 * Runnable check for the hedging logic:  node index.selfcheck.js
 *
 * Guards the 2026-09-21 bug. Hedging exists to beat a SLOW Gemini call, but the
 * catch branch also fired the remaining hedges on a FAILED one. A 429 (quota) comes
 * back in ~200ms, so one receipt upload spent three quota units in under a second,
 * against a quota that was already exhausted. Exactly the wrong reflex.
 *
 * Asserts the three cases that matter: a 429 costs one call, a slow call is still
 * hedged, and a 5xx is still hedged.
 */
const assert = require('assert');

// Read at module load, so these must be set before the require below.
process.env.GEMINI_HEDGE_AFTER_MS = '50';
process.env.GEMINI_MAX_HEDGES     = '2';

const { generateHedged, isTerminalError } = require('./index');

/** Minimal stand-in for GoogleGenerativeAI that counts calls and replays `behaviour`. */
function fakeGenAI(behaviour) {
    const state = { calls: 0 };
    state.client = {
        getGenerativeModel: () => ({
            generateContent: () => behaviour(state.calls++),
        }),
    };
    return state;
}

const httpError = (status) => Object.assign(new Error(`fake ${status}`), { status });

async function main() {
    assert.strictEqual(isTerminalError(httpError(429)), true,  '429 is terminal');
    assert.strictEqual(isTerminalError(httpError(400)), true,  '400 is terminal');
    assert.strictEqual(isTerminalError(httpError(500)), false, '500 is not terminal');
    assert.strictEqual(isTerminalError(new Error('socket hang up')), false, 'no status is not terminal');

    // 1. Quota error costs exactly one API call, not 1 + GEMINI_MAX_HEDGES.
    const quota = fakeGenAI(() => Promise.reject(httpError(429)));
    await assert.rejects(
        () => generateHedged(quota.client, ['prompt']),
        (err) => err.status === 429,
        'a 429 must propagate, not be swallowed',
    );
    assert.strictEqual(quota.calls, 1, `429 must cost 1 call, spent ${quota.calls}`);

    // 2. A slow first attempt is still hedged (the reason hedging exists).
    const slow = fakeGenAI((i) => (i === 0 ? new Promise(() => {}) : Promise.resolve('hedge won')));
    assert.strictEqual(await generateHedged(slow.client, ['prompt']), 'hedge won');
    assert.strictEqual(slow.calls, 2, `slow first call must trigger 1 hedge, saw ${slow.calls}`);

    // 3. A server-side failure is still hedged immediately: it may be transient.
    const flaky = fakeGenAI((i) => (i < 2 ? Promise.reject(httpError(500)) : Promise.resolve('third won')));
    assert.strictEqual(await generateHedged(flaky.client, ['prompt']), 'third won');
    assert.strictEqual(flaky.calls, 3, `5xx must still hedge, saw ${flaky.calls}`);

    console.log('receipt-annotator hedging selfcheck: OK');
}

main().catch((err) => { console.error('SELFCHECK FAILED:', err.message); process.exit(1); });
