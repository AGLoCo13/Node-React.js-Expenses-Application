/**
 * ============================================================
 * A4 — Application Metrics (Prometheus / prom-client)
 * ============================================================
 * Exposes GET /metrics in Prometheus exposition format so a Prometheus
 * server (or plain `curl`, before Prometheus itself is deployed — that's
 * the S-track) can scrape it. Three kinds of series are published:
 *
 *   1. Default Node.js/process metrics (prom-client's collectDefaultMetrics):
 *      CPU seconds, RSS/heap memory, event-loop lag, active handles...
 *      raw material for a CPU/memory-based HPA later.
 *
 *   2. urbansync_http_request_duration_seconds{method,route,status_code}
 *      (Histogram) — every request through the Express app is timed. This
 *      is the metric the SLA/CDF work (99th percentile, Gold/Silver/Bronze
 *      classes) will be computed from once k6 load tests are wired up.
 *
 *   3. urbansync_circuit_breaker_state{name} (Gauge: 0=CLOSED, 1=HALF_OPEN,
 *      2=OPEN) — driven by the opossum breaker event hooks in
 *      resilience/circuitBreaker.js. Turns the Circuit Breaker pattern into
 *      something visibly graphable, not just console logs.
 *
 *   4. urbansync_alarms_received_total{alarm_type} (Counter) — incremented
 *      by the RabbitMQ 'building-alarms' consumer in server.js. alarm_type
 *      is derived from which field is present on the payload (temperature
 *      -> high_temperature, fuel -> low_fuel) since the ThingsBoard rule
 *      chain forwards the raw telemetry, not a tagged event. This also
 *      gives us an empirical way to check whether BOTH alarm types are
 *      actually reaching the backend, not just Low Fuel.
 * ============================================================
 */
const client = require('prom-client');

const register = new client.Registry();
client.collectDefaultMetrics({ register, prefix: 'urbansync_' });

const httpRequestDuration = new client.Histogram({
    name: 'urbansync_http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [register],
});

const breakerState = new client.Gauge({
    name: 'urbansync_circuit_breaker_state',
    help: 'Circuit breaker state (0=CLOSED, 1=HALF_OPEN, 2=OPEN)',
    labelNames: ['name'],
    registers: [register],
});

const alarmsReceivedTotal = new client.Counter({
    name: 'urbansync_alarms_received_total',
    help: 'ThingsBoard alarms received on the building-alarms queue, by type',
    labelNames: ['alarm_type'],
    registers: [register],
});

/** Express middleware: times every request and records it in the histogram. */
function httpMetricsMiddleware(req, res, next) {
    const start = process.hrtime.bigint();
    res.on('finish', () => {
        const durationSeconds = Number(process.hrtime.bigint() - start) / 1e9;
        // Collapse Mongo ObjectIds in the raw path so unmatched/404 routes don't
        // blow up label cardinality (req.route is only set once Express matches).
        const route = req.route?.path
            ? (req.baseUrl || '') + req.route.path
            : req.path.replace(/[0-9a-fA-F]{24}/g, ':id');
        httpRequestDuration.labels(req.method, route, String(res.statusCode)).observe(durationSeconds);
    });
    next();
}

/** Called from the opossum breaker event hooks in resilience/circuitBreaker.js. */
function setBreakerState(name, state) {
    const VALUES = { CLOSED: 0, HALF_OPEN: 1, OPEN: 2 };
    breakerState.labels(name).set(VALUES[state] ?? 0);
}

/** Called from the RabbitMQ 'building-alarms' consumer in server.js. */
function recordAlarm(alarmType) {
    alarmsReceivedTotal.labels(alarmType).inc();
}

module.exports = { register, httpMetricsMiddleware, setBreakerState, recordAlarm };
