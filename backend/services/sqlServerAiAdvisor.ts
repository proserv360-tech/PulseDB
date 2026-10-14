// @ts-nocheck — new module 2026-10 (see docs/TS_MIGRATION.md)
/**
 * AI review for the SQL Server screens.
 *
 * Sends a compact summary of one screen — the advisor's findings, key metrics
 * and the top items (queries, indexes, files…) — to the configured AI provider
 * (services/copilotService getProvider: Groq, Anthropic or OpenAI) and returns
 * a prioritised plan with T-SQL for a DBA to review. Nothing is executed.
 *
 * Privacy: no row data from user tables is sent. Query text is included for
 * query tuning, with string literals masked and secrets redacted.
 */
import { getProvider, redact } from './copilotService.js';

const MAX_CONTEXT_CHARS = 12_000;

/** Mask string literals ('…', N'…') so customer values in query text never leave. */
export function maskSql(text) {
    return redact(String(text || '').replace(/N?'(?:[^']|'')*'/g, "'?'")).slice(0, 3000);
}

const pick = (row, keys) => Object.fromEntries(keys.filter((k) => row?.[k] !== undefined && row?.[k] !== null).map((k) => [k, row[k]]));

function viewFacts(view, d, live) {
    const l = live || {};
    switch (view) {
        case 'overview':
            return {
                server: pick(d.server?.[0], ['product_name', 'product_version', 'edition', 'cpu_count', 'physical_memory_kb', 'uptime_seconds']),
                activity: d.activity?.[0],
                cpu_recent_pct: (d.cpuHistory || []).slice(0, 10).map((r) => r.sql_cpu_pct),
                memory: d.memory?.[0],
                databases: (d.databases || []).map((x) => pick(x, ['name', 'state_desc', 'recovery_model_desc', 'data_mb', 'log_mb', 'log_reuse_wait_desc'])),
                health_checks: d.alerts,
                live: pick(l, ['batchPerSec', 'transactionsPerSec', 'compilationsPerSec', 'pageLifeExpectancy', 'bufferCacheHitPct', 'memoryGrantsPending', 'deadlocksPerSec']),
            };
        case 'performance':
            return {
                config: d.serverConfig?.[0],
                wait_categories: d.waitCategories,
                top_waits: (d.waits || []).slice(0, 10).map((w) => pick(w, ['wait_type', 'category', 'pct', 'avg_wait_ms'])),
                top_queries_by_cpu: [...(d.topQueries || [])]
                    .sort((a, b) => b.total_cpu_ms - a.total_cpu_ms)
                    .slice(0, 5)
                    .map((x) => ({ ...pick(x, ['execution_count', 'avg_cpu_ms', 'avg_elapsed_ms', 'avg_logical_reads', 'database_name', 'object_name']), sql: maskSql(x.query_text).slice(0, 600) })),
                live: pick(l, ['batchPerSec', 'compilationsPerSec', 'signalWaitPct', 'pageSplitsPerSec', 'fullScansPerSec', 'lockWaitsPerSec']),
            };
        case 'storage':
            return {
                index_summary: d.indexSummary?.[0],
                largest_tables: (d.tables || []).slice(0, 10).map((t) => pick(t, ['schema_name', 'table_name', 'row_count', 'reserved_kb', 'is_heap'])),
                missing_indexes: (d.missingIndexes || []).slice(0, 10),
                fragmented: (d.fragmentation || []).filter((f) => f.action).slice(0, 10),
                duplicates: (d.duplicates || []).slice(0, 10),
            };
        case 'memory':
            return { config: d.serverConfig?.[0], memory: d.memory?.[0], clerks: d.clerks, plan_cache: d.planCache, tempdb_files: d.tempdbFiles, tempdb_usage: d.tempdbUsage?.[0], live: pick(l, ['pageLifeExpectancy', 'bufferCacheHitPct', 'memoryGrantsPending', 'lazyWritesPerSec']) };
        case 'io':
            return {
                files: (d.files || []).slice(0, 15).map((f) => pick(f, ['database_name', 'file_name', 'type_desc', 'size_mb', 'growth', 'avg_read_ms', 'avg_write_ms', 'num_of_reads', 'num_of_writes'])),
                volumes: d.volumes,
                log_usage: d.logUsage,
                live: pick(l, ['readsPerSec', 'writesPerSec', 'readLatencyMs', 'writeLatencyMs']),
            };
        case 'backups':
            return { backups: d.backups, recent: (d.recent || []).slice(0, 10).map((b) => pick(b, ['database_name', 'backup_type', 'backup_finish_date', 'size_mb'])), jobs: d.jobs, services: d.services, settings: d.settings?.[0] };
        case 'security':
            return {
                summary: d.summary?.[0],
                sysadmins: (d.sysadmins || []).map((x) => pick(x, ['name', 'type_desc', 'is_disabled'])),
                sql_logins: (d.sqlLogins || []).map((x) => pick(x, ['name', 'is_disabled', 'is_policy_checked', 'is_expiration_checked', 'blank_password', 'password_is_login_name', 'is_sysadmin'])),
                config: d.config,
                databases: d.databases,
                failed_login_count: (d.failedLogins || []).length,
            };
        case 'sessions':
            return {
                blocking: (d.blocking || []).map((b) => ({ ...pick(b, ['blocked_session', 'blocking_session', 'wait_type', 'wait_ms', 'wait_resource']), blocked_sql: maskSql(b.blocked_statement).slice(0, 400) })),
                long_transactions: (d.transactions || []).filter((t) => t.duration_sec > 60),
                lock_summary: d.locks,
                deadlocks: (d.deadlocks || []).slice(0, 3).map((x) => ({ resources: x.resources, statements: (x.processes || []).map((p) => maskSql(p.statement).slice(0, 300)) })),
                live: pick(l, ['lockWaitsPerSec', 'avgLockWaitMs', 'processesBlocked']),
            };
        case 'querystore':
            return {
                options: d.options?.[0],
                regressed: (d.regressed || []).slice(0, 5).map((r) => ({ ...pick(r, ['query_id', 'best_plan_id', 'current_plan_id', 'best_avg_ms', 'current_avg_ms', 'regression_pct']), sql: maskSql(r.query_text).slice(0, 500) })),
                top: (d.top || []).slice(0, 5).map((r) => ({ ...pick(r, ['query_id', 'executions', 'avg_duration_ms', 'avg_cpu_ms', 'avg_logical_reads', 'plan_count']), sql: maskSql(r.query_text).slice(0, 500) })),
            };
        case 'alwayson':
            return { status: d.status?.[0], groups: d.groups, replicas: d.replicas, databases: d.databases };
        default:
            return {};
    }
}

const SYSTEM = `You are a senior Microsoft SQL Server DBA advising the operator of the server described below.
Use only the data provided; when something needed is missing, say what to check instead of guessing.
The data is a monitoring snapshot (DMVs). "advisor_findings" were produced by rules and are a good starting point; confirm, re-prioritise or add to them.
Answer in this structure, in plain language, concise:
1. **Summary** — 2–3 sentences on the overall state.
2. **Top actions** — numbered, most impactful first; for each: what to do, why (cite the numbers), expected effect.
3. **Scripts** — T-SQL in \`\`\`sql blocks for the actions that need it, ready to review. Use the real object names from the data.
4. **Risks** — what to check or schedule before running anything.
Never suggest disabling security features, dropping databases, or shrinking data files. Scripts are reviewed and run by a person; PulseDB never runs them.`;

const QUERY_SYSTEM = `You are a senior Microsoft SQL Server performance engineer. Tune the single query below.
String literals are masked as '?'. Use the execution statistics and context given; do not invent table definitions.
Answer concisely:
1. **Why it is expensive** — reasoning from the statistics (reads, CPU, executions).
2. **Fixes** — numbered: indexes (CREATE INDEX in \`\`\`sql), query rewrites (show the rewritten query), statistics, parameterisation.
3. **Check first** — what to verify (existing indexes, actual plan) before applying.`;

/**
 * @param {object} snapshot  result of collectSqlServerView for this view
 * @param {object} [focus]   { kind: 'query', text, stats } to tune one query
 * @returns {Promise<{ text, provider, model }>}
 */
export async function adviseSqlServer(view, snapshot, focus) {
    const provider = getProvider();
    if (provider.name === 'local') {
        throw Object.assign(
            new Error(
                'AI is not configured on this PulseDB server. Set GROQ_API_KEY (free at console.groq.com), ANTHROPIC_API_KEY or OPENAI_API_KEY in the server environment and redeploy.',
            ),
            { status: 503, code: 'AI_NOT_CONFIGURED' },
        );
    }
    const server = snapshot?.data?.serverConfig?.[0] || {};
    let system;
    let user;
    if (focus?.kind === 'query' && focus.text) {
        system = QUERY_SYSTEM;
        user = JSON.stringify(
            {
                server: pick(server, ['edition', 'cpu_count', 'maxdop', 'cost_threshold']),
                statistics: focus.stats || {},
                missing_index_suggestions: (snapshot?.data?.missingIndexes || []).slice(0, 10),
                query: maskSql(focus.text),
            },
            null,
            1,
        );
    } else {
        system = SYSTEM;
        user = JSON.stringify(
            {
                screen: view,
                advisor_findings: (snapshot?.data?.recommendations || []).map((r) => pick(r, ['severity', 'category', 'title', 'detail', 'sql'])),
                data: viewFacts(view, snapshot?.data || {}, snapshot?.live),
                panel_errors: snapshot?.errors,
            },
            null,
            1,
        );
    }
    if (user.length > MAX_CONTEXT_CHARS) user = user.slice(0, MAX_CONTEXT_CHARS) + '\n…(truncated)';
    const text = await provider.complete({ system, user, maxTokens: 1500 });
    return { text, provider: provider.name, model: provider.model };
}
