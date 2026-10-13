// @ts-nocheck — TODO type this module (added 2026-07; see docs/TS_MIGRATION.md)
/**
 * services/storageAdvisorService.ts
 * ─────────────────────────────────
 * Engine-agnostic "reclaimable storage" advisor. Mirrors waitEventsService:
 * one entry point, capability decides whether real data comes back.
 *
 * The Postgres side of this theme is already covered by vacuumForecastService
 * (dead tuples → autovacuum ETA). This module adds the MySQL/InnoDB analogue:
 * InnoDB never returns freed pages to the filesystem until the table is
 * rebuilt, so `information_schema.tables.data_free` is the reclaimable-space
 * signal and `OPTIMIZE TABLE` (or `ALTER TABLE … ENGINE=InnoDB`) is the fix.
 *
 *   fetchStorageAdvisor(adapter)   → { supported, engine, summary, tables, note? }
 *   analyzeFragmentation(rows,opts) → pure; exported for tests
 */

const MB = 1024 * 1024;

// Engines that reclaim storage automatically. Returned as supported:false but
// managed:true so the UI shows a reassuring note instead of an error/empty state.
const MANAGED_NOTES = {
    snowflake:
        'Snowflake manages micro-partition storage automatically (background reclustering; Time Travel / Fail-safe expiry) — no manual reclaim needed.',
    bigquery:
        'BigQuery storage is fully managed and columnar — deleted and expired data is reclaimed automatically; no manual action.',
    dynamodb: 'DynamoDB is fully managed — storage scales and reclaims automatically; there is no manual compaction.',
    cassandra:
        'Cassandra reclaims space through compaction, which runs automatically. Use nodetool compact only for a one-off major compaction.',
    redis: 'Redis is in-memory — space is governed by the eviction policy and optional active defragmentation, not per-table reclaim.',
    elasticsearch:
        'Elasticsearch reclaims deleted-document space during background segment merges; force-merge only read-only indices.',
};

/**
 * Pure fragmentation analysis over normalized rows:
 *   { schema, name, dataFreeBytes, dataLengthBytes, indexLengthBytes, rowEstimate }
 *
 * Fragmentation ratio = data_free / (data_length + index_length + data_free):
 * the share of the on-disk footprint that is reclaimable free space.
 *
 * Urgency (tunable):
 *   high   — fragPct ≥ highFragPct AND reclaimMb ≥ minReclaimMb
 *   medium — fragPct ≥ minFragPct  AND reclaimMb ≥ minReclaimMb/2
 *   low    — anything else still holding ≥ floorReclaimMb of free space
 * Rows below the floor are dropped as noise.
 */
export function analyzeFragmentation(rows = [], opts = {}) {
    const minReclaimMb = Number(opts.minReclaimMb ?? 100);
    const minFragPct = Number(opts.minFragPct ?? 20);
    const highFragPct = Number(opts.highFragPct ?? 30);
    const floorReclaimMb = Number(opts.floorReclaimMb ?? 10);
    const recommend =
        typeof opts.recommend === 'function'
            ? opts.recommend
            : (s, n) => (s && n ? `OPTIMIZE TABLE \`${s}\`.\`${n}\`` : 'OPTIMIZE TABLE');

    const RANK = { high: 0, medium: 1, low: 2 };
    const out = [];

    for (const r of rows || []) {
        const dataFree = Math.max(0, Number(r.dataFreeBytes) || 0);
        const dataLen = Math.max(0, Number(r.dataLengthBytes) || 0);
        const idxLen = Math.max(0, Number(r.indexLengthBytes) || 0);
        const footprint = dataLen + idxLen + dataFree;
        if (footprint <= 0) continue;

        const reclaimMb = dataFree / MB;
        if (reclaimMb < floorReclaimMb) continue;

        const fragPct = (dataFree / footprint) * 100;

        let urgency = 'low';
        if (fragPct >= highFragPct && reclaimMb >= minReclaimMb) urgency = 'high';
        else if (fragPct >= minFragPct && reclaimMb >= minReclaimMb / 2) urgency = 'medium';

        const schema = r.schema ?? null;
        const name = r.name ?? null;
        out.push({
            schema,
            table: name,
            rowEstimate: Number(r.rowEstimate) || 0,
            totalSizeBytes: dataLen + idxLen,
            reclaimableBytes: dataFree,
            reclaimableMb: Math.round(reclaimMb * 10) / 10,
            fragmentationPct: Math.round(fragPct * 10) / 10,
            urgency,
            recommendation: recommend(schema, name),
        });
    }

    out.sort((a, b) => {
        const u = RANK[a.urgency] - RANK[b.urgency];
        return u !== 0 ? u : b.reclaimableBytes - a.reclaimableBytes;
    });

    const summary = { high: 0, medium: 0, low: 0, reclaimableMb: 0 };
    for (const t of out) {
        summary[t.urgency] += 1;
        summary.reclaimableMb += t.reclaimableMb;
    }
    summary.reclaimableMb = Math.round(summary.reclaimableMb * 10) / 10;

    return { summary, tables: out };
}

/**
 * Engine-agnostic entry point. Only MySQL/MariaDB expose the data_free signal
 * today; every other engine returns supported:false so the FE shows a
 * "not applicable for this engine" affordance instead of an error.
 */
export async function fetchStorageAdvisor(adapter, opts = {}) {
    const engine = (adapter && (adapter.engine || adapter.dbType || adapter.type)) || 'unknown';
    const isMysql = /mysql|maria/i.test(String(engine));
    const isMongo = /mongo/i.test(String(engine));
    const isMssql = /mssql|sqlserver|sql server/i.test(String(engine));
    const isOracle = /oracle/i.test(String(engine));
    const isRedshift = /redshift/i.test(String(engine));

    if (
        (!isMysql && !isMongo && !isMssql && !isOracle && !isRedshift) ||
        typeof adapter.getFragmentation !== 'function'
    ) {
        const managed = MANAGED_NOTES[String(engine).toLowerCase()];
        return {
            supported: false,
            engine,
            managed: Boolean(managed),
            summary: { high: 0, medium: 0, low: 0, reclaimableMb: 0 },
            tables: [],
            note:
                managed ||
                'Reclaimable-storage analysis is available for MySQL/MariaDB (InnoDB data_free), MongoDB (WiredTiger freeStorageSize), SQL Server (reserved vs used pages), Oracle (segment allocation vs estimated data), and Redshift (unsorted region). For PostgreSQL use the VACUUM forecast.',
        };
    }

    // Engine-specific reclaim command: MySQL rebuilds with OPTIMIZE TABLE;
    // MongoDB reclaims WiredTiger free blocks with compact.
    const recommend = isMongo
        ? (s, n) => `db.getSiblingDB('${s}').runCommand({ compact: '${n}' })`
        : isMssql
          ? (s, n) => (s && n ? `ALTER INDEX ALL ON [${s}].[${n}] REBUILD` : 'ALTER INDEX ALL ... REBUILD')
          : isOracle
            ? (s, n) => (s && n ? `ALTER TABLE "${s}"."${n}" SHRINK SPACE` : 'ALTER TABLE ... SHRINK SPACE')
            : isRedshift
              ? (s, n) => (s && n ? `VACUUM "${s}"."${n}"` : 'VACUUM')
              : (s, n) => (s && n ? `OPTIMIZE TABLE \`${s}\`.\`${n}\`` : 'OPTIMIZE TABLE');

    const rows = await adapter.getFragmentation();
    const result = analyzeFragmentation(rows, { ...opts, recommend });
    return { supported: true, engine, ...result };
}
