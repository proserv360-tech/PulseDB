import React, { useMemo } from 'react';
import { THEME, useAdaptiveTheme } from '../../../utils/theme';
import DemoLayout, {
    Panel,
    StatusBadge,
    RingGauge,
    MiniSparkline,
    HeroMetric,
    MetricCard,
    LiveMetric,
    TabPills,
    AlertRow,
    DataTable,
    ChartTip,
    generateChartData,
} from './DemoLayout';
import {
    Activity,
    Database,
    Zap,
    HardDrive,
    Brain,
    RefreshCw,
    Settings,
    Clock,
    TrendingUp,
    Server,
    Shield,
    Lock,
    Users,
    Eye,
    Network,
    Gauge,
    BarChart3,
    AlertCircle,
    CheckCircle,
    Layers,
    Code,
    GitBranch,
    Map,
    Download,
    Upload,
    Filter,
    Copy,
    AlertTriangle,
    Cpu,
    Globe,
    Archive,
    Lightbulb,
    Zap as ZapAlt,
    TrendingDown,
    Workflow,
    Compass,
    Radio,
    FileCog,
    Inbox,
    FileCode,
    BarChart4,
} from 'lucide-react';
import {
    AreaChart,
    Area,
    LineChart,
    Line,
    BarChart,
    Bar,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
} from 'recharts';

function DemoMongoDBTab({ tabId }) {
    useAdaptiveTheme();

    const demoData = useMemo(() => {
        const base24h = generateChartData(24);
        const base30d = generateChartData(30);
        const indexed24h = base24h.map((d, i) => ({ ...d, index: i }));
        const indexed30d = base30d.map((d, i) => ({ ...d, index: i }));

        return {
            // ═══════════════════════════════════════════════════════════════════════════
            // 1. OVERVIEW (5 items)
            // ═══════════════════════════════════════════════════════════════════════════

            // Executive Dashboard
            clusterHealth: {
                status: 'HEALTHY',
                uptime: '45d 14h',
                primaryNode: 'replica-0',
                secondaries: 2,
                version: '7.0.4',
            },
            clusterMetrics: indexed24h.map((d) => ({
                ...d,
                throughput: Math.floor(8400 + Math.sin(d.index / 6) * 1200 + Math.random() * 500),
                latency: Math.floor(12 + Math.sin(d.index / 8) * 5 + Math.random() * 3),
            })),

            // Connection
            connectionStats: {
                active: 78,
                idle: 32,
                available: 190,
                maxPoolSize: 300,
            },
            connectionTrends: indexed24h.map((d) => ({
                ...d,
                active: Math.floor(78 + Math.sin(d.index / 7) * 12 + Math.random() * 8),
                idle: Math.floor(32 + Math.cos(d.index / 8) * 10 + Math.random() * 6),
            })),

            // Server Info
            serverInfo: {
                hostname: 'mongo-primary-01.prod.fathom',
                port: 27017,
                memory: '32 GB',
                storage: 'WiredTiger',
                os: 'Ubuntu 22.04 LTS',
                arch: 'x86_64',
            },

            // Databases
            databases: [
                { name: 'production', collections: 24, size: '156.4 GB', indexes: 182, doc_count: 45200000 },
                { name: 'analytics', collections: 18, size: '89.2 GB', indexes: 98, doc_count: 12400000 },
                { name: 'staging', collections: 24, size: '78.1 GB', indexes: 180, doc_count: 42100000 },
                { name: 'cache', collections: 6, size: '12.3 GB', indexes: 14, doc_count: 3200000 },
            ],

            // Collection Relationships
            collectionRelationships: [
                { from: 'orders', to: 'customers', type: '$lookup', count: 2840000 },
                { from: 'orders', to: 'products', type: '$lookup', count: 1850000 },
                { from: 'customers', to: 'addresses', type: 'embedded', count: 145000 },
                { from: 'transactions', to: 'orders', type: '$lookup', count: 5620000 },
            ],

            // ═══════════════════════════════════════════════════════════════════════════
            // 2. PERFORMANCE (13 items)
            // ═══════════════════════════════════════════════════════════════════════════

            // Server Status
            serverStatus: {
                connectionsCreated: 42850,
                networkBytesIn: '284.2 GB',
                networkBytesOut: '156.3 GB',
                operationsIns: 184250,
                operationsUpd: 92340,
                operationsDel: 23450,
                operationsQry: 1284500,
            },

            // Real-time Ops
            realtimeOps: indexed24h.map((d) => ({
                ...d,
                read: Math.floor(4200 + Math.sin(d.index / 6) * 800 + Math.random() * 400),
                write: Math.floor(2100 + Math.cos(d.index / 6) * 500 + Math.random() * 300),
                command: Math.floor(890 + Math.sin(d.index / 8) * 200 + Math.random() * 120),
            })),

            // Latency Percentiles
            latencyPercentiles: indexed24h.map((d) => ({
                ...d,
                p50: Math.floor(8 + Math.sin(d.index / 7) * 3 + Math.random() * 2),
                p95: Math.floor(35 + Math.sin(d.index / 5) * 10 + Math.random() * 6),
                p99: Math.floor(92 + Math.cos(d.index / 4) * 18 + Math.random() * 10),
            })),

            // Namespace Insights
            namespaceMetrics: [
                { ns: 'production.orders', ops_sec: 2840, avg_latency: 12, size_mb: 4200, index_count: 6 },
                { ns: 'production.customers', ops_sec: 450, avg_latency: 8, size_mb: 2100, index_count: 4 },
                { ns: 'production.transactions', ops_sec: 5620, avg_latency: 18, size_mb: 18900, index_count: 8 },
                { ns: 'analytics.events', ops_sec: 1280, avg_latency: 24, size_mb: 89200, index_count: 5 },
            ],

            // Explain Plan
            explainPlanExample: {
                query: 'db.orders.find({status:"pending"}).sort({createdAt:-1}).limit(100)',
                executionStage: 'COLLSCAN',
                nReturned: 100,
                executionTimeMillis: 2840,
                totalKeysExamined: 2840000,
                totalDocsExamined: 2840000,
                executionStats: {
                    stage: 'COLLSCAN',
                    nReturned: 100,
                    executionTimeMillis: 2840,
                },
            },

            // Active Operations
            activeOps: [
                { id: 'op-12401', ns: 'production.orders', cmd: 'find', active_time: '2.3s', blocks: 'op-12402' },
                { id: 'op-12402', ns: 'production.customers', cmd: 'update', active_time: '1.8s', blocks: null },
                { id: 'op-12403', ns: 'analytics.events', cmd: 'insert', active_time: '0.4s', blocks: null },
            ],

            // Slow Queries
            slowQueries: [
                {
                    query: 'db.orders.find({status:{$in:["pending","processing"]}}).sort({createdAt:-1})',
                    duration: 2840,
                    scanned: 485200,
                    returned: 2100,
                },
                {
                    query: 'db.transactions.aggregate([{$match:{amount:{$gt:1000}}},{$group:{_id:"$userId"}}])',
                    duration: 1950,
                    scanned: 1240000,
                    returned: 34500,
                },
                {
                    query: 'db.logs.find({level:"ERROR"}).limit(10000)',
                    duration: 1620,
                    scanned: 18200000,
                    returned: 10000,
                },
            ],

            // Query Profiler
            profiledQueries: [
                { timestamp: '14:32:18', ns: 'production.orders', millis: 2340, docs: 8420 },
                { timestamp: '14:32:15', ns: 'production.customers', millis: 340, docs: 145 },
                { timestamp: '14:32:12', ns: 'analytics.events', millis: 8920, docs: 34200 },
                { timestamp: '14:32:09', ns: 'production.transactions', millis: 1840, docs: 2340 },
            ],

            // Query Cost Estimator
            costEstimate: {
                query: 'db.orders.find({status:"pending"}).hint({createdAt:-1})',
                estimatedCost: 2.84,
                estimatedRows: 2100,
                indexedFields: ['createdAt', 'status'],
                recommendation: 'USE_INDEX',
            },

            // Lock Analysis
            lockMetrics: indexed24h.map((d) => ({
                ...d,
                waits: Math.floor(12 + Math.sin(d.index / 6) * 6 + Math.random() * 4),
                deadlocks: Math.floor(0 + Math.random() * 2),
            })),

            // Anomaly Detection
            anomalies: [
                {
                    type: 'SPIKE',
                    metric: 'write_latency',
                    time: '14:28',
                    value: '245ms',
                    baseline: '18ms',
                    severity: 'high',
                },
                {
                    type: 'DROP',
                    metric: 'query_throughput',
                    time: '14:15',
                    value: '1240 ops/s',
                    baseline: '4200 ops/s',
                    severity: 'warning',
                },
                {
                    type: 'TREND',
                    metric: 'cache_evictions',
                    time: '14:00',
                    value: '+32% per hour',
                    baseline: 'stable',
                    severity: 'medium',
                },
            ],

            // Metrics Preview
            metricsPreview: indexed24h.map((d) => ({
                ...d,
                opcounters_read: Math.floor(4200 + Math.sin(d.index / 6) * 600 + Math.random() * 300),
                opcounters_write: Math.floor(2100 + Math.cos(d.index / 7) * 400 + Math.random() * 200),
                connections_current: Math.floor(110 + Math.sin(d.index / 8) * 25 + Math.random() * 15),
            })),

            // Live Agent
            liveAgentStatus: {
                agent_id: 'fathom-mongo-01',
                status: 'CONNECTED',
                last_heartbeat: '2s ago',
                version: '2.4.1',
                metrics_collected: 8420,
            },

            // ═══════════════════════════════════════════════════════════════════════════
            // 3. STORAGE (7 items)
            // ═══════════════════════════════════════════════════════════════════════════

            // Index Advisor
            indexRecommendations: [
                {
                    collection: 'orders',
                    field: 'status',
                    selectivity: '0.94',
                    est_size: '12.4 MB',
                    potential_save: '850ms',
                },
                {
                    collection: 'orders',
                    field: 'createdAt',
                    selectivity: '1.0',
                    est_size: '18.2 MB',
                    potential_save: '1240ms',
                },
                {
                    collection: 'customers',
                    field: 'email',
                    selectivity: '1.0',
                    est_size: '2.1 MB',
                    potential_save: '340ms',
                },
            ],

            // Schema Analyzer
            schemaAnalysis: [
                { collection: 'orders', field_count: 18, avg_doc_size: 4.6, type_consistency: '98.4%' },
                { collection: 'customers', field_count: 24, avg_doc_size: 15.2, type_consistency: '95.2%' },
                { collection: 'transactions', field_count: 22, avg_doc_size: 3.4, type_consistency: '99.1%' },
            ],

            // Collection Stats
            collectionStats: [
                { name: 'orders', docs: 2840000, size: '12.4 GB', indexes: 6, avgDocSize: 4.6, storage: '11.2 GB' },
                { name: 'customers', docs: 145000, size: '2.1 GB', indexes: 4, avgDocSize: 15.2, storage: '1.9 GB' },
                {
                    name: 'transactions',
                    docs: 5620000,
                    size: '18.9 GB',
                    indexes: 8,
                    avgDocSize: 3.4,
                    storage: '17.1 GB',
                },
                { name: 'logs', docs: 18200000, size: '34.2 GB', indexes: 3, avgDocSize: 1.9, storage: '32.4 GB' },
            ],

            // WiredTiger Cache
            wiredTigerMetrics: indexed24h.map((d) => ({
                ...d,
                evictions: Math.floor(240 + Math.sin(d.index / 5) * 100 + Math.random() * 50),
                cacheFillPct: Math.floor(73 + Math.sin(d.index / 8) * 12 + Math.random() * 6),
            })),

            // Backup Monitor
            backups: [
                {
                    timestamp: '2025-03-26 02:00 UTC',
                    size: '42.3 GB',
                    duration: '12m 34s',
                    status: 'SUCCESS',
                    type: 'full',
                },
                {
                    timestamp: '2025-03-25 02:00 UTC',
                    size: '41.8 GB',
                    duration: '12m 18s',
                    status: 'SUCCESS',
                    type: 'full',
                },
                {
                    timestamp: '2025-03-24 02:00 UTC',
                    size: '40.9 GB',
                    duration: '13m 02s',
                    status: 'SUCCESS',
                    type: 'full',
                },
            ],

            // Capacity Planning
            capacityPlanning: {
                current_used: 284.2,
                current_total: 512,
                current_usage_pct: 55.5,
                projected_12m: 380,
                projected_usage_12m: 74.2,
                days_until_full: 420,
            },

            // Network
            networkMetrics: indexed24h.map((d) => ({
                ...d,
                inbound: Math.floor(850 + Math.sin(d.index / 5) * 200 + Math.random() * 100),
                outbound: Math.floor(420 + Math.cos(d.index / 6) * 150 + Math.random() * 75),
            })),

            // ═══════════════════════════════════════════════════════════════════════════
            // 4. DATA (7 items)
            // ═══════════════════════════════════════════════════════════════════════════

            // Document Editor
            documentExample: {
                _id: 'ObjectId("507f1f77bcf86cd799439011")',
                collection: 'orders',
                doc: {
                    _id: 'ObjectId("507f1f77bcf86cd799439011")',
                    orderId: 'ORD-2025-0012840',
                    customer: 'Alice Johnson',
                    status: 'processing',
                    items: 3,
                    total: 1284.5,
                    createdAt: '2025-03-26T14:32:18Z',
                    updatedAt: '2025-03-26T14:35:42Z',
                },
            },

            // Aggregation Builder
            aggregationPipeline: [
                { stage: '$match', condition: '{status: "pending"}' },
                { stage: '$group', groupBy: '$customer', count: 'sum: 1' },
                { stage: '$sort', field: 'count', order: -1 },
                { stage: '$limit', value: 100 },
            ],

            // NL Query Generator
            naturalLanguageExamples: [
                {
                    input: 'Find all orders from the last 7 days sorted by amount',
                    query: 'db.orders.find({createdAt:{$gte:ISODate("2025-03-19")}}).sort({total:-1})',
                },
                {
                    input: 'Count distinct customers who spent over 1000',
                    query: 'db.orders.aggregate([{$match:{total:{$gt:1000}}},{$group:{_id:"$customer"}},{$count:"unique"}])',
                },
                {
                    input: 'Get top 10 products by order frequency',
                    query: 'db.orders.aggregate([{$unwind:"$items"},{$group:{_id:"$items.id",count:{$sum:1}}},{$sort:{count:-1}},{$limit:10}])',
                },
            ],

            // Import/Export
            importExportOps: [
                {
                    timestamp: '2025-03-26 14:22',
                    operation: 'IMPORT',
                    source: 'orders_backup.json',
                    records: 2840000,
                    status: 'COMPLETED',
                    duration: '8m 24s',
                },
                {
                    timestamp: '2025-03-26 10:15',
                    operation: 'EXPORT',
                    target: 'customers_dump.json',
                    records: 145000,
                    status: 'COMPLETED',
                    duration: '2m 18s',
                },
                {
                    timestamp: '2025-03-25 23:30',
                    operation: 'IMPORT',
                    source: 'transactions.csv',
                    records: 5620000,
                    status: 'COMPLETED',
                    duration: '24m 12s',
                },
            ],

            // SQL Translator
            sqlToMongoExamples: [
                {
                    sql: "SELECT * FROM orders WHERE status = 'pending' ORDER BY created_at DESC LIMIT 10",
                    mongo: 'db.orders.find({status:"pending"}).sort({createdAt:-1}).limit(10)',
                },
                {
                    sql: 'SELECT COUNT(*) FROM orders GROUP BY customer_id',
                    mongo: 'db.orders.aggregate([{$group:{_id:"$customerId",count:{$sum:1}}}])',
                },
            ],

            // Schema Compare
            schemaComparison: [
                {
                    collection: 'orders',
                    prod: { fields: 18, avg_size: 4.6, doc_count: 2840000 },
                    staging: { fields: 18, avg_size: 4.6, doc_count: 2100000 },
                },
                {
                    collection: 'customers',
                    prod: { fields: 24, avg_size: 15.2, doc_count: 145000 },
                    staging: { fields: 24, avg_size: 15.1, doc_count: 120000 },
                },
            ],

            // Geo-spatial
            geoMetrics: [
                { location: 'US-East', documents: 1240000, avg_lat: 40.7128, avg_lng: -74.006 },
                { location: 'US-West', documents: 820000, avg_lat: 47.6062, avg_lng: -122.3321 },
                { location: 'EU-West', documents: 580000, avg_lat: 51.5074, avg_lng: -0.1278 },
                { location: 'Asia-Pacific', documents: 320000, avg_lat: 35.6762, avg_lng: 139.6503 },
            ],

            // ═══════════════════════════════════════════════════════════════════════════
            // 5. INTELLIGENCE (5 items)
            // ═══════════════════════════════════════════════════════════════════════════

            // AI Hints
            aiHints: [
                {
                    hint_id: 'h001',
                    category: 'PERFORMANCE',
                    message:
                        'Collection "orders" has 6 unused indexes. Removing could free 28 MB and improve write performance by 12%',
                    confidence: 0.94,
                },
                {
                    hint_id: 'h002',
                    category: 'SCHEMA',
                    message:
                        'Field "metadata" is sparse in 34% of documents. Consider reorganizing schema to improve compression',
                    confidence: 0.87,
                },
                {
                    hint_id: 'h003',
                    category: 'REPLICATION',
                    message: 'Secondary replica-2 is lagging by 45ms. Network bandwidth to that instance is at 85%',
                    confidence: 0.92,
                },
            ],

            // Compare Clusters
            clusterComparison: [
                { metric: 'Throughput (ops/s)', prod: 8420, staging: 3840, diff_pct: '+119%' },
                { metric: 'Avg Latency (ms)', prod: 12.4, staging: 8.2, diff_pct: '-51%' },
                { metric: 'Cache Fill %', prod: 73.4, staging: 65.2, diff_pct: '-11%' },
                { metric: 'Storage Used (GB)', prod: 284.2, staging: 156.8, diff_pct: '+81%' },
            ],

            // Historical Trends
            historicalTrends: indexed30d.map((d) => ({
                ...d,
                avg_latency: Math.floor(14 + Math.sin(d.index / 8) * 6 + Math.random() * 4),
                throughput: Math.floor(7800 + Math.cos(d.index / 10) * 1200 + Math.random() * 600),
            })),

            // Perf Advisor v2
            perfAdvisor: [
                {
                    recommendation: 'Add compound index on (status, createdAt) for collection "orders"',
                    impact: 'Save 840ms per query',
                    priority: 1,
                    effort: 'low',
                },
                {
                    recommendation: 'Enable compression on collection "logs" to reduce storage by 24%',
                    impact: 'Save 8.2 GB, improve read speed 6%',
                    priority: 2,
                    effort: 'medium',
                },
                {
                    recommendation: 'Migrate collection "archive" to different tier based on access patterns',
                    impact: 'Reduce peak latency by 180ms',
                    priority: 3,
                    effort: 'high',
                },
            ],

            // Trace Correlator
            traceCorrelations: [
                {
                    trace_id: 'tr-001',
                    operation: 'batch_insert',
                    duration: 2340,
                    stages: ['auth', 'validation', 'write', 'replication'],
                    bottleneck: 'replication',
                },
                {
                    trace_id: 'tr-002',
                    operation: 'aggregation',
                    duration: 8920,
                    stages: ['compile', 'execute', 'fetch'],
                    bottleneck: 'execute',
                },
            ],

            // ═══════════════════════════════════════════════════════════════════════════
            // 6. REPLICATION (3 items)
            // ═══════════════════════════════════════════════════════════════════════════

            // Replica Set + Failover
            replicas: [
                { id: 'replica-0', role: 'PRIMARY', state: 'PRIMARY', syncLag: '0ms', health: 1.0, uptime: '45d' },
                { id: 'replica-1', role: 'SECONDARY', state: 'SECONDARY', syncLag: '2ms', health: 0.98, uptime: '45d' },
                { id: 'replica-2', role: 'SECONDARY', state: 'SECONDARY', syncLag: '3ms', health: 0.97, uptime: '44d' },
                { id: 'arbiter-0', role: 'ARBITER', state: 'ARBITER', syncLag: 'N/A', health: 0.99, uptime: '45d' },
            ],

            // Sharding
            shards: [
                { id: 'shard-0', docs: 1850000, size: '8.2 GB', chunks: 24, status: 'active', health: 1.0 },
                { id: 'shard-1', docs: 1910000, size: '8.5 GB', chunks: 25, status: 'active', health: 0.98 },
                { id: 'shard-2', docs: 1880000, size: '8.3 GB', chunks: 23, status: 'active', health: 0.99 },
            ],

            // Oplog Tail
            oplogEvents: [
                { timestamp: 'Timestamp(1711449138,1)', operation: 'insert', ns: 'production.orders', duration: 2.3 },
                {
                    timestamp: 'Timestamp(1711449137,2)',
                    operation: 'update',
                    ns: 'production.customers',
                    duration: 1.8,
                },
                { timestamp: 'Timestamp(1711449136,1)', operation: 'delete', ns: 'production.logs', duration: 0.4 },
                { timestamp: 'Timestamp(1711449135,1)', operation: 'insert', ns: 'analytics.events', duration: 3.2 },
            ],

            // ═══════════════════════════════════════════════════════════════════════════
            // 7. MANAGEMENT (8 items)
            // ═══════════════════════════════════════════════════════════════════════════

            // Alert Manager
            alertsManager: {
                total: 24,
                critical: 2,
                warning: 5,
                info: 17,
            },
            activeAlerts: [
                { severity: 'critical', title: 'Cache Eviction Rate Critical', time: '8m ago', source: 'WiredTiger' },
                {
                    severity: 'critical',
                    title: 'Write Lock Contention Detected',
                    time: '12m ago',
                    source: 'GlobalLock',
                },
                { severity: 'warning', title: 'Replication Lag on replica-2', time: '24m ago', source: 'Replication' },
                { severity: 'warning', title: 'Index Fragmentation High', time: '45m ago', source: 'IndexStats' },
                { severity: 'warning', title: 'Slow Query: orders.find()', time: '1h ago', source: 'Profiler' },
            ],

            // Prometheus Export
            prometheusMetrics: [
                {
                    metric: 'mongodb_connections_current',
                    value: 110,
                    timestamp: 'now',
                    help: 'Current number of connections',
                },
                {
                    metric: 'mongodb_op_counters_total',
                    value: 1284500,
                    timestamp: 'now',
                    help: 'Cumulative operations counter',
                },
                {
                    metric: 'mongodb_wiredtiger_cache_evictions',
                    value: 24800,
                    timestamp: 'now',
                    help: 'WiredTiger cache evictions',
                },
                {
                    metric: 'mongodb_replication_lag_seconds',
                    value: 0.002,
                    timestamp: 'now',
                    help: 'Replication lag in seconds',
                },
            ],

            // SSO/Auth
            authConfig: {
                mechanism: 'SCRAM-SHA-256',
                ldap_enabled: true,
                oauth2_enabled: true,
                mfa_required: true,
                password_policy: 'strong',
                session_timeout: '30m',
            },

            // Atlas API Bridge
            atlasAPIMetrics: [
                { endpoint: 'GET /groups/{groupId}/clusters', calls: 2840, avg_response: 240, errors: 0 },
                { endpoint: 'POST /groups/{groupId}/backups', calls: 24, avg_response: 3200, errors: 0 },
                { endpoint: 'GET /orgs/{orgId}/users', calls: 450, avg_response: 180, errors: 2 },
            ],

            // Dashboards
            customDashboards: [
                { name: 'Operations Overview', widgets: 8, shared: true, last_modified: '2d ago' },
                { name: 'Performance Diagnostics', widgets: 12, shared: false, last_modified: '4h ago' },
                { name: 'SLA Compliance', widgets: 5, shared: true, last_modified: '1w ago' },
            ],

            // Reports
            reports: [
                { name: 'Monthly Performance Report', generated: '2025-03-26', recipients: 12, format: 'PDF' },
                { name: 'Capacity Planning Summary', generated: '2025-03-20', recipients: 8, format: 'HTML' },
                { name: 'Security Audit Log', generated: '2025-03-15', recipients: 5, format: 'JSON' },
            ],

            // Audit Log
            auditLog: [
                {
                    timestamp: '2025-03-26 14:32',
                    action: 'CREATE_INDEX',
                    user: 'alice@company.com',
                    collection: 'orders',
                    status: 'SUCCESS',
                },
                {
                    timestamp: '2025-03-26 13:45',
                    action: 'DROP_COLLECTION',
                    user: 'bob@company.com',
                    collection: 'temp_data',
                    status: 'SUCCESS',
                },
                {
                    timestamp: '2025-03-26 12:20',
                    action: 'ADD_USER',
                    user: 'admin@company.com',
                    target: 'charlie@company.com',
                    status: 'SUCCESS',
                },
                {
                    timestamp: '2025-03-26 11:10',
                    action: 'EXPORT_DATA',
                    user: 'data-team@company.com',
                    database: 'analytics',
                    status: 'SUCCESS',
                },
            ],

            // Users
            users: [
                { username: 'alice@company.com', role: 'Admin', created: '6m ago', last_login: '12m ago', mfa: true },
                { username: 'bob@company.com', role: 'Developer', created: '2m ago', last_login: '8m ago', mfa: false },
                {
                    username: 'charlie@company.com',
                    role: 'Analyst',
                    created: '1w ago',
                    last_login: '2h ago',
                    mfa: true,
                },
                {
                    username: 'data-team@company.com',
                    role: 'Service Account',
                    created: '3w ago',
                    last_login: '1m ago',
                    mfa: false,
                },
            ],

            // ═══════════════════════════════════════════════════════════════════════════
            // EXECUTIVE DASHBOARD ENHANCED DATA
            // ═══════════════════════════════════════════════════════════════════════════

            execKpi: {
                connections: { value: 410, max: 800 },
                opsPerSec: { value: 3105, trend: '+12%' },
                readLatency: { value: '32ms', p99: '184ms' },
                replLag: { value: '0.8s', oplog: '48h window' },
            },

            opsPerSecond30m: Array.from({ length: 16 }, (_, i) => ({
                time: `${(i + 1) * 2}m`,
                query: Math.floor(1800 + Math.sin(i / 3) * 500 + Math.random() * 200),
                write: Math.floor(400 + Math.sin(i / 4) * 100 + Math.random() * 50),
                delete: Math.floor(50 + Math.random() * 30),
            })),

            cpuMemory: Array.from({ length: 16 }, (_, i) => ({
                time: `${(i + 1) * 2}m`,
                cpu: Math.floor(35 + Math.sin(i / 4) * 20 + Math.random() * 10),
                memory: Math.floor(62 + Math.sin(i / 5) * 8 + Math.random() * 5),
            })),

            diskIops: Array.from({ length: 10 }, (_, i) => ({
                time: ['5m', '10m', '15m', '20m', '25m', '30m', '35m', '40m', '45m', '50m'][i],
                read: Math.floor(2000 + Math.random() * 1500),
                write: Math.floor(500 + Math.random() * 400),
            })),

            cacheFill: [
                { name: 'Used', value: 72 },
                { name: 'Free', value: 28 },
            ],
        };
    }, []);

    const sections = [
        {
            key: 'overview',
            label: 'Overview',
            icon: Database,
            accent: THEME.primary,
            items: [
                { key: 'executive', label: 'Executive Dashboard', badge: 'NEW' },
                { key: 'connection', label: 'Connection' },
                { key: 'serverinfo', label: 'Server Info' },
                { key: 'databases', label: 'Databases' },
                { key: 'relationships', label: 'Collection Relationships', badge: 'NEW' },
            ],
        },
        {
            key: 'performance',
            label: 'Performance',
            icon: Zap,
            accent: THEME.success,
            items: [
                { key: 'serverstatus', label: 'Server Status' },
                { key: 'realtimeops', label: 'Real-time Ops' },
                { key: 'latency', label: 'Latency Percentiles', badge: 'NEW' },
                { key: 'namespace', label: 'Namespace Insights', badge: 'NEW' },
                { key: 'explain', label: 'Explain Plan', badge: 'NEW' },
                { key: 'activeops', label: 'Active Operations' },
                { key: 'slowqueries', label: 'Slow Queries' },
                { key: 'profiler', label: 'Query Profiler' },
                { key: 'costestimator', label: 'Query Cost Estimator', badge: 'NEW' },
                { key: 'locks', label: 'Lock Analysis' },
                { key: 'anomaly', label: 'Anomaly Detection', badge: 'NEW' },
                { key: 'metricspreview', label: 'Metrics Preview' },
                { key: 'liveagent', label: 'Live Agent', badge: 'NEW' },
            ],
        },
        {
            key: 'storage',
            label: 'Storage',
            icon: HardDrive,
            accent: THEME.warning,
            items: [
                { key: 'indexadvisor', label: 'Index Advisor', badge: 'NEW' },
                { key: 'schemaanalyzer', label: 'Schema Analyzer', badge: 'NEW' },
                { key: 'collectionstats', label: 'Collection Stats' },
                { key: 'wiredtiger', label: 'WiredTiger Cache' },
                { key: 'backup', label: 'Backup Monitor', badge: 'NEW' },
                { key: 'capacity', label: 'Capacity Planning', badge: 'NEW' },
                { key: 'network', label: 'Network' },
            ],
        },
        {
            key: 'data',
            label: 'Data',
            icon: Code,
            accent: THEME.primary,
            items: [
                { key: 'editor', label: 'Document Editor' },
                { key: 'aggregation', label: 'Aggregation Builder', badge: 'NEW' },
                { key: 'nlquery', label: 'NL Query Generator', badge: 'NEW' },
                { key: 'importexport', label: 'Import/Export', badge: 'NEW' },
                { key: 'sqltranslator', label: 'SQL Translator', badge: 'NEW' },
                { key: 'schemacompare', label: 'Schema Compare', badge: 'NEW' },
                { key: 'geospatial', label: 'Geo-spatial', badge: 'NEW' },
            ],
        },
        {
            key: 'intelligence',
            label: 'Intelligence',
            icon: Brain,
            accent: THEME.ai,
            items: [
                { key: 'aihints', label: 'AI Hints' },
                { key: 'clustercompare', label: 'Compare Clusters' },
                { key: 'historicaltrends', label: 'Historical Trends' },
                { key: 'perfadvisor', label: 'Perf Advisor v2', badge: 'NEW' },
                { key: 'tracecorrelator', label: 'Trace Correlator', badge: 'NEW' },
            ],
        },
        {
            key: 'replication',
            label: 'Replication',
            icon: GitBranch,
            accent: THEME.info || THEME.primary,
            items: [
                { key: 'replicaset', label: 'Replica Set + Failover', badge: 'NEW' },
                { key: 'sharding', label: 'Sharding' },
                { key: 'oplog', label: 'Oplog Tail' },
            ],
        },
        {
            key: 'management',
            label: 'Management',
            icon: Settings,
            accent: THEME.secondary || THEME.primary,
            items: [
                { key: 'alerts', label: 'Alert Manager', badge: 'NEW' },
                { key: 'prometheus', label: 'Prometheus Export', badge: 'NEW' },
                { key: 'auth', label: 'SSO/Auth', badge: 'NEW' },
                { key: 'atlasapi', label: 'Atlas API Bridge', badge: 'NEW' },
                { key: 'dashboards', label: 'Dashboards' },
                { key: 'reports', label: 'Reports' },
                { key: 'auditlog', label: 'Audit Log' },
                { key: 'users', label: 'Users' },
            ],
        },
    ];

    const ExecStatCard = ({ value, label, subtitle, color }) => (
        <div
            style={{
                background: '#ffffff',
                borderRadius: '16px',
                padding: '24px 20px',
                border: '1px solid #1a3878',
                transition: 'all 0.3s ease',
                cursor: 'pointer',
                boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-3px)';
                e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.10)';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)';
            }}
        >
            <div
                style={{
                    fontSize: '42px',
                    fontWeight: 800,
                    letterSpacing: '-0.04em',
                    color,
                    marginBottom: 8,
                }}
            >
                {value}
            </div>
            <div
                style={{
                    fontSize: '11px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.02em',
                    color: THEME.textDim,
                    marginBottom: 4,
                }}
            >
                {label}
            </div>
            <div style={{ fontSize: '10.5px', color: THEME.textDim }}>{subtitle}</div>
        </div>
    );

    const renderContent = (sectionKey, itemKey) => {
        switch (sectionKey) {
            // ═════════════════════════════════════════════════════════════════════════
            // OVERVIEW SECTION
            // ═════════════════════════════════════════════════════════════════════════
            case 'overview':
                switch (itemKey) {
                    case 'executive':
                        // Executive Dashboard - Large Hero KPI Cards with Enhanced Charts
                        return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                {/* Row 1: 4 Large Hero KPI Cards */}
                                <div
                                    style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}
                                    className="dpg-stagger"
                                >
                                    <ExecStatCard
                                        value="410"
                                        label="CONNECTIONS"
                                        subtitle="of 800 max"
                                        color={THEME.success}
                                    />
                                    <ExecStatCard
                                        value="3,105"
                                        label="OPS / SEC"
                                        subtitle="↑ 12% baseline"
                                        color={THEME.info}
                                    />
                                    <ExecStatCard
                                        value="32ms"
                                        label="AVG READ LATENCY"
                                        subtitle="P99: 184ms"
                                        color={THEME.warningDark}
                                    />
                                    <ExecStatCard
                                        value="0.8s"
                                        label="REPLICATION LAG"
                                        subtitle="oplog: 48h window"
                                        color={THEME.textDim}
                                    />
                                </div>

                                {/* Row 2: 2 Charts side-by-side */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 18 }}>
                                    <Panel title="Operations per second — 30 min" accentColor={THEME.primary}>
                                        <ResponsiveContainer width="100%" height={220}>
                                            <LineChart data={demoData.opsPerSecond30m}>
                                                <CartesianGrid strokeDasharray="3 3" stroke={THEME.grid} />
                                                <XAxis dataKey="time" stroke={THEME.textDim} fontSize={11} />
                                                <YAxis stroke={THEME.textDim} fontSize={11} />
                                                <Tooltip content={<ChartTip />} />
                                                <Legend wrapperStyle={{ paddingTop: '12px' }} />
                                                <Line
                                                    type="monotone"
                                                    dataKey="query"
                                                    stroke={THEME.primary}
                                                    strokeWidth={2}
                                                    dot={false}
                                                    name="Query"
                                                    isAnimationActive={false}
                                                />
                                                <Line
                                                    type="monotone"
                                                    dataKey="write"
                                                    stroke={THEME.success}
                                                    strokeWidth={2}
                                                    dot={false}
                                                    name="Write"
                                                    isAnimationActive={false}
                                                />
                                                <Line
                                                    type="monotone"
                                                    dataKey="delete"
                                                    stroke={THEME.dangerDark}
                                                    strokeWidth={2}
                                                    dot={false}
                                                    name="Delete"
                                                    isAnimationActive={false}
                                                />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </Panel>

                                    <Panel title="Latency distribution — P50/P95/P99" accentColor={THEME.warning}>
                                        <ResponsiveContainer width="100%" height={220}>
                                            <LineChart data={demoData.latencyPercentiles}>
                                                <CartesianGrid strokeDasharray="3 3" stroke={THEME.grid} />
                                                <XAxis dataKey="time" stroke={THEME.textDim} fontSize={11} />
                                                <YAxis stroke={THEME.textDim} fontSize={11} />
                                                <Tooltip content={<ChartTip />} />
                                                <Legend wrapperStyle={{ paddingTop: '12px' }} />
                                                <Line
                                                    type="monotone"
                                                    dataKey="p99"
                                                    stroke={THEME.dangerDark}
                                                    strokeWidth={2}
                                                    dot={false}
                                                    name="P99"
                                                    isAnimationActive={false}
                                                />
                                                <Line
                                                    type="monotone"
                                                    dataKey="p95"
                                                    stroke={THEME.warningDark}
                                                    strokeWidth={2}
                                                    dot={false}
                                                    name="P95"
                                                    isAnimationActive={false}
                                                />
                                                <Line
                                                    type="monotone"
                                                    dataKey="p50"
                                                    stroke={THEME.success}
                                                    strokeWidth={2}
                                                    dot={false}
                                                    name="P50"
                                                    isAnimationActive={false}
                                                />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </Panel>
                                </div>

                                {/* Row 3: 3 Charts */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 22 }}>
                                    <Panel title="CPU & memory %" accentColor={THEME.info}>
                                        <ResponsiveContainer width="100%" height={180}>
                                            <LineChart data={demoData.cpuMemory}>
                                                <CartesianGrid strokeDasharray="3 3" stroke={THEME.grid} />
                                                <XAxis dataKey="time" stroke={THEME.textDim} fontSize={10} />
                                                <YAxis stroke={THEME.textDim} fontSize={10} domain={[0, 100]} />
                                                <Tooltip content={<ChartTip />} />
                                                <Line
                                                    type="monotone"
                                                    dataKey="cpu"
                                                    stroke={THEME.info}
                                                    strokeWidth={2}
                                                    dot={false}
                                                    isAnimationActive={false}
                                                />
                                                <Line
                                                    type="monotone"
                                                    dataKey="memory"
                                                    stroke={THEME.ai}
                                                    strokeWidth={2}
                                                    dot={false}
                                                    isAnimationActive={false}
                                                />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </Panel>

                                    <Panel title="Disk IOPS" accentColor={THEME.success}>
                                        <ResponsiveContainer width="100%" height={180}>
                                            <BarChart data={demoData.diskIops}>
                                                <CartesianGrid strokeDasharray="3 3" stroke={THEME.grid} />
                                                <XAxis dataKey="time" stroke={THEME.textDim} fontSize={10} />
                                                <YAxis stroke={THEME.textDim} fontSize={10} />
                                                <Tooltip content={<ChartTip />} />
                                                <Bar dataKey="read" fill={THEME.info} isAnimationActive={false} />
                                                <Bar dataKey="write" fill={THEME.success} isAnimationActive={false} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </Panel>

                                    <Panel title="Cache fill ratio" accentColor={THEME.primary}>
                                        <ResponsiveContainer width="100%" height={180}>
                                            <PieChart>
                                                <Pie
                                                    data={demoData.cacheFill}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={35}
                                                    outerRadius={60}
                                                    dataKey="value"
                                                    isAnimationActive={false}
                                                >
                                                    <Cell fill={THEME.success} />
                                                    <Cell fill={THEME.surfaceRaised} />
                                                </Pie>
                                                <Tooltip />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </Panel>
                                </div>
                            </div>
                        );
                    case 'connection':
                        return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                <div
                                    style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 22 }}
                                    className="dpg-stagger"
                                >
                                    <MetricCard
                                        icon={Network}
                                        label="Active"
                                        value={demoData.connectionStats.active}
                                        color={THEME.success}
                                    />
                                    <MetricCard
                                        icon={Eye}
                                        label="Idle"
                                        value={demoData.connectionStats.idle}
                                        color={THEME.warning}
                                    />
                                    <MetricCard
                                        icon={Filter}
                                        label="Available"
                                        value={demoData.connectionStats.available}
                                        color={THEME.primary}
                                    />
                                    <MetricCard
                                        icon={Database}
                                        label="Max Pool"
                                        value={demoData.connectionStats.maxPoolSize}
                                        color={THEME.info || THEME.primary}
                                    />
                                </div>

                                <Panel title="Connection Trends" icon={TrendingUp} accentColor={THEME.success}>
                                    <ResponsiveContainer width="100%" height={240}>
                                        <AreaChart data={demoData.connectionTrends}>
                                            <defs>
                                                <linearGradient id="colorActive" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor={THEME.success} stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor={THEME.success} stopOpacity={0} />
                                                </linearGradient>
                                                <linearGradient id="colorIdle" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor={THEME.warning} stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor={THEME.warning} stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke={THEME.grid} />
                                            <XAxis dataKey="time" stroke={THEME.textDim} />
                                            <YAxis stroke={THEME.textDim} />
                                            <Tooltip content={<ChartTip />} />
                                            <Area
                                                type="monotone"
                                                dataKey="active"
                                                stroke={THEME.success}
                                                fill="url(#colorActive)"
                                            />
                                            <Area
                                                type="monotone"
                                                dataKey="idle"
                                                stroke={THEME.warning}
                                                fill="url(#colorIdle)"
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </Panel>
                            </div>
                        );
                    case 'serverinfo':
                        return (
                            <div className="dpg-stagger" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                                <div
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                                        gap: 18,
                                    }}
                                >
                                    <MetricCard label="Uptime" value="142d 7h" sub="+1.2%" icon={Clock} />
                                    <MetricCard label="Version" value="7.0.12" sub="Latest" icon={Server} />
                                    <MetricCard label="Connections" value="847/10000" sub="+8.4%" icon={Users} />
                                    <MetricCard label="Memory" value="12.4 GB" sub="38.8% used" icon={HardDrive} />
                                </div>
                                <Panel title="Server Configuration" icon={Settings} accentColor={THEME.primary}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22 }}>
                                        {[
                                            { label: 'Hostname', value: demoData.serverInfo.hostname },
                                            { label: 'Port', value: demoData.serverInfo.port },
                                            { label: 'Memory', value: demoData.serverInfo.memory },
                                            { label: 'Storage', value: demoData.serverInfo.storage },
                                            { label: 'OS', value: demoData.serverInfo.os },
                                            { label: 'Architecture', value: demoData.serverInfo.arch },
                                        ].map((item, i) => (
                                            <div key={i}>
                                                <div
                                                    style={{
                                                        fontSize: 10,
                                                        color: THEME.textDim,
                                                        fontWeight: 600,
                                                        letterSpacing: '0.02em',
                                                        marginBottom: 4,
                                                    }}
                                                >
                                                    {item.label.toUpperCase()}
                                                </div>
                                                <div
                                                    style={{
                                                        fontSize: 14,
                                                        fontWeight: 600,
                                                        color: THEME.textMain,
                                                        fontFamily: THEME.fontMono,
                                                    }}
                                                >
                                                    {item.value}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </Panel>
                                <Panel title="Resource Utilization" icon={Cpu} accentColor={THEME.warning}>
                                    <ResponsiveContainer width="100%" height={220}>
                                        <BarChart
                                            data={[
                                                { name: 'CPU', value: 68 },
                                                { name: 'Memory', value: 38.8 },
                                                { name: 'Disk', value: 72 },
                                                { name: 'Network', value: 45 },
                                            ]}
                                        >
                                            <defs>
                                                <linearGradient id="mdb-serverinfo-grad1" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor={THEME.warning} stopOpacity={0.8} />
                                                    <stop offset="95%" stopColor={THEME.warning} stopOpacity={0.2} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke={THEME.grid} />
                                            <XAxis dataKey="name" stroke={THEME.textDim} />
                                            <YAxis stroke={THEME.textDim} />
                                            <Tooltip content={<ChartTip />} />
                                            <Bar
                                                dataKey="value"
                                                fill="url(#mdb-serverinfo-grad1)"
                                                radius={[8, 8, 0, 0]}
                                            />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </Panel>
                                <Panel title="System Events" icon={AlertTriangle} accentColor={THEME.danger}>
                                    <DataTable
                                        columns={[
                                            { key: 'time', label: 'Time', width: '20%' },
                                            { key: 'event', label: 'Event', width: '40%' },
                                            { key: 'severity', label: 'Severity', width: '20%' },
                                            { key: 'details', label: 'Details', width: '20%' },
                                        ]}
                                        rows={[
                                            {
                                                time: '14:42:18',
                                                event: 'Memory Threshold Alert',
                                                severity: 'Warning',
                                                details: 'Memory at 85%',
                                            },
                                            {
                                                time: '14:38:45',
                                                event: 'Connection Pool Full',
                                                severity: 'Critical',
                                                details: 'Reached 10000/10000',
                                            },
                                            {
                                                time: '14:35:22',
                                                event: 'Disk Usage Alert',
                                                severity: 'Warning',
                                                details: 'Disk at 80%',
                                            },
                                            {
                                                time: '14:30:10',
                                                event: 'Cache Eviction',
                                                severity: 'Info',
                                                details: 'Evicted 2.4M items',
                                            },
                                        ]}
                                        accentColor={THEME.primary}
                                    />
                                </Panel>
                            </div>
                        );
                    case 'databases':
                        return (
                            <div className="dpg-stagger" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                                <h1>Databases</h1>
                                <div
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                                        gap: 18,
                                    }}
                                >
                                    <MetricCard
                                        icon={Database}
                                        label="Databases"
                                        value="8"
                                        color={THEME.primary}
                                        spark={Array.from({ length: 12 }, () => 8)}
                                    />
                                    <MetricCard
                                        icon={Layers}
                                        label="Total Collections"
                                        value="145"
                                        color={THEME.success}
                                        spark={Array.from({ length: 12 }, () => 130 + Math.random() * 30)}
                                    />
                                    <MetricCard
                                        icon={HardDrive}
                                        label="Storage"
                                        value="18.6GB"
                                        color={THEME.warning}
                                        spark={Array.from({ length: 12 }, () => 18000 + Math.random() * 1000)}
                                    />
                                    <MetricCard
                                        icon={Copy}
                                        label="Objects"
                                        value="2.4M"
                                        color={THEME.info || THEME.primary}
                                        spark={Array.from({ length: 12 }, () => 2000000 + Math.random() * 500000)}
                                    />
                                </div>

                                <Panel title="Size by Database" icon={BarChart3} accentColor={THEME.primary}>
                                    <ResponsiveContainer width="100%" height={180}>
                                        <BarChart
                                            data={generateChartData(12).map((d) => ({
                                                ...d,
                                                dbsize: Math.random() * 3000,
                                            }))}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" stroke={THEME.grid} />
                                            <XAxis dataKey="time" stroke={THEME.textDim} />
                                            <YAxis stroke={THEME.textDim} />
                                            <Tooltip content={<ChartTip />} />
                                            <Bar dataKey="dbsize" fill={THEME.primary} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </Panel>

                                <Panel title="Database List" icon={Database} accentColor={THEME.primary}>
                                    <DataTable
                                        columns={[
                                            { key: 'name', label: 'Database', width: '25%' },
                                            { key: 'collections', label: 'Collections', align: 'right' },
                                            { key: 'size', label: 'Size', align: 'right', mono: true },
                                            { key: 'indexes', label: 'Indexes', align: 'right' },
                                            { key: 'doc_count', label: 'Document Count', align: 'right', mono: true },
                                        ]}
                                        rows={demoData.databases}
                                        accentColor={THEME.primary}
                                    />
                                </Panel>
                            </div>
                        );
                    case 'relationships':
                        return (
                            <div className="dpg-stagger" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                                <h1>Collection Relationships</h1>
                                <div
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                                        gap: 18,
                                    }}
                                >
                                    <MetricCard
                                        icon={GitBranch}
                                        label="References"
                                        value="156"
                                        color={THEME.primary}
                                        spark={Array.from({ length: 12 }, () => 140 + Math.random() * 30)}
                                    />
                                    <MetricCard
                                        icon={Layers}
                                        label="Embedded"
                                        value="89"
                                        color={THEME.success}
                                        spark={Array.from({ length: 12 }, () => 80 + Math.random() * 20)}
                                    />
                                    <MetricCard
                                        icon={Copy}
                                        label="Denormalized"
                                        value="42"
                                        color={THEME.warning}
                                        spark={Array.from({ length: 12 }, () => Math.random() * 50)}
                                    />
                                    <MetricCard
                                        icon={AlertTriangle}
                                        label="Orphaned"
                                        value="3"
                                        color={THEME.danger}
                                        trend="-0.5%"
                                    />
                                </div>

                                <Panel
                                    title="Relationship Type Distribution"
                                    icon={PieChart}
                                    accentColor={THEME.primary}
                                >
                                    <ResponsiveContainer width="100%" height={180}>
                                        <PieChart>
                                            <Pie
                                                data={[
                                                    { name: 'References', value: 156 },
                                                    { name: 'Embedded', value: 89 },
                                                    { name: 'Denormalized', value: 42 },
                                                ]}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={40}
                                                outerRadius={70}
                                                paddingAngle={2}
                                                dataKey="value"
                                            >
                                                <Cell fill={THEME.primary} />
                                                <Cell fill={THEME.success} />
                                                <Cell fill={THEME.warning} />
                                            </Pie>
                                            <Tooltip />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </Panel>

                                <Panel title="Reference Data" icon={GitBranch} accentColor={THEME.primary}>
                                    <DataTable
                                        columns={[
                                            { key: 'from', label: 'From Collection', width: '25%', mono: true },
                                            { key: 'to', label: 'To Collection', width: '25%', mono: true },
                                            { key: 'type', label: 'Type', align: 'center' },
                                            { key: 'count', label: 'Operations', align: 'right', mono: true },
                                        ]}
                                        rows={demoData.collectionRelationships}
                                        accentColor={THEME.primary}
                                    />
                                </Panel>
                            </div>
                        );
                    default:
                        return null;
                }

            // ═════════════════════════════════════════════════════════════════════════
            // PERFORMANCE SECTION
            // ═════════════════════════════════════════════════════════════════════════
            case 'performance':
                switch (itemKey) {
                    case 'serverstatus':
                        return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                <div
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                                        gap: 18,
                                    }}
                                    className="dpg-stagger"
                                >
                                    <MetricCard
                                        icon={Zap}
                                        label="Created"
                                        value={demoData.serverStatus.connectionsCreated}
                                        color={THEME.primary}
                                        trend={12}
                                        trendUp
                                    />
                                    <MetricCard
                                        icon={Upload}
                                        label="Bytes In"
                                        value={demoData.serverStatus.networkBytesIn}
                                        color={THEME.success}
                                    />
                                    <MetricCard
                                        icon={Download}
                                        label="Bytes Out"
                                        value={demoData.serverStatus.networkBytesOut}
                                        color={THEME.warning}
                                    />
                                    <MetricCard
                                        icon={Copy}
                                        label="Inserts"
                                        value={demoData.serverStatus.operationsIns}
                                        color={THEME.info || THEME.primary}
                                        trend={8}
                                        trendUp
                                    />
                                    <MetricCard
                                        icon={RefreshCw}
                                        label="Updates"
                                        value={demoData.serverStatus.operationsUpd}
                                        color={THEME.success}
                                        trend={5}
                                        trendUp
                                    />
                                    <MetricCard
                                        icon={Layers}
                                        label="Deletes"
                                        value={demoData.serverStatus.operationsDel}
                                        color={THEME.danger}
                                        trend={2}
                                        trendUp
                                    />
                                    <MetricCard
                                        icon={Eye}
                                        label="Queries"
                                        value={demoData.serverStatus.operationsQry}
                                        color={THEME.primary}
                                        trend={15}
                                        trendUp
                                    />
                                </div>

                                <Panel title="Server Status Trends" icon={Activity} accentColor={THEME.success}>
                                    <ResponsiveContainer width="100%" height={240}>
                                        <LineChart data={demoData.realtimeOps}>
                                            <CartesianGrid strokeDasharray="3 3" stroke={THEME.grid} />
                                            <XAxis dataKey="time" stroke={THEME.textDim} />
                                            <YAxis stroke={THEME.textDim} />
                                            <Tooltip content={<ChartTip />} />
                                            <Line
                                                type="monotone"
                                                dataKey="read"
                                                stroke={THEME.primary}
                                                strokeWidth={2}
                                            />
                                            <Line
                                                type="monotone"
                                                dataKey="write"
                                                stroke={THEME.warning}
                                                strokeWidth={2}
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </Panel>
                            </div>
                        );
                    case 'realtimeops':
                        return (
                            <div className="dpg-stagger" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                                <div
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                                        gap: 18,
                                    }}
                                >
                                    <MetricCard
                                        icon={Zap}
                                        label="Ops/sec"
                                        value="2,847"
                                        color={THEME.success}
                                        trend="+12%"
                                        spark={Array.from({ length: 12 }, () => 2500 + Math.random() * 800)}
                                    />
                                    <MetricCard
                                        icon={Upload}
                                        label="Insert/sec"
                                        value="543"
                                        color={THEME.primary}
                                        spark={Array.from({ length: 12 }, () => 400 + Math.random() * 300)}
                                    />
                                    <MetricCard
                                        icon={RefreshCw}
                                        label="Update/sec"
                                        value="1,204"
                                        color={THEME.success}
                                        spark={Array.from({ length: 12 }, () => 1000 + Math.random() * 400)}
                                    />
                                    <MetricCard
                                        icon={Download}
                                        label="Delete/sec"
                                        value="89"
                                        color={THEME.warning}
                                        spark={Array.from({ length: 12 }, () => 70 + Math.random() * 40)}
                                    />
                                </div>
                                <Panel title="Operation Rates" icon={Activity} accentColor={THEME.success}>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <AreaChart data={demoData.realtimeOps}>
                                            <defs>
                                                <linearGradient id="mongo-realtimeops-read" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor={THEME.primary} stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor={THEME.primary} stopOpacity={0} />
                                                </linearGradient>
                                                <linearGradient
                                                    id="mongo-realtimeops-write"
                                                    x1="0"
                                                    y1="0"
                                                    x2="0"
                                                    y2="1"
                                                >
                                                    <stop offset="5%" stopColor={THEME.warning} stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor={THEME.warning} stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke={THEME.grid} />
                                            <XAxis dataKey="time" stroke={THEME.textDim} />
                                            <YAxis stroke={THEME.textDim} />
                                            <Tooltip content={<ChartTip />} />
                                            <Legend wrapperStyle={{ color: THEME.textMuted }} />
                                            <Area
                                                type="monotone"
                                                dataKey="read"
                                                stroke={THEME.primary}
                                                fill="url(#mongo-realtimeops-read)"
                                                stackId="1"
                                                name="Reads"
                                            />
                                            <Area
                                                type="monotone"
                                                dataKey="write"
                                                stroke={THEME.warning}
                                                fill="url(#mongo-realtimeops-write)"
                                                stackId="1"
                                                name="Writes"
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </Panel>
                            </div>
                        );
                    case 'latency':
                        return (
                            <div className="dpg-stagger" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                                <div
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                                        gap: 18,
                                    }}
                                >
                                    <MetricCard
                                        icon={Gauge}
                                        label="P50 Latency"
                                        value="12ms"
                                        color={THEME.success}
                                        spark={Array.from({ length: 12 }, () => 10 + Math.random() * 5)}
                                    />
                                    <MetricCard
                                        icon={Gauge}
                                        label="P95 Latency"
                                        value="48ms"
                                        color={THEME.warning}
                                        spark={Array.from({ length: 12 }, () => 40 + Math.random() * 20)}
                                    />
                                    <MetricCard
                                        icon={Gauge}
                                        label="P99 Latency"
                                        value="156ms"
                                        color={THEME.danger}
                                        spark={Array.from({ length: 12 }, () => 120 + Math.random() * 80)}
                                    />
                                    <MetricCard
                                        icon={TrendingUp}
                                        label="Max Latency"
                                        value="384ms"
                                        color={THEME.danger}
                                        spark={Array.from({ length: 12 }, () => 300 + Math.random() * 150)}
                                    />
                                </div>
                                <Panel title="Latency Percentiles" icon={Gauge} accentColor={THEME.warning}>
                                    <ResponsiveContainer width="100%" height={280}>
                                        <LineChart data={demoData.latencyPercentiles}>
                                            <CartesianGrid strokeDasharray="3 3" stroke={THEME.grid} />
                                            <XAxis dataKey="time" stroke={THEME.textDim} />
                                            <YAxis stroke={THEME.textDim} />
                                            <Tooltip content={<ChartTip />} />
                                            <Legend wrapperStyle={{ color: THEME.textMuted }} />
                                            <Line
                                                type="monotone"
                                                dataKey="p50"
                                                stroke={THEME.success}
                                                strokeWidth={2}
                                                name="p50"
                                            />
                                            <Line
                                                type="monotone"
                                                dataKey="p95"
                                                stroke={THEME.warning}
                                                strokeWidth={2}
                                                name="p95"
                                            />
                                            <Line
                                                type="monotone"
                                                dataKey="p99"
                                                stroke={THEME.danger}
                                                strokeWidth={2}
                                                name="p99"
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </Panel>
                            </div>
                        );
                    case 'namespace':
                        return (
                            <div className="dpg-stagger" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                                <h1>Namespace Insights</h1>
                                <div
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                                        gap: 18,
                                    }}
                                >
                                    <MetricCard
                                        icon={Database}
                                        label="Namespaces"
                                        value="64"
                                        color={THEME.primary}
                                        spark={Array.from({ length: 12 }, () => 60 + Math.random() * 10)}
                                    />
                                    <MetricCard
                                        icon={Activity}
                                        label="Active"
                                        value="52"
                                        color={THEME.success}
                                        spark={Array.from({ length: 12 }, () => 50 + Math.random() * 5)}
                                    />
                                    <MetricCard
                                        icon={Zap}
                                        label="Ops/sec"
                                        value="2.4K"
                                        color={THEME.primary}
                                        spark={Array.from({ length: 12 }, () => 2000 + Math.random() * 800)}
                                    />
                                    <MetricCard
                                        icon={Clock}
                                        label="Avg Latency"
                                        value="8.2ms"
                                        color={THEME.warning}
                                        trend="-1.5%"
                                    />
                                </div>

                                <Panel title="Namespace Activity" icon={Activity} accentColor={THEME.primary}>
                                    <ResponsiveContainer width="100%" height={180}>
                                        <LineChart
                                            data={generateChartData(24).map((d) => ({
                                                ...d,
                                                activity: Math.random() * 3000,
                                            }))}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" stroke={THEME.grid} />
                                            <XAxis dataKey="time" stroke={THEME.textDim} />
                                            <YAxis stroke={THEME.textDim} />
                                            <Tooltip content={<ChartTip />} />
                                            <Line
                                                type="monotone"
                                                dataKey="activity"
                                                stroke={THEME.primary}
                                                strokeWidth={2}
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </Panel>

                                <Panel title="Top Namespaces" icon={Database} accentColor={THEME.primary}>
                                    <DataTable
                                        columns={[
                                            { key: 'ns', label: 'Namespace', mono: true },
                                            { key: 'ops_sec', label: 'Ops/sec', align: 'right' },
                                            {
                                                key: 'avg_latency',
                                                label: 'Avg Latency (ms)',
                                                align: 'right',
                                                mono: true,
                                            },
                                            { key: 'size_mb', label: 'Size (MB)', align: 'right', mono: true },
                                            { key: 'index_count', label: 'Indexes', align: 'right' },
                                        ]}
                                        rows={demoData.namespaceMetrics}
                                        accentColor={THEME.primary}
                                    />
                                </Panel>
                            </div>
                        );
                    case 'explain':
                        return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                <Panel title="Explain Plan" icon={Eye} accentColor={THEME.info || THEME.primary}>
                                    <div
                                        style={{
                                            display: 'grid',
                                            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                                            gap: 18,
                                        }}
                                    >
                                        <div>
                                            <div
                                                style={{
                                                    fontSize: 10,
                                                    color: THEME.textDim,
                                                    fontWeight: 600,
                                                    letterSpacing: '0.02em',
                                                    marginBottom: 6,
                                                }}
                                            >
                                                EXECUTION STAGE
                                            </div>
                                            <StatusBadge
                                                label={demoData.explainPlanExample.executionStage}
                                                color={THEME.warning}
                                            />
                                        </div>
                                        <div>
                                            <div
                                                style={{
                                                    fontSize: 10,
                                                    color: THEME.textDim,
                                                    fontWeight: 600,
                                                    letterSpacing: '0.02em',
                                                    marginBottom: 6,
                                                }}
                                            >
                                                RETURNED DOCS
                                            </div>
                                            <div style={{ fontSize: 18, fontWeight: 700, color: THEME.primary }}>
                                                {demoData.explainPlanExample.nReturned.toLocaleString()}
                                            </div>
                                        </div>
                                        <div>
                                            <div
                                                style={{
                                                    fontSize: 10,
                                                    color: THEME.textDim,
                                                    fontWeight: 600,
                                                    letterSpacing: '0.02em',
                                                    marginBottom: 6,
                                                }}
                                            >
                                                EXEC TIME (MS)
                                            </div>
                                            <div style={{ fontSize: 18, fontWeight: 700, color: THEME.warning }}>
                                                {demoData.explainPlanExample.executionTimeMillis}
                                            </div>
                                        </div>
                                        <div>
                                            <div
                                                style={{
                                                    fontSize: 10,
                                                    color: THEME.textDim,
                                                    fontWeight: 600,
                                                    letterSpacing: '0.02em',
                                                    marginBottom: 6,
                                                }}
                                            >
                                                KEYS EXAMINED
                                            </div>
                                            <div style={{ fontSize: 16, fontWeight: 700, color: THEME.textMuted }}>
                                                {(demoData.explainPlanExample.totalKeysExamined / 1000000).toFixed(1)}M
                                            </div>
                                        </div>
                                    </div>
                                    <div
                                        style={{
                                            marginTop: 16,
                                            padding: 12,
                                            background: THEME.surface,
                                            borderRadius: 20,
                                            border: `1px solid ${THEME.glassBorder}`,
                                            fontFamily: THEME.fontMono,
                                            fontSize: 11,
                                            color: THEME.textMuted,
                                            wordBreak: 'break-all',
                                        }}
                                    >
                                        {demoData.explainPlanExample.query}
                                    </div>
                                </Panel>
                            </div>
                        );
                    case 'activeops':
                        return (
                            <div className="dpg-stagger" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                                <div
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                                        gap: 18,
                                    }}
                                >
                                    <MetricCard label="Active Ops" value="23" sub="+3" icon={Activity} />
                                    <MetricCard label="Queued" value="5" sub="-1" icon={Clock} />
                                    <MetricCard label="Avg Duration" value="142ms" sub="-5ms" icon={Clock} />
                                    <MetricCard label="Blocked" value="2" sub="Monitoring" icon={AlertTriangle} />
                                </div>
                                <Panel title="Active Operations" icon={Activity} accentColor={THEME.success}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                        {demoData.activeOps.map((op, i) => (
                                            <div
                                                key={i}
                                                style={{
                                                    padding: 12,
                                                    background: `${THEME.primary}08`,
                                                    borderLeft: `3px solid ${THEME.primary}`,
                                                    borderRadius: 18,
                                                    fontSize: 12,
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        marginBottom: 6,
                                                    }}
                                                >
                                                    <span style={{ fontWeight: 600, color: THEME.textMain }}>
                                                        {op.id}
                                                    </span>
                                                    <span style={{ color: THEME.textDim }}>
                                                        Active: {op.active_time}
                                                    </span>
                                                </div>
                                                <div
                                                    style={{
                                                        display: 'flex',
                                                        gap: 22,
                                                        fontSize: 11,
                                                        color: THEME.textMuted,
                                                    }}
                                                >
                                                    <span>Namespace: {op.ns}</span>
                                                    <span>Cmd: {op.cmd}</span>
                                                    {op.blocks && (
                                                        <span style={{ color: THEME.warning }}>
                                                            Blocks: {op.blocks}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </Panel>
                                <Panel title="Operations Over Time" icon={TrendingUp} accentColor={THEME.success}>
                                    <ResponsiveContainer width="100%" height={220}>
                                        <LineChart
                                            data={[
                                                { time: '00:00', ops: 18 },
                                                { time: '02:30', ops: 21 },
                                                { time: '05:00', ops: 19 },
                                                { time: '07:30', ops: 25 },
                                                { time: '10:00', ops: 23 },
                                                { time: '12:30', ops: 28 },
                                                { time: '15:00', ops: 26 },
                                                { time: '17:30', ops: 31 },
                                                { time: '20:00', ops: 29 },
                                                { time: '22:30', ops: 24 },
                                                { time: '23:45', ops: 23 },
                                                { time: '23:59', ops: 23 },
                                            ]}
                                        >
                                            <defs>
                                                <linearGradient id="mdb-activeops-grad1" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor={THEME.success} stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor={THEME.success} stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke={THEME.grid} />
                                            <XAxis dataKey="time" stroke={THEME.textDim} />
                                            <YAxis stroke={THEME.textDim} />
                                            <Tooltip content={<ChartTip />} />
                                            <Line
                                                type="monotone"
                                                dataKey="ops"
                                                stroke={THEME.success}
                                                dot={false}
                                                strokeWidth={2}
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </Panel>
                                <Panel title="Operation Types" icon={Database} accentColor={THEME.success}>
                                    <DataTable
                                        columns={[
                                            { key: 'type', label: 'Type', width: '25%' },
                                            { key: 'count', label: 'Count', width: '25%' },
                                            { key: 'avgDuration', label: 'Avg Duration', width: '25%' },
                                            { key: 'maxDuration', label: 'Max Duration', width: '25%' },
                                        ]}
                                        rows={[
                                            { type: 'find', count: '12', avgDuration: '128ms', maxDuration: '340ms' },
                                            { type: 'update', count: '8', avgDuration: '156ms', maxDuration: '420ms' },
                                            { type: 'insert', count: '2', avgDuration: '92ms', maxDuration: '180ms' },
                                            {
                                                type: 'aggregate',
                                                count: '1',
                                                avgDuration: '185ms',
                                                maxDuration: '185ms',
                                            },
                                        ]}
                                        accentColor={THEME.success}
                                    />
                                </Panel>
                            </div>
                        );
                    case 'slowqueries':
                        return (
                            <Panel title="Slow Queries" icon={AlertTriangle} accentColor={THEME.danger}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                    {demoData.slowQueries.map((q, i) => (
                                        <div
                                            key={i}
                                            style={{
                                                padding: 12,
                                                background: `${THEME.danger}08`,
                                                borderLeft: `3px solid ${THEME.danger}`,
                                                borderRadius: 18,
                                            }}
                                        >
                                            <div
                                                style={{
                                                    fontSize: 11,
                                                    fontFamily: THEME.fontMono,
                                                    color: THEME.textMuted,
                                                    marginBottom: 6,
                                                    wordBreak: 'break-word',
                                                }}
                                            >
                                                {q.query}
                                            </div>
                                            <div
                                                style={{
                                                    display: 'grid',
                                                    gridTemplateColumns: 'repeat(3, 1fr)',
                                                    gap: 18,
                                                    fontSize: 10,
                                                }}
                                            >
                                                <div>
                                                    <span style={{ color: THEME.textDim }}>Duration</span>
                                                    <div style={{ fontWeight: 600, color: THEME.danger }}>
                                                        {q.duration}ms
                                                    </div>
                                                </div>
                                                <div>
                                                    <span style={{ color: THEME.textDim }}>Scanned</span>
                                                    <div style={{ fontWeight: 600 }}>
                                                        {(q.scanned / 1000).toFixed(0)}k
                                                    </div>
                                                </div>
                                                <div>
                                                    <span style={{ color: THEME.textDim }}>Returned</span>
                                                    <div style={{ fontWeight: 600 }}>
                                                        {(q.returned / 1000).toFixed(1)}k
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </Panel>
                        );
                    case 'profiler':
                        return (
                            <div className="dpg-stagger" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                                <h1>Query Profiler</h1>
                                <div
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                                        gap: 18,
                                    }}
                                >
                                    <MetricCard
                                        icon={Radio}
                                        label="Profiled Ops"
                                        value="1.2K"
                                        color={THEME.primary}
                                        spark={Array.from({ length: 12 }, () => Math.random() * 1500)}
                                    />
                                    <MetricCard
                                        icon={AlertTriangle}
                                        label="Slow Ops"
                                        value="34"
                                        color={THEME.danger}
                                        spark={Array.from({ length: 12 }, () => Math.random() * 50)}
                                    />
                                    <MetricCard
                                        icon={Clock}
                                        label="Avg Time"
                                        value="23.4ms"
                                        color={THEME.warning}
                                        trend="+2.1%"
                                    />
                                    <MetricCard
                                        icon={Database}
                                        label="Collection Coverage"
                                        value="94%"
                                        color={THEME.success}
                                        spark={Array.from({ length: 12 }, () => 90 + Math.random() * 10)}
                                    />
                                </div>

                                <Panel title="Operation Time Distribution" icon={BarChart3} accentColor={THEME.primary}>
                                    <ResponsiveContainer width="100%" height={180}>
                                        <BarChart
                                            data={generateChartData(12).map((d) => ({
                                                ...d,
                                                duration: Math.random() * 100,
                                            }))}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" stroke={THEME.grid} />
                                            <XAxis dataKey="time" stroke={THEME.textDim} />
                                            <YAxis stroke={THEME.textDim} />
                                            <Tooltip content={<ChartTip />} />
                                            <Bar dataKey="duration" fill={THEME.primary} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </Panel>

                                <Panel title="Slow Operations" icon={Radio} accentColor={THEME.primary}>
                                    <DataTable
                                        columns={[
                                            { key: 'timestamp', label: 'Timestamp', mono: true },
                                            { key: 'ns', label: 'Namespace', mono: true },
                                            { key: 'millis', label: 'Duration (ms)', align: 'right', mono: true },
                                            { key: 'docs', label: 'Docs', align: 'right' },
                                        ]}
                                        rows={demoData.profiledQueries}
                                        accentColor={THEME.primary}
                                    />
                                </Panel>
                            </div>
                        );
                    case 'costestimator':
                        return (
                            <Panel title="Query Cost Estimator" icon={Lightbulb} accentColor={THEME.warning}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 22 }}>
                                    <div>
                                        <div
                                            style={{
                                                fontSize: 10,
                                                color: THEME.textDim,
                                                fontWeight: 600,
                                                letterSpacing: '0.02em',
                                                marginBottom: 8,
                                            }}
                                        >
                                            ESTIMATED COST
                                        </div>
                                        <div style={{ fontSize: 24, fontWeight: 700, color: THEME.primary }}>
                                            {demoData.costEstimate.estimatedCost.toFixed(2)}
                                        </div>
                                    </div>
                                    <div>
                                        <div
                                            style={{
                                                fontSize: 10,
                                                color: THEME.textDim,
                                                fontWeight: 600,
                                                letterSpacing: '0.02em',
                                                marginBottom: 8,
                                            }}
                                        >
                                            ESTIMATED ROWS
                                        </div>
                                        <div style={{ fontSize: 24, fontWeight: 700, color: THEME.success }}>
                                            {demoData.costEstimate.estimatedRows.toLocaleString()}
                                        </div>
                                    </div>
                                </div>
                                <div style={{ marginTop: 16 }}>
                                    <div
                                        style={{
                                            fontSize: 10,
                                            color: THEME.textDim,
                                            fontWeight: 600,
                                            letterSpacing: '0.02em',
                                            marginBottom: 8,
                                        }}
                                    >
                                        RECOMMENDATION
                                    </div>
                                    <StatusBadge label={demoData.costEstimate.recommendation} color={THEME.success} />
                                </div>
                            </Panel>
                        );
                    case 'locks':
                        return (
                            <div className="dpg-stagger" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                                <div
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                                        gap: 18,
                                    }}
                                >
                                    <MetricCard
                                        icon={Lock}
                                        label="Current Locks"
                                        value="24"
                                        color={THEME.warning}
                                        spark={Array.from({ length: 12 }, () => 15 + Math.random() * 15)}
                                    />
                                    <MetricCard
                                        icon={AlertCircle}
                                        label="Lock Waits"
                                        value="142"
                                        color={THEME.danger}
                                        trend="+8%"
                                        spark={Array.from({ length: 12 }, () => 80 + Math.random() * 80)}
                                    />
                                    <MetricCard
                                        icon={Clock}
                                        label="Avg Wait Time"
                                        value="234ms"
                                        color={THEME.warning}
                                        spark={Array.from({ length: 12 }, () => 150 + Math.random() * 150)}
                                    />
                                    <MetricCard
                                        icon={RefreshCw}
                                        label="Deadlocks"
                                        value="3"
                                        color={THEME.danger}
                                        spark={Array.from({ length: 12 }, () => 1 + Math.random() * 4)}
                                    />
                                </div>
                                <Panel title="Lock Wait Time Trend" icon={TrendingUp} accentColor={THEME.warning}>
                                    <ResponsiveContainer width="100%" height={240}>
                                        <AreaChart data={demoData.lockMetrics}>
                                            <defs>
                                                <linearGradient id="mongo-locks-grad" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor={THEME.warning} stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor={THEME.warning} stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke={THEME.grid} />
                                            <XAxis dataKey="time" stroke={THEME.textDim} />
                                            <YAxis stroke={THEME.textDim} />
                                            <Tooltip content={<ChartTip />} />
                                            <Area
                                                type="monotone"
                                                dataKey="waits"
                                                stroke={THEME.warning}
                                                fill="url(#mongo-locks-grad)"
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </Panel>
                                <Panel title="Lock Details" icon={Lock} accentColor={THEME.warning}>
                                    <DataTable
                                        columns={[
                                            { key: 'lock_id', label: 'Lock ID', mono: true },
                                            { key: 'type', label: 'Type', width: '15%' },
                                            { key: 'wait_ms', label: 'Wait (ms)', align: 'right' },
                                            { key: 'holder', label: 'Holder', width: '20%' },
                                            { key: 'status', label: 'Status' },
                                        ]}
                                        rows={[
                                            {
                                                lock_id: 'LCK_001',
                                                type: 'Shared',
                                                wait_ms: '145',
                                                holder: 'Thread-42',
                                                status: 'Active',
                                            },
                                            {
                                                lock_id: 'LCK_002',
                                                type: 'Exclusive',
                                                wait_ms: '312',
                                                holder: 'Thread-51',
                                                status: 'Waiting',
                                            },
                                            {
                                                lock_id: 'LCK_003',
                                                type: 'Shared',
                                                wait_ms: '89',
                                                holder: 'Thread-38',
                                                status: 'Active',
                                            },
                                        ]}
                                        accentColor={THEME.warning}
                                    />
                                </Panel>
                            </div>
                        );
                    case 'anomaly':
                        return (
                            <div className="dpg-stagger" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                                <div
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                                        gap: 18,
                                    }}
                                >
                                    <MetricCard
                                        icon={AlertTriangle}
                                        label="Anomalies"
                                        value="8"
                                        color={THEME.danger}
                                        spark={Array.from({ length: 12 }, () => Math.floor(Math.random() * 10))}
                                    />
                                    <MetricCard
                                        icon={Brain}
                                        label="Model Accuracy"
                                        value="97.3%"
                                        color={THEME.success}
                                        trend="+0.5%"
                                        spark={Array.from({ length: 12 }, () => 95 + Math.random() * 5)}
                                    />
                                    <MetricCard
                                        icon={Cpu}
                                        label="Active Models"
                                        value="6"
                                        color={THEME.primary}
                                        spark={Array.from({ length: 12 }, () => 5 + Math.random() * 2)}
                                    />
                                    <MetricCard
                                        icon={Zap}
                                        label="Predictions/hr"
                                        value="18,450"
                                        color={THEME.success}
                                        spark={Array.from({ length: 12 }, () => 17000 + Math.random() * 3000)}
                                    />
                                </div>
                                <Panel title="Anomaly Timeline" icon={TrendingUp} accentColor={THEME.danger}>
                                    <ResponsiveContainer width="100%" height={240}>
                                        <LineChart
                                            data={[
                                                { time: '00:00', high: 0, medium: 1, low: 0 },
                                                { time: '04:00', high: 1, medium: 0, low: 2 },
                                                { time: '08:00', high: 0, medium: 2, low: 1 },
                                                { time: '12:00', high: 2, medium: 1, low: 0 },
                                                { time: '16:00', high: 1, medium: 2, low: 1 },
                                                { time: '20:00', high: 1, medium: 1, low: 3 },
                                            ]}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" stroke={THEME.grid} />
                                            <XAxis dataKey="time" stroke={THEME.textDim} />
                                            <YAxis stroke={THEME.textDim} />
                                            <Tooltip content={<ChartTip />} />
                                            <Legend wrapperStyle={{ color: THEME.textMuted }} />
                                            <Line
                                                type="monotone"
                                                dataKey="high"
                                                stroke={THEME.danger}
                                                strokeWidth={2}
                                                name="High Severity"
                                            />
                                            <Line
                                                type="monotone"
                                                dataKey="medium"
                                                stroke={THEME.warning}
                                                strokeWidth={2}
                                                name="Medium Severity"
                                            />
                                            <Line
                                                type="monotone"
                                                dataKey="low"
                                                stroke={THEME.success}
                                                strokeWidth={2}
                                                name="Low Severity"
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </Panel>
                                <Panel title="Detected Anomalies" icon={AlertTriangle} accentColor={THEME.danger}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                        {demoData.anomalies.map((a, i) => (
                                            <div
                                                key={i}
                                                style={{
                                                    padding: 12,
                                                    background: `${a.severity === 'high' ? THEME.danger : THEME.warning}08`,
                                                    borderLeft: `3px solid ${a.severity === 'high' ? THEME.danger : THEME.warning}`,
                                                    borderRadius: 18,
                                                    fontSize: 11,
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        marginBottom: 4,
                                                    }}
                                                >
                                                    <span style={{ fontWeight: 600 }}>{a.type}</span>
                                                    <span style={{ color: THEME.textDim }}>{a.time}</span>
                                                </div>
                                                <div style={{ color: THEME.textMuted }}>{a.metric}</div>
                                                <div style={{ marginTop: 4, fontSize: 10 }}>
                                                    Current: <span style={{ fontWeight: 600 }}>{a.value}</span> |
                                                    Baseline: <span style={{ fontWeight: 600 }}>{a.baseline}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </Panel>
                            </div>
                        );
                    case 'metricspreview':
                        return (
                            <div className="dpg-stagger" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                                <div
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                                        gap: 18,
                                    }}
                                >
                                    <MetricCard label="Read Ops" value="8.2K/s" sub="+12%" icon={Eye} />
                                    <MetricCard label="Write Ops" value="3.1K/s" sub="+5%" icon={Zap} />
                                    <MetricCard label="Latency P99" value="12ms" sub="-2ms" icon={Gauge} />
                                    <MetricCard label="Cache Hit" value="94.2%" sub="+0.8%" icon={CheckCircle} />
                                </div>
                                <Panel title="Metrics Preview" icon={BarChart3} accentColor={THEME.primary}>
                                    <ResponsiveContainer width="100%" height={220}>
                                        <AreaChart data={demoData.metricsPreview}>
                                            <defs>
                                                <linearGradient
                                                    id="mdb-metricspreview-grad1"
                                                    x1="0"
                                                    y1="0"
                                                    x2="0"
                                                    y2="1"
                                                >
                                                    <stop offset="5%" stopColor={THEME.primary} stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor={THEME.primary} stopOpacity={0} />
                                                </linearGradient>
                                                <linearGradient
                                                    id="mdb-metricspreview-grad2"
                                                    x1="0"
                                                    y1="0"
                                                    x2="0"
                                                    y2="1"
                                                >
                                                    <stop offset="5%" stopColor={THEME.success} stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor={THEME.success} stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke={THEME.grid} />
                                            <XAxis dataKey="time" stroke={THEME.textDim} />
                                            <YAxis stroke={THEME.textDim} />
                                            <Tooltip content={<ChartTip />} />
                                            <Area
                                                type="monotone"
                                                dataKey="opcounters_read"
                                                stroke={THEME.primary}
                                                fill="url(#mdb-metricspreview-grad1)"
                                                stackId="1"
                                            />
                                            <Area
                                                type="monotone"
                                                dataKey="opcounters_write"
                                                stroke={THEME.success}
                                                fill="url(#mdb-metricspreview-grad2)"
                                                stackId="1"
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </Panel>
                                <Panel title="Operation Breakdown" icon={Layers} accentColor={THEME.primary}>
                                    <ResponsiveContainer width="100%" height={220}>
                                        <PieChart>
                                            <Pie
                                                data={[
                                                    { name: 'Insert', value: 25 },
                                                    { name: 'Update', value: 45 },
                                                    { name: 'Delete', value: 15 },
                                                    { name: 'Query', value: 15 },
                                                ]}
                                                cx="50%"
                                                cy="50%"
                                                labelLine={false}
                                                label={(entry) => entry.name}
                                                outerRadius={80}
                                                fill={THEME.primary}
                                                dataKey="value"
                                            >
                                                <Cell fill={THEME.primary} />
                                                <Cell fill={THEME.success} />
                                                <Cell fill={THEME.warning} />
                                                <Cell fill={THEME.danger} />
                                            </Pie>
                                            <Tooltip content={<ChartTip />} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </Panel>
                                <Panel title="Recent Metrics" icon={TrendingUp} accentColor={THEME.primary}>
                                    <DataTable
                                        columns={[
                                            { key: 'metric', label: 'Metric', width: '25%' },
                                            { key: 'current', label: 'Current', width: '25%' },
                                            { key: 'average', label: 'Average', width: '25%' },
                                            { key: 'peak', label: 'Peak', width: '15%' },
                                        ]}
                                        rows={[
                                            {
                                                metric: 'Throughput',
                                                current: '8.2K/s',
                                                average: '7.8K/s',
                                                peak: '12.4K/s',
                                            },
                                            { metric: 'Read Latency', current: '12ms', average: '14ms', peak: '28ms' },
                                            { metric: 'Write Latency', current: '18ms', average: '20ms', peak: '42ms' },
                                            {
                                                metric: 'Memory Usage',
                                                current: '12.4GB',
                                                average: '11.2GB',
                                                peak: '15.8GB',
                                            },
                                        ]}
                                        accentColor={THEME.primary}
                                    />
                                </Panel>
                            </div>
                        );
                    case 'liveagent':
                        return (
                            <Panel title="Live Agent Status" icon={Radio} accentColor={THEME.success}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 22 }}>
                                    <div>
                                        <div
                                            style={{
                                                fontSize: 10,
                                                color: THEME.textDim,
                                                fontWeight: 600,
                                                letterSpacing: '0.02em',
                                                marginBottom: 8,
                                            }}
                                        >
                                            AGENT ID
                                        </div>
                                        <div style={{ fontSize: 13, fontWeight: 600, fontFamily: THEME.fontMono }}>
                                            {demoData.liveAgentStatus.agent_id}
                                        </div>
                                    </div>
                                    <div>
                                        <div
                                            style={{
                                                fontSize: 10,
                                                color: THEME.textDim,
                                                fontWeight: 600,
                                                letterSpacing: '0.02em',
                                                marginBottom: 8,
                                            }}
                                        >
                                            STATUS
                                        </div>
                                        <StatusBadge
                                            label={demoData.liveAgentStatus.status}
                                            color={THEME.success}
                                            pulse
                                        />
                                    </div>
                                    <div>
                                        <div
                                            style={{
                                                fontSize: 10,
                                                color: THEME.textDim,
                                                fontWeight: 600,
                                                letterSpacing: '0.02em',
                                                marginBottom: 8,
                                            }}
                                        >
                                            LAST HEARTBEAT
                                        </div>
                                        <div style={{ fontSize: 13, fontWeight: 600 }}>
                                            {demoData.liveAgentStatus.last_heartbeat}
                                        </div>
                                    </div>
                                    <div>
                                        <div
                                            style={{
                                                fontSize: 10,
                                                color: THEME.textDim,
                                                fontWeight: 600,
                                                letterSpacing: '0.02em',
                                                marginBottom: 8,
                                            }}
                                        >
                                            VERSION
                                        </div>
                                        <div style={{ fontSize: 13, fontWeight: 600 }}>
                                            {demoData.liveAgentStatus.version}
                                        </div>
                                    </div>
                                </div>
                                <div
                                    style={{
                                        marginTop: 16,
                                        padding: 12,
                                        background: THEME.surface,
                                        borderRadius: 20,
                                        borderLeft: `3px solid ${THEME.success}`,
                                    }}
                                >
                                    <div
                                        style={{ fontSize: 10, color: THEME.textDim, fontWeight: 600, marginBottom: 6 }}
                                    >
                                        METRICS COLLECTED
                                    </div>
                                    <div style={{ fontSize: 16, fontWeight: 700, color: THEME.success }}>
                                        {demoData.liveAgentStatus.metrics_collected.toLocaleString()}
                                    </div>
                                </div>
                            </Panel>
                        );
                    default:
                        return null;
                }

            // ═════════════════════════════════════════════════════════════════════════
            // STORAGE SECTION
            // ═════════════════════════════════════════════════════════════════════════
            case 'storage':
                switch (itemKey) {
                    case 'indexadvisor':
                        return (
                            <div className="dpg-stagger" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                                <h1>Index Advisor</h1>
                                <div
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                                        gap: 18,
                                    }}
                                >
                                    <MetricCard
                                        icon={Lightbulb}
                                        label="Recommendations"
                                        value="23"
                                        color={THEME.warning}
                                        spark={Array.from({ length: 12 }, () => 20 + Math.random() * 10)}
                                    />
                                    <MetricCard
                                        icon={AlertTriangle}
                                        label="Missing Indexes"
                                        value="15"
                                        color={THEME.danger}
                                        spark={Array.from({ length: 12 }, () => Math.random() * 20)}
                                    />
                                    <MetricCard
                                        icon={Eye}
                                        label="Unused Indexes"
                                        value="7"
                                        color={THEME.info || THEME.primary}
                                        trend="+0.5%"
                                    />
                                    <MetricCard
                                        icon={Zap}
                                        label="Impact Score"
                                        value="8.4/10"
                                        color={THEME.success}
                                        spark={Array.from({ length: 12 }, () => 5 + Math.random() * 10)}
                                    />
                                </div>

                                <Panel title="Index Usage" icon={BarChart3} accentColor={THEME.warning}>
                                    <ResponsiveContainer width="100%" height={180}>
                                        <BarChart
                                            data={generateChartData(12).map((d) => ({
                                                ...d,
                                                usage: Math.random() * 100,
                                            }))}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" stroke={THEME.grid} />
                                            <XAxis dataKey="time" stroke={THEME.textDim} />
                                            <YAxis stroke={THEME.textDim} />
                                            <Tooltip content={<ChartTip />} />
                                            <Bar dataKey="usage" fill={THEME.warning} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </Panel>

                                <Panel title="Recommendations" icon={Lightbulb} accentColor={THEME.warning}>
                                    <DataTable
                                        columns={[
                                            { key: 'collection', label: 'Collection', mono: true },
                                            { key: 'field', label: 'Field', mono: true },
                                            { key: 'selectivity', label: 'Selectivity', align: 'right' },
                                            { key: 'est_size', label: 'Est. Size', align: 'right', mono: true },
                                            {
                                                key: 'potential_save',
                                                label: 'Potential Save',
                                                align: 'right',
                                                mono: true,
                                            },
                                        ]}
                                        rows={demoData.indexRecommendations}
                                        accentColor={THEME.warning}
                                    />
                                </Panel>
                            </div>
                        );
                    case 'schemaanalyzer':
                        return (
                            <div className="dpg-stagger" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                                <h1>Schema Analysis</h1>
                                <div
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                                        gap: 18,
                                    }}
                                >
                                    <MetricCard
                                        icon={Code}
                                        label="Collections Analyzed"
                                        value="28"
                                        color={THEME.primary}
                                        spark={Array.from({ length: 12 }, () => 25 + Math.random() * 8)}
                                    />
                                    <MetricCard
                                        icon={AlertTriangle}
                                        label="Schema Violations"
                                        value="14"
                                        color={THEME.danger}
                                        spark={Array.from({ length: 12 }, () => Math.random() * 20)}
                                    />
                                    <MetricCard
                                        icon={AlertCircle}
                                        label="Type Mismatches"
                                        value="8"
                                        color={THEME.warning}
                                        trend="-1.3%"
                                    />
                                    <MetricCard
                                        icon={CheckCircle}
                                        label="Coverage"
                                        value="96%"
                                        color={THEME.success}
                                        spark={Array.from({ length: 12 }, () => 92 + Math.random() * 8)}
                                    />
                                </div>

                                <Panel title="Violation Trend" icon={TrendingUp} accentColor={THEME.primary}>
                                    <ResponsiveContainer width="100%" height={180}>
                                        <LineChart
                                            data={generateChartData(24).map((d) => ({
                                                ...d,
                                                violations: Math.random() * 20,
                                            }))}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" stroke={THEME.grid} />
                                            <XAxis dataKey="time" stroke={THEME.textDim} />
                                            <YAxis stroke={THEME.textDim} />
                                            <Tooltip content={<ChartTip />} />
                                            <Line
                                                type="monotone"
                                                dataKey="violations"
                                                stroke={THEME.danger}
                                                strokeWidth={2}
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </Panel>

                                <Panel title="Analysis Data" icon={Code} accentColor={THEME.primary}>
                                    <DataTable
                                        columns={[
                                            { key: 'collection', label: 'Collection', mono: true },
                                            { key: 'field_count', label: 'Fields', align: 'right' },
                                            {
                                                key: 'avg_doc_size',
                                                label: 'Avg Doc Size (KB)',
                                                align: 'right',
                                                mono: true,
                                            },
                                            { key: 'type_consistency', label: 'Type Consistency', align: 'right' },
                                        ]}
                                        rows={demoData.schemaAnalysis}
                                        accentColor={THEME.primary}
                                    />
                                </Panel>
                            </div>
                        );
                    case 'collectionstats':
                        return (
                            <div className="dpg-stagger" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                                <h1>Collection Statistics</h1>
                                <div
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                                        gap: 18,
                                    }}
                                >
                                    <MetricCard
                                        icon={Database}
                                        label="Collections"
                                        value="32"
                                        color={THEME.primary}
                                        spark={Array.from({ length: 12 }, () => 30 + Math.random() * 5)}
                                    />
                                    <MetricCard
                                        icon={HardDrive}
                                        label="Total Size"
                                        value="4.2GB"
                                        color={THEME.success}
                                        spark={Array.from({ length: 12 }, () => 4000 + Math.random() * 500)}
                                    />
                                    <MetricCard
                                        icon={Copy}
                                        label="Avg Doc Size"
                                        value="12.8KB"
                                        color={THEME.warning}
                                        trend="+0.3%"
                                    />
                                    <MetricCard
                                        icon={Layers}
                                        label="Indexes"
                                        value="89"
                                        color={THEME.info || THEME.primary}
                                        spark={Array.from({ length: 12 }, () => 85 + Math.random() * 10)}
                                    />
                                </div>

                                <Panel title="Size Distribution" icon={BarChart3} accentColor={THEME.primary}>
                                    <ResponsiveContainer width="100%" height={180}>
                                        <BarChart
                                            data={generateChartData(12).map((d) => ({
                                                ...d,
                                                size: Math.random() * 500,
                                            }))}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" stroke={THEME.grid} />
                                            <XAxis dataKey="time" stroke={THEME.textDim} />
                                            <YAxis stroke={THEME.textDim} />
                                            <Tooltip content={<ChartTip />} />
                                            <Bar dataKey="size" fill={THEME.success} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </Panel>

                                <Panel title="Collection Stats" icon={Database} accentColor={THEME.primary}>
                                    <DataTable
                                        columns={[
                                            { key: 'name', label: 'Collection', mono: true },
                                            { key: 'docs', label: 'Documents', align: 'right', mono: true },
                                            { key: 'size', label: 'Size', align: 'right', mono: true },
                                            { key: 'indexes', label: 'Indexes', align: 'right' },
                                            { key: 'avgDocSize', label: 'Avg Doc Size', align: 'right', mono: true },
                                        ]}
                                        rows={demoData.collectionStats}
                                        accentColor={THEME.primary}
                                    />
                                </Panel>
                            </div>
                        );
                    case 'wiredtiger':
                        return (
                            <div className="dpg-stagger" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                                <div
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                                        gap: 18,
                                    }}
                                >
                                    <MetricCard
                                        icon={HardDrive}
                                        label="Cache Size"
                                        value="8.0 GB"
                                        color={THEME.primary}
                                        spark={Array.from({ length: 12 }, () => 7800 + Math.random() * 400)}
                                    />
                                    <MetricCard
                                        icon={BarChart3}
                                        label="Cache Used"
                                        value="6.4 GB"
                                        color={THEME.success}
                                        spark={Array.from({ length: 12 }, () => 6000 + Math.random() * 800)}
                                    />
                                    <MetricCard
                                        icon={CheckCircle}
                                        label="Hit Rate"
                                        value="94.2%"
                                        color={THEME.success}
                                        trend="+0.3%"
                                        spark={Array.from({ length: 12 }, () => 90 + Math.random() * 8)}
                                    />
                                    <MetricCard
                                        icon={RefreshCw}
                                        label="Evictions/sec"
                                        value="24"
                                        color={THEME.warning}
                                        spark={Array.from({ length: 12 }, () => 15 + Math.random() * 30)}
                                    />
                                </div>
                                <Panel title="Cache Usage Trend" icon={HardDrive} accentColor={THEME.warning}>
                                    <ResponsiveContainer width="100%" height={280}>
                                        <AreaChart data={demoData.wiredTigerMetrics}>
                                            <defs>
                                                <linearGradient id="mongo-wiredtiger-grad" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor={THEME.danger} stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor={THEME.danger} stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke={THEME.grid} />
                                            <XAxis dataKey="time" stroke={THEME.textDim} />
                                            <YAxis yAxisId="left" stroke={THEME.textDim} />
                                            <YAxis yAxisId="right" orientation="right" stroke={THEME.textDim} />
                                            <Tooltip content={<ChartTip />} />
                                            <Legend wrapperStyle={{ color: THEME.textMuted }} />
                                            <Area
                                                yAxisId="left"
                                                type="monotone"
                                                dataKey="evictions"
                                                stroke={THEME.danger}
                                                fill="url(#mongo-wiredtiger-grad)"
                                                name="Evictions"
                                            />
                                            <Line
                                                yAxisId="right"
                                                type="monotone"
                                                dataKey="cacheFillPct"
                                                stroke={THEME.success}
                                                strokeWidth={2}
                                                name="Fill %"
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </Panel>
                            </div>
                        );
                    case 'backup':
                        return (
                            <div className="dpg-stagger" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                                <div
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                                        gap: 18,
                                    }}
                                >
                                    <MetricCard label="Last Backup" value="2h ago" sub="Success" icon={CheckCircle} />
                                    <MetricCard label="Success Rate" value="99.2%" sub="+0.1%" icon={TrendingUp} />
                                    <MetricCard label="Total Size" value="1.2 TB" sub="20 backups" icon={HardDrive} />
                                    <MetricCard label="Next Scheduled" value="4h" sub="Auto backup" icon={Clock} />
                                </div>
                                <Panel title="Backup Monitor" icon={Archive} accentColor={THEME.success}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                        {demoData.backups.map((b, i) => (
                                            <div
                                                key={i}
                                                style={{
                                                    padding: 12,
                                                    background: THEME.surface,
                                                    border: `1px solid ${THEME.glassBorder}`,
                                                    borderRadius: 18,
                                                    borderLeft: `3px solid ${b.status === 'SUCCESS' ? THEME.success : THEME.danger}`,
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        marginBottom: 6,
                                                    }}
                                                >
                                                    <span style={{ fontWeight: 600 }}>{b.timestamp}</span>
                                                    <StatusBadge
                                                        label={b.status}
                                                        color={b.status === 'SUCCESS' ? THEME.success : THEME.danger}
                                                    />
                                                </div>
                                                <div
                                                    style={{
                                                        display: 'grid',
                                                        gridTemplateColumns: 'repeat(2, 1fr)',
                                                        gap: 18,
                                                        fontSize: 11,
                                                    }}
                                                >
                                                    <div>
                                                        <span style={{ color: THEME.textDim }}>Size</span>
                                                        <div style={{ fontWeight: 600 }}>{b.size}</div>
                                                    </div>
                                                    <div>
                                                        <span style={{ color: THEME.textDim }}>Duration</span>
                                                        <div style={{ fontWeight: 600 }}>{b.duration}</div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </Panel>
                                <Panel title="Backup Size Trend" icon={TrendingUp} accentColor={THEME.success}>
                                    <ResponsiveContainer width="100%" height={220}>
                                        <AreaChart
                                            data={[
                                                { name: 'Backup 1', size: 98 },
                                                { name: 'Backup 2', size: 105 },
                                                { name: 'Backup 3', size: 112 },
                                                { name: 'Backup 4', size: 118 },
                                                { name: 'Backup 5', size: 125 },
                                                { name: 'Backup 6', size: 130 },
                                                { name: 'Backup 7', size: 138 },
                                                { name: 'Backup 8', size: 142 },
                                                { name: 'Backup 9', size: 150 },
                                                { name: 'Backup 10', size: 156 },
                                            ]}
                                        >
                                            <defs>
                                                <linearGradient id="mdb-backup-grad1" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor={THEME.success} stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor={THEME.success} stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke={THEME.grid} />
                                            <XAxis dataKey="name" stroke={THEME.textDim} />
                                            <YAxis stroke={THEME.textDim} />
                                            <Tooltip content={<ChartTip />} />
                                            <Area
                                                type="monotone"
                                                dataKey="size"
                                                stroke={THEME.success}
                                                fill="url(#mdb-backup-grad1)"
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </Panel>
                                <Panel title="Backup Schedule" icon={Clock} accentColor={THEME.success}>
                                    <DataTable
                                        columns={[
                                            { key: 'schedule', label: 'Schedule', width: '20%' },
                                            { key: 'type', label: 'Type', width: '20%' },
                                            { key: 'retention', label: 'Retention', width: '20%' },
                                            { key: 'lastRun', label: 'Last Run', width: '20%' },
                                            { key: 'status', label: 'Status', width: '20%' },
                                        ]}
                                        rows={[
                                            {
                                                schedule: 'Daily @ 02:00',
                                                type: 'Full',
                                                retention: '30 days',
                                                lastRun: '2h ago',
                                                status: 'Success',
                                            },
                                            {
                                                schedule: 'Hourly',
                                                type: 'Incremental',
                                                retention: '7 days',
                                                lastRun: '24m ago',
                                                status: 'Success',
                                            },
                                            {
                                                schedule: 'Weekly',
                                                type: 'Full',
                                                retention: '52 weeks',
                                                lastRun: '6d ago',
                                                status: 'Success',
                                            },
                                        ]}
                                        accentColor={THEME.success}
                                    />
                                </Panel>
                            </div>
                        );
                    case 'capacity':
                        return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                <div
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                                        gap: 18,
                                    }}
                                >
                                    <MetricCard
                                        icon={HardDrive}
                                        label="Current"
                                        value={demoData.capacityPlanning.current_used + ' GB'}
                                        sub={demoData.capacityPlanning.current_usage_pct + '%'}
                                        color={THEME.warning}
                                    />
                                    <MetricCard
                                        icon={TrendingDown}
                                        label="Projected 12m"
                                        value={demoData.capacityPlanning.projected_12m + ' GB'}
                                        sub={demoData.capacityPlanning.projected_usage_12m + '%'}
                                        color={THEME.primary}
                                    />
                                    <MetricCard
                                        icon={Clock}
                                        label="Days to Full"
                                        value={demoData.capacityPlanning.days_until_full + 'd'}
                                        color={THEME.success}
                                        trend={-15}
                                        trendUp={false}
                                    />
                                </div>
                                <Panel title="Capacity Trend" icon={HardDrive} accentColor={THEME.warning}>
                                    <div
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 18,
                                            padding: '16px 0',
                                        }}
                                    >
                                        <RingGauge
                                            value={demoData.capacityPlanning.current_usage_pct}
                                            color={THEME.warning}
                                            label="CURRENT"
                                        />
                                        <div style={{ flex: 1, minHeight: 0 }}>
                                            <div
                                                style={{
                                                    fontSize: 10,
                                                    color: THEME.textDim,
                                                    fontWeight: 600,
                                                    marginBottom: 8,
                                                }}
                                            >
                                                PROJECTION IN 12 MONTHS
                                            </div>
                                            <div
                                                style={{
                                                    fontSize: 18,
                                                    fontWeight: 700,
                                                    color: THEME.primary,
                                                    marginBottom: 6,
                                                }}
                                            >
                                                {demoData.capacityPlanning.projected_12m} GB (
                                                {demoData.capacityPlanning.projected_usage_12m}%)
                                            </div>
                                            <div style={{ fontSize: 11, color: THEME.textMuted }}>
                                                At current growth rate, storage will reach capacity in ~
                                                {demoData.capacityPlanning.days_until_full} days
                                            </div>
                                        </div>
                                    </div>
                                </Panel>
                            </div>
                        );
                    case 'network':
                        return (
                            <div className="dpg-stagger" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                                <div
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                                        gap: 18,
                                    }}
                                >
                                    <MetricCard label="Bytes In" value="2.4 GB/s" sub="+5%" icon={Download} />
                                    <MetricCard label="Bytes Out" value="1.8 GB/s" sub="+3%" icon={Upload} />
                                    <MetricCard label="Connections" value="847" sub="Stable" icon={Users} />
                                    <MetricCard label="Request Rate" value="12.3K/s" sub="+8%" icon={Zap} />
                                </div>
                                <Panel title="Network Metrics" icon={Network} accentColor={THEME.success}>
                                    <ResponsiveContainer width="100%" height={220}>
                                        <AreaChart data={demoData.networkMetrics}>
                                            <defs>
                                                <linearGradient id="mdb-network-grad1" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor={THEME.primary} stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor={THEME.primary} stopOpacity={0} />
                                                </linearGradient>
                                                <linearGradient id="mdb-network-grad2" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor={THEME.success} stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor={THEME.success} stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke={THEME.grid} />
                                            <XAxis dataKey="time" stroke={THEME.textDim} />
                                            <YAxis stroke={THEME.textDim} />
                                            <Tooltip content={<ChartTip />} />
                                            <Area
                                                type="monotone"
                                                dataKey="inbound"
                                                stroke={THEME.primary}
                                                fill="url(#mdb-network-grad1)"
                                                stackId="1"
                                            />
                                            <Area
                                                type="monotone"
                                                dataKey="outbound"
                                                stroke={THEME.success}
                                                fill="url(#mdb-network-grad2)"
                                                stackId="1"
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </Panel>
                                <Panel title="Connection Pool" icon={Layers} accentColor={THEME.success}>
                                    <ResponsiveContainer width="100%" height={220}>
                                        <BarChart
                                            data={[
                                                { app: 'Web API', utilization: 78 },
                                                { app: 'Analytics', utilization: 45 },
                                                { app: 'Cache Layer', utilization: 62 },
                                                { app: 'Background', utilization: 34 },
                                                { app: 'Mobile', utilization: 58 },
                                                { app: 'Third-party', utilization: 22 },
                                            ]}
                                        >
                                            <defs>
                                                <linearGradient id="mdb-network-grad3" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor={THEME.success} stopOpacity={0.8} />
                                                    <stop offset="95%" stopColor={THEME.success} stopOpacity={0.2} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke={THEME.grid} />
                                            <XAxis dataKey="app" stroke={THEME.textDim} />
                                            <YAxis stroke={THEME.textDim} />
                                            <Tooltip content={<ChartTip />} />
                                            <Bar
                                                dataKey="utilization"
                                                fill="url(#mdb-network-grad3)"
                                                radius={[8, 8, 0, 0]}
                                            />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </Panel>
                                <Panel title="Top Clients" icon={Globe} accentColor={THEME.success}>
                                    <DataTable
                                        columns={[
                                            { key: 'clientIp', label: 'Client IP', width: '30%' },
                                            { key: 'connections', label: 'Connections', width: '20%' },
                                            { key: 'bytesIn', label: 'Bytes In', width: '25%' },
                                            { key: 'bytesOut', label: 'Bytes Out', width: '25%' },
                                        ]}
                                        rows={[
                                            {
                                                clientIp: '192.168.1.42',
                                                connections: '156',
                                                bytesIn: '842 MB',
                                                bytesOut: '620 MB',
                                            },
                                            {
                                                clientIp: '10.0.0.8',
                                                connections: '124',
                                                bytesIn: '568 MB',
                                                bytesOut: '420 MB',
                                            },
                                            {
                                                clientIp: '192.168.2.15',
                                                connections: '98',
                                                bytesIn: '445 MB',
                                                bytesOut: '328 MB',
                                            },
                                            {
                                                clientIp: '10.0.0.22',
                                                connections: '84',
                                                bytesIn: '356 MB',
                                                bytesOut: '245 MB',
                                            },
                                        ]}
                                        accentColor={THEME.success}
                                    />
                                </Panel>
                            </div>
                        );
                    default:
                        return null;
                }

            // ═════════════════════════════════════════════════════════════════════════
            // DATA SECTION
            // ═════════════════════════════════════════════════════════════════════════
            case 'data':
                switch (itemKey) {
                    case 'editor':
                        return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                                <div
                                    style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}
                                    className="dpg-stagger"
                                >
                                    <ExecStatCard value="34" label="Collections" subtitle="Available" color={THEME.info} />
                                    <ExecStatCard
                                        value="4.2M"
                                        label="Total docs"
                                        subtitle="In cluster"
                                        color={THEME.success}
                                    />
                                    <ExecStatCard
                                        value="4.2 KB"
                                        label="Avg size"
                                        subtitle="Per document"
                                        color={THEME.primary}
                                    />
                                    <ExecStatCard
                                        value="2m ago"
                                        label="Last edit"
                                        subtitle="Recent change"
                                        color={THEME.warningDark}
                                    />
                                </div>
                                <Panel title="Document Editor" icon={FileCode} accentColor={THEME.primary}>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 22 }}>
                                        <div>
                                            <div
                                                style={{
                                                    fontSize: 10,
                                                    color: THEME.textDim,
                                                    fontWeight: 600,
                                                    letterSpacing: '0.02em',
                                                    marginBottom: 8,
                                                }}
                                            >
                                                COLLECTION
                                            </div>
                                            <div style={{ fontSize: 13, fontWeight: 600, fontFamily: THEME.fontMono }}>
                                                {demoData.documentExample.collection}
                                            </div>
                                        </div>
                                        <div>
                                            <div
                                                style={{
                                                    fontSize: 10,
                                                    color: THEME.textDim,
                                                    fontWeight: 600,
                                                    letterSpacing: '0.02em',
                                                    marginBottom: 8,
                                                }}
                                            >
                                                DOCUMENT ID
                                            </div>
                                            <div
                                                style={{
                                                    fontSize: 11,
                                                    fontWeight: 600,
                                                    fontFamily: THEME.fontMono,
                                                    color: THEME.textMuted,
                                                    wordBreak: 'break-word',
                                                }}
                                            >
                                                {demoData.documentExample._id}
                                            </div>
                                        </div>
                                    </div>
                                    <div
                                        style={{
                                            marginTop: 16,
                                            padding: 12,
                                            background: THEME.surface,
                                            borderRadius: 20,
                                            border: `1px solid ${THEME.glassBorder}`,
                                            fontFamily: THEME.fontMono,
                                            fontSize: 10,
                                            color: THEME.textMuted,
                                            maxHeight: 300,
                                            overflow: 'auto',
                                        }}
                                    >
                                        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                            {JSON.stringify(demoData.documentExample.doc, null, 2)}
                                        </pre>
                                    </div>
                                </Panel>
                            </div>
                        );
                    case 'aggregation':
                        return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                                <div
                                    style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}
                                    className="dpg-stagger"
                                >
                                    <ExecStatCard
                                        value="47"
                                        label="SAVED PIPELINES"
                                        subtitle="Active"
                                        color={THEME.info}
                                    />
                                    <ExecStatCard
                                        value="5.2"
                                        label="AVG STAGES"
                                        subtitle="Per pipeline"
                                        color={THEME.success}
                                    />
                                    <ExecStatCard
                                        value="245ms"
                                        label="AVG EXEC TIME"
                                        subtitle="Last 24h"
                                        color={THEME.warningDark}
                                    />
                                    <ExecStatCard
                                        value="23"
                                        label="COLLECTIONS"
                                        subtitle="With pipelines"
                                        color={THEME.primary}
                                    />
                                </div>
                                <Panel title="Pipeline Stages" icon={Workflow} accentColor={THEME.primary}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                        {demoData.aggregationPipeline.map((stage, i) => (
                                            <div
                                                key={i}
                                                style={{
                                                    padding: 12,
                                                    background: `${THEME.primary}08`,
                                                    borderLeft: `3px solid ${THEME.primary}`,
                                                    borderRadius: 18,
                                                    fontFamily: THEME.fontMono,
                                                    fontSize: 11,
                                                }}
                                            >
                                                <div style={{ fontWeight: 600, marginBottom: 4 }}>
                                                    Stage {i + 1}: {stage.stage}
                                                </div>
                                                <div style={{ color: THEME.textMuted }}>
                                                    {Object.entries(stage)
                                                        .filter(([k]) => k !== 'stage')
                                                        .map(([k, v]) => `${k}: ${v}`)
                                                        .join(' | ')}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </Panel>
                                <Panel title="Saved Pipelines" icon={Code} accentColor={THEME.primary}>
                                    <DataTable
                                        columns={[
                                            { key: 'name', label: 'Pipeline Name', mono: true },
                                            { key: 'stages', label: 'Stages', align: 'center' },
                                            { key: 'collection', label: 'Collection', width: '20%' },
                                            { key: 'exec_time', label: 'Avg Exec (ms)', align: 'right' },
                                            { key: 'runs', label: 'Runs', align: 'right' },
                                        ]}
                                        rows={[
                                            {
                                                name: 'sales_summary',
                                                stages: 4,
                                                collection: 'orders',
                                                exec_time: '124',
                                                runs: '847',
                                            },
                                            {
                                                name: 'user_stats',
                                                stages: 6,
                                                collection: 'users',
                                                exec_time: '312',
                                                runs: '523',
                                            },
                                            {
                                                name: 'inventory_check',
                                                stages: 5,
                                                collection: 'products',
                                                exec_time: '89',
                                                runs: '1204',
                                            },
                                            {
                                                name: 'revenue_by_region',
                                                stages: 7,
                                                collection: 'sales',
                                                exec_time: '456',
                                                runs: '234',
                                            },
                                            {
                                                name: 'active_sessions',
                                                stages: 3,
                                                collection: 'sessions',
                                                exec_time: '45',
                                                runs: '2145',
                                            },
                                        ]}
                                        accentColor={THEME.primary}
                                    />
                                </Panel>
                            </div>
                        );
                    case 'nlquery':
                        return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                                <div
                                    style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}
                                    className="dpg-stagger"
                                >
                                    <ExecStatCard
                                        value="1,240"
                                        label="QUERIES GENERATED"
                                        subtitle="Last 30d"
                                        color={THEME.info}
                                    />
                                    <ExecStatCard
                                        value="94%"
                                        label="ACCURACY"
                                        subtitle="Correct syntax"
                                        color={THEME.success}
                                    />
                                    <ExecStatCard
                                        value="12ms"
                                        label="AVG GENERATION"
                                        subtitle="Response time"
                                        color={THEME.primary}
                                    />
                                    <ExecStatCard value="8" label="COLLECTIONS" subtitle="Supported" color={THEME.warningDark} />
                                </div>
                                <Panel title="Natural Language Query Generator" icon={Brain} accentColor={THEME.ai}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                                        {demoData.naturalLanguageExamples.map((ex, i) => (
                                            <div
                                                key={i}
                                                style={{
                                                    padding: 12,
                                                    background: THEME.surface,
                                                    borderRadius: 20,
                                                    border: `1px solid ${THEME.glassBorder}`,
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        fontSize: 10,
                                                        color: THEME.textDim,
                                                        fontWeight: 600,
                                                        marginBottom: 6,
                                                    }}
                                                >
                                                    NATURAL LANGUAGE INPUT
                                                </div>
                                                <div style={{ fontSize: 12, marginBottom: 10, fontStyle: 'italic' }}>
                                                    {ex.input}
                                                </div>
                                                <div
                                                    style={{
                                                        fontSize: 10,
                                                        color: THEME.textDim,
                                                        fontWeight: 600,
                                                        marginBottom: 6,
                                                    }}
                                                >
                                                    GENERATED MONGO QUERY
                                                </div>
                                                <div
                                                    style={{
                                                        fontSize: 10,
                                                        fontFamily: THEME.fontMono,
                                                        color: THEME.textMuted,
                                                        background: THEME.surface,
                                                        padding: 8,
                                                        borderRadius: 20,
                                                        wordBreak: 'break-word',
                                                    }}
                                                >
                                                    {ex.query}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </Panel>
                            </div>
                        );
                    case 'importexport':
                        return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                                <div
                                    style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}
                                    className="dpg-stagger"
                                >
                                    <ExecStatCard value="2.4 GB" label="IMPORTED" subtitle="Last 7d" color={THEME.success} />
                                    <ExecStatCard value="1.8 GB" label="EXPORTED" subtitle="Last 7d" color={THEME.info} />
                                    <ExecStatCard value="142" label="OPERATIONS" subtitle="Last 7d" color={THEME.primary} />
                                    <ExecStatCard
                                        value="99.8%"
                                        label="SUCCESS RATE"
                                        subtitle="No failures"
                                        color={THEME.success}
                                    />
                                </div>

                                <Panel title="Job History" icon={Download} accentColor={THEME.success}>
                                    <DataTable
                                        columns={[
                                            { key: 'timestamp', label: 'Timestamp', mono: true },
                                            { key: 'operation', label: 'Operation', align: 'center' },
                                            { key: 'records', label: 'Records', align: 'right', mono: true },
                                            { key: 'status', label: 'Status', align: 'center' },
                                            { key: 'duration', label: 'Duration', align: 'right', mono: true },
                                        ]}
                                        rows={demoData.importExportOps}
                                        accentColor={THEME.success}
                                    />
                                </Panel>

                                <Panel title="Throughput" icon={Activity} accentColor={THEME.success}>
                                    <ResponsiveContainer width="100%" height={180}>
                                        <AreaChart
                                            data={generateChartData(24).map((d) => ({
                                                ...d,
                                                throughput: Math.random() * 2000,
                                            }))}
                                        >
                                            <defs>
                                                <linearGradient id="mongo-importexport" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor={THEME.success} stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor={THEME.success} stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke={THEME.grid} />
                                            <XAxis dataKey="time" stroke={THEME.textDim} />
                                            <YAxis stroke={THEME.textDim} />
                                            <Tooltip content={<ChartTip />} />
                                            <Area
                                                type="monotone"
                                                dataKey="throughput"
                                                stroke={THEME.success}
                                                fill="url(#mongo-importexport)"
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </Panel>
                            </div>
                        );
                    case 'sqltranslator':
                        return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                                <div
                                    style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}
                                    className="dpg-stagger"
                                >
                                    <ExecStatCard
                                        value="840"
                                        label="TRANSLATIONS"
                                        subtitle="Last 30d"
                                        color={THEME.info}
                                    />
                                    <ExecStatCard value="96%" label="ACCURACY" subtitle="Verified" color={THEME.success} />
                                    <ExecStatCard
                                        value="8ms"
                                        label="AVG SPEED"
                                        subtitle="Translation time"
                                        color={THEME.primary}
                                    />
                                    <ExecStatCard
                                        value="12"
                                        label="SQL DIALECTS"
                                        subtitle="Supported"
                                        color={THEME.warningDark}
                                    />
                                </div>
                                <Panel
                                    title="SQL to MongoDB Translator"
                                    icon={Code}
                                    accentColor={THEME.info || THEME.primary}
                                >
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                                        {demoData.sqlToMongoExamples.map((ex, i) => (
                                            <div
                                                key={i}
                                                style={{
                                                    padding: 12,
                                                    background: THEME.surface,
                                                    borderRadius: 20,
                                                    border: `1px solid ${THEME.glassBorder}`,
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        fontSize: 10,
                                                        color: THEME.textDim,
                                                        fontWeight: 600,
                                                        marginBottom: 6,
                                                    }}
                                                >
                                                    SQL QUERY
                                                </div>
                                                <div
                                                    style={{
                                                        fontSize: 10,
                                                        fontFamily: THEME.fontMono,
                                                        color: THEME.textMuted,
                                                        background: THEME.surface,
                                                        padding: 8,
                                                        borderRadius: 20,
                                                        marginBottom: 10,
                                                        wordBreak: 'break-word',
                                                    }}
                                                >
                                                    {ex.sql}
                                                </div>
                                                <div
                                                    style={{
                                                        fontSize: 10,
                                                        color: THEME.textDim,
                                                        fontWeight: 600,
                                                        marginBottom: 6,
                                                    }}
                                                >
                                                    MONGODB QUERY
                                                </div>
                                                <div
                                                    style={{
                                                        fontSize: 10,
                                                        fontFamily: THEME.fontMono,
                                                        color: THEME.success,
                                                        background: THEME.surface,
                                                        padding: 8,
                                                        borderRadius: 20,
                                                        wordBreak: 'break-word',
                                                    }}
                                                >
                                                    {ex.mongo}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </Panel>
                            </div>
                        );
                    case 'schemacompare':
                        return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                                <div
                                    style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}
                                    className="dpg-stagger"
                                >
                                    <ExecStatCard
                                        value="24"
                                        label="FIELDS COMPARED"
                                        subtitle="Across collections"
                                        color={THEME.info}
                                    />
                                    <ExecStatCard
                                        value="18"
                                        label="MATCHES"
                                        subtitle="Identical fields"
                                        color={THEME.success}
                                    />
                                    <ExecStatCard
                                        value="4"
                                        label="DIFFERENCES"
                                        subtitle="Type mismatches"
                                        color={THEME.warningDark}
                                    />
                                    <ExecStatCard value="2" label="MISSING" subtitle="Not in target" color={THEME.dangerDark} />
                                </div>
                                <Panel title="Schema Comparison Details" icon={Compass} accentColor={THEME.primary}>
                                    <DataTable
                                        columns={[
                                            { key: 'collection', label: 'Collection', mono: true },
                                            { key: 'prod', label: 'Production', align: 'center' },
                                            { key: 'staging', label: 'Staging', align: 'center' },
                                            { key: 'diff_type', label: 'Difference Type', width: '20%' },
                                            { key: 'severity', label: 'Severity' },
                                        ]}
                                        rows={[
                                            {
                                                collection: 'users',
                                                prod: '45F / 2.3M',
                                                staging: '44F / 2.3M',
                                                diff_type: 'Field Missing',
                                                severity: 'Medium',
                                            },
                                            {
                                                collection: 'orders',
                                                prod: '38F / 8.1M',
                                                staging: '38F / 8.1M',
                                                diff_type: 'Type Mismatch',
                                                severity: 'High',
                                            },
                                            {
                                                collection: 'products',
                                                prod: '62F / 1.4M',
                                                staging: '63F / 1.4M',
                                                diff_type: 'New Field',
                                                severity: 'Low',
                                            },
                                            {
                                                collection: 'reviews',
                                                prod: '28F / 5.2M',
                                                staging: '26F / 5.2M',
                                                diff_type: 'Field Missing',
                                                severity: 'Medium',
                                            },
                                            {
                                                collection: 'inventory',
                                                prod: '51F / 3.8M',
                                                staging: '51F / 3.8M',
                                                diff_type: 'Index Missing',
                                                severity: 'High',
                                            },
                                        ]}
                                        accentColor={THEME.primary}
                                    />
                                </Panel>
                            </div>
                        );
                    case 'geospatial':
                        return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                                <div
                                    style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}
                                    className="dpg-stagger"
                                >
                                    <ExecStatCard value="3" label="GEO INDEXES" subtitle="2dsphere" color={THEME.info} />
                                    <ExecStatCard
                                        value="1,240"
                                        label="GEO QUERIES/HR"
                                        subtitle="+8% trend"
                                        color={THEME.success}
                                    />
                                    <ExecStatCard
                                        value="2.4 km"
                                        label="AVG DISTANCE"
                                        subtitle="Avg search radius"
                                        color={THEME.primary}
                                    />
                                    <ExecStatCard
                                        value="89%"
                                        label="COVERAGE"
                                        subtitle="Indexed area"
                                        color={THEME.warningDark}
                                    />
                                </div>

                                <Panel title="Query Distribution" icon={BarChart3} accentColor={THEME.success}>
                                    <ResponsiveContainer width="100%" height={180}>
                                        <BarChart
                                            data={generateChartData(12).map((d) => ({
                                                ...d,
                                                queries: Math.random() * 200,
                                            }))}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" stroke={THEME.grid} />
                                            <XAxis dataKey="time" stroke={THEME.textDim} />
                                            <YAxis stroke={THEME.textDim} />
                                            <Tooltip content={<ChartTip />} />
                                            <Bar dataKey="queries" fill={THEME.success} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </Panel>

                                <Panel title="Geo Index Data" icon={Map} accentColor={THEME.success}>
                                    <DataTable
                                        columns={[
                                            { key: 'location', label: 'Location', width: '30%' },
                                            { key: 'documents', label: 'Documents', align: 'right', mono: true },
                                            { key: 'avg_lat', label: 'Avg Latitude', align: 'right', mono: true },
                                            { key: 'avg_lng', label: 'Avg Longitude', align: 'right', mono: true },
                                        ]}
                                        rows={demoData.geoMetrics}
                                        accentColor={THEME.success}
                                    />
                                </Panel>
                            </div>
                        );
                    default:
                        return null;
                }

            // ═════════════════════════════════════════════════════════════════════════
            // INTELLIGENCE SECTION
            // ═════════════════════════════════════════════════════════════════════════
            case 'intelligence':
                switch (itemKey) {
                    case 'aihints':
                        return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                                <div
                                    style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}
                                    className="dpg-stagger"
                                >
                                    <ExecStatCard value="12" label="ACTIVE HINTS" subtitle="+3 new" color={THEME.info} />
                                    <ExecStatCard value="8" label="APPLIED" subtitle="This week" color={THEME.success} />
                                    <ExecStatCard value="2" label="DISMISSED" subtitle="Low priority" color={THEME.warningDark} />
                                    <ExecStatCard
                                        value="+24%"
                                        label="IMPACT"
                                        subtitle="Performance gain"
                                        color={THEME.success}
                                    />
                                </div>
                                <Panel title="AI Hints & Recommendations" icon={Brain} accentColor={THEME.ai}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                        {demoData.aiHints.map((h, i) => (
                                            <div
                                                key={i}
                                                style={{
                                                    padding: 12,
                                                    background: `${THEME.ai}08`,
                                                    borderLeft: `3px solid ${THEME.ai}`,
                                                    borderRadius: 18,
                                                    fontSize: 11,
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        marginBottom: 6,
                                                    }}
                                                >
                                                    <span style={{ fontWeight: 600, color: THEME.ai }}>
                                                        ID: {h.hint_id}
                                                    </span>
                                                    <span style={{ color: THEME.textDim }}>
                                                        Confidence: {(h.confidence * 100).toFixed(0)}%
                                                    </span>
                                                </div>
                                                <div style={{ marginBottom: 4 }}>
                                                    <StatusBadge label={h.category} color={THEME.ai} />
                                                </div>
                                                <div style={{ color: THEME.textMuted }}>{h.message}</div>
                                            </div>
                                        ))}
                                    </div>
                                </Panel>
                                <Panel title="Hint Effectiveness" icon={TrendingUp} accentColor={THEME.ai}>
                                    <ResponsiveContainer width="100%" height={220}>
                                        <AreaChart
                                            data={[
                                                { time: '00:00', applied: 2, improvement: 12 },
                                                { time: '02:00', applied: 3, improvement: 15 },
                                                { time: '04:00', applied: 5, improvement: 22 },
                                                { time: '06:00', applied: 7, improvement: 28 },
                                                { time: '08:00', applied: 8, improvement: 35 },
                                                { time: '10:00', applied: 10, improvement: 42 },
                                                { time: '12:00', applied: 12, improvement: 48 },
                                                { time: '14:00', applied: 15, improvement: 56 },
                                                { time: '16:00', applied: 18, improvement: 62 },
                                                { time: '18:00', applied: 22, improvement: 68 },
                                                { time: '20:00', applied: 28, improvement: 74 },
                                                { time: '22:00', applied: 34, improvement: 82 },
                                            ]}
                                        >
                                            <defs>
                                                <linearGradient id="mdb-aihints-grad1" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor={THEME.ai} stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor={THEME.ai} stopOpacity={0} />
                                                </linearGradient>
                                                <linearGradient id="mdb-aihints-grad2" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor={THEME.success} stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor={THEME.success} stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke={THEME.grid} />
                                            <XAxis dataKey="time" stroke={THEME.textDim} />
                                            <YAxis stroke={THEME.textDim} />
                                            <Tooltip content={<ChartTip />} />
                                            <Area
                                                type="monotone"
                                                dataKey="applied"
                                                stroke={THEME.ai}
                                                fill="url(#mdb-aihints-grad1)"
                                                stackId="1"
                                            />
                                            <Area
                                                type="monotone"
                                                dataKey="improvement"
                                                stroke={THEME.success}
                                                fill="url(#mdb-aihints-grad2)"
                                                stackId="1"
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </Panel>
                                <Panel title="Hint Categories" icon={Layers} accentColor={THEME.ai}>
                                    <DataTable
                                        columns={[
                                            { key: 'category', label: 'Category', width: '30%' },
                                            { key: 'count', label: 'Count', width: '20%' },
                                            { key: 'avgConfidence', label: 'Avg Confidence', width: '25%' },
                                            { key: 'status', label: 'Status', width: '25%' },
                                        ]}
                                        rows={[
                                            {
                                                category: 'Index Optimization',
                                                count: '8',
                                                avgConfidence: '92%',
                                                status: 'Active',
                                            },
                                            {
                                                category: 'Query Planning',
                                                count: '6',
                                                avgConfidence: '88%',
                                                status: 'Active',
                                            },
                                            {
                                                category: 'Memory Usage',
                                                count: '4',
                                                avgConfidence: '81%',
                                                status: 'Pending',
                                            },
                                            {
                                                category: 'Replication',
                                                count: '2',
                                                avgConfidence: '79%',
                                                status: 'Applied',
                                            },
                                        ]}
                                        accentColor={THEME.ai}
                                    />
                                </Panel>
                            </div>
                        );
                    case 'clustercompare':
                        return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                                <h1>Cluster Comparison</h1>
                                <div
                                    style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}
                                    className="dpg-stagger"
                                >
                                    <ExecStatCard value="3" label="CLUSTERS" subtitle="Monitored" color={THEME.info} />
                                    <ExecStatCard
                                        value="99.2%"
                                        label="SIMILARITY"
                                        subtitle="Config match"
                                        color={THEME.success}
                                    />
                                    <ExecStatCard value="2" label="DIFFERENCES" subtitle="Found" color={THEME.warningDark} />
                                    <ExecStatCard value="0" label="CRITICAL" subtitle="Issues" color={THEME.success} />
                                </div>

                                <Panel title="Comparison Data" icon={GitBranch} accentColor={THEME.primary}>
                                    <DataTable
                                        columns={[
                                            { key: 'metric', label: 'Metric', width: '40%' },
                                            { key: 'prod', label: 'Production', align: 'right', mono: true },
                                            { key: 'staging', label: 'Staging', align: 'right', mono: true },
                                            { key: 'diff_pct', label: 'Difference', align: 'right', mono: true },
                                        ]}
                                        rows={demoData.clusterComparison}
                                        accentColor={THEME.primary}
                                    />
                                </Panel>

                                <Panel title="Drift Timeline" icon={TrendingUp} accentColor={THEME.primary}>
                                    <ResponsiveContainer width="100%" height={180}>
                                        <LineChart
                                            data={generateChartData(24).map((d) => ({
                                                ...d,
                                                drift: Math.random() * 5,
                                            }))}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" stroke={THEME.grid} />
                                            <XAxis dataKey="time" stroke={THEME.textDim} />
                                            <YAxis stroke={THEME.textDim} />
                                            <Tooltip content={<ChartTip />} />
                                            <Line
                                                type="monotone"
                                                dataKey="drift"
                                                stroke={THEME.warning}
                                                strokeWidth={2}
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </Panel>
                            </div>
                        );
                    case 'historicaltrends':
                        return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                                <div
                                    style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}
                                    className="dpg-stagger"
                                >
                                    <ExecStatCard
                                        value="2.4M"
                                        label="DATA POINTS"
                                        subtitle="Collected"
                                        color={THEME.info}
                                    />
                                    <ExecStatCard
                                        value="90d"
                                        label="TIME RANGE"
                                        subtitle="Historical"
                                        color={THEME.primary}
                                    />
                                    <ExecStatCard value="7" label="ANOMALIES" subtitle="Detected" color={THEME.dangerDark} />
                                    <ExecStatCard
                                        value="+12%/mo"
                                        label="GROWTH RATE"
                                        subtitle="Trending up"
                                        color={THEME.warningDark}
                                    />
                                </div>
                                <Panel title="30-Day Trends" icon={TrendingUp} accentColor={THEME.success}>
                                    <ResponsiveContainer width="100%" height={280}>
                                        <AreaChart data={demoData.historicalTrends}>
                                            <defs>
                                                <linearGradient
                                                    id="mongo-historical-latency"
                                                    x1="0"
                                                    y1="0"
                                                    x2="0"
                                                    y2="1"
                                                >
                                                    <stop offset="5%" stopColor={THEME.warning} stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor={THEME.warning} stopOpacity={0} />
                                                </linearGradient>
                                                <linearGradient
                                                    id="mongo-historical-throughput"
                                                    x1="0"
                                                    y1="0"
                                                    x2="0"
                                                    y2="1"
                                                >
                                                    <stop offset="5%" stopColor={THEME.success} stopOpacity={0.2} />
                                                    <stop offset="95%" stopColor={THEME.success} stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke={THEME.grid} />
                                            <XAxis dataKey="time" stroke={THEME.textDim} />
                                            <YAxis yAxisId="left" stroke={THEME.textDim} />
                                            <YAxis yAxisId="right" orientation="right" stroke={THEME.textDim} />
                                            <Tooltip content={<ChartTip />} />
                                            <Legend wrapperStyle={{ color: THEME.textMuted }} />
                                            <Area
                                                yAxisId="left"
                                                type="monotone"
                                                dataKey="avg_latency"
                                                stroke={THEME.warning}
                                                fill="url(#mongo-historical-latency)"
                                                name="Avg Latency (ms)"
                                            />
                                            <Line
                                                yAxisId="right"
                                                type="monotone"
                                                dataKey="throughput"
                                                stroke={THEME.success}
                                                strokeWidth={2}
                                                name="Throughput (ops/s)"
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </Panel>
                            </div>
                        );
                    case 'perfadvisor':
                        return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                                <div
                                    style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}
                                    className="dpg-stagger"
                                >
                                    <ExecStatCard value="8" label="RECOMMENDATIONS" subtitle="Active" color={THEME.info} />
                                    <ExecStatCard value="2" label="CRITICAL" subtitle="Urgent" color={THEME.dangerDark} />
                                    <ExecStatCard
                                        value="+34%"
                                        label="EST. IMPROVEMENT"
                                        subtitle="If applied"
                                        color={THEME.success}
                                    />
                                    <ExecStatCard value="5" label="APPLIED" subtitle="This month" color={THEME.primary} />
                                </div>
                                <Panel title="Performance Advisor v2" icon={Lightbulb} accentColor={THEME.warning}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                        {demoData.perfAdvisor.map((rec, i) => (
                                            <div
                                                key={i}
                                                style={{
                                                    padding: 12,
                                                    background: THEME.surface,
                                                    borderRadius: 18,
                                                    border: `1px solid ${THEME.glassBorder}`,
                                                    borderLeft: `3px solid ${i === 0 ? THEME.danger : i === 1 ? THEME.warning : THEME.info || THEME.primary}`,
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        marginBottom: 6,
                                                    }}
                                                >
                                                    <div style={{ fontWeight: 600 }}>
                                                        Priority {rec.priority}: {rec.recommendation}
                                                    </div>
                                                    <span
                                                        style={{
                                                            fontSize: 10,
                                                            color: THEME.textDim,
                                                            whiteSpace: 'nowrap',
                                                            marginLeft: 8,
                                                        }}
                                                    >
                                                        {rec.effort}
                                                    </span>
                                                </div>
                                                <div style={{ fontSize: 11, color: THEME.textMuted }}>{rec.impact}</div>
                                            </div>
                                        ))}
                                    </div>
                                </Panel>
                                <Panel title="Performance Score Trend" icon={TrendingUp} accentColor={THEME.warning}>
                                    <ResponsiveContainer width="100%" height={220}>
                                        <LineChart
                                            data={[
                                                { day: 'Mon', score: 68 },
                                                { day: 'Tue', score: 70 },
                                                { day: 'Wed', score: 72 },
                                                { day: 'Thu', score: 73 },
                                                { day: 'Fri', score: 75 },
                                                { day: 'Sat', score: 76 },
                                                { day: 'Sun', score: 76 },
                                            ]}
                                        >
                                            <defs>
                                                <linearGradient id="mdb-perfadvisor-grad1" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor={THEME.warning} stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor={THEME.warning} stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke={THEME.grid} />
                                            <XAxis dataKey="day" stroke={THEME.textDim} />
                                            <YAxis stroke={THEME.textDim} domain={[60, 100]} />
                                            <Tooltip content={<ChartTip />} />
                                            <Line
                                                type="monotone"
                                                dataKey="score"
                                                stroke={THEME.warning}
                                                dot={true}
                                                strokeWidth={2}
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </Panel>
                                <Panel title="Recommendation History" icon={Workflow} accentColor={THEME.warning}>
                                    <DataTable
                                        columns={[
                                            { key: 'date', label: 'Date', width: '20%' },
                                            { key: 'action', label: 'Action', width: '35%' },
                                            { key: 'impact', label: 'Impact', width: '25%' },
                                            { key: 'status', label: 'Status', width: '20%' },
                                        ]}
                                        rows={[
                                            {
                                                date: 'Mar 24',
                                                action: 'Add composite index on orders',
                                                impact: '+12 points',
                                                status: 'Applied',
                                            },
                                            {
                                                date: 'Mar 22',
                                                action: 'Optimize write concern config',
                                                impact: '+8 points',
                                                status: 'Applied',
                                            },
                                            {
                                                date: 'Mar 20',
                                                action: 'Enable document validation',
                                                impact: '+6 points',
                                                status: 'Pending',
                                            },
                                            {
                                                date: 'Mar 18',
                                                action: 'Increase journal cache size',
                                                impact: '+5 points',
                                                status: 'Applied',
                                            },
                                        ]}
                                        accentColor={THEME.warning}
                                    />
                                </Panel>
                            </div>
                        );
                    case 'tracecorrelator':
                        return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                                <div
                                    style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}
                                    className="dpg-stagger"
                                >
                                    <ExecStatCard value="24" label="ACTIVE TRACES" subtitle="Running" color={THEME.info} />
                                    <ExecStatCard value="84ms" label="AVG DURATION" subtitle="P50" color={THEME.success} />
                                    <ExecStatCard value="2.1%" label="ERROR RATE" subtitle="Last 24h" color={THEME.dangerDark} />
                                    <ExecStatCard
                                        value="1,240/s"
                                        label="THROUGHPUT"
                                        subtitle="Current"
                                        color={THEME.primary}
                                    />
                                </div>
                                <Panel title="Trace Correlator" icon={Radio} accentColor={THEME.primary}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                        {demoData.traceCorrelations.map((trace, i) => (
                                            <div
                                                key={i}
                                                style={{
                                                    padding: 12,
                                                    background: THEME.surface,
                                                    borderRadius: 18,
                                                    border: `1px solid ${THEME.glassBorder}`,
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        marginBottom: 8,
                                                    }}
                                                >
                                                    <span style={{ fontWeight: 600, fontFamily: THEME.fontMono }}>
                                                        {trace.trace_id}
                                                    </span>
                                                    <span style={{ color: THEME.textMuted }}>{trace.duration}ms</span>
                                                </div>
                                                <div style={{ fontSize: 11, marginBottom: 6 }}>
                                                    Operation: {trace.operation}
                                                </div>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                                    {trace.stages.map((s, si) => (
                                                        <div
                                                            key={si}
                                                            style={{
                                                                fontSize: 9,
                                                                padding: '3px 8px',
                                                                background:
                                                                    s === trace.bottleneck
                                                                        ? `${THEME.danger}20`
                                                                        : `${THEME.primary}15`,
                                                                borderRadius: 20,
                                                                color:
                                                                    s === trace.bottleneck
                                                                        ? THEME.danger
                                                                        : THEME.primary,
                                                                fontWeight: s === trace.bottleneck ? 600 : 500,
                                                            }}
                                                        >
                                                            {s}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </Panel>
                            </div>
                        );
                    default:
                        return null;
                }

            // ═════════════════════════════════════════════════════════════════════════
            // REPLICATION SECTION
            // ═════════════════════════════════════════════════════════════════════════
            case 'replication':
                switch (itemKey) {
                    case 'replicaset':
                        return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                                <div
                                    style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}
                                    className="dpg-stagger"
                                >
                                    <ExecStatCard
                                        value="0.8s"
                                        label="REPLICATION LAG"
                                        subtitle="Below threshold"
                                        color={THEME.success}
                                    />
                                    <ExecStatCard
                                        value="48h"
                                        label="OPLOG WINDOW"
                                        subtitle="Sufficient"
                                        color={THEME.info}
                                    />
                                    <ExecStatCard
                                        value="0"
                                        label="ELECTIONS (7D)"
                                        subtitle="Stable topology"
                                        color={THEME.success}
                                    />
                                    <ExecStatCard
                                        value="Yes"
                                        label="FAILOVER READY"
                                        subtitle="2 eligible"
                                        color={THEME.success}
                                    />
                                </div>
                                <Panel title="Replica Set & Failover" icon={GitBranch} accentColor={THEME.success}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                        {demoData.replicas.map((replica, i) => (
                                            <div
                                                key={i}
                                                style={{
                                                    padding: 12,
                                                    background: THEME.surface,
                                                    borderRadius: 18,
                                                    border: `1px solid ${THEME.glassBorder}`,
                                                    borderLeft: `3px solid ${replica.role === 'PRIMARY' ? THEME.success : THEME.info || THEME.primary}`,
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        marginBottom: 8,
                                                    }}
                                                >
                                                    <div style={{ fontWeight: 600, fontFamily: THEME.fontMono }}>
                                                        {replica.id}
                                                    </div>
                                                    <StatusBadge
                                                        label={replica.role}
                                                        color={
                                                            replica.role === 'PRIMARY'
                                                                ? THEME.success
                                                                : THEME.info || THEME.primary
                                                        }
                                                    />
                                                </div>
                                                <div
                                                    style={{
                                                        display: 'grid',
                                                        gridTemplateColumns: 'repeat(4, 1fr)',
                                                        gap: 20,
                                                        fontSize: 10,
                                                    }}
                                                >
                                                    <div>
                                                        <span style={{ color: THEME.textDim }}>Sync Lag</span>
                                                        <div style={{ fontWeight: 600 }}>{replica.syncLag}</div>
                                                    </div>
                                                    <div>
                                                        <span style={{ color: THEME.textDim }}>Health</span>
                                                        <div style={{ fontWeight: 600 }}>
                                                            {(replica.health * 100).toFixed(0)}%
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <span style={{ color: THEME.textDim }}>Uptime</span>
                                                        <div style={{ fontWeight: 600 }}>{replica.uptime}</div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </Panel>
                            </div>
                        );
                    case 'sharding':
                        return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                                <div
                                    style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}
                                    className="dpg-stagger"
                                >
                                    <ExecStatCard value="3" label="SHARDS" subtitle="Active" color={THEME.info} />
                                    <ExecStatCard value="284" label="CHUNKS" subtitle="Distributed" color={THEME.success} />
                                    <ExecStatCard value="Active" label="BALANCER" subtitle="Running" color={THEME.success} />
                                    <ExecStatCard value="12" label="MIGRATIONS" subtitle="Last 24h" color={THEME.warningDark} />
                                </div>
                                <Panel title="Chunk Distribution" icon={BarChart3} accentColor={THEME.primary}>
                                    <ResponsiveContainer width="100%" height={260}>
                                        <BarChart
                                            data={[
                                                { shard: 'Shard 1', chunks: 215, balance: 0 },
                                                { shard: 'Shard 2', chunks: 218, balance: 1 },
                                                { shard: 'Shard 3', chunks: 210, balance: -2 },
                                                { shard: 'Shard 4', chunks: 220, balance: 3 },
                                                { shard: 'Shard 5', chunks: 212, balance: -1 },
                                                { shard: 'Shard 6', chunks: 209, balance: -1 },
                                            ]}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" stroke={THEME.grid} />
                                            <XAxis dataKey="shard" stroke={THEME.textDim} />
                                            <YAxis stroke={THEME.textDim} />
                                            <Tooltip content={<ChartTip />} />
                                            <Bar dataKey="chunks" fill={THEME.primary} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </Panel>
                                <Panel title="Shard Details" icon={Layers} accentColor={THEME.primary}>
                                    <DataTable
                                        columns={[
                                            { key: 'id', label: 'Shard ID', mono: true },
                                            { key: 'docs', label: 'Documents', align: 'right', mono: true },
                                            { key: 'size', label: 'Size', align: 'right', mono: true },
                                            { key: 'chunks', label: 'Chunks', align: 'right' },
                                            { key: 'health', label: 'Health', align: 'right' },
                                        ]}
                                        rows={demoData.shards.map((s) => ({
                                            ...s,
                                            health: (s.health * 100).toFixed(0) + '%',
                                        }))}
                                        accentColor={THEME.primary}
                                    />
                                </Panel>
                            </div>
                        );
                    case 'oplog':
                        return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                                <div
                                    style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}
                                    className="dpg-stagger"
                                >
                                    <ExecStatCard
                                        value="2.4 GB"
                                        label="OPLOG SIZE"
                                        subtitle="Configured"
                                        color={THEME.info}
                                    />
                                    <ExecStatCard value="48h" label="WINDOW" subtitle="Retention" color={THEME.success} />
                                    <ExecStatCard
                                        value="1,240/s"
                                        label="ENTRIES/SEC"
                                        subtitle="Current"
                                        color={THEME.primary}
                                    />
                                    <ExecStatCard
                                        value="47h ago"
                                        label="OLDEST ENTRY"
                                        subtitle="Within window"
                                        color={THEME.warningDark}
                                    />
                                </div>
                                <Panel title="Oplog Tail" icon={Activity} accentColor={THEME.success}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                        {demoData.oplogEvents.map((event, i) => (
                                            <div
                                                key={i}
                                                style={{
                                                    padding: 10,
                                                    background: `${THEME.success}08`,
                                                    borderLeft: `3px solid ${THEME.success}`,
                                                    borderRadius: 18,
                                                    fontSize: 11,
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        marginBottom: 4,
                                                    }}
                                                >
                                                    <span style={{ fontWeight: 600, fontFamily: THEME.fontMono }}>
                                                        {event.timestamp}
                                                    </span>
                                                    <span style={{ color: THEME.textDim }}>{event.duration}ms</span>
                                                </div>
                                                <div style={{ display: 'flex', gap: 22, fontSize: 10 }}>
                                                    <span>
                                                        Op: <span style={{ fontWeight: 600 }}>{event.operation}</span>
                                                    </span>
                                                    <span>
                                                        Namespace:{' '}
                                                        <span style={{ fontWeight: 600, fontFamily: THEME.fontMono }}>
                                                            {event.ns}
                                                        </span>
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </Panel>
                                <Panel title="Oplog Growth" icon={TrendingUp} accentColor={THEME.success}>
                                    <ResponsiveContainer width="100%" height={220}>
                                        <AreaChart
                                            data={[
                                                { hour: '00:00', size: 35.2 },
                                                { hour: '02:00', size: 36.8 },
                                                { hour: '04:00', size: 38.1 },
                                                { hour: '06:00', size: 39.6 },
                                                { hour: '08:00', size: 41.2 },
                                                { hour: '10:00', size: 42.8 },
                                                { hour: '12:00', size: 44.1 },
                                                { hour: '14:00', size: 45.4 },
                                                { hour: '16:00', size: 46.2 },
                                                { hour: '18:00', size: 47.1 },
                                                { hour: '20:00', size: 47.8 },
                                                { hour: '22:00', size: 48.2 },
                                            ]}
                                        >
                                            <defs>
                                                <linearGradient id="mdb-oplog-grad1" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor={THEME.success} stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor={THEME.success} stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke={THEME.grid} />
                                            <XAxis dataKey="hour" stroke={THEME.textDim} />
                                            <YAxis stroke={THEME.textDim} />
                                            <Tooltip content={<ChartTip />} />
                                            <Area
                                                type="monotone"
                                                dataKey="size"
                                                stroke={THEME.success}
                                                fill="url(#mdb-oplog-grad1)"
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </Panel>
                                <Panel title="Operations Summary" icon={Database} accentColor={THEME.success}>
                                    <DataTable
                                        columns={[
                                            { key: 'operation', label: 'Operation', width: '25%' },
                                            { key: 'countPerHr', label: 'Count/hr', width: '25%' },
                                            { key: 'avgSize', label: 'Avg Size', width: '25%' },
                                            { key: 'namespace', label: 'Namespace', width: '25%' },
                                        ]}
                                        rows={[
                                            {
                                                operation: 'insert',
                                                countPerHr: '4200',
                                                avgSize: '2.1 KB',
                                                namespace: 'production.*',
                                            },
                                            {
                                                operation: 'update',
                                                countPerHr: '2840',
                                                avgSize: '1.8 KB',
                                                namespace: 'production.*',
                                            },
                                            {
                                                operation: 'delete',
                                                countPerHr: '420',
                                                avgSize: '0.5 KB',
                                                namespace: 'production.*',
                                            },
                                            {
                                                operation: 'command',
                                                countPerHr: '180',
                                                avgSize: '0.3 KB',
                                                namespace: 'admin.*',
                                            },
                                        ]}
                                        accentColor={THEME.success}
                                    />
                                </Panel>
                            </div>
                        );
                    default:
                        return null;
                }

            // ═════════════════════════════════════════════════════════════════════════
            // MANAGEMENT SECTION
            // ═════════════════════════════════════════════════════════════════════════
            case 'management':
                switch (itemKey) {
                    case 'alerts':
                        return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                                <div
                                    style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}
                                    className="dpg-stagger"
                                >
                                    <ExecStatCard
                                        value="12"
                                        label="ACTIVE RULES"
                                        subtitle="Configured"
                                        color={THEME.success}
                                    />
                                    <ExecStatCard value="7" label="ALERTS FIRED" subtitle="Last 24h" color={THEME.dangerDark} />
                                    <ExecStatCard value="3" label="CHANNELS" subtitle="Connected" color={THEME.info} />
                                    <ExecStatCard value="12" label="SUPPRESSED" subtitle="Last 24h" color={THEME.warningDark} />
                                </div>

                                <Panel title="Active Alerts" icon={AlertTriangle} accentColor={THEME.danger}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                        {demoData.activeAlerts.map((alert, i) => (
                                            <AlertRow
                                                key={i}
                                                severity={alert.severity}
                                                title={alert.title}
                                                time={alert.time}
                                                source={alert.source}
                                                color={alert.severity === 'critical' ? THEME.danger : THEME.warning}
                                            />
                                        ))}
                                    </div>
                                </Panel>
                            </div>
                        );
                    case 'prometheus':
                        return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                                <h1>Prometheus Export</h1>
                                <div
                                    style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}
                                    className="dpg-stagger"
                                >
                                    <ExecStatCard
                                        value="Active"
                                        label="ENDPOINT STATUS"
                                        subtitle="/metrics"
                                        color={THEME.success}
                                    />
                                    <ExecStatCard
                                        value="12s ago"
                                        label="LAST SCRAPED"
                                        subtitle="On schedule"
                                        color={THEME.info}
                                    />
                                    <ExecStatCard
                                        value="131"
                                        label="METRICS EXPORTED"
                                        subtitle="Total"
                                        color={THEME.primary}
                                    />
                                    <ExecStatCard value="3" label="TARGETS" subtitle="Registered" color={THEME.warningDark} />
                                </div>

                                <Panel title="Metrics Ingestion" icon={Activity} accentColor={THEME.primary}>
                                    <ResponsiveContainer width="100%" height={180}>
                                        <LineChart
                                            data={generateChartData(24).map((d) => ({
                                                ...d,
                                                rate: Math.random() * 3000,
                                            }))}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" stroke={THEME.grid} />
                                            <XAxis dataKey="time" stroke={THEME.textDim} />
                                            <YAxis stroke={THEME.textDim} />
                                            <Tooltip content={<ChartTip />} />
                                            <Line
                                                type="monotone"
                                                dataKey="rate"
                                                stroke={THEME.primary}
                                                strokeWidth={2}
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </Panel>

                                <Panel title="Target Status" icon={Radio} accentColor={THEME.primary}>
                                    <DataTable
                                        columns={[
                                            { key: 'metric', label: 'Metric', mono: true, width: '50%' },
                                            { key: 'value', label: 'Value', align: 'right', mono: true },
                                            { key: 'timestamp', label: 'Timestamp', align: 'center', mono: true },
                                        ]}
                                        rows={demoData.prometheusMetrics}
                                        accentColor={THEME.primary}
                                    />
                                </Panel>
                            </div>
                        );
                    case 'auth':
                        return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                                <div
                                    style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}
                                    className="dpg-stagger"
                                >
                                    <ExecStatCard
                                        value="2"
                                        label="SSO PROVIDERS"
                                        subtitle="Configured"
                                        color={THEME.info}
                                    />
                                    <ExecStatCard
                                        value="142"
                                        label="ACTIVE SESSIONS"
                                        subtitle="Current"
                                        color={THEME.success}
                                    />
                                    <ExecStatCard
                                        value="89%"
                                        label="MFA ENABLED"
                                        subtitle="Compliance"
                                        color={THEME.primary}
                                    />
                                    <ExecStatCard value="3" label="FAILED LOGINS" subtitle="Last 24h" color={THEME.warningDark} />
                                </div>
                                <Panel title="SSO / Auth Configuration" icon={Shield} accentColor={THEME.primary}>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 22 }}>
                                        {[
                                            { label: 'Mechanism', value: demoData.authConfig.mechanism },
                                            {
                                                label: 'LDAP Enabled',
                                                value: demoData.authConfig.ldap_enabled ? 'Yes' : 'No',
                                            },
                                            {
                                                label: 'OAuth2 Enabled',
                                                value: demoData.authConfig.oauth2_enabled ? 'Yes' : 'No',
                                            },
                                            {
                                                label: 'MFA Required',
                                                value: demoData.authConfig.mfa_required ? 'Yes' : 'No',
                                            },
                                            { label: 'Password Policy', value: demoData.authConfig.password_policy },
                                            { label: 'Session Timeout', value: demoData.authConfig.session_timeout },
                                        ].map((item, i) => (
                                            <div key={i}>
                                                <div
                                                    style={{
                                                        fontSize: 10,
                                                        color: THEME.textDim,
                                                        fontWeight: 600,
                                                        letterSpacing: '0.02em',
                                                        marginBottom: 6,
                                                    }}
                                                >
                                                    {item.label.toUpperCase()}
                                                </div>
                                                <div
                                                    style={{
                                                        fontSize: 13,
                                                        fontWeight: 600,
                                                        color: THEME.textMain,
                                                        fontFamily: THEME.fontMono,
                                                    }}
                                                >
                                                    {item.value}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </Panel>
                                <Panel title="Auth Events" icon={Activity} accentColor={THEME.primary}>
                                    <ResponsiveContainer width="100%" height={220}>
                                        <BarChart
                                            data={[
                                                { hour: '08:00', success: 142, failure: 2 },
                                                { hour: '10:00', success: 158, failure: 1 },
                                                { hour: '12:00', success: 174, failure: 3 },
                                                { hour: '14:00', success: 168, failure: 2 },
                                                { hour: '16:00', success: 185, failure: 1 },
                                                { hour: '18:00', success: 192, failure: 2 },
                                                { hour: '20:00', success: 178, failure: 0 },
                                                { hour: '22:00', success: 156, failure: 1 },
                                            ]}
                                        >
                                            <defs>
                                                <linearGradient id="mdb-auth-grad1" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor={THEME.success} stopOpacity={0.8} />
                                                    <stop offset="95%" stopColor={THEME.success} stopOpacity={0.2} />
                                                </linearGradient>
                                                <linearGradient id="mdb-auth-grad2" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor={THEME.danger} stopOpacity={0.8} />
                                                    <stop offset="95%" stopColor={THEME.danger} stopOpacity={0.2} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke={THEME.grid} />
                                            <XAxis dataKey="hour" stroke={THEME.textDim} />
                                            <YAxis stroke={THEME.textDim} />
                                            <Tooltip content={<ChartTip />} />
                                            <Bar dataKey="success" fill="url(#mdb-auth-grad1)" radius={[8, 8, 0, 0]} />
                                            <Bar dataKey="failure" fill="url(#mdb-auth-grad2)" radius={[8, 8, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </Panel>
                                <Panel title="Recent Auth Events" icon={Lock} accentColor={THEME.primary}>
                                    <DataTable
                                        columns={[
                                            { key: 'time', label: 'Time', width: '15%' },
                                            { key: 'user', label: 'User', width: '20%' },
                                            { key: 'action', label: 'Action', width: '25%' },
                                            { key: 'status', label: 'Status', width: '15%' },
                                            { key: 'ipAddress', label: 'IP Address', width: '25%' },
                                        ]}
                                        rows={[
                                            {
                                                time: '22:42:18',
                                                user: 'alex.chen@company.com',
                                                action: 'Login with MFA',
                                                status: 'Success',
                                                ipAddress: '192.168.1.42',
                                            },
                                            {
                                                time: '22:38:45',
                                                user: 'sarah.johnson@company.com',
                                                action: 'Login',
                                                status: 'Success',
                                                ipAddress: '10.0.0.8',
                                            },
                                            {
                                                time: '22:35:22',
                                                user: 'failed.user@company.com',
                                                action: 'Login attempt',
                                                status: 'Failed',
                                                ipAddress: '192.168.2.15',
                                            },
                                            {
                                                time: '22:30:10',
                                                user: 'mike.garcia@company.com',
                                                action: 'Logout',
                                                status: 'Success',
                                                ipAddress: '10.0.0.22',
                                            },
                                        ]}
                                        accentColor={THEME.primary}
                                    />
                                </Panel>
                            </div>
                        );
                    case 'atlasapi':
                        return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                                <h1>Atlas API Bridge</h1>
                                <div
                                    style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}
                                    className="dpg-stagger"
                                >
                                    <ExecStatCard value="2,840" label="API CALLS" subtitle="Last 24h" color={THEME.info} />
                                    <ExecStatCard
                                        value="84ms"
                                        label="AVG LATENCY"
                                        subtitle="Response"
                                        color={THEME.success}
                                    />
                                    <ExecStatCard value="0.2%" label="ERROR RATE" subtitle="Healthy" color={THEME.success} />
                                    <ExecStatCard
                                        value="42%"
                                        label="QUOTA USED"
                                        subtitle="Of daily limit"
                                        color={THEME.warningDark}
                                    />
                                </div>

                                <Panel title="API Usage" icon={Activity} accentColor={THEME.primary}>
                                    <ResponsiveContainer width="100%" height={180}>
                                        <AreaChart
                                            data={generateChartData(24).map((d) => ({
                                                ...d,
                                                calls: Math.random() * 20000,
                                            }))}
                                        >
                                            <defs>
                                                <linearGradient id="mongo-atlasapi" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor={THEME.primary} stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor={THEME.primary} stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke={THEME.grid} />
                                            <XAxis dataKey="time" stroke={THEME.textDim} />
                                            <YAxis stroke={THEME.textDim} />
                                            <Tooltip content={<ChartTip />} />
                                            <Area
                                                type="monotone"
                                                dataKey="calls"
                                                stroke={THEME.primary}
                                                fill="url(#mongo-atlasapi)"
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </Panel>

                                <Panel title="Recent API Calls" icon={Network} accentColor={THEME.primary}>
                                    <DataTable
                                        columns={[
                                            { key: 'endpoint', label: 'Endpoint', mono: true, width: '50%' },
                                            { key: 'calls', label: 'Calls', align: 'right' },
                                            {
                                                key: 'avg_response',
                                                label: 'Avg Response (ms)',
                                                align: 'right',
                                                mono: true,
                                            },
                                            { key: 'errors', label: 'Errors', align: 'right' },
                                        ]}
                                        rows={demoData.atlasAPIMetrics}
                                        accentColor={THEME.primary}
                                    />
                                </Panel>
                            </div>
                        );
                    case 'dashboards':
                        return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                                <div
                                    style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}
                                    className="dpg-stagger"
                                >
                                    <ExecStatCard value="8" label="DASHBOARDS" subtitle="Created" color={THEME.info} />
                                    <ExecStatCard value="24" label="WIDGETS" subtitle="Total" color={THEME.success} />
                                    <ExecStatCard value="3" label="SHARED" subtitle="With team" color={THEME.primary} />
                                    <ExecStatCard
                                        value="2h ago"
                                        label="LAST VIEWED"
                                        subtitle="Recent"
                                        color={THEME.warningDark}
                                    />
                                </div>
                                <Panel title="Dashboard Inventory" icon={BarChart3} accentColor={THEME.primary}>
                                    <DataTable
                                        columns={[
                                            { key: 'name', label: 'Dashboard Name', mono: true },
                                            { key: 'owner', label: 'Owner', width: '15%' },
                                            { key: 'widgets', label: 'Widgets', align: 'center' },
                                            { key: 'last_viewed', label: 'Last Viewed', width: '18%' },
                                            { key: 'shared', label: 'Shared' },
                                        ]}
                                        rows={demoData.customDashboards.map((dash, i) => ({
                                            name: dash.name,
                                            owner: ['alice', 'bob', 'charlie'][i % 3],
                                            widgets: dash.widgets,
                                            last_viewed: dash.last_modified,
                                            shared: dash.shared ? 'Yes' : 'No',
                                        }))}
                                        accentColor={THEME.primary}
                                    />
                                </Panel>
                            </div>
                        );
                    case 'reports':
                        return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                                <div
                                    style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}
                                    className="dpg-stagger"
                                >
                                    <ExecStatCard value="24" label="REPORTS" subtitle="Generated" color={THEME.info} />
                                    <ExecStatCard value="8" label="SCHEDULED" subtitle="Active" color={THEME.success} />
                                    <ExecStatCard value="12" label="TEMPLATES" subtitle="Available" color={THEME.primary} />
                                    <ExecStatCard
                                        value="2h ago"
                                        label="LAST RUN"
                                        subtitle="On schedule"
                                        color={THEME.warningDark}
                                    />
                                </div>
                                <Panel title="Report History" icon={FileCog} accentColor={THEME.primary}>
                                    <DataTable
                                        columns={[
                                            { key: 'name', label: 'Report Name', mono: true },
                                            { key: 'generated', label: 'Generated', width: '15%' },
                                            { key: 'recipients', label: 'Recipients', align: 'center' },
                                            { key: 'format', label: 'Format', width: '10%' },
                                            { key: 'size', label: 'Size', align: 'right' },
                                        ]}
                                        rows={[
                                            {
                                                name: 'daily_operations',
                                                generated: '2 hours ago',
                                                recipients: '12',
                                                format: 'PDF',
                                                size: '2.3 MB',
                                            },
                                            {
                                                name: 'weekly_summary',
                                                generated: '1 day ago',
                                                recipients: '28',
                                                format: 'HTML',
                                                size: '5.1 MB',
                                            },
                                            {
                                                name: 'monthly_analysis',
                                                generated: '3 days ago',
                                                recipients: '15',
                                                format: 'Excel',
                                                size: '8.7 MB',
                                            },
                                            {
                                                name: 'performance_audit',
                                                generated: '5 days ago',
                                                recipients: '6',
                                                format: 'PDF',
                                                size: '12.4 MB',
                                            },
                                            {
                                                name: 'compliance_report',
                                                generated: '1 week ago',
                                                recipients: '34',
                                                format: 'HTML',
                                                size: '18.2 MB',
                                            },
                                        ]}
                                        accentColor={THEME.primary}
                                    />
                                </Panel>
                            </div>
                        );
                    case 'auditlog':
                        return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                                <h1>Audit Log</h1>
                                <div
                                    style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}
                                    className="dpg-stagger"
                                >
                                    <ExecStatCard
                                        value="1,240"
                                        label="EVENTS (24H)"
                                        subtitle="Recorded"
                                        color={THEME.info}
                                    />
                                    <ExecStatCard
                                        value="342"
                                        label="AUTH EVENTS"
                                        subtitle="Login/logout"
                                        color={THEME.success}
                                    />
                                    <ExecStatCard
                                        value="648"
                                        label="DATA ACCESS"
                                        subtitle="Read/write"
                                        color={THEME.primary}
                                    />
                                    <ExecStatCard
                                        value="250"
                                        label="ADMIN ACTIONS"
                                        subtitle="Config changes"
                                        color={THEME.warningDark}
                                    />
                                </div>

                                <Panel title="Event Volume" icon={Activity} accentColor={THEME.primary}>
                                    <ResponsiveContainer width="100%" height={180}>
                                        <AreaChart
                                            data={generateChartData(24).map((d) => ({
                                                ...d,
                                                events: Math.random() * 500,
                                            }))}
                                        >
                                            <defs>
                                                <linearGradient id="mongo-auditlog" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor={THEME.primary} stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor={THEME.primary} stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke={THEME.grid} />
                                            <XAxis dataKey="time" stroke={THEME.textDim} />
                                            <YAxis stroke={THEME.textDim} />
                                            <Tooltip content={<ChartTip />} />
                                            <Area
                                                type="monotone"
                                                dataKey="events"
                                                stroke={THEME.primary}
                                                fill="url(#mongo-auditlog)"
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </Panel>

                                <Panel title="Recent Events" icon={Inbox} accentColor={THEME.primary}>
                                    <DataTable
                                        columns={[
                                            { key: 'timestamp', label: 'Timestamp', mono: true },
                                            { key: 'action', label: 'Action', mono: true },
                                            { key: 'user', label: 'User', mono: true },
                                            { key: 'status', label: 'Status', align: 'center' },
                                        ]}
                                        rows={demoData.auditLog}
                                        accentColor={THEME.primary}
                                    />
                                </Panel>
                            </div>
                        );
                    case 'users':
                        return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                                <div
                                    style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}
                                    className="dpg-stagger"
                                >
                                    <ExecStatCard value="4" label="TOTAL USERS" subtitle="Active" color={THEME.info} />
                                    <ExecStatCard value="1" label="ADMINS" subtitle="Full access" color={THEME.warningDark} />
                                    <ExecStatCard value="50%" label="MFA ENABLED" subtitle="2 of 4" color={THEME.success} />
                                    <ExecStatCard value="2h ago" label="LAST LOGIN" subtitle="Recent" color={THEME.primary} />
                                </div>
                                <Panel title="User Management" icon={Users} accentColor={THEME.primary}>
                                    <DataTable
                                        columns={[
                                            { key: 'username', label: 'Username', mono: true },
                                            { key: 'role', label: 'Role', width: '15%' },
                                            { key: 'last_login', label: 'Last Login', align: 'center' },
                                            { key: 'mfa', label: 'MFA', align: 'center' },
                                            { key: 'status', label: 'Status' },
                                        ]}
                                        rows={demoData.users.map((u) => ({
                                            ...u,
                                            mfa: u.mfa ? 'Enabled' : 'Disabled',
                                            status: ['Active', 'Active', 'Inactive'][Math.floor(Math.random() * 3)],
                                        }))}
                                        accentColor={THEME.primary}
                                    />
                                </Panel>
                            </div>
                        );
                    default:
                        return null;
                }

            default:
                return null;
        }
    };

    return (
        <DemoLayout
            sections={sections}
            renderContent={renderContent}
            title="Mongo Monitor"
            accentColor={THEME.primary}
            titleIcon={Database}
            headerStats={[
                { value: '419', label: 'CONNECTIONS', color: THEME.success },
                { value: '3,089', label: 'OPS/SEC', color: THEME.info },
                { value: '26ms', label: 'P50 LATENCY', color: THEME.warningDark },
            ]}
            clusterOptions={['Local Dev', 'Production', 'Staging']}
            statusItems={[
                { label: 'Cluster', value: 'Local Dev — rs0' },
                { label: 'MongoDB', value: '7.0.4' },
                { label: 'Nodes', value: '3/3 healthy', color: THEME.success },
                { label: 'Uptime', value: '18d 4h' },
                { label: 'Last sync', value: new Date().toLocaleTimeString() },
            ]}
            activeDemo="demo-mongodb"
        />
    );
}

export default React.memo(DemoMongoDBTab);
