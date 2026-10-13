// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
// ==========================================================================
//  PulseDB — /api/overview/stats
//  Returns: connections, cache hit ratio, disk size, uptime, system resources,
//           latency percentiles, pg version, host
// ==========================================================================

import { Router } from 'express';
import { query }  from '../../db.js';

const router = Router();

router.get('/', async (_req, res, next) => {
    try {
        const [
            connResult,
            cacheResult,
            dbSizeResult,
            uptimeResult,
            pgVersionResult,
            latencyResult,
            bgwriterResult,
        ] = await Promise.all([

            // ── Active / max connections ──
            query(`
                SELECT
                    COUNT(*) FILTER (WHERE state = 'active')  AS active_connections,
                    COUNT(*)                                   AS total_connections,
                    (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') AS max_connections
                FROM pg_stat_activity
                WHERE datname = current_database()
            `),

            // ── Buffer / index cache hit ratio ──
            query(`
                SELECT
                    ROUND(
                        100.0 * SUM(idx_blks_hit)
                        / NULLIF(SUM(idx_blks_hit) + SUM(idx_blks_read), 0),
                        2
                    ) AS index_hit_ratio,
                    ROUND(
                        100.0 * SUM(heap_blks_hit)
                        / NULLIF(SUM(heap_blks_hit) + SUM(heap_blks_read), 0),
                        2
                    ) AS heap_hit_ratio
                FROM pg_statio_user_tables
            `),

            // ── Database size ──
            query(`
                SELECT
                    pg_database_size(current_database()) AS size_bytes,
                    ROUND(pg_database_size(current_database()) / 1073741824.0, 2) AS size_gb
            `),

            // ── Uptime ──
            query(`
                SELECT
                    EXTRACT(EPOCH FROM (now() - pg_postmaster_start_time()))::bigint AS uptime_seconds,
                    pg_postmaster_start_time() AS started_at
            `),

            // ── PG version + host ──
            query(`
                SELECT
                    version()                                                    AS full_version,
                    (regexp_match(version(), 'PostgreSQL (\\S+)'))[1]            AS pg_version,
                    inet_server_addr()::text                                     AS host,
                    inet_server_port()                                           AS port,
                    current_database()                                           AS database
            `),

            // ── Transaction latency percentiles (from pg_stat_statements) ──
            query(`
                SELECT
                    ROUND((PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY mean_exec_time))::numeric, 2) AS p50_ms,
                    ROUND((PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY mean_exec_time))::numeric, 2) AS p95_ms,
                    ROUND((PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY mean_exec_time))::numeric, 2) AS p99_ms,
                    COUNT(*) FILTER (WHERE mean_exec_time > 10000) AS sla_breach_count,
                    COUNT(*) FILTER (WHERE mean_exec_time > 5000
                        AND stats_since > now() - interval '5 minutes')         AS timeouts_5m
                FROM pg_stat_statements
                WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
            `).catch(() => ({ rows: [{}] })),   // pg_stat_statements may not be installed

            // ── bgwriter / shared_buffers for memory estimate ──
            query(`
                SELECT
                    buffers_clean,
                    buffers_checkpoint,
                    buffers_alloc,
                    (SELECT setting::bigint * 8192
                     FROM pg_settings WHERE name = 'shared_buffers') AS shared_buffers_bytes
                FROM pg_stat_bgwriter
            `),
        ]);

        const conn   = connResult.rows[0];
        const cache  = cacheResult.rows[0];
        const db     = dbSizeResult.rows[0];
        const up     = uptimeResult.rows[0];
        const pgv    = pgVersionResult.rows[0];
        const lat    = latencyResult.rows[0];
        const bgw    = bgwriterResult.rows[0];

        // Estimate memory % from shared_buffers vs a heuristic total
        const sharedBufBytes  = Number(bgw?.shared_buffers_bytes || 0);
        const sharedBufGB     = sharedBufBytes / 1073741824;

        res.json({
            // Connections
            activeConnections : Number(conn.active_connections),
            totalConnections  : Number(conn.total_connections),
            maxConnections    : Number(conn.max_connections),

            // Cache
            indexHitRatio     : Number(cache.index_hit_ratio  || 0),
            heapHitRatio      : Number(cache.heap_hit_ratio   || 0),

            // Disk
            diskUsedBytes     : Number(db.size_bytes),
            diskUsedGB        : Number(db.size_gb),
            diskUsedPct       : null,   // needs filesystem total — set from infra agent

            // Uptime
            uptimeSeconds     : Number(up.uptime_seconds),
            startedAt         : up.started_at,

            // Identity
            pgVersion         : pgv.pg_version,
            fullVersion       : pgv.full_version,
            host              : pgv.host,
            port              : Number(pgv.port),
            database          : pgv.database,

            // Latency
            latencyP50Ms      : Number(lat.p50_ms  || 0),
            latencyP95Ms      : Number(lat.p95_ms  || 0),
            latencyP99Ms      : Number(lat.p99_ms  || 0),
            slaBreach         : Number(lat.sla_breach_count || 0),
            timeouts5m        : Number(lat.timeouts_5m      || 0),

            // Memory (shared buffers as proxy)
            sharedBufGB       : Number(sharedBufGB.toFixed(2)),
            sharedBufPct      : null,   // needs total RAM — set from infra agent

            // bgwriter
            buffersClean      : Number(bgw?.buffers_clean || 0),
            buffersCheckpoint : Number(bgw?.buffers_checkpoint || 0),
            buffersAlloc      : Number(bgw?.buffers_alloc || 0),

            // Placeholders filled by infra/OS agent (e.g., node-exporter sidecar)
            cpuPct            : null,
            ioWaitPct         : null,
            memPct            : null,
            writeAmpPct       : null,
        });
    } catch (err) {
        next(err);
    }
});

export default router;