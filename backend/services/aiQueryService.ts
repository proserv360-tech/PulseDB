// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * services/aiQueryService.js
 * ──────────────────────────
 * AI-powered query analysis and optimization suggestions.
 * Uses PostgreSQL EXPLAIN output and heuristic rules (no external AI APIs).
 */

const S = 'pgmonitoringtool';

import { isReadOnlySelect } from './sqlReadGuard.js';

function log(level, message, meta = {}) {
    const entry = { ts: new Date().toISOString(), level, msg: message, ...meta };
    const fn = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log;
    fn(JSON.stringify(entry));
}

/**
 * Analyze a query and generate optimization suggestions.
 * @param {import('pg').Pool} pool
 * @param {string} queryText
 * @returns {Promise<{
 *   query: string,
 *   plan: any,
 *   suggestions: Array<{priority: 'high'|'medium'|'low', suggestion: string}>
 * }>}
 */
export async function analyzeQuery(pool, queryText) {
    if (!queryText || typeof queryText !== 'string') {
        throw new Error('queryText is required');
    }

    try {
        // ── SQL injection guard ─────────────────────────────────────────
        // We cannot use a parameterized placeholder for the EXPLAIN target
        // because PostgreSQL doesn't support `EXPLAIN $1`.  Instead we:
        //   1. Strip comments (to defeat comment-hiding attacks)
        //   2. Reject anything containing multiple statements (;)
        //   3. Reject any DML / DDL keywords (only SELECT / WITH allowed)
        const sanitized = queryText
            .replace(/--[^\n]*/g, ' ') // strip single-line comments
            .replace(/\/\*[\s\S]*?\*\//g, ' ') // strip block comments
            .trim();

        if (!sanitized) throw new Error('Query is empty after sanitization');

        // Block multiple statements
        if (/;/.test(sanitized.replace(/;$/, ''))) {
            throw new Error('Multiple SQL statements are not allowed');
        }

        // Enforce read-only (single SELECT/CTE) via the shared, literal-aware
        // parser guard — a positive check that the statement STARTS with
        // SELECT/WITH, not just an absence of write keywords (audit M-3).
        if (!isReadOnlySelect(queryText)) {
            throw new Error('Only single read-only SELECT queries are allowed for EXPLAIN analysis');
        }

        const res = await pool.query(`EXPLAIN (FORMAT JSON, ANALYZE false) ${sanitized}`);
        const plan = res.rows[0]['QUERY PLAN'][0];

        const suggestions = [];

        // Check for sequential scans
        if (hasPlanNode(plan, 'Seq Scan')) {
            suggestions.push({
                priority: 'high',
                suggestion: 'Sequential scan detected. Consider adding an index on the filtered/joined columns.',
            });
        }

        // Check for nested loops
        if (hasPlanNode(plan, 'Nested Loop')) {
            suggestions.push({
                priority: 'medium',
                suggestion:
                    'Nested loop join detected. Consider adding indexes on join columns or using a different join strategy.',
            });
        }

        // Check for sorts
        if (hasPlanNode(plan, 'Sort')) {
            suggestions.push({
                priority: 'medium',
                suggestion: 'Sort operation detected. Consider adding an index on the ORDER BY columns.',
            });
        }

        // Check for high startup cost
        const totalCost = extractPlanCost(plan);
        if (totalCost > 10000) {
            suggestions.push({
                priority: 'medium',
                suggestion: `High estimated cost (${totalCost.toFixed(0)}). Review query structure and add indexes on frequently filtered columns.`,
            });
        }

        return {
            query: queryText,
            plan,
            suggestions,
        };
    } catch (err) {
        log('WARN', 'Failed to analyze query', { error: err.message });
        return {
            query: queryText,
            plan: null,
            suggestions: [
                {
                    priority: 'low',
                    suggestion: `Analysis error: ${err.message}. Ensure the query is valid SQL.`,
                },
            ],
        };
    }
}

/**
 * Find top slow queries from pg_stat_statements and generate suggestions for each.
 * @param {import('pg').Pool} pool
 * @param {number} limit
 * @returns {Promise<Array<{
 *   query: string,
 *   meanTime: number,
 *   totalTime: number,
 *   calls: number,
 *   suggestions: Array<{priority: string, suggestion: string}>
 * }>>}
 */
export async function getSlowQuerySuggestions(pool, limit = 10) {
    try {
        // Check if pg_stat_statements extension exists
        const extRes = await pool.query(
            `SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements') as exists`,
        );

        if (!extRes.rows[0].exists) {
            log('WARN', 'pg_stat_statements extension not available');
            return [];
        }

        const res = await pool.query(
            `SELECT query, mean_exec_time, total_exec_time, calls
             FROM   pg_stat_statements
             WHERE  query NOT LIKE 'EXPLAIN%'
                AND query NOT LIKE '%pg_stat_statements%'
             ORDER  BY mean_exec_time DESC
             LIMIT  $1`,
            [limit],
        );

        const suggestions = [];
        for (const row of res.rows) {
            const analysis = await analyzeQuery(pool, row.query).catch(() => ({
                suggestions: [],
            }));

            suggestions.push({
                query: row.query.substring(0, 200),
                meanTime: parseFloat(row.mean_exec_time).toFixed(2),
                totalTime: parseFloat(row.total_exec_time).toFixed(2),
                calls: row.calls,
                suggestions: analysis.suggestions || [],
            });
        }

        return suggestions;
    } catch (err) {
        log('WARN', 'Failed to get slow query suggestions', { error: err.message });
        return [];
    }
}

/**
 * Analyze table access patterns and suggest missing indexes.
 * @param {import('pg').Pool} pool
 * @param {string} tableName
 * @returns {Promise<Array<{
 *   columnName: string,
 *   reason: string,
 *   suggestedIndex: string
 * }>>}
 */
export async function suggestIndexes(pool, tableName) {
    if (!tableName || typeof tableName !== 'string') {
        throw new Error('tableName is required');
    }

    try {
        // Get columns used in WHERE clauses and JOINs from pg_stat_user_tables
        const res = await pool.query(
            `SELECT a.attname, s.idx_scan, s.seq_scan
             FROM   pg_stat_user_tables s
             JOIN   pg_attribute a ON a.attrelid = s.relid
             WHERE  s.relname = $1
                AND s.seq_scan > 0
                AND a.attnum > 0
                AND NOT a.attisdropped
             ORDER  BY s.seq_scan DESC
             LIMIT  5`,
            [tableName],
        );

        const suggestions = [];
        for (const row of res.rows) {
            if (row.seq_scan > 100) {
                suggestions.push({
                    columnName: row.attname,
                    reason: `${row.seq_scan} sequential scans on this column. Index would help.`,
                    suggestedIndex: `CREATE INDEX idx_${tableName}_${row.attname} ON ${tableName} (${row.attname});`,
                });
            }
        }

        return suggestions;
    } catch (err) {
        log('WARN', `Failed to suggest indexes for ${tableName}`, { error: err.message });
        return [];
    }
}

/**
 * Detect common SQL anti-patterns in a query.
 * @param {import('pg').Pool} pool
 * @param {string} queryText
 * @returns {Promise<Array<{
 *   pattern: string,
 *   severity: 'high'|'medium'|'low',
 *   description: string
 * }>>}
 */
export async function detectAntiPatterns(pool, queryText) {
    if (!queryText || typeof queryText !== 'string') {
        throw new Error('queryText is required');
    }

    const antiPatterns = [];
    const upperQuery = queryText.toUpperCase();

    // Pattern: SELECT *
    if (/SELECT\s+\*/.test(upperQuery)) {
        antiPatterns.push({
            pattern: 'SELECT *',
            severity: 'medium',
            description:
                'Avoid SELECT *. Explicitly list columns you need to reduce data transfer and improve query performance.',
        });
    }

    // Pattern: Missing WHERE clause on large table
    if (/FROM\s+\w+\s+(WHERE|LIMIT|ORDER|GROUP|$)/i.test(queryText) && !upperQuery.includes('WHERE')) {
        antiPatterns.push({
            pattern: 'Missing WHERE clause',
            severity: 'high',
            description:
                'Query has no WHERE clause. This may cause a full table scan. Add WHERE conditions to filter data.',
        });
    }

    // Pattern: Multiple implicit type conversions
    const castCount = (queryText.match(/CAST\s*\(/gi) || []).length;
    if (castCount > 2) {
        antiPatterns.push({
            pattern: 'Multiple type casts',
            severity: 'medium',
            description:
                'Multiple type conversions in query. Consider fixing data types in schema to avoid runtime casting.',
        });
    }

    // Pattern: NOT IN with potential NULLs
    if (/NOT\s+IN\s*\(/i.test(queryText)) {
        antiPatterns.push({
            pattern: 'NOT IN with potential NULL',
            severity: 'high',
            description:
                'NOT IN can return unexpected results if the subquery contains NULL values. Use NOT EXISTS instead.',
        });
    }

    // Pattern: Functions on WHERE clause columns
    if (/WHERE\s+.*\(.*\)\s*=/i.test(queryText)) {
        antiPatterns.push({
            pattern: 'Function on filtered column',
            severity: 'high',
            description: 'Applying functions to columns in WHERE clause prevents index usage. Consider restructuring.',
        });
    }

    return antiPatterns;
}

/**
 * Score query complexity based on joins, subqueries, CTEs, etc.
 * @param {import('pg').Pool} pool
 * @param {string} queryText
 * @returns {Promise<{
 *   score: number,
 *   level: 'simple'|'moderate'|'complex',
 *   factors: string[]
 * }>}
 */
export async function getQueryComplexityScore(pool, queryText) {
    if (!queryText || typeof queryText !== 'string') {
        throw new Error('queryText is required');
    }

    let score = 1;
    const factors = [];
    const upperQuery = queryText.toUpperCase();

    // Count JOINs
    const joinCount = (upperQuery.match(/\bJOIN\b/g) || []).length;
    if (joinCount > 0) {
        score += joinCount * 2;
        factors.push(`${joinCount} JOIN(s)`);
    }

    // Count subqueries
    const subqueryCount = (upperQuery.match(/\(SELECT/g) || []).length;
    if (subqueryCount > 0) {
        score += subqueryCount * 3;
        factors.push(`${subqueryCount} subquery/ies`);
    }

    // Count CTEs
    const cteCount = (upperQuery.match(/WITH\s+\w+\s+AS/g) || []).length;
    if (cteCount > 0) {
        score += cteCount * 2;
        factors.push(`${cteCount} CTE(s)`);
    }

    // COUNT GROUP BY
    if (/GROUP\s+BY/i.test(upperQuery)) {
        score += 1.5;
        factors.push('GROUP BY');
    }

    // COUNT HAVING
    if (/HAVING/i.test(upperQuery)) {
        score += 1;
        factors.push('HAVING clause');
    }

    // COUNT UNION
    if (/UNION/i.test(upperQuery)) {
        score += 2;
        factors.push('UNION');
    }

    // COUNT window functions
    if (/OVER\s*\(/i.test(upperQuery)) {
        score += 2;
        factors.push('Window function(s)');
    }

    let level = 'simple';
    if (score > 10) {
        level = 'complex';
    } else if (score > 5) {
        level = 'moderate';
    }

    return {
        score: Math.round(score * 10) / 10,
        level,
        factors,
    };
}

/**
 * Generate a comprehensive optimization report for the database.
 * @param {import('pg').Pool} pool
 * @returns {Promise<{
 *   slowQueries: any[],
 *   missingIndexes: any[],
 *   antiPatterns: any[],
 *   summary: string
 * }>}
 */
export async function generateOptimizationReport(pool) {
    try {
        const slowQueries = await getSlowQuerySuggestions(pool, 5);
        const antiPatterns = [];

        for (const sq of slowQueries) {
            const patterns = await detectAntiPatterns(pool, sq.query).catch(() => []);
            antiPatterns.push(...patterns);
        }

        const missingIndexes = [];
        const tableRes = await pool.query(`SELECT tablename FROM pg_tables WHERE schemaname = $1`, [S]);

        for (const table of tableRes.rows.slice(0, 5)) {
            const suggestions = await suggestIndexes(pool, table.tablename).catch(() => []);
            missingIndexes.push(...suggestions);
        }

        const summary = `Found ${slowQueries.length} slow queries, ${missingIndexes.length} missing index opportunities, and ${antiPatterns.length} anti-patterns.`;

        return {
            slowQueries,
            missingIndexes,
            antiPatterns: Array.from(new Set(antiPatterns.map((p) => JSON.stringify(p)))).map((p) => JSON.parse(p)),
            summary,
        };
    } catch (err) {
        log('ERROR', 'Failed to generate optimization report', { error: err.message });
        throw err;
    }
}

// ─────────────────────────────────────────────────────────────────
// Helper functions
// ─────────────────────────────────────────────────────────────────

/**
 * Check if a plan node of given type exists in the plan tree.
 * @param {any} plan
 * @param {string} nodeType
 * @returns {boolean}
 */
function hasPlanNode(plan, nodeType) {
    if (!plan) return false;
    if (plan['Node Type'] === nodeType) return true;
    if (plan.Plans && Array.isArray(plan.Plans)) {
        return plan.Plans.some((p) => hasPlanNode(p, nodeType));
    }
    return false;
}

/**
 * Extract total cost from plan.
 * @param {any} plan
 * @returns {number}
 */
function extractPlanCost(plan) {
    if (!plan) return 0;
    return plan['Total Cost'] || 0;
}
