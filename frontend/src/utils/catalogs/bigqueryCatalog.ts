/* Auto-generated metric catalog. */

import { MetricCatalog, Metric, MetricSection, MetricTier } from '../metricsCatalog';

const ACCENT = '#4285F4';

const sections: MetricSection[] = [
    { key: 'overview', label: 'Overview', order: 1, color: '#4285F4' },
    { key: 'slots', label: 'Slots & Reservations', order: 2, color: '#0078D4' },
    { key: 'jobs', label: 'Jobs', order: 3, color: '#F2C744' },
    { key: 'cost', label: 'Bytes & Cost', order: 4, color: '#107C10' },
    { key: 'streaming', label: 'Streaming Inserts', order: 5, color: '#5C2D91' },
    { key: 'storage', label: 'Storage', order: 6, color: '#D83B01' },
    { key: 'partitioning', label: 'Partitioning', order: 7, color: '#00B7C3' },
    { key: 'routines', label: 'Routines', order: 8, color: '#8764B8' },
    { key: 'datatransfer', label: 'Data Transfer', order: 9, color: '#E3008C' },
    { key: 'security', label: 'IAM & Security', order: 10, color: '#A4262C' },
];

const m = (
    id: string, label: string, section: string, tier: MetricTier,
    unit = '', description = '', extras: Partial<Metric> = {},
): Metric => ({ id, label, section, tier, unit, description, ...extras });

const metrics: Metric[] = [
    m('bq.proj.id', 'Project', 'overview', 'basic', '', 'Active project.', { baseValue: 1, range: 0 }),
    m('bq.proj.location', 'Default location', 'overview', 'basic', '', 'default dataset location.', { baseValue: 2, range: 0 }),
    m('bq.proj.datasets', 'Datasets', 'overview', 'basic', '', 'INFORMATION_SCHEMA.SCHEMATA count.', { format: 'count', baseValue: 42, range: 8 }),
    m('bq.proj.tables', 'Tables', 'overview', 'basic', '', 'INFORMATION_SCHEMA.TABLES count.', { format: 'count', baseValue: 1842, range: 240 }),
    m('bq.proj.views', 'Views', 'overview', 'intermediate', '', 'TABLES type=VIEW.', { format: 'count', baseValue: 420, range: 80 }),
    m('bq.proj.materialized', 'Materialized views', 'overview', 'intermediate', '', 'TABLES type=MATERIALIZED_VIEW.', { format: 'count', baseValue: 24, range: 8 }),
    m('bq.proj.jobs_24h', 'Jobs (24h)', 'overview', 'basic', '', 'jobs.list count.', { format: 'count', baseValue: 84200, range: 22000 }),
    m('bq.proj.failed_24h', 'Failed jobs (24h)', 'overview', 'basic', '', 'state=DONE error_result NOT NULL.', { format: 'count', baseValue: 124, range: 80 }),
    m('bq.proj.users_24h', 'Active users (24h)', 'overview', 'intermediate', '', 'distinct user_email.', { format: 'count', baseValue: 84, range: 20 }),
    m('bq.proj.cost_today', 'Cost today', 'overview', 'basic', '$', 'on-demand + slot cost.', { format: 'currency', baseValue: 184, range: 60 }),
    m('bq.proj.cost_mtd', 'Cost MTD', 'overview', 'basic', '$', 'month-to-date cost.', { format: 'currency', baseValue: 4280, range: 600 }),
    m('bq.slot.allocated', 'Slots allocated', 'slots', 'basic', '', 'reservation slot_capacity.', { format: 'count', baseValue: 2000, range: 0 }),
    m('bq.slot.utilization', 'Slot utilization', 'slots', 'basic', '%', 'avg used / allocated.', { format: 'percent', baseValue: 72, range: 18 }),
    m('bq.slot.idle_min', 'Idle slot minutes', 'slots', 'intermediate', 'min/d', 'unused slot minutes per day.', { baseValue: 420, range: 120 }),
    m('bq.slot.assignments', 'Reservation assignments', 'slots', 'intermediate', '', 'JOBS_BY_PROJECT reservation_id distinct.', { format: 'count', baseValue: 8, range: 2 }),
    m('bq.slot.autoscale_max', 'Autoscale max', 'slots', 'advanced', '', 'autoscale_max_slots config.', { format: 'count', baseValue: 4000, range: 0 }),
    m('bq.slot.commitment_h', 'Annual commitment', 'slots', 'intermediate', '', 'commitment_plan ANNUAL slot count.', { format: 'count', baseValue: 500, range: 0 }),
    m('bq.slot.flex_used', 'Flex slots used', 'slots', 'advanced', '', 'commitment_plan FLEX slot peak.', { format: 'count', baseValue: 420, range: 120 }),
    m('bq.job.running', 'Running jobs', 'jobs', 'basic', '', 'state=RUNNING.', { format: 'count', baseValue: 24, range: 12 }),
    m('bq.job.pending', 'Pending jobs', 'jobs', 'basic', '', 'state=PENDING.', { format: 'count', baseValue: 4, range: 8 }),
    m('bq.job.avg_duration', 'Avg duration', 'jobs', 'basic', 's', 'avg end_time - start_time.', { baseValue: 12, range: 6 }),
    m('bq.job.p95_duration', 'p95 duration', 'jobs', 'intermediate', 's', 'p95 duration.', { baseValue: 84, range: 28 }),
    m('bq.job.cache_hits', 'Cache hits', 'jobs', 'intermediate', '%', 'cache_hit = true %.', { format: 'percent', baseValue: 24, range: 8, higherIsBetter: true }),
    m('bq.job.dry_run', 'Dry run jobs', 'jobs', 'advanced', '/d', 'dry_run = true count.', { format: 'count', baseValue: 420, range: 120 }),
    m('bq.job.load_jobs', 'Load jobs', 'jobs', 'intermediate', '/d', 'job_type=LOAD.', { format: 'count', baseValue: 240, range: 80 }),
    m('bq.job.export_jobs', 'Export jobs', 'jobs', 'intermediate', '/d', 'job_type=EXPORT.', { format: 'count', baseValue: 42, range: 22 }),
    m('bq.job.copy_jobs', 'Copy jobs', 'jobs', 'advanced', '/d', 'job_type=COPY.', { format: 'count', baseValue: 18, range: 8 }),
    m('bq.cost.bytes_today', 'Bytes scanned today', 'cost', 'basic', 'TB', 'sum total_bytes_processed.', { format: 'number', baseValue: 4.8, range: 1.4 }),
    m('bq.cost.bytes_mtd', 'Bytes scanned MTD', 'cost', 'basic', 'TB', 'mtd bytes processed.', { format: 'number', baseValue: 124, range: 20 }),
    m('bq.cost.slot_ms_today', 'Slot-ms today', 'cost', 'intermediate', '', 'sum total_slot_ms today.', { format: 'count', baseValue: 92100000, range: 18000000 }),
    m('bq.cost.bill_tier', 'Pricing model', 'cost', 'basic', '', '1=on-demand 2=flat.', { baseValue: 2, range: 0 }),
    m('bq.cost.forecast_eom', 'Forecast EOM', 'cost', 'intermediate', '$', 'projected cost EOM.', { format: 'currency', baseValue: 8400, range: 1200 }),
    m('bq.cost.top_user_cost', 'Top user cost (24h)', 'cost', 'advanced', '$', 'highest user-attributable cost.', { format: 'currency', baseValue: 42, range: 22 }),
    m('bq.cost.unused_slot_h', 'Unused slot-hours', 'cost', 'advanced', 'h', 'idle reserved capacity.', { baseValue: 18, range: 8 }),
    m('bq.stream.rows_sec', 'Rows / sec', 'streaming', 'basic', '/s', 'streaming insert rate.', { format: 'count', baseValue: 18420, range: 4200 }),
    m('bq.stream.bytes_sec', 'Bytes / sec', 'streaming', 'basic', 'MB/s', 'streaming bytes/sec.', { format: 'number', baseValue: 12, range: 4 }),
    m('bq.stream.errors_min', 'Errors / min', 'streaming', 'basic', '/min', 'streaming insert errors.', { format: 'count', baseValue: 4, range: 12 }),
    m('bq.stream.buffer_ms', 'Buffer flush time', 'streaming', 'intermediate', 'ms', 'streaming buffer write latency.', { baseValue: 420, range: 120 }),
    m('bq.stream.dedup_pct', 'Dedup hit %', 'streaming', 'advanced', '%', 'insertId duplicates.', { format: 'percent', baseValue: 2.1, range: 1.4 }),
    m('bq.st.active_tb', 'Active storage', 'storage', 'basic', 'TB', 'sum active_bytes.', { format: 'number', baseValue: 84, range: 12 }),
    m('bq.st.longterm_tb', 'Long-term storage', 'storage', 'basic', 'TB', 'sum long_term_bytes.', { format: 'number', baseValue: 420, range: 40 }),
    m('bq.st.cost_day', 'Storage cost/day', 'storage', 'intermediate', '$', 'storage cost.', { format: 'currency', baseValue: 42, range: 8 }),
    m('bq.st.cmek_pct', 'CMEK-encrypted %', 'storage', 'advanced', '%', 'tables with CMEK.', { format: 'percent', baseValue: 42, range: 12 }),
    m('bq.st.tables_no_part', 'Tables without partition', 'storage', 'intermediate', '', 'tables missing partitioning.', { format: 'count', baseValue: 84, range: 22 }),
    m('bq.st.compression_ratio', 'Compression ratio', 'storage', 'advanced', 'x', 'logical / physical bytes.', { baseValue: 4.2, range: 0.4 }),
    m('bq.part.tables_partitioned', 'Partitioned tables', 'partitioning', 'basic', '', 'COUNT(partition_column).', { format: 'count', baseValue: 412, range: 40 }),
    m('bq.part.avg_pct_pruned', 'Avg pruning %', 'partitioning', 'basic', '%', '(parts_pruned/parts_total) avg.', { format: 'percent', baseValue: 78, range: 8, higherIsBetter: true }),
    m('bq.part.poor_prune', 'Poorly-pruned queries', 'partitioning', 'advanced', '', 'queries pruning < 40%.', { format: 'count', baseValue: 84, range: 24 }),
    m('bq.part.clustered', 'Clustered tables', 'partitioning', 'intermediate', '', 'tables with clustering_fields.', { format: 'count', baseValue: 240, range: 40 }),
    m('bq.rt.stored_procs', 'Stored procedures', 'routines', 'intermediate', '', 'INFORMATION_SCHEMA.ROUTINES PROCEDURE.', { format: 'count', baseValue: 84, range: 12 }),
    m('bq.rt.udfs', 'UDFs', 'routines', 'intermediate', '', 'ROUTINES UDF count.', { format: 'count', baseValue: 42, range: 8 }),
    m('bq.rt.remote_funcs', 'Remote functions', 'routines', 'advanced', '', 'TYPE=REMOTE_FUNCTION.', { format: 'count', baseValue: 8, range: 4 }),
    m('bq.rt.invocations_24h', 'Routine invocations 24h', 'routines', 'advanced', '/d', 'invocation count.', { format: 'count', baseValue: 18420, range: 3200 }),
    m('bq.dt.transfers', 'Active transfer configs', 'datatransfer', 'intermediate', '', 'BigQuery DTS configs.', { format: 'count', baseValue: 24, range: 4 }),
    m('bq.dt.last_run_age', 'Newest run age', 'datatransfer', 'intermediate', 'min', 'minutes since last run.', { baseValue: 8, range: 4 }),
    m('bq.dt.failed_24h', 'Failed runs (24h)', 'datatransfer', 'basic', '', 'state=FAILED past 24h.', { format: 'count', baseValue: 2, range: 4 }),
    m('bq.dt.bytes_24h', 'Bytes transferred 24h', 'datatransfer', 'advanced', 'GB', 'bytes transferred sum.', { format: 'number', baseValue: 420, range: 80 }),
    m('bq.sec.iam_bindings', 'IAM bindings', 'security', 'intermediate', '', 'IAM policy bindings count.', { format: 'count', baseValue: 240, range: 40 }),
    m('bq.sec.public_datasets', 'Public datasets', 'security', 'basic', '', 'datasets with allAuthenticatedUsers.', { format: 'count', baseValue: 2, range: 2 }),
    m('bq.sec.cmek_keys', 'CMEK keys', 'security', 'intermediate', '', 'distinct kms_key_name.', { format: 'count', baseValue: 8, range: 2 }),
    m('bq.sec.row_access', 'Row-access policies', 'security', 'advanced', '', 'INFORMATION_SCHEMA.ROW_ACCESS_POLICIES.', { format: 'count', baseValue: 42, range: 8 }),
    m('bq.sec.audit_volume', 'Audit log volume 24h', 'security', 'advanced', 'GB', 'audit log GB past 24h.', { format: 'number', baseValue: 12, range: 4 }),
    m('bq.sec.failed_auth', 'Failed auth (24h)', 'security', 'basic', '', 'permission denied events.', { format: 'count', baseValue: 18, range: 12 }),
];

const catalog: MetricCatalog = {
    engineId: 'demo-bigquery',
    engineLabel: 'Google BigQuery',
    accentColor: ACCENT,
    sections,
    metrics,
};

export default catalog;
