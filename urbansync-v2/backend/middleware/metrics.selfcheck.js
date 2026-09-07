/**
 * Self-check for middleware/metrics.js  —  run: node middleware/metrics.selfcheck.js
 *
 * Guards the one thing here that fails silently and expensively: route label
 * cardinality. If routeLabel() ever regresses to req.path, every scanned URL
 * becomes its own time series and Prometheus memory grows without bound. That
 * shows up as an OOM days later, not as a failing request, so it is worth a test.
 */
const express = require('express');
const assert = require('assert');
const { instrument, errorMetrics, register } = require('./metrics');

const app = express();
instrument(app);
app.get('/api/expenses/:profId', (_req, res) => res.json({ ok: 1 }));
app.get('/api/boom', () => { throw new Error('kaboom'); });
errorMetrics(app);

const srv = app.listen(0, async () => {
    const base = `http://127.0.0.1:${srv.address().port}`;
    const get = (u) => fetch(base + u).then((r) => r.status);

    assert.strictEqual(await get('/api/expenses/aaa'), 200);
    assert.strictEqual(await get('/api/expenses/bbb'), 200);
    assert.strictEqual(await get('/nope/1'), 404);
    assert.strictEqual(await get('/nope/2'), 404);
    assert.strictEqual(await get('/api/boom'), 500);
    assert.strictEqual(await get('/metrics'), 200);

    const text = await register.metrics();
    const series = text.split('\n').filter((l) => l.startsWith('http_requests_total{'));
    const routes = new Set(series.map((l) => l.match(/route="([^"]+)"/)[1]));

    assert.ok(routes.has('/api/expenses/:profId'), 'param route must collapse to its template');
    assert.ok(routes.has('unmatched'), '404s must collapse to a single "unmatched" label');
    assert.ok(!text.includes('route="/nope/1"'), 'a raw 404 path must never become a label');
    assert.ok(!routes.has('/metrics'), 'the scrape endpoint must not count itself');
    assert.strictEqual(routes.size, 3, `expected 3 route labels, got ${[...routes]}`);
    assert.ok(text.includes('http_exceptions_total{route="/api/boom"'), 'thrown errors must be counted');

    console.log('metrics selfcheck OK — 5 requests across 4 distinct URLs produced 3 route labels');
    srv.close();
});
