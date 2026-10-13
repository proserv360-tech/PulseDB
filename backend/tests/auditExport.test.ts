/**
 * tests/auditExport.test.js
 * ──────────────────────────
 * Unit tests for the streaming audit export helpers in services/auditService.js
 * (streamAuditEvents, rowToCsv, csvHeader) and for the end-to-end behaviour of
 * the GET /api/audit/export route.
 *
 * The DB layer is faked — these tests do not require a running Postgres.
 *
 * Run:
 *   node --test tests/auditExport.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
    streamAuditEvents,
    rowToCsv,
    csvHeader,
    AUDIT_EXPORT_COLUMNS,
} from '../services/auditService.js';
import { runAuditExport } from '../services/auditExport.js';
import { __setQueryForTests } from '../db.js';

/* ── Fake pg pool that pages through a scripted result set ───────────── */

function makePagingPool(allRows, pageSize = 2) {
    const calls = [];
    return {
        calls,
        query: async (text, params) => {
            calls.push({ text, params });
            // Pull the limit from the trailing param.
            const limit = params[params.length - 1];
            // Cursor params, if present, are the two prior values.
            let cursorTs = null, cursorId = null;
            const usesCursor = / > \(\$\d+,\s*\$\d+\)/.test(text);
            if (usesCursor) {
                cursorId = params[params.length - 2];
                cursorTs = params[params.length - 3];
            }
            const next = allRows.filter(r => {
                if (!usesCursor) return true;
                if (r.created_at > cursorTs) return true;
                if (r.created_at.getTime() === cursorTs.getTime() && r.id > cursorId) return true;
                return false;
            }).slice(0, Math.min(limit, pageSize));
            return { rows: next };
        },
    };
}

function mkRow(i) {
    return {
        id: i,
        created_at: new Date(Date.UTC(2026, 3, 22, 10, 0, i)),
        actor_id: i * 10,
        actor_username: `user${i}`,
        action: 'integration.create',
        resource_type: 'integration',
        resource_id: String(i),
        level: 'info',
        detail: `created destination ${i}`,
        ip_address: '10.0.0.' + i,
        metadata: { key: `v-${i}` },
    };
}

/* ── CSV formatting ─────────────────────────────────────────────────── */

describe('rowToCsv / csvHeader', () => {
    it('header matches the column order in AUDIT_EXPORT_COLUMNS', () => {
        assert.equal(csvHeader(), AUDIT_EXPORT_COLUMNS.join(','));
    });

    it('escapes quotes, commas, and newlines per RFC 4180', () => {
        const line = rowToCsv({
            id: 1,
            created_at: new Date('2026-04-22T10:00:00.000Z'),
            actor_id: null,
            actor_username: 'ada, grace',
            action: 'user.login',
            resource_type: 'user',
            resource_id: null,
            level: 'info',
            detail: 'line\nbreak and a "quote"',
            ip_address: '10.0.0.1',
            metadata: { from: 'web' },
        });
        const parts = parseCsvLine(line);
        assert.equal(parts[0], '1');
        assert.equal(parts[1], '2026-04-22T10:00:00.000Z');
        assert.equal(parts[3], 'ada, grace');
        assert.equal(parts[4], 'user.login');
        assert.equal(parts[8], 'line\nbreak and a "quote"');
        assert.equal(parts[10], '{"from":"web"}');
    });

    it('emits empty string for null / undefined cells', () => {
        const line = rowToCsv({});
        const parts = parseCsvLine(line);
        assert.equal(parts.every(p => p === ''), true);
    });
});

/**
 * Minimal RFC-4180 CSV line parser for test assertions. Handles double-quoting
 * and embedded commas / quotes / newlines within quoted fields.
 */
function parseCsvLine(line) {
    const out = [];
    let cur = '';
    let inside = false;
    for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (inside) {
            if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; continue; }
            if (c === '"') { inside = false; continue; }
            cur += c;
            continue;
        }
        if (c === '"') { inside = true; continue; }
        if (c === ',') { out.push(cur); cur = ''; continue; }
        cur += c;
    }
    out.push(cur);
    return out;
}

/* ── streamAuditEvents pagination ────────────────────────────────────── */

describe('streamAuditEvents', () => {
    it('yields every row exactly once across multiple pages', async () => {
        const all = Array.from({ length: 7 }, (_, i) => mkRow(i + 1));
        const pool = makePagingPool(all, /* pageSize: */ 3);
        const seen = [];
        for await (const row of streamAuditEvents(pool, { pageSize: 3, maxRows: 100 })) {
            seen.push(row.id);
        }
        assert.deepEqual(seen, [1, 2, 3, 4, 5, 6, 7]);
        // Three pages: 3 + 3 + 1
        assert.equal(pool.calls.length, 3);
    });

    it('honours maxRows as a hard cap', async () => {
        const all = Array.from({ length: 20 }, (_, i) => mkRow(i + 1));
        const pool = makePagingPool(all, 5);
        const seen = [];
        for await (const row of streamAuditEvents(pool, { pageSize: 5, maxRows: 4 })) {
            seen.push(row.id);
        }
        assert.equal(seen.length, 4);
        assert.deepEqual(seen, [1, 2, 3, 4]);
    });

    it('adds from/to params to the initial query', async () => {
        const pool = makePagingPool([], 1000);
        // Consume the generator fully so the query fires.
        for await (const _ of streamAuditEvents(pool, {
            from: '2026-04-01T00:00:00Z',
            to: '2026-04-22T00:00:00Z',
        })) { /* noop */ }
        assert.ok(pool.calls.length >= 1);
        const { text, params } = pool.calls[0];
        assert.match(text, /created_at >= \$1/);
        assert.match(text, /created_at < \$2/);
        assert.ok(params[0] instanceof Date);
        assert.ok(params[1] instanceof Date);
    });

    it('falls back to the legacy schema when resource_type is missing', async () => {
        const all = [mkRow(1)];
        let tries = 0;
        const pool = {
            query: async (text, params) => {
                tries += 1;
                if (tries === 1) {
                    const e = new Error('column "resource_type" does not exist');
                    throw e;
                }
                return { rows: all };
            },
        };
        const seen = [];
        for await (const row of streamAuditEvents(pool, { pageSize: 10 })) {
            seen.push(row.id);
        }
        assert.deepEqual(seen, [1]);
        assert.equal(tries, 2);
    });
});

/* ── runAuditExport (S3 hourly dump) ─────────────────────────────────── */

/**
 * Regression cover for the schema drift that made this function throw
 * `column "ts" does not exist` on every scheduled run. Nothing exercised
 * runAuditExport before, which is why a query naming four columns that have
 * never existed on audit_log shipped and sat there failing hourly.
 *
 * AUDIT_EXPORT_BUCKET is unset under test, so getS3() returns null and we take
 * the dry-run path — no S3 SDK, no network.
 */
describe('runAuditExport', () => {
    it('selects only columns that exist on audit_log', async () => {
        const seen = [];
        const restore = __setQueryForTests(async (text, params) => {
            seen.push({ text, params });
            return { rows: [mkRow(1), mkRow(2)] };
        });
        try {
            const summary = await runAuditExport({
                fromTs: new Date('2026-04-22T10:00:00Z'),
                toTs: new Date('2026-04-22T11:00:00Z'),
            });
            assert.equal(summary.exported, 2);
            assert.equal(summary.dryRun, true);
        } finally {
            restore();
        }

        const { text } = seen[0];
        // The columns that caused the failure must be gone...
        for (const dead of ['ts,', ' target', 'details', 'workspace_id']) {
            assert.equal(
                text.includes(dead), false,
                `query still references non-existent column ${dead.trim()}`
            );
        }
        // ...and the real ones present.
        for (const live of AUDIT_EXPORT_COLUMNS) {
            assert.ok(text.includes(live), `query is missing column ${live}`);
        }
        assert.match(text, /created_at >= \$1 AND created_at < \$2/);
    });

    it('returns an empty summary without touching S3 when there are no rows', async () => {
        const restore = __setQueryForTests(async () => ({ rows: [] }));
        try {
            const summary = await runAuditExport({});
            assert.deepEqual(summary, { exported: 0, workspaces: [] });
        } finally {
            restore();
        }
    });

    it('defaults to the trailing hour when no window is given', async () => {
        let params;
        const restore = __setQueryForTests(async (_text, p) => {
            params = p;
            return { rows: [] };
        });
        try {
            await runAuditExport({});
        } finally {
            restore();
        }
        const [start, end] = params;
        assert.equal(end.getTime() - start.getTime(), 60 * 60 * 1000);
    });

    it('falls back to the legacy schema when resource_type is missing', async () => {
        let tries = 0;
        const restore = __setQueryForTests(async () => {
            tries += 1;
            if (tries === 1) throw new Error('column "resource_type" does not exist');
            return { rows: [mkRow(1)] };
        });
        try {
            const summary = await runAuditExport({});
            assert.equal(summary.exported, 1);
        } finally {
            restore();
        }
        assert.equal(tries, 2);
    });

    it('resolves the workspace slug for the object key, without filtering rows', async () => {
        const seen = [];
        const restore = __setQueryForTests(async (text, params) => {
            seen.push({ text, params });
            if (text.includes('workspaces')) return { rows: [{ slug: 'acme' }] };
            return { rows: [mkRow(1)] };
        });
        try {
            const summary = await runAuditExport({ workspaceId: 7 });
            assert.deepEqual(summary.workspaces, ['acme']);
        } finally {
            restore();
        }
        // The event query must not have been narrowed by workspace — the column
        // does not exist, and silently returning a subset would be worse.
        assert.equal(seen[0].text.includes('workspace'), false);
        assert.deepEqual(seen[1].params, [7]);
    });
});

/* ── Route-level: auditRoutes /audit/export ──────────────────────────── */

describe('auditRoutes /audit/export', () => {
    it('streams NDJSON with Content-Type application/x-ndjson', async () => {
        const auditRoutes = (await import('../routes/auditRoutes.js')).default;
        const rows = Array.from({ length: 3 }, (_, i) => mkRow(i + 1));
        const pool = makePagingPool(rows, 10);

        const { app, request } = await makeTestApp(auditRoutes, pool);
        const res = await request('/audit/export?format=json');
        assert.equal(res.statusCode, 200);
        assert.match(res.headers['content-type'], /application\/x-ndjson/);
        assert.match(res.headers['content-disposition'], /attachment;\s*filename=.*\.json/);
        const lines = res.body.split('\n').filter(Boolean);
        assert.equal(lines.length, 3);
        const first = JSON.parse(lines[0]);
        assert.equal(first.id, 1);
    });

    it('streams CSV with a header row when format=csv', async () => {
        const auditRoutes = (await import('../routes/auditRoutes.js')).default;
        const rows = Array.from({ length: 2 }, (_, i) => mkRow(i + 1));
        const pool = makePagingPool(rows, 10);

        const { request } = await makeTestApp(auditRoutes, pool);
        const res = await request('/audit/export?format=csv');
        assert.equal(res.statusCode, 200);
        assert.match(res.headers['content-type'], /text\/csv/);
        const lines = res.body.split('\n').filter(Boolean);
        assert.equal(lines[0], csvHeader());
        assert.equal(lines.length, 3); // header + 2 rows
    });

    it('rejects an invalid format value with 400', async () => {
        const auditRoutes = (await import('../routes/auditRoutes.js')).default;
        const pool = makePagingPool([], 10);
        const { request } = await makeTestApp(auditRoutes, pool);
        const res = await request('/audit/export?format=xml');
        assert.equal(res.statusCode, 400);
        assert.match(res.body, /format must be json or csv/);
    });

    it('rejects from>=to with 400', async () => {
        const auditRoutes = (await import('../routes/auditRoutes.js')).default;
        const pool = makePagingPool([], 10);
        const { request } = await makeTestApp(auditRoutes, pool);
        const res = await request(
            '/audit/export?from=2026-05-01T00:00:00Z&to=2026-04-01T00:00:00Z'
        );
        assert.equal(res.statusCode, 400);
        assert.match(res.body, /from must be earlier than to/);
    });
});

/**
 * Spin up a minimal express app with fake auth & screen middleware so we can
 * exercise the route end-to-end without pulling in the full server.js.
 */
async function makeTestApp(auditRoutesFactory, pool) {
    const express = (await import('express')).default;
    const app = express();
    const fakeAuth = (req, _res, next) => {
        req.user = { id: 1, username: 'admin', role: 'admin' };
        next();
    };
    const requireScreen = () => (_req, _res, next) => next();
    app.use('/api', auditRoutesFactory(pool, fakeAuth, requireScreen));

    async function request(path) {
        // Start a listener on an ephemeral port, fire the request, and
        // collect the response body.
        const server = app.listen(0);
        try {
            const port = server.address().port;
            const res = await fetch(`http://127.0.0.1:${port}/api${path}`);
            const body = await res.text();
            const headers = {};
            res.headers.forEach((v, k) => { headers[k] = v; });
            return { statusCode: res.status, headers, body };
        } finally {
            server.close();
        }
    }
    return { app, request };
}
