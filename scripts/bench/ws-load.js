#!/usr/bin/env node
/**
 * ws-load.js
 * ──────────
 * Opens N concurrent WebSocket clients against /ws, subscribes to the
 * metrics channel, and measures the p50/p95/p99 latency between server
 * emit-time and client receive-time.
 *
 * Assumes each server message includes a `ts` field (ISO-8601 or epoch ms)
 * that reflects server-side emit time. Messages without `ts` are ignored.
 *
 * Usage:
 *   node scripts/bench/ws-load.js --url ws://localhost:4000/ws \
 *       --clients 1000 --duration 60 --token <jwt>
 */

import { parseArgs } from 'node:util';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const { values } = parseArgs({
    options: {
        url:      { type: 'string', default: 'ws://localhost:4000/ws' },
        clients:  { type: 'string', default: '500' },
        duration: { type: 'string', default: '30' },
        token:    { type: 'string', default: process.env.FATHOM_JWT || '' },
    },
});

let WebSocket;
try {
    WebSocket = require('ws');
} catch {
    console.error('Install deps first: cd scripts/bench && npm install ws');
    process.exit(1);
}

function pct(values, p) {
    if (!values.length) return null;
    const s = [...values].sort((a, b) => a - b);
    const idx = Math.min(s.length - 1, Math.floor((p / 100) * s.length));
    return s[idx];
}

async function main() {
    const clients = Number(values.clients);
    const durMs = Number(values.duration) * 1000;
    const latencies = [];
    let connected = 0;
    let errored = 0;
    let messages = 0;

    const headers = values.token ? { authorization: `Bearer ${values.token}` } : undefined;
    const sockets = [];

    for (let i = 0; i < clients; i++) {
        const ws = new WebSocket(values.url, { headers });
        ws.on('open', () => { connected++; });
        ws.on('error', () => { errored++; });
        ws.on('message', (buf) => {
            messages++;
            try {
                const data = JSON.parse(buf.toString());
                const ts = typeof data.ts === 'number' ? data.ts : Date.parse(data.ts);
                if (Number.isFinite(ts)) latencies.push(Date.now() - ts);
            } catch { /* ignore non-JSON */ }
        });
        sockets.push(ws);
    }

    // Let them ramp up, then measure for `duration`.
    await new Promise(r => setTimeout(r, 2_000));
    const rampedConnected = connected;

    await new Promise(r => setTimeout(r, durMs));

    for (const ws of sockets) { try { ws.close(); } catch {} }

    const summary = {
        url: values.url,
        attempted: clients,
        connected: rampedConnected,
        errored,
        durationSeconds: Number(values.duration),
        messagesReceived: messages,
        msgPerSec: messages / Number(values.duration),
        latencyMs: {
            p50: pct(latencies, 50),
            p95: pct(latencies, 95),
            p99: pct(latencies, 99),
            max: latencies.length ? Math.max(...latencies) : null,
            samples: latencies.length,
        },
    };
    console.log(JSON.stringify(summary, null, 2));
    process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
