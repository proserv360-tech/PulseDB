/* Auto-generated metric catalog. */

import { MetricCatalog, Metric, MetricSection, MetricTier } from '../metricsCatalog';
import { THEME } from '../theme';

const ACCENT = THEME.aiDark;

const sections: MetricSection[] = [
    { key: 'overview', label: 'Overview', order: 1, color: THEME.aiDark },
    { key: 'wlm', label: 'WLM Queues', order: 2, color: '#0078D4' },
    { key: 'queries', label: 'Queries', order: 3, color: '#F2C744' },
    { key: 'storage', label: 'Storage & Dist.', order: 4, color: '#107C10' },
    { key: 'vacuum', label: 'Vacuum & Analyze', order: 5, color: '#5C2D91' },
    { key: 'spectrum', label: 'Spectrum', order: 6, color: '#D83B01' },
    { key: 'snapshots', label: 'Snapshots', order: 7, color: '#00B7C3' },
    { key: 'concurrency', label: 'Concurrency Scaling', order: 8, color: '#8764B8' },
    { key: 'audit', label: 'Audit & Logging', order: 9, color: '#E3008C' },
    { key: 'security', label: 'Security', order: 10, color: '#A4262C' },
];

const m = (
    id: string, label: string, section: string, tier: MetricTier,
    unit = '', description = '', extras: Partial<Metric> = {},
): Metric => ({ id, label, section, tier, unit, description, ...extras });

const metrics: Metric[] = [
    m('rs.cluster.nodes', 'Compute nodes', 'overview', 'basic', '', 'SVL_QUERY_SUMMARY distinct slice / node.', { format: 'count', baseValue: 8, range: 0 }),
    m('rs.cluster.node_type', 'Node type', 'overview', 'basic', '', 'ra3.4xlarge, dc2.large…', { baseValue: 3, range: 0 }),
    m('rs.cluster.encryption', 'Encryption', 'overview', 'basic', '', '1=AES, 0=none.', { baseValue: 1, range: 0 }),
    m('rs.cluster.cpu_pct', 'Avg CPU %', 'overview', 'basic', '%', 'SVCS_NODE CPUUtilization.', { format: 'percent', baseValue: 58, range: 18 }),
    m('rs.cluster.disk_used_pct', 'Disk used %', 'overview', 'basic', '%', 'STV_BLOCKLIST used_blocks.', { format: 'percent', baseValue: 68, range: 12 }),
    m('rs.cluster.connections', 'Active connections', 'overview', 'basic', '', 'STV_SESSIONS count.', { format: 'count', baseValue: 84, range: 22 }),
    m('rs.cluster.qps', 'Queries / sec', 'overview', 'intermediate', '/s', 'STL_QUERY rate.', { format: 'count', baseValue: 14, range: 6 }),
    m('rs.cluster.failed_24h', 'Failed queries (24h)', 'overview', 'basic', '', 'STL_QUERY aborted.', { format: 'count', baseValue: 42, range: 22 }),
    m('rs.cluster.users', 'Users', 'overview', 'intermediate', '', 'pg_user count.', { format: 'count', baseValue: 140, range: 18 }),
    m('rs.wlm.queues', 'WLM queues', 'wlm', 'basic', '', 'STV_WLM_SERVICE_CLASS_CONFIG count.', { format: 'count', baseValue: 6, range: 0 }),
    m('rs.wlm.queued_queries', 'Queued queries', 'wlm', 'basic', '', 'STV_WLM_QUERY_STATE state=Queued.', { format: 'count', baseValue: 3, range: 6 }),
    m('rs.wlm.executing', 'Executing queries', 'wlm', 'basic', '', 'state=Executing.', { format: 'count', baseValue: 18, range: 8 }),
    m('rs.wlm.avg_queue_time', 'Avg queue wait', 'wlm', 'intermediate', 's', 'avg queue_time/1e6.', { baseValue: 1.8, range: 1.2 }),
    m('rs.wlm.p95_queue_time', 'p95 queue wait', 'wlm', 'intermediate', 's', 'p95 queue_time.', { baseValue: 12, range: 6 }),
    m('rs.wlm.evicted', 'Evicted queries', 'wlm', 'advanced', '/d', 'STL_WLM_RULE_ACTION action=evict.', { format: 'count', baseValue: 4, range: 4 }),
    m('rs.wlm.aborted', 'Aborted by WLM', 'wlm', 'advanced', '/d', 'WLM aborts.', { format: 'count', baseValue: 2, range: 4 }),
    m('rs.wlm.short_query_off', 'SQA off', 'wlm', 'advanced', '', '1 = SQA disabled, 0 = enabled.', { baseValue: 0, range: 0 }),
    m('rs.q.avg_exec_time', 'Avg execution', 'queries', 'basic', 's', 'avg exec_time/1e6.', { baseValue: 4.2, range: 1.8 }),
    m('rs.q.p95_exec_time', 'p95 execution', 'queries', 'intermediate', 's', 'p95 exec.', { baseValue: 42, range: 22 }),
    m('rs.q.cache_hits', 'Result cache hits %', 'queries', 'intermediate', '%', 'SVL_QLOG cache_hits.', { format: 'percent', baseValue: 42, range: 12, higherIsBetter: true }),
    m('rs.q.copy_rate', 'COPY rate', 'queries', 'intermediate', 'MB/s', 'STL_LOAD_COMMITS rate.', { format: 'number', baseValue: 184, range: 40 }),
    m('rs.q.unload_rate', 'UNLOAD rate', 'queries', 'intermediate', 'MB/s', 'STL_UNLOAD rate.', { format: 'number', baseValue: 120, range: 22 }),
    m('rs.q.spilled_disk', 'Queries spilling to disk', 'queries', 'intermediate', '/d', 'STL_S3CLIENT spilled.', { format: 'count', baseValue: 24, range: 12 }),
    m('rs.q.broadcast', 'Broadcast joins (24h)', 'queries', 'advanced', '/d', 'plans with DS_BCAST.', { format: 'count', baseValue: 18, range: 8 }),
    m('rs.q.long_running', 'Long-running (> 5m)', 'queries', 'intermediate', '', 'duration > 300s.', { format: 'count', baseValue: 8, range: 6 }),
    m('rs.st.tables', 'Tables', 'storage', 'basic', '', 'PG_TABLE_DEF count.', { format: 'count', baseValue: 420, range: 60 }),
    m('rs.st.rows', 'Total rows', 'storage', 'basic', '', 'sum of tbl_rows.', { format: 'count', baseValue: 4820000000, range: 400000000 }),
    m('rs.st.skew_avg', 'Avg distribution skew', 'storage', 'intermediate', '', 'avg skew_rows.', { baseValue: 0.18, range: 0.08 }),
    m('rs.st.skew_high', 'High-skew tables', 'storage', 'advanced', '', 'tables skew > 0.4.', { format: 'count', baseValue: 8, range: 4 }),
    m('rs.st.dist_all', 'DISTSTYLE ALL tables', 'storage', 'intermediate', '', 'PG_CLASS distkey style ALL.', { format: 'count', baseValue: 24, range: 4 }),
    m('rs.st.dist_even', 'DISTSTYLE EVEN', 'storage', 'intermediate', '', 'EVEN dist tables.', { format: 'count', baseValue: 140, range: 20 }),
    m('rs.st.dist_key', 'DISTSTYLE KEY', 'storage', 'intermediate', '', 'KEY dist tables.', { format: 'count', baseValue: 256, range: 24 }),
    m('rs.st.dist_auto', 'DISTSTYLE AUTO', 'storage', 'advanced', '', 'AUTO dist tables.', { format: 'count', baseValue: 82, range: 20 }),
    m('rs.st.sortkey_pct', 'Tables w/ sortkey', 'storage', 'intermediate', '%', 'tables with sortkey defined.', { format: 'percent', baseValue: 84, range: 8, higherIsBetter: true }),
    m('rs.st.zonemaps_misses', 'Zonemap misses', 'storage', 'advanced', '%', 'STL_SCAN zonemap miss ratio.', { format: 'percent', baseValue: 22, range: 8 }),
    m('rs.vac.unsorted_pct', 'Unsorted rows %', 'vacuum', 'basic', '%', 'avg pg_class unsorted/rows.', { format: 'percent', baseValue: 14, range: 8 }),
    m('rs.vac.last_run_h', 'Last vacuum (h)', 'vacuum', 'basic', 'h', 'hours since SVV_VACUUM_SUMMARY.', { baseValue: 12, range: 8 }),
    m('rs.vac.deleted_rows', 'Deleted rows %', 'vacuum', 'intermediate', '%', 'deleted rows / total.', { format: 'percent', baseValue: 8, range: 4 }),
    m('rs.vac.tables_need_analyze', 'Tables needing ANALYZE', 'vacuum', 'intermediate', '', 'SVV_TABLE_INFO empty stats.', { format: 'count', baseValue: 12, range: 6 }),
    m('rs.vac.auto_vac_pct', 'Auto-vacuum coverage', 'vacuum', 'advanced', '%', 'auto-vacuum eligible tables.', { format: 'percent', baseValue: 92, range: 6, higherIsBetter: true }),
    m('rs.spec.queries_24h', 'Spectrum queries (24h)', 'spectrum', 'intermediate', '', 'SVL_S3QUERY count.', { format: 'count', baseValue: 420, range: 80 }),
    m('rs.spec.bytes_scanned', 'Bytes scanned (24h)', 'spectrum', 'basic', 'TB', 'SVL_S3QUERY bytes.', { format: 'number', baseValue: 4.2, range: 1.4 }),
    m('rs.spec.cost', 'Spectrum cost (24h)', 'spectrum', 'intermediate', '$', 'bytes * $5/TB.', { format: 'currency', baseValue: 20, range: 8 }),
    m('rs.spec.external_tables', 'External tables', 'spectrum', 'intermediate', '', 'SVV_EXTERNAL_TABLES.', { format: 'count', baseValue: 42, range: 8 }),
    m('rs.spec.external_schemas', 'External schemas', 'spectrum', 'advanced', '', 'SVV_EXTERNAL_SCHEMAS.', { format: 'count', baseValue: 6, range: 2 }),
    m('rs.snap.last_age_h', 'Last snapshot age', 'snapshots', 'basic', 'h', 'hours since latest snapshot.', { baseValue: 6, range: 2 }),
    m('rs.snap.retention_days', 'Retention', 'snapshots', 'basic', 'days', 'automated_snapshot_retention_period.', { baseValue: 14, range: 0 }),
    m('rs.snap.manual_count', 'Manual snapshots', 'snapshots', 'intermediate', '', 'snapshot_type=manual.', { format: 'count', baseValue: 24, range: 4 }),
    m('rs.snap.failed_24h', 'Failed snapshots (24h)', 'snapshots', 'basic', '', 'snapshot errors.', { format: 'count', baseValue: 0, range: 2 }),
    m('rs.snap.cross_region', 'Cross-region copies', 'snapshots', 'advanced', '', 'cross-region copy enabled.', { baseValue: 1, range: 0 }),
    m('rs.cs.minutes_today', 'CS minutes today', 'concurrency', 'basic', 'min', 'concurrency_scaling minutes.', { baseValue: 120, range: 42 }),
    m('rs.cs.queries_offloaded', 'Queries offloaded', 'concurrency', 'intermediate', '/d', 'concurrency_scaling_status=Y.', { format: 'count', baseValue: 420, range: 120 }),
    m('rs.cs.credits_used', 'CS credits used', 'concurrency', 'intermediate', '', 'free credits remaining mirror.', { baseValue: 8, range: 4 }),
    m('rs.cs.cost', 'CS cost today', 'concurrency', 'advanced', '$', 'CS cost.', { format: 'currency', baseValue: 12, range: 8 }),
    m('rs.au.audit_logs_gb', 'Audit log size (24h)', 'audit', 'intermediate', 'GB', 'audit log volume.', { format: 'number', baseValue: 4.2, range: 1.4 }),
    m('rs.au.failed_logins', 'Failed logins (24h)', 'audit', 'basic', '', 'connectionlog failed.', { format: 'count', baseValue: 24, range: 12 }),
    m('rs.au.grants_24h', 'GRANT events (24h)', 'audit', 'advanced', '', 'audit GRANT events.', { format: 'count', baseValue: 14, range: 8 }),
    m('rs.au.user_activity', 'User activity rows 24h', 'audit', 'advanced', '/d', 'user activity log rows.', { format: 'count', baseValue: 824000, range: 100000 }),
    m('rs.sec.public_role', 'PUBLIC role grants', 'security', 'advanced', '', 'PUBLIC GRANT count.', { format: 'count', baseValue: 14, range: 4 }),
    m('rs.sec.iam_roles', 'IAM roles attached', 'security', 'intermediate', '', 'attached IAM roles.', { format: 'count', baseValue: 4, range: 0 }),
    m('rs.sec.vpc_endpoint', 'VPC endpoint', 'security', 'basic', '', '1=enhanced VPC routing.', { baseValue: 1, range: 0 }),
    m('rs.sec.ssl_required', 'SSL required', 'security', 'basic', '', '1=require SSL.', { baseValue: 1, range: 0 }),
    m('rs.sec.column_acl', 'Column-level ACLs', 'security', 'advanced', '', 'GRANT on columns.', { format: 'count', baseValue: 42, range: 8 }),
];

const catalog: MetricCatalog = {
    engineId: 'demo-redshift',
    engineLabel: 'Amazon Redshift',
    accentColor: ACCENT,
    sections,
    metrics,
};

export default catalog;
