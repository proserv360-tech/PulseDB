/* Auto-generated metric catalog. */

import { MetricCatalog, Metric, MetricSection, MetricTier } from '../metricsCatalog';

const ACCENT = '#1287B1';

const sections: MetricSection[] = [
    { key: 'cluster', label: 'Cluster', order: 1, color: '#1287B1' },
    { key: 'reads', label: 'Read Path', order: 2, color: '#0078D4' },
    { key: 'writes', label: 'Write Path', order: 3, color: '#F2C744' },
    { key: 'compaction', label: 'Compaction', order: 4, color: '#107C10' },
    { key: 'repair', label: 'Repair', order: 5, color: '#5C2D91' },
    { key: 'storage', label: 'Storage / SSTables', order: 6, color: '#D83B01' },
    { key: 'gossip', label: 'Gossip', order: 7, color: '#00B7C3' },
    { key: 'hh', label: 'Hinted Handoff', order: 8, color: '#8764B8' },
    { key: 'jvm', label: 'JVM', order: 9, color: '#E3008C' },
    { key: 'streaming', label: 'Streaming', order: 10, color: '#A4262C' },
];

const m = (
    id: string, label: string, section: string, tier: MetricTier,
    unit = '', description = '', extras: Partial<Metric> = {},
): Metric => ({ id, label, section, tier, unit, description, ...extras });

const metrics: Metric[] = [
    m('cas.cluster.nodes_up', 'Nodes up', 'cluster', 'basic', '', 'nodetool status UP count.', { format: 'count', baseValue: 12, range: 0 }),
    m('cas.cluster.nodes_total', 'Total nodes', 'cluster', 'basic', '', 'cluster nodes count.', { format: 'count', baseValue: 12, range: 0 }),
    m('cas.cluster.datacenters', 'Data centers', 'cluster', 'basic', '', 'distinct datacenter.', { format: 'count', baseValue: 3, range: 0 }),
    m('cas.cluster.keyspaces', 'Keyspaces', 'cluster', 'basic', '', 'system.local count.', { format: 'count', baseValue: 14, range: 2 }),
    m('cas.cluster.tokens', 'Tokens / node', 'cluster', 'intermediate', '', 'num_tokens config.', { format: 'count', baseValue: 256, range: 0 }),
    m('cas.cluster.version', 'Version', 'cluster', 'basic', '', 'release_version.', { baseValue: 4, range: 0 }),
    m('cas.cluster.snitch', 'Snitch', 'cluster', 'advanced', '', 'GossipingPropertyFileSnitch etc.', { baseValue: 2, range: 0 }),
    m('cas.cluster.cpu_pct', 'Avg CPU %', 'cluster', 'basic', '%', 'OS load avg per node.', { format: 'percent', baseValue: 52, range: 18 }),
    m('cas.cluster.load_gb', 'Load / node', 'cluster', 'basic', 'GB', 'nodetool status load avg.', { format: 'number', baseValue: 420, range: 60 }),
    m('cas.cluster.heap_used', 'Avg heap used', 'cluster', 'intermediate', '%', 'jvm heap used avg.', { format: 'percent', baseValue: 68, range: 12 }),
    m('cas.read.rate', 'Read rate', 'reads', 'basic', 'ops/s', 'ClientRequest Reads OneMinuteRate.', { format: 'count', baseValue: 24100, range: 4200 }),
    m('cas.read.p50', 'Read p50 latency', 'reads', 'basic', 'ms', 'ClientRequest Read p50.', { format: 'duration', baseValue: 2.4, range: 0.8 }),
    m('cas.read.p95', 'Read p95 latency', 'reads', 'basic', 'ms', 'p95 read latency.', { format: 'duration', baseValue: 8.2, range: 2.4 }),
    m('cas.read.p99', 'Read p99 latency', 'reads', 'basic', 'ms', 'p99 read latency.', { format: 'duration', baseValue: 18, range: 6 }),
    m('cas.read.timeouts', 'Read timeouts /min', 'reads', 'intermediate', '/min', 'ClientRequest Read Timeouts.', { baseValue: 4, range: 4 }),
    m('cas.read.unavailable', 'Read unavailable /min', 'reads', 'intermediate', '/min', 'ClientRequest Read Unavailables.', { baseValue: 2, range: 2 }),
    m('cas.read.repair_chance', 'Read repair chance', 'reads', 'advanced', '%', 'read_repair_chance.', { format: 'percent', baseValue: 10, range: 0 }),
    m('cas.read.cache_hit', 'Key cache hit', 'reads', 'intermediate', '%', 'KeyCache HitRate.', { format: 'percent', baseValue: 92, range: 4, higherIsBetter: true }),
    m('cas.read.row_cache_hit', 'Row cache hit', 'reads', 'advanced', '%', 'RowCache HitRate.', { format: 'percent', baseValue: 58, range: 12, higherIsBetter: true }),
    m('cas.write.rate', 'Write rate', 'writes', 'basic', 'ops/s', 'ClientRequest Writes.', { format: 'count', baseValue: 9800, range: 2400 }),
    m('cas.write.p50', 'Write p50 latency', 'writes', 'basic', 'ms', 'p50 write.', { format: 'duration', baseValue: 0.8, range: 0.4 }),
    m('cas.write.p95', 'Write p95 latency', 'writes', 'basic', 'ms', 'p95 write.', { format: 'duration', baseValue: 2.4, range: 0.8 }),
    m('cas.write.p99', 'Write p99 latency', 'writes', 'basic', 'ms', 'p99 write.', { format: 'duration', baseValue: 6.2, range: 2 }),
    m('cas.write.timeouts', 'Write timeouts /min', 'writes', 'intermediate', '/min', 'Write timeouts.', { baseValue: 2, range: 4 }),
    m('cas.write.unavailable', 'Write unavailable /min', 'writes', 'intermediate', '/min', 'Write unavailables.', { baseValue: 1, range: 2 }),
    m('cas.write.commitlog_pending', 'Commit log pending', 'writes', 'intermediate', '', 'CommitLog PendingTasks.', { format: 'count', baseValue: 4, range: 8 }),
    m('cas.write.commitlog_throughput', 'Commit log MB/s', 'writes', 'advanced', 'MB/s', 'CommitLog write throughput.', { format: 'number', baseValue: 42, range: 12 }),
    m('cas.write.memtable_size', 'Memtable size', 'writes', 'advanced', 'MB', 'avg Memtable OnHeap size.', { format: 'number', baseValue: 240, range: 40 }),
    m('cas.write.memtable_flushes', 'Memtable flushes/min', 'writes', 'intermediate', '/min', 'flushes per min.', { format: 'count', baseValue: 12, range: 4 }),
    m('cas.cmp.pending', 'Pending compactions', 'compaction', 'basic', '', 'CompactionExecutor Pending.', { format: 'count', baseValue: 14, range: 8 }),
    m('cas.cmp.active', 'Active compactions', 'compaction', 'basic', '', 'CompactionExecutor Active.', { format: 'count', baseValue: 4, range: 4 }),
    m('cas.cmp.completed_24h', 'Compactions (24h)', 'compaction', 'intermediate', '', 'compactions completed.', { format: 'count', baseValue: 420, range: 80 }),
    m('cas.cmp.throughput', 'Compaction throughput', 'compaction', 'intermediate', 'MB/s', 'compaction_throughput_mb_per_sec.', { format: 'number', baseValue: 64, range: 0 }),
    m('cas.cmp.bytes_written', 'Bytes written 24h', 'compaction', 'advanced', 'GB', 'CompactionExecutor BytesCompacted.', { format: 'number', baseValue: 412, range: 60 }),
    m('cas.cmp.strategy', 'Compaction strategy', 'compaction', 'advanced', '', '1=STCS 2=LCS 3=TWCS.', { baseValue: 2, range: 0 }),
    m('cas.rep.running', 'Active repairs', 'repair', 'basic', '', 'Repair sessions running.', { format: 'count', baseValue: 1, range: 2 }),
    m('cas.rep.last_complete', 'Last full repair (h)', 'repair', 'basic', 'h', 'hours since full repair.', { baseValue: 42, range: 14 }),
    m('cas.rep.mismatches', 'Mismatched ranges', 'repair', 'intermediate', '', 'Anti-entropy mismatches.', { format: 'count', baseValue: 84, range: 22 }),
    m('cas.rep.failed_24h', 'Failed repairs (24h)', 'repair', 'intermediate', '', 'repair failures.', { format: 'count', baseValue: 2, range: 2 }),
    m('cas.rep.streaming_throughput', 'Repair streaming MB/s', 'repair', 'advanced', 'MB/s', 'StreamingService throughput.', { format: 'number', baseValue: 120, range: 40 }),
    m('cas.st.sstable_count', 'SSTable count', 'storage', 'basic', '', 'sum SSTables per node avg.', { format: 'count', baseValue: 18400, range: 2400 }),
    m('cas.st.tables', 'Tables', 'storage', 'basic', '', 'system_schema.tables count.', { format: 'count', baseValue: 240, range: 20 }),
    m('cas.st.disk_used', 'Disk used', 'storage', 'basic', '%', 'storage used pct.', { format: 'percent', baseValue: 68, range: 12 }),
    m('cas.st.bloom_size', 'Bloom filter size', 'storage', 'advanced', 'MB', 'BloomFilter total size.', { format: 'number', baseValue: 1842, range: 240 }),
    m('cas.st.bloom_fp_rate', 'Bloom FP rate', 'storage', 'advanced', '%', 'bloom_filter_fp_chance.', { format: 'percent', baseValue: 1.0, range: 0.4 }),
    m('cas.st.tombstones_partition', 'Tombstones / partition', 'storage', 'intermediate', '', 'TombstoneScannedHistogram p99.', { format: 'count', baseValue: 42, range: 20 }),
    m('cas.st.live_disk_used', 'Live disk used', 'storage', 'intermediate', 'GB', 'Total live disk space.', { format: 'number', baseValue: 4200, range: 400 }),
    m('cas.go.endpoints', 'Live endpoints', 'gossip', 'basic', '', 'EndpointStateMap count.', { format: 'count', baseValue: 12, range: 0 }),
    m('cas.go.unreachable', 'Unreachable endpoints', 'gossip', 'basic', '', 'unreachable nodes.', { format: 'count', baseValue: 0, range: 2 }),
    m('cas.go.heartbeat_drift', 'Heartbeat drift', 'gossip', 'advanced', 'ms', 'avg heartbeat skew.', { baseValue: 42, range: 18 }),
    m('cas.go.gen_count', 'Generation count', 'gossip', 'advanced', '', 'gossip generation.', { format: 'count', baseValue: 18, range: 4 }),
    m('cas.hh.queued', 'Hints queued', 'hh', 'basic', '', 'HintedHandoff TotalHints.', { format: 'count', baseValue: 142, range: 80 }),
    m('cas.hh.in_progress', 'Hints in progress', 'hh', 'intermediate', '', 'HintedHandoff InProgress.', { format: 'count', baseValue: 12, range: 8 }),
    m('cas.hh.delivered_24h', 'Hints delivered 24h', 'hh', 'intermediate', '/d', 'HintsDelivered.', { format: 'count', baseValue: 18420, range: 4200 }),
    m('cas.hh.lost', 'Hints expired', 'hh', 'advanced', '/d', 'hints expired.', { format: 'count', baseValue: 24, range: 14 }),
    m('cas.jvm.heap_used', 'Heap used', 'jvm', 'basic', 'GB', 'heap usage.', { format: 'number', baseValue: 22, range: 4 }),
    m('cas.jvm.heap_max', 'Heap max', 'jvm', 'basic', 'GB', 'heap max.', { format: 'number', baseValue: 32, range: 0 }),
    m('cas.jvm.gc_pause_avg', 'GC pause avg', 'jvm', 'intermediate', 'ms', 'avg gc pause.', { format: 'duration', baseValue: 22, range: 8 }),
    m('cas.jvm.gc_pause_max', 'GC pause max', 'jvm', 'intermediate', 'ms', 'max gc pause.', { format: 'duration', baseValue: 180, range: 60 }),
    m('cas.jvm.threads', 'JVM threads', 'jvm', 'intermediate', '', 'thread count.', { format: 'count', baseValue: 412, range: 40 }),
    m('cas.str.active', 'Active streams', 'streaming', 'intermediate', '', 'StreamingService active.', { format: 'count', baseValue: 2, range: 4 }),
    m('cas.str.throughput', 'Streaming throughput', 'streaming', 'intermediate', 'MB/s', 'streaming throughput.', { format: 'number', baseValue: 84, range: 22 }),
    m('cas.str.failed_24h', 'Failed streams (24h)', 'streaming', 'advanced', '/d', 'stream failures.', { format: 'count', baseValue: 0, range: 2 }),
];

const catalog: MetricCatalog = {
    engineId: 'demo-cassandra',
    engineLabel: 'Apache Cassandra',
    accentColor: ACCENT,
    sections,
    metrics,
};

export default catalog;
