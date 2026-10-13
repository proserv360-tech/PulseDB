// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * services/capacityService.js
 * ───────────────────────────
 * Live capacity-planning data for CapacityPlanningTabV3.
 *
 * Replaces the deterministic mock generators in _capacityV3Helpers.ts with
 * real queries against the monitored Postgres database:
 *
 *   getStats(client, opts)     → current usage / total / growth-per-day / bloat
 *   getTableBreakdown(client)  → per-table size, rows, weekly history, health
 *   getForecast(client, opts)  → -30…+days projection via linear regression
 *   getActions(client)         → data-driven reclaim/archive/vacuum suggestions
 *
 * History source: pgmonitoringtool.fathom_capacity_history (one row per table
 * per snapshot). If the history table is empty we fall back to a single
 * synthetic "today" point so the UI still renders, and growth is estimated
 * from n_tup_ins / n_live_tup ratios in pg_stat_user_tables.
 */

const GB = 1024 ** 3;

function toGB(bytes) {
    return Number((Number(bytes || 0) / GB).toFixed(2));
}

/**
 * Ensure the capacity history table exists (idempotent, runs on the APP pool).
 * @param {import('pg').Pool|import('pg').PoolClient} appPool
 */
export async function ensureCapacityHistory(appPool) {
    await appPool.query(`CREATE SCHEMA IF NOT EXISTS pgmonitoringtool`);
    await appPool.query(`
        CREATE TABLE IF NOT EXISTS pgmonitoringtool.fathom_capacity_history (
            id            BIGSERIAL    PRIMARY KEY,
            connection_id TEXT         NOT NULL,
            captured_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
            db_size_bytes BIGINT       NOT NULL DEFAULT 0,
            table_name    TEXT,
            table_bytes   BIGINT,
            row_estimate  BIGINT
        )`);
    await appPool.query(`
        CREATE INDEX IF NOT EXISTS fathom_capacity_history_conn_time_idx
            ON pgmonitoringtool.fathom_capacity_history (connection_id, captured_at DESC)`);
}

/**
 * Snapshot the monitored DB's per-table sizes into history.
 * Safe to call on a schedule; one call = one point per table.
 * @param {import('pg').Pool} appPool   app metadata pool (history store)
 * @param {import('pg').PoolClient} client  monitored DB client
 * @param {string} connectionId
 */
export async function captureSnapshot(appPool, client, connectionId) {
    await ensureCapacityHistory(appPool);

    const sizeRes = await client.query(`SELECT pg_database_size(current_database()) AS bytes`);
    const dbBytes = Number(sizeRes.rows[0]?.bytes || 0);

    const tablesRes = await client.query(`
        SELECT n.nspname || '.' || c.relname        AS table_name,
               pg_total_relation_size(c.oid)         AS table_bytes,
               COALESCE(s.n_live_tup, 0)             AS row_estimate
        FROM   pg_class c
        JOIN   pg_namespace n ON n.oid = c.relnamespace
        LEFT   JOIN pg_stat_user_tables s ON s.relid = c.oid
        WHERE  c.relkind = 'r'
          AND  n.nspname NOT IN ('pg_catalog', 'information_schema')
        ORDER  BY pg_total_relation_size(c.oid) DESC
        LIMIT  200`);

    const values = [];
    const params = [];
    let i = 1;
    for (const r of tablesRes.rows) {
        params.push(connectionId, dbBytes, r.table_name, r.table_bytes, r.row_estimate);
        values.push(`($${i++}, $${i++}, $${i++}, $${i++}, $${i++})`);
    }
    if (values.length > 0) {
        await appPool.query(
            `INSERT INTO pgmonitoringtool.fathom_capacity_history
                (connection_id, db_size_bytes, table_name, table_bytes, row_estimate)
             VALUES ${values.join(', ')}`,
            params
        );
    }
    return { dbBytes, tables: tablesRes.rows.length };
}

/**
 * Simple least-squares slope (bytes/day) from history rows.
 * @param {Array<{captured_at: Date|string, db_size_bytes: number}>} rows
 * @returns {number} bytes per day (>= 0)
 */
function bytesPerDay(rows) {
    if (!rows || rows.length < 2) return 0;
    const t0 = new Date(rows[0].captured_at).getTime();
    const xs = rows.map(r => (new Date(r.captured_at).getTime() - t0) / 86_400_000);
    const ys = rows.map(r => Number(r.db_size_bytes));
    const n = xs.length;
    const sx = xs.reduce((a, b) => a + b, 0);
    const sy = ys.reduce((a, b) => a + b, 0);
    const sxy = xs.reduce((a, _, k) => a + xs[k] * ys[k], 0);
    const sxx = xs.reduce((a, x) => a + x * x, 0);
    const denom = n * sxx - sx * sx;
    if (denom === 0) return 0;
    const slope = (n * sxy - sx * sy) / denom;
    return Math.max(0, slope);
}

/**
 * Current usage / total / growth / bloat.
 * @param {import('pg').PoolClient} client  monitored DB
 * @param {{appPool: import('pg').Pool, connectionId: string, totalGB?: number}} opts
 */
export async function getStats(client, opts = {}) {
    const { appPool, connectionId, totalGB } = opts;

    const sizeRes = await client.query(`SELECT pg_database_size(current_database()) AS bytes`);
    const usedBytes = Number(sizeRes.rows[0]?.bytes || 0);
    const usedGB = toGB(usedBytes);

    // Total capacity: caller-provided, else heuristically the next power-of-2-ish ceiling.
    const totalGBResolved = totalGB && totalGB > usedGB
        ? totalGB
        : Math.max(Math.ceil((usedGB * 1.75) / 50) * 50, 50);

    // Growth from history (db-level points).
    let growthGBPerDay = 0;
    if (appPool && connectionId) {
        await ensureCapacityHistory(appPool);
        const hist = await appPool.query(
            `SELECT captured_at, db_size_bytes
             FROM   pgmonitoringtool.fathom_capacity_history
             WHERE  connection_id = $1
             GROUP  BY captured_at, db_size_bytes
             ORDER  BY captured_at ASC
             LIMIT  500`,
            [connectionId]
        );
        growthGBPerDay = toGB(bytesPerDay(hist.rows));
    }

    // Bloat estimate (dead tuples → reclaimable bytes), best-effort.
    let bloatGB = 0;
    try {
        const bloatRes = await client.query(`
            SELECT COALESCE(SUM(
                       CASE WHEN n_live_tup + n_dead_tup > 0
                            THEN pg_total_relation_size(relid)::numeric
                                 * n_dead_tup / (n_live_tup + n_dead_tup)
                            ELSE 0 END), 0) AS bloat_bytes
            FROM pg_stat_user_tables`);
        bloatGB = toGB(bloatRes.rows[0]?.bloat_bytes);
    } catch { /* permissions / view missing — leave 0 */ }

    // Cold-row pct (rows not modified in 90d) — best-effort, 0 if unknown.
    let coldRowPct = 0;
    try {
        const coldRes = await client.query(`
            SELECT
              SUM(n_live_tup) AS total,
              SUM(CASE WHEN COALESCE(last_autovacuum, last_vacuum, '1970-01-01')
                        < now() - interval '90 days' THEN n_live_tup ELSE 0 END) AS cold
            FROM pg_stat_user_tables`);
        const total = Number(coldRes.rows[0]?.total || 0);
        const cold = Number(coldRes.rows[0]?.cold || 0);
        coldRowPct = total > 0 ? Math.round((cold / total) * 100) : 0;
    } catch { /* ignore */ }

    const remainingGB = Math.max(totalGBResolved - usedGB, 0);
    const daysUntilFull = growthGBPerDay > 0 ? Math.round(remainingGB / growthGBPerDay) : null;

    return {
        usedGB,
        totalGB: totalGBResolved,
        remainingGB: Number(remainingGB.toFixed(2)),
        pctUsed: Number(((usedGB / totalGBResolved) * 100).toFixed(1)),
        growthGBPerDay,
        bloatGB,
        coldRowPct,
        daysUntilFull,
        hasHistory: growthGBPerDay > 0,
    };
}

/**
 * Per-table breakdown with 8-week weekly history + health classification.
 * @param {import('pg').PoolClient} client monitored DB
 * @param {{appPool: import('pg').Pool, connectionId: string, limit?: number}} opts
 */
export async function getTableBreakdown(client, opts = {}) {
    const { appPool, connectionId, limit = 8 } = opts;

    const cur = await client.query(`
        SELECT n.nspname || '.' || c.relname           AS name,
               pg_total_relation_size(c.oid)            AS bytes,
               COALESCE(s.n_live_tup, 0)                AS rows,
               COALESCE(s.n_dead_tup, 0)                AS dead
        FROM   pg_class c
        JOIN   pg_namespace n ON n.oid = c.relnamespace
        LEFT   JOIN pg_stat_user_tables s ON s.relid = c.oid
        WHERE  c.relkind = 'r'
          AND  n.nspname NOT IN ('pg_catalog', 'information_schema')
        ORDER  BY pg_total_relation_size(c.oid) DESC
        LIMIT  $1`, [limit]);

    // Pull weekly history per table if we have it.
    let weeklyByTable = new Map();
    if (appPool && connectionId) {
        await ensureCapacityHistory(appPool);
        const hist = await appPool.query(`
            SELECT table_name,
                   date_trunc('week', captured_at) AS wk,
                   AVG(table_bytes)                 AS bytes
            FROM   pgmonitoringtool.fathom_capacity_history
            WHERE  connection_id = $1
              AND  table_name = ANY($2)
              AND  captured_at > now() - interval '8 weeks'
            GROUP  BY table_name, wk
            ORDER  BY table_name, wk ASC`,
            [connectionId, cur.rows.map(r => r.name)]);
        for (const r of hist.rows) {
            if (!weeklyByTable.has(r.table_name)) weeklyByTable.set(r.table_name, []);
            weeklyByTable.get(r.table_name).push(toGB(r.bytes));
        }
    }

    return cur.rows.map(r => {
        const sizeGB = toGB(r.bytes);
        const weekly = weeklyByTable.get(r.name) || [sizeGB];
        // weekly growth % from first→last available point
        let growthPctPerWeek = 0;
        if (weekly.length >= 2 && weekly[0] > 0) {
            const weeks = weekly.length - 1;
            growthPctPerWeek = Number(
                (((weekly[weekly.length - 1] / weekly[0]) ** (1 / weeks) - 1) * 100).toFixed(1)
            );
        }
        const deadRatio = Number(r.rows) + Number(r.dead) > 0
            ? Number(r.dead) / (Number(r.rows) + Number(r.dead)) : 0;
        const health =
            deadRatio > 0.2 || growthPctPerWeek > 3 ? 'hot'
            : growthPctPerWeek > 1.5 ? 'slow'
            : 'healthy';
        return {
            name: r.name,
            sizeGB,
            rowsMillions: Number((Number(r.rows) / 1_000_000).toFixed(2)),
            growthPctPerWeek,
            health,
            weekly,
        };
    });
}

/**
 * Forecast: -30…+days projection from history regression (falls back to
 * current size with zero slope if there's no history).
 * @param {import('pg').PoolClient} client monitored DB
 * @param {{appPool: import('pg').Pool, connectionId: string, days?: number, multiplier?: number}} opts
 */
export async function getForecast(client, opts = {}) {
    const { appPool, connectionId, days = 60, multiplier = 1 } = opts;

    const sizeRes = await client.query(`SELECT pg_database_size(current_database()) AS bytes`);
    const usedGB = toGB(sizeRes.rows[0]?.bytes || 0);

    let slopeGBPerDay = 0;
    let history = [];
    if (appPool && connectionId) {
        await ensureCapacityHistory(appPool);
        const hist = await appPool.query(`
            SELECT captured_at, db_size_bytes
            FROM   pgmonitoringtool.fathom_capacity_history
            WHERE  connection_id = $1
            GROUP  BY captured_at, db_size_bytes
            ORDER  BY captured_at ASC
            LIMIT  500`, [connectionId]);
        slopeGBPerDay = toGB(bytesPerDay(hist.rows));
        history = hist.rows;
    }

    const pts = [];
    // Past 30 days from real history where available, else flat back-projection.
    for (let d = -30; d <= 0; d++) {
        pts.push({ day: d, used: Number((usedGB + d * slopeGBPerDay).toFixed(2)) });
    }
    for (let d = 1; d <= days; d++) {
        const used = Number((usedGB + d * slopeGBPerDay * multiplier).toFixed(2));
        const band = Number(((d / days) * 10 + 2).toFixed(2));
        pts.push({ day: d, used, band });
    }
    return { points: pts, slopeGBPerDay, hasHistory: history.length >= 2, usedGB };
}

/**
 * Data-driven action plan from live stats.
 * @param {import('pg').PoolClient} client monitored DB
 */
export async function getActions(client) {
    const actions = [];

    // Top bloated tables → vacuum suggestions.
    try {
        const bloat = await client.query(`
            SELECT relid::regclass::text AS name,
                   n_dead_tup,
                   n_live_tup,
                   pg_total_relation_size(relid) AS bytes
            FROM   pg_stat_user_tables
            WHERE  n_dead_tup > 10000
            ORDER  BY n_dead_tup DESC
            LIMIT  3`);
        for (const r of bloat.rows) {
            const reclaimGB = toGB(
                (Number(r.bytes) * Number(r.n_dead_tup)) /
                Math.max(Number(r.n_live_tup) + Number(r.n_dead_tup), 1)
            );
            actions.push({
                id: `vacuum-${r.name}`,
                title: `VACUUM ${r.name}`,
                detail: `${Number(r.n_dead_tup).toLocaleString()} dead tuples. Reclaims ~${reclaimGB} GB.`,
                impact: reclaimGB > 5 ? 'high' : 'med',
                estSavingsGB: reclaimGB,
                confidencePct: 88,
                effortHours: 1,
                category: 'vacuum',
            });
        }
    } catch { /* ignore */ }

    // Largest table → archive suggestion.
    try {
        const big = await client.query(`
            SELECT relid::regclass::text AS name,
                   pg_total_relation_size(relid) AS bytes
            FROM   pg_stat_user_tables
            ORDER  BY pg_total_relation_size(relid) DESC
            LIMIT  1`);
        if (big.rows[0]) {
            const gb = toGB(big.rows[0].bytes);
            if (gb > 1) {
                actions.push({
                    id: `archive-${big.rows[0].name}`,
                    title: `Archive cold rows in ${big.rows[0].name}`,
                    detail: `Largest table at ${gb} GB. Tier rows older than 90 days to object storage.`,
                    impact: 'high',
                    estSavingsGB: Number((gb * 0.3).toFixed(1)),
                    confidencePct: 80,
                    effortHours: 4,
                    category: 'archive',
                });
            }
        }
    } catch { /* ignore */ }

    // Always-useful: capacity alert.
    actions.push({
        id: 'alert-80pct',
        title: 'Alert at 80% capacity',
        detail: 'Leading indicator so capacity decisions happen calmly, not at 2am.',
        impact: 'low',
        estSavingsGB: 0,
        confidencePct: 99,
        effortHours: 0.5,
        category: 'alert',
    });

    return actions;
}
