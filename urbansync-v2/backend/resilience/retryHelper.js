/**
 * ============================================================
 * Pattern: RETRY — Exponential Back-off with Jitter
 * ============================================================
 * Wraps any async operation with configurable retry behaviour.
 * Uses `async-retry` which provides:
 *   - Exponential back-off  (delay = minTimeout * factor^attempt)
 *   - Jitter                (randomize: true)
 *   - Bail support          (throw retry.StopRetrying to abort early)
 * ============================================================
 */
const retry = require('async-retry');

/**
 * Default retry configuration.
 * Can be overridden per call-site.
 */
const RETRY_DEFAULTS = {
    retries:    5,        // Total retry attempts after first failure
    factor:     2,        // Exponential backoff multiplier
    minTimeout: 1000,     // Initial wait: 1 second
    maxTimeout: 16000,    // Cap:          16 seconds
    randomize:  true,     // Add ±jitter to prevent thundering-herd
};

/**
 * withRetry — universal retry wrapper
 *
 * @param {Function} fn        Async function to execute; receives (bail, attempt)
 * @param {Object}   options   Overrides for retry config
 * @param {string}   label     Human-readable name for log messages
 * @returns {Promise<*>}       Resolves with fn's result, rejects after all retries
 *
 * @example
 *   const result = await withRetry(
 *     () => mongoose.connect(uri),
 *     { retries: 10, minTimeout: 3000 },
 *     'MongoDB'
 *   );
 */
async function withRetry(fn, options = {}, label = 'Operation') {
    const opts = {
        ...RETRY_DEFAULTS,
        ...options,
        onRetry: (err, attempt) => {
            console.warn(
                `⚠️  [Retry:${label}] Attempt ${attempt} failed — ${err.message}. ` +
                `Retrying with back-off...`
            );
        },
    };
    return retry(fn, opts);
}

module.exports = { withRetry, RETRY_DEFAULTS };
