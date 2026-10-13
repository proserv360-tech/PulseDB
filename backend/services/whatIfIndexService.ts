/**
 * services/whatIfIndexService.ts
 * ──────────────────────────────
 * "What-if" hypothetical index analysis (gap-analysis P1-3).
 *
 * pganalyze's Indexing Engine evaluates hundreds of hypothetical index
 * combinations before recommending one. This service brings the same idea
 * to PulseDB using HypoPG when the extension is installed (zero-cost
 * hypothetical indexes evaluated by the real planner), and falls back to a
 * planner-cost heuristic when it is not.
 *
 *   checkHypopg(targetPool)                          — extension available?
 *   whatIfAnalysis({ targetPool, query, candidates }) — cost per candidate
 *   generateCandidates(query)                         — candidate DDLs from a SELECT
 */

import { parseWhereColumns, generateIndexDdl } from './indexAdvisor.js';
import { isReadOnlySelect } from './sqlReadGuard.js';

function assertReadOnly(query: string) {
    if (!isReadOnlySelect(query)) {
        throw new Error('query must be a single read-only SELECT statement');
    }
}

export async function checkHypopg(targetPool: any): Promise<boolean> {
    try {
        const { rows } = await targetPool.query(`SELECT 1 FROM pg_extension WHERE extname = 'hypopg' LIMIT 1`);
        return rows.length > 0;
    } catch {
        return false;
    }
}

/** Extract table → candidate column combinations from a SELECT statement. */
export function generateCandidates(query: string): Array<{ table: string; columns: string[]; ddl: string }> {
    assertReadOnly(query);
    // parseWhereColumns returns [{ table, column }] from qualified predicates.
    const refs: Array<{ table: string; column: string }> = parseWhereColumns(query) || [];
    if (!refs.length) return [];

    const byTable = new Map<string, string[]>();
    for (const r of refs) {
        const cols = byTable.get(r.table) ?? [];
        if (!cols.includes(r.column)) cols.push(r.column);
        byTable.set(r.table, cols);
    }

    const candidates: Array<{ table: string; columns: string[]; ddl: string }> = [];
    for (const [table, cols] of byTable) {
        // singles, then ordered pairs (column order matters for composites)
        for (const c of cols) {
            candidates.push({ table, columns: [c], ddl: generateIndexDdl({ table, columns: [c] }) });
        }
        for (let i = 0; i < cols.length; i++) {
            for (let j = 0; j < cols.length; j++) {
                if (i === j) continue;
                const combo = [cols[i], cols[j]];
                candidates.push({ table, columns: combo, ddl: generateIndexDdl({ table, columns: combo }) });
            }
        }
    }
    // cap the search space like pganalyze does
    return candidates.slice(0, 24);
}

async function planCost(client: any, query: string): Promise<number> {
    const r = await client.query(`EXPLAIN (FORMAT JSON) ${query}`);
    const plan = r.rows?.[0]?.['QUERY PLAN'];
    const root = Array.isArray(plan) ? plan[0]?.Plan : plan?.Plan;
    return Number(root?.['Total Cost'] ?? 0);
}

/**
 * Evaluate candidate indexes against a query.
 * With HypoPG: create hypothetical indexes one at a time, re-plan, compare.
 * Without: report baseline cost and candidates with `estimated: false` so
 * the UI can still offer the DDL (clearly marked unverified).
 */
export async function whatIfAnalysis({ targetPool, query, candidates = null }: any) {
    assertReadOnly(query);
    const cands = candidates ?? generateCandidates(query);
    if (!cands.length) return { hypopg: false, baselineCost: null, results: [] };

    const hypopg = await checkHypopg(targetPool);
    const client = await targetPool.connect();
    try {
        await client.query('BEGIN');
        // EXPLAIN (no ANALYZE) doesn't execute, but hypopg index creation and
        // planning can still be costly on huge catalogs — bound it.
        await client.query("SET LOCAL statement_timeout = '15s'");
        const baselineCost = await planCost(client, query);
        const results: any[] = [];

        for (const cand of cands) {
            if (!hypopg) {
                results.push({ ...cand, verified: false, costAfter: null, improvement: null });
                continue;
            }
            try {
                await client.query(`SELECT hypopg_create_index($1)`, [cand.ddl]);
                const costAfter = await planCost(client, query);
                await client.query(`SELECT hypopg_reset()`);
                const improvement = baselineCost > 0 ? Math.round((1 - costAfter / baselineCost) * 1000) / 10 : 0;
                results.push({ ...cand, verified: true, costAfter, improvement });
            } catch {
                try {
                    await client.query(`SELECT hypopg_reset()`);
                } catch {
                    /* noop */
                }
                results.push({ ...cand, verified: false, costAfter: null, improvement: null });
            }
        }

        await client.query('ROLLBACK');
        results.sort((a, b) => (b.improvement ?? -1) - (a.improvement ?? -1));
        return {
            hypopg,
            baselineCost,
            results: results.filter((r) => r.improvement == null || r.improvement > 0.5 || !r.verified).slice(0, 10),
        };
    } catch (e) {
        try {
            await client.query('ROLLBACK');
        } catch {
            /* aborted */
        }
        throw e;
    } finally {
        client.release();
    }
}
