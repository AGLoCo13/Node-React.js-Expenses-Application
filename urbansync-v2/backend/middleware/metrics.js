/**
 * ============================================================
 * Prometheus metrics — application-level observability
 * ============================================================
 * Exposes GET /metrics for Prometheus to scrape. The pod is picked up
 * automatically by the `kubernetes-pods` scrape job as soon as the Deployment
 * carries the prometheus.io/scrape annotations — no Prometheus config change.
 *
 * IMPORTANT — this module must NOT require any other app module.
 * circuitBreaker.js, retryHelper.js and idempotency.js all require THIS file,
 * and rabbitmq-consumer.js -> circuitBreaker.js would close an import cycle.
 * Anything this module needs from the app arrives via registerDependency().
 * ============================================================
 */
const client = require('prom-client');

const register = new client.Registry();

// nodejs_* and process_* — heap, event-loop lag, GC, open handles.
client.collectDefaultMetrics({ register });

// ── HTTP ──────────────────────────────────────────────────────────────────
// Buckets straddle the SLA tier boundaries defined in the roadmap
// (Gold p95 < 300ms, Silver p95 < 800ms) so those percentiles are accurate
// rather than interpolated across a wide bucket.
const httpDuration = new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request latency in seconds',
    labelNames: ['method', 'route', 'code'],
    buckets: [0.025, 0.05, 0.1, 0.3, 0.8, 2, 5, 15],
    registers: [register],
});

const httpTotal = new client.Counter({
    name: 'http_requests_total',
    help: 'Total HTTP requests',
    labelNames: ['method', 'route', 'code'],
    registers: [register],
});

// NOTE: almost every route in server.js has its own try/catch that answers 500,
// so a genuine *thrown* exception is rare — this counter normally reads 0 and
// failures show up as http_requests_total{code="500"}. Both are on the
// dashboard for that reason; do not read a flat line here as "no errors".
const httpExceptions = new client.Counter({
    name: 'http_exceptions_total',
    help: 'Errors that reached the Express error handler or escaped the process',
    labelNames: ['route', 'type'],
    registers: [register],
});

// ── Resilience patterns ───────────────────────────────────────────────────
const cbState = new client.Gauge({
    name: 'circuit_breaker_state',
    help: 'Circuit breaker state: 0=closed 1=half-open 2=open',
    labelNames: ['name'],
    registers: [register],
});

const cbEvents = new client.Counter({
    name: 'circuit_breaker_events_total',
    help: 'Circuit breaker events by type (open/halfOpen/close/timeout/reject)',
    labelNames: ['name', 'event'],
    registers: [register],
});

const retryAttempts = new client.Counter({
    name: 'retry_attempts_total',
    help: 'Retry attempts made by withRetry(), by operation label',
    labelNames: ['label'],
    registers: [register],
});

const idempotencyReplays = new client.Counter({
    name: 'idempotency_replays_total',
    help: 'Requests short-circuited by the Idempotency-Key middleware',
    labelNames: ['outcome'],
    registers: [register],
});

// ── Dependency health ─────────────────────────────────────────────────────
// A probe registry instead of direct imports — see the cycle warning above.
// Probes must be SYNCHRONOUS (they run on every scrape); anything async, like
// MinIO's bucketExists, is polled elsewhere and the probe just reads the flag.
const deps = new Map();

function registerDependency(name, probe) {
    deps.set(name, probe);
}

new client.Gauge({
    name: 'dependency_up',
    help: '1 = dependency reachable, 0 = not',
    labelNames: ['name'],
    registers: [register],
    collect() {
        for (const [name, probe] of deps) {
            let up = 0;
            try { up = probe() ? 1 : 0; } catch (_) { up = 0; }
            this.set({ name }, up);
        }
    },
});

/**
 * Route label. Uses the matched Express template ("/api/expenses/:profId"),
 * NOT req.path — otherwise every distinct id, and every scanned 404 URL,
 * becomes its own label value and the series count grows without bound.
 */
function routeLabel(req) {
    return req.route ? `${req.baseUrl || ''}${req.route.path}` : 'unmatched';
}

/**
 * instrument — timing middleware + the /metrics endpoint.
 * Call immediately after `const app = express()`, BEFORE any route, so the
 * middleware wraps everything.
 */
function instrument(app) {
    app.use((req, res, next) => {
        // Don't measure the scrape itself — it would add ~4 req/min of noise
        // to every request-rate panel.
        if (req.path === '/metrics') return next();

        const end = httpDuration.startTimer();
        res.on('finish', () => {
            const labels = { method: req.method, route: routeLabel(req), code: res.statusCode };
            end(labels);
            httpTotal.inc(labels);
        });
        next();
    });

    app.get('/metrics', async (_req, res) => {
        res.set('Content-Type', register.contentType);
        res.end(await register.metrics());
    });
}

/**
 * errorMetrics — Express error handler + process-level hooks.
 * Call AFTER every route is registered; a 4-argument middleware only receives
 * errors from handlers declared before it.
 */
function errorMetrics(app) {
    app.use((err, req, res, next) => {
        httpExceptions.inc({ route: routeLabel(req), type: (err && err.name) || 'Error' });
        if (res.headersSent) return next(err);
        res.status(500).json({ error: 'Internal server error' });
    });

    // Observe-only: 'uncaughtExceptionMonitor' fires alongside Node's default
    // handling instead of replacing it, so the process still crashes as it
    // would have. A plain 'uncaughtException' listener would suppress the crash
    // and leave the app running in an undefined state.
    process.on('uncaughtExceptionMonitor', (err) => {
        httpExceptions.inc({ route: 'process', type: 'uncaughtException' });
    });

    // There is no monitor-only variant for rejections, and merely attaching a
    // listener suppresses Node's default (>=15) "throw" behaviour. Re-throwing
    // restores it: the rejection escalates to uncaughtException exactly as
    // before, we just get to count it on the way past.
    process.on('unhandledRejection', (reason) => {
        httpExceptions.inc({ route: 'process', type: 'unhandledRejection' });
        throw reason;
    });
}

/**
 * watchBreaker — wire one opossum breaker to the gauges.
 * Called from createBreaker() so every breaker is covered automatically,
 * including knativeBreaker which lives inside knativeService.js.
 */
function watchBreaker(breaker) {
    const name = breaker.name;
    cbState.set({ name }, 0); // start reported as closed, not absent
    for (const event of ['close', 'halfOpen', 'open', 'timeout', 'reject']) {
        breaker.on(event, () => cbEvents.inc({ name, event }));
    }
    breaker.on('close', () => cbState.set({ name }, 0));
    breaker.on('halfOpen', () => cbState.set({ name }, 1));
    breaker.on('open', () => cbState.set({ name }, 2));
}

module.exports = {
    register,
    instrument,
    errorMetrics,
    watchBreaker,
    registerDependency,
    retryAttempts,
    idempotencyReplays,
};
