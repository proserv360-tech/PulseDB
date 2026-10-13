// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * services/aiMonitoringService.js
 * ──────────────────────────────
 * AI-driven anomaly detection, root cause analysis, and remediation engine.
 * Uses statistical methods (Z-score, IQR) for anomaly detection and pattern matching.
 */

function log(level, message, meta = {}) {
    const entry = { ts: new Date().toISOString(), level, msg: message, ...meta };
    const fn = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log;
    fn(JSON.stringify(entry));
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * ANOMALY DETECTOR — Statistical anomaly detection using Z-score and IQR methods
 * ─────────────────────────────────────────────────────────────────────────────
 */
class AnomalyDetector {
    constructor(windowSize = 100) {
        this.windowSize = windowSize;
        this.windows = {}; // metricId -> array of values
        this.anomalies = []; // detected anomalies
    }

    /**
     * Add a metric value to the rolling window
     */
    addMetricValue(metricId, value, timestamp = new Date()) {
        if (!this.windows[metricId]) {
            this.windows[metricId] = [];
        }
        this.windows[metricId].push({ value, timestamp });

        // Keep only last windowSize entries
        if (this.windows[metricId].length > this.windowSize) {
            this.windows[metricId].shift();
        }
    }

    /**
     * Calculate Z-score for a value
     */
    calculateZScore(values, value) {
        if (values.length < 2) return 0;
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
        const stdDev = Math.sqrt(variance);
        return stdDev === 0 ? 0 : (value - mean) / stdDev;
    }

    /**
     * Calculate IQR (Interquartile Range)
     */
    calculateIQR(values) {
        if (values.length < 4) return { q1: 0, q3: 0, iqr: 0 };
        const sorted = [...values].sort((a, b) => a - b);
        const q1 = sorted[Math.floor(sorted.length * 0.25)];
        const q3 = sorted[Math.floor(sorted.length * 0.75)];
        const iqr = q3 - q1;
        return { q1, q3, iqr };
    }

    /**
     * Detect anomalies using Z-score and IQR methods
     */
    detectAnomalies(metricId, currentValue, threshold = { zScore: 2.5, criticalZScore: 3.5 }) {
        const window = this.windows[metricId];
        if (!window || window.length < 2) return null;

        const values = window.map(v => v.value);
        const zScore = this.calculateZScore(values, currentValue);
        const { q1, q3, iqr } = this.calculateIQR(values);

        // IQR method: outliers are > Q3 + 1.5*IQR or < Q1 - 1.5*IQR
        const isOutlierByIQR = currentValue > (q3 + 1.5 * iqr) || currentValue < (q1 - 1.5 * iqr);

        // Determine severity
        let severity = 'none';
        if (Math.abs(zScore) > threshold.criticalZScore) {
            severity = 'critical';
        } else if (Math.abs(zScore) > threshold.zScore || isOutlierByIQR) {
            severity = 'warning';
        }

        if (severity === 'none') return null;

        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const stdDev = Math.sqrt(values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length);

        return {
            metricId,
            value: currentValue,
            expectedRange: [
                Math.max(q1 - 1.5 * iqr, mean - 2 * stdDev),
                Math.min(q3 + 1.5 * iqr, mean + 2 * stdDev),
            ],
            zScore: parseFloat(zScore.toFixed(2)),
            severity,
            timestamp: new Date().toISOString(),
            description: this.getAnomalyDescription(metricId, currentValue, severity),
        };
    }

    /**
     * Generate human-readable anomaly description
     */
    getAnomalyDescription(metricId, value, severity) {
        const descriptions = {
            'cpu_usage': `CPU usage is ${severity === 'critical' ? 'critically' : 'unusually'} high at ${value.toFixed(1)}%`,
            'memory_usage': `Memory usage is ${severity === 'critical' ? 'critically' : 'unusually'} high at ${value.toFixed(1)}%`,
            'disk_io': `Disk I/O is ${severity === 'critical' ? 'critically' : 'unusually'} elevated`,
            'cache_hit_ratio': `Cache hit ratio dropped to ${value.toFixed(2)}% — queries may be hitting disk more often`,
            'active_connections': `Active connections spike detected — ${Math.floor(value)} connections active`,
            'lock_wait_time': `Lock wait time elevated — possible contention`,
            'replication_lag': `Replication lag detected — replica may be falling behind`,
            'dead_tuples': `High dead tuple ratio — vacuum may not be keeping up`,
            'transaction_time': `Transaction duration is unusually long — possible slow query`,
        };
        return descriptions[metricId] || `Anomaly detected in ${metricId}`;
    }

    /**
     * Get all current anomalies
     */
    getAnomalies() {
        return this.anomalies;
    }

    /**
     * Clear anomaly history
     */
    clearAnomalies() {
        this.anomalies = [];
    }
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * ROOT CAUSE ANALYZER — Pattern-based root cause identification
 * ─────────────────────────────────────────────────────────────────────────────
 */
class RootCauseAnalyzer {
    constructor() {
        this.patterns = this.initializePatterns();
    }

    /**
     * Initialize known patterns and their indicators
     */
    initializePatterns() {
        return [
            {
                name: 'Connection Storm',
                indicators: ['high_cpu', 'high_active_connections'],
                cause: 'Connection storm: too many concurrent connections consuming CPU',
                confidence: 0.9,
                evidence: [],
                suggestedActions: [
                    { action: 'Review max_connections setting', type: 'config', risk: 'low' },
                    { action: 'Implement connection pooling (PgBouncer, Pgpool)', type: 'infrastructure', risk: 'medium' },
                    { action: 'Analyze long-running transactions', type: 'query', risk: 'low' },
                ],
            },
            {
                name: 'Memory Pressure',
                indicators: ['low_cache_hit_ratio', 'high_disk_reads'],
                cause: 'Working set exceeds available memory — consider increasing shared_buffers',
                confidence: 0.85,
                evidence: [],
                suggestedActions: [
                    { action: 'Increase shared_buffers', sql: "SELECT 'Current: ' || setting FROM pg_settings WHERE name='shared_buffers'", risk: 'medium', automated: false },
                    { action: 'Increase work_mem', sql: "ALTER DATABASE mydb SET work_mem = '256MB'", risk: 'medium', automated: false },
                    { action: 'Review and optimize queries', type: 'manual', description: 'Add indexes for frequently accessed columns' },
                ],
            },
            {
                name: 'Lock Contention',
                indicators: ['high_lock_waits', 'long_transactions'],
                cause: 'Lock contention from long-running transactions — check for uncommitted transactions',
                confidence: 0.88,
                evidence: [],
                suggestedActions: [
                    {
                        action: 'Terminate long-running idle transactions',
                        sql: "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle in transaction' AND now() - xact_start > interval '30 minutes'",
                        risk: 'medium',
                        automated: false,
                    },
                    { action: 'Set statement_timeout', sql: "ALTER DATABASE mydb SET statement_timeout = '5min'", risk: 'low', automated: true },
                    { action: 'Review application connection handling', type: 'manual', description: 'Ensure COMMIT/ROLLBACK on all code paths' },
                ],
            },
            {
                name: 'Replication Lag',
                indicators: ['high_replication_lag', 'high_wal_generation'],
                cause: 'Replica falling behind due to heavy write workload',
                confidence: 0.82,
                evidence: [],
                suggestedActions: [
                    { action: 'Check replica resources (CPU, disk, network)', type: 'manual', description: 'Ensure replica has sufficient capacity' },
                    { action: 'Review slow queries on replica', type: 'query', risk: 'low' },
                    { action: 'Increase wal_keep_segments', sql: "ALTER SYSTEM SET wal_keep_segments = 2048", risk: 'low', automated: false },
                    { action: 'Consider read replicas for write-heavy workloads', type: 'infrastructure', risk: 'high' },
                ],
            },
            {
                name: 'Autovacuum Lag',
                indicators: ['high_dead_tuples', 'old_vacuum_timestamp'],
                cause: 'Autovacuum not keeping up — consider more aggressive vacuum settings',
                confidence: 0.80,
                evidence: [],
                suggestedActions: [
                    { action: 'Increase autovacuum_naptime', sql: "ALTER SYSTEM SET autovacuum_naptime = '5s'", risk: 'low', automated: true },
                    { action: 'Increase autovacuum_max_workers', sql: "ALTER SYSTEM SET autovacuum_max_workers = 4", risk: 'low', automated: false },
                    { action: 'Run VACUUM manually on bloated tables', sql: 'VACUUM ANALYZE;', risk: 'medium', automated: false },
                ],
            },
            {
                name: 'Connection Pool Exhaustion',
                indicators: ['high_connection_count', 'connection_errors'],
                cause: 'Connection pool exhaustion — increase max_connections or use a pooler',
                confidence: 0.85,
                evidence: [],
                suggestedActions: [
                    { action: 'Deploy connection pooler', type: 'infrastructure', risk: 'high' },
                    { action: 'Increase max_connections', sql: "ALTER SYSTEM SET max_connections = 400", risk: 'medium', automated: false },
                    { action: 'Terminate idle connections', sql: "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle'", risk: 'high', automated: false },
                ],
            },
            {
                name: 'Query Performance Degradation',
                indicators: ['high_cpu', 'many_slow_queries'],
                cause: 'Query performance degradation — review expensive query plans',
                confidence: 0.88,
                evidence: [],
                suggestedActions: [
                    { action: 'Analyze slow query logs', type: 'manual', description: 'Review queries taking > 5s' },
                    { action: 'Add missing indexes', type: 'query', risk: 'low' },
                    { action: 'Rewrite inefficient queries', type: 'manual', description: 'Use EXPLAIN ANALYZE' },
                ],
            },
            {
                name: 'Work Memory Spill',
                indicators: ['high_memory', 'many_temp_files'],
                cause: 'Work_mem too low — queries spilling to disk',
                confidence: 0.83,
                evidence: [],
                suggestedActions: [
                    { action: 'Increase work_mem', sql: "ALTER SYSTEM SET work_mem = '512MB'", risk: 'medium', automated: false },
                    { action: 'Review memory-intensive queries', type: 'query', risk: 'low' },
                    { action: 'Optimize sorting and hashing operations', type: 'manual', description: 'Consider partitioning or streaming' },
                ],
            },
        ];
    }

    /**
     * Analyze anomalies and suggest root causes
     */
    analyzeAnomalies(anomalies) {
        const anomalyIds = new Set(anomalies.map(a => a.metricId));
        const probableCauses = [];

        for (const pattern of this.patterns) {
            // Check if this pattern's indicators match current anomalies
            const matchedIndicators = pattern.indicators.filter(ind => {
                // Map indicator names to metric IDs (simplified matching)
                const metricMap = {
                    'high_cpu': 'cpu_usage',
                    'high_active_connections': 'active_connections',
                    'low_cache_hit_ratio': 'cache_hit_ratio',
                    'high_disk_reads': 'disk_io',
                    'high_lock_waits': 'lock_wait_time',
                    'long_transactions': 'transaction_time',
                    'high_replication_lag': 'replication_lag',
                    'high_wal_generation': 'wal_generation',
                    'high_dead_tuples': 'dead_tuples',
                    'old_vacuum_timestamp': 'last_vacuum_time',
                    'high_connection_count': 'active_connections',
                    'connection_errors': 'connection_errors',
                    'many_slow_queries': 'slow_query_count',
                    'many_temp_files': 'temp_files_created',
                };
                const metricId = metricMap[ind];
                return metricId && anomalyIds.has(metricId);
            });

            // If at least half of indicators are present, it's a probable cause
            if (matchedIndicators.length >= Math.ceil(pattern.indicators.length / 2)) {
                const cause = {
                    cause: pattern.cause,
                    confidence: pattern.confidence,
                    evidence: matchedIndicators.map(ind => `${ind} detected`),
                    suggestedActions: pattern.suggestedActions,
                };
                probableCauses.push(cause);
            }
        }

        // Sort by confidence
        probableCauses.sort((a, b) => b.confidence - a.confidence);
        return { probableCauses };
    }
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * REMEDIATION ENGINE — Execute suggested remediation actions
 * ─────────────────────────────────────────────────────────────────────────────
 */
class RemediationEngine {
    /**
     * Execute a remediation action
     */
    static async executeAction(pool, action) {
        try {
            if (action.automated === false) {
                return { status: 'requires_approval', message: `Manual action required: ${action.action}` };
            }

            if (action.sql) {
                const result = await pool.query(action.sql);
                return { status: 'success', message: `Executed: ${action.action}`, result };
            }

            return { status: 'info', message: `${action.action} - manual intervention required` };
        } catch (err) {
            log('ERROR', 'Failed to execute remediation', { action: action.action, error: err.message });
            return { status: 'error', message: err.message };
        }
    }

    /**
     * Get remediation suggestions for a cause
     */
    static getSuggestionsForCause(cause) {
        return {
            cause: cause.cause,
            confidence: cause.confidence,
            evidence: cause.evidence,
            suggestedActions: cause.suggestedActions,
        };
    }
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * NATURAL LANGUAGE QUERY INTERFACE — Map natural language to SQL
 * ─────────────────────────────────────────────────────────────────────────────
 */
class NaturalLanguageQuery {
    constructor() {
        this.patterns = this.initializeQueryPatterns();
    }

    /**
     * Initialize question patterns and their corresponding queries
     */
    initializeQueryPatterns() {
        return [
            {
                pattern: /slowest queries|slow.*query|performance.*query|query.*slow/i,
                interpretation: 'Finding slowest queries',
                query: `SELECT query, calls, total_exec_time, mean_exec_time, rows
                        FROM pg_stat_statements
                        WHERE query NOT LIKE '%pg_stat%'
                        ORDER BY mean_exec_time DESC
                        LIMIT 10`,
                explanation: 'Shows queries with highest average execution time',
            },
            {
                pattern: /table.*bloom|bloat|table.*size|bloated/i,
                interpretation: 'Finding bloated tables',
                query: `SELECT schemaname, tablename,
                       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
                       ROUND(100 * (pg_total_relation_size(schemaname||'.'||tablename) -
                              pg_relation_size(schemaname||'.'||tablename)) /
                              pg_total_relation_size(schemaname||'.'||tablename)) as external_ratio
                FROM pg_tables
                WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
                ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
                LIMIT 10`,
                explanation: 'Shows table sizes and external storage ratio (indexes/toast)',
            },
            {
                pattern: /replication.*lag|replica.*lag|standby.*lag/i,
                interpretation: 'Checking replication lag',
                query: `SELECT client_addr, state, write_lag, flush_lag, replay_lag
                        FROM pg_stat_replication`,
                explanation: 'Shows replication lag for connected replicas',
            },
            {
                pattern: /active.*connection|connection.*count|how.*many|concurrent/i,
                interpretation: 'Counting active connections',
                query: `SELECT COUNT(*) as active_connections,
                       COUNT(*) FILTER (WHERE state='active') as executing,
                       COUNT(*) FILTER (WHERE state='idle') as idle
                FROM pg_stat_activity
                WHERE usename NOT IN ('pg_monitor')`,
                explanation: 'Shows breakdown of active, executing, and idle connections',
            },
            {
                pattern: /disk.*space|storage.*usage|database.*size/i,
                interpretation: 'Checking disk usage',
                query: `SELECT datname, pg_size_pretty(pg_database_size(datname)) as size
                        FROM pg_database
                        WHERE datname NOT IN ('postgres', 'template0', 'template1')
                        ORDER BY pg_database_size(datname) DESC`,
                explanation: 'Shows database sizes',
            },
            {
                pattern: /locks?|deadlock|contention|blocking/i,
                interpretation: 'Checking for locks',
                query: `SELECT l.pid, l.usename, l.granted, l.locktype, l.relation
                        FROM pg_locks l
                        WHERE NOT l.granted
                        LIMIT 20`,
                explanation: 'Shows locks that are not granted (blocking situations)',
            },
            {
                pattern: /health|status|diagnostic|overview/i,
                interpretation: 'Database health check',
                query: `SELECT
                       (SELECT count(*) FROM pg_stat_activity) as total_connections,
                       (SELECT setting::int FROM pg_settings WHERE name='max_connections') as max_connections,
                       (SELECT ROUND(sum(heap_blks_hit)/NULLIF(sum(heap_blks_hit)+sum(heap_blks_read),0)*100,2)
                        FROM pg_statio_user_tables) as cache_hit_ratio,
                       (SELECT EXTRACT(EPOCH FROM (now() - pg_postmaster_start_time())))::int as uptime_seconds,
                       pg_database_size(current_database()) as database_size_bytes`,
                explanation: 'Composite health score based on connections, cache, and uptime',
            },
            {
                pattern: /recent.*change|schema.*change|migration|alter/i,
                interpretation: 'Reviewing recent changes',
                query: `SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename))
                        FROM pg_tables
                        WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
                        ORDER BY 3 DESC
                        LIMIT 10`,
                explanation: 'Shows recently modified tables (by size)',
            },
        ];
    }

    /**
     * Parse natural language question and return matching query
     */
    async parseQuestion(question, pool) {
        if (!question || typeof question !== 'string') {
            return { error: 'Question must be a non-empty string' };
        }

        for (const pattern of this.patterns) {
            if (pattern.pattern.test(question)) {
                try {
                    const result = await pool.query(pattern.query);
                    return {
                        interpretation: pattern.interpretation,
                        query: pattern.query,
                        results: result.rows,
                        explanation: pattern.explanation,
                    };
                } catch (err) {
                    return {
                        interpretation: pattern.interpretation,
                        query: pattern.query,
                        error: err.message,
                        explanation: pattern.explanation,
                    };
                }
            }
        }

        return {
            error: 'Could not interpret question. Try asking about: slowest queries, bloated tables, replication lag, connections, disk space, locks, or database health.',
        };
    }
}

export { AnomalyDetector, RootCauseAnalyzer, RemediationEngine, NaturalLanguageQuery };
