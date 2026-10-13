// @ts-nocheck — TODO type this module (added 2026-07; see docs/TS_MIGRATION.md)
/**
 * services/vacuumForecastService.ts
 * ─────────────────────────────────
 * Predictive VACUUM advisor (B-1). Instead of only reporting current bloat, this
 * forecasts *when* autovacuum will fire on each table, so operators can act
 * before dead tuples pile up.
 *
 * Model (no extra history table needed):
 *   trigger threshold = autovacuum_vacuum_threshold
 *                     + autovacuum_vacuum_scale_factor * n_live_tup
 *   dead-tuple growth rate ≈ n_dead_tup / hours since last (auto)vacuum
 *   hours-until-trigger    = (threshold - n_dead_tup) / growth_rate
 *
 * Rate is an estimate (dead tuples grew from ~0 after the last vacuum to the
 * current count over that window); it's a solid v1 that mirrors what dedicated
 * Postgres tools infer from richer history.
 */

const S = 'pgmonitoringtool';

/** Pure: turn one pg_stat_user_tables row into a forecast. Exported for tests. */
export function forecastTable(t, nowMs = Date.now()) {
    const live = Number(t.n_live_tup) || 0;
    const dead = Number(t.n_dead_tup) || 0;
    const threshold = Number(t.autovac_threshold) || 0;
    const lastVac = t.last_autovacuum || t.last_vacuum || null;

    let growthPerHour = 0;
    if (lastVac) {
        const hours = Math.max(0.5, (nowMs - new Date(lastVac).getTime()) / 3_600_000);
        growthPerHour = dead / hours;
    }

    let hoursUntil = null;
    if (threshold > 0 && dead >= threshold) {
        hoursUntil = 0;
    } else if (growthPerHour > 0) {
        hoursUntil = Math.max(0, (threshold - dead) / growthPerHour);
    }

    const deadPct = threshold > 0 ? Math.min(999, (dead / threshold) * 100) : 0;

    let urgency = 'ok';
    if (hoursUntil === 0) urgency = 'overdue';
    else if (hoursUntil != null && hoursUntil <= 24) urgency = 'soon';
    else if (hoursUntil != null && hoursUntil <= 24 * 7) urgency = 'watch';

    return {
        schema: t.schema,
        table: t.table_name,
        liveTuples: live,
        deadTuples: dead,
        threshold: Math.round(threshold),
        deadPct: Math.round(deadPct * 10) / 10,
        growthPerHour: Math.round(growthPerHour * 10) / 10,
        hoursUntilVacuum: hoursUntil == null ? null : Math.round(hoursUntil * 10) / 10,
        etaVacuum: hoursUntil == null ? null : new Date(nowMs + hoursUntil * 3_600_000).toISOString(),
        lastVacuum: lastVac,
        urgency,
    };
}

const URGENCY_RANK = { overdue: 0, soon: 1, watch: 2, ok: 3 };

/**
 * Forecast autovacuum timing across a connection's tables.
 * @param {import('pg').Pool} pool  a pool for the MONITORED database
 * @param {{ schema?: string, limit?: number }} opts
 */
export async function getVacuumForecast(pool, { schema = null, limit = 200 } = {}) {
    const params = [];
    let schemaFilter = '';
    if (schema) {
        params.push(schema);
        schemaFilter = `AND ns.nspname = $${params.length}`;
    }
    params.push(Math.min(Number(limit) || 200, 1000));
    const { rows } = await pool.query(
        `SELECT ns.nspname               AS schema,
                t.relname                AS table_name,
                stat.n_live_tup,
                stat.n_dead_tup,
                stat.last_vacuum,
                stat.last_autovacuum,
                ( COALESCE((current_setting('autovacuum_vacuum_threshold', true))::int, 50)
                + COALESCE((current_setting('autovacuum_vacuum_scale_factor', true))::float * stat.n_live_tup, 0)
                ) AS autovac_threshold
         FROM   pg_stat_user_tables stat
         JOIN   pg_class     t  ON t.oid = stat.relid
         JOIN   pg_namespace ns ON ns.oid = t.relnamespace
         WHERE  stat.n_dead_tup > 0 ${schemaFilter}
         ORDER  BY stat.n_dead_tup DESC
         LIMIT  $${params.length}`,
        params,
    );

    const now = Date.now();
    const forecasts = rows.map((r) => forecastTable(r, now));
    forecasts.sort((a, b) => {
        const u = URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency];
        return u !== 0 ? u : b.deadPct - a.deadPct;
    });

    const summary = { overdue: 0, soon: 0, watch: 0, ok: 0 };
    for (const f of forecasts) summary[f.urgency] += 1;

    return { generatedAt: new Date(now).toISOString(), summary, tables: forecasts };
}
