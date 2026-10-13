/**
 * services/agentLoopService.ts
 * ────────────────────────────
 * Autonomous monitoring agent loop (gap-analysis P1-4, June 2026).
 *
 * Closes the detect → diagnose → propose → notify loop that competitors
 * (Xata Agent) ship: instead of waiting for a user to open the copilot,
 * the sweep runs on the monitoring cron, feeds recent metric snapshots
 * through the anomaly-detection suite, writes deduplicated FINDINGS with a
 * draft diagnosis + proposed next step, raises a pulsedb_alert (which rides
 * the existing notifier fan-out), and enqueues RCA for context assembly.
 *
 * Entry points:
 *   runAgentSweep({ pool })       — one sweep over recent snapshots
 *   listFindings({ pool, ... })   — query findings for the API
 *   setFindingStatus({ pool, id, status })
 */

import { AnomalyEvaluator } from './anomaly/index.js';
import { log } from './logger.js';

const METRICS: Array<{ key: string; column: string; label: string; unit: string; proposal: string }> = [
    {
        key: 'qps',
        column: 'avg_qps',
        label: 'Queries/sec',
        unit: 'qps',
        proposal: 'Check Query Analysis → Top Queries for a new hot query; compare against deploy timeline.',
    },
    {
        key: 'latency_p95',
        column: 'avg_latency_p95_ms',
        label: 'p95 latency',
        unit: 'ms',
        proposal:
            'Inspect wait events for lock or IO waits in the affected window; review recent plan changes in Query Advisor.',
    },
    {
        key: 'latency_p99',
        column: 'avg_latency_p99_ms',
        label: 'p99 latency',
        unit: 'ms',
        proposal: 'Check for blocking sessions and long-running transactions in Operations → Connection Pool.',
    },
    {
        key: 'tps',
        column: 'avg_tps',
        label: 'Transactions/sec',
        unit: 'tps',
        proposal: 'Verify application traffic levels; a drop can indicate connection exhaustion or upstream failure.',
    },
];

const DEFAULT_RULE = { type: 'zscore', window: 48, threshold: 3.5, warmup: 12, mode: 'suggest' };
const DEDUPE_WINDOW_MIN = 60;

function severityFor(deviation: number): string {
    if (deviation >= 6) return 'critical';
    if (deviation >= 4.5) return 'warning';
    return 'info';
}

/** Evaluate one metric series; returns a finding draft for the latest point or null. */
export function evaluateSeries(metricKey: string, values: number[], rule: any = DEFAULT_RULE) {
    if (!Array.isArray(values) || values.length < (rule.warmup ?? 12) + 1) return null;
    // Fresh evaluator per evaluation: we replay the full window every sweep,
    // so reusing a shared instance would double-feed history and skew the
    // rolling baseline.
    const evaluator = new AnomalyEvaluator();
    let last: any = null;
    for (const v of values) {
        last = evaluator.evaluate(metricKey, Number(v) || 0, rule);
    }
    if (!last || !last.anomaly) return null;
    return {
        metric: metricKey,
        value: values[values.length - 1],
        deviation: Number(last.score ?? last.deviation ?? 0),
    };
}

export async function runAgentSweep({ pool }: { pool: any }) {
    const findings: any[] = [];
    const { rows } = await pool.query(
        `SELECT time_bucket, avg_qps, avg_tps, avg_latency_p95_ms, avg_latency_p99_ms
           FROM pulsedb_metric_snapshots
          ORDER BY time_bucket DESC
          LIMIT 96`,
    );
    if (rows.length < 13) {
        return { findings: [], skipped: 'not enough metric history' };
    }
    const series = rows.slice().reverse(); // oldest → newest

    for (const m of METRICS) {
        const values = series.map((r: any) => Number(r[m.column]) || 0);
        const hit = evaluateSeries(`agent:${m.key}`, values, DEFAULT_RULE);
        if (!hit) continue;

        const latest = values[values.length - 1];
        const title = `${m.label} anomaly: ${Math.round(latest * 100) / 100} ${m.unit}`;
        const summary =
            `${m.label} deviated ${hit.deviation.toFixed(1)}σ from its rolling baseline ` +
            `(latest ${Math.round(latest * 100) / 100} ${m.unit}).`;
        const severity = severityFor(hit.deviation);

        // Dedupe: skip if an open finding for this metric exists in the window.
        const dup = await pool.query(
            `SELECT id FROM pulsedb_agent_findings
              WHERE metric = $1 AND status = 'open'
                AND detected_at > now() - ($2 || ' minutes')::interval
              LIMIT 1`,
            [m.key, String(DEDUPE_WINDOW_MIN)],
        );
        if (dup.rows.length) continue;

        const ins = await pool.query(
            `INSERT INTO pulsedb_agent_findings (metric, severity, title, summary, proposal, context)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id, detected_at`,
            [
                m.key,
                severity,
                title,
                summary,
                m.proposal,
                JSON.stringify({
                    deviation: hit.deviation,
                    latest,
                    window: DEFAULT_RULE.window,
                    recent: values.slice(-12),
                }),
            ],
        );
        const findingId = ins.rows[0].id;

        // Ride the existing alert pipeline (fan-out, unread badge, RCA enqueue).
        try {
            await pool.query(
                `INSERT INTO pulsedb_alerts (severity, title, message, fingerprint, source)
                 VALUES ($1, $2, $3, $4, 'agent')
                 ON CONFLICT (fingerprint) DO NOTHING`,
                [
                    severity,
                    `[Agent] ${title}`,
                    `${summary} Suggested next step: ${m.proposal}`,
                    `agent:${m.key}:${ins.rows[0].detected_at.toISOString().slice(0, 13)}`,
                ],
            );
        } catch (e: any) {
            log('WARN', 'agent sweep: alert insert failed', { error: e.message });
        }

        // Best-effort RCA enqueue (context assembly happens async).
        try {
            const { enqueueRca } = await import('./alertRcaService.js');
            await enqueueRca({ id: findingId, title, created_at: new Date().toISOString() });
        } catch {
            /* RCA optional */
        }

        findings.push({ id: findingId, metric: m.key, severity, title });
    }

    if (findings.length) log('INFO', `agent sweep: ${findings.length} new finding(s)`, { findings });
    return { findings };
}

export async function listFindings({ pool, status = null, limit = 50 }: any) {
    const params: any[] = [];
    let where = '';
    if (status) {
        params.push(status);
        where = `WHERE status = $1`;
    }
    params.push(Math.min(Number(limit) || 50, 200));
    const { rows } = await pool.query(
        `SELECT id, metric, severity, title, summary, proposal, context, status,
                detected_at, acked_at, resolved_at
           FROM pulsedb_agent_findings ${where}
          ORDER BY detected_at DESC
          LIMIT $${params.length}`,
        params,
    );
    return rows;
}

export async function setFindingStatus({ pool, id, status }: any) {
    if (!['open', 'acked', 'resolved'].includes(status)) {
        throw new Error(`invalid status '${status}'`);
    }
    const col = status === 'acked' ? 'acked_at' : status === 'resolved' ? 'resolved_at' : null;
    const { rows } = await pool.query(
        `UPDATE pulsedb_agent_findings
            SET status = $2 ${col ? `, ${col} = now()` : ''}
          WHERE id = $1
          RETURNING id, status`,
        [id, status],
    );
    if (!rows.length) throw new Error('finding not found');
    return rows[0];
}
