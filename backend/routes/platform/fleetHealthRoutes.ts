// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)

// Fleet health across saved connections and the /api/health readiness probe.
// Extracted from server.ts.

import { Pool } from 'pg';
import { buildSslOption, pool } from '../../core/adminPool.js';
import { authenticate } from '../../core/auth.js';
import { connectionPools, getPool, mongodb, mysql2, resolvePoolConfig } from '../../core/connectionPools.js';
import { dbLoadConnections } from '../../core/connectionStore.js';
import { log } from '../../services/logger.js';
import { runSystemDiagnostics } from '../../services/systemDiagnostics.js';

export default function registerFleetHealthRoutes(app) {
    // ─────────────────────────────────────────────────────────────────────────────
    // PHASE 2: FLEET HEALTH & MONITORING ENDPOINTS
    // ─────────────────────────────────────────────────────────────────────────────

    /**
     * GET /api/connections/health
     * Health check all saved connections. Loops through each connection, tests with SELECT 1,
     * measures latency, and returns array of { id, name, dbType, status, latencyMs, lastChecked }
     */
    app.get('/api/connections/health', authenticate, async (req, res) => {
        try {
            const conns = await dbLoadConnections(req.user.id, req.user.role);

            // Probe every connection concurrently. This used to be a sequential
            // for-await, so the endpoint took the SUM of all probes — five
            // connections at ~1.5s each meant a 7.5s response.
            const healthResults = await Promise.all(
                conns.map(async (conn) => {
                    const dbType = (conn.dbType || 'postgresql').toLowerCase();
                    try {
                        // Postgres: reuse the warm pool. Building a fresh Pool per poll
                        // measured TCP + TLS + SCRAM handshake rather than the database,
                        // which is why "latency" read ~1500ms against a pooler in
                        // another region while queries were actually fast. The warm
                        // path measures the query round-trip, which is the number
                        // someone reading a dashboard thinks they are looking at.
                        if (dbType !== 'mongodb' && dbType !== 'mysql' && dbType !== 'mariadb') {
                            const warm = await getPool(conn.id);
                            const t0 = Date.now();
                            await warm.query('SELECT 1');
                            return {
                                id: conn.id,
                                name: conn.name,
                                dbType: conn.dbType || 'postgresql',
                                status: 'ok',
                                latencyMs: Date.now() - t0,
                                probe: 'warm',
                                lastChecked: new Date().toISOString(),
                            };
                        }

                        const poolCfg = await resolvePoolConfig(conn);
                        const startTime = Date.now();

                        if (dbType === 'mongodb') {
                            if (!mongodb) throw new Error('MongoDB driver not installed');
                            const userPart = poolCfg.user
                                ? `${encodeURIComponent(poolCfg.user)}:${encodeURIComponent(poolCfg.password || '')}@`
                                : '';
                            const sslParam = conn.ssl ? '?tls=true&tlsAllowInvalidCertificates=true' : '';
                            const connStr = `mongodb://${userPart}${poolCfg.host}:${poolCfg.port || 27017}/${poolCfg.database || 'admin'}${sslParam}`;
                            const testClient = new mongodb.MongoClient(connStr, { serverSelectionTimeoutMS: 5000 });
                            await testClient.connect();
                            await testClient.db(poolCfg.database || 'admin').command({ ping: 1 });
                            await testClient.close();
                        } else if (dbType === 'mysql' || dbType === 'mariadb') {
                            if (!mysql2) throw new Error('MySQL driver not installed');
                            const testConn = await mysql2.createConnection({
                                host: poolCfg.host,
                                port: poolCfg.port,
                                database: poolCfg.database,
                                user: poolCfg.user,
                                password: poolCfg.password,
                                ssl: buildSslOption(conn.ssl) || undefined,
                                connectTimeout: 5000,
                            });
                            await testConn.query('SELECT 1');
                            await testConn.end();
                        } else {
                            // PRF-03 (audit): always end() the test pool, even on failure.
                            const testPool = new Pool({ ...poolCfg, connectionTimeoutMillis: 5000 });
                            try {
                                const client = await testPool.connect();
                                try {
                                    await client.query('SELECT 1');
                                } finally {
                                    client.release();
                                }
                            } finally {
                                await testPool.end().catch(() => undefined);
                            }
                        }

                        // Mongo/MySQL still open a throwaway connection, so this is
                        // connect + query. Labelled so the UI can say which it is.
                        return {
                            id: conn.id,
                            name: conn.name,
                            dbType: conn.dbType || 'postgresql',
                            status: 'ok',
                            latencyMs: Date.now() - startTime,
                            probe: 'cold',
                            lastChecked: new Date().toISOString(),
                        };
                    } catch (err) {
                        return {
                            id: conn.id,
                            name: conn.name,
                            dbType: conn.dbType || 'postgresql',
                            status: 'error',
                            latencyMs: null,
                            probe: null,
                            lastChecked: new Date().toISOString(),
                            error: err.message,
                        };
                    }
                }),
            );

            res.json(healthResults);
        } catch (e) {
            log('ERROR', `[/api/connections/health] ${e.message}`);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    /**
     * GET /api/connections/count
     * Connection count for first-run detection. Returns { count: N }
     */
    app.get('/api/connections/count', authenticate, async (req, res) => {
        try {
            const conns = await dbLoadConnections(req.user.id, req.user.role);
            res.json({ count: conns.length });
        } catch (e) {
            log('ERROR', `[/api/connections/count] ${e.message}`);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    /**
     * POST /api/connections/parse-url
     * Parse connection string (postgresql://, mysql://, mongodb://) into structured fields.
     * Request body: { url: "postgresql://user:pass@host:5432/dbname" }
     */
    app.post('/api/connections/parse-url', authenticate, async (req, res) => {
        try {
            const { url } = req.body;
            if (!url || typeof url !== 'string') {
                return res.status(400).json({ error: 'url field is required and must be a string' });
            }

            let parsed = {};

            try {
                const urlObj = new URL(url);
                const protocol = urlObj.protocol.replace(':', '');

                // Determine database type from protocol
                let dbType = 'postgresql';
                if (protocol.includes('mysql')) dbType = 'mysql';
                else if (protocol.includes('mongo')) dbType = 'mongodb';

                parsed = {
                    dbType,
                    host: urlObj.hostname || '',
                    port: urlObj.port
                        ? parseInt(urlObj.port)
                        : dbType === 'mysql'
                          ? 3306
                          : dbType === 'mongodb'
                            ? 27017
                            : 5432,
                    database: urlObj.pathname.replace(/^\//, '') || 'postgres',
                    username: urlObj.username || '',
                    password: urlObj.password || '',
                };
            } catch (parseErr) {
                return res.status(400).json({ error: `Invalid connection URL: ${parseErr.message}` });
            }

            res.json(parsed);
        } catch (e) {
            log('ERROR', `[/api/connections/parse-url] ${e.message}`);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    /**
     * GET /api/health
     * System health check. Returns control plane status, active connection count, uptime, memory usage.
     * Response: { controlPlane: 'ok'|'error', activeConnections: N, uptime: seconds, memoryMB: number }
     */
    app.get('/api/health', async (req, res) => {
        try {
            const uptime = process.uptime();
            const memUsage = process.memoryUsage();
            const memoryMB = Math.round(memUsage.heapUsed / 1024 / 1024);

            // By default this is a lightweight liveness ping. The login page (and
            // similar "is the API up?" callers) only read res.ok, so running the
            // full schema/encryption diagnostics on every poll is wasted work and
            // makes the call slow on cold starts. Full diagnostics are opt-in via
            // `?full=1` for operators who want the detailed control-plane probe.
            const full = req.query.full === '1' || req.query.full === 'true';

            if (!full) {
                res.status(200).json({
                    controlPlane: 'ok',
                    activeConnections: connectionPools.size,
                    uptime: Math.round(uptime),
                    memoryMB,
                    timestamp: new Date().toISOString(),
                });
                return;
            }

            // Operators can probe `/api/health?full=1` to see every config problem
            // at once, instead of having to trigger a 503 to find out what's broken.
            const diagnostics = await runSystemDiagnostics({ pool });
            const status = diagnostics.ok ? 200 : 503;

            res.status(status).json({
                controlPlane: diagnostics.ok ? 'ok' : 'degraded',
                activeConnections: connectionPools.size,
                uptime: Math.round(uptime),
                memoryMB,
                diagnostics: {
                    ok: diagnostics.ok,
                    encryption: diagnostics.encryption,
                    schema: diagnostics.schema,
                    provider: diagnostics.provider,
                    warnings: diagnostics.warnings || [],
                    blockers: diagnostics.blockers,
                },
                timestamp: new Date().toISOString(),
            });
        } catch (e) {
            log('ERROR', `[/api/health] ${e.message}`);
            res.status(500).json({
                controlPlane: 'error',
                error: 'Internal server error',
                timestamp: new Date().toISOString(),
            });
        }
    });
}
