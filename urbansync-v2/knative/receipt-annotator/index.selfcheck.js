/**
 * Runnable check for the hedging and model-failover logic:  node index.selfcheck.js
 *
 * Guards the 2026-09-21 bug. Hedging exists to beat a SLOW Gemini call, but the catch branch
 * also fired the remaining hedges on a FAILED one. A 429 (quota) comes back in ~200ms, so one
 * receipt upload spent three quota units in under a second, against a quota that was already
 * exhausted. Exactly the wrong reflex.
 *
 * The fix has two halves, and both are asserted here:
 *   - a 4xx is terminal, so hedging never multiplies a rejection;
 *   - the free-tier quota is per model per day, so a 429 fails over to the NEXT model, which
 *     is the one retry that can actually return something different.
 */
const assert = require('assert');

// Read at module load, so these must be set before the require below.
process.env.GEMINI_HEDGE_AFTER_MS = '50';
process.env.GEMINI_MAX_HEDGES     = '2';
process.env.GEMINI_MODEL          = ' model-a , model-b ,model-c ';

const { generateHedged, generateWithModelFailover, isTerminalError, GEMINI_MODELS } = require('./index');

/**
 * Minimal stand-in for GoogleGenerativeAI. Records the model of every call so the tests can
 * assert both how many calls happened and which bucket each one hit.
 */
function fakeGenAI(behaviour) {
    const state = { calls: [] };
    state.client = {
        getGenerativeModel: ({ model }) => ({
            generateContent: () => behaviour(state.calls.push(model) - 1, model),
        }),
    };
    return state;
}

const httpError = (status) => Object.assign(new Error(`fake ${status}`), { status });

async function main() {
    // --- model list parsing: whitespace trimmed, order preserved ---
    assert.deepStrictEqual(GEMINI_MODELS, ['model-a', 'model-b', 'model-c']);

    assert.strictEqual(isTerminalError(httpError(429)), true,  '429 is terminal');
    assert.strictEqual(isTerminalError(httpError(400)), true,  '400 is terminal');
    assert.strictEqual(isTerminalError(httpError(500)), false, '500 is not terminal');
    assert.strictEqual(isTerminalError(new Error('socket hang up')), false, 'no status is not terminal');

    // --- hedging ---

    // 1. Quota error costs exactly one API call, not 1 + GEMINI_MAX_HEDGES.
    const quota = fakeGenAI(() => Promise.reject(httpError(429)));
    await assert.rejects(
        () => generateHedged(quota.client, ['prompt'], 'model-a'),
        (err) => err.status === 429,
        'a 429 must propagate, not be swallowed',
    );
    assert.strictEqual(quota.calls.length, 1, `429 must cost 1 call, spent ${quota.calls.length}`);

    // 2. A slow first attempt is still hedged (the reason hedging exists).
    const slow = fakeGenAI((i) => (i === 0 ? new Promise(() => {}) : Promise.resolve('hedge won')));
    assert.strictEqual(await generateHedged(slow.client, ['prompt'], 'model-a'), 'hedge won');
    assert.strictEqual(slow.calls.length, 2, `slow first call must trigger 1 hedge, saw ${slow.calls.length}`);

    // 3. A server-side failure is still hedged immediately: it may be transient.
    const flaky = fakeGenAI((i) => (i < 2 ? Promise.reject(httpError(500)) : Promise.resolve('third won')));
    assert.strictEqual(await generateHedged(flaky.client, ['prompt'], 'model-a'), 'third won');
    assert.strictEqual(flaky.calls.length, 3, `5xx must still hedge, saw ${flaky.calls.length}`);

    // --- model failover ---

    // 4. First model out of quota: fail over to the second, one call each.
    const failover = fakeGenAI((i, model) =>
        (model === 'model-a' ? Promise.reject(httpError(429)) : Promise.resolve('b answered')));
    const okB = await generateWithModelFailover(failover.client, ['prompt']);
    assert.strictEqual(okB.result, 'b answered');
    assert.strictEqual(okB.model, 'model-b', 'must report which model actually answered');
    assert.deepStrictEqual(failover.calls, ['model-a', 'model-b'], 'one call per model, in order');

    // 5. Every model out of quota: all three tried once, then the 429 propagates.
    const allOut = fakeGenAI(() => Promise.reject(httpError(429)));
    await assert.rejects(
        () => generateWithModelFailover(allOut.client, ['prompt']),
        (err) => err.status === 429,
    );
    assert.deepStrictEqual(allOut.calls, ['model-a', 'model-b', 'model-c'],
        'exhausted quota must try each model exactly once');

    // 6. A non-429 must NOT burn the other models' quota.
    const broken = fakeGenAI(() => Promise.reject(httpError(400)));
    await assert.rejects(
        () => generateWithModelFailover(broken.client, ['prompt']),
        (err) => err.status === 400,
    );
    assert.deepStrictEqual(broken.calls, ['model-a'],
        'a 400 is the request being wrong: another model would reject it too');

    console.log('receipt-annotator hedging + failover selfcheck: OK');
}

main().catch((err) => { console.error('SELFCHECK FAILED:', err.message); process.exit(1); });
