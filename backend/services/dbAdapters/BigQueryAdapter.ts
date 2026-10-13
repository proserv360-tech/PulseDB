// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * BigQueryAdapter.js
 *
 * Google BigQuery adapter using `@google-cloud/bigquery` as a peer dependency.
 *
 * Monitoring surface:
 *   • INFORMATION_SCHEMA.JOBS_BY_PROJECT — slow / recent queries.
 *   • INFORMATION_SCHEMA.TABLES — catalog + table size.
 *   • INFORMATION_SCHEMA.SCHEMATA — dataset list (maps to getDatabaseList).
 *
 * BigQuery has no tables/indexes/locks/replication in the traditional sense.
 * Those endpoints return structured "not applicable" shapes.
 */

import { BaseAdapter } from './BaseAdapter.js';

// Lazy driver load (was a top-level await — see MSSQLAdapter note).
let BigQuery: any;
let _BigQueryLoading: Promise<any> | null = null;
async function ensureDriver() {
    if (BigQuery !== undefined) return BigQuery;
    if (!_BigQueryLoading) {
        _BigQueryLoading = (async () => {
            try {
                const moduleId = '@google-cloud/bigquery';
                const mod = await import(moduleId);
                BigQuery = mod.BigQuery || mod.default?.BigQuery || mod.default;
            } catch {
                BigQuery = null;
            }
        })();
    }
    await _BigQueryLoading;
    return BigQuery;
}

export class BigQueryAdapter extends BaseAdapter {
    constructor(config) {
        super(config);
        this.dbType = 'bigquery';
        this.client = null;
    }

    getDriverName() {
        return '@google-cloud/bigquery';
    }

    _checkDriver() {
        if (!BigQuery) {
            throw new Error(
                'BigQuery driver (@google-cloud/bigquery) not installed. Install with: npm install @google-cloud/bigquery',
            );
        }
    }

    async connect() {
        await ensureDriver();
        this._checkDriver();
        const cfg = this.config || {};
        this.client = new BigQuery({
            projectId: cfg.projectId,
            keyFilename: cfg.keyFilename,
            credentials: cfg.credentials,
            location: cfg.location,
        });
        // Lightweight connectivity probe: list (up to) one dataset.
        await this.client.getDatasets({ maxResults: 1 });
        this.connected = true;
    }

    async disconnect() {
        this.client = null;
        this.connected = false;
    }

    async executeQuery(sql, params = []) {
        this._checkDriver();
        const [rows] = await this.client.query({
            query: sql,
            params: Array.isArray(params) ? undefined : params,
            // BigQuery positional params via `@param` → pass through if object.
            location: this.config?.location,
        });
        return { rows: rows || [] };
    }

    async getServerVersion() {
        // BigQuery is a managed service with no exposed version; report region + project.
        return {
            engine: 'bigquery',
            project: this.config?.projectId,
            location: this.config?.location || 'US',
            version: 'managed',
        };
    }

    async getDatabaseList() {
        const [datasets] = await this.client.getDatasets();
        return datasets.map((d) => ({ name: d.id, location: d.location }));
    }

    async getOverviewStats() {
        const { rows } = await this.executeQuery(
            `SELECT COUNT(*) AS jobs_1h, SUM(total_bytes_billed) AS bytes_billed_1h
               FROM \`region-${this.config?.location || 'us'}\`.INFORMATION_SCHEMA.JOBS_BY_PROJECT
              WHERE creation_time >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 HOUR)`,
        );
        return {
            jobs_1h: Number(rows[0]?.jobs_1h) || 0,
            bytes_billed_1h: Number(rows[0]?.bytes_billed_1h) || 0,
            engine: 'bigquery',
        };
    }

    async getPerformanceStats() {
        const { rows } = await this.executeQuery(
            `SELECT job_id, query, total_slot_ms, total_bytes_processed
               FROM \`region-${this.config?.location || 'us'}\`.INFORMATION_SCHEMA.JOBS_BY_PROJECT
              WHERE creation_time >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 HOUR)
                AND state = 'DONE'
              ORDER BY total_slot_ms DESC
              LIMIT 20`,
        );
        return {
            slow_queries: rows.map((r) => ({
                job_id: r.job_id,
                query: r.query,
                slot_ms: Number(r.total_slot_ms) || 0,
                bytes_processed: Number(r.total_bytes_processed) || 0,
            })),
        };
    }

    async getTableStats() {
        const [datasets] = await this.client.getDatasets({ maxResults: 10 });
        const all = [];
        for (const ds of datasets) {
            const [tables] = await ds.getTables({ maxResults: 50 });
            for (const t of tables) {
                const [meta] = await t.getMetadata();
                all.push({
                    schema: ds.id,
                    name: t.id,
                    rows: Number(meta.numRows) || 0,
                    bytes: Number(meta.numBytes) || 0,
                });
            }
        }
        return all;
    }

    // BigQuery "indexes" → clustering columns + partitioning column per table.
    // Surfaced under the Indexes tab so operators can audit partition skew
    // and clustering depth in the same UI they use for every other engine.
    async getIndexStats() {
        const region = this.config?.location || 'us';
        const { rows } = await this.executeQuery(
            `SELECT table_schema, table_name,
                    STRING_AGG(CASE WHEN is_partitioning_column = 'YES' THEN column_name END) AS partition_col,
                    STRING_AGG(CASE WHEN clustering_ordinal_position IS NOT NULL
                                    THEN CONCAT(column_name, ' (', CAST(clustering_ordinal_position AS STRING), ')')
                                    ELSE NULL END
                               ORDER BY clustering_ordinal_position) AS clustering_cols
               FROM \`region-${region}\`.INFORMATION_SCHEMA.COLUMNS
              WHERE is_partitioning_column = 'YES' OR clustering_ordinal_position IS NOT NULL
              GROUP BY table_schema, table_name`,
        ).catch(() => ({ rows: [] }));
        return rows.map((r) => ({
            schema: r.table_schema,
            table: r.table_name,
            partition_col: r.partition_col || null,
            clustering: r.clustering_cols ? r.clustering_cols.split(',').map((s) => s.trim()) : [],
            engine_native: 'bigquery',
        }));
    }

    // BigQuery is stateless REST — no "session". The actionable equivalent
    // is "currently-running jobs", which is what operators actually care
    // about when they open the Connections tab.
    async getActiveConnections() {
        const region = this.config?.location || 'us';
        const { rows } = await this.executeQuery(
            `SELECT job_id, user_email, creation_time, job_type,
                    TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), creation_time, SECOND) AS running_sec
               FROM \`region-${region}\`.INFORMATION_SCHEMA.JOBS_BY_PROJECT
              WHERE state IN ('PENDING', 'RUNNING')
                AND creation_time >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 HOUR)
              ORDER BY creation_time DESC
              LIMIT 100`,
        ).catch(() => ({ rows: [] }));
        return rows.map((r) => ({
            session: r.job_id, // treat job_id as the "session" key
            user: r.user_email,
            kind: r.job_type,
            started: r.creation_time,
            running_sec: Number(r.running_sec) || 0,
        }));
    }

    // BigQuery has no row locks. Actionable equivalent: jobs that were
    // delayed waiting on slot capacity (wait_ms > 0 in their stages).
    async getLockInfo() {
        const region = this.config?.location || 'us';
        const { rows } = await this.executeQuery(
            `SELECT job_id, user_email, total_slot_ms,
                    TIMESTAMP_DIFF(end_time, creation_time, MILLISECOND) AS total_ms,
                    TIMESTAMP_DIFF(start_time, creation_time, MILLISECOND) AS queue_ms
               FROM \`region-${region}\`.INFORMATION_SCHEMA.JOBS_BY_PROJECT
              WHERE creation_time >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 HOUR)
                AND TIMESTAMP_DIFF(start_time, creation_time, MILLISECOND) > 1000
              ORDER BY queue_ms DESC
              LIMIT 50`,
        ).catch(() => ({ rows: [] }));
        return {
            kind: 'slot_contention',
            locks: rows.map((r) => ({
                job_id: r.job_id,
                user: r.user_email,
                queue_ms: Number(r.queue_ms) || 0,
                total_ms: Number(r.total_ms) || 0,
            })),
            note: 'BigQuery is serverless — rows show jobs delayed by slot contention (queue_ms).',
        };
    }

    // Replication = dataset-location distribution + cross-region config.
    async getReplicationStatus() {
        const [datasets] = await this.client.getDatasets();
        const regions = new Map();
        for (const d of datasets) {
            const loc = d.location || 'unknown';
            regions.set(loc, (regions.get(loc) || 0) + 1);
        }
        return {
            kind: 'dataset_locations',
            replicas: [...regions.entries()].map(([location, datasets]) => ({ location, datasets })),
            note: 'BigQuery storage is multi-region-replicated by Google; row counts reflect dataset placement.',
        };
    }

    // Wait-event breakdown from job stage timing.
    async getWaitEvents() {
        const region = this.config?.location || 'us';
        const { rows } = await this.executeQuery(
            `SELECT
                 SUM(TIMESTAMP_DIFF(start_time, creation_time, MILLISECOND)) AS queue_ms,
                 SUM(TIMESTAMP_DIFF(end_time,   start_time,    MILLISECOND)) AS exec_ms,
                 SUM(total_slot_ms)                                          AS slot_ms,
                 SUM(total_bytes_processed)                                  AS bytes_processed,
                 SUM(total_bytes_billed)                                     AS bytes_billed
               FROM \`region-${region}\`.INFORMATION_SCHEMA.JOBS_BY_PROJECT
              WHERE creation_time >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 HOUR)
                AND state = 'DONE'`,
        ).catch(() => ({ rows: [{}] }));
        const r = rows[0] || {};
        return {
            window: '1h',
            events: [
                { event: 'queue', ms: Number(r.queue_ms) || 0 },
                { event: 'execute', ms: Number(r.exec_ms) || 0 },
                { event: 'slot_ms', ms: Number(r.slot_ms) || 0 },
            ],
            bytes_processed: Number(r.bytes_processed) || 0,
            bytes_billed: Number(r.bytes_billed) || 0,
        };
    }

    // "Bloat" equivalent: cold-tail tables that haven't been read or written
    // in N days — these accrue storage cost without active use.
    async getBloatInfo() {
        const region = this.config?.location || 'us';
        const { rows } = await this.executeQuery(
            `SELECT table_schema, table_name,
                    TIMESTAMP_MILLIS(last_modified_time) AS last_modified,
                    row_count, size_bytes,
                    TIMESTAMP_DIFF(CURRENT_TIMESTAMP(),
                                   TIMESTAMP_MILLIS(last_modified_time), DAY) AS days_cold
               FROM \`${this.config?.projectId}.${region}\`.__TABLES__
              ORDER BY days_cold DESC
              LIMIT 100`,
        ).catch(() => ({ rows: [] }));
        return rows.map((r) => ({
            schema: r.table_schema || 'default',
            table: r.table_name,
            rows: Number(r.row_count) || 0,
            bytes: Number(r.size_bytes) || 0,
            days_cold: Number(r.days_cold) || 0,
            last_modified: r.last_modified,
        }));
    }

    // Plan capture via dryRun — returns query statistics, total bytes
    // processed, referenced tables, and stages.
    async getPlanForQuery(sql) {
        try {
            const [job] = await this.client.createQueryJob({
                query: sql,
                dryRun: true,
                useQueryCache: false,
            });
            const meta = job.metadata.statistics?.query || {};
            return {
                engine: 'bigquery',
                total_bytes_processed: Number(meta.totalBytesProcessed) || 0,
                total_bytes_billed: Number(meta.totalBytesBilled) || 0,
                referenced_tables: (meta.referencedTables || []).map(
                    (t) => `${t.projectId}.${t.datasetId}.${t.tableId}`,
                ),
                statement_type: meta.statementType,
                schema: meta.schema,
            };
        } catch (err) {
            return { engine: 'bigquery', error: err.message };
        }
    }

    async getKeyMetrics() {
        return {
            engine: 'bigquery',
            jobs_1h: (await this.getOverviewStats()).jobs_1h,
        };
    }

    /**
     * BigQuery is a serverless columnar warehouse: no user-managed btree
     * indexes, no VACUUM/WAL, no OLTP locks. It exposes detailed query
     * stage plans and a rich job history via INFORMATION_SCHEMA.JOBS, plus
     * native partitioning and clustering.
     */
    getCapabilities() {
        return {
            ...super.getCapabilities(),
            replication: false,
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

export default BigQueryAdapter;
