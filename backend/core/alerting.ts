// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)

// Alert engine, email notifier, and the monitored-connection target list.
// Extracted from server.ts.

import EnhancedAlertEngine from '../services/alertService.js';
import EmailNotificationService from '../services/emailService.js';
import { log } from '../services/logger.js';
import { pool } from './adminPool.js';
import { CONFIG } from './config.js';
import { getPool } from './connectionPools.js';
import { getConnections, syncConnectionsCache } from './connectionStore.js';

// ─────────────────────────────────────────────────────────────────────────────
// ALERT ENGINE & EMAIL
// ─────────────────────────────────────────────────────────────────────────────
export const emailService = new EmailNotificationService(CONFIG.EMAIL);

// Connections already warned about, so the log says it once per outage
// rather than every 30 seconds.
const _credWarned = new Set();

/**
 * Databases the alert engine should monitor: the ones the user connected, not
 * the control plane. Returns { id, name, pool } per connection, skipping any
 * whose pool cannot be opened (bad credentials, host down) — connectionHealth
 * reports those separately, so failing here would double-alert.
 */
async function alertMonitoringTargets() {
    await syncConnectionsCache().catch(() => {});
    const targets = [];
    for (const conn of getConnections()) {
        const dbType = String(conn.dbType || 'postgresql').toLowerCase();
        if (!dbType.startsWith('postgres')) continue; // rules are Postgres-specific

        // rowToConn() nulls the password when decryption fails (usually because
        // ENCRYPTION_KEY changed). getPool() would still succeed — pg creates
        // pools lazily — and every query would then fail with
        // "SASL: client password must be a string" once per cycle, forever.
        // Skip it here instead; connectionHealth reports the real cause once.
        if (!conn.password) {
            if (!_credWarned.has(conn.id)) {
                _credWarned.add(conn.id);
                log('WARN', 'Skipping connection for alert monitoring — credentials unusable', {
                    connection: conn.name,
                    hint: 'Re-enter the password in the UI to re-encrypt it under the current ENCRYPTION_KEY.',
                });
            }
            continue;
        }
        _credWarned.delete(conn.id); // recovered — allow a fresh warning later

        try {
            targets.push({ id: conn.id, name: conn.name, pool: await getPool(conn.id) });
        } catch (err) {
            log('DEBUG', 'Skipping unreachable connection for alert monitoring', {
                connection: conn.name,
                error: err.message,
            });
        }
    }
    return targets;
}

const _alertEngine = pool ? new EnhancedAlertEngine(pool, CONFIG, emailService, alertMonitoringTargets) : null;

// Null-safe proxy: if no admin DB, alert methods return empty/noop results
export const alerts = _alertEngine || {
    monitoringInterval: null,
    async getRecent() {
        return [];
    },
    async getStatistics() {
        return { total: 0, acknowledged: 0, unacknowledged: 0 };
    },
    async acknowledge() {
        return { success: false, error: 'No admin database configured' };
    },
    async bulkAcknowledge() {
        return [];
    },
    async escalate() {
        return { ok: false, paged: 0, error: 'No admin database configured' };
    },
    async fire() {
        return { id: null };
    },
    async cleanup() {
        return 0;
    },
    async runMonitoring() {},
    async initializeDatabase() {},
    startMonitoring() {},
    stopMonitoring() {},
    addSubscriber() {},
    removeSubscriber() {},
};
