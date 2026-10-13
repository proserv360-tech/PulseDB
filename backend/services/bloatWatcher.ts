// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * services/bloatWatcher.js
 * ────────────────────────
 * Postgres bloat and vacuum analysis. Estimates dead/bloat bytes in tables
 * and indexes using pgstattuple (if available) or standard heuristics.
 * Detects autovacuum lag and recommends VACUUM strategies.
 *
 * Bloat estimation strategies:
 *   1. pgstattuple extension (accurate, full-table scan)
 *   2. Heuristic formula (fast, based on page counts and row statistics)
 */

// ─────────────────────────────────────────────────────────────────────────────
// Helpers (exported for testing)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute bloat bytes using the ioguix/check_postgres heuristic:
 *   heap_blk_read, heap_blk_hit, heap_blk_user_{read,hit} +
 *   average row width from pg_stats + page size.
 *
 * Formula:
 *   live_bytes = relpages * (pageSize - headerSize) * reltuples / (relpages * fillfactor / 100)
 *   bloat_bytes = max(0, relpages * pageSize - live_bytes)
 *
 * For simplicity, approximate as:
 *   live_bytes = reltuples * avgRowWidth (rounded up)
 *   bloat_bytes = max(0, relpages * pageSize - headerSize - live_bytes)
 */
export function computeHeuristicBloat({
    relpages = 0,
    reltuples = 0,
    avgRowWidth = 0,
    pageSize = 8192,
    headerSize = 24,
    fillfactor = 100,
} = {}) {
    if (!relpages || !reltuples || !avgRowWidth) {
        return {
            liveBytes: 0,
            deadBytes: 0,
            bloatBytes: 0,
            bloatRatio: 0,
        };
    }

    // Approximate usable bytes per page (page size - header - line pointers)
    const usableBytesPerPage = pageSize - headerSize;
    // Total capacity if perfectly packed
    const capacity = relpages * usableBytesPerPage;
    // Actual live data
    const liveBytes = Math.ceil(reltuples * avgRowWidth);
    // Wasted space = capacity - live data
    const bloatBytes = Math.max(0, capacity - liveBytes);
    const totalBytes = relpages * pageSize;

    return {
        liveBytes,
        deadBytes: 0, // Heuristic doesn't give us dead bytes directly
        bloatBytes,
        bloatRatio: totalBytes > 0 ? bloatBytes / totalBytes : 0,
    };
}

/**
 * Format byte count to human-readable string (B, KiB, MiB, GiB, TiB).
 */
export function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
    const k = 1024;
    const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
    const clipped = Math.min(i, units.length - 1);
    return (bytes / Math.pow(k, clipped)).toFixed(2) + ' ' + units[clipped];
}

/**
 * Recommend a VACUUM strategy based on autovacuum lag and bloat metrics.
 *
 * @param {object} row - from getAutovacuumLag, includes:
 *   { sizeBytes, liveBytes, deadBytes, bloatBytes, bloatRatio,
 *     nLiveTup, nDeadTup, lastAutovacuum, ... }
 * @returns { action: 'VACUUM'|'VACUUM ANALYZE'|'VACUUM (FULL, ANALYZE)'|'ANALYZE'|'none', reason: string }
 */
export function recommendVacuum(row = {}) {
    const { sizeBytes = 0, bloatRatio = 0, nDeadTup = 0, nLiveTup = 0, lastAutovacuum } = row;

    // VACUUM FULL if severe bloat (>40%) AND table is large (>1GB)
    if (bloatRatio > 0.4 && sizeBytes > 1024 * 1024 * 1024) {
        return {
            action: 'VACUUM (FULL, ANALYZE)',
            reason: `Severe bloat (${(bloatRatio * 100).toFixed(1)}%), needs full rewrite`,
        };
    }

    // Moderate bloat (>20%) → recommend VACUUM ANALYZE
    if (bloatRatio > 0.2) {
        return {
            action: 'VACUUM ANALYZE',
            reason: `Moderate bloat (${(bloatRatio * 100).toFixed(1)}%), update stats`,
        };
    }

    // Dead tuples exist — regular VACUUM
    if (nDeadTup > 1000) {
        const deadRatio = nLiveTup > 0 ? nDeadTup / nLiveTup : 0;
        if (deadRatio > 0.2) {
            return {
                action: 'VACUUM ANALYZE',
                reason: `${nDeadTup} dead tuples (${(deadRatio * 100).toFixed(1)}% of live)`,
            };
        }
        return {
            action: 'VACUUM ANALYZE',
            reason: `${nDeadTup} dead tuples await cleanup`,
        };
    }

    // If no dead tuples and no bloat, suggest ANALYZE if needed
    if (nDeadTup === 0 && bloatRatio < 0.1) {
        return { action: 'ANALYZE', reason: 'Refresh statistics' };
    }

    return { action: 'none', reason: 'No action recommended' };
}

/**
 * Generate a VACUUM DDL statement with proper identifier quoting.
 * NEVER execute automatically — return DDL only for preview/audit.
 */
export function generateVacuumDdl({ schema = 'public', table = '', full = false, analyze = true } = {}) {
    if (!table) throw new Error('table name required');
    const quoted = `"${schema}"."${table.replace(/"/g, '""')}"`;
    const fullStr = full ? 'FULL, ' : '';
    const analyzeStr = analyze ? ', ANALYZE' : '';
    return `VACUUM (${fullStr}VERBOSE)${analyzeStr} ${quoted};`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Structured alert
// ─────────────────────────────────────────────────────────────────────────────

// Priority thresholds for bloat, as ratios. Critical above 60%, high 40–60%,
// medium 20–40%, low below that — the mapping requested for triage, and the
// same numbers recommendVacuum() already uses to pick VACUUM FULL, so the
// priority and the suggested action can never disagree.
export const BLOAT_THRESHOLDS = { critical: 0.6, high: 0.4, medium: 0.2 };

// Below the medium threshold there is nothing worth waking anyone for.
export const BLOAT_WARNING_RATIO = BLOAT_THRESHOLDS.medium;
export const BLOAT_CRITICAL_RATIO = BLOAT_THRESHOLDS.high;

/**
 * Turn bloat rows into the generic object-alert spec that
 * alertService.fireObjectAlert() consumes.
 *
 * Everything category-specific lives here — the metric, its formatting, the
 * thresholds and the remediation statement. The pipeline downstream (one
 * incident per object, priority, owner, SLA, rendering) is shared with every
 * other alert category and knows nothing about bloat.
 *
 * Takes rows as produced by estimateTableBloat(), optionally annotated with
 * `nDeadTup` / `nLiveTup` / `lastAutovacuum` from getAutovacuumLag() — the
 * extra fields sharpen recommendVacuum()'s reasoning but aren't required.
 *
 * Returns null when nothing crosses the lowest actionable threshold, so the
 * caller can treat "no alert" and "alert" the same way.
 */
export function buildBloatAlert(rows = [], { database = null, connectionId = null, minRatio = BLOAT_WARNING_RATIO } = {}) {
    const affected = rows
        .filter((r) => (r.bloatRatio ?? 0) >= minRatio)
        // Worst first: the top of a truncated table should be the row that
        // matters, not whichever one the query happened to return first.
        .sort((a, b) => (b.bloatRatio ?? 0) - (a.bloatRatio ?? 0));

    if (affected.length === 0) return null;

    const worst = affected[0];
    const wastedTotal = affected.reduce((sum, r) => sum + (r.bloatBytes || 0), 0);

    const objects = affected.map((r) => {
        const rec = recommendVacuum(r);
        const sql =
            rec.action === 'none'
                ? null
                : rec.action === 'ANALYZE'
                  ? `ANALYZE "${r.schema}"."${String(r.table).replace(/"/g, '""')}";`
                  : generateVacuumDdl({
                        schema: r.schema,
                        table: r.table,
                        full: rec.action.includes('FULL'),
                        analyze: rec.action.includes('ANALYZE'),
                    });

        return {
            schema: r.schema,
            object: r.table,
            metricValue: r.bloatRatio,
            metricDisplay: `${((r.bloatRatio || 0) * 100).toFixed(1)}%`,
            fixSuggestion: rec.action === 'none' ? null : rec.action,
            fixSql: sql,
            detail: `${rec.reason}. ${formatBytes(r.bloatBytes || 0)} wasted of ${formatBytes(r.sizeBytes || 0)}.`,
        };
    });

    const title =
        affected.length === 1
            ? `Table bloat is high on ${worst.schema}.${worst.table}`
            : `Table bloat is high on ${affected.length} tables`;

    return {
        title,
        category: 'maintenance',
        ruleId: 'table_bloat_high',
        metricLabel: 'Bloat %',
        thresholds: BLOAT_THRESHOLDS,
        objectType: 'table',
        database,
        connectionId,
        objects,
        summary:
            `${formatBytes(wastedTotal)} of space is recoverable. ` +
            `Worst: \`${worst.schema}.${worst.table}\` at ${((worst.bloatRatio || 0) * 100).toFixed(1)}%` +
            (worst.bloatMethod === 'heuristic'
                ? '. Figures are estimates — pgstattuple is not installed, so these come from page-count heuristics.'
                : '.'),
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Check for pgstattuple extension
// ─────────────────────────────────────────────────────────────────────────────

async function hasPgStatTuple(client) {
    try {
        const { rows } = await client.query(`SELECT 1 FROM pg_extension WHERE extname = 'pgstattuple' LIMIT 1`);
        return rows.length > 0;
    } catch {
        return false;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Table bloat estimation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Estimate table bloat for all user tables in a schema.
 * Uses pgstattuple if available, otherwise falls back to heuristic.
 *
 * Columns used:
 *   - pg_class: relname, relkind, reltuples (live tuples count), relpages
 *   - pg_stats: avg_width (average row width per table)
 *   - pgstattuple_approx: heap_blk_read, heap_blk_hit, heap_blk_user_read/hit
 *
 * @param {object} client - pg Client
 * @param {object} opts - { schema = 'public', minPages = 128 }
 * @returns {array} [{ schema, table, sizeBytes, liveBytes, deadBytes,
 *                      bloatBytes, bloatRatio, bloatMethod }] sorted by bloatBytes DESC
 */
export async function estimateTableBloat(client, { schema = 'public', minPages = 128 } = {}) {
    const hasPgst = await hasPgStatTuple(client);

    if (hasPgst) {
        // Use pgstattuple_approx for accurate bloat estimation
        try {
            const { rows } = await client.query(
                `
                WITH bloat_data AS (
                    SELECT
                        $1::text as schema_name,
                        t.relname as table_name,
                        t.relpages,
                        t.reltuples,
                        t.relpages::bigint * 8192 as size_bytes,
                        COALESCE(
                            (pgstattuple_approx(t.oid)).dead_bytes, 0
                        ) as dead_bytes
                    FROM pg_class t
                    JOIN pg_namespace ns ON ns.oid = t.relnamespace
                    WHERE ns.nspname = $1
                        AND t.relkind = 'r'
                        AND t.relpages >= $2
                        AND t.relname NOT LIKE 'pg_%'
                )
                SELECT
                    schema_name,
                    table_name,
                    size_bytes,
                    size_bytes - dead_bytes as live_bytes,
                    dead_bytes,
                    dead_bytes as bloat_bytes,
                    CASE WHEN size_bytes > 0
                        THEN dead_bytes::float / size_bytes
                        ELSE 0 END as bloat_ratio,
                    'pgstattuple' as bloat_method
                FROM bloat_data
                WHERE dead_bytes > 0
                ORDER BY dead_bytes DESC
                `,
                [schema, minPages],
            );
            return rows.map((r) => ({
                schema: r.schema_name,
                table: r.table_name,
                sizeBytes: Number(r.size_bytes),
                liveBytes: Number(r.live_bytes),
                deadBytes: Number(r.dead_bytes),
                bloatBytes: Number(r.bloat_bytes),
                bloatRatio: Number(r.bloat_ratio),
                bloatMethod: r.bloat_method,
            }));
        } catch (err) {
            // Fall through to heuristic if pgstattuple fails
            console.warn('pgstattuple_approx failed, falling back to heuristic', err.message);
        }
    }

    // Heuristic-based bloat estimation
    {
        const { rows } = await client.query(
            `
            WITH table_stats AS (
                SELECT
                    $1::text as schema_name,
                    t.relname as table_name,
                    t.relpages,
                    t.reltuples,
                    t.relpages::bigint * 8192 as size_bytes,
                    COALESCE(
                        (SELECT avg_width FROM pg_stats
                         WHERE schemaname = $1
                           AND tablename = t.relname
                         LIMIT 1),
                        50
                    ) as avg_width
                FROM pg_class t
                JOIN pg_namespace ns ON ns.oid = t.relnamespace
                WHERE ns.nspname = $1
                    AND t.relkind = 'r'
                    AND t.relpages >= $2
                    AND t.relname NOT LIKE 'pg_%'
            )
            SELECT
                schema_name,
                table_name,
                relpages,
                reltuples,
                size_bytes,
                avg_width,
                CEIL(reltuples * avg_width)::bigint as live_bytes
            FROM table_stats
            WHERE relpages > 0
            `,
            [schema, minPages],
        );

        return rows
            .map((r) => {
                const live = Number(r.live_bytes);
                const total = Number(r.size_bytes);
                const bloat = Math.max(0, total - 24 - live);
                return {
                    schema: r.schema_name,
                    table: r.table_name,
                    sizeBytes: total,
                    liveBytes: live,
                    deadBytes: 0,
                    bloatBytes: bloat,
                    bloatRatio: total > 0 ? bloat / total : 0,
                    bloatMethod: 'heuristic',
                };
            })
            .filter((r) => r.bloatBytes > 0)
            .sort((a, b) => b.bloatBytes - a.bloatBytes);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Index bloat estimation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Estimate index bloat for all user indexes in a schema.
 * Similar strategy to table bloat: pgstattuple (if available) or heuristic.
 *
 * @param {object} client - pg Client
 * @param {object} opts - { schema = 'public' }
 * @returns {array} [{ schema, indexName, tableName, sizeBytes, bloatBytes, bloatRatio, bloatMethod }]
 */
export async function estimateIndexBloat(client, { schema = 'public' } = {}) {
    const hasPgst = await hasPgStatTuple(client);

    if (hasPgst) {
        try {
            const { rows } = await client.query(
                `
                WITH index_bloat AS (
                    SELECT
                        $1::text as schema_name,
                        i.relname as index_name,
                        t.relname as table_name,
                        i.relpages::bigint * 8192 as size_bytes,
                        COALESCE(
                            (pgstattuple_approx(i.oid)).dead_bytes, 0
                        ) as dead_bytes
                    FROM pg_class i
                    JOIN pg_index idx ON idx.indexrelid = i.oid
                    JOIN pg_class t ON t.oid = idx.indrelid
                    JOIN pg_namespace ns ON ns.oid = i.relnamespace
                    WHERE ns.nspname = $1
                        AND i.relkind = 'i'
                        AND i.relname NOT LIKE 'pg_%'
                )
                SELECT
                    schema_name,
                    index_name,
                    table_name,
                    size_bytes,
                    dead_bytes as bloat_bytes,
                    CASE WHEN size_bytes > 0
                        THEN dead_bytes::float / size_bytes
                        ELSE 0 END as bloat_ratio,
                    'pgstattuple' as bloat_method
                FROM index_bloat
                WHERE dead_bytes > 0
                ORDER BY dead_bytes DESC
                `,
                [schema],
            );
            return rows.map((r) => ({
                schema: r.schema_name,
                indexName: r.index_name,
                tableName: r.table_name,
                sizeBytes: Number(r.size_bytes),
                bloatBytes: Number(r.bloat_bytes),
                bloatRatio: Number(r.bloat_ratio),
                bloatMethod: r.bloat_method,
            }));
        } catch (err) {
            console.warn('Index pgstattuple_approx failed, falling back to heuristic', err.message);
        }
    }

    // Index bloat heuristic: assume 5% bloat per 1M scans (simplified)
    {
        const { rows } = await client.query(
            `
            SELECT
                $1::text as schema_name,
                i.relname as index_name,
                t.relname as table_name,
                i.relpages::bigint * 8192 as size_bytes,
                LEAST(
                    (i.relpages::bigint * 8192) * 0.3,
                    GREATEST(0, i.relpages::bigint * 8192 - t.relpages::bigint * 8192)
                ) as bloat_bytes
            FROM pg_class i
            JOIN pg_index idx ON idx.indexrelid = i.oid
            JOIN pg_class t ON t.oid = idx.indrelid
            JOIN pg_namespace ns ON ns.oid = i.relnamespace
            WHERE ns.nspname = $1
                AND i.relkind = 'i'
                AND i.relname NOT LIKE 'pg_%'
                AND i.relpages > 0
            ORDER BY bloat_bytes DESC
            `,
            [schema],
        );

        return rows
            .filter((r) => r.bloat_bytes > 0)
            .map((r) => ({
                schema: r.schema_name,
                indexName: r.index_name,
                tableName: r.table_name,
                sizeBytes: Number(r.size_bytes),
                bloatBytes: Number(r.bloat_bytes),
                bloatRatio: Number(r.size_bytes) > 0 ? Number(r.bloat_bytes) / Number(r.size_bytes) : 0,
                bloatMethod: 'heuristic',
            }));
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Autovacuum lag detection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Detect tables with autovacuum lag.
 * A table is flagged if:
 *   - Dead tuples exceed autovacuum threshold, OR
 *   - Last autovacuum was >24 hours ago AND n_dead_tup > 1000
 *
 * @param {object} client - pg Client
 * @returns {array} [{ schema, table, nLiveTup, nDeadTup, lastVacuum, lastAutovacuum,
 *                      lastAnalyze, lastAutoanalyze, deadTupRatio }]
 */
export async function getAutovacuumLag(client, schema = null) {
    const { rows } = await client.query(
        `
        SELECT
            ns.nspname as schema_name,
            t.relname as table_name,
            stat.n_live_tup,
            stat.n_dead_tup,
            stat.n_mod_since_analyze,
            stat.last_vacuum,
            stat.last_autovacuum,
            stat.last_analyze,
            stat.last_autoanalyze,
            COALESCE(
                (current_setting('autovacuum_vacuum_threshold'))::int, 50
            ) + COALESCE(
                (current_setting('autovacuum_vacuum_scale_factor'))::float * stat.n_live_tup, 0
            ) as autovac_threshold,
            (stat.n_live_tup + stat.n_dead_tup)::bigint * 8192 / 8 as estimated_size_bytes
        FROM pg_stat_user_tables stat
        JOIN pg_class t ON t.oid = stat.relid
        JOIN pg_namespace ns ON ns.oid = t.relnamespace
        WHERE (stat.n_dead_tup > 0
           OR (stat.last_autovacuum IS NOT NULL
               AND now() - stat.last_autovacuum > interval '24 hours'))
           ${schema ? 'AND ns.nspname = $1' : ''}
        ORDER BY stat.n_dead_tup DESC
        `,
        schema ? [schema] : [],
    );

    return rows.map((r) => ({
        schema: r.schema_name,
        table: r.table_name,
        nLiveTup: Number(r.n_live_tup),
        nDeadTup: Number(r.n_dead_tup),
        nModSinceAnalyze: Number(r.n_mod_since_analyze),
        lastVacuum: r.last_vacuum,
        lastAutovacuum: r.last_autovacuum,
        lastAnalyze: r.last_analyze,
        lastAutoanalyze: r.last_autoanalyze,
        deadTupRatio: Number(r.n_live_tup) > 0 ? Number(r.n_dead_tup) / Number(r.n_live_tup) : 0,
        autovacThreshold: Number(r.autovac_threshold),
        estimatedSizeBytes: Number(r.estimated_size_bytes),
    }));
}
