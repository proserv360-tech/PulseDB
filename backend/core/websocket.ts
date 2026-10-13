// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)

// Authenticated /ws endpoint that streams alerts.
// Extracted from server.ts.

import jwt from 'jsonwebtoken';
import { WebSocketServer } from 'ws';
import { log } from '../services/logger.js';
import { alerts } from './alerting.js';
import { CONFIG } from './config.js';

export function attachWebSocket(server) {
    // ─────────────────────────────────────────────────────────────────────────────
    // WEBSOCKET  (local / traditional server only — not supported on Vercel)
    // ─────────────────────────────────────────────────────────────────────────────
    if (process.env.VERCEL !== '1') {
        const wss = new WebSocketServer({ server, path: '/ws' });
        wss.on('connection', (ws) => {
            const AUTH_TIMEOUT_MS = 8_000;
            let authenticated = false;

            const authTimeout = setTimeout(() => {
                if (!authenticated) {
                    log('WARN', 'WebSocket auth timeout — closing connection');
                    ws.close(1008, 'Auth timeout');
                }
            }, AUTH_TIMEOUT_MS);

            ws.once('message', (raw) => {
                clearTimeout(authTimeout);
                try {
                    const msg = JSON.parse(raw.toString());
                    if (msg?.type !== 'auth' || !msg.token) throw new Error('Expected {type:"auth",token:"..."}');
                    jwt.verify(msg.token, CONFIG.JWT_SECRET, {
                        audience: CONFIG.JWT_AUDIENCE,
                        audience: CONFIG.JWT_AUDIENCE,
                        issuer: CONFIG.JWT_ISSUER,
                    });
                    authenticated = true;
                } catch (err) {
                    log('WARN', 'WebSocket auth failed — closing connection', { error: err.message });
                    ws.close(1008, 'Unauthorized');
                    return;
                }

                log('INFO', 'WebSocket connection established');
                alerts.addSubscriber(ws);
                Promise.race([
                    alerts.getRecent(10, false),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000)),
                ])
                    .then((recent) => {
                        if (ws.readyState === 1) {
                            ws.send(
                                JSON.stringify({
                                    type: 'alert_summary',
                                    payload: { count: recent.length, alerts: recent },
                                }),
                            );
                        }
                    })
                    .catch((err) => log('WARN', 'WS alert_summary send failed', { error: err.message }));

                ws.on('close', () => {
                    log('INFO', 'WebSocket closed');
                    alerts.removeSubscriber(ws);
                });
                ws.on('error', (e) => log('ERROR', 'WebSocket error', { error: e.message }));
            });

            ws.on('error', (e) => {
                clearTimeout(authTimeout);
                log('ERROR', 'WebSocket pre-auth error', { error: e.message });
            });
        });
    }
}
