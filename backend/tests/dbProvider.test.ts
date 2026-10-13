import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectDbProvider, checkDbProvider, DiagnosticCodes } from '../services/systemDiagnostics.js';

test('detects Supabase direct connection', () => {
    const i = detectDbProvider({
        DATABASE_URL: 'postgresql://postgres:x@db.abcd.supabase.co:5432/postgres',
        DB_SSL: 'true',
    });
    assert.equal(i.provider, 'supabase');
    assert.equal(i.pooled, false);
    assert.equal(i.tls, true);
    assert.equal(i.host, 'db.abcd.supabase.co');
});

test('detects Supabase transaction pooler (6543)', () => {
    const i = detectDbProvider({
        DATABASE_URL: 'postgresql://postgres.abcd:x@aws-0-us-east-1.pooler.supabase.com:6543/postgres',
        DB_SSL: 'true',
    });
    assert.equal(i.provider, 'supabase');
    assert.equal(i.pooled, true);
});

test('detects Neon with sslmode=require', () => {
    const i = detectDbProvider({
        DATABASE_URL: 'postgresql://u:p@ep-cool-name.us-east-2.neon.tech/neondb?sslmode=require',
    });
    assert.equal(i.provider, 'neon');
    assert.equal(i.tls, true);
    assert.equal(i.pooled, false);
});

test('detects generic postgres via PG* vars', () => {
    const i = detectDbProvider({ PGHOST: 'localhost', PGDATABASE: 'postgres' });
    assert.equal(i.provider, 'postgres');
});

test('unknown when nothing is configured', () => {
    assert.equal(detectDbProvider({}).provider, 'unknown');
});

test('checkDbProvider warns when Supabase has no TLS', async () => {
    const r = await checkDbProvider(
        { query: async () => ({ rows: [{ '?column?': 1 }] }) },
        {
            env: { DATABASE_URL: 'postgresql://postgres:x@db.abcd.supabase.co:5432/postgres' }, // no DB_SSL / sslmode
        },
    );
    assert.equal(r.ok, true); // reachable, so ok; TLS is a non-blocking warning
    assert.ok(r.warnings.some((w) => w.code === DiagnosticCodes.DB_TLS_RECOMMENDED));
});

test('checkDbProvider warns about pooler during migration', async () => {
    const r = await checkDbProvider(
        { query: async () => ({ rows: [{}] }) },
        {
            env: {
                DATABASE_URL: 'postgresql://postgres.abcd:x@aws-0-us-east-1.pooler.supabase.com:6543/postgres',
                DB_SSL: 'true',
                PULSEDB_RUNNING_MIGRATION: 'true',
            },
        },
    );
    assert.ok(r.warnings.some((w) => w.code === DiagnosticCodes.DB_POOLER_FOR_MIGRATION));
});

test('checkDbProvider reports DB_UNREACHABLE when the ping throws', async () => {
    const r = await checkDbProvider(
        {
            query: async () => {
                throw new Error('ECONNREFUSED');
            },
        },
        {
            env: { DATABASE_URL: 'postgresql://postgres:x@db.abcd.supabase.co:5432/postgres', DB_SSL: 'true' },
        },
    );
    assert.equal(r.ok, false);
    assert.equal(r.code, DiagnosticCodes.DB_UNREACHABLE);
});
