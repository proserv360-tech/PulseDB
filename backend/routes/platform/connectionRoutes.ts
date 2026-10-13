// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)

// Saved-connection CRUD, testing, and database/schema switching.
// Extracted from server.ts.

import { Pool } from 'pg';
import {
    getUserActiveConnectionId,
    getUserActiveDatabaseId,
    getUserActiveSchema,
    setUserActiveConnectionId,
    setUserActiveDatabase,
    setUserActiveSchema,
} from '../../core/activeSelection.js';
import { buildSslOption, pool } from '../../core/adminPool.js';
import { authenticate } from '../../core/auth.js';
import { IS_PROD } from '../../core/config.js';
import {
    destroyPool,
    getMongoClient,
    getOverridePool,
    getPool,
    isDatabaseSwitchable,
    isPgLikeEngine,
    mongodb,
    mysql2,
    reqPool,
    resolvePoolConfig,
} from '../../core/connectionPools.js';
import {
    dbDeleteConnection,
    dbInsertConnection,
    dbLoadConnections,
    dbSetDefault,
    dbUpdateConnection,
    ensureConnections,
    getConnections,
    syncConnectionsCache,
} from '../../core/connectionStore.js';
import { cache, cached } from '../../core/responseCache.js';
import { getAdapter as getDbAdapter } from '../../services/dbAdapters/index.js';
import { getPublicKey, unwrapField } from '../../services/encryptionService.js';
import { log } from '../../services/logger.js';
import { closeTunnel } from '../../services/sshTunnel.js';
import { classifyConnectionError, DiagnosticCodes } from '../../services/systemDiagnostics.js';

export default function registerConnectionRoutes(app) {
    // ─────────────────────────────────────────────────────────────────────────────
    // CONNECTIONS
    // ─────────────────────────────────────────────────────────────────────────────
    const SSH_FIELDS = [
        'sshEnabled',
        'sshHost',
        'sshPort',
        'sshUser',
        'sshAuthType',
        'sshPrivateKey',
        'sshPassphrase',
        'sshPassword',
    ];

    // ── Key exchange: frontend encrypts passwords with this RSA public key ──
    app.get('/api/connections/handshake', authenticate, (req, res) => {
        try {
            res.json({ publicKey: getPublicKey() });
        } catch (e) {
            res.status(500).json({ error: 'Encryption not configured' });
        }
    });

    /**
     * Unwrap sensitive fields that may arrive RSA-encrypted from the frontend.
     * Falls back gracefully to plaintext for backward compatibility.
     */
    function unwrapSensitiveFields(body) {
        const SENSITIVE = ['password', 'sshPrivateKey', 'sshPassphrase', 'sshPassword'];
        const out = { ...body };
        for (const f of SENSITIVE) {
            if (out[f]) out[f] = unwrapField(out[f]);
        }
        return out;
    }

    function pickSSH(body) {
        return {
            sshEnabled: body.sshEnabled ?? false,
            sshHost: body.sshHost || '',
            sshPort: parseInt(body.sshPort) || 22,
            sshUser: body.sshUser || '',
            sshAuthType: body.sshAuthType || 'key',
            sshPrivateKey: body.sshPrivateKey || '',
            sshPassphrase: body.sshPassphrase || '',
            sshPassword: body.sshPassword || '',
        };
    }

    function sanitizeConn(c) {
        const { password, sshPrivateKey, sshPassphrase, sshPassword, ...safe } = c;
        return safe;
    }

    app.get('/api/connections', authenticate, ensureConnections, async (req, res) => {
        try {
            const conns = await dbLoadConnections(req.user.id, req.user.role);
            res.json(conns.map(sanitizeConn));
        } catch (e) {
            log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
            res.json([]);
        }
    });

    app.get('/api/connections/:id', authenticate, ensureConnections, async (req, res, next) => {
        // Skip non-numeric IDs so named routes (/active, /health, /count) can match
        if (!/^\d+$/.test(req.params.id)) return next();
        try {
            const id = parseInt(req.params.id, 10);
            const conns = await dbLoadConnections(req.user.id, req.user.role);
            const c = conns.find((c) => c.id === id);
            if (!c) return res.status(404).json({ error: 'Connection not found' });
            res.json(sanitizeConn(c));
        } catch (e) {
            log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
            res.json({});
        }
    });

    // B6: adapter capability negotiation. FE drives tab visibility from this
    // shape instead of switching on dbType strings. Endpoint is cheap — it
    // just instantiates the adapter shell (no connect) and asks for caps.
    app.get('/api/connections/:id/capabilities', authenticate, ensureConnections, async (req, res, next) => {
        if (!/^\d+$/.test(req.params.id)) return next();
        try {
            const id = parseInt(req.params.id, 10);
            const conns = await dbLoadConnections(req.user.id, req.user.role);
            const c = conns.find((c) => c.id === id);
            if (!c) return res.status(404).json({ error: 'Connection not found' });
            const adapter = getDbAdapter(c.dbType || 'postgresql', {});
            const caps = adapter && typeof adapter.getCapabilities === 'function' ? adapter.getCapabilities() : {};
            res.json({ dbType: c.dbType || 'postgresql', capabilities: caps });
        } catch (e) {
            log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
            res.status(500).json({ error: e.message });
        }
    });

    // ── Database switcher: list, read, and switch the active database on a server ──
    // A connection targets one database; these endpoints let the operator pick any
    // database on the SAME server without registering a new connection. Listing is
    // cached briefly (dropdowns re-open often); switching validates reachability
    // then records a per-user, per-connection override consumed by reqPool /
    // getMongoClient. `switchable` is false for transaction-pooler connections.
    const _dbListCache = new Map(); // connectionId -> { at, data }
    const DB_LIST_TTL_MS = 30_000;

    app.get('/api/connections/:id/databases', authenticate, ensureConnections, async (req, res, next) => {
        if (!/^\d+$/.test(req.params.id)) return next();
        try {
            const id = parseInt(req.params.id, 10);
            const conns = await dbLoadConnections(req.user.id, req.user.role);
            const c = conns.find((x) => x.id === id);
            if (!c) return res.status(404).json({ error: 'Connection not found' });

            const sw = isDatabaseSwitchable(c);
            const active = getUserActiveDatabaseId(req.user.id, id) || c.database || null;
            const meta = { active, current: c.database || null, switchable: sw.ok, reason: sw.reason };

            const fresh = req.query.refresh === '1' || req.query.refresh === 'true';
            const cached = _dbListCache.get(id);
            if (!fresh && cached && Date.now() - cached.at < DB_LIST_TTL_MS) {
                return res.json({ databases: cached.data, ...meta });
            }

            const dbType = (c.dbType || 'postgresql').toLowerCase();
            let databases = [];
            if (dbType === 'mongodb') {
                const { client } = await getMongoClient(id, req.user.id);
                const r = await client.db().admin().listDatabases();
                databases = (r.databases || []).map((d) => ({ name: d.name, sizeBytes: d.sizeOnDisk || null }));
            } else if (dbType === 'mysql' || dbType === 'mariadb') {
                const p = await getPool(id, req.user.id);
                const [rows] = await p.query('SHOW DATABASES');
                databases = rows.map((r) => ({ name: Object.values(r)[0], sizeBytes: null }));
            } else {
                const p = await getPool(id, req.user.id);
                const r = await p.query(
                    `SELECT datname AS name,
                        CASE WHEN has_database_privilege(datname, 'CONNECT')
                             THEN pg_database_size(datname) ELSE NULL END AS size_bytes
                 FROM pg_database WHERE datistemplate = false AND datallowconn ORDER BY datname`,
                );
                databases = r.rows.map((x) => ({ name: x.name, sizeBytes: Number(x.size_bytes) || null }));
            }
            _dbListCache.set(id, { at: Date.now(), data: databases });
            res.json({ databases, ...meta });
        } catch (e) {
            log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
            // Degrade gracefully: the dropdown shows the reason instead of a raw 500.
            res.json({ databases: [], error: e.message, switchable: false });
        }
    });

    app.get('/api/connections/:id/database', authenticate, ensureConnections, async (req, res, next) => {
        if (!/^\d+$/.test(req.params.id)) return next();
        try {
            const id = parseInt(req.params.id, 10);
            const conns = await dbLoadConnections(req.user.id, req.user.role);
            const c = conns.find((x) => x.id === id);
            if (!c) return res.status(404).json({ error: 'Connection not found' });
            res.json({
                active: getUserActiveDatabaseId(req.user.id, id) || c.database || null,
                current: c.database || null,
                switchable: isDatabaseSwitchable(c).ok,
            });
        } catch (e) {
            log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
            res.json({ active: null });
        }
    });

    app.post('/api/connections/:id/database', authenticate, ensureConnections, async (req, res, next) => {
        if (!/^\d+$/.test(req.params.id)) return next();
        try {
            const id = parseInt(req.params.id, 10);
            const database = req.body && req.body.database ? String(req.body.database).trim() : '';
            if (!database) return res.status(400).json({ error: 'database is required' });

            const conns = await dbLoadConnections(req.user.id, req.user.role);
            const c = conns.find((x) => x.id === id);
            if (!c) return res.status(404).json({ error: 'Connection not found' });

            const sw = isDatabaseSwitchable(c);
            if (!sw.ok) return res.status(400).json({ success: false, error: sw.reason });

            // Reset to the connection's own database: clear the override. Also drop
            // any schema selection — schemas are per-database and won't carry over.
            if (database === c.database) {
                setUserActiveDatabase(req.user.id, id, null);
                setUserActiveSchema(req.user.id, id, null);
                cache.clear();
                return res.json({ success: true, database, connectionId: id });
            }

            // Validate the target is reachable before committing the override.
            try {
                const dbType = (c.dbType || 'postgresql').toLowerCase();
                if (dbType === 'mongodb') {
                    const { client } = await getMongoClient(id, req.user.id);
                    await client.db(database).command({ ping: 1 });
                } else {
                    const p = await getOverridePool({ ...c, database }, database);
                    if (dbType === 'mysql' || dbType === 'mariadb') {
                        await p.query('SELECT 1');
                    } else {
                        const client = await p.connect();
                        await client.query('SELECT 1');
                        client.release();
                    }
                }
            } catch (err) {
                return res
                    .status(400)
                    .json({ success: false, error: `Cannot switch to "${database}": ${err.message}` });
            }

            setUserActiveDatabase(req.user.id, id, database);
            // A new database has its own schemas — drop any prior schema selection.
            setUserActiveSchema(req.user.id, id, null);
            cache.clear();
            log('INFO', `Active database switched to "${database}" on connection ${id} for user ${req.user.id}`);
            res.json({ success: true, database, connectionId: id });
        } catch (e) {
            log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
            res.status(500).json({ error: e.message });
        }
    });

    // ── Schema switcher: list, read, and switch the active schema ──
    // Postgres: scopes table-level panels (they filter by ?schema=) and pins the
    // SQL console search_path (via the override pool). SQL Server / Snowflake: the
    // schema is applied to the live SQL console (adapter.useSchema) — those engines
    // have no backend-fed dashboard panels to scope. Other engines: unsupported.
    const _schemaListCache = new Map(); // `${connId}:${db}` -> { at, data }

    const SCHEMA_ENGINES = new Set(['postgresql', 'postgres', 'mssql', 'sqlserver', 'snowflake']);
    const schemaSupported = (dbType) => SCHEMA_ENGINES.has((dbType || 'postgresql').toLowerCase());
    const isAdapterSchemaEngine = (dbType) => {
        const t = (dbType || '').toLowerCase();
        return t === 'mssql' || t === 'sqlserver' || t === 'snowflake';
    };

    // On-demand schema listing for engines that go through an adapter (not the
    // shared pool). Connects, lists, and disconnects — cheap enough for a dropdown
    // that's cached for DB_LIST_TTL_MS.
    async function listAdapterSchemas(conn) {
        const cfg = await resolvePoolConfig(conn);
        const adapter = getDbAdapter(conn.dbType, {
            host: cfg.host,
            port: cfg.port,
            database: cfg.database,
            user: cfg.user,
            username: cfg.user,
            password: cfg.password,
            ssl: cfg.ssl,
            account: cfg.host,
            projectId: cfg.host,
            region: cfg.host,
            keyspace: cfg.database,
            contactPoints: cfg.host ? [cfg.host] : undefined,
        });
        await adapter.connect();
        try {
            return (await adapter.getSchemas()) || [];
        } finally {
            try {
                await adapter.disconnect();
            } catch {
                /* ignore */
            }
        }
    }

    app.get('/api/connections/:id/schemas', authenticate, ensureConnections, async (req, res, next) => {
        if (!/^\d+$/.test(req.params.id)) return next();
        try {
            const id = parseInt(req.params.id, 10);
            const conns = await dbLoadConnections(req.user.id, req.user.role);
            const c = conns.find((x) => x.id === id);
            if (!c) return res.status(404).json({ error: 'Connection not found' });

            const supported = schemaSupported(c.dbType);
            const activeDb = getUserActiveDatabaseId(req.user.id, id) || c.database || null;
            const defaultSchema = isPgLikeEngine(c.dbType) ? 'public' : null;
            const active = getUserActiveSchema(req.user.id, id) || defaultSchema;
            // For adapter engines the schema only reaches the SQL console.
            const scope = isPgLikeEngine(c.dbType) ? 'panels' : isAdapterSchemaEngine(c.dbType) ? 'console' : 'none';
            const meta = { active, supported, scope, database: activeDb };
            if (!supported) return res.json({ schemas: [], ...meta });

            const cacheKey = `${id}:${activeDb}`;
            const fresh = req.query.refresh === '1' || req.query.refresh === 'true';
            const cached = _schemaListCache.get(cacheKey);
            if (!fresh && cached && Date.now() - cached.at < DB_LIST_TTL_MS) {
                return res.json({ schemas: cached.data, ...meta });
            }

            let schemas;
            if (isPgLikeEngine(c.dbType)) {
                // The connection id comes from the path (:id), not ?connectionId= —
                // /api/connections/* is intentionally excluded from that query param.
                // Point reqPool at this connection so it resolves + applies overrides.
                req.query.connectionId = req.query.connectionId || String(id);
                const p = await reqPool(req);
                const r = await p.query(
                    `SELECT n.nspname AS name,
                        COALESCE(c.tables, 0) AS table_count
                 FROM pg_namespace n
                 LEFT JOIN (
                    SELECT schemaname, count(*) AS tables FROM pg_stat_user_tables GROUP BY schemaname
                 ) c ON c.schemaname = n.nspname
                 WHERE n.nspname NOT IN ('pg_catalog','information_schema','pg_toast')
                   AND n.nspname NOT LIKE 'pg_temp_%' AND n.nspname NOT LIKE 'pg_toast_temp_%'
                 ORDER BY n.nspname`,
                );
                schemas = r.rows.map((x) => ({ name: x.name, tableCount: Number(x.table_count) || 0 }));
            } else {
                schemas = await listAdapterSchemas(c);
            }
            _schemaListCache.set(cacheKey, { at: Date.now(), data: schemas });
            res.json({ schemas, ...meta });
        } catch (e) {
            log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
            res.json({ schemas: [], error: e.message });
        }
    });

    app.get('/api/connections/:id/schema', authenticate, ensureConnections, async (req, res, next) => {
        if (!/^\d+$/.test(req.params.id)) return next();
        try {
            const id = parseInt(req.params.id, 10);
            const conns = await dbLoadConnections(req.user.id, req.user.role);
            const c = conns.find((x) => x.id === id);
            if (!c) return res.status(404).json({ error: 'Connection not found' });
            res.json({
                active: getUserActiveSchema(req.user.id, id) || (isPgLikeEngine(c.dbType) ? 'public' : null),
                supported: schemaSupported(c.dbType),
                scope: isPgLikeEngine(c.dbType) ? 'panels' : isAdapterSchemaEngine(c.dbType) ? 'console' : 'none',
            });
        } catch (e) {
            res.json({ active: null, supported: false });
        }
    });

    app.post('/api/connections/:id/schema', authenticate, ensureConnections, async (req, res, next) => {
        if (!/^\d+$/.test(req.params.id)) return next();
        try {
            const id = parseInt(req.params.id, 10);
            const schema = req.body && req.body.schema ? String(req.body.schema).trim() : '';
            if (!schema) return res.status(400).json({ error: 'schema is required' });
            const conns = await dbLoadConnections(req.user.id, req.user.role);
            const c = conns.find((x) => x.id === id);
            if (!c) return res.status(404).json({ error: 'Connection not found' });
            if (!schemaSupported(c.dbType)) {
                return res
                    .status(400)
                    .json({ success: false, error: 'Schema switching is not available for this engine.' });
            }
            // Postgres 'public' is the default → clears the override. Adapter engines
            // (mssql/snowflake) have no universal default, so any value is stored.
            const clears = isPgLikeEngine(c.dbType) && schema === 'public';
            setUserActiveSchema(req.user.id, id, clears ? null : schema);
            cache.clear();
            log('INFO', `Active schema switched to "${schema}" on connection ${id} for user ${req.user.id}`);
            res.json({ success: true, schema, connectionId: id });
        } catch (e) {
            log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
            res.status(500).json({ error: e.message });
        }
    });

    // Engines whose credentials don't match the traditional host/port/user/password/db
    // shape. Relax the required-fields guard for these so BigQuery (project ID +
    // service account JSON) and DynamoDB (region + access key + secret) can both
    // be created via the standard wizard. See ENGINE_HINTS in ConnectionWizard.tsx
    // for the field-mapping guidance shown to operators.
    const PHASE5_RELAXED_FIELDS = new Set(['bigquery', 'dynamodb', 'snowflake', 'redis', 'cassandra', 'elasticsearch']);

    app.post('/api/connections', authenticate, ensureConnections, async (req, res) => {
        try {
            // Unwrap RSA-encrypted sensitive fields from the frontend
            const body = unwrapSensitiveFields(req.body);
            const {
                name,
                host,
                port,
                database,
                username,
                password,
                ssl,
                isDefault,
                dbType: rawDbType,
                type: rawType,
            } = body;
            // Wizard sends `type`, backend historically uses `dbType` — accept either
            const dbType = (rawDbType || rawType || 'postgresql').toLowerCase();
            const relaxed = PHASE5_RELAXED_FIELDS.has(dbType);
            // Classic engines still require host + port + db + user + password. Phase-5
            // engines with non-traditional credential shapes require only name + host
            // (which the wizard maps to project ID / account ID / region).
            if (!name || !host) {
                return res.status(400).json({ error: 'name and host are required' });
            }
            if (!relaxed && (!port || !database || !username || !password)) {
                return res
                    .status(400)
                    .json({ error: 'host, port, database, username, password are required for this database type' });
            }
            if (isDefault) await dbSetDefault(req.user.id, req.user.role, -1);

            // Auto-deduplicate connection names: if "MyDB" exists, try "MyDB (2)", "MyDB (3)", …
            let finalName = name;
            let attempt = 0;
            let newConn;
            while (true) {
                try {
                    newConn = await dbInsertConnection({
                        userId: req.user.id,
                        name: finalName,
                        host,
                        port: parseInt(port),
                        database,
                        username,
                        password,
                        ssl: ssl || false,
                        isDefault: isDefault || false,
                        dbType: dbType || 'postgresql',
                        ...pickSSH(body),
                        status: null,
                        lastTested: null,
                    });
                    break; // success
                } catch (insertErr) {
                    if (insertErr.code === '23505' && attempt < 10) {
                        attempt++;
                        finalName = `${name} (${attempt + 1})`;
                    } else {
                        throw insertErr; // re-throw non-duplicate or exhausted retries
                    }
                }
            }
            await syncConnectionsCache();

            // Auto-test the new connection so the user gets immediate feedback
            let testResult = null;
            const connDbType = (newConn.dbType || 'postgresql').toLowerCase();
            // Phase-5 engines go through the adapter factory. If the engine's
            // peer driver (snowflake-sdk / ioredis / cassandra-driver / etc.)
            // isn't installed, surface that as a DRIVER_NOT_INSTALLED warning
            // instead of hard-failing the connection creation — the row is
            // still stored so operators can fix the driver and retry.
            const PHASE5_VIA_ADAPTER = new Set([
                'mssql',
                'oracle',
                'snowflake',
                'bigquery',
                'redshift',
                'cassandra',
                'dynamodb',
                'redis',
                'elasticsearch',
            ]);
            try {
                const cfg = await resolvePoolConfig(newConn);
                if (PHASE5_VIA_ADAPTER.has(connDbType)) {
                    const { getAdapter } = await import('../../services/dbAdapters/index.js');
                    const adapter = getAdapter(connDbType, {
                        // Common fields
                        host: cfg.host,
                        port: cfg.port,
                        database: cfg.database,
                        user: cfg.user,
                        username: cfg.user,
                        password: cfg.password,
                        ssl: cfg.ssl,
                        // Per-engine aliases the adapters look for
                        account: cfg.host, // Snowflake account identifier
                        projectId: cfg.host, // BigQuery project ID
                        region: cfg.host, // DynamoDB region
                        keyspace: cfg.database, // Cassandra default keyspace
                        contactPoints: cfg.host ? [cfg.host] : undefined,
                    });
                    await adapter.connect();
                    await adapter.disconnect?.().catch(() => undefined);
                } else if (connDbType === 'mongodb') {
                    if (!mongodb) throw new Error('MongoDB driver not installed');
                    const userPart = cfg.user
                        ? `${encodeURIComponent(cfg.user)}:${encodeURIComponent(cfg.password || '')}@`
                        : '';
                    const sslParam = newConn.ssl ? '?tls=true&tlsAllowInvalidCertificates=true' : '';
                    const connStr = `mongodb://${userPart}${cfg.host}:${cfg.port || 27017}/${cfg.database || 'admin'}${sslParam}`;
                    const testClient = new mongodb.MongoClient(connStr, { serverSelectionTimeoutMS: 8000 });
                    await testClient.connect();
                    await testClient.db(cfg.database || 'admin').command({ ping: 1 });
                    await testClient.close();
                } else if (connDbType === 'mysql' || connDbType === 'mariadb') {
                    if (!mysql2) throw new Error('MySQL driver not installed');
                    const testConn = await mysql2.createConnection({
                        host: cfg.host,
                        port: cfg.port,
                        database: cfg.database,
                        user: cfg.user,
                        password: cfg.password,
                        ssl: buildSslOption(newConn.ssl) || undefined,
                        connectTimeout: 8000,
                    });
                    await testConn.query('SELECT 1');
                    await testConn.end();
                } else {
                    // Try as-is first; on cert errors, retry with the configured SSL
                    // policy (see buildSslOption + FATHOM_TLS_ALLOW_SELF_SIGNED).
                    // PRF-03 (audit): always end() the test pool, even on the
                    // failure path, so we don't leak open sockets when the connect()
                    // succeeds but the followup query throws.
                    let pgOk = false;
                    for (const sslOverride of [undefined, buildSslOption(true)]) {
                        const poolOpts = { ...cfg, connectionTimeoutMillis: 8000 };
                        if (sslOverride) poolOpts.ssl = sslOverride;
                        const testPool = new Pool(poolOpts);
                        try {
                            const client = await testPool.connect();
                            try {
                                await client.query('SELECT 1');
                            } finally {
                                client.release();
                            }
                            pgOk = true;
                            break;
                        } catch (pgErr) {
                            if (!pgErr.message.includes('certificate') && !pgErr.message.includes('SSL')) {
                                await testPool.end().catch(() => undefined);
                                throw pgErr;
                            }
                        } finally {
                            await testPool.end().catch(() => undefined);
                        }
                    }
                    if (!pgOk) throw new Error('Connection failed — could not establish SSL connection');
                }
                await dbUpdateConnection(newConn.id, { status: 'success', lastTested: new Date().toISOString() });
                testResult = { success: true, message: 'Connection verified' };
            } catch (testErr) {
                await dbUpdateConnection(newConn.id, { status: 'failed', lastTested: new Date().toISOString() });
                testResult = { success: false, error: testErr.message };
            }
            await syncConnectionsCache();

            res.status(201).json({ success: true, ...sanitizeConn(newConn), connectionId: newConn.id, testResult });
        } catch (e) {
            if (e.code === '23505')
                return res.status(409).json({ error: 'Connection name already exists', code: 'DUPLICATE_NAME' });

            // Map well-known misconfigurations to actionable 503s so the operator
            // isn't staring at an opaque 500. `hint` is safe to surface — it names
            // the env var or migration command, not the stack.
            const classified = classifyConnectionError(e);
            log('ERROR', 'Create connection error', {
                error: e.message,
                stack: e.stack,
                code: e.code,
                diagnostic: classified.code,
            });
            const body = {
                error:
                    classified.code === DiagnosticCodes.UNKNOWN
                        ? 'Internal server error'
                        : classified.hint || 'Configuration error',
                code: classified.code,
            };
            if (classified.hint) body.hint = classified.hint;
            if (!IS_PROD) body.details = e.message;
            res.status(classified.status).json(body);
        }
    });

    app.put('/api/connections/:id', authenticate, ensureConnections, async (req, res) => {
        try {
            const id = parseInt(req.params.id, 10);
            const conns = await dbLoadConnections(req.user.id, req.user.role);
            const existing = conns.find((c) => c.id === id);
            if (!existing) return res.status(404).json({ error: 'Connection not found' });

            // Unwrap RSA-encrypted sensitive fields from the frontend
            const body = unwrapSensitiveFields(req.body);
            const { name, host, port, database, username, password, ssl } = body;
            const ssh = pickSSH({ ...existing, ...body });

            const sshChanged = SSH_FIELDS.some((f) => req.body[f] !== undefined && req.body[f] !== existing[f]);
            if (sshChanged) await closeTunnel(id);
            await destroyPool(id);
            if (getUserActiveConnectionId(req.user.id) === id) cache.clear();

            const updated = await dbUpdateConnection(id, {
                name: name || existing.name,
                host: host || existing.host,
                port: port ? parseInt(port) : existing.port,
                database: database || existing.database,
                username: username || existing.username,
                password: password || existing.password,
                ssl: ssl !== undefined ? ssl : existing.ssl,
                sshEnabled: ssh.sshEnabled,
                sshHost: ssh.sshHost,
                sshPort: ssh.sshPort,
                sshUser: ssh.sshUser,
                sshAuthType: ssh.sshAuthType,
                sshPrivateKey: ssh.sshPrivateKey,
                sshPassphrase: ssh.sshPassphrase,
                sshPassword: ssh.sshPassword,
                status: null,
                lastTested: null,
            });
            await syncConnectionsCache();
            res.json(sanitizeConn(updated));
        } catch (e) {
            if (e.code === '23505')
                return res.status(409).json({ error: 'Connection name already exists', code: 'DUPLICATE_NAME' });
            const classified = classifyConnectionError(e);
            log('ERROR', 'Update connection error', { error: e.message, stack: e.stack, diagnostic: classified.code });
            const body = {
                error:
                    classified.code === DiagnosticCodes.UNKNOWN
                        ? 'Internal server error'
                        : classified.hint || 'Configuration error',
                code: classified.code,
            };
            if (classified.hint) body.hint = classified.hint;
            if (!IS_PROD) body.details = e.message;
            res.status(classified.status).json(body);
        }
    });

    app.delete('/api/connections/:id', authenticate, ensureConnections, async (req, res) => {
        try {
            const id = parseInt(req.params.id, 10);
            const conns = await dbLoadConnections(req.user.id, req.user.role);
            const c = conns.find((c) => c.id === id);
            if (!c) return res.status(404).json({ error: 'Connection not found' });

            await closeTunnel(id);
            await destroyPool(id);
            // Clear per-user active connection if this was it
            if (getUserActiveConnectionId(req.user.id) === id) {
                setUserActiveConnectionId(req.user.id, null);
                cache.clear();
            }

            await dbDeleteConnection(id, req.user.id);

            // If it was the default, promote the next connection for this user
            if (c.isDefault) {
                const remaining = conns.filter((x) => x.id !== id);
                if (remaining.length > 0) {
                    await dbSetDefault(req.user.id, req.user.role, remaining[0].id);
                }
            }

            await syncConnectionsCache();
            res.json({ success: true });
        } catch (e) {
            const classified = classifyConnectionError(e);
            log('ERROR', 'Delete connection error', { error: e.message, stack: e.stack, diagnostic: classified.code });
            const body = {
                error:
                    classified.code === DiagnosticCodes.UNKNOWN
                        ? 'Internal server error'
                        : classified.hint || 'Configuration error',
                code: classified.code,
            };
            if (classified.hint) body.hint = classified.hint;
            if (!IS_PROD) body.details = e.message;
            res.status(classified.status).json(body);
        }
    });

    app.post('/api/connections/:id/default', authenticate, ensureConnections, async (req, res) => {
        try {
            const id = parseInt(req.params.id, 10);
            const conns = await dbLoadConnections(req.user.id, req.user.role);
            if (!conns.find((c) => c.id === id)) return res.status(404).json({ error: 'Connection not found' });
            await dbSetDefault(req.user.id, req.user.role, id);
            await syncConnectionsCache();

            // PERF: warm the pool in the background so the very next dashboard
            // request finds a live socket instead of paying TCP+TLS+auth on the
            // critical path. Fire-and-forget — errors are logged but don't
            // delay the response. Skipped on Vercel (no long-lived process).
            if (process.env.VERCEL !== '1') {
                (async () => {
                    try {
                        const pool = await getPool(id, req.user?.id);
                        if (pool && typeof pool.query === 'function') {
                            await pool.query('SELECT 1').catch(() => {});
                        }
                    } catch (warmErr) {
                        log('INFO', `Pool warm-up failed for connection ${id}`, { error: warmErr.message });
                    }
                })();
            }

            res.json({ success: true });
        } catch (e) {
            log('ERROR', 'Set default connection error', { error: e.message, stack: e.stack });
            res.status(500).json({
                error: 'Internal server error',
                ...(IS_PROD ? {} : { details: e.message }),
                code: e.code,
            });
        }
    });

    // ── SSRF guard (SEC-021 + audit M-1) ────────────────────────────────────────
    // Block private/internal targets by literal host string AND by resolved IP, so
    // a public hostname that resolves to an internal address (DNS rebinding, a CNAME
    // to cloud metadata) can't slip through a name-only blocklist.
    function isPrivateIp(ip) {
        const s = String(ip || '').toLowerCase();
        if (!s) return false;
        if (s === '::1' || s.startsWith('fc') || s.startsWith('fd') || s.startsWith('fe80')) return true;
        const m = s.match(/(\d+\.\d+\.\d+\.\d+)$/);
        const v4 = m ? m[1] : /^\d+\.\d+\.\d+\.\d+$/.test(s) ? s : null;
        if (v4) {
            const o = v4.split('.').map(Number);
            if (o[0] === 10 || o[0] === 127 || o[0] === 0) return true;
            if (o[0] === 169 && o[1] === 254) return true;
            if (o[0] === 172 && o[1] >= 16 && o[1] <= 31) return true;
            if (o[0] === 192 && o[1] === 168) return true;
            if (o[0] === 100 && o[1] >= 64 && o[1] <= 127) return true;
        }
        return false;
    }

    async function assertHostNotPrivate(host) {
        const h = String(host || '').trim();
        if (!h) return { ok: false, reason: 'Host is required' };
        const literal = [
            /^127\./,
            /^10\./,
            /^172\.(1[6-9]|2\d|3[01])\./,
            /^192\.168\./,
            /^0\./,
            /^169\.254\./,
            /^::1$/,
            /^fc00:/i,
            /^fe80:/i,
            /^localhost$/i,
            /\.local$/i,
            /^metadata\.google\.internal$/i,
        ];
        if (literal.some((p) => p.test(h)) || isPrivateIp(h)) {
            return { ok: false, reason: 'Connections to private/internal networks are not allowed' };
        }
        try {
            const dns = await import('dns/promises');
            const records = await dns.lookup(h, { all: true });
            if (records.some((r) => isPrivateIp(r.address))) {
                return { ok: false, reason: 'Host resolves to a private/internal address; not allowed' };
            }
        } catch {
            // resolution failure: let the actual connection attempt surface the error
        }
        return { ok: true };
    }

    // ── Test connection with raw credentials (no saved connection required) ──────
    app.post('/api/connections/test', authenticate, async (req, res) => {
        try {
            const { type, host, port, username, password, database, ssl } = req.body;
            if (!host) return res.status(400).json({ success: false, error: 'Host is required' });

            // SEC-021 + audit M-1: reject private/internal targets by literal host AND
            // by resolved IP (defeats DNS-based SSRF bypass).
            const ssrf = await assertHostNotPrivate(host);
            if (!ssrf.ok) {
                return res.status(400).json({ success: false, error: ssrf.reason });
            }
            const dbType = (type || 'postgresql').toLowerCase();

            // Phase-5 engines (MSSQL, Oracle, Redis, Elasticsearch, Snowflake,
            // BigQuery, Redshift, Cassandra, DynamoDB) are routed through the
            // shared adapter factory so the wizard's "Test Connection" step
            // succeeds for every engine the backend actually supports — not just
            // the legacy PostgreSQL / MySQL / MongoDB trio.
            const PHASE5_VIA_ADAPTER = new Set([
                'mssql',
                'sqlserver',
                'sql-server',
                'oracle',
                'oracledb',
                'snowflake',
                'bigquery',
                'gbq',
                'redshift',
                'cassandra',
                'scylla',
                'dynamodb',
                'dynamo',
                'redis',
                'elasticsearch',
                'opensearch',
                'elastic',
            ]);

            try {
                if (dbType === 'mongodb') {
                    if (!mongodb) throw new Error('MongoDB driver (mongodb) not installed on the server');
                    const userPart = username
                        ? `${encodeURIComponent(username)}:${encodeURIComponent(password || '')}@`
                        : '';
                    const sslParam = ssl ? '?tls=true&tlsAllowInvalidCertificates=true' : '';
                    const connStr = `mongodb://${userPart}${host}:${port || 27017}/${database || 'admin'}${sslParam}`;
                    const testClient = new mongodb.MongoClient(connStr, {
                        serverSelectionTimeoutMS: 8000,
                        connectTimeoutMS: 8000,
                    });
                    await testClient.connect();
                    await testClient.db(database || 'admin').command({ ping: 1 });
                    await testClient.close();
                } else if (dbType === 'mysql' || dbType === 'mariadb') {
                    if (!mysql2) throw new Error('MySQL driver (mysql2) not installed on the server');
                    const testConn = await mysql2.createConnection({
                        host,
                        port: port || 3306,
                        database: database || undefined,
                        user: username,
                        password,
                        ssl: buildSslOption(ssl) || undefined,
                        connectTimeout: 8000,
                    });
                    await testConn.query('SELECT 1');
                    await testConn.end();
                } else if (PHASE5_VIA_ADAPTER.has(dbType)) {
                    // Route Phase-5 engines through the adapter factory. Each
                    // adapter knows its own driver, default port, and credential
                    // shape — we pass aliases (account/projectId/region/etc.) so
                    // engines with non-traditional credential layouts pick up the
                    // right field from the wizard's generic host/port/user form.
                    const { getAdapter } = await import('../../services/dbAdapters/index.js');
                    const adapter = getAdapter(dbType, {
                        host,
                        port,
                        database,
                        user: username,
                        username,
                        password,
                        ssl,
                        // Per-engine aliases (mirrors POST /api/connections):
                        account: host, // Snowflake account identifier
                        projectId: host, // BigQuery project ID
                        region: host, // DynamoDB region
                        keyspace: database, // Cassandra default keyspace
                        contactPoints: host ? [host] : undefined,
                    });
                    await adapter.connect();
                    await adapter.disconnect?.().catch(() => undefined);
                } else {
                    // Try with the user's SSL preference first; on cert errors, retry
                    // honoring buildSslOption (strict in prod by default).
                    // PRF-03 (audit): always end() the test pool, including on the
                    // failure path, to avoid leaking open sockets.
                    const sslOpt = buildSslOption(ssl) || undefined;
                    let lastErr;
                    for (const sslAttempt of [sslOpt, sslOpt ? null : buildSslOption(true)]) {
                        const testPool = new Pool({
                            host,
                            port: port || 5432,
                            database: database || 'postgres',
                            user: username,
                            password,
                            ssl: sslAttempt === null ? undefined : sslAttempt,
                            connectionTimeoutMillis: 8000,
                        });
                        try {
                            const client = await testPool.connect();
                            try {
                                await client.query('SELECT 1');
                            } finally {
                                client.release();
                            }
                            lastErr = null;
                            break;
                        } catch (e) {
                            lastErr = e;
                            // Only retry if it's a certificate error
                            if (!e.message.includes('certificate') && !e.message.includes('SSL')) break;
                        } finally {
                            await testPool.end().catch(() => undefined);
                        }
                    }
                    if (lastErr) throw lastErr;
                }

                res.json({ success: true, message: 'Connection successful' });
            } catch (e) {
                res.json({ success: false, error: e.message });
            }
        } catch (e) {
            log('ERROR', 'Test connection (raw) error', { error: e.message });
            res.status(500).json({ success: false, error: 'Internal server error' });
        }
    });

    app.post('/api/connections/:id/test', authenticate, ensureConnections, async (req, res) => {
        try {
            const id = parseInt(req.params.id, 10);
            const conns = await dbLoadConnections(req.user.id, req.user.role);
            const c = conns.find((c) => c.id === id);
            if (!c) return res.status(404).json({ error: 'Connection not found' });

            let poolCfg;
            try {
                poolCfg = await resolvePoolConfig(c);
            } catch (tunnelErr) {
                await dbUpdateConnection(id, { status: 'failed', lastTested: new Date().toISOString() });
                await syncConnectionsCache();
                return res.json({ success: false, error: `SSH tunnel error: ${tunnelErr.message}` });
            }

            const dbType = (c.dbType || 'postgresql').toLowerCase();

            // Mirror POST /api/connections + /api/connections/test: re-testing
            // an existing Phase-5 connection should also route through the
            // shared adapter factory, otherwise the user sees a misleading
            // "failed" status for every non-PG/MySQL/Mongo engine.
            const PHASE5_VIA_ADAPTER = new Set([
                'mssql',
                'sqlserver',
                'sql-server',
                'oracle',
                'oracledb',
                'snowflake',
                'bigquery',
                'gbq',
                'redshift',
                'cassandra',
                'scylla',
                'dynamodb',
                'dynamo',
                'redis',
                'elasticsearch',
                'opensearch',
                'elastic',
            ]);

            try {
                if (dbType === 'mongodb') {
                    // ── MongoDB test ──
                    if (!mongodb) throw new Error('MongoDB driver (mongodb) not installed on the server');
                    const userPart = poolCfg.user
                        ? `${encodeURIComponent(poolCfg.user)}:${encodeURIComponent(poolCfg.password || '')}@`
                        : '';
                    const sslParam = c.ssl ? '?tls=true&tlsAllowInvalidCertificates=true' : '';
                    const connStr = `mongodb://${userPart}${poolCfg.host}:${poolCfg.port || 27017}/${poolCfg.database || 'admin'}${sslParam}`;
                    const testClient = new mongodb.MongoClient(connStr, {
                        serverSelectionTimeoutMS: 8000,
                        connectTimeoutMS: 8000,
                    });
                    await testClient.connect();
                    await testClient.db(poolCfg.database || 'admin').command({ ping: 1 });
                    await testClient.close();
                } else if (dbType === 'mysql' || dbType === 'mariadb') {
                    // ── MySQL / MariaDB test ──
                    if (!mysql2) throw new Error('MySQL driver (mysql2) not installed on the server');
                    const testConn = await mysql2.createConnection({
                        host: poolCfg.host,
                        port: poolCfg.port,
                        database: poolCfg.database,
                        user: poolCfg.user,
                        password: poolCfg.password,
                        ssl: buildSslOption(c.ssl) || undefined,
                        connectTimeout: 8000,
                    });
                    await testConn.query('SELECT 1');
                    await testConn.end();
                } else if (PHASE5_VIA_ADAPTER.has(dbType)) {
                    // ── Phase-5 engines via adapter factory ──
                    const { getAdapter } = await import('../../services/dbAdapters/index.js');
                    const adapter = getAdapter(dbType, {
                        host: poolCfg.host,
                        port: poolCfg.port,
                        database: poolCfg.database,
                        user: poolCfg.user,
                        username: poolCfg.user,
                        password: poolCfg.password,
                        ssl: c.ssl,
                        // Per-engine aliases the adapters look for:
                        account: poolCfg.host, // Snowflake account
                        projectId: poolCfg.host, // BigQuery project
                        region: poolCfg.host, // DynamoDB region
                        keyspace: poolCfg.database, // Cassandra keyspace
                        contactPoints: poolCfg.host ? [poolCfg.host] : undefined,
                    });
                    await adapter.connect();
                    await adapter.disconnect?.().catch(() => undefined);
                } else {
                    // ── PostgreSQL test ──
                    // PRF-03 (audit): always end() the test pool, even on failure.
                    const testPool = new Pool({ ...poolCfg, connectionTimeoutMillis: 8000 });
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

                await dbUpdateConnection(id, { status: 'success', lastTested: new Date().toISOString() });
                await syncConnectionsCache();
                res.json({
                    success: true,
                    message: c.sshEnabled ? 'Connection successful via SSH tunnel' : 'Connection successful',
                });
            } catch (e) {
                await dbUpdateConnection(id, { status: 'failed', lastTested: new Date().toISOString() });
                await syncConnectionsCache();
                res.json({ success: false, error: e.message });
            }
        } catch (e) {
            log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
            res.json({});
        }
    });

    app.post('/api/connections/:id/switch', authenticate, async (req, res) => {
        try {
            const id = parseInt(req.params.id, 10);
            const conns = await dbLoadConnections(req.user.id, req.user.role);
            const c = conns.find((c) => c.id === id);
            if (!c) return res.status(404).json({ error: 'Connection not found' });

            try {
                const dbType = (c.dbType || 'postgresql').toLowerCase();
                if (dbType === 'mongodb') {
                    // Warm-up MongoDB client
                    const { db } = await getMongoClient(id, req.user.id);
                    await db.command({ ping: 1 });
                } else {
                    // Warm-up PG or MySQL pool
                    const p = await getPool(id, req.user.id);
                    if (dbType === 'mysql' || dbType === 'mariadb') {
                        const [rows] = await p.query('SELECT 1');
                    } else {
                        const client = await p.connect();
                        await client.query('SELECT 1');
                        client.release();
                    }
                }
            } catch (err) {
                return res.status(400).json({ success: false, error: `Cannot switch: ${err.message}` });
            }

            await dbSetDefault(req.user.id, req.user.role, id);
            setUserActiveConnectionId(req.user.id, id);
            cache.clear(); // Clear cache to ensure fresh data for this connection
            await syncConnectionsCache();
            log('INFO', `Active connection switched to ${id} (${c.name}) for user ${req.user.id}`);
            res.json({ success: true, message: `Switched to "${c.name}"`, connectionId: id });
        } catch (e) {
            log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
            res.json({});
        }
    });

    app.get('/api/connections/active', authenticate, async (req, res) => {
        try {
            const userActiveId = getUserActiveConnectionId(req.user.id);
            // Fast path: if we already know the user's active connection and it's in
            // the global cache, skip the DB query entirely (saves ~50-200ms per refresh)
            if (userActiveId) {
                const cached = getConnections().find((c) => c.id === userActiveId);
                if (cached) {
                    return res.json({ connectionId: cached.id, connection: sanitizeConn(cached) });
                }
            }
            // Slow path: query DB for the full list
            const conns = await dbLoadConnections(req.user.id, req.user.role);
            const active =
                conns.find((c) => c.id === userActiveId) || conns.find((c) => c.isDefault) || conns[0] || null;
            // If we resolved a default but the user hasn't explicitly set one, record it
            if (active && !userActiveId) setUserActiveConnectionId(req.user.id, active.id);

            // PERF: kick off a background warm-up so the next metrics call
            // finds a live socket. Skipped on Vercel (no long-lived process).
            if (active && process.env.VERCEL !== '1') {
                (async () => {
                    try {
                        const dbType = (active.dbType || 'postgresql').toLowerCase();
                        if (dbType === 'postgresql' || dbType === 'mysql' || dbType === 'mariadb') {
                            const pool = await getPool(active.id, req.user?.id);
                            if (pool && typeof pool.query === 'function') {
                                await pool.query('SELECT 1').catch(() => {});
                            }
                        }
                    } catch {
                        /* swallow — warm-up never blocks */
                    }
                })();
            }

            res.json({ connectionId: active?.id ?? null, connection: active ? sanitizeConn(active) : null });
        } catch (e) {
            log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
            res.json({});
        }
    });
}
