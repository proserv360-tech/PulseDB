// @ts-nocheck — TODO type this module (added 2026-07; see docs/TS_MIGRATION.md)
/**
 * services/planInsightsService.ts
 * ───────────────────────────────
 * auto_explain "Log Insights" (B-1): fingerprint captured plans by their
 * STRUCTURE (node types, relations, index/join kinds — costs/rows/timings
 * ignored) and detect plan regressions, i.e. when a query's current plan is
 * materially slower than a faster plan it used earlier in the window.
 *
 * Fingerprinting + regression analysis are pure functions (unit-testable);
 * getPlanRegressions() just fetches auto_explain_events and feeds them in.
 */

import crypto from 'crypto';

/**
 * Stable structural fingerprint of a plan. Two executions with the same shape
 * (same node types over the same relations/indexes) hash to the same value;
 * a different scan/join/order produces a different hash.
 */
export function planFingerprint(planJson) {
    const parts = [];
    const walk = (node) => {
        if (!node || typeof node !== 'object') return;
        const type = node['Node Type'] || node.node_type;
        if (type) {
            let tag = String(type);
            const rel = node['Relation Name'] || node['Alias'];
            const idx = node['Index Name'];
            const join = node['Join Type'];
            const strat = node['Strategy'];
            if (rel) tag += ':' + rel;
            if (idx) tag += '#' + idx;
            if (join) tag += '/' + join;
            if (strat) tag += '~' + strat;
            parts.push(tag);
        }
        const kids = node['Plans'] || node.Plans || node.plans;
        if (Array.isArray(kids)) kids.forEach(walk);
    };
    // plan_json may be the EXPLAIN root { Plan: {...} }, an array [{ Plan }], or a bare node
    let root = Array.isArray(planJson) ? planJson[0] : planJson;
    root = (root && (root.Plan || root.plan)) || root;
    walk(root);
    const sig = parts.join('|') || 'empty';
    return crypto.createHash('sha1').update(sig).digest('hex').slice(0, 16);
}

/**
 * Pure regression analysis over a list of captured events.
 * @param {Array<{query_id:any, statement?:string, duration_ms:number, plan_json:any, captured_at:string|Date}>} events
 * @param {{minSlowdownPct?:number, minSamples?:number}} opts
 * @returns Array of regressions, worst first.
 */
export function analyzePlanRegressions(events, { minSlowdownPct = 30, minSamples = 3 } = {}) {
    const byQuery = new Map();
    for (const e of events || []) {
        if (e.query_id == null || e.plan_json == null) continue;
        const qid = String(e.query_id);
        if (!byQuery.has(qid)) byQuery.set(qid, []);
        byQuery.get(qid).push(e);
    }

    const regressions = [];
    for (const [qid, evs] of byQuery) {
        evs.sort((a, b) => new Date(a.captured_at).getTime() - new Date(b.captured_at).getTime());
        // group by fingerprint
        const plans = new Map();
        for (const e of evs) {
            const fp = planFingerprint(e.plan_json);
            if (!plans.has(fp)) {
                plans.set(fp, { fp, count: 0, sumMs: 0, firstSeen: e.captured_at, lastSeen: e.captured_at, sample: e });
            }
            const p = plans.get(fp);
            p.count += 1;
            p.sumMs += Number(e.duration_ms) || 0;
            p.lastSeen = e.captured_at;
        }
        for (const p of plans.values()) p.avgMs = p.count > 0 ? p.sumMs / p.count : 0;

        if (plans.size < 2) continue; // no plan change → no regression

        // "current" = fingerprint of the most recent event
        const currentFp = planFingerprint(evs[evs.length - 1].plan_json);
        const current = plans.get(currentFp);
        if (!current || current.count < minSamples) continue;

        // baseline = fastest OTHER plan seen in the window
        let baseline = null;
        for (const p of plans.values()) {
            if (p.fp === currentFp) continue;
            if (!baseline || p.avgMs < baseline.avgMs) baseline = p;
        }
        if (!baseline || baseline.avgMs <= 0) continue;

        const slowdownPct = ((current.avgMs - baseline.avgMs) / baseline.avgMs) * 100;
        if (slowdownPct >= minSlowdownPct) {
            regressions.push({
                queryId: qid,
                statement: String(current.sample.statement || '').slice(0, 300),
                slowdownPct: Math.round(slowdownPct * 10) / 10,
                currentPlan: {
                    fingerprint: currentFp,
                    avgMs: Math.round(current.avgMs * 100) / 100,
                    executions: current.count,
                    since: current.firstSeen,
                },
                baselinePlan: {
                    fingerprint: baseline.fp,
                    avgMs: Math.round(baseline.avgMs * 100) / 100,
                    executions: baseline.count,
                    lastSeen: baseline.lastSeen,
                },
                distinctPlans: plans.size,
            });
        }
    }
    regressions.sort((a, b) => b.slowdownPct - a.slowdownPct);
    return regressions;
}

/** Fetch auto_explain events over a window and detect plan regressions. */
export async function getPlanRegressions(
    pool,
    { workspaceId, connectionId, fromTs, toTs, minSlowdownPct = 30, minSamples = 3 },
) {
    if (!workspaceId) throw new Error('workspaceId required');
    if (!connectionId) throw new Error('connectionId required');
    const to = toTs ? new Date(toTs) : new Date();
    const from = fromTs ? new Date(fromTs) : new Date(to.getTime() - 24 * 3600 * 1000);
    const { rows } = await pool.query(
        `SELECT query_id, statement, duration_ms, plan_json, captured_at
           FROM pgmonitoringtool.auto_explain_events
          WHERE workspace_id = $1 AND connection_id = $2
            AND captured_at >= $3 AND captured_at <= $4
            AND query_id IS NOT NULL AND plan_json IS NOT NULL
          ORDER BY captured_at ASC
          LIMIT 20000`,
        [workspaceId, connectionId, from, to],
    );
    const regressions = analyzePlanRegressions(rows, { minSlowdownPct, minSamples });
    return {
        window: { from: from.toISOString(), to: to.toISOString() },
        eventsAnalyzed: rows.length,
        regressions,
    };
}
