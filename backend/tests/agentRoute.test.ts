// @ts-nocheck
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findAgentRoute, isLocalOnlyHost } from '../services/agentRelay.js';

test('local-only hosts: computer names, localhost, private IPs, *.local', () => {
    for (const h of ['MYPC', 'MYPC\SQLEXPRESS', 'MounikaReddy\MSSQLSERVER', 'localhost', '127.0.0.1', '10.1.2.3',
        '192.168.1.20', '172.20.0.5', 'sql01.corp', 'nas.local']) {
        assert.equal(isLocalOnlyHost(h), true, h);
    }
    for (const h of ['db.example.com', 'myserver.database.windows.net', '8.8.8.8', '172.40.0.1', '']) {
        assert.equal(isLocalOnlyHost(h), false, h);
    }
});

test('no agent routing on self-hosted installs unless forced', async () => {
    const saved = { ...process.env };
    try {
        delete process.env.VERCEL;
        delete process.env.PULSEDB_ROUTE_VIA_AGENT;
        assert.equal(await findAgentRoute({ dbType: 'mssql', host: 'MYPC', userId: 1 }), null);
    } finally {
        process.env = saved;
    }
});

test('offline agent message says how long ago in plain units', async () => {
    const { ago } = await import('../services/agentRelay.js');
    assert.equal(ago(45_000), '45 seconds ago');
    assert.equal(ago(10 * 60_000), '10 minutes ago');
    assert.equal(ago(3 * 3_600_000), '3 hours ago');
    assert.equal(ago(1_345_547_000), '16 days ago');
});
