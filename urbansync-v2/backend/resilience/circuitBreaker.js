/**
 * ============================================================
 * Pattern: CIRCUIT BREAKER — Prevent Cascading Failures
 * ============================================================
 * Uses `opossum` to wrap external service calls (RabbitMQ, MinIO).
 *
 * States:
 *   CLOSED   → Normal operation. Calls pass through.
 *   OPEN     → Service is failing. Calls fast-fail immediately
 *              without waiting, returning a fallback value.
 *   HALF-OPEN→ After resetTimeout, one probe call is sent.
 *              Success → CLOSED. Failure → back to OPEN.
 *
 * This protects the Node.js event loop from blocking on a
 * hung external dependency and prevents log-flooding during
 * an outage.
 * ============================================================
 */
const CircuitBreaker = require('opossum');

/** Shared circuit breaker configuration */
const CB_DEFAULTS = {
    timeout:                  5000,  // Mark as failure if call takes > 5s
    errorThresholdPercentage: 50,    // Open circuit if > 50% of calls fail
    resetTimeout:             30000, // After 30s in OPEN state, try HALF-OPEN
    volumeThreshold:          5,     // Need ≥5 requests before error-% is calculated
};

/**
 * createBreaker — factory that creates a named circuit breaker
 *
 * @param {Function} fn      The async function to protect
 * @param {string}   name    Unique breaker name (used in logs + future metrics)
 * @param {Object}   opts    opossum config overrides
 * @param {Function} fallback Optional fallback when circuit is OPEN
 * @returns {CircuitBreaker}
 */
function createBreaker(fn, name, opts = {}, fallback = null) {
    const breaker = new CircuitBreaker(fn, {
        ...CB_DEFAULTS,
        ...opts,
        name,
    });

    // ── Event hooks (ready for Prometheus metrics in Phase 6) ──────────────
    breaker.on('open',     () =>
        console.error(`🔴 [CB:${name}] Circuit OPEN — fast-failing all calls`));
    breaker.on('halfOpen', () =>
        console.warn (`🟡 [CB:${name}] Circuit HALF-OPEN — sending probe request`));
    breaker.on('close',    () =>
        console.log  (`🟢 [CB:${name}] Circuit CLOSED — service recovered`));
    breaker.on('timeout',  () =>
        console.error(`⏱️  [CB:${name}] Call timed out (>${CB_DEFAULTS.timeout}ms)`));
    breaker.on('reject',   () =>
        console.warn (`🚫 [CB:${name}] Call rejected — circuit is OPEN`));

    if (fallback) {
        breaker.fallback(fallback);
    }

    return breaker;
}

// ── Named breakers (singletons — created once at module load) ──────────────

/**
 * RabbitMQ Connection Breaker
 * Protects amqp.connect() — if the broker is persistently down,
 * the circuit opens and reconnect attempts fast-fail instead of
 * each hanging for the full TCP timeout.
 */
const rabbitMQBreaker = createBreaker(
    require('amqplib').connect,         // The raw function being protected
    'RabbitMQ-Connect',
    {
        timeout:              8000,     // AMQP handshake timeout
        resetTimeout:         20000,    // Retry after 20s outage
        volumeThreshold:      3,        // Open after 3 failures
        errorThresholdPercentage: 100,  // Any failure opens the circuit
    },
    () => { throw new Error('RabbitMQ circuit OPEN — broker unreachable'); }
);

/**
 * MinIO Operations Breaker
 * Protects all MinIO API calls (putObject, presignedGetObject, bucketExists).
 * A fallback throws a typed error that route handlers can catch and
 * return a 503 instead of hanging.
 */
const minioBreaker = createBreaker(
    async (fn) => fn(),                 // Generic wrapper — fn is passed as arg
    'MinIO-Operations',
    {
        timeout:              6000,
        resetTimeout:         15000,
        errorThresholdPercentage: 50,
    },
    () => { throw new Error('MinIO circuit OPEN — object storage unreachable'); }
);

module.exports = { createBreaker, rabbitMQBreaker, minioBreaker };
