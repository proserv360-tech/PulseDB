/**
 * tests/gapClose.test.js
 * ───────────────────────
 * Smoke coverage for every Phase-5 gap-close feature. Each test is
 * deliberately narrow — we validate the module loads, the public surface
 * behaves for the happy path, and structured errors come out in the
 * documented shape. Depth of integration testing belongs in per-feature
 * files as they mature.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';

import {
    getAdapter, detectDbType, SUPPORTED_DB_TYPES,
} from '../services/dbAdapters/index.js';
import { SyntheticMonitor } from '../services/syntheticMonitor.js';
import {
    renderMetrics, requestCounter, _resetForTests,
} from '../services/promScrapeService.js';
import {
    isHipaaMode, redactPhi, hipaaMiddleware,
} from '../middleware/hipaaMode.js';
import {
    generateDek, encryptWithDek, decryptWithDek, getKmsBackend,
} from '../services/kmsService.js';
import observabilityIngestRoutes from '../routes/observabilityIngestRoutes.js';
import syntheticRoutes from '../routes/syntheticRoutes.js';
import erdRoutes from '../routes/erdRoutes.js';

// ── Adapter factory ─────────────────────────────────────────────────────────
describe('dbAdapters: factory registration', () => {
    it('SUPPORTED_DB_TYPES now covers the full list', () => {
        for (const t of ['mssql', 'oracle', 'snowflake', 'bigquery', 'redshift', 'cassandra', 'dynamodb']) {
            assert.ok(SUPPORTED_DB_TYPES.includes(t), `missing: ${t}`);
        }
    });

    it('detectDbType recognises each new connection string prefix', () => {
        assert.equal(detectDbType('mssql://u:p@h/db'),      'mssql');
        assert.equal(detectDbType('sqlserver://u:p@h/db'),  'mssql');
        assert.equal(detectDbType('oracle://u:p@h/db'),     'oracle');
        assert.equal(detectDbType('snowflake://acct/db'),   'snowflake');
        assert.equal(detectDbType('bigquery://proj/ds'),    'bigquery');
        assert.equal(detectDbType('redshift://u:p@h/db'),   'redshift');
        assert.equal(detectDbType('cassandra://h/ks'),      'cassandra');
        assert.equal(detectDbType('dynamodb://us-east-1'),  'dynamodb');
    });

    it('getAdapter returns instances with matching dbType for each new engine', () => {
        for (const t of ['mssql', 'oracle', 'snowflake', 'bigquery', 'redshift', 'cassandra', 'dynamodb']) {
            const adapter = getAdapter(t, { projectId: 'x', account: 'y', host: 'z', region: 'us-east-1' });
            assert.equal(adapter.dbType, t, `${t} adapter has wrong dbType: ${adapter.dbType}`);
            assert.equal(typeof adapter.getOverviewStats, 'function');
            assert.equal(typeof adapter.getServerVersion, 'function');
        }
    });

    it('getAdapter throws for unknown engine', () => {
        assert.throws(() => getAdapter('neo4j'), /Unsupported database type/);
    });

    it('every new adapter exposes the extended metric surface', () => {
        const required = [
            'getOverviewStats', 'getPerformanceStats', 'getTableStats',
            'getIndexStats', 'getActiveConnections', 'getLockInfo',
            'getReplicationStatus', 'getDatabaseList', 'getServerVersion',
            'getKeyMetrics', 'getPlanForQuery', 'getWaitEvents', 'getBloatInfo',
        ];
        for (const t of ['snowflake', 'bigquery', 'redshift', 'cassandra', 'dynamodb']) {
            const a = getAdapter(t, { projectId: 'x', account: 'y', region: 'us-east-1' });
            for (const m of required) {
                assert.equal(typeof a[m], 'function',
                             `${t} adapter is missing ${m}()`);
            }
        }
    });

    it('BaseAdapter extended methods return structured fallbacks', async () => {
        const { BaseAdapter } = await import('../services/dbAdapters/BaseAdapter.js');
        const dummy = new BaseAdapter({});
        dummy.dbType = 'dummy';
        const plan  = await dummy.getPlanForQuery('SELECT 1');
        const waits = await dummy.getWaitEvents();
        const bloat = await dummy.getBloatInfo();
        assert.equal(plan.engine, 'dummy');
        assert.equal(plan.plan, null);
        assert.match(plan.note, /not implemented/);
        assert.equal(waits.events.length, 0);
        assert.match(waits.note, /not implemented/);
        assert.deepEqual(bloat, []);
    });
});

// ── Prometheus scrape ──────────────────────────────────────────────────────
describe('promScrapeService', () => {
    it('renders minimum required metrics in Prom text format', () => {
        _resetForTests();
        const out = renderMetrics();
        assert.match(out, /# HELP fathom_process_uptime_seconds /);
        assert.match(out, /# TYPE fathom_process_uptime_seconds gauge/);
        assert.match(out, /fathom_process_memory_rss_bytes /);
        assert.match(out, /fathom_event_loop_lag_seconds /);
        assert.match(out, /fathom_build_info\{version="/);
    });

    it('requestCounter bumps counters per status', async () => {
        _resetForTests();
        const app = express();
        app.use(requestCounter());
        app.get('/ok',   (_req, res) => res.status(200).end());
        app.get('/boom', (_req, res) => res.status(500).end());
        const server = http.createServer(app).listen(0);
        const { port } = server.address();
        try {
            await fetch(`http://127.0.0.1:${port}/ok`);
            await fetch(`http://127.0.0.1:${port}/ok`);
            await fetch(`http://127.0.0.1:${port}/boom`);
            const body = renderMetrics();
            assert.match(body, /fathom_http_requests_total\{method="GET",status="200"\} 2/);
            assert.match(body, /fathom_http_requests_total\{method="GET",status="500"\} 1/);
        } finally {
            server.close();
        }
    });
});

// ── HIPAA mode ─────────────────────────────────────────────────────────────
describe('hipaaMode', () => {
    it('isHipaaMode reflects env flag', () => {
        assert.equal(isHipaaMode({ HIPAA_MODE: 'true' }),  true);
        assert.equal(isHipaaMode({ HIPAA_MODE: 'false' }), false);
        assert.equal(isHipaaMode({}),                       false);
    });

    it('redactPhi walks nested objects and redacts every known PHI field', () => {
        const input = {
            patient_id: 'MRN-42',
            name: 'alice',            // not in list — survives
            details: { ssn: '000-12-3456', dob: '1970-01-01', safe: 'keep' },
            records: [{ email: 'a@b.c', phone: '555-0000' }],
        };
        const out = redactPhi(input);
        assert.equal(out.patient_id, '[REDACTED:PHI]');
        assert.equal(out.details.ssn, '[REDACTED:PHI]');
        assert.equal(out.details.dob, '[REDACTED:PHI]');
        assert.equal(out.details.safe, 'keep');
        assert.equal(out.records[0].email, '[REDACTED:PHI]');
        assert.equal(out.records[0].phone, '[REDACTED:PHI]');
    });

    it('middleware is a true no-op when HIPAA_MODE is off', async () => {
        delete process.env.HIPAA_MODE;
        const mw = hipaaMiddleware();
        const req = { path: '/patients/42', method: 'GET' };
        const res = { setHeader: () => assert.fail('should not set headers'), json: () => {} };
        await new Promise(resolve => mw(req, res, resolve));
    });

    it('middleware redacts response bodies when HIPAA_MODE is on', async () => {
        process.env.HIPAA_MODE = 'true';
        const mw = hipaaMiddleware();
        const headers = {};
        const captured = {};
        const req = { path: '/records/5', method: 'GET', user: { id: 'u1' } };
        const res = {
            setHeader: (k, v) => { headers[k] = v; },
            json: body => { captured.body = body; },
        };
        await new Promise(resolve => mw(req, res, resolve));
        res.json({ ssn: '123', first_name: 'Jane', x: 1 });
        assert.equal(captured.body.ssn, '[REDACTED:PHI]');
        assert.equal(captured.body.first_name, '[REDACTED:PHI]');
        assert.equal(captured.body.x, 1);
        assert.equal(headers['Cache-Control'], 'no-store, no-cache, must-revalidate, private');
        assert.equal(headers['X-Fathom-PHI-Access'], '1');
        delete process.env.HIPAA_MODE;
    });
});

// ── KMS / BYOK ─────────────────────────────────────────────────────────────
describe('kmsService', () => {
    it('AES-256-GCM roundtrip via DEK', () => {
        const dek = generateDek();
        const { iv, enc, tag } = encryptWithDek(dek, 'hello world');
        assert.equal(decryptWithDek(dek, { iv, enc, tag }).toString('utf8'), 'hello world');
    });

    it('LocalKms wraps and unwraps a DEK', async () => {
        const master = 'a'.repeat(48);
        const kms = getKmsBackend({ backend: 'local', masterKey: master });
        const dek = generateDek();
        const wrapped = await kms.wrap(dek);
        assert.ok(Buffer.isBuffer(wrapped));
        assert.ok(wrapped.length > dek.length);        // IV + tag overhead
        const unwrapped = await kms.unwrap(wrapped);
        assert.ok(unwrapped.equals(dek));
    });

    it('LocalKms rejects short master keys', () => {
        assert.throws(() => getKmsBackend({ backend: 'local', masterKey: 'short' }),
                      /at least 32 chars/);
    });

    it('factory throws for unknown backend', () => {
        assert.throws(() => getKmsBackend({ backend: 'neverheardofit' }), /Unsupported KMS backend/);
    });
});

// ── Synthetic monitor ──────────────────────────────────────────────────────
describe('SyntheticMonitor', () => {
    it('runCheck HTTP probe records latency and status', async () => {
        // Stand up a target.
        const target = http.createServer((_req, res) => { res.end('ok'); }).listen(0);
        const { port } = target.address();
        try {
            const mockPool = {
                query: async () => ({ rows: [] }),
            };
            const mon = new SyntheticMonitor(mockPool);
            const result = await mon.runCheck({
                id: 1, kind: 'http', method: 'GET',
                target: `http://127.0.0.1:${port}/`,
                expected_status: 200, timeout_ms: 3000,
            });
            assert.equal(result.ok, true);
            assert.equal(result.status_code, 200);
            assert.ok(result.latency_ms >= 0);
        } finally {
            target.close();
        }
    });

    it('runCheck HTTP reports failure when server returns unexpected status', async () => {
        const target = http.createServer((_req, res) => { res.statusCode = 503; res.end('err'); }).listen(0);
        const { port } = target.address();
        try {
            const mon = new SyntheticMonitor({ query: async () => ({ rows: [] }) });
            const result = await mon.runCheck({
                id: 2, kind: 'http', method: 'GET',
                target: `http://127.0.0.1:${port}/`,
                expected_status: 200, timeout_ms: 3000,
            });
            assert.equal(result.ok, false);
            assert.equal(result.status_code, 503);
        } finally {
            target.close();
        }
    });
});

// ── Observability ingest routes ────────────────────────────────────────────
describe('observabilityIngestRoutes', () => {
    function mockPool() {
        const calls = [];
        return {
            calls,
            query: async (sql, params) => { calls.push({ sql, params }); return { rows: [] }; },
        };
    }
    function mockAuth(req, _res, next) { req.user = { id: 'u1' }; next(); }

    async function mkServer(pool) {
        const app = express();
        app.use(observabilityIngestRoutes(pool, mockAuth));
        const server = http.createServer(app).listen(0);
        return { server, port: server.address().port };
    }

    it('POST /otlp/v1/logs accepts an empty resourceLogs array', async () => {
        const p = mockPool();
        const { server, port } = await mkServer(p);
        try {
            const r = await fetch(`http://127.0.0.1:${port}/otlp/v1/logs`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ resourceLogs: [] }),
            });
            assert.equal(r.status, 202);
            const body = await r.json();
            assert.equal(body.accepted, 0);
        } finally {
            server.close();
        }
    });

    it('POST /api/v1/errors persists a normalized error event', async () => {
        const p = mockPool();
        const { server, port } = await mkServer(p);
        try {
            const r = await fetch(`http://127.0.0.1:${port}/api/v1/errors`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    event_id: 'abc',
                    message: 'boom',
                    level: 'error',
                    environment: 'prod',
                }),
            });
            assert.equal(r.status, 202);
            assert.equal(p.calls.length, 1);
            assert.match(p.calls[0].sql, /INSERT INTO pgmonitoringtool\.error_events/);
        } finally {
            server.close();
        }
    });

    it('POST /api/v1/rum/beacon accepts text/plain sendBeacon payload', async () => {
        const p = mockPool();
        const { server, port } = await mkServer(p);
        try {
            const r = await fetch(`http://127.0.0.1:${port}/api/v1/rum/beacon`, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({ session_id: 's1', page_url: '/x', lcp_ms: 1234 }),
            });
            assert.equal(r.status, 204);
            assert.equal(p.calls.length, 1);
            assert.match(p.calls[0].sql, /INSERT INTO pgmonitoringtool\.rum_events/);
        } finally {
            server.close();
        }
    });

    it('POST /api/v1/github/webhook persists a deploy marker', async () => {
        const p = mockPool();
        const { server, port } = await mkServer(p);
        try {
            const r = await fetch(`http://127.0.0.1:${port}/api/v1/github/webhook`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-github-event': 'deployment' },
                body: JSON.stringify({
                    deployment: { environment: 'production', url: 'https://example.com' },
                    after: 'deadbeef',
                    sender: { login: 'octocat' },
                    repository: { full_name: 'org/repo' },
                }),
            });
            assert.equal(r.status, 202);
            assert.equal(p.calls.length, 1);
            assert.match(p.calls[0].sql, /INSERT INTO pgmonitoringtool\.deploy_markers/);
            assert.equal(p.calls[0].params[0], 'github');
            assert.equal(p.calls[0].params[1], 'deployment');
        } finally {
            server.close();
        }
    });
});

// ── ERD endpoint ───────────────────────────────────────────────────────────
describe('erdRoutes', () => {
    it('returns nodes + edges for a small schema', async () => {
        const stubPool = {
            query: async (sql) => {
                if (sql.includes('information_schema.tables')) {
                    return { rows: [
                        { table_schema: 'public', table_name: 'users' },
                        { table_schema: 'public', table_name: 'orders' },
                    ]};
                }
                if (sql.includes('information_schema.columns')) {
                    return { rows: [
                        { table_schema: 'public', table_name: 'users',  column_name: 'id',      data_type: 'integer', is_nullable: 'NO',  ordinal_position: 1 },
                        { table_schema: 'public', table_name: 'orders', column_name: 'id',      data_type: 'integer', is_nullable: 'NO',  ordinal_position: 1 },
                        { table_schema: 'public', table_name: 'orders', column_name: 'user_id', data_type: 'integer', is_nullable: 'YES', ordinal_position: 2 },
                    ]};
                }
                if (sql.includes('table_constraints')) {
                    return { rows: [
                        { fk_name: 'fk1', from_schema: 'public', from_table: 'orders', from_col: 'user_id',
                          to_schema: 'public', to_table: 'users', to_col: 'id' },
                    ]};
                }
                return { rows: [] };
            },
        };
        const app = express();
        app.use(erdRoutes(stubPool, (req, _res, next) => { req.user = { id: 'u' }; next(); }));
        const server = http.createServer(app).listen(0);
        const { port } = server.address();
        try {
            const r = await fetch(`http://127.0.0.1:${port}/api/schema/erd?schema=public`);
            const body = await r.json();
            assert.equal(r.status, 200);
            assert.equal(body.nodes.length, 2);
            assert.equal(body.edges.length, 1);
            assert.equal(body.edges[0].from, 'public.orders');
            assert.equal(body.edges[0].to,   'public.users');
        } finally {
            server.close();
        }
    });
});

// ── Synthetic routes (list CRUD surface) ───────────────────────────────────
describe('syntheticRoutes', () => {
    it('GET /api/synthetic/checks returns the list', async () => {
        const stubPool = {
            query: async () => ({ rows: [{ id: 1, name: 'homepage', kind: 'http', target: 'https://x' }] }),
        };
        const app = express();
        app.use(syntheticRoutes(stubPool, (_req, _res, next) => next()));
        const server = http.createServer(app).listen(0);
        const { port } = server.address();
        try {
            const r = await fetch(`http://127.0.0.1:${port}/api/synthetic/checks`);
            const body = await r.json();
            assert.equal(r.status, 200);
            assert.equal(body.checks[0].name, 'homepage');
        } finally {
            server.close();
        }
    });

    it('POST /api/synthetic/checks rejects payload missing name', async () => {
        const stubPool = { query: async () => ({ rows: [{ id: 1 }] }) };
        const app = express();
        app.use(express.json());
        app.use(syntheticRoutes(stubPool, (_req, _res, next) => next()));
        const server = http.createServer(app).listen(0);
        const { port } = server.address();
        try {
            const r = await fetch(`http://127.0.0.1:${port}/api/synthetic/checks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ target: 'https://x' }),
            });
            assert.equal(r.status, 400);
        } finally {
            server.close();
        }
    });
});
