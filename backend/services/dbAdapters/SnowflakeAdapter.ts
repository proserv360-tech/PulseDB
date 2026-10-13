// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * SnowflakeAdapter.js
 *
 * Snowflake warehouse adapter. Uses the official `snowflake-sdk` as a peer
 * dependency so the file loads even on hosts that do not need Snowflake.
 *
 * Monitoring surface:
 *   • QUERY_HISTORY table function for slow-query sampling
 *   • WAREHOUSE_LOAD_HISTORY for utilization
 *   • SHOW TABLES / SHOW DATABASES for catalog
 *
 * Concepts that do not map (indexes, locks, replication) return structured
 * "not applicable" shapes so the frontend can branch cleanly.
 */

import { BaseAdapter } from './BaseAdapter.js';

// Lazy driver load (was a top-level await — see MSSQLAdapter note).
let snowflake: any;
let _snowflakeLoading: Promise<any> | null = null;
async function ensureDriver() {
    if (snowflake !== undefined) return snowflake;
    if (!_snowflakeLoading) {
        _snowflakeLoading = (async () => {
            try {
                const moduleId = 'snowflake-sdk';
                snowflake = (await import(moduleId)).default || (await import(moduleId));
            } catch {
                snowflake = null;
            }
        })();
    }
    await _snowflakeLoading;
    return snowflake;
}

export class SnowflakeAdapter extends BaseAdapter {
    constructor(config) {
        super(config);
        this.dbType = 'snowflake';
        this.connection = null;
    }

    getDriverName() {
        return 'snowflake-sdk';
    }

    _checkDriver() {
        if (!snowflake) {
            throw new Error('Snowflake driver (snowflake-sdk) not installed. Install with: npm install snowflake-sdk');
        }
    }

    async connect() {
        await ensureDriver();
        this._checkDriver();
        const cfg = this.config || {};
        this.connection = snowflake.createConnection({
            account: cfg.account,
            username: cfg.username,
            password: cfg.password,
            warehouse: cfg.warehouse,
            database: cfg.database,
            schema: cfg.schema || 'PUBLIC',
            role: cfg.role,
            authenticator: cfg.authenticator || 'SNOWFLAKE',
        });
        await new Promise((resolve, reject) => {
            this.connection.connect((err) => (err ? reject(err) : resolve()));
        });
        this.connected = true;
    }

    async disconnect() {
        if (!this.connection) return;
        await new Promise((resolve) => this.connection.destroy(() => resolve()));
        this.connected = false;
    }

    async executeQuery(sql, binds = []) {
        this._checkDriver();
        return new Promise((resolve, reject) => {
            this.connection.execute({
                sqlText: sql,
                binds,
                complete: (err, _stmt, rows) => (err ? reject(err) : resolve({ rows: rows || [] })),
            });
        });
    }

    async getServerVersion() {
        const { rows } = await this.executeQuery('SELECT CURRENT_VERSION() AS version');
        return { version: rows[0]?.VERSION || 'unknown', engine: 'snowflake' };
    }

    async getDatabaseList() {
        const { rows } = await this.executeQuery('SHOW DATABASES');
        return rows.map((r) => ({ name: r.name || r.NAME, created: r.created_on || r.CREATED_ON }));
    }

    async getSchemas() {
        const { rows } = await this.executeQuery(
            `SELECT schema_name AS name,
                    (SELECT COUNT(*) FROM information_schema.tables t
                      WHERE t.table_schema = s.schema_name AND t.table_type = 'BASE TABLE') AS table_count
               FROM information_schema.schemata s
              WHERE schema_name NOT IN ('INFORMATION_SCHEMA')
              ORDER BY schema_name`,
        );
        return rows.map((r) => ({
            name: r.NAME || r.name,
            tableCount: Number(r.TABLE_COUNT ?? r.table_count) || 0,
        }));
    }

    async useSchema(schema) {
        if (!schema) return false;
        // Quote to preserve case; Snowflake folds unquoted identifiers to upper.
        await this.executeQuery(`USE SCHEMA "${String(schema).replace(/"/g, '')}"`);
        return true;
    }

    async getOverviewStats() {
        const { rows } = await this.executeQuery(
            `SELECT COUNT(*) AS query_count_1h
               FROM TABLE(INFORMATION_SCHEMA.QUERY_HISTORY(
                   DATEADD('hour', -1, CURRENT_TIMESTAMP()), CURRENT_TIMESTAMP()))`,
        );
        return {
            queries_1h: Number(rows[0]?.QUERY_COUNT_1H) || 0,
            warehouses: null, // populate from SHOW WAREHOUSES when needed
            engine: 'snowflake',
        };
    }

    async getPerformanceStats() {
        // Pull slow queries from the last hour.
        const { rows } = await this.executeQuery(
            `SELECT query_id, query_text, total_elapsed_time, warehouse_name
               FROM TABLE(INFORMATION_SCHEMA.QUERY_HISTORY(
                   DATEADD('hour', -1, CURRENT_TIMESTAMP()), CURRENT_TIMESTAMP()))
              ORDER BY total_elapsed_time DESC
              LIMIT 20`,
        );
        return {
            slow_queries: rows.map((r) => ({
                query_id: r.QUERY_ID,
                query: r.QUERY_TEXT,
                elapsed_ms: Number(r.TOTAL_ELAPSED_TIME) || 0,
                warehouse: r.WAREHOUSE_NAME,
            })),
        };
    }

    async getTableStats() {
        const { rows } = await this.executeQuery(
            `SELECT table_schema, table_name, row_count, bytes
               FROM INFORMATION_SCHEMA.TABLES
              WHERE table_type = 'BASE TABLE'
              ORDER BY bytes DESC NULLS LAST
              LIMIT 200`,
        );
        return rows.map((r) => ({
            schema: r.TABLE_SCHEMA,
            name: r.TABLE_NAME,
            rows: Number(r.ROW_COUNT) || 0,
            bytes: Number(r.BYTES) || 0,
        }));
    }

    // Snowflake has no traditional B-tree indexes. Its performance features
    // are clustering keys + search optimization — we surface both under the
    // "indexes" UI panel so operators can audit them in the same place.
    async getIndexStats() {
        const { rows } = await this.executeQuery(
            `SELECT table_schema, table_name, clustering_key, auto_clustering_on,
                    search_optimization, row_count
               FROM INFORMATION_SCHEMA.TABLES
              WHERE clustering_key IS NOT NULL
                 OR search_optimization = 'ON'
              ORDER BY row_count DESC NULLS LAST
              LIMIT 200`,
        ).catch(() => ({ rows: [] }));
        return rows.map((r) => ({
            schema: r.TABLE_SCHEMA,
            table: r.TABLE_NAME,
            kind: r.CLUSTERING_KEY ? 'clustering_key' : 'search_optimization',
            definition: r.CLUSTERING_KEY || 'SEARCH OPTIMIZATION',
            auto_enabled: r.AUTO_CLUSTERING_ON === 'true' || r.AUTO_CLUSTERING_ON === true,
            engine_native: 'snowflake',
        }));
    }

    async getActiveConnections() {
        const { rows } = await this.executeQuery(
            `SELECT session_id, user_name, client_application, login_time
               FROM TABLE(INFORMATION_SCHEMA.LOGIN_HISTORY(
                   DATEADD('hour', -1, CURRENT_TIMESTAMP()), CURRENT_TIMESTAMP()))
              ORDER BY login_time DESC
              LIMIT 50`,
        );
        return rows.map((r) => ({
            session: String(r.SESSION_ID),
            user: r.USER_NAME,
            client: r.CLIENT_APPLICATION,
            started: r.LOGIN_TIME,
        }));
    }

    // Snowflake has no locks in the traditional sense. We surface the
    // actionable equivalent: queries that are currently BLOCKED waiting
    // on warehouse resources or transactional concurrency.
    async getLockInfo() {
        const { rows } = await this.executeQuery(
            `SELECT query_id, user_name, warehouse_name, execution_status,
                    queued_overload_time, queued_provisioning_time,
                    queued_repair_time, transaction_blocked_time,
                    LEFT(query_text, 500) AS query_preview
               FROM TABLE(INFORMATION_SCHEMA.QUERY_HISTORY(
                   DATEADD('hour', -1, CURRENT_TIMESTAMP()), CURRENT_TIMESTAMP()))
              WHERE (transaction_blocked_time > 0 OR queued_overload_time > 1000)
              ORDER BY transaction_blocked_time DESC, queued_overload_time DESC
              LIMIT 50`,
        ).catch(() => ({ rows: [] }));
        return {
            kind: 'concurrency_blockers',
            locks: rows.map((r) => ({
                query_id: r.QUERY_ID,
                user: r.USER_NAME,
                warehouse: r.WAREHOUSE_NAME,
                status: r.EXECUTION_STATUS,
                blocked_ms: Number(r.TRANSACTION_BLOCKED_TIME) || 0,
                queued_ms: Number(r.QUEUED_OVERLOAD_TIME) || 0,
                query: r.QUERY_PREVIEW,
            })),
            note: 'Snowflake surfaces lock-equivalent signals via TRANSACTION_BLOCKED_TIME + QUEUED_OVERLOAD_TIME instead of row locks.',
        };
    }

    async getReplicationStatus() {
        const groups = await this.executeQuery('SHOW REPLICATION DATABASES').catch(() => ({ rows: [] }));
        return {
            kind: 'replication_databases',
            replicas: groups.rows.map((r) => ({
                name: r.name || r.NAME,
                primary_account: r.primary || r.PRIMARY,
                replication_allowed_to: r.replication_allowed_to_accounts || r.REPLICATION_ALLOWED_TO_ACCOUNTS,
                is_primary: (r.is_primary ?? r.IS_PRIMARY) === 'true',
                refresh_schedule: r.refresh_schedule || r.REFRESH_SCHEDULE,
            })),
            note: 'Rows reflect SHOW REPLICATION DATABASES; empty list means no replicated DBs configured.',
        };
    }

    // Wait-event analysis: Snowflake reports four queue buckets + compile +
    // execute time. We unpivot them so the UI can render a wait-bucket chart.
    async getWaitEvents() {
        const { rows } = await this.executeQuery(
            `SELECT
                 SUM(queued_overload_time)     AS queue_overload_ms,
                 SUM(queued_provisioning_time) AS queue_provisioning_ms,
                 SUM(queued_repair_time)       AS queue_repair_ms,
                 SUM(compilation_time)         AS compile_ms,
                 SUM(execution_time)           AS execute_ms,
                 SUM(transaction_blocked_time) AS tx_block_ms
               FROM TABLE(INFORMATION_SCHEMA.QUERY_HISTORY(
                   DATEADD('hour', -1, CURRENT_TIMESTAMP()), CURRENT_TIMESTAMP()))
              WHERE execution_status = 'SUCCESS'`,
        ).catch(() => ({ rows: [{}] }));
        const r = rows[0] || {};
        return {
            window: '1h',
            events: [
                { event: 'queue_overload', ms: Number(r.QUEUE_OVERLOAD_MS) || 0 },
                { event: 'queue_provisioning', ms: Number(r.QUEUE_PROVISIONING_MS) || 0 },
                { event: 'queue_repair', ms: Number(r.QUEUE_REPAIR_MS) || 0 },
                { event: 'compile', ms: Number(r.COMPILE_MS) || 0 },
                { event: 'execute', ms: Number(r.EXECUTE_MS) || 0 },
                { event: 'tx_blocked', ms: Number(r.TX_BLOCK_MS) || 0 },
            ],
        };
    }

    // "Bloat" equivalent: stale micro-partitions — Snowflake auto-manages
    // storage, but tables with high inactive byte ratios indicate the
    // clustering depth is drifting and a CLUSTER BY re-evaluation is useful.
    async getBloatInfo() {
        const { rows } = await this.executeQuery(
            `SELECT table_schema, table_name, active_bytes, time_travel_bytes,
                    failsafe_bytes, retained_for_clone_bytes,
                    CASE WHEN active_bytes = 0 THEN 0
                         ELSE ROUND(100.0 * (time_travel_bytes + failsafe_bytes) / active_bytes, 2)
                    END AS overhead_pct
               FROM INFORMATION_SCHEMA.TABLE_STORAGE_METRICS
              ORDER BY overhead_pct DESC NULLS LAST
              LIMIT 100`,
        ).catch(() => ({ rows: [] }));
        return rows.map((r) => ({
            schema: r.TABLE_SCHEMA,
            table: r.TABLE_NAME,
            active_bytes: Number(r.ACTIVE_BYTES) || 0,
            time_travel: Number(r.TIME_TRAVEL_BYTES) || 0,
            failsafe: Number(r.FAILSAFE_BYTES) || 0,
            overhead_pct: Number(r.OVERHEAD_PCT) || 0,
        }));
    }

    // Plan capture — Snowflake's SYSTEM$EXPLAIN returns a JSON plan given a
    // query_id. For pre-execution plans, EXPLAIN works natively.
    async getPlanForQuery(sqlOrQueryId) {
        const isQueryId = /^[a-f0-9-]{30,}$/i.test(String(sqlOrQueryId));
        const { rows } = isQueryId
            ? await this.executeQuery(`SELECT SYSTEM$EXPLAIN_JSON(GET_QUERY_OPERATOR_STATS(?)) AS plan`, [
                  sqlOrQueryId,
              ]).catch(() => ({ rows: [] }))
            : await this.executeQuery(`EXPLAIN USING JSON ${sqlOrQueryId}`).catch(() => ({ rows: [] }));
        return { engine: 'snowflake', plan: rows[0]?.PLAN || rows[0]?.['EXPLAIN USING JSON'] || null };
    }

    async getKeyMetrics() {
        const { rows } = await this.executeQuery(
            `SELECT warehouse_name, SUM(credits_used) AS credits_1h
               FROM TABLE(INFORMATION_SCHEMA.WAREHOUSE_METERING_HISTORY(
                   DATEADD('hour', -1, CURRENT_TIMESTAMP()), CURRENT_TIMESTAMP()))
              GROUP BY warehouse_name`,
        );
        return {
            credits_1h_by_warehouse: rows.map((r) => ({
                warehouse: r.WAREHOUSE_NAME,
                credits: Number(r.CREDITS_1H) || 0,
            })),
            engine: 'snowflake',
        };
    }

    /**
     * Snowflake is a columnar cloud warehouse with micro-partitions and
     * automatic clustering: no user-managed indexes, VACUUM, WAL, or
     * row-level locks. Deep query history via ACCOUNT_USAGE; EXPLAIN/plans
     * supported. Time-travel storage overhead surfaces in getBloatInfo.
     */
    getCapabilities() {
        return {
            ...super.getCapabilities(),
            replication: true,
            schemas: true,
            partitioning: true,
            sharding: false,
            vacuum: false,
            wal: false,
            queryPlan: true,
            explain: true,
            indexes: false,
            locks: false,
            waitEvents: true,
            queryHistory: true,
            slowQueryLog: true,
            storedProcedures: true,
            triggers: false,
            backup: true,
            restore: true,
        };
    }
}

export default SnowflakeAdapter;
