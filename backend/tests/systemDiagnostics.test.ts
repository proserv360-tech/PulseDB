// tests/systemDiagnostics.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    DiagnosticCodes,
    checkEncryptionConfig,
    checkControlPlaneSchema,
    runSystemDiagnostics,
    classifyConnectionError,
} from '../services/systemDiagnostics.js';

// ── checkEncryptionConfig ──────────────────────────────────────────────────
test('checkEncryptionConfig: missing ENCRYPTION_KEY → ENCRYPTION_NOT_CONFIGURED', () => {
    const r = checkEncryptionConfig({});
    assert.equal(r.ok, false);
    assert.equal(r.code, DiagnosticCodes.ENCRYPTION_NOT_CONFIGURED);
    assert.match(r.hint, /ENCRYPTION_KEY/);
});

test('checkEncryptionConfig: too short → ENCRYPTION_WEAK', () => {
    const r = checkEncryptionConfig({ ENCRYPTION_KEY: 'short' });
    assert.equal(r.ok, false);
    assert.equal(r.code, DiagnosticCodes.ENCRYPTION_WEAK);
});

test('checkEncryptionConfig: equals JWT_SECRET → ENCRYPTION_COLLIDES', () => {
    const key = 'a'.repeat(48);
    const r = checkEncryptionConfig({ ENCRYPTION_KEY: key, JWT_SECRET: key });
    assert.equal(r.ok, false);
    assert.equal(r.code, DiagnosticCodes.ENCRYPTION_COLLIDES);
});

test('checkEncryptionConfig: distinct, long → OK', () => {
    const r = checkEncryptionConfig({
        ENCRYPTION_KEY: 'a'.repeat(48),
        JWT_SECRET:     'b'.repeat(48),
    });
    assert.equal(r.ok, true);
    assert.equal(r.code, DiagnosticCodes.OK);
});

// ── checkControlPlaneSchema ─────────────────────────────────────────────────
test('checkControlPlaneSchema: null pool → DB_NOT_CONFIGURED', async () => {
    const r = await checkControlPlaneSchema(null);
    assert.equal(r.ok, false);
    assert.equal(r.code, DiagnosticCodes.DB_NOT_CONFIGURED);
});

test('checkControlPlaneSchema: ping failure → DB_UNREACHABLE', async () => {
    const pool = { query: async () => { throw new Error('ECONNREFUSED'); } };
    const r = await checkControlPlaneSchema(pool);
    assert.equal(r.ok, false);
    assert.equal(r.code, DiagnosticCodes.DB_UNREACHABLE);
});

test('checkControlPlaneSchema: missing required tables → SCHEMA_NOT_MIGRATED', async () => {
    // Ping succeeds; schema query returns empty set → both tables missing.
    const pool = {
        query: async (sql) => {
            if (/SELECT 1/.test(sql)) return { rows: [{ '?column?': 1 }] };
            return { rows: [] }; // information_schema.tables returns nothing
        },
    };
    const r = await checkControlPlaneSchema(pool);
    assert.equal(r.ok, false);
    assert.equal(r.code, DiagnosticCodes.SCHEMA_NOT_MIGRATED);
    assert.deepEqual(r.missing, ['fathom_connections', 'users']);
});

test('checkControlPlaneSchema: all tables present → OK', async () => {
    const pool = {
        query: async (sql) => {
            if (/SELECT 1/.test(sql)) return { rows: [{ '?column?': 1 }] };
            return { rows: [{ table_name: 'fathom_connections' }, { table_name: 'users' }] };
        },
    };
    const r = await checkControlPlaneSchema(pool);
    assert.equal(r.ok, true);
    assert.equal(r.code, DiagnosticCodes.OK);
});

test('checkControlPlaneSchema: slow pool → times out gracefully', async () => {
    const pool = { query: () => new Promise(() => { /* never resolves */ }) };
    const r = await checkControlPlaneSchema(pool, { timeoutMs: 30 });
    assert.equal(r.ok, false);
    assert.equal(r.code, DiagnosticCodes.DB_UNREACHABLE);
    assert.match(r.hint, /timed out/);
});

// ── runSystemDiagnostics (composition) ──────────────────────────────────────
test('runSystemDiagnostics: lists every blocker', async () => {
    const r = await runSystemDiagnostics({
        pool: null,
        env:  {},
    });
    assert.equal(r.ok, false);
    assert.equal(r.blockers.length, 2);
    const comps = r.blockers.map(b => b.component).sort();
    assert.deepEqual(comps, ['encryption', 'schema']);
});

test('runSystemDiagnostics: empty blocker list when clean', async () => {
    const pool = {
        query: async (sql) => {
            if (/SELECT 1/.test(sql)) return { rows: [{}] };
            return { rows: [{ table_name: 'fathom_connections' }, { table_name: 'users' }] };
        },
    };
    const r = await runSystemDiagnostics({
        pool,
        env: { ENCRYPTION_KEY: 'a'.repeat(48), JWT_SECRET: 'b'.repeat(48) },
    });
    assert.equal(r.ok, true);
    assert.equal(r.blockers.length, 0);
});

// ── classifyConnectionError ─────────────────────────────────────────────────
test('classifyConnectionError: pg 42P01 → SCHEMA_NOT_MIGRATED, 503', () => {
    const r = classifyConnectionError(Object.assign(new Error('relation missing'), { code: '42P01' }));
    assert.equal(r.status, 503);
    assert.equal(r.code, DiagnosticCodes.SCHEMA_NOT_MIGRATED);
});

test('classifyConnectionError: ECONNREFUSED → DB_UNREACHABLE, 503', () => {
    const r = classifyConnectionError(Object.assign(new Error('connect refused'), { code: 'ECONNREFUSED' }));
    assert.equal(r.status, 503);
    assert.equal(r.code, DiagnosticCodes.DB_UNREACHABLE);
});

test('classifyConnectionError: FATAL encryption missing → ENCRYPTION_NOT_CONFIGURED', () => {
    const r = classifyConnectionError(new Error('FATAL: ENCRYPTION_KEY environment variable is required. …'));
    assert.equal(r.status, 503);
    assert.equal(r.code, DiagnosticCodes.ENCRYPTION_NOT_CONFIGURED);
});

test('classifyConnectionError: FATAL encryption weak → ENCRYPTION_WEAK', () => {
    const r = classifyConnectionError(new Error('FATAL: ENCRYPTION_KEY must be at least 32 characters of entropy.'));
    assert.equal(r.code, DiagnosticCodes.ENCRYPTION_WEAK);
});

test('classifyConnectionError: FATAL encryption equals JWT → ENCRYPTION_COLLIDES', () => {
    const r = classifyConnectionError(new Error('FATAL: ENCRYPTION_KEY must NOT equal JWT_SECRET.'));
    assert.equal(r.code, DiagnosticCodes.ENCRYPTION_COLLIDES);
});

test('classifyConnectionError: unknown error → UNKNOWN, 500', () => {
    const r = classifyConnectionError(new Error('boom'));
    assert.equal(r.status, 500);
    assert.equal(r.code, DiagnosticCodes.UNKNOWN);
});
