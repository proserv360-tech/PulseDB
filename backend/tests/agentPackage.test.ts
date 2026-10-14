// @ts-nocheck
import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import agentPackageRoutes from '../routes/agentPackageRoutes.js';
import { crc32 } from '../services/zipStore.js';

test('crc32 matches the standard check value', () => {
    assert.equal(crc32(Buffer.from('123456789')), 0xcbf43926);
});

test('POST /agent/package returns a zip with the agent and a pre-filled config', async () => {
    const inserted = [];
    const pool = {
        query: async (_sql, params) => {
            inserted.push(params);
            return { rows: [{ id: 42, name: params[0] }] };
        },
    };
    const app = express();
    app.use(express.json());
    app.use(
        '/api',
        agentPackageRoutes(pool, (req, _res, next) => ((req.user = { id: 7 }), next()), null, () => {}),
    );
    const server = app.listen(0);
    try {
        const { port } = server.address();
        const r = await fetch(`http://127.0.0.1:${port}/api/agent/package`, {
            method: 'POST',
            headers: { origin: 'https://pulsedb.example.com', 'content-type': 'application/json' },
            body: '{}',
        });
        assert.equal(r.status, 200);
        const body = await r.json();
        const zip = Buffer.from(body.zipBase64, 'base64');
        assert.equal(zip.readUInt32LE(0), 0x04034b50);
        const text = zip.toString('latin1');
        for (const f of ['pulsedb-agent.mjs', 'setup.cmd', 'setup.mjs', 'readOnlyGuard.mjs', 'agent.config.json']) {
            assert.ok(text.includes(`PulseDB-Agent/${f}`), `${f} in zip`);
        }
        const cfgStart = text.lastIndexOf('{\n    "pulsedbUrl"');
        const cfg = JSON.parse(text.slice(cfgStart, text.indexOf('\n}\n', cfgStart) + 2));
        assert.equal(cfg.pulsedbUrl, 'https://pulsedb.example.com');
        assert.match(cfg.agentKey, /^sk_live_[0-9a-f]{48}$/);
        assert.deepEqual(cfg.targets, []);
        assert.equal(inserted[0][7], 7); // created_by = the signed-in admin
    } finally {
        server.close();
    }
});
