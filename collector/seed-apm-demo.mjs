#!/usr/bin/env node
/**
 * seed-apm-demo.mjs — send sample auto_explain events to PulseDB's ingest API.
 *
 * Purpose: see the **Performance → Deep Insights → APM (auto_explain)** tab
 * populate with real data flowing through the real ingest endpoint, WITHOUT
 * setting up RDS / CloudWatch / the shipper first. Great for verifying the
 * end-to-end backend→frontend path and for demos.
 *
 * These are clearly-synthetic sample queries (not invented production data) —
 * use only to validate the pipeline, then run the real shipper for live data.
 *
 * USAGE:
 *   PULSEDB_URL=https://pulsedb.vercel.app \
 *   PULSEDB_SDK_KEY=sk_live_xxx \
 *   PULSEDB_CONNECTION_ID=10 \
 *   node seed-apm-demo.mjs            # send events
 *
 *   add --dry-run to print the payload without sending.
 *   add --count=N to control how many events (default 24, max 500).
 */

const PULSEDB_URL = need('PULSEDB_URL');
const SDK_KEY = need('PULSEDB_SDK_KEY');
const CONNECTION_ID = Number(need('PULSEDB_CONNECTION_ID'));
const DRY = process.argv.includes('--dry-run');
const COUNT = Math.min(
    Number((process.argv.find((a) => a.startsWith('--count=')) || '').split('=')[1]) || 24,
    500
);

function need(name) {
    const v = process.env[name];
    if (!v && !process.argv.includes('--dry-run')) {
        console.error(`missing required env var ${name}`);
        process.exit(1);
    }
    return v || (name === 'PULSEDB_CONNECTION_ID' ? '10' : `<${name}>`);
}

const SAMPLES = [
    {
        statement: 'SELECT * FROM orders WHERE user_id = $1 AND status = $2',
        base: 380,
        plan: (ms) => ({
            Plan: {
                'Node Type': ms > 500 ? 'Seq Scan' : 'Index Scan',
                'Relation Name': 'orders',
                'Actual Total Time': ms,
                'Actual Rows': 120,
                Plans: [],
            },
        }),
    },
    {
        statement:
            'SELECT p.*, c.name FROM products p JOIN categories c ON c.id = p.category_id WHERE p.active = true',
        base: 840,
        plan: (ms) => ({
            Plan: {
                'Node Type': 'Hash Join',
                'Actual Total Time': ms,
                'Actual Rows': 412,
                Plans: [
                    { 'Node Type': 'Seq Scan', 'Relation Name': 'products', 'Actual Total Time': ms * 0.7, 'Actual Rows': 5000 },
                    { 'Node Type': 'Hash', 'Actual Total Time': ms * 0.1, 'Actual Rows': 30 },
                ],
            },
        }),
    },
    {
        statement: 'UPDATE inventory SET quantity = quantity - $1 WHERE sku_id = $2',
        base: 120,
        plan: (ms) => ({
            Plan: { 'Node Type': 'Index Scan', 'Relation Name': 'inventory', 'Actual Total Time': ms, 'Actual Rows': 1, Plans: [] },
        }),
    },
    {
        statement: 'SELECT COUNT(*) FROM page_views WHERE page_id = $1 AND viewed_at > $2',
        base: 610,
        plan: (ms) => ({
            Plan: {
                'Node Type': 'Aggregate',
                'Actual Total Time': ms,
                'Actual Rows': 1,
                Plans: [{ 'Node Type': 'Seq Scan', 'Relation Name': 'page_views', 'Actual Total Time': ms * 0.95, 'Actual Rows': 88000 }],
            },
        }),
    },
];

function buildEvents(n) {
    const now = Date.now();
    const out = [];
    for (let i = 0; i < n; i++) {
        const s = SAMPLES[i % SAMPLES.length];
        const durationMs = Math.max(10, Math.round(s.base + (Math.random() - 0.5) * s.base * 0.6));
        out.push({
            capturedAt: new Date(now - Math.random() * 6 * 3600_000).toISOString(),
            durationMs,
            statement: s.statement,
            queryId: (i % SAMPLES.length) + 1,
            databaseName: 'vigil_prd',
            userName: ['app', 'worker', 'readonly'][i % 3],
            application: ['web-api', 'background-worker', 'cron'][i % 3],
            planJson: s.plan(durationMs),
            source: { provider: 'seed-apm-demo' },
        });
    }
    return out;
}

const events = buildEvents(COUNT);

if (DRY) {
    console.log(JSON.stringify({ connectionId: CONNECTION_ID, events: events.slice(0, 2) }, null, 2));
    console.log(`\n(dry run) would send ${events.length} events to ${PULSEDB_URL}/api/auto-explain/ingest`);
    process.exit(0);
}

const res = await fetch(`${PULSEDB_URL}/api/auto-explain/ingest`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-sdk-key': SDK_KEY },
    body: JSON.stringify({ connectionId: CONNECTION_ID, events }),
    signal: AbortSignal.timeout(15_000),
});

const body = await res.text();
if (!res.ok && res.status !== 202) {
    console.error(`ingest failed: ${res.status} ${body.slice(0, 300)}`);
    process.exit(1);
}
console.log(`✅ sent ${events.length} events (HTTP ${res.status}): ${body.slice(0, 200)}`);
console.log('Open Performance → Deep Insights → APM (auto_explain) to see them.');
