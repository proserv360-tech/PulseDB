// @ts-nocheck
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { poolerConnectionString } from '../core/poolerUrl.js';

const SESSION = 'postgresql://postgres.abc:pw@aws-0-ap-south-1.pooler.supabase.com:5432/postgres';

test('on Vercel a Supabase session-pooler URL moves to the transaction pooler', () => {
    const saved = { ...process.env };
    try {
        process.env.VERCEL = '1';
        delete process.env.PULSEDB_KEEP_SESSION_POOLER;
        assert.equal(new URL(poolerConnectionString(SESSION)).port, '6543');
        // other hosts, already-6543, and opt-out are left alone
        assert.equal(poolerConnectionString('postgresql://u:p@db.example.com:5432/x'), 'postgresql://u:p@db.example.com:5432/x');
        process.env.PULSEDB_KEEP_SESSION_POOLER = '1';
        assert.equal(poolerConnectionString(SESSION), SESSION);
        delete process.env.VERCEL;
        delete process.env.PULSEDB_KEEP_SESSION_POOLER;
        assert.equal(poolerConnectionString(SESSION), SESSION); // local dev / migrations unchanged
    } finally {
        process.env = saved;
    }
});
