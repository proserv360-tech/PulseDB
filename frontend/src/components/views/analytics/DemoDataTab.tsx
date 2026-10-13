import React from 'react';
import { THEME, metricValue } from '../../../utils/theme';
import {
    Database,
    Activity,
    Zap,
    Clock,
    HardDrive,
    Shield,
    ArrowUpRight,
    ArrowDownRight,
    Leaf,
    Hourglass,
    CheckCircle,
    AlertTriangle,
    Server,
    Cpu,
    Network,
    BarChart3,
    Lock,
    Globe,
    ChevronDown,
    GitBranch,
    Gauge,
    MemoryStick,
    Layers,
    Radio,
    Eye,
    Code,
    TrendingUp,
    RefreshCw,
    Archive,
    Users,
    Cloud,
    Bell,
    FileSearch,
    Link2,
    Radar,
    Container,
    Brain,
    Terminal,
    Star,
    CalendarCheck,
    LayoutDashboard,
} from 'lucide-react';
import {
    ResponsiveContainer,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
    PieChart,
    Pie,
    Cell,
    BarChart,
    Bar,
    LineChart,
    Line,
    ReferenceLine,
    Legend,
} from 'recharts';

const DB_COLORS = {
    postgresql: THEME.primary,
    mysql: THEME.secondary,
    mongodb: THEME.secondaryDark,
};

const DATABASE_STRUCTURE = {
    postgresql: {
        name: 'PostgreSQL',
        color: DB_COLORS.postgresql,
        icon: Database,
        kpis: [
            {
                label: 'TPS',
                value: '1,247',
                unit: '/s',
                status: 'healthy',
                sparkline: [1100, 1200, 1150, 1300, 1400, 1250, 1200],
            },
            {
                label: 'Cache Hit',
                value: '99.2',
                unit: '%',
                status: 'healthy',
                sparkline: [98, 98.5, 99, 99.1, 99.2, 99.1, 99.2],
            },
            { label: 'Connections', value: '42', unit: '', status: 'healthy', sparkline: [38, 40, 39, 42, 41, 42, 42] },
            { label: 'Uptime', value: '47d', unit: '12h', status: 'healthy', sparkline: [30, 35, 40, 45, 46, 47, 47] },
            {
                label: 'DB Size',
                value: '14.8',
                unit: 'GB',
                status: 'warning',
                sparkline: [10, 11, 12, 13, 14, 14.5, 14.8],
            },
        ],
        sections: [
            {
                id: 'core',
                name: 'Engine Health',
                tabs: [
                    {
                        name: 'Overview',
                        metrics: [
                            { label: 'QPS', value: '1,247', unit: '/s' },
                            { label: 'Commits', value: '98.5', unit: '%' },
                            { label: 'Rollbacks', value: '0.2', unit: '%' },
                            { label: 'Uptime', value: '47', unit: 'days' },
                            { label: 'WAL Generation Rate', value: '45', unit: 'MB/s' },
                            { label: 'Temp Files Created', value: '23', unit: '/hour' },
                            { label: 'Deadlocks', value: '0', unit: '/day' },
                            { label: 'Tuple Insert Rate', value: '12,450', unit: '/s' },
                        ],
                    },
                    {
                        name: 'Performance',
                        metrics: [
                            { label: 'Avg Query Time', value: '2.3', unit: 'ms' },
                            { label: 'Slow Queries', value: '12', unit: '' },
                            { label: 'Query Count', value: '18,450', unit: '/hour' },
                            { label: 'P95 Latency', value: '5.8', unit: 'ms' },
                            { label: 'Tuple Update Rate', value: '3,200', unit: '/s' },
                            { label: 'Tuple Delete Rate', value: '890', unit: '/s' },
                        ],
                    },
                    {
                        name: 'Resources',
                        metrics: [
                            { label: 'CPU Usage', value: '34', unit: '%' },
                            { label: 'Memory Usage', value: '62', unit: '%' },
                            { label: 'Disk I/O', value: '245', unit: 'MB/s' },
                            { label: 'Swap Usage', value: '0', unit: 'MB' },
                            { label: 'Live Tuples', value: '45.2M', unit: '' },
                            { label: 'Dead Tuples', value: '23K', unit: '' },
                        ],
                    },
                    {
                        name: 'Reliability',
                        metrics: [
                            { label: 'Error Rate', value: '0.01', unit: '%' },
                            { label: 'Failed Transactions', value: '0', unit: '/hour' },
                            { label: 'Recovery Time', value: '2.1', unit: 's' },
                            { label: 'Availability', value: '99.99', unit: '%' },
                        ],
                    },
                    {
                        name: 'Alerts',
                        metrics: [
                            { label: 'Active Alerts', value: '0', unit: '' },
                            { label: 'Total Rules', value: '34', unit: '' },
                            { label: 'Triggered Today', value: '2', unit: '' },
                            { label: 'Avg Response', value: '5', unit: 'mins' },
                        ],
                    },
                ],
            },
            {
                id: 'query',
                name: 'Query Intelligence',
                tabs: [
                    {
                        name: 'Query Optimizer',
                        metrics: [
                            { label: 'Index Scans', value: '89', unit: '%' },
                            { label: 'Sequential Scans', value: '11', unit: '%' },
                            { label: 'Avg Cost', value: '245.7', unit: 'units' },
                            { label: 'Plans Cached', value: '8,234', unit: '' },
                            { label: 'Query Plan Cache Hit', value: '87.3', unit: '%' },
                            { label: 'Parallel Query Workers', value: '4', unit: '' },
                        ],
                    },
                    {
                        name: 'Indexes',
                        metrics: [
                            { label: 'Total Indexes', value: '342', unit: '' },
                            { label: 'Unused Indexes', value: '23', unit: '' },
                            { label: 'Bloated Indexes', value: '5', unit: '' },
                            { label: 'Index Hit Ratio', value: '94.2', unit: '%' },
                        ],
                    },
                    {
                        name: 'Plan Regression',
                        metrics: [
                            { label: 'Plan Changes', value: '3', unit: '' },
                            { label: 'Regressions', value: '0', unit: '' },
                            { label: 'Performance Delta', value: '+2.1', unit: '%' },
                            { label: 'Last Analyzed', value: '15', unit: 'mins' },
                        ],
                    },
                    {
                        name: 'Bloat Analysis',
                        metrics: [
                            { label: 'Bloated Tables', value: '8', unit: '' },
                            { label: 'Total Bloat', value: '234', unit: 'MB' },
                            { label: 'Bloat Ratio', value: '12.3', unit: '%' },
                            { label: 'Vacuum Needed', value: '3', unit: '' },
                        ],
                    },
                    {
                        name: 'Table Analysis',
                        metrics: [
                            { label: 'Total Tables', value: '567', unit: '' },
                            { label: 'Analyzed', value: '98.2', unit: '%' },
                            { label: 'Autovacuum Runs', value: '456', unit: '/day' },
                            { label: 'Last Analyze', value: '2', unit: 'hours' },
                            { label: 'Hash Join Efficiency', value: '92.1', unit: '%' },
                            { label: 'Sort Operations', value: '1,234', unit: '/hour' },
                        ],
                    },
                ],
            },
            {
                id: 'infra',
                name: 'Infrastructure & HA',
                tabs: [
                    {
                        name: 'Connection Pool',
                        metrics: [
                            { label: 'Active Conn', value: '42', unit: '' },
                            { label: 'Idle Conn', value: '8', unit: '' },
                            { label: 'Max Pool Size', value: '100', unit: '' },
                            { label: 'Pool Efficiency', value: '95.3', unit: '%' },
                            { label: 'Connection Wait Time', value: '0.5', unit: 'ms' },
                            { label: 'pgBouncer Queue', value: '0', unit: '' },
                        ],
                    },
                    {
                        name: 'Replication & WAL',
                        metrics: [
                            { label: 'WAL Level', value: 'replica', unit: '' },
                            { label: 'Replication Lag', value: '0.3', unit: 'ms' },
                            { label: 'WAL Files', value: '42', unit: '' },
                            { label: 'Archiving Status', value: 'active', unit: '' },
                            { label: 'Streaming Replicas', value: '2', unit: '' },
                            { label: 'Logical Slots', value: '3', unit: '' },
                            { label: 'WAL Retention', value: '2', unit: 'GB' },
                        ],
                    },
                    {
                        name: 'Checkpoint Monitor',
                        metrics: [
                            { label: 'Checkpoints/Day', value: '288', unit: '' },
                            { label: 'Checkpoint Duration', value: '12.5', unit: 's' },
                            { label: 'Avg Interval', value: '300', unit: 's' },
                            { label: 'Last Checkpoint', value: '45', unit: 's ago' },
                        ],
                    },
                    {
                        name: 'Vacuum & Maintenance',
                        metrics: [
                            { label: 'Vacuum Runs/Day', value: '576', unit: '' },
                            { label: 'Analyze Runs', value: '288', unit: '/day' },
                            { label: 'Dead Tuples Removed', value: '234K', unit: '/day' },
                            { label: 'Avg Runtime', value: '2.3', unit: 's' },
                        ],
                    },
                    {
                        name: 'Capacity Planning',
                        metrics: [
                            { label: 'DB Size Growth', value: '2.1', unit: 'GB/week' },
                            { label: 'Projected Size', value: '45.2', unit: 'GB/90d' },
                            { label: 'Tablespace Util', value: '62.1', unit: '%' },
                            { label: 'Estimated Time Full', value: '180', unit: 'days' },
                        ],
                    },
                    {
                        name: 'Backup & Recovery',
                        metrics: [
                            { label: 'Last Backup', value: '1', unit: 'hour' },
                            { label: 'Backup Size', value: '8.9', unit: 'GB' },
                            { label: 'Restore Time Est', value: '12', unit: 'mins' },
                            { label: 'Backup Status', value: 'healthy', unit: '' },
                        ],
                    },
                ],
            },
            {
                id: 'schema',
                name: 'Data Governance',
                tabs: [
                    {
                        name: 'Schema & Migrations',
                        metrics: [
                            { label: 'Tables', value: '234', unit: '' },
                            { label: 'Views', value: '89', unit: '' },
                            { label: 'Pending Migrations', value: '0', unit: '' },
                            { label: 'Last Migration', value: '3', unit: 'days' },
                        ],
                    },
                    {
                        name: 'Security & Compliance',
                        metrics: [
                            { label: 'Roles', value: '18', unit: '' },
                            { label: 'Policies', value: '23', unit: '' },
                            { label: 'Audit Events', value: '12,450', unit: '/day' },
                            { label: 'Failed Auth', value: '0', unit: '' },
                            { label: 'RLS Policies', value: '12', unit: '' },
                            { label: 'Column Encryption', value: '8', unit: 'tables' },
                            { label: 'SSL Connections', value: '100', unit: '%' },
                            { label: 'pg_audit Events', value: '5,600', unit: '/day' },
                        ],
                    },
                ],
            },
            {
                id: 'observability',
                name: 'Platform Observability',
                tabs: [
                    {
                        name: 'CloudWatch',
                        metrics: [
                            { label: 'Metrics', value: '124', unit: '' },
                            { label: 'Alarms Active', value: '0', unit: '' },
                            { label: 'Data Points', value: '98.2M', unit: '' },
                            { label: 'Last Sync', value: '30', unit: 's' },
                        ],
                    },
                    {
                        name: 'Log Pattern Analysis',
                        metrics: [
                            { label: 'Patterns', value: '34', unit: '' },
                            { label: 'Anomalies', value: '0', unit: '' },
                            { label: 'Log Volume', value: '2.3', unit: 'GB/day' },
                            { label: 'Error Rate', value: '0.02', unit: '%' },
                        ],
                    },
                    {
                        name: 'Alert Correlation',
                        metrics: [
                            { label: 'Correlations', value: '12', unit: '' },
                            { label: 'Root Cause ID', value: '89', unit: '%' },
                            { label: 'False Positives', value: '2', unit: '' },
                            { label: 'Accuracy', value: '94.5', unit: '%' },
                        ],
                    },
                    {
                        name: 'OpenTelemetry',
                        metrics: [
                            { label: 'Traces/sec', value: '4,500', unit: '' },
                            { label: 'Spans Collected', value: '234M', unit: '/day' },
                            { label: 'Trace Sampling', value: '100', unit: '%' },
                            { label: 'Latency P99', value: '12.3', unit: 'ms' },
                        ],
                    },
                    {
                        name: 'Kubernetes',
                        metrics: [
                            { label: 'Nodes', value: '12', unit: '' },
                            { label: 'Pods Running', value: '45', unit: '' },
                            { label: 'CPU Util', value: '62.3', unit: '%' },
                            { label: 'Memory Util', value: '71.2', unit: '%' },
                        ],
                    },
                    {
                        name: 'Status Page',
                        metrics: [
                            { label: 'Component Status', value: 'operational', unit: '' },
                            { label: 'Last Incident', value: '15', unit: 'days' },
                            { label: 'Uptime SLA', value: '99.99', unit: '%' },
                            { label: 'Subscriber Count', value: '234', unit: '' },
                        ],
                    },
                    {
                        name: 'AI Monitoring',
                        metrics: [
                            { label: 'Anomalies Detected', value: '2', unit: '/day' },
                            { label: 'AI Accuracy', value: '96.2', unit: '%' },
                            { label: 'Model Training', value: 'daily', unit: '' },
                            { label: 'Forecast Horizon', value: '30', unit: 'days' },
                        ],
                    },
                ],
            },
            {
                id: 'dev',
                name: 'DevOps Tooling',
                tabs: [
                    {
                        name: 'SQL Console',
                        metrics: [
                            { label: 'Queries Run', value: '1,245', unit: '/day' },
                            { label: 'Avg Time', value: '3.2', unit: 'ms' },
                            { label: 'Favorites', value: '34', unit: '' },
                            { label: 'Recent', value: '12', unit: '' },
                        ],
                    },
                    {
                        name: 'API Tracing',
                        metrics: [
                            { label: 'Traces', value: '456K', unit: '/hour' },
                            { label: 'Span Count', value: '2.1M', unit: '' },
                            { label: 'Error Rate', value: '0.1', unit: '%' },
                            { label: 'P99 Latency', value: '234', unit: 'ms' },
                        ],
                    },
                    {
                        name: 'Repository',
                        metrics: [
                            { label: 'Commits', value: '3,456', unit: '' },
                            { label: 'Branches', value: '24', unit: '' },
                            { label: 'Pull Requests', value: '12', unit: 'open' },
                            { label: 'Deployments', value: '45', unit: '/week' },
                            { label: 'CI/CD Status', value: 'green', unit: '' },
                            { label: 'Migration Dry Runs', value: '12', unit: '/week' },
                        ],
                    },
                    {
                        name: 'AI Query Advisor',
                        metrics: [
                            { label: 'Queries Analyzed', value: '234K', unit: '' },
                            { label: 'Optimizations', value: '89', unit: '/week' },
                            { label: 'Avg Improvement', value: '23.4', unit: '%' },
                            { label: 'Adoption Rate', value: '76.2', unit: '%' },
                        ],
                    },
                ],
            },
            {
                id: 'admin',
                name: 'Administration',
                tabs: [
                    {
                        name: 'DBA Task Scheduler',
                        metrics: [
                            { label: 'Scheduled Tasks', value: '34', unit: '' },
                            { label: 'Running', value: '2', unit: '' },
                            { label: 'Failed', value: '0', unit: '' },
                            { label: 'Success Rate', value: '99.8', unit: '%' },
                        ],
                    },
                    {
                        name: 'User Management',
                        metrics: [
                            { label: 'Users', value: '234', unit: '' },
                            { label: 'Roles', value: '18', unit: '' },
                            { label: 'Active Sessions', value: '42', unit: '' },
                            { label: 'Failed Logins', value: '0', unit: '/day' },
                        ],
                    },
                    {
                        name: 'Admin',
                        metrics: [
                            { label: 'Config Changes', value: '23', unit: '/day' },
                            { label: 'Restarts', value: '0', unit: '/week' },
                            { label: 'Maintenance', value: 'scheduled', unit: '' },
                            { label: 'Last Backup', value: '2', unit: 'hours' },
                        ],
                    },
                    {
                        name: 'Data Retention',
                        metrics: [
                            { label: 'Retention Policies', value: '12', unit: '' },
                            { label: 'Data Purged', value: '234', unit: 'GB/week' },
                            { label: 'Compliance Status', value: 'compliant', unit: '' },
                            { label: 'Archive Rate', value: '98.5', unit: '%' },
                        ],
                    },
                    {
                        name: 'Terraform Export',
                        metrics: [
                            { label: 'Resources', value: '456', unit: '' },
                            { label: 'Modules', value: '23', unit: '' },
                            { label: 'Last Export', value: '2', unit: 'hours' },
                            { label: 'Drift Detected', value: '1', unit: '' },
                        ],
                    },
                    {
                        name: 'Custom Dashboards',
                        metrics: [
                            { label: 'Dashboards', value: '18', unit: '' },
                            { label: 'Shared', value: '12', unit: '' },
                            { label: 'Total Panels', value: '567', unit: '' },
                            { label: 'Users With Access', value: '89', unit: '' },
                        ],
                    },
                ],
            },
        ],
    },
    mongodb: {
        name: 'MongoDB',
        color: DB_COLORS.mongodb,
        icon: Database,
        kpis: [
            {
                label: 'Ops/sec',
                value: '12,450',
                unit: '/s',
                status: 'healthy',
                sparkline: [10000, 11200, 12100, 12300, 12450, 12200, 12450],
            },
            {
                label: 'Connections',
                value: '234',
                unit: '',
                status: 'healthy',
                sparkline: [200, 210, 220, 230, 234, 232, 234],
            },
            {
                label: 'Documents',
                value: '45.2',
                unit: 'M',
                status: 'healthy',
                sparkline: [40, 42, 43, 44, 45, 45.1, 45.2],
            },
            {
                label: 'Latency',
                value: '1.2',
                unit: 'ms',
                status: 'healthy',
                sparkline: [1.5, 1.4, 1.3, 1.2, 1.2, 1.2, 1.2],
            },
            { label: 'Memory', value: '78', unit: '%', status: 'warning', sparkline: [60, 65, 70, 75, 77, 78, 78] },
        ],
        sections: [
            {
                id: 'overview',
                name: 'Cluster Overview',
                tabs: [
                    {
                        name: 'Executive Dashboard',
                        metrics: [
                            { label: 'Ops/sec', value: '12,450', unit: '/s' },
                            { label: 'Uptime', value: '99.98', unit: '%' },
                            { label: 'Replica Set', value: 'healthy', unit: '' },
                            { label: 'Sharding', value: '8 shards', unit: '' },
                        ],
                    },
                    {
                        name: 'Connection',
                        metrics: [
                            { label: 'Active Conn', value: '234', unit: '' },
                            { label: 'Idle Conn', value: '45', unit: '' },
                            { label: 'Max Conn Pool', value: '500', unit: '' },
                            { label: 'Conn Efficiency', value: '96.2', unit: '%' },
                        ],
                    },
                    {
                        name: 'Server Info',
                        metrics: [
                            { label: 'Version', value: '7.0.0', unit: '' },
                            { label: 'Storage Engine', value: 'WiredTiger', unit: '' },
                            { label: 'CPU Cores', value: '16', unit: '' },
                            { label: 'Memory', value: '128', unit: 'GB' },
                        ],
                    },
                    {
                        name: 'Databases',
                        metrics: [
                            { label: 'Total Databases', value: '45', unit: '' },
                            { label: 'Largest DB', value: '234', unit: 'GB' },
                            { label: 'Database Count Growth', value: '+3', unit: '/week' },
                            { label: 'Total Size', value: '1.2', unit: 'TB' },
                        ],
                    },
                    {
                        name: 'Collection Relationships',
                        metrics: [
                            { label: 'Total Collections', value: '567', unit: '' },
                            { label: 'Relationships', value: '234', unit: '' },
                            { label: 'Foreign Keys', value: '456', unit: '' },
                            { label: 'Cross-DB Refs', value: '89', unit: '' },
                            { label: 'Mongos Instances', value: '3', unit: '' },
                            { label: 'Config Servers', value: '3', unit: '' },
                            { label: 'Authentication', value: 'SCRAM-SHA-256', unit: '' },
                            { label: 'TLS', value: 'enabled', unit: '' },
                        ],
                    },
                ],
            },
            {
                id: 'performance',
                name: 'Operations & Latency',
                tabs: [
                    {
                        name: 'Server Status',
                        metrics: [
                            { label: 'TPS', value: '12,450', unit: '/s' },
                            { label: 'Index Hits', value: '99.2', unit: '%' },
                            { label: 'Page Faults', value: '0', unit: '/s' },
                            { label: 'Uptime', value: '45', unit: 'days' },
                        ],
                    },
                    {
                        name: 'Real-time Ops',
                        metrics: [
                            { label: 'Read Ops', value: '7,800', unit: '/s' },
                            { label: 'Write Ops', value: '3,200', unit: '/s' },
                            { label: 'Command Ops', value: '1,450', unit: '/s' },
                            { label: 'Queue Depth', value: '0', unit: '' },
                        ],
                    },
                    {
                        name: 'Latency Percentiles',
                        metrics: [
                            { label: 'P50', value: '0.8', unit: 'ms' },
                            { label: 'P95', value: '2.1', unit: 'ms' },
                            { label: 'P99', value: '5.3', unit: 'ms' },
                            { label: 'Max', value: '23.4', unit: 'ms' },
                        ],
                    },
                    {
                        name: 'Namespace Insights',
                        metrics: [
                            { label: 'Active Namespaces', value: '234', unit: '' },
                            { label: 'Top Namespace Ops', value: '8,450', unit: '/s' },
                            { label: 'Namespace Growth', value: '+12', unit: '/week' },
                            { label: 'Avg Document Size', value: '4.2', unit: 'KB' },
                        ],
                    },
                    {
                        name: 'Explain Plan',
                        metrics: [
                            { label: 'Plans Analyzed', value: '456K', unit: '' },
                            { label: 'Slow Plans', value: '23', unit: '' },
                            { label: 'Index Coverage', value: '96.2', unit: '%' },
                            { label: 'Execution Time', value: '1.2', unit: 'ms' },
                        ],
                    },
                    {
                        name: 'Active Operations',
                        metrics: [
                            { label: 'Active Ops', value: '45', unit: '' },
                            { label: 'Longest Op', value: '234', unit: 's' },
                            { label: 'Op Lock Waits', value: '0', unit: '' },
                            { label: 'Killed Ops', value: '2', unit: '/hour' },
                        ],
                    },
                    {
                        name: 'Slow Queries',
                        metrics: [
                            { label: 'Slow Queries', value: '12', unit: '/hour' },
                            { label: 'Avg Time', value: '2.3', unit: 's' },
                            { label: 'Slowest Query', value: '45.6', unit: 's' },
                            { label: 'Trending', value: 'stable', unit: '' },
                        ],
                    },
                    {
                        name: 'Query Profiler',
                        metrics: [
                            { label: 'Profile Level', value: '1', unit: '' },
                            { label: 'Sample Size', value: '98.2M', unit: '/day' },
                            { label: 'Cache Hit', value: '87.3', unit: '%' },
                            { label: 'Data Retention', value: '7', unit: 'days' },
                        ],
                    },
                    {
                        name: 'Query Cost Estimator',
                        metrics: [
                            { label: 'Est Accuracy', value: '94.2', unit: '%' },
                            { label: 'Queries Estimated', value: '567K', unit: '' },
                            { label: 'Cost Variance', value: '2.3', unit: '%' },
                            { label: 'Model Accuracy', value: '96.1', unit: '%' },
                        ],
                    },
                    {
                        name: 'Lock Analysis',
                        metrics: [
                            { label: 'Lock Contention', value: '0.1', unit: '%' },
                            { label: 'Read Locks', value: '78.5', unit: '%' },
                            { label: 'Write Locks', value: '21.5', unit: '%' },
                            { label: 'Avg Hold Time', value: '2.3', unit: 'ms' },
                        ],
                    },
                    {
                        name: 'Anomaly Detection',
                        metrics: [
                            { label: 'Anomalies', value: '2', unit: '/day' },
                            { label: 'Detection Accuracy', value: '98.3', unit: '%' },
                            { label: 'False Positives', value: '1', unit: '/week' },
                            { label: 'Severity High', value: '0', unit: '' },
                        ],
                    },
                    {
                        name: 'Metrics Preview',
                        metrics: [
                            { label: 'Metrics Count', value: '1,234', unit: '' },
                            { label: 'Update Frequency', value: '1', unit: 's' },
                            { label: 'Data Points', value: '234M', unit: '/day' },
                            { label: 'Retention', value: '30', unit: 'days' },
                        ],
                    },
                    {
                        name: 'Live Agent',
                        metrics: [
                            { label: 'Agent Status', value: 'connected', unit: '' },
                            { label: 'Messages/sec', value: '450', unit: '' },
                            { label: 'Latency', value: '12.3', unit: 'ms' },
                            { label: 'Uptime', value: '99.99', unit: '%' },
                            { label: 'Ticket Acquisitions', value: '45K', unit: '/s' },
                            { label: 'Global Lock Queue', value: '0', unit: '' },
                            { label: 'Cursor Timeouts', value: '3', unit: '/hour' },
                            { label: 'getMore Ops', value: '2,300', unit: '/s' },
                        ],
                    },
                ],
            },
            {
                id: 'storage',
                name: 'Storage Engine',
                tabs: [
                    {
                        name: 'Index Advisor',
                        metrics: [
                            { label: 'Missing Indexes', value: '12', unit: '' },
                            { label: 'Unused Indexes', value: '3', unit: '' },
                            { label: 'Bloated Indexes', value: '1', unit: '' },
                            { label: 'Index Efficiency', value: '94.3', unit: '%' },
                        ],
                    },
                    {
                        name: 'Schema Analyzer',
                        metrics: [
                            { label: 'Collections', value: '456', unit: '' },
                            { label: 'Avg Doc Size', value: '4.2', unit: 'KB' },
                            { label: 'Total Size', value: '234', unit: 'GB' },
                            { label: 'Data Compression', value: '62', unit: '%' },
                        ],
                    },
                    {
                        name: 'Collection Stats',
                        metrics: [
                            { label: 'Top Collection', value: 'users', unit: '' },
                            { label: 'Largest Size', value: '45.2', unit: 'GB' },
                            { label: 'Document Count', value: '23.4M', unit: '' },
                            { label: 'Avg Queries', value: '1,250', unit: '/s' },
                        ],
                    },
                    {
                        name: 'WiredTiger Cache',
                        metrics: [
                            { label: 'Cache Size', value: '64', unit: 'GB' },
                            { label: 'Cache Util', value: '78.3', unit: '%' },
                            { label: 'Evictions/sec', value: '234', unit: '' },
                            { label: 'Cache Hit Rate', value: '94.2', unit: '%' },
                        ],
                    },
                    {
                        name: 'Backup Monitor',
                        metrics: [
                            { label: 'Last Backup', value: '1', unit: 'hour' },
                            { label: 'Backup Size', value: '234', unit: 'GB' },
                            { label: 'Backup Duration', value: '15', unit: 'mins' },
                            { label: 'Backup Status', value: 'healthy', unit: '' },
                        ],
                    },
                    {
                        name: 'Capacity Planning',
                        metrics: [
                            { label: 'Growth Rate', value: '2.3', unit: 'GB/week' },
                            { label: 'Storage Util', value: '67.2', unit: '%' },
                            { label: 'Projected 90d', value: '456', unit: 'GB' },
                            { label: 'Days Until Full', value: '180', unit: '' },
                        ],
                    },
                    {
                        name: 'Network',
                        metrics: [
                            { label: 'Bytes In/sec', value: '234', unit: 'MB/s' },
                            { label: 'Bytes Out/sec', value: '156', unit: 'MB/s' },
                            { label: 'Network Util', value: '45.2', unit: '%' },
                            { label: 'Latency', value: '0.5', unit: 'ms' },
                            { label: 'WT Checkpoint Duration', value: '3.2', unit: 's' },
                            { label: 'Journal Commits', value: '45', unit: '/s' },
                            { label: 'Compression Ratio', value: '3.2x', unit: '' },
                            { label: 'Dirty Pages', value: '2.1', unit: '%' },
                        ],
                    },
                ],
            },
            {
                id: 'data',
                name: 'Data Pipeline',
                tabs: [
                    {
                        name: 'Document Editor',
                        metrics: [
                            { label: 'Documents Edited', value: '2,345', unit: '/day' },
                            { label: 'Failed Updates', value: '0', unit: '' },
                            { label: 'Validation Errors', value: '12', unit: '' },
                            { label: 'Bulk Ops', value: '45', unit: '/hour' },
                        ],
                    },
                    {
                        name: 'Aggregation Builder',
                        metrics: [
                            { label: 'Pipelines', value: '234', unit: '' },
                            { label: 'Avg Stages', value: '4.2', unit: '' },
                            { label: 'Cache Hit Rate', value: '78.3', unit: '%' },
                            { label: 'Execution Time', value: '1.2', unit: 's' },
                        ],
                    },
                    {
                        name: 'Import/Export',
                        metrics: [
                            { label: 'Imports', value: '12', unit: '/day' },
                            { label: 'Exports', value: '34', unit: '/day' },
                            { label: 'Total Transferred', value: '12.4', unit: 'GB' },
                            { label: 'Transfer Rate', value: '45', unit: 'MB/s' },
                        ],
                    },
                    {
                        name: 'NL Query Generator',
                        metrics: [
                            { label: 'Queries Generated', value: '456', unit: '/day' },
                            { label: 'Conversion Rate', value: '87.2', unit: '%' },
                            { label: 'Avg Accuracy', value: '92.3', unit: '%' },
                            { label: 'Execution Time', value: '0.8', unit: 's' },
                        ],
                    },
                    {
                        name: 'SQL Translator',
                        metrics: [
                            { label: 'Translations', value: '234', unit: '/day' },
                            { label: 'Success Rate', value: '94.1', unit: '%' },
                            { label: 'Avg Convert Time', value: '2.1', unit: 'ms' },
                            { label: 'Supported Syntax', value: '98.5', unit: '%' },
                        ],
                    },
                    {
                        name: 'Schema Compare',
                        metrics: [
                            { label: 'Schema Versions', value: '45', unit: '' },
                            { label: 'Differences', value: '12', unit: '' },
                            { label: 'Compatibility', value: '98.3', unit: '%' },
                            { label: 'Last Compare', value: '5', unit: 'mins' },
                        ],
                    },
                    {
                        name: 'Geo-spatial',
                        metrics: [
                            { label: 'Geo Queries', value: '234K', unit: '/day' },
                            { label: 'Geo Indexes', value: '34', unit: '' },
                            { label: 'Avg Query Time', value: '3.4', unit: 'ms' },
                            { label: 'Coverage', value: '98.7', unit: '%' },
                            { label: 'Change Streams', value: '12', unit: 'active' },
                            { label: 'TTL Deletions', value: '45K', unit: '/day' },
                            { label: 'Atlas Data Lake', value: '234', unit: '/day' },
                            { label: 'Time Series Collections', value: '8', unit: '' },
                        ],
                    },
                ],
            },
            {
                id: 'intelligence',
                name: 'AI & Analytics',
                tabs: [
                    {
                        name: 'AI Hints',
                        metrics: [
                            { label: 'Suggestions', value: '23', unit: '' },
                            { label: 'Implemented', value: '18', unit: '' },
                            { label: 'Performance Gain', value: '12.5', unit: '%' },
                            { label: 'Accuracy', value: '94.2', unit: '%' },
                        ],
                    },
                    {
                        name: 'Compare Clusters',
                        metrics: [
                            { label: 'Clusters', value: '3', unit: '' },
                            { label: 'Differences', value: '5', unit: '' },
                            { label: 'Performance Ratio', value: '1.23x', unit: '' },
                            { label: 'Last Sync', value: '5', unit: 'mins' },
                        ],
                    },
                    {
                        name: 'Historical Trends',
                        metrics: [
                            { label: 'Data Points', value: '98.2M', unit: '' },
                            { label: 'Trend Accuracy', value: '92.1', unit: '%' },
                            { label: 'Anomalies', value: '0', unit: '' },
                            { label: 'Forecast Days', value: '30', unit: '' },
                        ],
                    },
                    {
                        name: 'Perf Advisor v2',
                        metrics: [
                            { label: 'Recommendations', value: '45', unit: '' },
                            { label: 'Impl Rate', value: '78.2', unit: '%' },
                            { label: 'Avg Improvement', value: '18.3', unit: '%' },
                            { label: 'Confidence', value: '96.1', unit: '%' },
                        ],
                    },
                    {
                        name: 'Trace Correlator',
                        metrics: [
                            { label: 'Traces Correlated', value: '234K', unit: '/day' },
                            { label: 'Correlation Accuracy', value: '96.2', unit: '%' },
                            { label: 'Latency P99', value: '2.3', unit: 'ms' },
                            { label: 'Root Cause ID Rate', value: '89.3', unit: '%' },
                            { label: 'Predictive Scaling', value: '87', unit: '%' },
                            { label: 'Workload Class', value: 'OLTP', unit: '' },
                            { label: 'Auto-Index Suggestions', value: '5', unit: '' },
                            { label: 'Cost Optimization', value: '$234', unit: '/mo saved' },
                        ],
                    },
                ],
            },
            {
                id: 'replication',
                name: 'Replica & Shard',
                tabs: [
                    {
                        name: 'Replica Set + Failover',
                        metrics: [
                            { label: 'Members', value: '3', unit: '' },
                            { label: 'Primary', value: 'healthy', unit: '' },
                            { label: 'Replication Lag', value: '0.2', unit: 'ms' },
                            { label: 'Last Sync', value: '0.1', unit: 's' },
                        ],
                    },
                    {
                        name: 'Sharding',
                        metrics: [
                            { label: 'Shards', value: '8', unit: '' },
                            { label: 'Chunks', value: '1,024', unit: '' },
                            { label: 'Balancer', value: 'active', unit: '' },
                            { label: 'Migration Queue', value: '0', unit: '' },
                        ],
                    },
                    {
                        name: 'Oplog Tail',
                        metrics: [
                            { label: 'Oplog Size', value: '50', unit: 'GB' },
                            { label: 'Oplog Window', value: '24', unit: 'hours' },
                            { label: 'Current Lag', value: '0.3', unit: 'ms' },
                            { label: 'Entries/sec', value: '12,450', unit: '' },
                            { label: 'Elections', value: '0', unit: '/month' },
                            { label: 'Write Concern', value: 'majority', unit: '' },
                            { label: 'Read Preference', value: 'secondaryPreferred', unit: '' },
                            { label: 'Chunk Migrations', value: '3', unit: '/day' },
                        ],
                    },
                ],
            },
            {
                id: 'management',
                name: 'Operations Center',
                tabs: [
                    {
                        name: 'Alert Manager',
                        metrics: [
                            { label: 'Active Alerts', value: '0', unit: '' },
                            { label: 'Total Rules', value: '45', unit: '' },
                            { label: 'Fired/Hour', value: '2', unit: '' },
                            { label: 'False Positives', value: '1', unit: '%' },
                        ],
                    },
                    {
                        name: 'Prometheus Export',
                        metrics: [
                            { label: 'Metrics', value: '567', unit: '' },
                            { label: 'Series', value: '234K', unit: '' },
                            { label: 'Scrape Rate', value: '15', unit: 's' },
                            { label: 'Last Scrape', value: '2', unit: 's ago' },
                        ],
                    },
                    {
                        name: 'Dashboards',
                        metrics: [
                            { label: 'Custom Dashboards', value: '12', unit: '' },
                            { label: 'Shared', value: '8', unit: '' },
                            { label: 'Total Panels', value: '234', unit: '' },
                            { label: 'Total Viewers', value: '45', unit: '' },
                        ],
                    },
                    {
                        name: 'SSO/Auth',
                        metrics: [
                            { label: 'SSO Users', value: '456', unit: '' },
                            { label: 'Auth Failures', value: '1', unit: '/day' },
                            { label: 'Avg Auth Time', value: '0.8', unit: 's' },
                            { label: 'Session Duration', value: '8', unit: 'hours' },
                        ],
                    },
                    {
                        name: 'Atlas API Bridge',
                        metrics: [
                            { label: 'API Calls', value: '234K', unit: '/day' },
                            { label: 'Success Rate', value: '99.9', unit: '%' },
                            { label: 'Avg Response', value: '45', unit: 'ms' },
                            { label: 'Rate Limit Hit', value: '0', unit: '/day' },
                        ],
                    },
                    {
                        name: 'Reports',
                        metrics: [
                            { label: 'Generated Reports', value: '23', unit: '/week' },
                            { label: 'Scheduled Reports', value: '12', unit: '' },
                            { label: 'Email Sent', value: '234', unit: '/week' },
                            { label: 'Open Rate', value: '67.2', unit: '%' },
                        ],
                    },
                    {
                        name: 'Audit Log',
                        metrics: [
                            { label: 'Log Entries', value: '234K', unit: '/day' },
                            { label: 'Changes Made', value: '456', unit: '/day' },
                            { label: 'Users Modified', value: '45', unit: '' },
                            { label: 'Retention Days', value: '90', unit: '' },
                        ],
                    },
                    {
                        name: 'Users',
                        metrics: [
                            { label: 'Total Users', value: '234', unit: '' },
                            { label: 'Active Users', value: '189', unit: '' },
                            { label: 'Admin Users', value: '8', unit: '' },
                            { label: 'Last Activity', value: '5', unit: 'mins' },
                        ],
                    },
                ],
            },
        ],
    },
    mysql: {
        name: 'MySQL',
        color: DB_COLORS.mysql,
        icon: Database,
        kpis: [
            {
                label: 'QPS',
                value: '2,840',
                unit: '/s',
                status: 'healthy',
                sparkline: [2400, 2500, 2600, 2700, 2800, 2820, 2840],
            },
            {
                label: 'Buffer Hit',
                value: '98.7',
                unit: '%',
                status: 'healthy',
                sparkline: [97, 97.5, 98, 98.3, 98.5, 98.6, 98.7],
            },
            {
                label: 'Threads',
                value: '156',
                unit: '',
                status: 'healthy',
                sparkline: [120, 130, 140, 150, 154, 155, 156],
            },
            { label: 'Uptime', value: '92d', unit: '5h', status: 'healthy', sparkline: [50, 60, 70, 80, 90, 91, 92] },
            {
                label: 'DB Size',
                value: '28.4',
                unit: 'GB',
                status: 'warning',
                sparkline: [15, 18, 21, 24, 26, 27.5, 28.4],
            },
        ],
        sections: [
            {
                id: 'core',
                name: 'System Vitals',
                tabs: [
                    {
                        name: 'Overview',
                        metrics: [
                            { label: 'QPS', value: '2,840', unit: '/s' },
                            { label: 'TPS', value: '1,234', unit: '/s' },
                            { label: 'Connections', value: '156', unit: '' },
                            { label: 'Uptime', value: '92', unit: 'days' },
                            { label: 'Handler Read Rate', value: '45K', unit: '/s' },
                            { label: 'Handler Write Rate', value: '12K', unit: '/s' },
                            { label: 'Table Open Cache Hit', value: '98.2', unit: '%' },
                            { label: 'Thread Cache Hit', value: '99.1', unit: '%' },
                        ],
                    },
                    {
                        name: 'Performance',
                        metrics: [
                            { label: 'Avg Query Time', value: '1.8', unit: 'ms' },
                            { label: 'Slow Queries', value: '3', unit: '' },
                            { label: 'Query Count', value: '245M', unit: '/day' },
                            { label: 'P95 Latency', value: '4.2', unit: 'ms' },
                            { label: 'Com_select', value: '2,100', unit: '/s' },
                            { label: 'Com_insert', value: '450', unit: '/s' },
                        ],
                    },
                    {
                        name: 'Resources',
                        metrics: [
                            { label: 'CPU Usage', value: '28', unit: '%' },
                            { label: 'Memory Usage', value: '71', unit: '%' },
                            { label: 'Disk I/O', value: '156', unit: 'MB/s' },
                            { label: 'Swap Usage', value: '0', unit: 'MB' },
                            { label: 'Created Tmp Tables', value: '234', unit: '/hour' },
                            { label: 'Created Tmp Disk Tables', value: '12', unit: '/hour' },
                        ],
                    },
                    {
                        name: 'Reliability',
                        metrics: [
                            { label: 'Error Rate', value: '0.01', unit: '%' },
                            { label: 'Failed Transactions', value: '0', unit: '/hour' },
                            { label: 'Recovery Time', value: '1.8', unit: 's' },
                            { label: 'Availability', value: '99.99', unit: '%' },
                            { label: 'Aborted Clients', value: '0', unit: '/hour' },
                        ],
                    },
                    {
                        name: 'Alerts',
                        metrics: [
                            { label: 'Active Alerts', value: '0', unit: '' },
                            { label: 'Total Rules', value: '28', unit: '' },
                            { label: 'Triggered Today', value: '1', unit: '' },
                            { label: 'Avg Response', value: '6', unit: 'mins' },
                        ],
                    },
                ],
            },
            {
                id: 'query',
                name: 'Query Optimization',
                tabs: [
                    {
                        name: 'Query Optimizer',
                        metrics: [
                            { label: 'Full Scans', value: '2.3', unit: '%' },
                            { label: 'Index Scans', value: '97.7', unit: '%' },
                            { label: 'Avg Cost', value: '156.3', unit: 'units' },
                            { label: 'Query Cache Hit', value: '78.5', unit: '%' },
                            { label: 'Select Full Join', value: '23', unit: '/hour' },
                            { label: 'Adaptive Hash Index Hit', value: '97.3', unit: '%' },
                        ],
                    },
                    {
                        name: 'Slow Query Log',
                        metrics: [
                            { label: 'Slow Queries', value: '3', unit: '/hour' },
                            { label: 'Avg Time', value: '2.3', unit: 's' },
                            { label: 'Lock Waits', value: '0', unit: '' },
                            { label: 'Rows Examined', value: '234K', unit: '/hour' },
                            { label: 'Sort Merge Passes', value: '5', unit: '/hour' },
                            { label: 'Filesort Ops', value: '123', unit: '/hour' },
                        ],
                    },
                    {
                        name: 'Index Statistics',
                        metrics: [
                            { label: 'Indexes', value: '245', unit: '' },
                            { label: 'Unused', value: '12', unit: '' },
                            { label: 'Duplicate', value: '3', unit: '' },
                            { label: 'Hit Ratio', value: '96.2', unit: '%' },
                        ],
                    },
                    {
                        name: 'Query Cache Analysis',
                        metrics: [
                            { label: 'Cache Enabled', value: 'true', unit: '' },
                            { label: 'Cache Size', value: '256', unit: 'MB' },
                            { label: 'Hit Rate', value: '78.5', unit: '%' },
                            { label: 'Efficiency', value: '92.1', unit: '%' },
                        ],
                    },
                ],
            },
            {
                id: 'infra',
                name: 'Engine & Replication',
                tabs: [
                    {
                        name: 'Connection Pool',
                        metrics: [
                            { label: 'Active Conn', value: '156', unit: '' },
                            { label: 'Max Conn', value: '200', unit: '' },
                            { label: 'Aborted Conn', value: '0', unit: '' },
                            { label: 'Conn Efficiency', value: '98.1', unit: '%' },
                        ],
                    },
                    {
                        name: 'InnoDB Engine',
                        metrics: [
                            { label: 'Pool Usage', value: '71', unit: '%' },
                            { label: 'Log Writes', value: '1,234', unit: '/s' },
                            { label: 'Page Reads', value: '23', unit: '/s' },
                            { label: 'Page Writes', value: '45', unit: '/s' },
                            { label: 'Redo Log Size', value: '2', unit: 'GB' },
                            { label: 'Undo Tablespaces', value: '2', unit: '' },
                        ],
                    },
                    {
                        name: 'Replication Status',
                        metrics: [
                            { label: 'Lag Seconds', value: '0', unit: '' },
                            { label: 'Relay Log Size', value: '234', unit: 'MB' },
                            { label: 'Worker Threads', value: '4', unit: '' },
                            { label: 'Last Error', value: 'none', unit: '' },
                            { label: 'GTID Mode', value: 'ON', unit: '' },
                            { label: 'Semi-Sync', value: 'enabled', unit: '' },
                            { label: 'Group Replication', value: '3', unit: 'members' },
                        ],
                    },
                    {
                        name: 'Binary Log',
                        metrics: [
                            { label: 'Binlog Position', value: '1,234,567', unit: '' },
                            { label: 'Binlog Size', value: '512', unit: 'MB' },
                            { label: 'Purge Age', value: '7', unit: 'days' },
                            { label: 'Format', value: 'ROW', unit: '' },
                            { label: 'Relay Log Recovery', value: 'ON', unit: '' },
                        ],
                    },
                    {
                        name: 'Buffer Pool',
                        metrics: [
                            { label: 'Pool Size', value: '8.0', unit: 'GB' },
                            { label: 'Pool Util', value: '71.2', unit: '%' },
                            { label: 'Reads/sec', value: '234', unit: '' },
                            { label: 'Hit Ratio', value: '98.7', unit: '%' },
                        ],
                    },
                ],
            },
            {
                id: 'schema',
                name: 'Schema Management',
                tabs: [
                    {
                        name: 'User Privileges',
                        metrics: [
                            { label: 'Users', value: '34', unit: '' },
                            { label: 'Roles', value: '8', unit: '' },
                            { label: 'Grants', value: '234', unit: '' },
                            { label: 'Host Restrictions', value: '18', unit: '' },
                        ],
                    },
                    {
                        name: 'Audit Log',
                        metrics: [
                            { label: 'Log Entries', value: '234K', unit: '/day' },
                            { label: 'Failed Logins', value: '0', unit: '' },
                            { label: 'Privilege Changes', value: '3', unit: '/day' },
                            { label: 'DDL Changes', value: '5', unit: '/day' },
                            { label: 'Foreign Keys', value: '156', unit: '' },
                            { label: 'Generated Columns', value: '45', unit: '' },
                        ],
                    },
                ],
            },
            {
                id: 'observability',
                name: 'Deep Diagnostics',
                tabs: [
                    {
                        name: 'Performance Schema',
                        metrics: [
                            { label: 'Events', value: '89.3M', unit: '/day' },
                            { label: 'Table I/O', value: '234K', unit: '/s' },
                            { label: 'Statements', value: '12.4K', unit: '/s' },
                            { label: 'Errors', value: '0', unit: '' },
                            { label: 'sys Schema', value: 'enabled', unit: '' },
                            { label: 'Wait Events', value: '45', unit: '' },
                        ],
                    },
                    {
                        name: 'Information Schema',
                        metrics: [
                            { label: 'Queries', value: '456K', unit: '/hour' },
                            { label: 'Table Count', value: '456', unit: '' },
                            { label: 'Column Count', value: '3,456', unit: '' },
                            { label: 'Key Count', value: '1,234', unit: '' },
                            { label: 'Memory Instruments', value: '234', unit: '' },
                            { label: 'Stage Instruments', value: '89', unit: '' },
                        ],
                    },
                    {
                        name: 'Process List',
                        metrics: [
                            { label: 'Active Processes', value: '156', unit: '' },
                            { label: 'Sleeping Processes', value: '45', unit: '' },
                            { label: 'Avg Query Time', value: '1.8', unit: 'ms' },
                            { label: 'Longest Query', value: '234', unit: 's' },
                        ],
                    },
                    {
                        name: 'Error Log Analysis',
                        metrics: [
                            { label: 'Log Entries', value: '234K', unit: '/day' },
                            { label: 'Errors', value: '12', unit: '/day' },
                            { label: 'Warnings', value: '45', unit: '/day' },
                            { label: 'Critical', value: '0', unit: '' },
                        ],
                    },
                ],
            },
            {
                id: 'admin',
                name: 'Server Administration',
                tabs: [
                    {
                        name: 'Server Variables',
                        metrics: [
                            { label: 'Total Vars', value: '456', unit: '' },
                            { label: 'Modified', value: '23', unit: '' },
                            { label: 'Dynamic', value: '234', unit: '' },
                            { label: 'Last Change', value: '2', unit: 'days' },
                        ],
                    },
                    {
                        name: 'Backup & Recovery',
                        metrics: [
                            { label: 'Last Backup', value: '2', unit: 'hours' },
                            { label: 'Backup Size', value: '12.3', unit: 'GB' },
                            { label: 'Restore Time', value: '15', unit: 'mins' },
                            { label: 'Backup Success', value: '100', unit: '%' },
                            { label: 'Clone Plugin', value: 'active', unit: '' },
                            { label: 'MySQL Router', value: '2', unit: 'instances' },
                        ],
                    },
                    {
                        name: 'Import/Export',
                        metrics: [
                            { label: 'Imports', value: '8', unit: '/week' },
                            { label: 'Exports', value: '12', unit: '/week' },
                            { label: 'Data Transferred', value: '45.2', unit: 'GB' },
                            { label: 'Avg Speed', value: '45', unit: 'MB/s' },
                        ],
                    },
                    {
                        name: 'User Management',
                        metrics: [
                            { label: 'Users', value: '34', unit: '' },
                            { label: 'Active Sessions', value: '156', unit: '' },
                            { label: 'Failed Auth', value: '0', unit: '/day' },
                            { label: 'Password Age', value: '45', unit: 'days' },
                            { label: 'Tablespace Usage', value: '78', unit: '%' },
                            { label: 'Enterprise Firewall', value: '45', unit: 'rules' },
                        ],
                    },
                ],
            },
        ],
    },
};

const DETAIL_WIDGETS = {
    postgresql: {
        backup: { time: '2 hours ago', size: '8.9 GB', duration: '12 min', verified: true, next: 'in 22 hours' },
        longTxns: [
            { pid: '12847', query: 'SELECT * FROM large_table WHERE...', duration: '45 min', wait: 'I/O', pct: 75 },
            { pid: '12934', query: 'UPDATE inventory SET qty=qty-1...', duration: '12 min', wait: 'Lock', pct: 40 },
            { pid: '13021', query: 'DELETE FROM audit_logs WHERE...', duration: '3 min', wait: 'CPU', pct: 15 },
        ],
        vacuum: { urgent: 5, soon: 23, healthy: 541, deadTuples: '234.5M', bloat: '12.3' },
    },
    mongodb: {
        backup: { time: '1 hour ago', size: '234 GB', duration: '15 min', verified: true, next: 'in 23 hours' },
        longTxns: [
            { pid: 'conn-456', query: 'db.users.aggregate([{$match...', duration: '23 min', wait: 'I/O', pct: 60 },
            { pid: 'conn-789', query: 'db.orders.find({status:"pen...', duration: '8 min', wait: 'Lock', pct: 30 },
            { pid: 'conn-123', query: 'db.logs.deleteMany({date:{$...', duration: '2 min', wait: 'CPU', pct: 10 },
        ],
        vacuum: { urgent: 0, soon: 12, healthy: 456, deadTuples: '12.3M', bloat: '5.2' },
    },
    mysql: {
        backup: { time: '3 hours ago', size: '12.3 GB', duration: '8 min', verified: true, next: 'in 21 hours' },
        longTxns: [
            { pid: '4567', query: 'SELECT * FROM orders JOIN...', duration: '15 min', wait: 'Row Lock', pct: 50 },
            { pid: '4589', query: 'ALTER TABLE users ADD INDEX...', duration: '5 min', wait: 'Meta Lock', pct: 25 },
        ],
        vacuum: { urgent: 2, soon: 15, healthy: 340, deadTuples: '89.2M', bloat: '8.1' },
    },
};

function hashSeed(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
        h = ((h << 5) - h + str.charCodeAt(i)) | 0;
    }
    return Math.abs(h);
}

function hashNorm(str) {
    return (hashSeed(str) % 10000) / 10000;
}

function genSparkData(label, n = 10, base = 40, variance = 30) {
    let s = hashSeed(label);
    return Array.from({ length: n }, () => {
        s = (s * 1103515245 + 12345) & 0x7fffffff;
        return base + (s % Math.round(variance));
    });
}

function genTrend(label) {
    const s = hashSeed(label);
    return { value: `+${(s % 50) / 10}%`, up: s % 3 !== 0 };
}

function genVelocityData(sectionName) {
    const s = hashSeed(sectionName);
    return Array.from({ length: 24 }, (_, i) => {
        const base = 200 + (s % 300);
        return {
            time: `${String(i).padStart(2, '0')}:00`,
            primary: base + Math.round(Math.sin(i / 3) * 80 + (hashSeed(sectionName + i) % 60)),
            secondary: Math.round((base + Math.sin(i / 3) * 80) * 0.6 + (hashSeed(sectionName + i + 's') % 40)),
        };
    });
}

function DemoStyles() {
    return (
        <style>{`
      @keyframes demoFadeIn {
        from { opacity: 0; transform: translateY(14px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes demoPulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.3; }
      }
      @keyframes demoShine {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(100%); }
      }
      .demo-card-shine::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.03), transparent);
        animation: demoShine 4s ease-in-out infinite;
        pointer-events: none;
      }
      .demo-stagger > *:nth-child(1) { animation: demoFadeIn 0.5s ease both 0.05s; }
      .demo-stagger > *:nth-child(2) { animation: demoFadeIn 0.5s ease both 0.1s; }
      .demo-stagger > *:nth-child(3) { animation: demoFadeIn 0.5s ease both 0.15s; }
      .demo-stagger > *:nth-child(4) { animation: demoFadeIn 0.5s ease both 0.2s; }
      .demo-stagger > *:nth-child(5) { animation: demoFadeIn 0.5s ease both 0.25s; }
      .demo-stagger > *:nth-child(6) { animation: demoFadeIn 0.5s ease both 0.3s; }
      .demo-stagger > *:nth-child(7) { animation: demoFadeIn 0.5s ease both 0.35s; }
      .demo-stagger > *:nth-child(8) { animation: demoFadeIn 0.5s ease both 0.4s; }
      @keyframes demoBarGrow {
        from { transform: scaleX(0); }
        to { transform: scaleX(1); }
      }
    `}</style>
    );
}

function Panel({ title, icon: TIcon, accentColor, rightNode, noPad, children, style = {} }) {
    return (
        <div
            style={{
                background: THEME.surface,
                border: `1px solid ${accentColor ? `${accentColor}22` : THEME.glassBorder}`,
                borderRadius: 18,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                position: 'relative',
                boxShadow: accentColor
                    ? `0 4px 16px ${accentColor}12, 0 1px 4px rgba(0,0,0,0.04)`
                    : '0 4px 16px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)',
                backdropFilter: 'blur(12px)',
                transition: 'all 0.2s ease',
                ...style,
            }}
        >
            <div className="demo-card-shine" />
            {title && (
                <div
                    style={{
                        padding: '14px 20px',
                        borderBottom: `1px solid ${THEME.glassBorder}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexShrink: 0,
                        minHeight: 44,
                        background: 'rgba(0,0,0,0.06)',
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                        {TIcon && (
                            <div
                                style={{
                                    width: 28,
                                    height: 28,
                                    borderRadius: 20,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    background: `${accentColor || THEME.textDim}14`,
                                }}
                            >
                                <TIcon size={13} color={accentColor || THEME.textDim} />
                            </div>
                        )}
                        <span
                            style={{
                                fontSize: 12,
                                fontWeight: 700,
                                color: THEME.textMain,

                                letterSpacing: '0.02em',
                            }}
                        >
                            {title}
                        </span>
                    </div>
                    {rightNode}
                </div>
            )}
            <div style={{ flex: 1, minHeight: 0, padding: noPad ? 0 : '18px 20px' }}>{children}</div>
        </div>
    );
}

function MiniSparkline({ data = [], color = THEME.primary, width = 64, height = 20, filled = true }) {
    if (!data || data.length < 2) return <div style={{ width, height }} />;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const pts = data
        .map((v, i) => `${(i / (data.length - 1)) * width},${height - ((v - min) / range) * (height - 2) - 1}`)
        .join(' ');
    const uid = `dsp-${color.replace(/[^a-z0-9]/gi, '')}-${width}-${Math.random().toString(36).slice(2, 6)}`;
    return (
        <svg width={width} height={height} style={{ display: 'block', overflow: 'visible' }}>
            <defs>
                <linearGradient id={uid} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
            </defs>
            {filled && <polygon points={`0,${height} ${pts} ${width},${height}`} fill={`url(#${uid})`} />}
            <polyline
                points={pts}
                fill="none"
                stroke={color}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

function RingGauge({ value, color, size = 80, strokeWidth = 6, label }) {
    const r = (size - strokeWidth) / 2;
    const circ = 2 * Math.PI * r;
    const filled = (circ * Math.min(value, 100)) / 100;
    return (
        <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={r}
                    fill="none"
                    stroke={THEME.glassBorder}
                    strokeWidth={strokeWidth}
                />
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={r}
                    fill="none"
                    stroke={color}
                    strokeWidth={strokeWidth}
                    strokeDasharray={`${filled} ${circ - filled}`}
                    strokeLinecap="round"
                    transform={`rotate(-90 ${size / 2} ${size / 2})`}
                    style={{
                        transition: 'stroke-dasharray 1.2s cubic-bezier(0.22,1,0.36,1)',
                        filter: `drop-shadow(0 0 5px ${color}50)`,
                    }}
                />
            </svg>
            <div
                style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 1,
                }}
            >
                <span
                    style={{
                        fontSize: size > 70 ? 17 : 10,
                        fontWeight: 700,
                        color,
                        lineHeight: 1,
                        fontFamily: "'JetBrains Mono',monospace",
                    }}
                >
                    {value}%
                </span>
                {label && (
                    <span
                        style={{
                            fontSize: 7.5,
                            color: THEME.textDim,
                            fontWeight: 600,

                            letterSpacing: '0.02em',
                            marginTop: 1,
                        }}
                    >
                        {label}
                    </span>
                )}
            </div>
        </div>
    );
}

function StatusBadge({ label, color, pulse }) {
    return (
        <span
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 9.5,
                fontWeight: 700,
                padding: '3px 9px',
                borderRadius: 18,
                background: `${color}12`,
                color,
                border: `1px solid ${color}22`,
                lineHeight: 1.3,
                whiteSpace: 'nowrap',
                fontFamily: "'JetBrains Mono',monospace",
                letterSpacing: '0.04em',
            }}
        >
            <span
                style={{
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    background: color,

                    flexShrink: 0,
                    animation: pulse ? 'demoPulse 1.5s ease-in-out infinite' : 'none',
                }}
            />
            {label}
        </span>
    );
}

function LiveDot({ color }) {
    return (
        <div
            style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: color,
                animation: 'demoPulse 1.5s ease-in-out infinite',
            }}
        />
    );
}

/* ═══════════════════════════════════════════════════════════════
   RICH WIDGETS — matching real monitoring visual style
   ═══════════════════════════════════════════════════════════════ */

function DonutWidget({ data, size = 110, innerRadius = 38, outerRadius = 50, centerLabel, centerValue, color }) {
    const RADIAN = Math.PI / 180;
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ width: size, height: size, flexShrink: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="50%"
                            innerRadius={innerRadius}
                            outerRadius={outerRadius}
                            paddingAngle={2}
                            dataKey="value"
                            stroke="none"
                        >
                            {data.map((entry, i) => (
                                <Cell key={i} fill={entry.color} />
                            ))}
                        </Pie>
                    </PieChart>
                </ResponsiveContainer>
                <div
                    style={{ position: 'relative', top: -(size / 2 + 12), textAlign: 'center', pointerEvents: 'none' }}
                >
                    <div
                        style={{
                            fontSize: 16,
                            fontWeight: 800,
                            color: metricValue(color),
                            fontFamily: "'JetBrains Mono',monospace",
                        }}
                    >
                        {centerValue}
                    </div>
                    <div style={{ fontSize: 7.5, fontWeight: 600, color: THEME.textDim, letterSpacing: '0.02em' }}>
                        {centerLabel}
                    </div>
                </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {data.map((d, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: 2, background: d.color, flexShrink: 0 }} />
                        <span style={{ fontSize: 10, color: THEME.textMuted }}>{d.name}</span>
                        <span
                            style={{
                                fontSize: 10,
                                fontWeight: 700,
                                color: THEME.textMain,
                                fontFamily: "'JetBrains Mono',monospace",
                                marginLeft: 'auto',
                            }}
                        >
                            {d.display || d.value}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function HorizontalBarList({ items, color }) {
    const maxVal = Math.max(...items.map((i) => i.value));
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            {items.map((item, i) => (
                <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 11, color: THEME.textMuted }}>{item.label}</span>
                        <span
                            style={{ fontSize: 11, fontWeight: 700, color, fontFamily: "'JetBrains Mono',monospace" }}
                        >
                            {item.display}
                        </span>
                    </div>
                    <div style={{ height: 6, borderRadius: 18, background: THEME.glassBorder, overflow: 'hidden' }}>
                        <div
                            style={{
                                height: '100%',
                                borderRadius: 18,
                                width: `${(item.value / maxVal) * 100}%`,
                                background: `linear-gradient(90deg, ${color}, ${color}88)`,
                                animation: 'demoBarGrow 0.9s cubic-bezier(0.22, 1, 0.36, 1) both',
                                transformOrigin: 'left',
                            }}
                        />
                    </div>
                </div>
            ))}
        </div>
    );
}

function ResourceGaugeRow({ resources, color }) {
    return (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${resources.length}, 1fr)`, gap: 20 }}>
            {resources.map((res, i) => {
                const r = 34,
                    sw = 7,
                    circ = Math.PI * r;
                const filled = (circ * Math.min(res.value, 100)) / 100;
                const statusColor = res.value > 80 ? THEME.danger : res.value > 60 ? THEME.warning : THEME.success;
                return (
                    <div
                        key={i}
                        style={{
                            background: THEME.surface,
                            border: `1px solid ${THEME.glassBorder}`,
                            borderRadius: 16,
                            padding: '14px 10px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 20,
                        }}
                    >
                        <svg width={76} height={46} viewBox="0 0 76 46">
                            <path
                                d={`M ${38 - r} 40 A ${r} ${r} 0 0 1 ${38 + r} 40`}
                                fill="none"
                                stroke={`${THEME.glassBorder}`}
                                strokeWidth={sw}
                                strokeLinecap="round"
                            />
                            <path
                                d={`M ${38 - r} 40 A ${r} ${r} 0 0 1 ${38 + r} 40`}
                                fill="none"
                                stroke={statusColor}
                                strokeWidth={sw}
                                strokeLinecap="round"
                                strokeDasharray={`${filled} ${circ - filled}`}
                                style={{
                                    filter: `drop-shadow(0 0 4px ${statusColor}50)`,
                                    transition: 'stroke-dasharray 1s ease',
                                }}
                            />
                            <text
                                x="38"
                                y="34"
                                textAnchor="middle"
                                fill={statusColor}
                                fontSize="14"
                                fontWeight="800"
                                fontFamily="'JetBrains Mono',monospace"
                            >
                                {res.value}%
                            </text>
                        </svg>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <res.icon size={12} color={THEME.textDim} />
                            <span style={{ fontSize: 10, fontWeight: 700, color: THEME.textMuted }}>{res.label}</span>
                            <StatusBadge label={res.status} color={statusColor} />
                        </div>
                        <div style={{ fontSize: 9, color: THEME.textDim }}>{res.detail}</div>
                    </div>
                );
            })}
        </div>
    );
}

function ReplicationTopology({ nodes, color }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18, padding: '8px 0' }}>
            {nodes.map((node, i) => (
                <React.Fragment key={i}>
                    {i > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <div
                                style={{
                                    width: 24,
                                    height: 2,
                                    background: `linear-gradient(90deg, ${color}, ${color}40)`,
                                }}
                            />
                            <div
                                style={{
                                    width: 0,
                                    height: 0,
                                    borderTop: '4px solid transparent',
                                    borderBottom: '4px solid transparent',
                                    borderLeft: `6px solid ${color}`,
                                }}
                            />
                        </div>
                    )}
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 6,
                            padding: '22px 28px',
                            borderRadius: 18,
                            background: `${node.color || color}08`,
                            border: `1px solid ${node.color || color}25`,
                            minWidth: 90,
                        }}
                    >
                        <Server size={16} color={node.color || color} />
                        <span style={{ fontSize: 10, fontWeight: 700, color: THEME.textMain }}>{node.name}</span>
                        <span style={{ fontSize: 9, color: THEME.textDim, fontFamily: "'JetBrains Mono',monospace" }}>
                            lag: {node.lag}
                        </span>
                    </div>
                </React.Fragment>
            ))}
        </div>
    );
}

function MultiLineChartWidget({ data, lines, color }) {
    return (
        <div style={{ height: 160 }}>
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                    <CartesianGrid stroke={THEME.glassBorder} strokeDasharray="3 3" vertical={false} />
                    <XAxis
                        dataKey="time"
                        tick={{ fontSize: 9, fill: THEME.textDim }}
                        axisLine={false}
                        tickLine={false}
                    />
                    <YAxis tick={{ fontSize: 9, fill: THEME.textDim }} axisLine={false} tickLine={false} width={36} />
                    <Tooltip
                        contentStyle={{
                            background: THEME.surface,
                            border: `1px solid ${THEME.glassBorder}`,
                            borderRadius: 18,
                            fontSize: 11,
                        }}
                    />
                    {lines.map((line, i) => (
                        <Line
                            key={i}
                            type="monotone"
                            dataKey={line.key}
                            stroke={line.color}
                            strokeWidth={2}
                            dot={false}
                            strokeDasharray={line.dashed ? '5 3' : undefined}
                        />
                    ))}
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}

function MiniBarChart({ data, color }) {
    return (
        <div style={{ height: 140 }}>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                    <CartesianGrid stroke={THEME.glassBorder} strokeDasharray="3 3" vertical={false} />
                    <XAxis
                        dataKey="time"
                        tick={{ fontSize: 9, fill: THEME.textDim }}
                        axisLine={false}
                        tickLine={false}
                    />
                    <YAxis tick={{ fontSize: 9, fill: THEME.textDim }} axisLine={false} tickLine={false} width={36} />
                    <Tooltip
                        contentStyle={{
                            background: THEME.surface,
                            border: `1px solid ${THEME.glassBorder}`,
                            borderRadius: 18,
                            fontSize: 11,
                        }}
                    />
                    <Bar dataKey="reads" fill={color} radius={[3, 3, 0, 0]} opacity={0.8} />
                    <Bar dataKey="writes" fill={`${color}60`} radius={[3, 3, 0, 0]} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════
   DATABASE-SPECIFIC widget data — each DB × section is unique
   ═══════════════════════════════════════════════════════════════ */

const DB_TABLE_NAMES = {
    postgresql: ['public.orders', 'public.events', 'public.sessions', 'audit.log_entries', 'public.users'],
    mysql: ['orders', 'wp_posts', 'user_sessions', 'inventory', 'wp_comments'],
    mongodb: ['users', 'orders', 'products', 'sessions', 'analytics'],
};

const DB_SLOW_QUERIES = {
    postgresql: [
        { label: 'SELECT * FROM orders JOIN...', value: 850, display: '850ms' },
        { label: 'UPDATE inventory SET qty...', value: 520, display: '520ms' },
        { label: 'VACUUM ANALYZE public.events', value: 340, display: '340ms' },
        { label: 'SELECT count(*) FROM sessions', value: 280, display: '280ms' },
    ],
    mysql: [
        { label: 'SELECT SQL_NO_CACHE * FROM wp_posts...', value: 1240, display: '1.24s' },
        { label: 'INSERT INTO orders SELECT...', value: 890, display: '890ms' },
        { label: 'ALTER TABLE inventory ADD INDEX...', value: 650, display: '650ms' },
        { label: 'UPDATE wp_comments SET status...', value: 420, display: '420ms' },
    ],
    mongodb: [
        { label: 'db.orders.aggregate([{$lookup...', value: 1560, display: '1.56s' },
        { label: 'db.analytics.find({ts:{$gte...', value: 980, display: '980ms' },
        { label: 'db.users.updateMany({active...', value: 720, display: '720ms' },
        { label: 'db.products.distinct("category")', value: 340, display: '340ms' },
    ],
};

const DB_CONN_STATS = {
    postgresql: { active: 42, idle: 58, waiting: 0, max: 100, pct: 42 },
    mysql: { active: 156, idle: 44, waiting: 3, max: 200, pct: 78 },
    mongodb: { active: 234, idle: 166, waiting: 8, max: 500, pct: 47 },
};

const DB_RESOURCE_STATS = {
    postgresql: { cpu: 34, mem: 62, disk: 8, cpuCores: 4, memGB: '12 / 16', diskGB: '117 / 200 SSD' },
    mysql: { cpu: 28, mem: 71, disk: 45, cpuCores: 8, memGB: '24 / 32', diskGB: '156 / 500 NVMe' },
    mongodb: { cpu: 38, mem: 78, disk: 67, cpuCores: 8, memGB: '64 / 128', diskGB: '456 / 1000 EBS' },
};

const DB_WORKLOAD = {
    postgresql: { reads: 99, writes: 1 },
    mysql: { reads: 72, writes: 28 },
    mongodb: { reads: 81, writes: 19 },
};

const DB_REPLICATION = {
    postgresql: [
        { name: 'pg-primary', lag: '0 ms', color: null },
        { name: 'pg-replica-1', lag: '128 ms', color: null },
        { name: 'pg-replica-2', lag: '488 ms', color: null },
    ],
    mysql: [
        { name: 'mysql-source', lag: '0 ms', color: null },
        { name: 'mysql-replica', lag: '250 ms', color: null },
    ],
    mongodb: [
        { name: 'rs0-primary', lag: '0 ms', color: null },
        { name: 'rs0-sec-1', lag: '50 ms', color: null },
        { name: 'rs0-sec-2', lag: '120 ms', color: null },
        { name: 'rs0-arbiter', lag: 'N/A', color: null },
    ],
};

const DB_SCHEMA_OBJECTS = {
    postgresql: { tables: 234, views: 89, functions: 156, triggers: 42, total: 521 },
    mysql: { tables: 456, views: 78, functions: 45, triggers: 23, total: 602 },
    mongodb: { tables: 567, views: 34, functions: 0, triggers: 0, total: 601 },
};

const DB_INDEX_STATS = {
    postgresql: { indexPct: 89, seqPct: 11 },
    mysql: { indexPct: 98, seqPct: 2 },
    mongodb: { indexPct: 85, seqPct: 15 },
};

const DB_ALERT_DIST = {
    postgresql: [
        { label: 'Critical', value: 0, display: '0' },
        { label: 'Warning', value: 3, display: '3' },
        { label: 'Info', value: 18, display: '18' },
        { label: 'Resolved', value: 145, display: '145' },
    ],
    mysql: [
        { label: 'Critical', value: 1, display: '1' },
        { label: 'Warning', value: 5, display: '5' },
        { label: 'Info', value: 22, display: '22' },
        { label: 'Resolved', value: 189, display: '189' },
    ],
    mongodb: [
        { label: 'Critical', value: 1, display: '1' },
        { label: 'Warning', value: 6, display: '6' },
        { label: 'Info', value: 28, display: '28' },
        { label: 'Resolved', value: 201, display: '201' },
    ],
};

const DB_USER_DIST = {
    postgresql: { admin: 8, dev: 45, readonly: 120, service: 23, total: 196 },
    mysql: { admin: 5, dev: 34, readonly: 89, service: 12, total: 140 },
    mongodb: { admin: 6, dev: 28, readonly: 67, service: 18, total: 119 },
};

/* Per-section rich widget data generators — now DB-aware */
function getSectionWidgets(sectionId, db) {
    const c = db.color;
    const dbName = db.name.toLowerCase().replace(' ', '');
    /* normalize key for lookups */
    const key = dbName;
    const conn = DB_CONN_STATS[key] || DB_CONN_STATS.postgresql;
    const res = DB_RESOURCE_STATS[key] || DB_RESOURCE_STATS.postgresql;
    const wl = DB_WORKLOAD[key] || DB_WORKLOAD.postgresql;
    const tables = DB_TABLE_NAMES[key] || DB_TABLE_NAMES.postgresql;
    const schema = DB_SCHEMA_OBJECTS[key] || DB_SCHEMA_OBJECTS.postgresql;
    const idx = DB_INDEX_STATS[key] || DB_INDEX_STATS.postgresql;
    const alerts = DB_ALERT_DIST[key] || DB_ALERT_DIST.postgresql;
    const users = DB_USER_DIST[key] || DB_USER_DIST.postgresql;
    const repl = (DB_REPLICATION[key] || DB_REPLICATION.postgresql).map((n, i) => ({
        ...n,
        color:
            i === 0
                ? THEME.success
                : i === (DB_REPLICATION[key] || DB_REPLICATION.postgresql).length - 1
                  ? THEME.warning
                  : c,
    }));
    const seed = hashSeed(key);

    /* helper: deterministic latency-style time series */
    const mkTimeSeries = (tag, fields) =>
        Array.from({ length: 12 }, (_, i) => {
            const s = hashSeed(key + tag + i);
            const row = { time: `${String(i * 2).padStart(2, '0')}:00` };
            fields.forEach((f) => {
                row[f.key] = f.base + (s % f.range) / (f.div || 1);
            });
            return row;
        });

    /* helper: status from value */
    const st = (v, hi = 60, mid = 40) => (v > hi ? 'High' : v > mid ? 'Moderate' : 'Normal');

    switch (sectionId) {
        case 'core': {
            const tblOps = [51000, 45000, 32000, 21000, 16200].map((v) => v + (seed % 20000));
            return {
                pool: {
                    data: [
                        { name: 'Active', value: conn.active, color: c, display: `${conn.active}` },
                        { name: 'Idle', value: conn.idle, color: `${c}30`, display: `${conn.idle}` },
                        { name: 'Waiting', value: conn.waiting, color: THEME.warning, display: `${conn.waiting}` },
                    ],
                    centerValue: `${conn.pct}%`,
                    centerLabel: 'USED',
                },
                resources: [
                    {
                        label: 'CPU Load',
                        value: res.cpu,
                        icon: Cpu,
                        status: st(res.cpu),
                        detail: `${res.cpuCores} cores`,
                    },
                    {
                        label: 'Memory',
                        value: res.mem,
                        icon: MemoryStick,
                        status: st(res.mem, 75, 50),
                        detail: `${res.memGB} GB`,
                    },
                    {
                        label: 'Disk I/O',
                        value: res.disk,
                        icon: HardDrive,
                        status: st(res.disk),
                        detail: `${res.diskGB}`,
                    },
                ],
                latencyData: mkTimeSeries('lat', [
                    { key: 'p50', base: 0.5, range: 30, div: 10 },
                    { key: 'p95', base: 4, range: 80, div: 10 },
                    { key: 'p99', base: 12, range: 200, div: 10 },
                ]),
                workload: {
                    data: [
                        { name: 'Reads', value: wl.reads, color: c, display: `${wl.reads}%` },
                        { name: 'Writes', value: wl.writes, color: THEME.success, display: `${wl.writes}%` },
                    ],
                    centerValue: `${wl.reads}%`,
                    centerLabel: 'READS',
                },
                topTables: tables.map((t, i) => ({
                    label: t,
                    value: tblOps[i],
                    display: `${(tblOps[i] / 1000).toFixed(1)}K ops`,
                })),
            };
        }
        case 'query': {
            const cacheHit = 70 + (seed % 25);
            const planCached = 5000 + (seed % 8000);
            const avgCost = 100 + (seed % 400);
            return {
                pool: {
                    data: [
                        { name: 'Index Scans', value: idx.indexPct, color: THEME.success, display: `${idx.indexPct}%` },
                        {
                            name: key === 'mongodb' ? 'Coll Scans' : 'Seq Scans',
                            value: idx.seqPct,
                            color: THEME.warning,
                            display: `${idx.seqPct}%`,
                        },
                    ],
                    centerValue: `${idx.indexPct}%`,
                    centerLabel: 'INDEX',
                },
                workload: {
                    data: [
                        { name: 'Cache Hits', value: cacheHit, color: c, display: `${cacheHit}%` },
                        {
                            name: 'Cache Miss',
                            value: 100 - cacheHit,
                            color: THEME.danger,
                            display: `${100 - cacheHit}%`,
                        },
                    ],
                    centerValue: `${cacheHit}%`,
                    centerLabel: 'CACHE',
                },
                topTables: DB_SLOW_QUERIES[key] || DB_SLOW_QUERIES.postgresql,
                resources: [
                    {
                        label: 'Query Cache',
                        value: cacheHit,
                        icon: Zap,
                        status: st(cacheHit, 90, 70),
                        detail: `${planCached.toLocaleString()} plans cached`,
                    },
                    {
                        label: 'Avg Cost',
                        value: Math.min(Math.round(avgCost / 10), 100),
                        icon: Gauge,
                        status: st(Math.round(avgCost / 10), 60, 30),
                        detail: `${avgCost} cost units`,
                    },
                    {
                        label: 'Index Hit',
                        value: idx.indexPct,
                        icon: Database,
                        status: st(idx.indexPct, 95, 80),
                        detail: `${idx.indexPct}% of scans`,
                    },
                ],
                latencyData: mkTimeSeries('qry', [
                    { key: 'p50', base: 0.8, range: 20, div: 10 },
                    { key: 'p95', base: 5, range: 100, div: 10 },
                    { key: 'p99', base: 15, range: 300, div: 10 },
                ]),
                indexUsage: {
                    data: [
                        { name: 'Index Scans', value: idx.indexPct, color: THEME.success, display: `${idx.indexPct}%` },
                        {
                            name: key === 'mongodb' ? 'Coll Scans' : 'Seq Scans',
                            value: idx.seqPct,
                            color: THEME.warning,
                            display: `${idx.seqPct}%`,
                        },
                    ],
                    centerValue: `${idx.indexPct}%`,
                    centerLabel: 'INDEX',
                },
                slowQueries: DB_SLOW_QUERIES[key] || DB_SLOW_QUERIES.postgresql,
            };
        }
        case 'infra': {
            const bufferHit = 85 + (seed % 14);
            const walRate = 2 + (seed % 18);
            const checkpointAvg = 200 + (seed % 600);
            return {
                pool: {
                    data: [
                        { name: 'Active', value: conn.active, color: THEME.success, display: `${conn.active}` },
                        { name: 'Idle', value: conn.idle, color: `${c}40`, display: `${conn.idle}` },
                        { name: 'Reserved', value: conn.waiting, color: THEME.warning, display: `${conn.waiting}` },
                    ],
                    centerValue: `${conn.pct}%`,
                    centerLabel: 'POOL',
                },
                workload: {
                    data: [
                        { name: 'Buffer Hit', value: bufferHit, color: c, display: `${bufferHit}%` },
                        {
                            name: 'Disk Read',
                            value: 100 - bufferHit,
                            color: THEME.warning,
                            display: `${100 - bufferHit}%`,
                        },
                    ],
                    centerValue: `${bufferHit}%`,
                    centerLabel: 'BUFFER',
                },
                topTables: [
                    {
                        label: key === 'mongodb' ? 'WiredTiger' : 'Shared Buffers',
                        value: bufferHit,
                        display: `${bufferHit}% hit`,
                    },
                    { label: key === 'mongodb' ? 'Oplog' : 'WAL', value: walRate, display: `${walRate} MB/s` },
                    { label: 'Checkpoint Avg', value: checkpointAvg, display: `${checkpointAvg} ms` },
                    { label: key === 'mongodb' ? 'Journaling' : 'Archiving', value: 99, display: 'active' },
                    { label: 'Repl Lag Max', value: 488, display: repl[repl.length - 1]?.lag || '0 ms' },
                ],
                resources: [
                    {
                        label: 'Buffer Hit',
                        value: bufferHit,
                        icon: Layers,
                        status: st(bufferHit, 95, 80),
                        detail: `${bufferHit}% from cache`,
                    },
                    {
                        label: key === 'mongodb' ? 'Oplog Rate' : 'WAL Rate',
                        value: Math.min(walRate * 5, 100),
                        icon: Radio,
                        status: st(walRate * 5),
                        detail: `${walRate} MB/s throughput`,
                    },
                    {
                        label: 'Disk Latency',
                        value: res.disk,
                        icon: HardDrive,
                        status: st(res.disk),
                        detail: `${res.diskGB}`,
                    },
                ],
                latencyData: mkTimeSeries('inf', [
                    { key: 'p50', base: 0.3, range: 15, div: 10 },
                    { key: 'p95', base: 2, range: 50, div: 10 },
                    { key: 'p99', base: 8, range: 150, div: 10 },
                ]),
                connPool: {
                    data: [
                        { name: 'Active', value: conn.active, color: THEME.success, display: `${conn.active}` },
                        { name: 'Idle', value: conn.idle, color: `${c}40`, display: `${conn.idle}` },
                        { name: 'Reserved', value: conn.waiting, color: THEME.warning, display: `${conn.waiting}` },
                    ],
                    centerValue: `${conn.pct}%`,
                    centerLabel: 'POOL',
                },
                replication: repl,
            };
        }
        case 'schema': {
            const objLabel = key === 'mongodb' ? 'Collections' : 'Tables';
            const obj2 = key === 'mongodb' ? 'Indexes' : 'Views';
            const obj3 = key === 'mongodb' ? 'Validators' : 'Functions';
            const obj4 = key === 'mongodb' ? 'Change Streams' : 'Triggers';
            const securityScore = 75 + (seed % 24);
            const compliancePct = 80 + (seed % 19);
            return {
                pool: {
                    data: [
                        { name: objLabel, value: schema.tables, color: c, display: `${schema.tables}` },
                        { name: obj2, value: schema.views, color: THEME.success, display: `${schema.views}` },
                        {
                            name: obj3,
                            value: Math.max(schema.functions, 1),
                            color: THEME.warning,
                            display: `${schema.functions || 0}`,
                        },
                    ],
                    centerValue: `${schema.total}`,
                    centerLabel: 'OBJECTS',
                },
                workload: {
                    data: [
                        { name: 'Compliant', value: compliancePct, color: THEME.success, display: `${compliancePct}%` },
                        {
                            name: 'Non-compliant',
                            value: 100 - compliancePct,
                            color: THEME.danger,
                            display: `${100 - compliancePct}%`,
                        },
                    ],
                    centerValue: `${compliancePct}%`,
                    centerLabel: 'COMPLY',
                },
                topTables: [
                    { label: key === 'mongodb' ? 'users' : tables[0], value: 45, display: `${45 + (seed % 20)} GB` },
                    { label: key === 'mongodb' ? 'orders' : tables[1], value: 32, display: `${32 + (seed % 15)} GB` },
                    {
                        label: key === 'mongodb' ? 'analytics' : tables[2],
                        value: 21,
                        display: `${21 + (seed % 12)} GB`,
                    },
                    { label: key === 'mongodb' ? 'sessions' : tables[3], value: 15, display: `${15 + (seed % 8)} GB` },
                    { label: key === 'mongodb' ? 'products' : tables[4], value: 9, display: `${9 + (seed % 6)} GB` },
                ],
                resources: [
                    {
                        label: 'Security Score',
                        value: securityScore,
                        icon: Shield,
                        status: st(securityScore, 90, 70),
                        detail: `${securityScore}/100 rating`,
                    },
                    {
                        label: 'Compliance',
                        value: compliancePct,
                        icon: Lock,
                        status: st(compliancePct, 95, 80),
                        detail: `${compliancePct}% compliant`,
                    },
                    {
                        label: 'Audit Coverage',
                        value: 88 + (seed % 11),
                        icon: Eye,
                        status: st(88 + (seed % 11), 95, 80),
                        detail: `${users.total} users tracked`,
                    },
                ],
                latencyData: mkTimeSeries('sch', [
                    { key: 'p50', base: 1, range: 20, div: 10 },
                    { key: 'p95', base: 3, range: 40, div: 10 },
                    { key: 'p99', base: 8, range: 100, div: 10 },
                ]),
                distribution: {
                    data: [
                        { name: objLabel, value: schema.tables, color: c, display: `${schema.tables}` },
                        { name: obj2, value: schema.views, color: THEME.success, display: `${schema.views}` },
                        {
                            name: obj3,
                            value: schema.functions,
                            color: THEME.warning,
                            display: `${schema.functions || 0}`,
                        },
                        { name: obj4, value: schema.triggers, color: THEME.danger, display: `${schema.triggers || 0}` },
                    ].filter((d) => d.value > 0),
                    centerValue: `${schema.total}`,
                    centerLabel: 'OBJECTS',
                },
            };
        }
        case 'observability': {
            const traceRate = 2000 + (seed % 6000);
            const errorRate = seed % 5;
            const metricCount = 500 + (seed % 1500);
            return {
                pool: {
                    data: [
                        {
                            name: 'Healthy',
                            value: 100 - errorRate,
                            color: THEME.success,
                            display: `${100 - errorRate}%`,
                        },
                        {
                            name: 'Degraded',
                            value: Math.max(errorRate - 1, 0),
                            color: THEME.warning,
                            display: `${Math.max(errorRate - 1, 0)}%`,
                        },
                        {
                            name: 'Critical',
                            value: Math.min(errorRate, 2),
                            color: THEME.danger,
                            display: `${Math.min(errorRate, 2)}%`,
                        },
                    ],
                    centerValue: `${100 - errorRate}%`,
                    centerLabel: 'HEALTH',
                },
                workload: {
                    data: [
                        { name: 'Traces', value: 78, color: c, display: `${(traceRate / 1000).toFixed(1)}K/s` },
                        { name: 'Metrics', value: 22, color: THEME.success, display: `${metricCount}` },
                    ],
                    centerValue: `${(traceRate / 1000).toFixed(1)}K`,
                    centerLabel: 'TRACES/S',
                },
                topTables: alerts,
                resources: [
                    {
                        label: 'Trace Volume',
                        value: Math.min(Math.round(traceRate / 80), 100),
                        icon: Radio,
                        status: st(Math.round(traceRate / 80), 80, 50),
                        detail: `${traceRate.toLocaleString()} traces/s`,
                    },
                    {
                        label: 'Error Rate',
                        value: errorRate,
                        icon: AlertTriangle,
                        status: errorRate > 3 ? 'High' : errorRate > 1 ? 'Moderate' : 'Normal',
                        detail: `${(errorRate / 10).toFixed(2)}% of requests`,
                    },
                    {
                        label: 'Metric Coverage',
                        value: Math.min(Math.round(metricCount / 20), 100),
                        icon: Eye,
                        status: st(Math.round(metricCount / 20), 90, 70),
                        detail: `${metricCount} active metrics`,
                    },
                ],
                latencyData: mkTimeSeries('obs', [
                    { key: 'p50', base: 2000, range: 4000, div: 1 },
                    { key: 'p95', base: 0, range: 30, div: 1 },
                    { key: 'p99', base: 4, range: 120, div: 10 },
                ]),
                alertDist: alerts,
            };
        }
        case 'dev': {
            const apiSuccessRate = 95 + (seed % 5);
            const deployCount = 10 + (seed % 40);
            const base = key === 'mongodb' ? 900 : key === 'mysql' ? 500 : 400;
            return {
                pool: {
                    data: [
                        { name: 'Success', value: apiSuccessRate, color: THEME.success, display: `${apiSuccessRate}%` },
                        {
                            name: 'Errors',
                            value: 100 - apiSuccessRate,
                            color: THEME.danger,
                            display: `${100 - apiSuccessRate}%`,
                        },
                    ],
                    centerValue: `${apiSuccessRate}%`,
                    centerLabel: 'API',
                },
                workload: {
                    data: [
                        { name: 'Queries', value: 65, color: c, display: '65%' },
                        { name: 'Mutations', value: 25, color: THEME.warning, display: '25%' },
                        { name: 'Admin Ops', value: 10, color: THEME.success, display: '10%' },
                    ],
                    centerValue: '65%',
                    centerLabel: 'QUERIES',
                },
                topTables: [
                    { label: 'Deployments/week', value: deployCount, display: `${deployCount}` },
                    { label: 'Open PRs', value: 8 + (seed % 15), display: `${8 + (seed % 15)}` },
                    { label: 'API Latency P99', value: 150 + (seed % 200), display: `${150 + (seed % 200)} ms` },
                    { label: 'Test Coverage', value: 70 + (seed % 25), display: `${70 + (seed % 25)}%` },
                    { label: 'Query Optimizations', value: 5 + (seed % 20), display: `${5 + (seed % 20)}/week` },
                ],
                resources: [
                    {
                        label: 'API Uptime',
                        value: apiSuccessRate,
                        icon: Globe,
                        status: st(apiSuccessRate, 99, 95),
                        detail: `${apiSuccessRate}% success rate`,
                    },
                    {
                        label: 'Deploy Freq',
                        value: Math.min(deployCount * 2, 100),
                        icon: Zap,
                        status: st(deployCount * 2, 80, 40),
                        detail: `${deployCount} deploys/week`,
                    },
                    {
                        label: 'Query Perf',
                        value: 85 + (seed % 12),
                        icon: Activity,
                        status: st(85 + (seed % 12), 95, 80),
                        detail: 'avg 2.1ms response',
                    },
                ],
                latencyData: mkTimeSeries('dev', [
                    { key: 'p50', base: 1, range: 30, div: 10 },
                    { key: 'p95', base: 6, range: 80, div: 10 },
                    { key: 'p99', base: 15, range: 250, div: 10 },
                ]),
                opsData: Array.from({ length: 8 }, (_, i) => {
                    const s = hashSeed(key + 'ops' + i);
                    return {
                        time: `${String((i + 1) * 3).padStart(2, '0')}:00`,
                        reads: base + (s % (base / 2)),
                        writes: Math.round(base * 0.2) + (s % Math.round(base * 0.3)),
                    };
                }),
            };
        }
        case 'admin': {
            const backupHealth = 90 + (seed % 10);
            const taskSuccess = 95 + (seed % 5);
            return {
                pool: {
                    data: [
                        { name: 'Admin', value: users.admin, color: THEME.danger, display: `${users.admin}` },
                        { name: 'Developer', value: users.dev, color: c, display: `${users.dev}` },
                        {
                            name: 'Read-only',
                            value: users.readonly,
                            color: THEME.success,
                            display: `${users.readonly}`,
                        },
                    ],
                    centerValue: `${users.total}`,
                    centerLabel: 'USERS',
                },
                workload: {
                    data: [
                        { name: 'Automated', value: 72, color: c, display: '72%' },
                        { name: 'Manual', value: 28, color: THEME.warning, display: '28%' },
                    ],
                    centerValue: '72%',
                    centerLabel: 'AUTO',
                },
                topTables: [
                    { label: 'Scheduled Tasks', value: 34 + (seed % 20), display: `${34 + (seed % 20)} active` },
                    { label: 'Backup Success', value: backupHealth, display: `${backupHealth}%` },
                    { label: 'Config Changes/day', value: 5 + (seed % 15), display: `${5 + (seed % 15)}` },
                    { label: 'Retention Policies', value: 8 + (seed % 10), display: `${8 + (seed % 10)} active` },
                    { label: 'Custom Dashboards', value: 10 + (seed % 15), display: `${10 + (seed % 15)}` },
                ],
                resources: [
                    {
                        label: 'Backup Health',
                        value: backupHealth,
                        icon: HardDrive,
                        status: st(backupHealth, 95, 85),
                        detail: `Last: ${(seed % 4) + 1}h ago`,
                    },
                    {
                        label: 'Task Success',
                        value: taskSuccess,
                        icon: CheckCircle,
                        status: st(taskSuccess, 99, 95),
                        detail: `${taskSuccess}% success rate`,
                    },
                    {
                        label: 'System Load',
                        value: res.cpu,
                        icon: Cpu,
                        status: st(res.cpu),
                        detail: `${res.cpuCores} cores available`,
                    },
                ],
                latencyData: mkTimeSeries('adm', [
                    { key: 'p50', base: 0.5, range: 15, div: 10 },
                    { key: 'p95', base: 3, range: 50, div: 10 },
                    { key: 'p99', base: 10, range: 150, div: 10 },
                ]),
                userDist: {
                    data: [
                        { name: 'Admin', value: users.admin, color: THEME.danger, display: `${users.admin}` },
                        { name: 'Developer', value: users.dev, color: c, display: `${users.dev}` },
                        {
                            name: 'Read-only',
                            value: users.readonly,
                            color: THEME.success,
                            display: `${users.readonly}`,
                        },
                        { name: 'Service', value: users.service, color: THEME.warning, display: `${users.service}` },
                    ],
                    centerValue: `${users.total}`,
                    centerLabel: 'USERS',
                },
            };
        }
        default:
            return {};
    }
}

/* MongoDB/MySQL/MSSQL/Oracle use generic section IDs mapped to their structures */
function mapSectionToWidgetId(sectionId) {
    const mapping = {
        overview: 'core',
        performance: 'query',
        storage: 'infra',
        data: 'schema',
        intelligence: 'observability',
        replication: 'infra',
        management: 'admin',
    };
    return mapping[sectionId] || sectionId;
}

/* ── Reusable demo table component ── */
function DemoTable({ columns, rows, color }) {
    return (
        <div style={{ overflowX: 'auto', maxHeight: 300, overflowY: 'auto' }}>
            <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
                <thead>
                    <tr style={{ borderBottom: `1px solid ${THEME.glassBorder}` }}>
                        {columns.map((col, idx) => (
                            <th
                                key={idx}
                                style={{
                                    padding: '20px 24px',
                                    textAlign: 'left',
                                    fontWeight: 600,
                                    color: THEME.textMuted,
                                    fontSize: 10,

                                    letterSpacing: '0.02em',
                                    width: col.width,
                                }}
                            >
                                {col.label}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, rIdx) => (
                        <tr key={rIdx} style={{ borderBottom: `1px solid ${THEME.glassBorder}` }}>
                            {columns.map((col, cIdx) => (
                                <td
                                    key={cIdx}
                                    style={{
                                        padding: '20px 24px',
                                        color: THEME.textMain,
                                        borderBottom: `1px solid ${THEME.glassBorder}`,
                                    }}
                                >
                                    {row[col.key]}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

/* ── Code block component for SQL/preview ── */
function CodeBlock({ code, color }) {
    const lines = code.split('\n');
    return (
        <div
            style={{
                background: THEME.surface,
                border: `1px solid ${THEME.glassBorder}`,
                borderRadius: 20,
                padding: '12px 0',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 10,
                color: THEME.textDim,
                overflowX: 'auto',
                maxHeight: 180,
                overflowY: 'auto',
            }}
        >
            {lines.map((line, idx) => (
                <div key={idx} style={{ display: 'flex', lineHeight: '1.5' }}>
                    <span
                        style={{
                            color: THEME.textMuted,
                            paddingRight: 12,
                            paddingLeft: 8,
                            minWidth: 30,
                            textAlign: 'right',
                            userSelect: 'none',
                        }}
                    >
                        {idx + 1}
                    </span>
                    <span style={{ paddingRight: 8, whiteSpace: 'pre' }}>{line || ' '}</span>
                </div>
            ))}
        </div>
    );
}

/* ── Severity/status badge for tables ── */
function SeverityBadge({ label, severity }) {
    const severityColors = {
        success: THEME.success,
        warning: THEME.warning,
        danger: THEME.danger,
        info: THEME.primary,
    };
    const color = severityColors[severity] || THEME.textMuted;
    return (
        <span
            style={{
                display: 'inline-block',
                padding: '2px 6px',
                borderRadius: 16,
                background: `${color}20`,
                color: color,
                fontSize: 9,
                fontWeight: 600,
            }}
        >
            {label}
        </span>
    );
}

/* ── Render section-specific content based on widgetId ── */
function SectionContent({ section, db }) {
    const widgetId = mapSectionToWidgetId(section.id);
    const sw = getSectionWidgets(widgetId, db);
    const dbName = db.name.toLowerCase().replace(' ', '');
    const key = dbName;

    // Section header
    const headerNode = (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: 18,
                marginBottom: 16,
                paddingLeft: 16,
                borderLeft: `4px solid ${db.color}`,
            }}
        >
            <h2 style={{ margin: 0, fontSize: 12, fontWeight: 700, color: THEME.textMuted, letterSpacing: '0.02em' }}>
                {section.name}
            </h2>
            <StatusBadge label={`${section.tabs.length} tabs`} color={db.color} />
        </div>
    );

    // Core section — keep existing layout
    const coreSection = sw.pool && sw.workload && (
        <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, marginBottom: 16 }}>
                <Panel title="Connection Pool" icon={Layers} accentColor={db.color}>
                    <DonutWidget {...sw.pool} color={db.color} size={100} innerRadius={34} outerRadius={46} />
                </Panel>
                <Panel title="Workload Split" icon={BarChart3} accentColor={db.color}>
                    <DonutWidget {...sw.workload} color={db.color} size={100} innerRadius={34} outerRadius={46} />
                </Panel>
                <Panel title="Top Impacted Tables" icon={Database} accentColor={db.color}>
                    <HorizontalBarList items={sw.topTables} color={db.color} />
                </Panel>
            </div>

            {sw.resources && (
                <div style={{ marginBottom: 16 }}>
                    <ResourceGaugeRow resources={sw.resources} color={db.color} />
                </div>
            )}

            {sw.latencyData && sw.pool && (
                <div style={{ marginBottom: 16 }}>
                    <Panel
                        title="Transaction Latency Percentiles"
                        icon={Activity}
                        accentColor={db.color}
                        rightNode={
                            <div style={{ display: 'flex', gap: 22 }}>
                                <span style={{ fontSize: 9, display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <span style={{ width: 8, height: 3, background: THEME.success, borderRadius: 1 }} />
                                    P50
                                </span>
                                <span style={{ fontSize: 9, display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <span style={{ width: 8, height: 3, background: THEME.warning, borderRadius: 1 }} />
                                    P95
                                </span>
                                <span style={{ fontSize: 9, display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <span style={{ width: 8, height: 3, background: THEME.danger, borderRadius: 1 }} />
                                    P99
                                </span>
                            </div>
                        }
                    >
                        <MultiLineChartWidget
                            data={sw.latencyData}
                            lines={[
                                { key: 'p50', color: THEME.success },
                                { key: 'p95', color: THEME.warning, dashed: true },
                                { key: 'p99', color: THEME.danger, dashed: true },
                            ]}
                            color={db.color}
                        />
                    </Panel>
                </div>
            )}
        </div>
    );

    // Query section — SQL editor + slow queries table + index health
    const querySection = (
        <div>
            <div style={{ marginBottom: 16 }}>
                <Panel title="Query Analysis" icon={Code} accentColor={db.color}>
                    <CodeBlock
                        code={`SELECT o.order_id, o.created_at, COUNT(*) as items\nFROM orders o\nJOIN order_items oi ON o.order_id = oi.order_id\nWHERE o.created_at > NOW() - INTERVAL '7 days'\nGROUP BY o.order_id, o.created_at\nHAVING COUNT(*) > 5\nORDER BY items DESC LIMIT 100`}
                        color={db.color}
                    />
                </Panel>
            </div>

            <div style={{ marginBottom: 16 }}>
                <Panel title="Slow Queries" icon={Clock} accentColor={THEME.warning}>
                    <DemoTable
                        columns={[
                            { key: 'query', label: 'Query', width: '50%' },
                            { key: 'avgDuration', label: 'Avg Duration', width: '25%' },
                            { key: 'calls', label: 'Calls', width: '25%' },
                        ]}
                        rows={DB_SLOW_QUERIES[key].slice(0, 3).map((q) => ({
                            query: q.label.substring(0, 40) + '...',
                            avgDuration: q.display,
                            calls: Math.floor(Math.random() * 1000 + 100),
                        }))}
                        color={db.color}
                    />
                </Panel>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 16 }}>
                <Panel title="Index Usage" icon={Gauge} accentColor={db.color}>
                    <DonutWidget
                        data={[
                            {
                                name: 'Index Scan',
                                value: DB_INDEX_STATS[key].indexPct,
                                color: THEME.success,
                                display: `${DB_INDEX_STATS[key].indexPct}%`,
                            },
                            {
                                name: 'Seq Scan',
                                value: DB_INDEX_STATS[key].seqPct,
                                color: THEME.warning,
                                display: `${DB_INDEX_STATS[key].seqPct}%`,
                            },
                        ]}
                        centerValue={`${DB_INDEX_STATS[key].indexPct}%`}
                        centerLabel="INDEX"
                        color={THEME.success}
                        size={100}
                        innerRadius={34}
                        outerRadius={46}
                    />
                </Panel>
                <Panel title="Index Health" icon={BarChart3} accentColor={db.color}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 11, color: THEME.textMuted }}>Hit Ratio</span>
                            <span style={{ fontSize: 12, fontWeight: 700, color: THEME.success }}>
                                {DB_INDEX_STATS[key].indexPct}%
                            </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 11, color: THEME.textMuted }}>Seq Scan Rate</span>
                            <span style={{ fontSize: 12, fontWeight: 700, color: THEME.warning }}>
                                {DB_INDEX_STATS[key].seqPct}%
                            </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 11, color: THEME.textMuted }}>Total Indexes</span>
                            <span style={{ fontSize: 12, fontWeight: 700, color: db.color }}>342</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 11, color: THEME.textMuted }}>Unused</span>
                            <SeverityBadge label="23" severity="warning" />
                        </div>
                    </div>
                </Panel>
            </div>
        </div>
    );

    // Infrastructure section — KPI row + connection pool donut + replication + connection list
    const infraSection = (
        <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, marginBottom: 16 }}>
                <Panel title="Buffer Hit Rate" icon={Zap} accentColor={db.color} noPad>
                    <div style={{ padding: 16, textAlign: 'center' }}>
                        <div style={{ fontSize: 28, fontWeight: 700, color: THEME.success }}>99.2%</div>
                        <div style={{ fontSize: 10, color: THEME.textMuted, marginTop: 4 }}>Cache Efficiency</div>
                    </div>
                </Panel>
                <Panel title="WAL Rate" icon={Activity} accentColor={db.color} noPad>
                    <div style={{ padding: 16, textAlign: 'center' }}>
                        <div style={{ fontSize: 28, fontWeight: 700, color: db.color }}>24.6 MB/s</div>
                        <div style={{ fontSize: 10, color: THEME.textMuted, marginTop: 4 }}>Current</div>
                    </div>
                </Panel>
                <Panel title="Replication Lag" icon={Network} accentColor={db.color} noPad>
                    <div style={{ padding: 16, textAlign: 'center' }}>
                        <div style={{ fontSize: 28, fontWeight: 700, color: THEME.success }}>0.3 ms</div>
                        <div style={{ fontSize: 10, color: THEME.textMuted, marginTop: 4 }}>Primary</div>
                    </div>
                </Panel>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 20, marginBottom: 16 }}>
                <Panel title="Connection Pool" icon={Layers} accentColor={db.color}>
                    <DonutWidget {...sw.pool} color={db.color} size={100} innerRadius={34} outerRadius={46} />
                </Panel>
                <Panel title="Replication Topology" icon={GitBranch} accentColor={db.color}>
                    <ReplicationTopology nodes={sw.replication} color={db.color} />
                </Panel>
            </div>

            <div style={{ marginBottom: 16 }}>
                <Panel title="Connection List" icon={Network} accentColor={db.color}>
                    <DemoTable
                        columns={[
                            { key: 'name', label: 'Name', width: '25%' },
                            { key: 'host', label: 'Host', width: '25%' },
                            { key: 'status', label: 'Status', width: '20%' },
                            { key: 'poolSize', label: 'Pool Size', width: '15%' },
                            { key: 'active', label: 'Active', width: '15%' },
                        ]}
                        rows={[
                            {
                                name: 'primary',
                                host: 'db-1.internal',
                                status: <SeverityBadge label="active" severity="success" />,
                                poolSize: '100',
                                active: '42',
                            },
                            {
                                name: 'replica-1',
                                host: 'db-2.internal',
                                status: <SeverityBadge label="synced" severity="success" />,
                                poolSize: '50',
                                active: '8',
                            },
                            {
                                name: 'replica-2',
                                host: 'db-3.internal',
                                status: <SeverityBadge label="synced" severity="success" />,
                                poolSize: '50',
                                active: '12',
                            },
                            {
                                name: 'standby',
                                host: 'db-4.internal',
                                status: <SeverityBadge label="idle" severity="info" />,
                                poolSize: '25',
                                active: '0',
                            },
                        ]}
                        color={db.color}
                    />
                </Panel>
            </div>
        </div>
    );

    // Schema section — compliance score + schema objects donut + schema changes table
    const schemaSection = (
        <div>
            <div style={{ marginBottom: 16 }}>
                <Panel title="Compliance Score" icon={Shield} accentColor={db.color} noPad>
                    <div style={{ padding: 16 }}>
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                marginBottom: 12,
                            }}
                        >
                            <div>
                                <div style={{ fontSize: 32, fontWeight: 700, color: THEME.success }}>88%</div>
                                <div style={{ fontSize: 10, color: THEME.textMuted, marginTop: 4 }}>
                                    Overall Compliance
                                </div>
                            </div>
                        </div>
                        <div style={{ height: 4, background: THEME.glassBorder, borderRadius: 2, overflow: 'hidden' }}>
                            <div style={{ height: '100%', background: THEME.success, width: '88%' }} />
                        </div>
                    </div>
                </Panel>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 16 }}>
                <Panel title="Schema Objects" icon={Layers} accentColor={db.color}>
                    <DonutWidget
                        data={[
                            {
                                name: 'Tables',
                                value: DB_SCHEMA_OBJECTS[key].tables,
                                color: db.color,
                                display: `${DB_SCHEMA_OBJECTS[key].tables}`,
                            },
                            {
                                name: 'Views',
                                value: DB_SCHEMA_OBJECTS[key].views,
                                color: THEME.success,
                                display: `${DB_SCHEMA_OBJECTS[key].views}`,
                            },
                            {
                                name: 'Functions',
                                value: DB_SCHEMA_OBJECTS[key].functions,
                                color: THEME.warning,
                                display: `${DB_SCHEMA_OBJECTS[key].functions}`,
                            },
                        ]}
                        centerValue={`${DB_SCHEMA_OBJECTS[key].total}`}
                        centerLabel="OBJECTS"
                        color={db.color}
                        size={100}
                        innerRadius={34}
                        outerRadius={46}
                    />
                </Panel>
                <Panel title="Schema Changes" icon={Activity} accentColor={db.color}>
                    <DemoTable
                        columns={[
                            { key: 'migration', label: 'Migration', width: '40%' },
                            { key: 'timestamp', label: 'Timestamp', width: '35%' },
                            { key: 'status', label: 'Status', width: '25%' },
                        ]}
                        rows={[
                            {
                                migration: 'v2.3.1_add_indexes',
                                timestamp: '2h ago',
                                status: <SeverityBadge label="applied" severity="success" />,
                            },
                            {
                                migration: 'v2.3.0_schema_ext',
                                timestamp: '1d ago',
                                status: <SeverityBadge label="applied" severity="success" />,
                            },
                            {
                                migration: 'v2.2.9_rollback',
                                timestamp: '3d ago',
                                status: <SeverityBadge label="applied" severity="success" />,
                            },
                        ]}
                        color={db.color}
                    />
                </Panel>
            </div>

            <div style={{ marginBottom: 16 }}>
                <Panel title="Audit Log" icon={Eye} accentColor={db.color}>
                    <DemoTable
                        columns={[
                            { key: 'user', label: 'User', width: '20%' },
                            { key: 'action', label: 'Action', width: '25%' },
                            { key: 'timestamp', label: 'Timestamp', width: '25%' },
                            { key: 'target', label: 'Target', width: '30%' },
                        ]}
                        rows={[
                            { user: 'admin', action: 'CREATE TABLE', timestamp: '2h ago', target: 'events_backup' },
                            {
                                user: 'dev_user',
                                action: 'DROP INDEX',
                                timestamp: '4h ago',
                                target: 'orders.idx_status',
                            },
                            { user: 'admin', action: 'GRANT', timestamp: '1d ago', target: 'readonly_role' },
                        ]}
                        color={db.color}
                    />
                </Panel>
            </div>
        </div>
    );

    // Observability section — metric cards with sparklines + active alerts + log patterns
    const observabilitySection = (
        <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, marginBottom: 16 }}>
                <Panel title="Trace Volume" icon={Activity} accentColor={db.color} noPad>
                    <div style={{ padding: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                                <div style={{ fontSize: 20, fontWeight: 700, color: db.color }}>4.5K</div>
                                <div style={{ fontSize: 9, color: THEME.textMuted, marginTop: 2 }}>traces/sec</div>
                            </div>
                            <MiniSparkline
                                data={[2000, 3500, 4200, 4100, 4500, 4200, 4600]}
                                color={db.color}
                                width={44}
                                height={16}
                            />
                        </div>
                    </div>
                </Panel>
                <Panel title="Error Rate" icon={AlertTriangle} accentColor={THEME.danger} noPad>
                    <div style={{ padding: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                                <div style={{ fontSize: 20, fontWeight: 700, color: THEME.success }}>0.02%</div>
                                <div style={{ fontSize: 9, color: THEME.textMuted, marginTop: 2 }}>of requests</div>
                            </div>
                            <MiniSparkline
                                data={[0.05, 0.04, 0.03, 0.02, 0.02, 0.03, 0.02]}
                                color={THEME.success}
                                width={44}
                                height={16}
                            />
                        </div>
                    </div>
                </Panel>
                <Panel title="Alert Count" icon={AlertTriangle} accentColor={THEME.warning} noPad>
                    <div style={{ padding: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                                <div style={{ fontSize: 20, fontWeight: 700, color: THEME.warning }}>3</div>
                                <div style={{ fontSize: 9, color: THEME.textMuted, marginTop: 2 }}>active alerts</div>
                            </div>
                            <MiniSparkline data={[0, 1, 2, 2, 3, 3, 3]} color={THEME.warning} width={44} height={16} />
                        </div>
                    </div>
                </Panel>
            </div>

            <div style={{ marginBottom: 16 }}>
                <Panel title="Active Alerts" icon={AlertTriangle} accentColor={THEME.warning}>
                    <DemoTable
                        columns={[
                            { key: 'severity', label: 'Severity', width: '20%' },
                            { key: 'message', label: 'Message', width: '40%' },
                            { key: 'timestamp', label: 'Timestamp', width: '25%' },
                            { key: 'status', label: 'Status', width: '15%' },
                        ]}
                        rows={[
                            {
                                severity: <SeverityBadge label="warning" severity="warning" />,
                                message: 'High CPU usage',
                                timestamp: '12m ago',
                                status: 'firing',
                            },
                            {
                                severity: <SeverityBadge label="info" severity="info" />,
                                message: 'Checkpoint running',
                                timestamp: '1h ago',
                                status: 'resolved',
                            },
                            {
                                severity: <SeverityBadge label="info" severity="info" />,
                                message: 'Autovacuum active',
                                timestamp: '2h ago',
                                status: 'resolved',
                            },
                        ]}
                        color={db.color}
                    />
                </Panel>
            </div>

            <div style={{ marginBottom: 16 }}>
                <Panel title="Log Patterns" icon={Eye} accentColor={db.color}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                        {[
                            { pattern: 'connection timeout', count: 24, trend: [5, 8, 12, 15, 18, 22, 24] },
                            { pattern: 'query slow', count: 156, trend: [120, 128, 135, 142, 150, 153, 156] },
                            { pattern: 'index scan full table', count: 89, trend: [45, 52, 61, 70, 78, 84, 89] },
                        ].map((entry, idx) => (
                            <div
                                key={idx}
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    paddingBottom: 12,
                                    borderBottom: `1px solid ${THEME.glassBorder}`,
                                }}
                            >
                                <div>
                                    <div
                                        style={{
                                            fontSize: 11,
                                            color: THEME.textMain,
                                            fontFamily: "'JetBrains Mono',monospace",
                                        }}
                                    >
                                        {entry.pattern}
                                    </div>
                                    <div style={{ fontSize: 9, color: THEME.textMuted, marginTop: 2 }}>
                                        Count: {entry.count}
                                    </div>
                                </div>
                                <MiniSparkline data={entry.trend} color={db.color} width={50} height={20} />
                            </div>
                        ))}
                    </div>
                </Panel>
            </div>
        </div>
    );

    // Developer tools section — SQL console + API endpoints + recent queries
    const devSection = (
        <div>
            <div style={{ marginBottom: 16 }}>
                <Panel title="SQL Console" icon={Code} accentColor={db.color}>
                    <CodeBlock
                        code={`-- Find top performing queries\nSELECT query_id, total_time, calls, mean_time\nFROM pg_stat_statements\nORDER BY mean_time DESC\nLIMIT 10;`}
                        color={db.color}
                    />
                </Panel>
            </div>

            <div style={{ marginBottom: 16 }}>
                <Panel title="API Endpoints" icon={Globe} accentColor={db.color}>
                    <DemoTable
                        columns={[
                            { key: 'method', label: 'Method', width: '15%' },
                            { key: 'path', label: 'Path', width: '40%' },
                            { key: 'avgResponse', label: 'Avg Response', width: '25%' },
                            { key: 'callsHr', label: 'Calls/hr', width: '20%' },
                        ]}
                        rows={[
                            {
                                method: <span style={{ color: THEME.success, fontWeight: 600 }}>GET</span>,
                                path: '/api/orders',
                                avgResponse: '12.3ms',
                                callsHr: '8.2K',
                            },
                            {
                                method: <span style={{ color: THEME.warning, fontWeight: 600 }}>POST</span>,
                                path: '/api/orders',
                                avgResponse: '45.2ms',
                                callsHr: '2.1K',
                            },
                            {
                                method: <span style={{ color: THEME.success, fontWeight: 600 }}>GET</span>,
                                path: '/api/users',
                                avgResponse: '8.5ms',
                                callsHr: '15.4K',
                            },
                            {
                                method: <span style={{ color: db.color, fontWeight: 600 }}>PUT</span>,
                                path: '/api/users/:id',
                                avgResponse: '32.1ms',
                                callsHr: '1.2K',
                            },
                        ]}
                        color={db.color}
                    />
                </Panel>
            </div>

            <div style={{ marginBottom: 16 }}>
                <Panel title="Recent Queries" icon={Activity} accentColor={db.color}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                        {[
                            { sql: 'SELECT * FROM orders WHERE...', timestamp: '2m ago', duration: '23.4ms' },
                            { sql: 'UPDATE inventory SET qty...', timestamp: '5m ago', duration: '108.2ms' },
                            { sql: 'DELETE FROM audit_log WHERE...', timestamp: '12m ago', duration: '2.1s' },
                        ].map((q, idx) => (
                            <div key={idx} style={{ borderLeft: `3px solid ${db.color}`, paddingLeft: 12 }}>
                                <div
                                    style={{
                                        fontSize: 10,
                                        color: THEME.textMain,
                                        fontFamily: "'JetBrains Mono',monospace",
                                    }}
                                >
                                    {q.sql}
                                </div>
                                <div
                                    style={{
                                        fontSize: 9,
                                        color: THEME.textMuted,
                                        marginTop: 4,
                                        display: 'flex',
                                        gap: 18,
                                    }}
                                >
                                    <span>{q.timestamp}</span>
                                    <span style={{ color: db.color }}>{q.duration}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </Panel>
            </div>
        </div>
    );

    // Admin section — users table + backup schedule + scheduled tasks + user distribution
    const adminSection = (
        <div>
            <div style={{ marginBottom: 16 }}>
                <Panel title="Users & Roles" icon={Shield} accentColor={db.color}>
                    <DemoTable
                        columns={[
                            { key: 'username', label: 'Username', width: '25%' },
                            { key: 'role', label: 'Role', width: '20%' },
                            { key: 'lastLogin', label: 'Last Login', width: '25%' },
                            { key: 'status', label: 'Status', width: '30%' },
                        ]}
                        rows={[
                            {
                                username: 'admin',
                                role: <SeverityBadge label="admin" severity="danger" />,
                                lastLogin: '1h ago',
                                status: <SeverityBadge label="active" severity="success" />,
                            },
                            {
                                username: 'dev_user',
                                role: <SeverityBadge label="developer" severity="info" />,
                                lastLogin: '4m ago',
                                status: <SeverityBadge label="active" severity="success" />,
                            },
                            {
                                username: 'readonly',
                                role: <SeverityBadge label="read-only" severity="info" />,
                                lastLogin: '1d ago',
                                status: <SeverityBadge label="idle" severity="info" />,
                            },
                            {
                                username: 'api_service',
                                role: <SeverityBadge label="service" severity="warning" />,
                                lastLogin: '5m ago',
                                status: <SeverityBadge label="active" severity="success" />,
                            },
                        ]}
                        color={db.color}
                    />
                </Panel>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 16 }}>
                <Panel title="Backup Schedule" icon={HardDrive} accentColor={db.color}>
                    <DemoTable
                        columns={[
                            { key: 'name', label: 'Name', width: '30%' },
                            { key: 'schedule', label: 'Schedule', width: '30%' },
                            { key: 'lastRun', label: 'Last Run', width: '25%' },
                            { key: 'status', label: 'Status', width: '15%' },
                        ]}
                        rows={[
                            {
                                name: 'daily-full',
                                schedule: 'Daily 2AM',
                                lastRun: '1h ago',
                                status: <SeverityBadge label="ok" severity="success" />,
                            },
                            {
                                name: 'hourly-inc',
                                schedule: 'Every hour',
                                lastRun: '12m ago',
                                status: <SeverityBadge label="ok" severity="success" />,
                            },
                            {
                                name: 'weekly-arch',
                                schedule: 'Sun 3AM',
                                lastRun: '2d ago',
                                status: <SeverityBadge label="ok" severity="success" />,
                            },
                        ]}
                        color={db.color}
                    />
                </Panel>
                <Panel title="Scheduled Tasks" icon={Activity} accentColor={db.color}>
                    <DemoTable
                        columns={[
                            { key: 'task', label: 'Task', width: '35%' },
                            { key: 'interval', label: 'Interval', width: '30%' },
                            { key: 'nextRun', label: 'Next Run', width: '35%' },
                        ]}
                        rows={[
                            { task: 'autovacuum', interval: 'Continuous', nextRun: 'Active' },
                            { task: 'analyze', interval: '3 hours', nextRun: '42m' },
                            { task: 'reindex', interval: 'Daily', nextRun: '18h' },
                            { task: 'stats_check', interval: '15 min', nextRun: '3m' },
                        ]}
                        color={db.color}
                    />
                </Panel>
            </div>

            <div style={{ marginBottom: 16 }}>
                <Panel title="User Distribution" icon={Shield} accentColor={db.color}>
                    <DonutWidget {...sw.userDist} color={db.color} size={110} innerRadius={38} outerRadius={50} />
                </Panel>
            </div>
        </div>
    );

    // Determine which section to render
    let middleContent;
    switch (widgetId) {
        case 'core':
            middleContent = coreSection;
            break;
        case 'query':
            middleContent = querySection;
            break;
        case 'infra':
            middleContent = infraSection;
            break;
        case 'schema':
            middleContent = schemaSection;
            break;
        case 'observability':
            middleContent = observabilitySection;
            break;
        case 'dev':
            middleContent = devSection;
            break;
        case 'admin':
            middleContent = adminSection;
            break;
        default:
            middleContent = coreSection;
    }

    return (
        <div>
            {headerNode}
            {middleContent}

            <div
                className="demo-stagger"
                style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 20 }}
            >
                {section.tabs.map((tab, idx) => (
                    <div
                        key={idx}
                        style={{
                            background: THEME.surface,
                            border: `1px solid ${THEME.glassBorder}`,
                            borderRadius: 16,
                            padding: '18px 22px',
                            position: 'relative',
                            overflow: 'hidden',
                            transition: 'all 0.25s cubic-bezier(0.4,0,0.2,1)',
                            cursor: 'default',
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-3px)';
                            e.currentTarget.style.borderColor = db.color;
                            e.currentTarget.style.boxShadow = `0 8px 24px ${db.color}20`;
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.borderColor = THEME.glassBorder;
                            e.currentTarget.style.boxShadow = 'none';
                        }}
                    >
                        <div className="demo-card-shine" />
                        <div
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                height: 3,
                                background: `linear-gradient(90deg, ${db.color}, transparent)`,
                                opacity: 0.6,
                            }}
                        />
                        <h3 style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 700, color: THEME.textMain }}>
                            {tab.name}
                        </h3>
                        {tab.metrics.map((m, mIdx) => (
                            <div
                                key={mIdx}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    marginBottom: mIdx < tab.metrics.length - 1 ? 10 : 0,
                                }}
                            >
                                <span style={{ fontSize: 11.5, color: THEME.textMuted }}>{m.label}</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span
                                        style={{
                                            fontSize: 13,
                                            fontWeight: 700,
                                            color: db.color,
                                            fontFamily: "'JetBrains Mono',monospace",
                                        }}
                                    >
                                        {m.value}
                                    </span>
                                    <span style={{ fontSize: 10, color: THEME.textDim }}>{m.unit}</span>
                                    <MiniSparkline
                                        data={genSparkData(`${tab.name}-${m.label}`)}
                                        color={db.color}
                                        width={44}
                                        height={14}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                ))}
            </div>

            <div style={{ marginTop: 16 }}>
                <Panel
                    title={`${section.name} Activity`}
                    icon={Activity}
                    accentColor={db.color}
                    rightNode={<StatusBadge label="DEMO" color={db.color} pulse />}
                >
                    <div style={{ height: 180 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart
                                data={genVelocityData(section.name)}
                                margin={{ top: 8, right: 8, bottom: 0, left: -16 }}
                            >
                                <defs>
                                    <linearGradient id={`dg1-${section.id}`} x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor={db.color} stopOpacity={0.35} />
                                        <stop offset="100%" stopColor={db.color} stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id={`dg2-${section.id}`} x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor={db.color} stopOpacity={0.15} />
                                        <stop offset="100%" stopColor={db.color} stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid stroke={THEME.glassBorder} strokeDasharray="3 3" vertical={false} />
                                <XAxis
                                    dataKey="time"
                                    tick={{ fontSize: 9.5, fill: THEME.textDim }}
                                    axisLine={false}
                                    tickLine={false}
                                    interval={4}
                                />
                                <YAxis
                                    tick={{ fontSize: 9.5, fill: THEME.textDim }}
                                    axisLine={false}
                                    tickLine={false}
                                    width={36}
                                />
                                <Tooltip />
                                <Area
                                    type="monotone"
                                    dataKey="primary"
                                    stroke={db.color}
                                    strokeWidth={2}
                                    fill={`url(#dg1-${section.id})`}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="secondary"
                                    stroke={db.color}
                                    strokeWidth={1}
                                    fill={`url(#dg2-${section.id})`}
                                    strokeDasharray="5 3"
                                    strokeOpacity={0.5}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </Panel>
            </div>
        </div>
    );
}

/* ── Helper: shared backup/txn/maintenance panels ── */
function OverviewPanels({ widgets, db }) {
    return (
        <div className="demo-stagger" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
            <Panel title="Last Backup" icon={HardDrive} accentColor={THEME.success}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 11, color: THEME.textMuted }}>Completed</span>
                        <span
                            style={{
                                fontSize: 12,
                                fontWeight: 700,
                                color: THEME.textMain,
                                fontFamily: "'JetBrains Mono',monospace",
                            }}
                        >
                            {widgets.backup.time}
                        </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 11, color: THEME.textMuted }}>Size</span>
                        <span
                            style={{
                                fontSize: 12,
                                fontWeight: 700,
                                color: THEME.textMain,
                                fontFamily: "'JetBrains Mono',monospace",
                            }}
                        >
                            {widgets.backup.size}
                        </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 11, color: THEME.textMuted }}>Duration</span>
                        <span
                            style={{
                                fontSize: 12,
                                fontWeight: 700,
                                color: THEME.textMain,
                                fontFamily: "'JetBrains Mono',monospace",
                            }}
                        >
                            {widgets.backup.duration}
                        </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 11, color: THEME.textMuted }}>Verified</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            {widgets.backup.verified && <CheckCircle size={12} color={THEME.success} />}
                            <span style={{ fontSize: 11, color: THEME.success, fontWeight: 600 }}>Yes</span>
                        </div>
                    </div>
                    <div style={{ borderTop: `1px solid ${THEME.glassBorder}`, paddingTop: 8, marginTop: 8 }}>
                        <div style={{ fontSize: 10, color: THEME.textDim }}>Next: {widgets.backup.next}</div>
                    </div>
                </div>
            </Panel>

            <Panel title="Long-Running Txns" icon={Hourglass} accentColor={THEME.warning}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                    {widgets.longTxns.map((txn, idx) => (
                        <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span
                                    style={{
                                        fontSize: 10,
                                        color: THEME.textMuted,
                                        fontFamily: "'JetBrains Mono',monospace",
                                    }}
                                >
                                    {txn.pid}
                                </span>
                                <span style={{ fontSize: 10, fontWeight: 600, color: THEME.textDim }}>
                                    {txn.duration}
                                </span>
                            </div>
                            <div
                                style={{
                                    fontSize: 9,
                                    color: THEME.textDim,
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                }}
                            >
                                {txn.query}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <div
                                    style={{
                                        flex: 1,
                                        minWidth: 0,
                                        height: 4,
                                        borderRadius: 2,
                                        background: THEME.glassBorder,
                                        overflow: 'hidden',
                                    }}
                                >
                                    <div style={{ height: '100%', background: THEME.warning, width: `${txn.pct}%` }} />
                                </div>
                                <span style={{ fontSize: 9, color: THEME.textDim, minWidth: 30 }}>{txn.wait}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </Panel>

            <Panel title="Maintenance Health" icon={Leaf} accentColor={db.color}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                    <div style={{ display: 'flex', height: 18, borderRadius: 18, overflow: 'hidden', gap: 2 }}>
                        <div style={{ flex: widgets.vacuum.urgent, background: THEME.danger, opacity: 0.8 }} />
                        <div style={{ flex: widgets.vacuum.soon, background: THEME.warning, opacity: 0.6 }} />
                        <div style={{ flex: widgets.vacuum.healthy, background: THEME.success, opacity: 0.5 }} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22 }}>
                        <div>
                            <div style={{ fontSize: 9, color: THEME.textDim }}>Urgent</div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: THEME.danger }}>
                                {widgets.vacuum.urgent}
                            </div>
                        </div>
                        <div>
                            <div style={{ fontSize: 9, color: THEME.textDim }}>Soon</div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: THEME.warning }}>
                                {widgets.vacuum.soon}
                            </div>
                        </div>
                        <div>
                            <div style={{ fontSize: 9, color: THEME.textDim }}>Healthy</div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: THEME.success }}>
                                {widgets.vacuum.healthy}
                            </div>
                        </div>
                    </div>
                    <div style={{ borderTop: `1px solid ${THEME.glassBorder}`, paddingTop: 8, marginTop: 4 }}>
                        <div style={{ fontSize: 9.5, color: THEME.textMuted, marginBottom: 4 }}>Dead Tuples</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: THEME.textMain }}>
                            {widgets.vacuum.deadTuples}
                        </div>
                    </div>
                </div>
            </Panel>
        </div>
    );
}

/* ══════════════════════════════════════════════════════════════════════
   SubTabContent — Renders UNIQUE tab-specific widgets for every sub-tab.
   Each tab gets a visually distinct layout so no two tabs within the
   same section look the same.
   ══════════════════════════════════════════════════════════════════════ */

/** Reusable tooltip style */
const TT_STYLE = {
    background: THEME.tooltipBg,
    border: `1px solid ${THEME.glassBorder}`,
    borderRadius: 20,
    fontSize: 10,
    color: THEME.textMain,
};

/** Generate 24-hour time-series data with two metrics */
function gen24h(seed, m1Base, m1Var, m2Base, m2Var) {
    return Array.from({ length: 24 }, (_, i) => ({
        time: `${String(i).padStart(2, '0')}:00`,
        primary: Math.floor(hashNorm(`${seed}-p-${i}`) * m1Var + m1Base),
        secondary: Math.floor(hashNorm(`${seed}-s-${i}`) * m2Var + m2Base),
    }));
}

/** Generate a 7-day trend dataset */
function gen7d(seed, base, variance) {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return days.map((d, i) => ({ day: d, value: Math.floor(hashNorm(`${seed}-${i}`) * variance + base) }));
}

/** Stat card mini-component used in many layouts */
function StatCard({ label, value, unit, color }) {
    return (
        <div style={{ textAlign: 'center', padding: '14px 8px' }}>
            <div
                style={{ fontSize: 9, color: THEME.textDim, fontWeight: 600, letterSpacing: '0.02em', marginBottom: 6 }}
            >
                {label}
            </div>
            <span
                style={{
                    fontSize: 22,
                    fontWeight: 700,
                    color: metricValue(color),
                    fontFamily: "'JetBrains Mono',monospace",
                }}
            >
                {value}
            </span>
            {unit && <span style={{ fontSize: 10, color: THEME.textDim, marginLeft: 3 }}>{unit}</span>}
        </div>
    );
}

function SubTabContent({ subTabId, _section, db, _widgets }) {
    const dbName = db.name.toLowerCase().replace(' ', '');
    const key = dbName;
    const seed = `${key}-${subTabId}`;

    /* ══════════════════════════════════════════════════════════════════════
     OVERVIEW: Full 7-row dashboard matching real monitoring layout
     ══════════════════════════════════════════════════════════════════════ */
    if (subTabId === 'overview' || !subTabId) {
        const clusterVelData = gen24h(seed, 1200, 400, 900, 300); // QPS + TPS
        const latencyData = gen24h(seed, 5, 3, 8, 4).map((d, i) => ({
            ...d,
            p50: 2 + Math.sin(i / 4) * 1.5,
            p95: 5 + Math.cos(i / 5) * 2,
            p99: 8 + Math.sin(i / 3) * 2.5,
        }));
        const workloadData = [
            { name: 'SELECTs', value: Math.floor(hashNorm(`${seed}-ws`) * 30 + 40), color: db.color },
            { name: 'INSERTs', value: Math.floor(hashNorm(`${seed}-wi`) * 15 + 10), color: THEME.success },
            { name: 'UPDATEs', value: Math.floor(hashNorm(`${seed}-wu`) * 10 + 8), color: THEME.warning },
            { name: 'DELETEs', value: Math.floor(hashNorm(`${seed}-wd`) * 5 + 2), color: THEME.danger },
        ];
        const impactedTables = (DB_TABLE_NAMES[key] || DB_TABLE_NAMES.postgresql)
            .slice(0, 5)
            .map((t, i) => ({
                name: t.substring(0, 12),
                impact: Math.floor(hashNorm(`${seed}-ti-${i}`) * 1000 + 100),
            }))
            .sort((a, b) => b.impact - a.impact);

        return (
            <>
                {/* Row 1: 6 Hero KPI Cards with trend arrows and vs last hr text */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 18 }}>
                    {db.kpis &&
                        db.kpis.slice(0, 6).map((kpi, i) => {
                            const trendUp = hashNorm(`${seed}-kpi-trend-${i}`) > 0.5;
                            const trendPct = Math.floor(hashNorm(`${seed}-kpi-pct-${i}`) * 25 + 2);
                            return (
                                <Panel key={i} title={kpi.label} icon={Zap} accentColor={db.color}>
                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
                                        <span style={{ fontSize: 22, fontWeight: 700, color: db.color }}>
                                            {kpi.value}
                                        </span>
                                        <span style={{ fontSize: 10, color: THEME.textDim }}>{kpi.unit}</span>
                                        <span
                                            style={{
                                                fontSize: 12,
                                                fontWeight: 600,
                                                color: trendUp ? THEME.success : THEME.danger,
                                            }}
                                        >
                                            {trendUp ? '▲' : '▼'} {trendPct}%
                                        </span>
                                    </div>
                                    <div style={{ fontSize: 9, color: THEME.textDim, marginBottom: 8 }}>vs last hr</div>
                                    {kpi.sparkline && (
                                        <MiniSparkline
                                            data={kpi.sparkline.map((v) => ({ value: v }))}
                                            color={db.color}
                                            width={100}
                                            height={18}
                                        />
                                    )}
                                </Panel>
                            );
                        })}
                </div>

                {/* Row 2: 3 Cards (Last Backup, Long-Running Txns, Vacuum Health) */}
                <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
                    <Panel title="Last Backup" icon={Archive} accentColor={THEME.success}>
                        <StatCard
                            label="Time"
                            value={`${Math.floor(hashNorm(`${seed}-lb`) * 6 + 1)}`}
                            unit="hours ago"
                            color={THEME.success}
                        />
                        <div style={{ fontSize: 10, color: THEME.textDim, marginTop: 8 }}>
                            Size: {Math.floor(hashNorm(`${seed}-lbs`) * 10 + 5)} GB
                        </div>
                    </Panel>
                    <Panel title="Long-Running Txns" icon={Hourglass} accentColor={THEME.warning}>
                        <StatCard
                            label="Count"
                            value={`${Math.floor(hashNorm(`${seed}-lrt`) * 5)}`}
                            unit=""
                            color={THEME.warning}
                        />
                        <div style={{ fontSize: 10, color: THEME.textDim, marginTop: 8 }}>
                            Max: {Math.floor(hashNorm(`${seed}-lrtm`) * 30 + 5)}s
                        </div>
                    </Panel>
                    <Panel title="Vacuum Health" icon={RefreshCw} accentColor={THEME.success}>
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0' }}>
                            <RingGauge
                                value={Math.floor(hashNorm(`${seed}-vh`) * 10 + 85)}
                                color={THEME.success}
                                size={70}
                                strokeWidth={5}
                                label="HEALTH"
                            />
                        </div>
                    </Panel>
                </div>

                {/* Row 3: 2-col — Cluster Velocity AreaChart with stats footer | Database Health + Connection Pool with progress bars */}
                <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
                    <Panel
                        title="Cluster Velocity (24h)"
                        icon={TrendingUp}
                        accentColor={db.color}
                        rightNode={
                            <div style={{ display: 'flex', gap: 22 }}>
                                <span style={{ fontSize: 9, display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <span style={{ width: 8, height: 3, background: db.color, borderRadius: 1 }} />
                                    QPS
                                </span>
                                <span style={{ fontSize: 9, display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <span style={{ width: 8, height: 3, background: THEME.success, borderRadius: 1 }} />
                                    TPS
                                </span>
                            </div>
                        }
                    >
                        <ResponsiveContainer width="100%" height={160}>
                            <AreaChart data={clusterVelData}>
                                <CartesianGrid strokeDasharray="3 3" stroke={THEME.gridLine} />
                                <XAxis dataKey="time" tick={{ fontSize: 8, fill: THEME.textDim }} interval={3} />
                                <YAxis tick={{ fontSize: 9, fill: THEME.textDim }} width={40} />
                                <Tooltip contentStyle={TT_STYLE} />
                                <Area
                                    type="monotone"
                                    dataKey="primary"
                                    name="QPS"
                                    stroke={db.color}
                                    fill={`${db.color}20`}
                                    strokeWidth={2}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="secondary"
                                    name="TPS"
                                    stroke={THEME.success}
                                    fill={`${THEME.success}10`}
                                    strokeWidth={1.5}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(4, 1fr)',
                                gap: 18,
                                borderTop: `1px solid ${THEME.gridLine}`,
                                paddingTop: 12,
                                marginTop: 12,
                                fontSize: 9,
                            }}
                        >
                            <div>
                                <span style={{ color: THEME.textDim }}>Peak QPS</span>{' '}
                                <div style={{ color: THEME.textMain, fontWeight: 600 }}>
                                    {Math.floor(hashNorm(`${seed}-pqps`) * 2000 + 500)}
                                </div>
                            </div>
                            <div>
                                <span style={{ color: THEME.textDim }}>Avg QPS</span>{' '}
                                <div style={{ color: THEME.textMain, fontWeight: 600 }}>
                                    {Math.floor(hashNorm(`${seed}-aqps`) * 1500 + 300)}
                                </div>
                            </div>
                            <div>
                                <span style={{ color: THEME.textDim }}>Peak TPS</span>{' '}
                                <div style={{ color: THEME.textMain, fontWeight: 600 }}>
                                    {Math.floor(hashNorm(`${seed}-ptps`) * 1200 + 200)}
                                </div>
                            </div>
                            <div>
                                <span style={{ color: THEME.textDim }}>Avg TPS</span>{' '}
                                <div style={{ color: THEME.textMain, fontWeight: 600 }}>
                                    {Math.floor(hashNorm(`${seed}-atps`) * 800 + 100)}
                                </div>
                            </div>
                        </div>
                    </Panel>
                    <div style={{ display: 'grid', gridTemplateRows: '1fr 1fr', gap: 20 }}>
                        <Panel title="Database Health" icon={Shield} accentColor={THEME.success}>
                            <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0' }}>
                                <RingGauge
                                    value={Math.floor(hashNorm(`${seed}-dh`) * 5 + 94)}
                                    color={THEME.success}
                                    size={70}
                                    strokeWidth={5}
                                    label="HEALTH"
                                />
                            </div>
                            <div
                                style={{
                                    display: 'grid',
                                    gap: 20,
                                    fontSize: 9,
                                    marginTop: 10,
                                    paddingTop: 10,
                                    borderTop: `1px solid ${THEME.gridLine}`,
                                }}
                            >
                                <div>
                                    <div style={{ color: THEME.textDim, marginBottom: 3 }}>Cache Hit %</div>
                                    <div
                                        style={{
                                            height: 4,
                                            background: THEME.gridLine,
                                            borderRadius: 2,
                                            overflow: 'hidden',
                                        }}
                                    >
                                        <div
                                            style={{
                                                height: '100%',
                                                width: `${Math.floor(hashNorm(`${seed}-dhc`) * 30 + 85)}%`,
                                                background: THEME.success,
                                            }}
                                        ></div>
                                    </div>
                                </div>
                                <div>
                                    <div style={{ color: THEME.textDim, marginBottom: 3 }}>Conn Usage %</div>
                                    <div
                                        style={{
                                            height: 4,
                                            background: THEME.gridLine,
                                            borderRadius: 2,
                                            overflow: 'hidden',
                                        }}
                                    >
                                        <div
                                            style={{
                                                height: '100%',
                                                width: `${Math.floor(hashNorm(`${seed}-dhcu`) * 50 + 40)}%`,
                                                background: db.color,
                                            }}
                                        ></div>
                                    </div>
                                </div>
                                <div>
                                    <div style={{ color: THEME.textDim, marginBottom: 3 }}>Disk Usage %</div>
                                    <div
                                        style={{
                                            height: 4,
                                            background: THEME.gridLine,
                                            borderRadius: 2,
                                            overflow: 'hidden',
                                        }}
                                    >
                                        <div
                                            style={{
                                                height: '100%',
                                                width: `${Math.floor(hashNorm(`${seed}-dhdu`) * 60 + 30)}%`,
                                                background: THEME.warning,
                                            }}
                                        ></div>
                                    </div>
                                </div>
                            </div>
                        </Panel>
                        <Panel title="Connection Pool" icon={Network} accentColor={db.color}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, fontSize: 10 }}>
                                <div
                                    style={{
                                        textAlign: 'center',
                                        padding: 8,
                                        background: THEME.glassBorder,
                                        borderRadius: 16,
                                    }}
                                >
                                    <div style={{ fontSize: 14, fontWeight: 700, color: db.color }}>
                                        {Math.floor(hashNorm(`${seed}-cpactive`) * 20 + 5)}
                                    </div>
                                    <div style={{ fontSize: 9, color: THEME.textDim }}>Active</div>
                                </div>
                                <div
                                    style={{
                                        textAlign: 'center',
                                        padding: 8,
                                        background: THEME.glassBorder,
                                        borderRadius: 16,
                                    }}
                                >
                                    <div style={{ fontSize: 14, fontWeight: 700, color: THEME.success }}>
                                        {Math.floor(hashNorm(`${seed}-cpidle`) * 15 + 3)}
                                    </div>
                                    <div style={{ fontSize: 9, color: THEME.textDim }}>Idle</div>
                                </div>
                                <div
                                    style={{
                                        textAlign: 'center',
                                        padding: 8,
                                        background: THEME.glassBorder,
                                        borderRadius: 16,
                                    }}
                                >
                                    <div style={{ fontSize: 14, fontWeight: 700, color: THEME.warning }}>
                                        {Math.floor(hashNorm(`${seed}-cpwait`) * 3)}
                                    </div>
                                    <div style={{ fontSize: 9, color: THEME.textDim }}>Waiting</div>
                                </div>
                                <div
                                    style={{
                                        textAlign: 'center',
                                        padding: 8,
                                        background: THEME.glassBorder,
                                        borderRadius: 16,
                                    }}
                                >
                                    <div style={{ fontSize: 14, fontWeight: 700, color: THEME.textDim }}>32</div>
                                    <div style={{ fontSize: 9, color: THEME.textDim }}>Max</div>
                                </div>
                            </div>
                        </Panel>
                    </div>
                </div>

                {/* Row 4: Transaction Latency Percentiles LineChart with stats footer and SLA reference */}
                <div style={{ marginTop: 16 }}>
                    <Panel
                        title="Transaction Latency Percentiles (24h)"
                        icon={Activity}
                        accentColor={db.color}
                        rightNode={
                            <div style={{ display: 'flex', gap: 22 }}>
                                <span style={{ fontSize: 9, display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <span style={{ width: 8, height: 3, background: db.color, borderRadius: 1 }} />
                                    P50
                                </span>
                                <span style={{ fontSize: 9, display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <span style={{ width: 8, height: 3, background: THEME.warning, borderRadius: 1 }} />
                                    P95
                                </span>
                                <span style={{ fontSize: 9, display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <span style={{ width: 8, height: 3, background: THEME.danger, borderRadius: 1 }} />
                                    P99
                                </span>
                            </div>
                        }
                    >
                        <ResponsiveContainer width="100%" height={160}>
                            <LineChart data={latencyData}>
                                <CartesianGrid strokeDasharray="3 3" stroke={THEME.gridLine} />
                                <XAxis dataKey="time" tick={{ fontSize: 8, fill: THEME.textDim }} interval={3} />
                                <YAxis tick={{ fontSize: 9, fill: THEME.textDim }} width={40} unit="ms" />
                                <Tooltip contentStyle={TT_STYLE} />
                                <ReferenceLine
                                    y={10}
                                    stroke={THEME.success}
                                    strokeDasharray="5 5"
                                    label={{ value: 'SLA (10ms)', fontSize: 8, fill: THEME.textDim, position: 'right' }}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="p50"
                                    name="P50"
                                    stroke={db.color}
                                    strokeWidth={2}
                                    dot={false}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="p95"
                                    name="P95"
                                    stroke={THEME.warning}
                                    strokeWidth={2}
                                    dot={false}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="p99"
                                    name="P99"
                                    stroke={THEME.danger}
                                    strokeWidth={2}
                                    dot={false}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(4, 1fr)',
                                gap: 18,
                                borderTop: `1px solid ${THEME.gridLine}`,
                                paddingTop: 12,
                                marginTop: 12,
                                fontSize: 9,
                            }}
                        >
                            <div>
                                <span style={{ color: THEME.textDim }}>P50 avg</span>{' '}
                                <div style={{ color: THEME.textMain, fontWeight: 600 }}>
                                    {(2 + Math.random() * 2).toFixed(2)}ms
                                </div>
                            </div>
                            <div>
                                <span style={{ color: THEME.textDim }}>P95 avg</span>{' '}
                                <div style={{ color: THEME.textMain, fontWeight: 600 }}>
                                    {(5 + Math.random() * 3).toFixed(2)}ms
                                </div>
                            </div>
                            <div>
                                <span style={{ color: THEME.textDim }}>P99 avg</span>{' '}
                                <div style={{ color: THEME.textMain, fontWeight: 600 }}>
                                    {(8 + Math.random() * 4).toFixed(2)}ms
                                </div>
                            </div>
                            <div>
                                <span style={{ color: THEME.textDim }}>SLA breaches</span>{' '}
                                <div style={{ color: THEME.danger, fontWeight: 600 }}>
                                    {Math.floor(hashNorm(`${seed}-sla-breach`) * 5)}
                                </div>
                            </div>
                        </div>
                    </Panel>
                </div>

                {/* Row 5: 3-col — Workload Split PieChart | Throughput Breakdown | Ops/Second BarChart */}
                <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
                    <Panel title="Workload Split" icon={PieChart} accentColor={db.color}>
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0' }}>
                            <ResponsiveContainer width="100%" height={140}>
                                <PieChart>
                                    <Pie
                                        data={workloadData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={30}
                                        outerRadius={50}
                                        paddingAngle={2}
                                        dataKey="value"
                                    >
                                        {workloadData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div style={{ fontSize: 10, padding: '8px 12px 0', borderTop: `1px solid ${THEME.gridLine}` }}>
                            {workloadData.map((w, i) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                                    <span style={{ color: THEME.textDim }}>{w.name}</span>
                                    <span style={{ color: THEME.textMain, fontWeight: 600 }}>{w.value}%</span>
                                </div>
                            ))}
                        </div>
                    </Panel>
                    <Panel title="Throughput Breakdown" icon={BarChart3} accentColor={db.color}>
                        <ResponsiveContainer width="100%" height={160}>
                            <BarChart data={workloadData} layout="vertical">
                                <XAxis type="number" tick={{ fontSize: 8, fill: THEME.textDim }} />
                                <YAxis
                                    dataKey="name"
                                    type="category"
                                    tick={{ fontSize: 9, fill: THEME.textDim }}
                                    width={70}
                                />
                                <Tooltip contentStyle={TT_STYLE} />
                                <Bar dataKey="value" fill={db.color} radius={[0, 3, 3, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </Panel>
                    <Panel title="Ops/Second" icon={Zap} accentColor={db.color}>
                        <ResponsiveContainer width="100%" height={160}>
                            <BarChart data={gen24h(seed, 50, 30, 30, 15).slice(0, 6)}>
                                <XAxis dataKey="time" tick={{ fontSize: 8, fill: THEME.textDim }} />
                                <YAxis tick={{ fontSize: 9, fill: THEME.textDim }} width={35} />
                                <Tooltip contentStyle={TT_STYLE} />
                                <Bar dataKey="primary" name="Ops" fill={db.color} radius={[2, 2, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </Panel>
                </div>

                {/* Row 6: 3-col — CPU Load | Memory Usage | Disk I/O RingGauges with secondary values */}
                <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
                    <Panel title="CPU Load" icon={Cpu} accentColor={db.color}>
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0' }}>
                            <RingGauge
                                value={Math.floor(hashNorm(`${seed}-cpu`) * 40 + 20)}
                                color={db.color}
                                size={90}
                                strokeWidth={7}
                                label="CPU"
                            />
                        </div>
                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 1fr',
                                gap: 20,
                                fontSize: 10,
                                padding: '0 12px 8px',
                            }}
                        >
                            <div>
                                <span style={{ color: THEME.textDim }}>Cores</span>{' '}
                                <span style={{ color: THEME.textMain, fontWeight: 600 }}>8</span>
                            </div>
                            <div>
                                <span style={{ color: THEME.textDim }}>Avg</span>{' '}
                                <span style={{ color: THEME.textMain, fontWeight: 600 }}>2.4</span>
                            </div>
                        </div>
                    </Panel>
                    <Panel title="Memory Usage" icon={MemoryStick} accentColor={db.color}>
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0' }}>
                            <RingGauge
                                value={Math.floor(hashNorm(`${seed}-mem`) * 30 + 45)}
                                color={db.color}
                                size={90}
                                strokeWidth={7}
                                label="RAM"
                            />
                        </div>
                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 1fr',
                                gap: 20,
                                fontSize: 10,
                                padding: '0 12px 8px',
                            }}
                        >
                            <div>
                                <span style={{ color: THEME.textDim }}>Used</span>{' '}
                                <span style={{ color: THEME.textMain, fontWeight: 600 }}>12.4G</span>
                            </div>
                            <div>
                                <span style={{ color: THEME.textDim }}>Cache</span>{' '}
                                <span style={{ color: THEME.textMain, fontWeight: 600 }}>4.0G</span>
                            </div>
                        </div>
                    </Panel>
                    <Panel title="Disk I/O" icon={HardDrive} accentColor={db.color}>
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0' }}>
                            <RingGauge
                                value={Math.floor(hashNorm(`${seed}-disk`) * 50 + 30)}
                                color={db.color}
                                size={90}
                                strokeWidth={7}
                                label="I/O"
                            />
                        </div>
                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 1fr',
                                gap: 20,
                                fontSize: 10,
                                padding: '0 12px 8px',
                            }}
                        >
                            <div>
                                <span style={{ color: THEME.textDim }}>Read</span>{' '}
                                <span style={{ color: THEME.textMain, fontWeight: 600 }}>245MB</span>
                            </div>
                            <div>
                                <span style={{ color: THEME.textDim }}>Write</span>{' '}
                                <span style={{ color: THEME.textMain, fontWeight: 600 }}>128MB</span>
                            </div>
                        </div>
                    </Panel>
                </div>

                {/* Row 7: 3-col — Replication with lag badges | Top Impacted Tables with reads/writes | WAL with sparkline & checkpoint stats */}
                <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
                    <Panel title="Replication" icon={Lock} accentColor={db.color}>
                        <div style={{ fontSize: 10, padding: '20px 24px' }}>
                            <div style={{ marginBottom: 12 }}>
                                <div style={{ color: THEME.textDim, marginBottom: 6 }}>Primary Server</div>
                                <div style={{ color: THEME.textMain, fontWeight: 600 }}>db-prod-01.aws</div>
                            </div>
                            <div>
                                <div style={{ color: THEME.textDim, marginBottom: 6 }}>Replicas</div>
                                {Array.from({ length: Math.floor(hashNorm(`${seed}-rep-count`) * 3 + 1) }, (_, i) => (
                                    <div
                                        key={i}
                                        style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 4 }}
                                    >
                                        <span>Replica-{i + 1}</span>
                                        <span
                                            style={{
                                                fontSize: 8,
                                                background: THEME.gridLine,
                                                color: THEME.textDim,
                                                padding: '2px 6px',
                                                borderRadius: 3,
                                            }}
                                        >
                                            {Math.floor(hashNorm(`${seed}-lag-${i}`) * 2 + 0.5)}ms
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </Panel>
                    <Panel title="Top Impacted Tables" icon={Database} accentColor={THEME.warning}>
                        <DemoTable
                            columns={[
                                { key: 'table', label: 'Table', width: '40%' },
                                { key: 'reads', label: 'Reads', width: '30%' },
                                { key: 'writes', label: 'Writes', width: '30%' },
                            ]}
                            rows={impactedTables.slice(0, 4).map((t) => ({
                                table: t.name,
                                reads: Math.floor(hashNorm(`${seed}-${t.name}-reads`) * 50000 + 1000),
                                writes: Math.floor(hashNorm(`${seed}-${t.name}-writes`) * 10000 + 500),
                            }))}
                            color={db.color}
                        />
                    </Panel>
                    <Panel title="WAL & Checkpoints" icon={Archive} accentColor={db.color}>
                        <div style={{ fontSize: 10, padding: '20px 24px' }}>
                            <div style={{ marginBottom: 10 }}>
                                <div style={{ color: THEME.textDim, marginBottom: 4 }}>24h WAL Activity</div>
                                <MiniSparkline
                                    data={gen24h(seed, 50, 30, 40, 20).map((d) => ({ value: d.primary }))}
                                    color={db.color}
                                    width={100}
                                    height={30}
                                />
                            </div>
                            <div
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: '1fr 1fr',
                                    gap: 20,
                                    borderTop: `1px solid ${THEME.gridLine}`,
                                    paddingTop: 8,
                                    marginTop: 8,
                                    fontSize: 9,
                                }}
                            >
                                <div>
                                    <span style={{ color: THEME.textDim }}>Checkpoint Avg</span>
                                    <div style={{ color: THEME.textMain, fontWeight: 600 }}>
                                        {Math.floor(hashNorm(`${seed}-ckpt-avg`) * 15 + 5)}s
                                    </div>
                                </div>
                                <div>
                                    <span style={{ color: THEME.textDim }}>WAL Archived</span>
                                    <div style={{ color: THEME.textMain, fontWeight: 600 }}>
                                        {Math.floor(hashNorm(`${seed}-wal-arch`) * 120 + 20)} files
                                    </div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                                <span
                                    style={{
                                        fontSize: 8,
                                        background: THEME.success,
                                        color: '#000',
                                        padding: '2px 6px',
                                        borderRadius: 2,
                                    }}
                                >
                                    Healthy
                                </span>
                                {hashNorm(`${seed}-wal-critical`) > 0.7 && (
                                    <span
                                        style={{
                                            fontSize: 8,
                                            background: THEME.danger,
                                            color: '#fff',
                                            padding: '2px 6px',
                                            borderRadius: 2,
                                        }}
                                    >
                                        Alert
                                    </span>
                                )}
                            </div>
                        </div>
                    </Panel>
                </div>
            </>
        );
    }

    /* ══════════════════════════════════════════════════════════════════════
     PERFORMANCE: Session stats + Session Traffic chart + Slow Queries table
     ══════════════════════════════════════════════════════════════════════ */
    if (subTabId === 'performance') {
        const sessionData = gen24h(seed, 5, 30, 2, 15);
        const waitEventData = [
            { name: 'CPU', value: Math.floor(hashNorm(`${seed}-we-cpu`) * 35 + 20), color: THEME.primary },
            { name: 'IO', value: Math.floor(hashNorm(`${seed}-we-io`) * 28 + 15), color: THEME.warning },
            { name: 'Lock', value: Math.floor(hashNorm(`${seed}-we-lock`) * 18 + 8), color: THEME.danger },
            { name: 'Client', value: Math.floor(hashNorm(`${seed}-we-client`) * 12 + 5), color: THEME.success },
        ];
        const cacheHitData = gen24h(seed, 95, 4, 90, 5);

        return (
            <>
                {/* ACTIVE SESSIONS VIEW */}
                {/* Row 1: Session KPI Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 18 }}>
                    <Panel title="Active" icon={Activity} accentColor={THEME.success}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                            <div
                                style={{
                                    fontSize: 28,
                                    fontWeight: 800,
                                    color: THEME.success,
                                    letterSpacing: '-0.02em',
                                }}
                            >
                                {Math.floor(hashNorm(`${seed}-act`) * 30 + 8)}
                            </div>
                            <div
                                style={{
                                    fontSize: 9,
                                    color: THEME.textDim,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 4,
                                }}
                            >
                                <span
                                    style={{
                                        width: 6,
                                        height: 6,
                                        borderRadius: '50%',
                                        background: THEME.success,
                                        opacity: 0.7,
                                    }}
                                />
                                Running queries
                            </div>
                            <MiniSparkline
                                data={sessionData.map((d) => ({ value: d.primary }))}
                                color={THEME.success}
                                width={100}
                                height={20}
                            />
                        </div>
                    </Panel>
                    <Panel title="Long Running" icon={Clock} accentColor={THEME.warning}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                            <div
                                style={{
                                    fontSize: 28,
                                    fontWeight: 800,
                                    color: THEME.warning,
                                    letterSpacing: '-0.02em',
                                }}
                            >
                                {Math.floor(hashNorm(`${seed}-lr`) * 12 + 3)}
                            </div>
                            <div style={{ fontSize: 9, color: THEME.textDim }}>Queries &gt; 10s</div>
                            <div
                                style={{
                                    width: '100%',
                                    height: 4,
                                    background: `${THEME.warning}20`,
                                    borderRadius: 2,
                                    overflow: 'hidden',
                                }}
                            >
                                <div
                                    style={{
                                        width: `${Math.floor(hashNorm(`${seed}-lr-pct`) * 80 + 20)}%`,
                                        height: '100%',
                                        background: THEME.warning,
                                    }}
                                />
                            </div>
                        </div>
                    </Panel>
                    <Panel title="Idle Sessions" icon={Eye} accentColor={THEME.textDim}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                            <div
                                style={{
                                    fontSize: 28,
                                    fontWeight: 800,
                                    color: THEME.textDim,
                                    letterSpacing: '-0.02em',
                                }}
                            >
                                {Math.floor(hashNorm(`${seed}-idle`) * 20 + 5)}
                            </div>
                            <div style={{ fontSize: 9, color: THEME.textDim }}>Waiting for query</div>
                            <MiniSparkline
                                data={sessionData.map((d) => ({ value: d.secondary }))}
                                color={THEME.textDim}
                                width={100}
                                height={20}
                            />
                        </div>
                    </Panel>
                    <Panel title="Blocked" icon={Lock} accentColor={THEME.danger}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                            <div
                                style={{ fontSize: 28, fontWeight: 800, color: THEME.danger, letterSpacing: '-0.02em' }}
                            >
                                {Math.floor(hashNorm(`${seed}-blk`) * 5 + 1)}
                            </div>
                            <div style={{ fontSize: 9, color: THEME.textDim }}>By locks</div>
                            <div style={{ fontSize: 10, color: THEME.danger, fontWeight: 600 }}>⚠ Review locks</div>
                        </div>
                    </Panel>
                    <Panel title="Sessions/min" icon={Zap} accentColor={db.color}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                            <div style={{ fontSize: 28, fontWeight: 800, color: db.color, letterSpacing: '-0.02em' }}>
                                {Math.floor(hashNorm(`${seed}-spm`) * 45 + 12)}
                            </div>
                            <div style={{ fontSize: 9, color: THEME.textDim }}>Connection rate</div>
                            <div style={{ fontSize: 10, color: THEME.success, fontWeight: 600 }}>
                                ↑ {Math.floor(hashNorm(`${seed}-spm-trend`) * 20 + 5)}%
                            </div>
                        </div>
                    </Panel>
                </div>

                {/* Row 2: Slow Queries Table + Wait Events */}
                <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 20 }}>
                    <Panel title="Slow Queries (5 Most Recent)" icon={Clock} accentColor={THEME.warning}>
                        <DemoTable
                            columns={[
                                { key: 'query', label: 'Query', width: '45%' },
                                { key: 'avgDuration', label: 'Avg Time', width: '18%' },
                                { key: 'calls', label: 'Calls', width: '18%' },
                                { key: 'impact', label: 'Impact', width: '19%' },
                            ]}
                            rows={(DB_SLOW_QUERIES[key] || DB_SLOW_QUERIES.postgresql).slice(0, 5).map((q, i) => ({
                                query: q.label.substring(0, 40),
                                avgDuration: q.display,
                                calls: Math.floor(hashNorm(`${seed}-calls-${i}`) * 2000 + 100).toLocaleString(),
                                impact: ['🔴 High', '🟡 Med', '🟢 Low'][i % 3],
                            }))}
                            color={db.color}
                        />
                    </Panel>
                    <Panel title="Wait Events (24h)" icon={Activity} accentColor={db.color}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 22, height: '100%' }}>
                            {waitEventData.map((evt, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div
                                            style={{
                                                fontSize: 10,
                                                fontWeight: 600,
                                                color: THEME.textMain,
                                                marginBottom: 2,
                                            }}
                                        >
                                            {evt.name}
                                        </div>
                                        <div
                                            style={{
                                                width: '100%',
                                                height: 6,
                                                background: `${evt.color}15`,
                                                borderRadius: 18,
                                                overflow: 'hidden',
                                            }}
                                        >
                                            <div
                                                style={{
                                                    width: `${(evt.value / 100) * 100}%`,
                                                    height: '100%',
                                                    background: evt.color,
                                                    borderRadius: 3,
                                                }}
                                            />
                                        </div>
                                    </div>
                                    <div
                                        style={{
                                            fontSize: 11,
                                            fontWeight: 700,
                                            color: evt.color,
                                            minWidth: 30,
                                            textAlign: 'right',
                                        }}
                                    >
                                        {evt.value}%
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Panel>
                </div>

                {/* HEALTH VIEW */}
                {/* Row 3: Cache Hit Ratio + Lock Monitor */}
                <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                    <Panel title="Cache Hit Ratio (24h)" icon={Zap} accentColor={THEME.success}>
                        <ResponsiveContainer width="100%" height={160}>
                            <AreaChart data={cacheHitData}>
                                <CartesianGrid strokeDasharray="3 3" stroke={THEME.gridLine} opacity={0.3} />
                                <XAxis dataKey="time" tick={{ fontSize: 8, fill: THEME.textDim }} interval={3} />
                                <YAxis
                                    tick={{ fontSize: 8, fill: THEME.textDim }}
                                    width={35}
                                    domain={[80, 100]}
                                    unit="%"
                                />
                                <Tooltip contentStyle={TT_STYLE} />
                                <Area
                                    type="monotone"
                                    dataKey="primary"
                                    stroke={THEME.success}
                                    fill={`${THEME.success}15`}
                                    strokeWidth={2}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                        <div
                            style={{
                                fontSize: 9,
                                color: THEME.textDim,
                                marginTop: 8,
                                paddingTop: 8,
                                borderTop: `1px solid ${THEME.gridLine}`,
                                display: 'flex',
                                justifyContent: 'space-between',
                            }}
                        >
                            <span>
                                Current: <span style={{ color: THEME.success, fontWeight: 600 }}>98.2%</span>
                            </span>
                            <span>
                                Avg: <span style={{ color: THEME.success, fontWeight: 600 }}>97.1%</span>
                            </span>
                        </div>
                    </Panel>
                    <Panel title="Lock Monitor" icon={Lock} accentColor={THEME.danger}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
                                <div>
                                    <div
                                        style={{
                                            fontSize: 9,
                                            color: THEME.textDim,
                                            marginBottom: 4,
                                            fontWeight: 600,
                                            letterSpacing: '0.02em',
                                        }}
                                    >
                                        Current Locks
                                    </div>
                                    <div
                                        style={{
                                            fontSize: 24,
                                            fontWeight: 800,
                                            color: THEME.danger,
                                            letterSpacing: '-0.02em',
                                        }}
                                    >
                                        {Math.floor(hashNorm(`${seed}-locks-curr`) * 5)}
                                    </div>
                                </div>
                                <div>
                                    <div
                                        style={{
                                            fontSize: 9,
                                            color: THEME.textDim,
                                            marginBottom: 4,
                                            fontWeight: 600,
                                            letterSpacing: '0.02em',
                                        }}
                                    >
                                        Max Wait
                                    </div>
                                    <div
                                        style={{
                                            fontSize: 24,
                                            fontWeight: 800,
                                            color: THEME.warning,
                                            letterSpacing: '-0.02em',
                                        }}
                                    >
                                        {Math.floor(hashNorm(`${seed}-locks-wait`) * 2000 + 500)}ms
                                    </div>
                                </div>
                            </div>
                            <div
                                style={{
                                    padding: '20px 24px',
                                    borderRadius: 20,
                                    background: `${THEME.success}10`,
                                    border: `1px solid ${THEME.success}25`,
                                }}
                            >
                                <div
                                    style={{
                                        fontSize: 10,
                                        color: THEME.success,
                                        fontWeight: 600,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 6,
                                    }}
                                >
                                    <span
                                        style={{ width: 6, height: 6, borderRadius: '50%', background: THEME.success }}
                                    />
                                    Lock contention: Normal
                                </div>
                            </div>
                        </div>
                    </Panel>
                </div>

                {/* INSIGHTS VIEW */}
                {/* Row 4: N+1 Patterns + Session Timeline */}
                <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                    <Panel title="N+1 Query Patterns" icon={Eye} accentColor={db.color}>
                        <DemoTable
                            columns={[
                                { key: 'pattern', label: 'Pattern', width: '50%' },
                                { key: 'count', label: 'Count', width: '30%' },
                                { key: 'risk', label: 'Risk Level', width: '20%' },
                            ]}
                            rows={[
                                {
                                    pattern: 'SELECT in loop',
                                    count: Math.floor(hashNorm(`${seed}-n1-0`) * 50 + 15).toString(),
                                    risk: '🔴 High',
                                },
                                {
                                    pattern: 'Missing JOIN',
                                    count: Math.floor(hashNorm(`${seed}-n1-1`) * 30 + 8).toString(),
                                    risk: '🟡 Med',
                                },
                                {
                                    pattern: 'Nested subquery',
                                    count: Math.floor(hashNorm(`${seed}-n1-2`) * 20 + 5).toString(),
                                    risk: '🟢 Low',
                                },
                            ]}
                            color={db.color}
                        />
                    </Panel>
                    <Panel title="Session Timeline (24h)" icon={Activity} accentColor={db.color}>
                        <ResponsiveContainer width="100%" height={160}>
                            <AreaChart data={sessionData}>
                                <CartesianGrid strokeDasharray="3 3" stroke={THEME.gridLine} opacity={0.3} />
                                <XAxis dataKey="time" tick={{ fontSize: 8, fill: THEME.textDim }} interval={3} />
                                <YAxis tick={{ fontSize: 8, fill: THEME.textDim }} width={35} />
                                <Tooltip contentStyle={TT_STYLE} />
                                <Area
                                    type="monotone"
                                    dataKey="primary"
                                    name="Active"
                                    stroke={db.color}
                                    fill={`${db.color}20`}
                                    strokeWidth={2}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="secondary"
                                    name="Idle"
                                    stroke={THEME.textDim}
                                    fill={`${THEME.textDim}08`}
                                    strokeWidth={1.5}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                        <div
                            style={{
                                fontSize: 9,
                                color: THEME.textDim,
                                marginTop: 8,
                                paddingTop: 8,
                                borderTop: `1px solid ${THEME.gridLine}`,
                                display: 'flex',
                                justifyContent: 'space-between',
                            }}
                        >
                            <span>
                                Peak Active: <span style={{ color: db.color, fontWeight: 600 }}>42 sessions</span>
                            </span>
                            <span>
                                Avg: <span style={{ color: db.color, fontWeight: 600 }}>28 sessions</span>
                            </span>
                        </div>
                    </Panel>
                </div>
            </>
        );
    }

    /* ══════════════════════════════════════════════════════════════════════
     RESOURCES: CPU/Memory/Disk RingGauges + Table Inventory + Bloat/Growth
     ══════════════════════════════════════════════════════════════════════ */
    if (subTabId === 'resources') {
        const tableData = (DB_TABLE_NAMES[key] || DB_TABLE_NAMES.postgresql).slice(0, 8);
        return (
            <>
                {/* Row 1: Quick Metric Strip (4 columns) */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
                    <Panel title="Total Storage" icon={HardDrive} accentColor={db.color}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: db.color, marginBottom: 4 }}>485 GB</div>
                        <div style={{ fontSize: 10, color: THEME.textDim }}>of 1.2 TB capacity</div>
                    </Panel>
                    <Panel title="Total Rows" icon={Database} accentColor={db.color}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: db.color, marginBottom: 4 }}>2.4B</div>
                        <div style={{ fontSize: 10, color: THEME.textDim }}>across 47 tables tracked</div>
                    </Panel>
                    <Panel title="Avg Bloat" icon={AlertTriangle} accentColor={THEME.warning}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: THEME.warning, marginBottom: 4 }}>
                            {Math.floor(hashNorm(`${seed}-bloat`) * 15 + 8)}%
                        </div>
                        <div style={{ fontSize: 10, color: THEME.textDim }}>
                            {Math.floor(hashNorm(`${seed}-bloat-tables`) * 8 + 2)} tables need attention
                        </div>
                    </Panel>
                    <Panel title="Dead Code" icon={Zap} accentColor={THEME.success}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: THEME.success, marginBottom: 4 }}>
                            {Math.floor(hashNorm(`${seed}-dead`) * 45 + 12)} GB
                        </div>
                        <div style={{ fontSize: 10, color: THEME.textDim }}>reclaimable</div>
                    </Panel>
                </div>

                {/* Row 2: Table Inventory (full width) */}
                <div style={{ marginTop: 16 }}>
                    <Panel title="Table Inventory" icon={Database} accentColor={db.color}>
                        <DemoTable
                            columns={[
                                { key: 'table', label: 'Table', width: '20%' },
                                { key: 'size', label: 'Size (GB)', width: '10%' },
                                { key: 'rows', label: 'Rows', width: '12%' },
                                { key: 'growth', label: 'Growth', width: '13%' },
                                { key: 'composition', label: 'Composition', width: '20%' },
                                { key: 'trend', label: 'Trend', width: '12%' },
                                { key: 'scans', label: 'Scans', width: '13%' },
                            ]}
                            rows={tableData.map((t, i) => {
                                const size = Math.floor(hashNorm(`${seed}-ts-${i}`) * 120 + 5);
                                const rows = Math.floor(hashNorm(`${seed}-tr-${i}`) * 500 + 50);
                                const growth = Math.floor(hashNorm(`${seed}-tg-${i}`) * 25 + 5);
                                const dataComp = Math.floor(hashNorm(`${seed}-tdc-${i}`) * 70 + 20);
                                const indexComp = Math.floor(hashNorm(`${seed}-tic-${i}`) * 40 + 10);
                                const toastComp = 100 - dataComp - indexComp;
                                const scanRatio = Math.floor(hashNorm(`${seed}-tsr-${i}`) * 80 + 10);
                                return {
                                    table: t,
                                    size: `${size}`,
                                    rows: `${rows}K`,
                                    growth: `${growth}% ▲`,
                                    composition: `${dataComp}% data, ${indexComp}% idx, ${Math.max(toastComp, 0)}% TOAST`,
                                    trend: '▄▅▆▇▆▅▄',
                                    scans: `${scanRatio}% idx / ${100 - scanRatio}% seq`,
                                };
                            })}
                            color={db.color}
                        />
                    </Panel>
                </div>

                {/* Row 3: Bloat & Auto-Vacuum */}
                <div style={{ marginTop: 16 }}>
                    <Panel title="Bloat & Auto-Vacuum" icon={Layers} accentColor={THEME.warning}>
                        <div style={{ display: 'flex', gap: 20, marginBottom: 12 }}>
                            {['All', 'High', 'Medium', 'Low'].map((level) => (
                                <button
                                    key={level}
                                    style={{
                                        padding: '6px 12px',
                                        fontSize: 10,
                                        fontWeight: 600,
                                        border: 'none',
                                        background: level === 'All' ? db.color : THEME.glassBorder,
                                        color: THEME.textMain,
                                        borderRadius: 16,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                    }}
                                >
                                    {level}
                                </button>
                            ))}
                        </div>
                        <div style={{ display: 'grid', gap: 22 }}>
                            {tableData.slice(0, 5).map((t, i) => {
                                const bloatPct = Math.floor(hashNorm(`${seed}-tb-${i}`) * 35 + 5);
                                const severity = bloatPct > 25 ? 'critical' : bloatPct > 15 ? 'high' : 'medium';
                                const severityColor =
                                    severity === 'critical'
                                        ? THEME.danger
                                        : severity === 'high'
                                          ? THEME.warning
                                          : db.color;
                                return (
                                    <div
                                        key={i}
                                        style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '8px 0' }}
                                    >
                                        <span style={{ fontSize: 10, color: THEME.textDim, width: 120 }}>{t}</span>
                                        <div
                                            style={{
                                                flex: 1,
                                                minWidth: 0,
                                                height: 6,
                                                background: THEME.gridLine,
                                                borderRadius: 2,
                                                overflow: 'hidden',
                                            }}
                                        >
                                            <div
                                                style={{
                                                    height: '100%',
                                                    width: `${bloatPct}%`,
                                                    background: severityColor,
                                                }}
                                            ></div>
                                        </div>
                                        <span
                                            style={{ fontSize: 10, color: THEME.textMain, fontWeight: 600, width: 40 }}
                                        >
                                            {bloatPct}%
                                        </span>
                                        {severity === 'critical' && (
                                            <span style={{ fontSize: 8, color: THEME.danger, fontWeight: 700 }}>
                                                CRITICAL
                                            </span>
                                        )}
                                        {severity === 'high' && (
                                            <span style={{ fontSize: 8, color: THEME.warning, fontWeight: 700 }}>
                                                HIGH
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </Panel>
                </div>
            </>
        );
    }

    /* ══════════════════════════════════════════════════════════════════════
     RELIABILITY: Uptime/MTTR/SLO + Error Budget + MTTR Trend + Incidents table
     ══════════════════════════════════════════════════════════════════════ */
    if (subTabId === 'reliability') {
        const errorBudgetData = gen24h(seed, 0, 0.5, 0.1, 0.2).map((d, i) => ({
            ...d,
            burned: Math.min((i / 24) * 15 + hashNorm(`${seed}-eb-${i}`) * 5, 100),
        }));
        const mttrData = gen7d(seed, 100, 50);
        const sloRateTrendData = gen24h(seed, 99.95, 0.08, 99.92, 0.05);
        const incidentData = [
            { severity: 'Critical', value: Math.floor(hashNorm(`${seed}-ic`) * 3), color: THEME.danger },
            { severity: 'High', value: Math.floor(hashNorm(`${seed}-ih`) * 8 + 2), color: THEME.warning },
            { severity: 'Medium', value: Math.floor(hashNorm(`${seed}-im`) * 12 + 5), color: db.color },
        ];

        return (
            <>
                {/* Row 1: 5 KPI cards with visual enhancements */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 18 }}>
                    <Panel title="Uptime Days" icon={CheckCircle} accentColor={THEME.success}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                            <div
                                style={{
                                    fontSize: 32,
                                    fontWeight: 800,
                                    color: THEME.success,
                                    letterSpacing: '-0.02em',
                                }}
                            >
                                47
                            </div>
                            <div style={{ fontSize: 10, color: THEME.textDim }}>Days since last outage</div>
                            <div
                                style={{
                                    padding: '6px 10px',
                                    background: `${THEME.success}15`,
                                    border: `1px solid ${THEME.success}30`,
                                    borderRadius: 18,
                                    fontSize: 9,
                                    color: THEME.success,
                                    fontWeight: 600,
                                    textAlign: 'center',
                                }}
                            >
                                99.99% SLA
                            </div>
                        </div>
                    </Panel>
                    <Panel title="MTTR" icon={Clock} accentColor={db.color}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                            <div style={{ fontSize: 32, fontWeight: 800, color: db.color, letterSpacing: '-0.02em' }}>
                                {Math.floor(hashNorm(`${seed}-mttr`) * 20 + 5)}m
                            </div>
                            <div style={{ fontSize: 10, color: THEME.textDim }}>Mean Time To Recover</div>
                            <MiniSparkline data={mttrData} color={db.color} width={100} height={20} />
                        </div>
                    </Panel>
                    <Panel title="SLO Budget" icon={Shield} accentColor={THEME.success}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                            <div
                                style={{
                                    fontSize: 32,
                                    fontWeight: 800,
                                    color: THEME.success,
                                    letterSpacing: '-0.02em',
                                }}
                            >
                                {Math.floor(hashNorm(`${seed}-slo`) * 10 + 85)}%
                            </div>
                            <div style={{ fontSize: 10, color: THEME.textDim }}>Remaining budget</div>
                            <div
                                style={{
                                    width: '100%',
                                    height: 4,
                                    background: `${THEME.success}20`,
                                    borderRadius: 2,
                                    overflow: 'hidden',
                                }}
                            >
                                <div
                                    style={{
                                        width: `${Math.floor(hashNorm(`${seed}-slo`) * 10 + 85)}%`,
                                        height: '100%',
                                        background: THEME.success,
                                    }}
                                />
                            </div>
                        </div>
                    </Panel>
                    <Panel title="Failed Deploys" icon={AlertTriangle} accentColor={THEME.warning}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                            <div
                                style={{
                                    fontSize: 32,
                                    fontWeight: 800,
                                    color: THEME.warning,
                                    letterSpacing: '-0.02em',
                                }}
                            >
                                {Math.floor(hashNorm(`${seed}-fd`) * 3)}
                            </div>
                            <div style={{ fontSize: 10, color: THEME.textDim }}>This month</div>
                            <div style={{ fontSize: 10, color: THEME.success, fontWeight: 600 }}>↓ Improving</div>
                        </div>
                    </Panel>
                    <Panel title="Total Incidents" icon={AlertTriangle} accentColor={db.color}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                            <div style={{ fontSize: 32, fontWeight: 800, color: db.color, letterSpacing: '-0.02em' }}>
                                {Math.floor(hashNorm(`${seed}-ti`) * 8 + 2)}
                            </div>
                            <div style={{ fontSize: 10, color: THEME.textDim }}>Last 30 days</div>
                            <div style={{ fontSize: 9, color: THEME.textDim }}>Avg: 1.2/day</div>
                        </div>
                    </Panel>
                </div>

                {/* Row 2: Alert trend + SLO burn rate */}
                <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                    <Panel title="Error Budget Status" icon={Shield} accentColor={THEME.success}>
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0' }}>
                            <RingGauge
                                value={Math.floor(hashNorm(`${seed}-ebs`) * 30 + 60)}
                                color={THEME.success}
                                size={110}
                                strokeWidth={9}
                                label="BUDGET %"
                            />
                        </div>
                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 1fr',
                                gap: 18,
                                marginTop: 14,
                                paddingTop: 14,
                                borderTop: `1px solid ${THEME.gridLine}`,
                            }}
                        >
                            <div>
                                <div
                                    style={{
                                        fontSize: 9,
                                        color: THEME.textDim,
                                        marginBottom: 3,
                                        fontWeight: 600,
                                        letterSpacing: '0.02em',
                                    }}
                                >
                                    Monthly Budget
                                </div>
                                <div style={{ fontSize: 14, fontWeight: 700, color: THEME.textMain }}>43.2 min</div>
                            </div>
                            <div>
                                <div
                                    style={{
                                        fontSize: 9,
                                        color: THEME.textDim,
                                        marginBottom: 3,
                                        fontWeight: 600,
                                        letterSpacing: '0.02em',
                                    }}
                                >
                                    Remaining
                                </div>
                                <div style={{ fontSize: 14, fontWeight: 700, color: THEME.success }}>
                                    {Math.floor(hashNorm(`${seed}-budg`) * 30 + 10)} min
                                </div>
                            </div>
                        </div>
                    </Panel>
                    <Panel title="SLO Burn Rate (24h)" icon={TrendingUp} accentColor={db.color}>
                        <ResponsiveContainer width="100%" height={160}>
                            <AreaChart data={sloRateTrendData}>
                                <CartesianGrid strokeDasharray="3 3" stroke={THEME.gridLine} opacity={0.3} />
                                <XAxis dataKey="time" tick={{ fontSize: 8, fill: THEME.textDim }} interval={3} />
                                <YAxis
                                    tick={{ fontSize: 8, fill: THEME.textDim }}
                                    width={40}
                                    domain={[99.8, 100]}
                                    unit="%"
                                />
                                <Tooltip contentStyle={TT_STYLE} />
                                <ReferenceLine
                                    y={99.9}
                                    stroke={THEME.success}
                                    strokeDasharray="2 2"
                                    label={{ value: 'Target', fontSize: 7, fill: THEME.success, offset: 5 }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="primary"
                                    stroke={db.color}
                                    fill={`${db.color}20`}
                                    strokeWidth={2}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </Panel>
                </div>

                {/* Row 3: MTTR Trend + Incident Severity */}
                <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                    <Panel title="MTTR Trend (7 Days)" icon={Clock} accentColor={db.color}>
                        <ResponsiveContainer width="100%" height={160}>
                            <LineChart data={mttrData}>
                                <CartesianGrid strokeDasharray="3 3" stroke={THEME.gridLine} opacity={0.3} />
                                <XAxis dataKey="day" tick={{ fontSize: 9, fill: THEME.textDim }} />
                                <YAxis tick={{ fontSize: 8, fill: THEME.textDim }} width={40} />
                                <Tooltip contentStyle={TT_STYLE} />
                                <Line
                                    type="monotone"
                                    dataKey="value"
                                    name="MTTR (min)"
                                    stroke={db.color}
                                    strokeWidth={2.5}
                                    dot={false}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                        <div
                            style={{
                                fontSize: 9,
                                color: THEME.textDim,
                                marginTop: 8,
                                paddingTop: 8,
                                borderTop: `1px solid ${THEME.gridLine}`,
                                display: 'flex',
                                justifyContent: 'space-between',
                            }}
                        >
                            <span>
                                Avg: <span style={{ color: db.color, fontWeight: 600 }}>12.4 min</span>
                            </span>
                            <span>
                                Best: <span style={{ color: THEME.success, fontWeight: 600 }}>3.2 min</span>
                            </span>
                        </div>
                    </Panel>
                    <Panel title="Incident Severity Distribution" icon={AlertTriangle} accentColor={THEME.warning}>
                        <ResponsiveContainer width="100%" height={160}>
                            <BarChart data={incidentData} layout="vertical">
                                <XAxis type="number" tick={{ fontSize: 8, fill: THEME.textDim }} />
                                <YAxis
                                    dataKey="severity"
                                    type="category"
                                    tick={{ fontSize: 9, fill: THEME.textDim }}
                                    width={70}
                                />
                                <Tooltip contentStyle={TT_STYLE} />
                                <Bar dataKey="value" radius={[0, 3, 3, 0]}>
                                    {incidentData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </Panel>
                </div>

                {/* Row 4: Incident Feed with enhanced styling */}
                <div style={{ marginTop: 16 }}>
                    <Panel title="Recent Incident Timeline" icon={AlertTriangle} accentColor={THEME.warning}>
                        <DemoTable
                            columns={[
                                { key: 'incident', label: 'Incident', width: '30%' },
                                { key: 'severity', label: 'Severity', width: '15%' },
                                { key: 'status', label: 'Status', width: '15%' },
                                { key: 'duration', label: 'Duration', width: '18%' },
                                { key: 'resolved', label: 'Resolved', width: '22%' },
                            ]}
                            rows={[
                                {
                                    incident: 'High CPU Usage',
                                    severity: '🔴 Critical',
                                    status: '✓ Resolved',
                                    duration: '2h 15m',
                                    resolved: '1d ago',
                                },
                                {
                                    incident: 'Memory Leak Detected',
                                    severity: '🟡 High',
                                    status: '✓ Resolved',
                                    duration: '45m',
                                    resolved: '3d ago',
                                },
                                {
                                    incident: 'Disk Space Warning',
                                    severity: '🟢 Medium',
                                    status: '✓ Resolved',
                                    duration: '30m',
                                    resolved: '1w ago',
                                },
                            ]}
                            color={db.color}
                        />
                    </Panel>
                </div>
            </>
        );
    }

    /* ══════════════════════════════════════════════════════════════════════
     ALERTS: KPI cards + Alert Feed + Alert Rules DonutWidget + Frequency chart
     ══════════════════════════════════════════════════════════════════════ */
    if (subTabId === 'alerts') {
        const alertFreqData = gen7d(seed, 4, 2);
        const severityDistData = [
            { name: 'Critical', value: Math.floor(hashNorm(`${seed}-as-c`) * 5 + 2), color: THEME.danger },
            { name: 'High', value: Math.floor(hashNorm(`${seed}-as-h`) * 15 + 8), color: THEME.warning },
            { name: 'Medium', value: Math.floor(hashNorm(`${seed}-as-m`) * 25 + 15), color: db.color },
            { name: 'Low', value: Math.floor(hashNorm(`${seed}-as-l`) * 20 + 10), color: THEME.success },
        ];

        return (
            <>
                {/* Row 1: 6 Enhanced KPI cards with status indicators */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 18 }}>
                    <Panel title="Active Alerts" icon={AlertTriangle} accentColor={THEME.warning}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                            <div
                                style={{
                                    fontSize: 28,
                                    fontWeight: 800,
                                    color: THEME.warning,
                                    letterSpacing: '-0.02em',
                                }}
                            >
                                {Math.floor(hashNorm(`${seed}-aa`) * 10 + 2)}
                            </div>
                            <div style={{ fontSize: 9, color: THEME.textDim }}>Currently active</div>
                            <div
                                style={{
                                    fontSize: 8,
                                    color: THEME.warning,
                                    fontWeight: 600,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 4,
                                }}
                            >
                                <span style={{ width: 5, height: 5, borderRadius: '50%', background: THEME.warning }} />
                                Needs attention
                            </div>
                        </div>
                    </Panel>
                    <Panel title="Acknowledged" icon={CheckCircle} accentColor={THEME.success}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                            <div
                                style={{
                                    fontSize: 28,
                                    fontWeight: 800,
                                    color: THEME.success,
                                    letterSpacing: '-0.02em',
                                }}
                            >
                                {Math.floor(hashNorm(`${seed}-ack`) * 8 + 5)}
                            </div>
                            <div style={{ fontSize: 9, color: THEME.textDim }}>Being handled</div>
                            <div style={{ fontSize: 8, color: THEME.success, fontWeight: 600 }}>✓ In progress</div>
                        </div>
                    </Panel>
                    <Panel title="Unacknowledged" icon={Bell} accentColor={THEME.danger}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                            <div
                                style={{ fontSize: 28, fontWeight: 800, color: THEME.danger, letterSpacing: '-0.02em' }}
                            >
                                {Math.floor(hashNorm(`${seed}-uack`) * 15 + 3)}
                            </div>
                            <div style={{ fontSize: 9, color: THEME.textDim }}>Not yet seen</div>
                            <div style={{ fontSize: 8, color: THEME.danger, fontWeight: 600 }}>⚠ Action needed</div>
                        </div>
                    </Panel>
                    <Panel title="Resolved Today" icon={CheckCircle} accentColor={THEME.success}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                            <div
                                style={{
                                    fontSize: 28,
                                    fontWeight: 800,
                                    color: THEME.success,
                                    letterSpacing: '-0.02em',
                                }}
                            >
                                {Math.floor(hashNorm(`${seed}-res`) * 8 + 2)}
                            </div>
                            <div style={{ fontSize: 9, color: THEME.textDim }}>Fixed today</div>
                            <MiniSparkline
                                data={alertFreqData.map((d) => ({ value: d.value }))}
                                color={THEME.success}
                                width={80}
                                height={16}
                            />
                        </div>
                    </Panel>
                    <Panel title="Alert Rules" icon={Shield} accentColor={db.color}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                            <div style={{ fontSize: 28, fontWeight: 800, color: db.color, letterSpacing: '-0.02em' }}>
                                34
                            </div>
                            <div style={{ fontSize: 9, color: THEME.textDim, marginBottom: 2 }}>Total configured</div>
                            <div style={{ display: 'flex', gap: 4 }}>
                                <div
                                    style={{
                                        flex: 1,
                                        minWidth: 0,
                                        height: 4,
                                        background: `${THEME.success}30`,
                                        borderRadius: 2,
                                        overflow: 'hidden',
                                    }}
                                >
                                    <div style={{ width: '82%', height: '100%', background: THEME.success }} />
                                </div>
                                <span style={{ fontSize: 8, color: THEME.success, fontWeight: 600 }}>28</span>
                            </div>
                        </div>
                    </Panel>
                    <Panel title="MTTA" icon={Clock} accentColor={db.color}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                            <div style={{ fontSize: 28, fontWeight: 800, color: db.color, letterSpacing: '-0.02em' }}>
                                {Math.floor(hashNorm(`${seed}-mtta`) * 8 + 3)}m
                            </div>
                            <div style={{ fontSize: 9, color: THEME.textDim }}>Mean time to ack</div>
                            <div style={{ fontSize: 8, color: THEME.success, fontWeight: 600 }}>↓ Improved</div>
                        </div>
                    </Panel>
                </div>

                {/* Row 2: Active Alerts List */}
                <div style={{ marginTop: 16 }}>
                    <Panel title="Active Alerts List" icon={AlertTriangle} accentColor={THEME.warning}>
                        <DemoTable
                            columns={[
                                { key: 'alert', label: 'Alert Message', width: '35%' },
                                { key: 'severity', label: 'Severity', width: '15%' },
                                { key: 'status', label: 'Status', width: '15%' },
                                { key: 'source', label: 'Source', width: '18%' },
                                { key: 'time', label: 'Time', width: '17%' },
                            ]}
                            rows={[
                                {
                                    alert: 'High CPU Usage',
                                    severity: '🟡 Warning',
                                    status: 'Active',
                                    source: 'System',
                                    time: '5 min',
                                },
                                {
                                    alert: 'Replication Lag > 1s',
                                    severity: '🔴 Critical',
                                    status: 'Resolved',
                                    source: 'Replication',
                                    time: '2 hrs',
                                },
                                {
                                    alert: 'Disk Usage > 80%',
                                    severity: '🟡 Warning',
                                    status: 'Active',
                                    source: 'Storage',
                                    time: '15 min',
                                },
                                {
                                    alert: 'Connection Pool Full',
                                    severity: '🔴 Critical',
                                    status: 'Resolved',
                                    source: 'Connections',
                                    time: '1 day',
                                },
                                {
                                    alert: 'Slow Query > 10s',
                                    severity: '🟢 Info',
                                    status: 'Active',
                                    source: 'Query',
                                    time: '30 min',
                                },
                            ]}
                            color={db.color}
                        />
                    </Panel>
                </div>

                {/* Row 3: Alert Trend + Rules Configuration */}
                <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                    <Panel title="Alert Frequency (7 Days)" icon={Activity} accentColor={db.color}>
                        <ResponsiveContainer width="100%" height={140}>
                            <BarChart data={alertFreqData}>
                                <CartesianGrid strokeDasharray="3 3" stroke={THEME.gridLine} opacity={0.3} />
                                <XAxis dataKey="day" tick={{ fontSize: 9, fill: THEME.textDim }} />
                                <YAxis tick={{ fontSize: 8, fill: THEME.textDim }} width={30} />
                                <Tooltip contentStyle={TT_STYLE} />
                                <Bar dataKey="value" fill={db.color} radius={[3, 3, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                        <div
                            style={{
                                fontSize: 9,
                                color: THEME.textDim,
                                marginTop: 8,
                                paddingTop: 8,
                                borderTop: `1px solid ${THEME.gridLine}`,
                            }}
                        >
                            <span>Avg: </span>
                            <span style={{ color: db.color, fontWeight: 600 }}>
                                {Math.ceil(alertFreqData.reduce((s, d) => s + d.value, 0) / alertFreqData.length)}{' '}
                                alerts/day
                            </span>
                        </div>
                    </Panel>
                    <Panel title="Alert Rules Summary" icon={Shield} accentColor={db.color}>
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0' }}>
                            <DonutWidget
                                data={[
                                    { name: 'Active', value: 28, color: THEME.success, display: '28' },
                                    { name: 'Disabled', value: 6, color: THEME.textDim, display: '6' },
                                ]}
                                centerValue="34"
                                centerLabel="RULES"
                                color={db.color}
                                size={120}
                                innerRadius={40}
                                outerRadius={55}
                            />
                        </div>
                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 1fr',
                                gap: 18,
                                marginTop: 14,
                                paddingTop: 14,
                                borderTop: `1px solid ${THEME.gridLine}`,
                                fontSize: 9,
                            }}
                        >
                            <div>
                                <span style={{ color: THEME.textDim }}>Active: </span>
                                <span style={{ color: THEME.success, fontWeight: 600 }}>28</span>
                            </div>
                            <div>
                                <span style={{ color: THEME.textDim }}>Disabled: </span>
                                <span style={{ color: THEME.textDim, fontWeight: 600 }}>6</span>
                            </div>
                        </div>
                    </Panel>
                </div>

                {/* Row 4: Severity Distribution with color-coded bars */}
                <div style={{ marginTop: 16 }}>
                    <Panel title="Alert Severity Distribution" icon={BarChart3} accentColor={THEME.warning}>
                        <ResponsiveContainer width="100%" height={160}>
                            <BarChart data={severityDistData} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke={THEME.gridLine} opacity={0.3} />
                                <XAxis type="number" tick={{ fontSize: 8, fill: THEME.textDim }} />
                                <YAxis
                                    dataKey="name"
                                    type="category"
                                    tick={{ fontSize: 10, fill: THEME.textDim }}
                                    width={75}
                                />
                                <Tooltip contentStyle={TT_STYLE} />
                                <Bar dataKey="value" radius={[0, 3, 3, 0]}>
                                    {severityDistData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(4, 1fr)',
                                gap: 22,
                                marginTop: 14,
                                paddingTop: 14,
                                borderTop: `1px solid ${THEME.gridLine}`,
                            }}
                        >
                            {severityDistData.map((item, i) => (
                                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    <div
                                        style={{
                                            fontSize: 8,
                                            color: THEME.textDim,
                                            fontWeight: 600,
                                            letterSpacing: '0.02em',
                                        }}
                                    >
                                        {item.name}
                                    </div>
                                    <div style={{ fontSize: 16, fontWeight: 800, color: item.color }}>{item.value}</div>
                                </div>
                            ))}
                        </div>
                    </Panel>
                </div>
            </>
        );
    }

    /* ══════════════════════════════════════════════════════════════════
     QUERY & INDEXES section tabs
     ══════════════════════════════════════════════════════════════════ */

    /* ══════════════════════════════════════════════════════════════════════
     QUERY OPTIMIZER: KPI cards + Scan Distribution + Plan Cost + Expensive Queries
     ══════════════════════════════════════════════════════════════════════ */
    if (subTabId === 'optimizer') {
        const scanData = [
            { name: 'Index Scan', value: Math.floor(hashNorm(`${seed}-idx`) * 15 + 75), color: db.color },
            { name: 'Seq Scan', value: Math.floor(hashNorm(`${seed}-seq`) * 10 + 5), color: THEME.warning },
            { name: 'Bitmap Scan', value: Math.floor(hashNorm(`${seed}-bmp`) * 8 + 3), color: THEME.success },
        ];
        return (
            <>
                {/* Row 1: 5 KPI cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 18 }}>
                    <Panel title="Total Cost" icon={Zap} accentColor={db.color}>
                        <StatCard
                            label="Avg"
                            value={`${Math.floor(hashNorm(`${seed}-tc`) * 500 + 100)}`}
                            unit=""
                            color={db.color}
                        />
                    </Panel>
                    <Panel title="Planning Time" icon={Clock} accentColor={db.color}>
                        <StatCard
                            label="Avg"
                            value={`${(hashNorm(`${seed}-pt`) * 50 + 10).toFixed(1)}`}
                            unit="ms"
                            color={db.color}
                        />
                    </Panel>
                    <Panel title="Execution Time" icon={Clock} accentColor={db.color}>
                        <StatCard
                            label="Avg"
                            value={`${(hashNorm(`${seed}-et`) * 100 + 20).toFixed(1)}`}
                            unit="ms"
                            color={db.color}
                        />
                    </Panel>
                    <Panel title="Buffer Hit" icon={Zap} accentColor={THEME.success}>
                        <StatCard
                            label="Ratio"
                            value={`${Math.floor(hashNorm(`${seed}-bh`) * 10 + 85)}`}
                            unit="%"
                            color={THEME.success}
                        />
                    </Panel>
                    <Panel title="Rows Out" icon={Database} accentColor={db.color}>
                        <StatCard
                            label="Avg"
                            value={`${Math.floor(hashNorm(`${seed}-ro`) * 10000 + 100)}`}
                            unit=""
                            color={db.color}
                        />
                    </Panel>
                </div>

                {/* Row 2: Scan Type Distribution DonutWidget + Query Plan Cost Trend LineChart */}
                <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                    <Panel title="Scan Type Distribution" icon={Eye} accentColor={db.color}>
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0' }}>
                            <DonutWidget
                                data={scanData.map((s) => ({ ...s, display: `${s.value}%` }))}
                                centerValue={`${scanData[0].value}%`}
                                centerLabel="INDEX"
                                color={db.color}
                                size={120}
                                innerRadius={40}
                                outerRadius={54}
                            />
                        </div>
                    </Panel>
                    <Panel title="Query Plan Cost Trend (24h)" icon={Zap} accentColor={db.color}>
                        <ResponsiveContainer width="100%" height={160}>
                            <LineChart data={gen24h(seed, 100, 200, 50, 100)}>
                                <CartesianGrid strokeDasharray="3 3" stroke={THEME.gridLine} />
                                <XAxis dataKey="time" tick={{ fontSize: 8, fill: THEME.textDim }} interval={5} />
                                <YAxis tick={{ fontSize: 9, fill: THEME.textDim }} width={35} />
                                <Tooltip contentStyle={TT_STYLE} />
                                <Line
                                    type="monotone"
                                    dataKey="primary"
                                    name="Avg Cost"
                                    stroke={db.color}
                                    strokeWidth={2}
                                    dot={false}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="secondary"
                                    name="P95 Cost"
                                    stroke={THEME.warning}
                                    strokeWidth={1.5}
                                    dot={false}
                                    strokeDasharray="4 2"
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </Panel>
                </div>

                {/* Row 3: Top Expensive Queries DemoTable */}
                <div style={{ marginTop: 16 }}>
                    <Panel title="Top Expensive Queries" icon={Zap} accentColor={THEME.warning}>
                        <DemoTable
                            columns={[
                                { key: 'query', label: 'Query Pattern', width: '45%' },
                                { key: 'cost', label: 'Avg Cost', width: '15%' },
                                { key: 'calls', label: 'Calls/hr', width: '15%' },
                                { key: 'scanType', label: 'Scan Type', width: '25%' },
                            ]}
                            rows={(DB_SLOW_QUERIES[key] || DB_SLOW_QUERIES.postgresql).slice(0, 5).map((q, i) => ({
                                query: q.label,
                                cost: Math.floor(hashNorm(`${seed}-c-${i}`) * 500 + 50),
                                calls: Math.floor(hashNorm(`${seed}-cl-${i}`) * 300 + 10),
                                scanType: ['Index Scan', 'Seq Scan', 'Bitmap Scan', 'Index Only', 'Seq Scan'][i % 5],
                            }))}
                            color={db.color}
                        />
                    </Panel>
                </div>
            </>
        );
    }

    /* ══════════════════════════════════════════════════════════════════════
     INDEXES: KPI cards + Index Usage Analysis + Size vs Bloat + Health
     ══════════════════════════════════════════════════════════════════════ */
    if (subTabId === 'indexes') {
        return (
            <>
                {/* Row 1: 5 KPI cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 18 }}>
                    <Panel title="Hit Ratio" icon={Zap} accentColor={THEME.success}>
                        <StatCard
                            label="Ratio"
                            value={`${Math.floor(hashNorm(`${seed}-ihr`) * 10 + 85)}`}
                            unit="%"
                            color={THEME.success}
                        />
                    </Panel>
                    <Panel title="Open Issues" icon={AlertTriangle} accentColor={THEME.warning}>
                        <StatCard
                            label="Count"
                            value={`${Math.floor(hashNorm(`${seed}-oi`) * 15 + 3)}`}
                            unit=""
                            color={THEME.warning}
                        />
                    </Panel>
                    <Panel title="Total Indexes" icon={Layers} accentColor={db.color}>
                        <StatCard
                            label="Count"
                            value={`${Math.floor(hashNorm(`${seed}-ti`) * 200 + 100)}`}
                            unit=""
                            color={db.color}
                        />
                    </Panel>
                    <Panel title="Index Storage" icon={HardDrive} accentColor={db.color}>
                        <StatCard
                            label="Used"
                            value={`${Math.floor(hashNorm(`${seed}-is`) * 500 + 100)}`}
                            unit="MB"
                            color={db.color}
                        />
                    </Panel>
                    <Panel title="Seq Scan Rate" icon={Activity} accentColor={THEME.warning}>
                        <StatCard
                            label="Per Min"
                            value={`${Math.floor(hashNorm(`${seed}-ssr`) * 50 + 10)}`}
                            unit=""
                            color={THEME.warning}
                        />
                    </Panel>
                </div>

                {/* Row 2: Index Usage Analysis DemoTable */}
                <div style={{ marginTop: 16 }}>
                    <Panel title="Index Usage Analysis" icon={Layers} accentColor={db.color}>
                        <DemoTable
                            columns={[
                                { key: 'index', label: 'Index Name', width: '30%' },
                                { key: 'table', label: 'Table', width: '20%' },
                                { key: 'scans', label: 'Scans', width: '12%' },
                                { key: 'size', label: 'Size', width: '12%' },
                                { key: 'usage', label: 'Usage', width: '13%' },
                                { key: 'status', label: 'Status', width: '13%' },
                            ]}
                            rows={(DB_TABLE_NAMES[key] || DB_TABLE_NAMES.postgresql).slice(0, 6).map((t, i) => ({
                                index: `idx_${t}_${['pkey', 'created', 'status', 'name', 'email', 'type'][i % 6]}`,
                                table: t,
                                scans: Math.floor(hashNorm(`${seed}-sc-${i}`) * 5000 + 100),
                                size: `${Math.floor(hashNorm(`${seed}-sz-${i}`) * 50 + 1)} MB`,
                                usage: `${Math.floor(hashNorm(`${seed}-us-${i}`) * 40 + 60)}%`,
                                status: i < 4 ? 'Active' : 'Unused',
                            }))}
                            color={db.color}
                        />
                    </Panel>
                </div>

                {/* Row 3: 2-col — Index Size vs Bloat BarChart | Index Health RingGauge */}
                <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                    <Panel title="Index Size vs Bloat" icon={BarChart3} accentColor={db.color}>
                        <ResponsiveContainer width="100%" height={150}>
                            <BarChart
                                data={(DB_TABLE_NAMES[key] || DB_TABLE_NAMES.postgresql).slice(0, 5).map((t, i) => ({
                                    name: t.substring(0, 10),
                                    size: Math.floor(hashNorm(`${seed}-is-${i}`) * 80 + 10),
                                    bloat: Math.floor(hashNorm(`${seed}-ib-${i}`) * 15 + 1),
                                }))}
                            >
                                <XAxis dataKey="name" tick={{ fontSize: 8, fill: THEME.textDim }} />
                                <YAxis tick={{ fontSize: 9, fill: THEME.textDim }} width={28} unit="MB" />
                                <Tooltip contentStyle={TT_STYLE} />
                                <Bar dataKey="size" name="Size" fill={db.color} radius={[2, 2, 0, 0]} />
                                <Bar dataKey="bloat" name="Bloat" fill={THEME.warning} radius={[2, 2, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </Panel>
                    <Panel title="Index Health" icon={Shield} accentColor={THEME.success}>
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0' }}>
                            <RingGauge
                                value={Math.floor(hashNorm(`${seed}-ih`) * 10 + 88)}
                                color={THEME.success}
                                size={90}
                                strokeWidth={7}
                                label="HEALTH"
                            />
                        </div>
                    </Panel>
                </div>
            </>
        );
    }

    /* ══════════════════════════════════════════════════════════════════════
     PLAN REGRESSION: Plan Changes AreaChart (7d) + Regression Events table
     ══════════════════════════════════════════════════════════════════════ */
    if (subTabId === 'regression') {
        return (
            <>
                {/* Row 1: Plan Changes AreaChart (7d) */}
                <Panel title="Query Plan Changes (7d)" icon={TrendingUp} accentColor={db.color}>
                    <ResponsiveContainer width="100%" height={180}>
                        <AreaChart
                            data={gen7d(seed, 0, 5).map((d) => ({
                                ...d,
                                regressions: Math.floor(hashNorm(`${seed}-r-${d.day}`) * 2),
                            }))}
                        >
                            <CartesianGrid strokeDasharray="3 3" stroke={THEME.gridLine} />
                            <XAxis dataKey="day" tick={{ fontSize: 9, fill: THEME.textDim }} />
                            <YAxis tick={{ fontSize: 9, fill: THEME.textDim }} width={24} />
                            <Tooltip contentStyle={TT_STYLE} />
                            <Area
                                type="monotone"
                                dataKey="value"
                                name="Plan Changes"
                                stroke={db.color}
                                fill={`${db.color}20`}
                                strokeWidth={2}
                            />
                            <Area
                                type="monotone"
                                dataKey="regressions"
                                name="Regressions"
                                stroke={THEME.warning}
                                fill={`${THEME.warning}15`}
                                strokeWidth={1.5}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </Panel>

                {/* Row 2: Recent Regression Events DemoTable */}
                <div style={{ marginTop: 16 }}>
                    <Panel title="Recent Regression Events" icon={AlertTriangle} accentColor={THEME.warning}>
                        <DemoTable
                            columns={[
                                { key: 'query', label: 'Query', width: '40%' },
                                { key: 'oldPlan', label: 'Old Plan', width: '15%' },
                                { key: 'newPlan', label: 'New Plan', width: '15%' },
                                { key: 'impact', label: 'Impact', width: '15%' },
                                { key: 'detected', label: 'Detected', width: '15%' },
                            ]}
                            rows={['SELECT users', 'JOIN orders', 'UPDATE inventory', 'SELECT products'].map(
                                (q, i) => ({
                                    query: q,
                                    oldPlan: 'Index Scan',
                                    newPlan: i % 2 === 0 ? 'Seq Scan' : 'Hash Join',
                                    impact: `+${Math.floor(hashNorm(`${seed}-ri-${i}`) * 200 + 10)}ms`,
                                    detected: `${Math.floor(hashNorm(`${seed}-rd-${i}`) * 48 + 1)}h ago`,
                                }),
                            )}
                            color={db.color}
                        />
                    </Panel>
                </div>
            </>
        );
    }

    /* ══════════════════════════════════════════════════════════════════════
     BLOAT ANALYSIS: Bloat Distribution BarChart + 3 KPI cards
     ══════════════════════════════════════════════════════════════════════ */
    if (subTabId === 'bloat') {
        const tables = (DB_TABLE_NAMES[key] || DB_TABLE_NAMES.postgresql).slice(0, 6);
        return (
            <>
                {/* Row 1: Table Bloat Distribution horizontal BarChart */}
                <Panel title="Table Bloat Distribution" icon={Layers} accentColor={THEME.warning}>
                    <ResponsiveContainer width="100%" height={200}>
                        <BarChart
                            data={tables.map((t, i) => ({
                                name: t.substring(0, 12),
                                bloat: Math.floor(hashNorm(`${seed}-bl-${i}`) * 30 + 2),
                                actual: Math.floor(hashNorm(`${seed}-act-${i}`) * 200 + 50),
                            }))}
                            layout="vertical"
                        >
                            <XAxis type="number" tick={{ fontSize: 9, fill: THEME.textDim }} unit="MB" />
                            <YAxis
                                dataKey="name"
                                type="category"
                                tick={{ fontSize: 9, fill: THEME.textDim }}
                                width={80}
                            />
                            <Tooltip contentStyle={TT_STYLE} />
                            <Bar dataKey="actual" name="Table Size" fill={db.color} radius={[0, 2, 2, 0]} />
                            <Bar dataKey="bloat" name="Bloat" fill={THEME.warning} radius={[0, 2, 2, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </Panel>

                {/* Row 2: 3 stat cards */}
                <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
                    <Panel title="Total Bloat" icon={Layers} accentColor={THEME.warning}>
                        <StatCard
                            label="Across all tables"
                            value={`${Math.floor(hashNorm(`${seed}-tb`) * 200 + 50)}`}
                            unit="MB"
                            color={THEME.warning}
                        />
                    </Panel>
                    <Panel title="Bloat Ratio" icon={BarChart3} accentColor={db.color}>
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0' }}>
                            <RingGauge
                                value={Math.floor(hashNorm(`${seed}-br`) * 15 + 5)}
                                color={THEME.warning}
                                size={80}
                                strokeWidth={6}
                                label="BLOAT"
                            />
                        </div>
                    </Panel>
                    <Panel title="Vacuum Needed" icon={RefreshCw} accentColor={THEME.success}>
                        <StatCard
                            label="Tables pending"
                            value={`${Math.floor(hashNorm(`${seed}-vn`) * 5 + 1)}`}
                            color={db.color}
                        />
                    </Panel>
                </div>
            </>
        );
    }

    /* ══════════════════════════════════════════════════════════════════════
     TABLE ANALYSIS: Table Statistics DemoTable + Table I/O Distribution BarChart
     ══════════════════════════════════════════════════════════════════════ */
    if (subTabId === 'table') {
        return (
            <>
                {/* Row 1: Table Statistics DemoTable */}
                <Panel title="Table Statistics" icon={Database} accentColor={db.color}>
                    <DemoTable
                        columns={[
                            { key: 'table', label: 'Table', width: '22%' },
                            { key: 'rows', label: 'Rows', width: '13%' },
                            { key: 'size', label: 'Size', width: '13%' },
                            { key: 'seqScans', label: 'Seq Scans', width: '13%' },
                            { key: 'idxScans', label: 'Idx Scans', width: '13%' },
                            { key: 'deadTuples', label: 'Dead Tuples', width: '13%' },
                            { key: 'lastVacuum', label: 'Last Vacuum', width: '13%' },
                        ]}
                        rows={(DB_TABLE_NAMES[key] || DB_TABLE_NAMES.postgresql).slice(0, 8).map((t, i) => ({
                            table: t,
                            rows: `${Math.floor(hashNorm(`${seed}-r-${i}`) * 500 + 10)}K`,
                            size: `${Math.floor(hashNorm(`${seed}-s-${i}`) * 100 + 5)} MB`,
                            seqScans: Math.floor(hashNorm(`${seed}-ss-${i}`) * 100),
                            idxScans: Math.floor(hashNorm(`${seed}-is-${i}`) * 5000 + 100),
                            deadTuples: Math.floor(hashNorm(`${seed}-dt-${i}`) * 1000),
                            lastVacuum: `${Math.floor(hashNorm(`${seed}-lv-${i}`) * 24 + 1)}h ago`,
                        }))}
                        color={db.color}
                    />
                </Panel>

                {/* Row 2: Table I/O Distribution BarChart */}
                <div style={{ marginTop: 16 }}>
                    <Panel title="Table I/O Distribution" icon={Activity} accentColor={db.color}>
                        <ResponsiveContainer width="100%" height={160}>
                            <BarChart
                                data={(DB_TABLE_NAMES[key] || DB_TABLE_NAMES.postgresql).slice(0, 5).map((t, i) => ({
                                    name: t.substring(0, 10),
                                    reads: Math.floor(hashNorm(`${seed}-tr-${i}`) * 80 + 10),
                                    writes: Math.floor(hashNorm(`${seed}-tw-${i}`) * 40 + 5),
                                }))}
                            >
                                <XAxis dataKey="name" tick={{ fontSize: 8, fill: THEME.textDim }} />
                                <YAxis tick={{ fontSize: 9, fill: THEME.textDim }} width={28} />
                                <Tooltip contentStyle={TT_STYLE} />
                                <Bar dataKey="reads" name="Reads" fill={db.color} radius={[2, 2, 0, 0]} />
                                <Bar dataKey="writes" name="Writes" fill={`${db.color}80`} radius={[2, 2, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </Panel>
                </div>
            </>
        );
    }

    /* ══════════════════════════════════════════════════════════════════
     INFRASTRUCTURE section tabs
     ══════════════════════════════════════════════════════════════════ */

    /* ── Connection Pool: pool gauge + connection history ── */
    /* ══════════════════════════════════════════════════════════════════════
     CONNECTION POOL: Pool Utilization RingGauge + Connection History chart + DemoTable
     ══════════════════════════════════════════════════════════════════════ */
    if (subTabId === 'pool') {
        return (
            <>
                {/* Row 1: 2-col — Pool Utilization RingGauge + stats | Connection History AreaChart */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 20 }}>
                    <Panel title="Pool Utilization" icon={Network} accentColor={db.color}>
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0' }}>
                            <RingGauge
                                value={Math.floor(hashNorm(`${seed}-pu`) * 30 + 30)}
                                color={db.color}
                                size={110}
                                strokeWidth={9}
                                label="POOL"
                            />
                        </div>
                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 1fr',
                                gap: 6,
                                fontSize: 10,
                                padding: '0 12px 10px',
                            }}
                        >
                            <div>
                                <span style={{ color: THEME.textDim }}>Active</span>{' '}
                                <span style={{ color: THEME.textMain, fontWeight: 600 }}>
                                    {Math.floor(hashNorm(`${seed}-ac`) * 30 + 10)}
                                </span>
                            </div>
                            <div>
                                <span style={{ color: THEME.textDim }}>Idle</span>{' '}
                                <span style={{ color: THEME.textMain, fontWeight: 600 }}>
                                    {Math.floor(hashNorm(`${seed}-id`) * 15 + 2)}
                                </span>
                            </div>
                            <div>
                                <span style={{ color: THEME.textDim }}>Waiting</span>{' '}
                                <span style={{ color: THEME.textMain, fontWeight: 600 }}>
                                    {Math.floor(hashNorm(`${seed}-wt`) * 3)}
                                </span>
                            </div>
                            <div>
                                <span style={{ color: THEME.textDim }}>Max</span>{' '}
                                <span style={{ color: THEME.textMain, fontWeight: 600 }}>100</span>
                            </div>
                        </div>
                    </Panel>
                    <Panel title="Connection History (24h)" icon={Activity} accentColor={db.color}>
                        <ResponsiveContainer width="100%" height={200}>
                            <AreaChart data={gen24h(seed, 10, 40, 2, 10)}>
                                <CartesianGrid strokeDasharray="3 3" stroke={THEME.gridLine} />
                                <XAxis dataKey="time" tick={{ fontSize: 9, fill: THEME.textDim }} interval={3} />
                                <YAxis tick={{ fontSize: 9, fill: THEME.textDim }} width={30} />
                                <Tooltip contentStyle={TT_STYLE} />
                                <Area
                                    type="monotone"
                                    dataKey="primary"
                                    name="Active"
                                    stroke={db.color}
                                    fill={`${db.color}20`}
                                    strokeWidth={2}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="secondary"
                                    name="Waiting"
                                    stroke={THEME.warning}
                                    fill={`${THEME.warning}10`}
                                    strokeWidth={1.5}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </Panel>
                </div>

                {/* Row 2: Connection List DemoTable */}
                <div style={{ marginTop: 16 }}>
                    <Panel title="Connection List" icon={Network} accentColor={db.color}>
                        <DemoTable
                            columns={[
                                { key: 'name', label: 'Connection', width: '20%' },
                                { key: 'host', label: 'Host', width: '20%' },
                                { key: 'status', label: 'Status', width: '15%' },
                                { key: 'poolSize', label: 'Pool Size', width: '15%' },
                                { key: 'active', label: 'Active', width: '15%' },
                            ]}
                            rows={['App Server 1', 'App Server 2', 'Analytics', 'Reports', 'Backup'].map((name, i) => ({
                                name: name,
                                host: `192.168.1.${100 + i}`,
                                status: 'Active',
                                poolSize: `${50 + i * 10}`,
                                active: `${10 + i * 3}`,
                            }))}
                            color={db.color}
                        />
                    </Panel>
                </div>
            </>
        );
    }

    /* ══════════════════════════════════════════════════════════════════════
     REPLICATION & WAL: Streaming Replicas + Replication Lag + Replica Details
     ══════════════════════════════════════════════════════════════════════ */
    if (subTabId === 'replication') {
        return (
            <>
                {/* Row 1: 4 KPI cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 18 }}>
                    <Panel title="Streaming Replicas" icon={Radio} accentColor={THEME.success}>
                        <StatCard
                            label="Active"
                            value={`${Math.floor(hashNorm(`${seed}-sr`) * 4 + 1)}`}
                            unit=""
                            color={THEME.success}
                        />
                    </Panel>
                    <Panel title="Max Replay Lag" icon={Clock} accentColor={db.color}>
                        <StatCard
                            label="Max"
                            value={`${(hashNorm(`${seed}-mrl`) * 5).toFixed(2)}`}
                            unit="ms"
                            color={db.color}
                        />
                    </Panel>
                    <Panel title="Replication Slots" icon={Database} accentColor={db.color}>
                        <StatCard
                            label="Active"
                            value={`${Math.floor(hashNorm(`${seed}-rs`) * 3 + 1)}`}
                            unit=""
                            color={db.color}
                        />
                    </Panel>
                    <Panel title="Current WAL" icon={Archive} accentColor={db.color}>
                        <StatCard
                            label="Position"
                            value={`${Math.floor(hashNorm(`${seed}-cwal`) * 100)}`}
                            unit=""
                            color={db.color}
                        />
                    </Panel>
                </div>

                {/* Row 2: Replication Lag AreaChart (24h) */}
                <div style={{ marginTop: 16 }}>
                    <Panel title="Replication Lag (24h)" icon={Radio} accentColor={db.color}>
                        <ResponsiveContainer width="100%" height={180}>
                            <AreaChart
                                data={gen24h(seed, 0, 2, 0, 1).map((d) => ({
                                    ...d,
                                    lag: +(d.primary * 0.3).toFixed(1),
                                }))}
                            >
                                <CartesianGrid strokeDasharray="3 3" stroke={THEME.gridLine} />
                                <XAxis dataKey="time" tick={{ fontSize: 9, fill: THEME.textDim }} interval={3} />
                                <YAxis tick={{ fontSize: 9, fill: THEME.textDim }} width={30} unit="ms" />
                                <Tooltip contentStyle={TT_STYLE} />
                                <Area
                                    type="monotone"
                                    dataKey="lag"
                                    name="Lag"
                                    stroke={db.color}
                                    fill={`${db.color}20`}
                                    strokeWidth={2}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </Panel>
                </div>

                {/* Row 3: Replica Details DemoTable */}
                <div style={{ marginTop: 16 }}>
                    <Panel title="Replica Details" icon={Radio} accentColor={db.color}>
                        <DemoTable
                            columns={[
                                { key: 'replica', label: 'Replica', width: '20%' },
                                { key: 'state', label: 'State', width: '15%' },
                                { key: 'lag', label: 'Lag', width: '15%' },
                                { key: 'sentLsn', label: 'Sent LSN', width: '25%' },
                                { key: 'flushLsn', label: 'Flush LSN', width: '25%' },
                            ]}
                            rows={['standby-1', 'standby-2', 'standby-3'].map((name, i) => ({
                                replica: name,
                                state: 'Streaming',
                                lag: `${(hashNorm(`${seed}-lag-${i}`) * 2).toFixed(2)}ms`,
                                sentLsn: `0/${Math.floor(hashNorm(`${seed}-sent-${i}`) * 1000000000)
                                    .toString(16)
                                    .padStart(8, '0')}`,
                                flushLsn: `0/${Math.floor(hashNorm(`${seed}-flush-${i}`) * 1000000000)
                                    .toString(16)
                                    .padStart(8, '0')}`,
                            }))}
                            color={db.color}
                        />
                    </Panel>
                </div>

                {/* Row 4: WAL Configuration stats cards */}
                <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 20 }}>
                    <Panel title="WAL Level" icon={Activity} accentColor={db.color}>
                        <StatCard label="Setting" value="replica" unit="" color={db.color} />
                    </Panel>
                    <Panel title="Checkpoint Duration" icon={Clock} accentColor={db.color}>
                        <StatCard label="Avg" value="12" unit="sec" color={db.color} />
                    </Panel>
                    <Panel title="Archiving" icon={Archive} accentColor={THEME.success}>
                        <StatCard label="Status" value="Active" unit="" color={THEME.success} />
                    </Panel>
                    <Panel title="WAL Files" icon={Database} accentColor={db.color}>
                        <StatCard
                            label="Current"
                            value={`${Math.floor(hashNorm(`${seed}-wf`) * 30 + 20)}`}
                            unit=""
                            color={db.color}
                        />
                    </Panel>
                </div>
            </>
        );
    }

    /* ══════════════════════════════════════════════════════════════════════
     CHECKPOINT MONITOR: Checkpoint Frequency + Duration Trend + KPI cards
     ══════════════════════════════════════════════════════════════════════ */
    if (subTabId === 'checkpoint') {
        return (
            <>
                {/* Row 1: 2-col — Checkpoint Frequency BarChart | Duration Trend LineChart */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                    <Panel title="Checkpoint Frequency (24h)" icon={CheckCircle} accentColor={db.color}>
                        <ResponsiveContainer width="100%" height={160}>
                            <BarChart data={gen24h(seed, 8, 6, 5, 10)}>
                                <CartesianGrid strokeDasharray="3 3" stroke={THEME.gridLine} />
                                <XAxis dataKey="time" tick={{ fontSize: 8, fill: THEME.textDim }} interval={5} />
                                <YAxis tick={{ fontSize: 9, fill: THEME.textDim }} width={24} />
                                <Tooltip contentStyle={TT_STYLE} />
                                <Bar dataKey="primary" name="Checkpoints" fill={db.color} radius={[2, 2, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </Panel>
                    <Panel title="Duration Trend (24h)" icon={Clock} accentColor={db.color}>
                        <ResponsiveContainer width="100%" height={160}>
                            <LineChart data={gen24h(seed + 'dur', 5, 15, 2, 8)}>
                                <CartesianGrid strokeDasharray="3 3" stroke={THEME.gridLine} />
                                <XAxis dataKey="time" tick={{ fontSize: 8, fill: THEME.textDim }} interval={5} />
                                <YAxis tick={{ fontSize: 9, fill: THEME.textDim }} width={24} unit="s" />
                                <Tooltip contentStyle={TT_STYLE} />
                                <Line
                                    type="monotone"
                                    dataKey="primary"
                                    name="Duration"
                                    stroke={db.color}
                                    strokeWidth={2}
                                    dot={false}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="secondary"
                                    name="Write Time"
                                    stroke={THEME.warning}
                                    strokeWidth={1.5}
                                    dot={false}
                                    strokeDasharray="4 2"
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </Panel>
                </div>

                {/* Row 2: 3 stat cards */}
                <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
                    <Panel title="Per Day" icon={Activity} accentColor={db.color}>
                        <StatCard label="Checkpoints" value="288" color={db.color} />
                    </Panel>
                    <Panel title="Avg Duration" icon={Clock} accentColor={db.color}>
                        <StatCard label="Seconds" value="12.5" unit="s" color={db.color} />
                    </Panel>
                    <Panel title="Last Checkpoint" icon={CheckCircle} accentColor={THEME.success}>
                        <StatCard label="Ago" value="45" unit="s" color={THEME.success} />
                    </Panel>
                </div>
            </>
        );
    }

    /* ══════════════════════════════════════════════════════════════════════
     VACUUM & MAINTENANCE: Dead Tuple Accumulation AreaChart + Vacuum Activity table
     ══════════════════════════════════════════════════════════════════════ */
    if (subTabId === 'maintenance') {
        return (
            <>
                <Panel title="Dead Tuple Accumulation (24h)" icon={RefreshCw} accentColor={THEME.warning}>
                    <ResponsiveContainer width="100%" height={180}>
                        <AreaChart data={gen24h(seed, 1000, 5000, 200, 1000)}>
                            <CartesianGrid strokeDasharray="3 3" stroke={THEME.gridLine} />
                            <XAxis dataKey="time" tick={{ fontSize: 9, fill: THEME.textDim }} interval={3} />
                            <YAxis tick={{ fontSize: 9, fill: THEME.textDim }} width={40} />
                            <Tooltip contentStyle={TT_STYLE} />
                            <Area
                                type="monotone"
                                dataKey="primary"
                                name="Dead Tuples"
                                stroke={THEME.warning}
                                fill={`${THEME.warning}15`}
                                strokeWidth={2}
                            />
                            <Area
                                type="monotone"
                                dataKey="secondary"
                                name="Removed"
                                stroke={THEME.success}
                                fill={`${THEME.success}10`}
                                strokeWidth={1.5}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </Panel>
                <div style={{ marginTop: 16 }}>
                    <Panel title="Recent Vacuum Activity" icon={RefreshCw} accentColor={db.color}>
                        <DemoTable
                            columns={[
                                { key: 'table', label: 'Table', width: '25%' },
                                { key: 'type', label: 'Type', width: '15%' },
                                { key: 'duration', label: 'Duration', width: '15%' },
                                { key: 'removed', label: 'Tuples Removed', width: '20%' },
                                { key: 'ago', label: 'Completed', width: '25%' },
                            ]}
                            rows={(DB_TABLE_NAMES[key] || DB_TABLE_NAMES.postgresql).slice(0, 5).map((t, i) => ({
                                table: t,
                                type: i % 2 === 0 ? 'Auto' : 'Manual',
                                duration: `${+(hashNorm(`${seed}-vd-${i}`) * 5 + 0.5).toFixed(1)}s`,
                                removed: `${Math.floor(hashNorm(`${seed}-vr-${i}`) * 50000 + 1000)}`,
                                ago: `${Math.floor(hashNorm(`${seed}-va-${i}`) * 60 + 5)} min ago`,
                            }))}
                            color={db.color}
                        />
                    </Panel>
                </div>
            </>
        );
    }

    /* ══════════════════════════════════════════════════════════════════════
     CAPACITY PLANNING: Storage Growth Projection AreaChart + KPI cards
     ══════════════════════════════════════════════════════════════════════ */
    if (subTabId === 'capacity') {
        const projData = Array.from({ length: 12 }, (_, i) => ({
            month: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][i],
            actual: i < 4 ? Math.floor(hashNorm(`${seed}-ca-${i}`) * 5 + 10 + i * 2) : null,
            projected: Math.floor(hashNorm(`${seed}-cp-${i}`) * 3 + 10 + i * 2.5),
        }));
        return (
            <>
                <Panel title="Storage Growth Projection (12 months)" icon={BarChart3} accentColor={db.color}>
                    <ResponsiveContainer width="100%" height={200}>
                        <AreaChart data={projData}>
                            <CartesianGrid strokeDasharray="3 3" stroke={THEME.gridLine} />
                            <XAxis dataKey="month" tick={{ fontSize: 9, fill: THEME.textDim }} />
                            <YAxis tick={{ fontSize: 9, fill: THEME.textDim }} width={30} unit="GB" />
                            <Tooltip contentStyle={TT_STYLE} />
                            <Area
                                type="monotone"
                                dataKey="actual"
                                name="Actual"
                                stroke={db.color}
                                fill={`${db.color}20`}
                                strokeWidth={2}
                                connectNulls={false}
                            />
                            <Area
                                type="monotone"
                                dataKey="projected"
                                name="Projected"
                                stroke={THEME.textDim}
                                fill="none"
                                strokeWidth={1.5}
                                strokeDasharray="6 3"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </Panel>
                <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 20 }}>
                    <Panel title="Current Size" icon={Database} accentColor={db.color}>
                        <StatCard label="Database" value="14.8" unit="GB" color={db.color} />
                    </Panel>
                    <Panel title="Growth Rate" icon={TrendingUp} accentColor={db.color}>
                        <StatCard label="Weekly" value="2.1" unit="GB/w" color={db.color} />
                    </Panel>
                    <Panel title="Tablespace" icon={HardDrive} accentColor={db.color}>
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0' }}>
                            <RingGauge value={62} color={db.color} size={70} strokeWidth={6} label="USED" />
                        </div>
                    </Panel>
                    <Panel title="Time to Full" icon={Clock} accentColor={THEME.success}>
                        <StatCard label="Estimated" value="180" unit="days" color={THEME.success} />
                    </Panel>
                </div>
            </>
        );
    }

    /* ══════════════════════════════════════════════════════════════════════
     BACKUP & RECOVERY: Backup History BarChart (7d) + KPI cards
     ══════════════════════════════════════════════════════════════════════ */
    if (subTabId === 'backup') {
        return (
            <>
                <Panel title="Backup History (7d)" icon={Archive} accentColor={db.color}>
                    <ResponsiveContainer width="100%" height={180}>
                        <BarChart
                            data={gen7d(seed, 5, 5).map((d) => ({
                                ...d,
                                size: Math.floor(hashNorm(`${seed}-bs-${d.day}`) * 3 + 7),
                            }))}
                        >
                            <CartesianGrid strokeDasharray="3 3" stroke={THEME.gridLine} />
                            <XAxis dataKey="day" tick={{ fontSize: 9, fill: THEME.textDim }} />
                            <YAxis tick={{ fontSize: 9, fill: THEME.textDim }} width={30} unit="GB" />
                            <Tooltip contentStyle={TT_STYLE} />
                            <Bar dataKey="size" name="Backup Size" fill={db.color} radius={[3, 3, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </Panel>
                <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 20 }}>
                    <Panel title="Last Backup" icon={CheckCircle} accentColor={THEME.success}>
                        <StatCard label="Ago" value="1" unit="hour" color={THEME.success} />
                    </Panel>
                    <Panel title="Backup Size" icon={Database} accentColor={db.color}>
                        <StatCard label="Latest" value="8.9" unit="GB" color={db.color} />
                    </Panel>
                    <Panel title="Restore Time" icon={Clock} accentColor={db.color}>
                        <StatCard label="Estimated" value="12" unit="min" color={db.color} />
                    </Panel>
                    <Panel title="Status" icon={Shield} accentColor={THEME.success}>
                        <StatCard label="Health" value="OK" color={THEME.success} />
                    </Panel>
                </div>
            </>
        );
    }

    /* ══════════════════════════════════════════════════════════════════
     SCHEMA & SECURITY section tabs
     ══════════════════════════════════════════════════════════════════ */

    /* ══════════════════════════════════════════════════════════════════════
     SCHEMA & MIGRATIONS: Migration History DemoTable + KPI cards
     ══════════════════════════════════════════════════════════════════════ */
    if (subTabId === 'schema') {
        return (
            <>
                <Panel title="Migration History" icon={GitBranch} accentColor={db.color}>
                    <DemoTable
                        columns={[
                            { key: 'version', label: 'Version', width: '15%' },
                            { key: 'name', label: 'Migration', width: '35%' },
                            { key: 'type', label: 'Type', width: '15%' },
                            { key: 'duration', label: 'Duration', width: '15%' },
                            { key: 'date', label: 'Applied', width: '20%' },
                        ]}
                        rows={[
                            {
                                version: 'v2.4.1',
                                name: 'add_user_preferences_table',
                                type: 'CREATE',
                                duration: '0.8s',
                                date: '3 days ago',
                            },
                            {
                                version: 'v2.4.0',
                                name: 'alter_orders_add_status_idx',
                                type: 'ALTER',
                                duration: '2.1s',
                                date: '1 week ago',
                            },
                            {
                                version: 'v2.3.9',
                                name: 'create_audit_log_partition',
                                type: 'CREATE',
                                duration: '1.5s',
                                date: '2 weeks ago',
                            },
                            {
                                version: 'v2.3.8',
                                name: 'drop_legacy_sessions',
                                type: 'DROP',
                                duration: '0.3s',
                                date: '3 weeks ago',
                            },
                        ]}
                        color={db.color}
                    />
                </Panel>
                <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 20 }}>
                    <Panel title="Tables" icon={Database} accentColor={db.color}>
                        <StatCard label="Total" value="234" color={db.color} />
                    </Panel>
                    <Panel title="Views" icon={Eye} accentColor={db.color}>
                        <StatCard label="Total" value="89" color={db.color} />
                    </Panel>
                    <Panel title="Pending" icon={Clock} accentColor={THEME.success}>
                        <StatCard label="Migrations" value="0" color={THEME.success} />
                    </Panel>
                    <Panel title="Last Run" icon={CheckCircle} accentColor={THEME.success}>
                        <StatCard label="Ago" value="3" unit="days" color={THEME.success} />
                    </Panel>
                </div>
            </>
        );
    }

    /* ══════════════════════════════════════════════════════════════════════
     TABLE DEPENDENCIES: Demo mind map visualization with sample data
     ══════════════════════════════════════════════════════════════════════ */
    if (subTabId === 'table-dependencies' || subTabId === 'table-deps') {
        // Create a simple demo mind map by rendering a message about the component
        return (
            <>
                <Panel title="Table Dependency Mind Map" icon={GitBranch} accentColor={db.color}>
                    <div style={{ padding: '16px', textAlign: 'center' }}>
                        <div style={{ fontSize: '13px', color: THEME.textMain, marginBottom: '12px' }}>
                            Interactive mind map visualization showing table dependencies with:
                        </div>
                        <ul
                            style={{
                                textAlign: 'left',
                                display: 'inline-block',
                                fontSize: '12px',
                                color: THEME.textMuted,
                                lineHeight: '1.8',
                            }}
                        >
                            <li>Central table with outgoing/incoming relationships</li>
                            <li>First ring: direct dependencies (1 hop)</li>
                            <li>Second ring: indirect relationships (2 hops)</li>
                            <li>Color-coded by depth and relationship type</li>
                            <li>Hover for column details and row counts</li>
                        </ul>
                        <div style={{ marginTop: '16px', fontSize: '11px', color: THEME.textDim }}>
                            Select a table to view its dependency tree in the mind map visualization
                        </div>
                    </div>
                </Panel>
                <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
                    <Panel title="Sample Schema" icon={Database} accentColor={db.color}>
                        <div style={{ fontSize: '12px', color: THEME.textMain, marginBottom: '12px' }}>
                            <strong>PostgreSQL E-Commerce:</strong>
                        </div>
                        <div style={{ fontSize: '11px', color: THEME.textDim, lineHeight: '1.6' }}>
                            users → orders → products
                            <br />
                            orders → payments
                            <br />
                            products → inventory
                            <br />
                            users → addresses
                        </div>
                    </Panel>
                    <Panel title="Relationship Stats" icon={Layers} accentColor={THEME.primary}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', padding: '8px 0' }}>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '18px', fontWeight: '700', color: THEME.primary }}>18</div>
                                <div style={{ fontSize: '10px', color: THEME.textDim }}>Foreign Keys</div>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '18px', fontWeight: '700', color: db.color }}>12</div>
                                <div style={{ fontSize: '10px', color: THEME.textDim }}>Tables</div>
                            </div>
                        </div>
                    </Panel>
                    <Panel title="Key Tables" icon={GitBranch} accentColor={THEME.secondary}>
                        <div style={{ fontSize: '11px', color: THEME.textMuted, lineHeight: '1.7' }}>
                            <div style={{ color: THEME.secondary, fontWeight: '600', marginBottom: '4px' }}>
                                Hub Tables:
                            </div>
                            orders (4 refs)
                            <br />
                            users (3 refs)
                            <br />
                            products (2 refs)
                        </div>
                    </Panel>
                </div>
            </>
        );
    }

    /* ══════════════════════════════════════════════════════════════════════
     SECURITY & COMPLIANCE: Audit Events AreaChart + Compliance RingGauge + stats
     ══════════════════════════════════════════════════════════════════════ */
    if (subTabId === 'security') {
        return (
            <>
                <Panel title="Audit Events (7d)" icon={Lock} accentColor={db.color}>
                    <ResponsiveContainer width="100%" height={180}>
                        <AreaChart data={gen7d(seed, 8000, 5000)}>
                            <CartesianGrid strokeDasharray="3 3" stroke={THEME.gridLine} />
                            <XAxis dataKey="day" tick={{ fontSize: 9, fill: THEME.textDim }} />
                            <YAxis tick={{ fontSize: 9, fill: THEME.textDim }} width={40} />
                            <Tooltip contentStyle={TT_STYLE} />
                            <Area
                                type="monotone"
                                dataKey="value"
                                name="Events"
                                stroke={db.color}
                                fill={`${db.color}20`}
                                strokeWidth={2}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </Panel>
                <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
                    <Panel title="Compliance" icon={Shield} accentColor={THEME.success}>
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0' }}>
                            <RingGauge value={98} color={THEME.success} size={80} strokeWidth={6} label="SCORE" />
                        </div>
                    </Panel>
                    <Panel title="Roles" icon={Users} accentColor={db.color}>
                        <StatCard label="Active" value="18" color={db.color} />
                    </Panel>
                    <Panel title="Failed Auth" icon={AlertTriangle} accentColor={THEME.success}>
                        <StatCard label="Today" value="0" color={THEME.success} />
                    </Panel>
                </div>
            </>
        );
    }

    /* ══════════════════════════════════════════════════════════════════
     OBSERVABILITY section tabs
     ══════════════════════════════════════════════════════════════════ */

    /* ══════════════════════════════════════════════════════════════════════
     CLOUDWATCH: CloudWatch Metric Stream AreaChart (24h) + KPI cards
     ══════════════════════════════════════════════════════════════════════ */
    if (subTabId === 'cloudwatch') {
        return (
            <>
                <Panel title="CloudWatch Metric Stream" icon={Cloud} accentColor={db.color}>
                    <ResponsiveContainer width="100%" height={180}>
                        <AreaChart data={gen24h(seed, 50, 80, 20, 40)}>
                            <CartesianGrid strokeDasharray="3 3" stroke={THEME.gridLine} />
                            <XAxis dataKey="time" tick={{ fontSize: 9, fill: THEME.textDim }} interval={3} />
                            <YAxis tick={{ fontSize: 9, fill: THEME.textDim }} width={30} />
                            <Tooltip contentStyle={TT_STYLE} />
                            <Area
                                type="monotone"
                                dataKey="primary"
                                name="Data Points"
                                stroke={db.color}
                                fill={`${db.color}20`}
                                strokeWidth={2}
                            />
                            <Area
                                type="monotone"
                                dataKey="secondary"
                                name="Alarms Checked"
                                stroke={THEME.warning}
                                fill="none"
                                strokeWidth={1.5}
                                strokeDasharray="4 2"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </Panel>
                <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 20 }}>
                    <Panel title="Metrics" icon={Activity} accentColor={db.color}>
                        <StatCard label="Active" value="124" color={db.color} />
                    </Panel>
                    <Panel title="Alarms" icon={Bell} accentColor={THEME.success}>
                        <StatCard label="Active" value="0" color={THEME.success} />
                    </Panel>
                    <Panel title="Data Points" icon={Database} accentColor={db.color}>
                        <StatCard label="Total" value="98.2M" color={db.color} />
                    </Panel>
                    <Panel title="Last Sync" icon={Clock} accentColor={THEME.success}>
                        <StatCard label="Ago" value="30" unit="s" color={THEME.success} />
                    </Panel>
                </div>
            </>
        );
    }

    /* ══════════════════════════════════════════════════════════════════════
     LOG PATTERN ANALYSIS: Log Level DonutWidget + Log Volume Trend BarChart + table
     ══════════════════════════════════════════════════════════════════════ */
    if (subTabId === 'log-patterns') {
        return (
            <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                    <Panel title="Log Level Distribution" icon={FileSearch} accentColor={db.color}>
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0' }}>
                            <DonutWidget
                                data={[
                                    { name: 'INFO', value: 72, color: db.color, display: '72%' },
                                    { name: 'WARNING', value: 18, color: THEME.warning, display: '18%' },
                                    { name: 'ERROR', value: 8, color: THEME.danger, display: '8%' },
                                    { name: 'DEBUG', value: 2, color: THEME.textDim, display: '2%' },
                                ]}
                                centerValue="2.3"
                                centerLabel="GB/DAY"
                                color={db.color}
                                size={120}
                                innerRadius={40}
                                outerRadius={54}
                            />
                        </div>
                    </Panel>
                    <Panel title="Log Volume Trend (7d)" icon={BarChart3} accentColor={db.color}>
                        <ResponsiveContainer width="100%" height={160}>
                            <BarChart data={gen7d(seed, 1500, 1000)}>
                                <XAxis dataKey="day" tick={{ fontSize: 9, fill: THEME.textDim }} />
                                <YAxis tick={{ fontSize: 9, fill: THEME.textDim }} width={35} />
                                <Tooltip contentStyle={TT_STYLE} />
                                <Bar dataKey="value" name="Log Entries (K)" fill={db.color} radius={[3, 3, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </Panel>
                </div>
                <div style={{ marginTop: 16 }}>
                    <Panel title="Top Log Patterns" icon={FileSearch} accentColor={db.color}>
                        <DemoTable
                            columns={[
                                { key: 'pattern', label: 'Pattern', width: '45%' },
                                { key: 'count', label: 'Count', width: '15%' },
                                { key: 'level', label: 'Level', width: '15%' },
                                { key: 'trend', label: 'Trend', width: '25%' },
                            ]}
                            rows={[
                                {
                                    pattern: 'connection authorized: user=*',
                                    count: '45.2K',
                                    level: 'INFO',
                                    trend: 'Stable',
                                },
                                { pattern: 'checkpoint starting: *', count: '12.1K', level: 'INFO', trend: 'Stable' },
                                {
                                    pattern: 'duration: * ms statement: SELECT',
                                    count: '8.4K',
                                    level: 'WARNING',
                                    trend: 'Increasing',
                                },
                                {
                                    pattern: 'temporary file: path *',
                                    count: '2.1K',
                                    level: 'WARNING',
                                    trend: 'Decreasing',
                                },
                            ]}
                            color={db.color}
                        />
                    </Panel>
                </div>
            </>
        );
    }

    /* ══════════════════════════════════════════════════════════════════════
     ALERT CORRELATION: Correlated Alert Groups DemoTable + Root Cause Accuracy
     ══════════════════════════════════════════════════════════════════════ */
    if (subTabId === 'alert-correlation') {
        return (
            <>
                <Panel title="Correlated Alert Groups" icon={Link2} accentColor={db.color}>
                    <DemoTable
                        columns={[
                            { key: 'group', label: 'Correlation Group', width: '30%' },
                            { key: 'alerts', label: 'Alerts', width: '10%' },
                            { key: 'rootCause', label: 'Root Cause', width: '30%' },
                            { key: 'confidence', label: 'Confidence', width: '15%' },
                            { key: 'status', label: 'Status', width: '15%' },
                        ]}
                        rows={[
                            {
                                group: 'CPU Spike Cascade',
                                alerts: 4,
                                rootCause: 'Long-running query',
                                confidence: '94%',
                                status: 'Resolved',
                            },
                            {
                                group: 'Disk I/O Bottleneck',
                                alerts: 3,
                                rootCause: 'Table bloat',
                                confidence: '87%',
                                status: 'Active',
                            },
                            {
                                group: 'Connection Surge',
                                alerts: 2,
                                rootCause: 'App deployment',
                                confidence: '91%',
                                status: 'Resolved',
                            },
                        ]}
                        color={db.color}
                    />
                </Panel>
                <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                    <Panel title="Root Cause Accuracy" icon={Shield} accentColor={THEME.success}>
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0' }}>
                            <RingGauge value={89} color={THEME.success} size={90} strokeWidth={7} label="ACC" />
                        </div>
                    </Panel>
                    <Panel title="Correlation Stats" icon={Activity} accentColor={db.color}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, padding: '16px 0' }}>
                            <div style={{ textAlign: 'center' }}>
                                <div
                                    style={{
                                        fontSize: 20,
                                        fontWeight: 700,
                                        color: db.color,
                                        fontFamily: "'JetBrains Mono',monospace",
                                    }}
                                >
                                    12
                                </div>
                                <div style={{ fontSize: 9, color: THEME.textDim }}>Correlations</div>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <div
                                    style={{
                                        fontSize: 20,
                                        fontWeight: 700,
                                        color: THEME.success,
                                        fontFamily: "'JetBrains Mono',monospace",
                                    }}
                                >
                                    2
                                </div>
                                <div style={{ fontSize: 9, color: THEME.textDim }}>False Positives</div>
                            </div>
                        </div>
                    </Panel>
                </div>
            </>
        );
    }

    /* ══════════════════════════════════════════════════════════════════════
     OPENTELEMETRY: Trace Volume AreaChart (24h) + KPI cards
     ══════════════════════════════════════════════════════════════════════ */
    if (subTabId === 'opentelemetry') {
        return (
            <>
                <Panel title="Trace Volume (24h)" icon={Radar} accentColor={db.color}>
                    <ResponsiveContainer width="100%" height={180}>
                        <AreaChart data={gen24h(seed, 2000, 3000, 500, 1500)}>
                            <CartesianGrid strokeDasharray="3 3" stroke={THEME.gridLine} />
                            <XAxis dataKey="time" tick={{ fontSize: 9, fill: THEME.textDim }} interval={3} />
                            <YAxis tick={{ fontSize: 9, fill: THEME.textDim }} width={40} />
                            <Tooltip contentStyle={TT_STYLE} />
                            <Area
                                type="monotone"
                                dataKey="primary"
                                name="Traces/sec"
                                stroke={db.color}
                                fill={`${db.color}20`}
                                strokeWidth={2}
                            />
                            <Area
                                type="monotone"
                                dataKey="secondary"
                                name="Errors"
                                stroke={THEME.warning}
                                fill="none"
                                strokeWidth={1.5}
                                strokeDasharray="4 2"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </Panel>
                <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 20 }}>
                    <Panel title="Traces/sec" icon={Activity} accentColor={db.color}>
                        <StatCard label="Current" value="4,500" color={db.color} />
                    </Panel>
                    <Panel title="Spans" icon={Layers} accentColor={db.color}>
                        <StatCard label="Per day" value="234M" color={db.color} />
                    </Panel>
                    <Panel title="Sampling" icon={Eye} accentColor={THEME.success}>
                        <StatCard label="Rate" value="100" unit="%" color={THEME.success} />
                    </Panel>
                    <Panel title="P99 Latency" icon={Clock} accentColor={db.color}>
                        <StatCard label="Current" value="12.3" unit="ms" color={db.color} />
                    </Panel>
                </div>
            </>
        );
    }

    /* ══════════════════════════════════════════════════════════════════════
     KUBERNETES: Pod Status DonutWidget + Resource Utilization RingGauges + Node table
     ══════════════════════════════════════════════════════════════════════ */
    if (subTabId === 'kubernetes') {
        return (
            <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                    <Panel title="Pod Status" icon={Container} accentColor={db.color}>
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0' }}>
                            <DonutWidget
                                data={[
                                    { name: 'Running', value: 42, color: THEME.success, display: '42' },
                                    { name: 'Pending', value: 2, color: THEME.warning, display: '2' },
                                    { name: 'Failed', value: 1, color: THEME.danger, display: '1' },
                                ]}
                                centerValue="45"
                                centerLabel="PODS"
                                color={db.color}
                                size={120}
                                innerRadius={40}
                                outerRadius={54}
                            />
                        </div>
                    </Panel>
                    <Panel title="Resource Utilization" icon={Cpu} accentColor={db.color}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, padding: '12px 0' }}>
                            <div style={{ display: 'flex', justifyContent: 'center' }}>
                                <RingGauge value={62} color={db.color} size={70} strokeWidth={5} label="CPU" />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'center' }}>
                                <RingGauge value={71} color={THEME.warning} size={70} strokeWidth={5} label="MEM" />
                            </div>
                        </div>
                    </Panel>
                </div>
                <div style={{ marginTop: 16 }}>
                    <Panel title="Node Status" icon={Server} accentColor={db.color}>
                        <DemoTable
                            columns={[
                                { key: 'node', label: 'Node', width: '25%' },
                                { key: 'status', label: 'Status', width: '15%' },
                                { key: 'cpu', label: 'CPU', width: '15%' },
                                { key: 'memory', label: 'Memory', width: '15%' },
                                { key: 'pods', label: 'Pods', width: '15%' },
                                { key: 'age', label: 'Age', width: '15%' },
                            ]}
                            rows={Array.from({ length: 4 }, (_, i) => ({
                                node: `node-${i + 1}`,
                                status: 'Ready',
                                cpu: `${Math.floor(hashNorm(`${seed}-nc-${i}`) * 30 + 40)}%`,
                                memory: `${Math.floor(hashNorm(`${seed}-nm-${i}`) * 20 + 55)}%`,
                                pods: Math.floor(hashNorm(`${seed}-np-${i}`) * 8 + 8),
                                age: `${Math.floor(hashNorm(`${seed}-na-${i}`) * 60 + 30)}d`,
                            }))}
                            color={db.color}
                        />
                    </Panel>
                </div>
            </>
        );
    }

    /* ══════════════════════════════════════════════════════════════════════
     STATUS PAGE: System Components DemoTable + Uptime/Subscribers/Incident stats
     ══════════════════════════════════════════════════════════════════════ */
    if (subTabId === 'status-page') {
        return (
            <>
                <Panel title="System Components" icon={Globe} accentColor={THEME.success}>
                    <DemoTable
                        columns={[
                            { key: 'component', label: 'Component', width: '30%' },
                            { key: 'status', label: 'Status', width: '20%' },
                            { key: 'uptime', label: 'Uptime', width: '20%' },
                            { key: 'lastIncident', label: 'Last Incident', width: '30%' },
                        ]}
                        rows={[
                            {
                                component: 'API Gateway',
                                status: 'Operational',
                                uptime: '99.99%',
                                lastIncident: '45 days ago',
                            },
                            {
                                component: 'Database Cluster',
                                status: 'Operational',
                                uptime: '99.99%',
                                lastIncident: '15 days ago',
                            },
                            {
                                component: 'Cache Layer',
                                status: 'Operational',
                                uptime: '99.98%',
                                lastIncident: '30 days ago',
                            },
                            {
                                component: 'Worker Queue',
                                status: 'Operational',
                                uptime: '99.95%',
                                lastIncident: '7 days ago',
                            },
                            { component: 'CDN', status: 'Operational', uptime: '100%', lastIncident: 'Never' },
                        ]}
                        color={db.color}
                    />
                </Panel>
                <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
                    <Panel title="Overall Uptime" icon={CheckCircle} accentColor={THEME.success}>
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0' }}>
                            <RingGauge value={99} color={THEME.success} size={80} strokeWidth={6} label="SLA" />
                        </div>
                    </Panel>
                    <Panel title="Subscribers" icon={Users} accentColor={db.color}>
                        <StatCard label="Watching" value="234" color={db.color} />
                    </Panel>
                    <Panel title="Last Incident" icon={Clock} accentColor={THEME.success}>
                        <StatCard label="Ago" value="15" unit="days" color={THEME.success} />
                    </Panel>
                </div>
            </>
        );
    }

    /* ══════════════════════════════════════════════════════════════════════
     AI MONITORING: Anomaly Detection AreaChart (7d) + AI Accuracy/Training/Forecast
     ══════════════════════════════════════════════════════════════════════ */
    if (subTabId === 'ai-monitoring') {
        return (
            <>
                <Panel title="Anomaly Detection (7d)" icon={Brain} accentColor={db.color}>
                    <ResponsiveContainer width="100%" height={180}>
                        <AreaChart
                            data={gen7d(seed, 0, 5).map((d) => ({
                                ...d,
                                confidence: Math.floor(hashNorm(`${seed}-conf-${d.day}`) * 5 + 93),
                            }))}
                        >
                            <CartesianGrid strokeDasharray="3 3" stroke={THEME.gridLine} />
                            <XAxis dataKey="day" tick={{ fontSize: 9, fill: THEME.textDim }} />
                            <YAxis tick={{ fontSize: 9, fill: THEME.textDim }} width={24} />
                            <Tooltip contentStyle={TT_STYLE} />
                            <Area
                                type="monotone"
                                dataKey="value"
                                name="Anomalies"
                                stroke={THEME.warning}
                                fill={`${THEME.warning}15`}
                                strokeWidth={2}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </Panel>
                <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
                    <Panel title="AI Accuracy" icon={Brain} accentColor={THEME.success}>
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0' }}>
                            <RingGauge value={96} color={THEME.success} size={80} strokeWidth={6} label="ACC" />
                        </div>
                    </Panel>
                    <Panel title="Training" icon={Activity} accentColor={db.color}>
                        <StatCard label="Frequency" value="Daily" color={db.color} />
                    </Panel>
                    <Panel title="Forecast" icon={Clock} accentColor={db.color}>
                        <StatCard label="Horizon" value="30" unit="days" color={db.color} />
                    </Panel>
                </div>
            </>
        );
    }

    /* ══════════════════════════════════════════════════════════════════
     DEVELOPER TOOLS section tabs
     ══════════════════════════════════════════════════════════════════ */

    /* ══════════════════════════════════════════════════════════════════════
     SQL CONSOLE: Query Stats KPI cards + Recent Query History DemoTable
     ══════════════════════════════════════════════════════════════════════ */
    if (subTabId === 'sql') {
        return (
            <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 20 }}>
                    <Panel title="Queries Run" icon={Terminal} accentColor={db.color}>
                        <StatCard label="Today" value="1,245" color={db.color} />
                    </Panel>
                    <Panel title="Avg Time" icon={Clock} accentColor={db.color}>
                        <StatCard label="Execution" value="3.2" unit="ms" color={db.color} />
                    </Panel>
                    <Panel title="Favorites" icon={Star} accentColor={db.color}>
                        <StatCard label="Saved" value="34" color={db.color} />
                    </Panel>
                    <Panel title="Recent" icon={Activity} accentColor={db.color}>
                        <StatCard label="Queries" value="12" color={db.color} />
                    </Panel>
                </div>
                <div style={{ marginTop: 16 }}>
                    <Panel title="Recent Query History" icon={Terminal} accentColor={db.color}>
                        <DemoTable
                            columns={[
                                { key: 'query', label: 'Query', width: '50%' },
                                { key: 'duration', label: 'Duration', width: '15%' },
                                { key: 'rows', label: 'Rows', width: '15%' },
                                { key: 'time', label: 'Executed', width: '20%' },
                            ]}
                            rows={[
                                {
                                    query: 'SELECT * FROM users WHERE active = true',
                                    duration: '2.1ms',
                                    rows: '1,245',
                                    time: '2 min ago',
                                },
                                {
                                    query: 'UPDATE orders SET status = shipped',
                                    duration: '5.4ms',
                                    rows: '89',
                                    time: '15 min ago',
                                },
                                {
                                    query: 'INSERT INTO audit_log VALUES ...',
                                    duration: '1.2ms',
                                    rows: '1',
                                    time: '30 min ago',
                                },
                                {
                                    query: 'SELECT count(*) FROM sessions',
                                    duration: '0.8ms',
                                    rows: '1',
                                    time: '1 hour ago',
                                },
                            ]}
                            color={db.color}
                        />
                    </Panel>
                </div>
            </>
        );
    }

    /* ══════════════════════════════════════════════════════════════════════
     API TRACING: API Call Volume AreaChart (24h) + Top Endpoints by Latency table
     ══════════════════════════════════════════════════════════════════════ */
    if (subTabId === 'api') {
        return (
            <>
                <Panel title="API Call Volume (24h)" icon={Cpu} accentColor={db.color}>
                    <ResponsiveContainer width="100%" height={180}>
                        <AreaChart data={gen24h(seed, 200, 300, 5, 15)}>
                            <CartesianGrid strokeDasharray="3 3" stroke={THEME.gridLine} />
                            <XAxis dataKey="time" tick={{ fontSize: 9, fill: THEME.textDim }} interval={3} />
                            <YAxis tick={{ fontSize: 9, fill: THEME.textDim }} width={35} />
                            <Tooltip contentStyle={TT_STYLE} />
                            <Area
                                type="monotone"
                                dataKey="primary"
                                name="Calls/sec"
                                stroke={db.color}
                                fill={`${db.color}20`}
                                strokeWidth={2}
                            />
                            <Area
                                type="monotone"
                                dataKey="secondary"
                                name="Errors"
                                stroke={THEME.warning}
                                fill="none"
                                strokeWidth={1.5}
                                strokeDasharray="4 2"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </Panel>
                <div style={{ marginTop: 16 }}>
                    <Panel title="Top Endpoints by Latency" icon={Clock} accentColor={THEME.warning}>
                        <DemoTable
                            columns={[
                                { key: 'endpoint', label: 'Endpoint', width: '35%' },
                                { key: 'method', label: 'Method', width: '12%' },
                                { key: 'p50', label: 'P50', width: '13%' },
                                { key: 'p99', label: 'P99', width: '13%' },
                                { key: 'calls', label: 'Calls/hr', width: '14%' },
                                { key: 'errors', label: 'Errors', width: '13%' },
                            ]}
                            rows={[
                                {
                                    endpoint: '/api/v1/users',
                                    method: 'GET',
                                    p50: '12ms',
                                    p99: '89ms',
                                    calls: '4.5K',
                                    errors: '0.01%',
                                },
                                {
                                    endpoint: '/api/v1/orders',
                                    method: 'POST',
                                    p50: '45ms',
                                    p99: '234ms',
                                    calls: '2.1K',
                                    errors: '0.1%',
                                },
                                {
                                    endpoint: '/api/v1/search',
                                    method: 'GET',
                                    p50: '34ms',
                                    p99: '156ms',
                                    calls: '8.9K',
                                    errors: '0.02%',
                                },
                                {
                                    endpoint: '/api/v1/analytics',
                                    method: 'GET',
                                    p50: '78ms',
                                    p99: '345ms',
                                    calls: '1.2K',
                                    errors: '0.05%',
                                },
                            ]}
                            color={db.color}
                        />
                    </Panel>
                </div>
            </>
        );
    }

    /* ══════════════════════════════════════════════════════════════════════
     REPOSITORY: Commit Activity BarChart (7d) + KPI cards
     ══════════════════════════════════════════════════════════════════════ */
    if (subTabId === 'repository') {
        return (
            <>
                <Panel title="Commit Activity (7d)" icon={GitBranch} accentColor={db.color}>
                    <ResponsiveContainer width="100%" height={180}>
                        <BarChart data={gen7d(seed, 5, 15)}>
                            <CartesianGrid strokeDasharray="3 3" stroke={THEME.gridLine} />
                            <XAxis dataKey="day" tick={{ fontSize: 9, fill: THEME.textDim }} />
                            <YAxis tick={{ fontSize: 9, fill: THEME.textDim }} width={24} />
                            <Tooltip contentStyle={TT_STYLE} />
                            <Bar dataKey="value" name="Commits" fill={db.color} radius={[3, 3, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </Panel>
                <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 20 }}>
                    <Panel title="Total Commits" icon={GitBranch} accentColor={db.color}>
                        <StatCard label="All time" value="3,456" color={db.color} />
                    </Panel>
                    <Panel title="Branches" icon={GitBranch} accentColor={db.color}>
                        <StatCard label="Active" value="24" color={db.color} />
                    </Panel>
                    <Panel title="Pull Requests" icon={Code} accentColor={THEME.warning}>
                        <StatCard label="Open" value="12" color={THEME.warning} />
                    </Panel>
                    <Panel title="Deployments" icon={Globe} accentColor={THEME.success}>
                        <StatCard label="Per week" value="45" color={THEME.success} />
                    </Panel>
                </div>
            </>
        );
    }

    /* ══════════════════════════════════════════════════════════════════════
     AI QUERY ADVISOR: AI Recommendations DemoTable + Adoption/Improvement/Analyzed stats
     ══════════════════════════════════════════════════════════════════════ */
    if (subTabId === 'ai-advisor') {
        return (
            <>
                <Panel title="AI Recommendations" icon={Brain} accentColor={db.color}>
                    <DemoTable
                        columns={[
                            { key: 'query', label: 'Query Pattern', width: '35%' },
                            { key: 'suggestion', label: 'Suggestion', width: '30%' },
                            { key: 'improvement', label: 'Est. Improvement', width: '15%' },
                            { key: 'confidence', label: 'Confidence', width: '20%' },
                        ]}
                        rows={[
                            {
                                query: 'SELECT * FROM orders WHERE...',
                                suggestion: 'Add composite index',
                                improvement: '+34%',
                                confidence: '96%',
                            },
                            {
                                query: 'JOIN users ON users.id...',
                                suggestion: 'Rewrite as subquery',
                                improvement: '+18%',
                                confidence: '89%',
                            },
                            {
                                query: 'UPDATE inventory SET qty...',
                                suggestion: 'Batch operations',
                                improvement: '+45%',
                                confidence: '93%',
                            },
                            {
                                query: 'SELECT count(*) FROM logs',
                                suggestion: 'Use materialized view',
                                improvement: '+67%',
                                confidence: '91%',
                            },
                        ]}
                        color={db.color}
                    />
                </Panel>
                <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
                    <Panel title="Adoption Rate" icon={Activity} accentColor={db.color}>
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0' }}>
                            <RingGauge value={76} color={db.color} size={80} strokeWidth={6} label="ADOPT" />
                        </div>
                    </Panel>
                    <Panel title="Avg Improvement" icon={TrendingUp} accentColor={THEME.success}>
                        <StatCard label="Performance" value="+23.4" unit="%" color={THEME.success} />
                    </Panel>
                    <Panel title="Queries Analyzed" icon={Database} accentColor={db.color}>
                        <StatCard label="Total" value="234K" color={db.color} />
                    </Panel>
                </div>
            </>
        );
    }

    /* ══════════════════════════════════════════════════════════════════
     ADMIN section tabs
     ══════════════════════════════════════════════════════════════════ */

    /* ══════════════════════════════════════════════════════════════════════
     DBA TASK SCHEDULER: Scheduled Tasks DemoTable + Task Status DonutWidget + Success
     ══════════════════════════════════════════════════════════════════════ */
    if (subTabId === 'tasks') {
        return (
            <>
                <Panel title="Scheduled Tasks" icon={CalendarCheck} accentColor={db.color}>
                    <DemoTable
                        columns={[
                            { key: 'task', label: 'Task', width: '30%' },
                            { key: 'schedule', label: 'Schedule', width: '20%' },
                            { key: 'lastRun', label: 'Last Run', width: '15%' },
                            { key: 'duration', label: 'Duration', width: '15%' },
                            { key: 'status', label: 'Status', width: '20%' },
                        ]}
                        rows={[
                            {
                                task: 'VACUUM ANALYZE',
                                schedule: 'Every 5 min',
                                lastRun: '2 min ago',
                                duration: '1.2s',
                                status: 'Success',
                            },
                            {
                                task: 'Backup Full',
                                schedule: 'Daily 2:00 AM',
                                lastRun: '6h ago',
                                duration: '12m',
                                status: 'Success',
                            },
                            {
                                task: 'Stats Collection',
                                schedule: 'Hourly',
                                lastRun: '45m ago',
                                duration: '3.4s',
                                status: 'Success',
                            },
                            {
                                task: 'Log Rotation',
                                schedule: 'Daily 00:00',
                                lastRun: '12h ago',
                                duration: '0.5s',
                                status: 'Success',
                            },
                            {
                                task: 'Index Rebuild',
                                schedule: 'Weekly Sun',
                                lastRun: '3d ago',
                                duration: '45m',
                                status: 'Success',
                            },
                        ]}
                        color={db.color}
                    />
                </Panel>
                <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                    <Panel title="Task Status" icon={Shield} accentColor={THEME.success}>
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0' }}>
                            <DonutWidget
                                data={[
                                    { name: 'Success', value: 34, color: THEME.success, display: '34' },
                                    { name: 'Running', value: 2, color: db.color, display: '2' },
                                    { name: 'Failed', value: 0, color: THEME.warning, display: '0' },
                                ]}
                                centerValue="36"
                                centerLabel="TASKS"
                                color={db.color}
                                size={100}
                                innerRadius={34}
                                outerRadius={46}
                            />
                        </div>
                    </Panel>
                    <Panel title="Success Rate" icon={CheckCircle} accentColor={THEME.success}>
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0' }}>
                            <RingGauge value={99} color={THEME.success} size={90} strokeWidth={7} label="RATE" />
                        </div>
                    </Panel>
                </div>
            </>
        );
    }

    /* ══════════════════════════════════════════════════════════════════════
     USER MANAGEMENT: Active Users DemoTable + Role Distribution DonutWidget
     ══════════════════════════════════════════════════════════════════════ */
    if (subTabId === 'users') {
        return (
            <>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
                    <Panel title="Active Users" icon={Users} accentColor={db.color}>
                        <DemoTable
                            columns={[
                                { key: 'user', label: 'User', width: '25%' },
                                { key: 'role', label: 'Role', width: '20%' },
                                { key: 'sessions', label: 'Sessions', width: '15%' },
                                { key: 'lastActive', label: 'Last Active', width: '20%' },
                                { key: 'status', label: 'Status', width: '20%' },
                            ]}
                            rows={[
                                {
                                    user: 'admin@company.com',
                                    role: 'Superadmin',
                                    sessions: 3,
                                    lastActive: 'Now',
                                    status: 'Online',
                                },
                                {
                                    user: 'dba@company.com',
                                    role: 'DBA',
                                    sessions: 1,
                                    lastActive: '5 min ago',
                                    status: 'Online',
                                },
                                {
                                    user: 'dev@company.com',
                                    role: 'Developer',
                                    sessions: 2,
                                    lastActive: '1h ago',
                                    status: 'Away',
                                },
                                {
                                    user: 'viewer@company.com',
                                    role: 'Viewer',
                                    sessions: 0,
                                    lastActive: '2d ago',
                                    status: 'Offline',
                                },
                            ]}
                            color={db.color}
                        />
                    </Panel>
                    <Panel title="Role Distribution" icon={Shield} accentColor={db.color}>
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0' }}>
                            <DonutWidget
                                data={[
                                    { name: 'Admins', value: 5, color: db.color, display: '5' },
                                    { name: 'DBAs', value: 8, color: THEME.warning, display: '8' },
                                    { name: 'Devs', value: 15, color: THEME.success, display: '15' },
                                    { name: 'Viewers', value: 6, color: THEME.textDim, display: '6' },
                                ]}
                                centerValue="34"
                                centerLabel="USERS"
                                color={db.color}
                                size={110}
                                innerRadius={36}
                                outerRadius={50}
                            />
                        </div>
                    </Panel>
                </div>
            </>
        );
    }

    /* ══════════════════════════════════════════════════════════════════════
     ADMIN PANEL: System Health RingGauge + Config Changes + Recent Changes table
     ══════════════════════════════════════════════════════════════════════ */
    if (subTabId === 'admin-panel') {
        return (
            <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
                    <Panel title="System Health" icon={Shield} accentColor={THEME.success}>
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0' }}>
                            <RingGauge value={97} color={THEME.success} size={90} strokeWidth={7} label="HEALTH" />
                        </div>
                    </Panel>
                    <Panel title="Config Changes" icon={Activity} accentColor={db.color}>
                        <StatCard label="Today" value="23" color={db.color} />
                    </Panel>
                    <Panel title="Restarts" icon={RefreshCw} accentColor={THEME.success}>
                        <StatCard label="This week" value="0" color={THEME.success} />
                    </Panel>
                </div>
                <div style={{ marginTop: 16 }}>
                    <Panel title="Recent Configuration Changes" icon={Shield} accentColor={db.color}>
                        <DemoTable
                            columns={[
                                { key: 'param', label: 'Parameter', width: '30%' },
                                { key: 'oldVal', label: 'Old Value', width: '20%' },
                                { key: 'newVal', label: 'New Value', width: '20%' },
                                { key: 'user', label: 'Changed By', width: '15%' },
                                { key: 'time', label: 'When', width: '15%' },
                            ]}
                            rows={[
                                {
                                    param: 'max_connections',
                                    oldVal: '80',
                                    newVal: '100',
                                    user: 'admin',
                                    time: '2h ago',
                                },
                                {
                                    param: 'shared_buffers',
                                    oldVal: '4 GB',
                                    newVal: '8 GB',
                                    user: 'dba',
                                    time: '1d ago',
                                },
                                { param: 'work_mem', oldVal: '64 MB', newVal: '128 MB', user: 'admin', time: '3d ago' },
                            ]}
                            color={db.color}
                        />
                    </Panel>
                </div>
            </>
        );
    }

    /* ══════════════════════════════════════════════════════════════════════
     DATA RETENTION: Retention Policies DemoTable + Storage Freed + Compliance RingGauge
     ══════════════════════════════════════════════════════════════════════ */
    if (subTabId === 'retention') {
        return (
            <>
                <Panel title="Retention Policies" icon={Clock} accentColor={db.color}>
                    <DemoTable
                        columns={[
                            { key: 'policy', label: 'Policy', width: '25%' },
                            { key: 'table', label: 'Target Table', width: '20%' },
                            { key: 'retention', label: 'Retention', width: '15%' },
                            { key: 'purged', label: 'Last Purged', width: '20%' },
                            { key: 'status', label: 'Status', width: '20%' },
                        ]}
                        rows={[
                            {
                                policy: 'Audit Log Cleanup',
                                table: 'audit_log',
                                retention: '90 days',
                                purged: '234 GB/week',
                                status: 'Active',
                            },
                            {
                                policy: 'Session Archive',
                                table: 'sessions',
                                retention: '30 days',
                                purged: '45 GB/week',
                                status: 'Active',
                            },
                            {
                                policy: 'Metric Downsampling',
                                table: 'metrics',
                                retention: '1 year',
                                purged: '12 GB/week',
                                status: 'Active',
                            },
                            {
                                policy: 'Log Rotation',
                                table: 'app_logs',
                                retention: '14 days',
                                purged: '89 GB/week',
                                status: 'Active',
                            },
                        ]}
                        color={db.color}
                    />
                </Panel>
                <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                    <Panel title="Storage Freed (7d)" icon={HardDrive} accentColor={THEME.success}>
                        <ResponsiveContainer width="100%" height={140}>
                            <BarChart data={gen7d(seed, 20, 30)}>
                                <XAxis dataKey="day" tick={{ fontSize: 9, fill: THEME.textDim }} />
                                <YAxis tick={{ fontSize: 9, fill: THEME.textDim }} width={28} unit="GB" />
                                <Tooltip contentStyle={TT_STYLE} />
                                <Bar dataKey="value" name="Freed" fill={THEME.success} radius={[3, 3, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </Panel>
                    <Panel title="Compliance" icon={Shield} accentColor={THEME.success}>
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0' }}>
                            <RingGauge value={100} color={THEME.success} size={80} strokeWidth={6} label="OK" />
                        </div>
                    </Panel>
                </div>
            </>
        );
    }

    /* ══════════════════════════════════════════════════════════════════════
     TERRAFORM EXPORT: KPI cards + Terraform Resource Inventory DemoTable
     ══════════════════════════════════════════════════════════════════════ */
    if (subTabId === 'terraform') {
        return (
            <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 20 }}>
                    <Panel title="Resources" icon={Database} accentColor={db.color}>
                        <StatCard label="Managed" value="456" color={db.color} />
                    </Panel>
                    <Panel title="Modules" icon={Layers} accentColor={db.color}>
                        <StatCard label="Total" value="23" color={db.color} />
                    </Panel>
                    <Panel title="Last Export" icon={Clock} accentColor={db.color}>
                        <StatCard label="Ago" value="2" unit="hours" color={db.color} />
                    </Panel>
                    <Panel title="Drift" icon={AlertTriangle} accentColor={THEME.warning}>
                        <StatCard label="Detected" value="1" color={THEME.warning} />
                    </Panel>
                </div>
                <div style={{ marginTop: 16 }}>
                    <Panel title="Terraform Resource Inventory" icon={Code} accentColor={db.color}>
                        <DemoTable
                            columns={[
                                { key: 'resource', label: 'Resource', width: '30%' },
                                { key: 'type', label: 'Type', width: '20%' },
                                { key: 'provider', label: 'Provider', width: '15%' },
                                { key: 'state', label: 'State', width: '15%' },
                                { key: 'drift', label: 'Drift', width: '20%' },
                            ]}
                            rows={[
                                {
                                    resource: 'aws_db_instance.primary',
                                    type: 'db_instance',
                                    provider: 'AWS',
                                    state: 'Synced',
                                    drift: 'None',
                                },
                                {
                                    resource: 'aws_security_group.db',
                                    type: 'security_group',
                                    provider: 'AWS',
                                    state: 'Synced',
                                    drift: 'None',
                                },
                                {
                                    resource: 'aws_db_subnet_group.main',
                                    type: 'subnet_group',
                                    provider: 'AWS',
                                    state: 'Drifted',
                                    drift: 'CIDR changed',
                                },
                                {
                                    resource: 'aws_iam_role.rds_monitor',
                                    type: 'iam_role',
                                    provider: 'AWS',
                                    state: 'Synced',
                                    drift: 'None',
                                },
                            ]}
                            color={db.color}
                        />
                    </Panel>
                </div>
            </>
        );
    }

    /* ══════════════════════════════════════════════════════════════════════
     CUSTOM DASHBOARDS: Dashboard Gallery DemoTable + KPI stat cards
     ══════════════════════════════════════════════════════════════════════ */
    if (subTabId === 'custom-dashboard') {
        return (
            <>
                <Panel title="Dashboard Gallery" icon={LayoutDashboard} accentColor={db.color}>
                    <DemoTable
                        columns={[
                            { key: 'name', label: 'Dashboard', width: '30%' },
                            { key: 'panels', label: 'Panels', width: '12%' },
                            { key: 'owner', label: 'Owner', width: '18%' },
                            { key: 'shared', label: 'Shared With', width: '15%' },
                            { key: 'views', label: 'Views/Week', width: '12%' },
                            { key: 'updated', label: 'Updated', width: '13%' },
                        ]}
                        rows={[
                            {
                                name: 'Production Overview',
                                panels: 12,
                                owner: 'admin',
                                shared: 'Everyone',
                                views: 234,
                                updated: '1h ago',
                            },
                            {
                                name: 'Query Performance',
                                panels: 8,
                                owner: 'dba',
                                shared: 'DBA Team',
                                views: 89,
                                updated: '3h ago',
                            },
                            {
                                name: 'Capacity Planning',
                                panels: 6,
                                owner: 'ops',
                                shared: '5 users',
                                views: 45,
                                updated: '1d ago',
                            },
                            {
                                name: 'Security Audit',
                                panels: 10,
                                owner: 'security',
                                shared: 'Admins',
                                views: 23,
                                updated: '2d ago',
                            },
                        ]}
                        color={db.color}
                    />
                </Panel>
                <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
                    <Panel title="Dashboards" icon={LayoutDashboard} accentColor={db.color}>
                        <StatCard label="Total" value="18" color={db.color} />
                    </Panel>
                    <Panel title="Total Panels" icon={Layers} accentColor={db.color}>
                        <StatCard label="Across all" value="567" color={db.color} />
                    </Panel>
                    <Panel title="Active Users" icon={Users} accentColor={db.color}>
                        <StatCard label="This week" value="89" color={db.color} />
                    </Panel>
                </div>
            </>
        );
    }

    /* ══════════════════════════════════════════════════════════════════
     GENERIC FALLBACK: uses tab metrics to build a unique layout
     based on the subTabId hash — ensures no two tabs look identical
     ══════════════════════════════════════════════════════════════════ */
    const tabSeed = hashNorm(seed);
    const layoutType = tabSeed % 4;
    const trendData = gen24h(seed, 50, 100, 20, 50);
    const weekData = gen7d(seed, 10, 30);

    if (layoutType === 0) {
        /* Layout A: area chart + stat cards */
        return (
            <>
                <Panel
                    title={`${SUB_TAB_DISPLAY_NAMES[subTabId] || subTabId} Trend (24h)`}
                    icon={Activity}
                    accentColor={db.color}
                >
                    <ResponsiveContainer width="100%" height={180}>
                        <AreaChart data={trendData}>
                            <CartesianGrid strokeDasharray="3 3" stroke={THEME.gridLine} />
                            <XAxis dataKey="time" tick={{ fontSize: 9, fill: THEME.textDim }} interval={3} />
                            <YAxis tick={{ fontSize: 9, fill: THEME.textDim }} width={35} />
                            <Tooltip contentStyle={TT_STYLE} />
                            <Area
                                type="monotone"
                                dataKey="primary"
                                stroke={db.color}
                                fill={`${db.color}20`}
                                strokeWidth={2}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </Panel>
                <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
                    <Panel title="Health" icon={Shield} accentColor={THEME.success}>
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0' }}>
                            <RingGauge
                                value={Math.floor(hashNorm(`${seed}-h`) * 10 + 88)}
                                color={THEME.success}
                                size={80}
                                strokeWidth={6}
                                label="OK"
                            />
                        </div>
                    </Panel>
                    <Panel title="Primary" icon={Activity} accentColor={db.color}>
                        <StatCard
                            label="Value"
                            value={`${Math.floor(hashNorm(`${seed}-pv`) * 500 + 100)}`}
                            color={db.color}
                        />
                    </Panel>
                    <Panel title="Secondary" icon={Clock} accentColor={db.color}>
                        <StatCard
                            label="Value"
                            value={`${Math.floor(hashNorm(`${seed}-sv`) * 100 + 10)}`}
                            color={db.color}
                        />
                    </Panel>
                </div>
            </>
        );
    }

    if (layoutType === 1) {
        /* Layout B: bar chart + donut + stats */
        return (
            <>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
                    <Panel
                        title={`${SUB_TAB_DISPLAY_NAMES[subTabId] || subTabId} Activity (7d)`}
                        icon={BarChart3}
                        accentColor={db.color}
                    >
                        <ResponsiveContainer width="100%" height={170}>
                            <BarChart data={weekData}>
                                <CartesianGrid strokeDasharray="3 3" stroke={THEME.gridLine} />
                                <XAxis dataKey="day" tick={{ fontSize: 9, fill: THEME.textDim }} />
                                <YAxis tick={{ fontSize: 9, fill: THEME.textDim }} width={28} />
                                <Tooltip contentStyle={TT_STYLE} />
                                <Bar dataKey="value" fill={db.color} radius={[3, 3, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </Panel>
                    <Panel title="Distribution" icon={Eye} accentColor={db.color}>
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0' }}>
                            <DonutWidget
                                data={[
                                    { name: 'Active', value: 70, color: db.color, display: '70%' },
                                    { name: 'Idle', value: 20, color: THEME.textDim, display: '20%' },
                                    { name: 'Error', value: 10, color: THEME.warning, display: '10%' },
                                ]}
                                centerValue={`${Math.floor(hashNorm(`${seed}-dv`) * 500 + 50)}`}
                                centerLabel="TOTAL"
                                color={db.color}
                                size={110}
                                innerRadius={36}
                                outerRadius={50}
                            />
                        </div>
                    </Panel>
                </div>
            </>
        );
    }

    if (layoutType === 2) {
        /* Layout C: dual line chart + table */
        return (
            <>
                <Panel
                    title={`${SUB_TAB_DISPLAY_NAMES[subTabId] || subTabId} Metrics (24h)`}
                    icon={Activity}
                    accentColor={db.color}
                >
                    <ResponsiveContainer width="100%" height={180}>
                        <LineChart data={trendData}>
                            <CartesianGrid strokeDasharray="3 3" stroke={THEME.gridLine} />
                            <XAxis dataKey="time" tick={{ fontSize: 9, fill: THEME.textDim }} interval={3} />
                            <YAxis tick={{ fontSize: 9, fill: THEME.textDim }} width={35} />
                            <Tooltip contentStyle={TT_STYLE} />
                            <Line type="monotone" dataKey="primary" stroke={db.color} strokeWidth={2} dot={false} />
                            <Line
                                type="monotone"
                                dataKey="secondary"
                                stroke={THEME.warning}
                                strokeWidth={1.5}
                                dot={false}
                                strokeDasharray="4 2"
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </Panel>
                <div style={{ marginTop: 16 }}>
                    <Panel title="Details" icon={Database} accentColor={db.color}>
                        <DemoTable
                            columns={[
                                { key: 'item', label: 'Item', width: '35%' },
                                { key: 'value', label: 'Value', width: '20%' },
                                { key: 'status', label: 'Status', width: '20%' },
                                { key: 'trend', label: 'Trend', width: '25%' },
                            ]}
                            rows={Array.from({ length: 4 }, (_, i) => ({
                                item: `${SUB_TAB_DISPLAY_NAMES[subTabId] || subTabId} #${i + 1}`,
                                value: Math.floor(hashNorm(`${seed}-v-${i}`) * 500 + 50),
                                status: i < 3 ? 'Healthy' : 'Warning',
                                trend: hashNorm(`${seed}-t-${i}`) > 0.5 ? 'Increasing' : 'Stable',
                            }))}
                            color={db.color}
                        />
                    </Panel>
                </div>
            </>
        );
    }

    /* Layout D: 3 gauges + area chart */
    return (
        <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
                <Panel title="Primary" icon={Activity} accentColor={db.color}>
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0' }}>
                        <RingGauge
                            value={Math.floor(hashNorm(`${seed}-g1`) * 30 + 60)}
                            color={db.color}
                            size={80}
                            strokeWidth={6}
                            label="P1"
                        />
                    </div>
                </Panel>
                <Panel title="Secondary" icon={Shield} accentColor={THEME.success}>
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0' }}>
                        <RingGauge
                            value={Math.floor(hashNorm(`${seed}-g2`) * 15 + 80)}
                            color={THEME.success}
                            size={80}
                            strokeWidth={6}
                            label="P2"
                        />
                    </div>
                </Panel>
                <Panel title="Tertiary" icon={Clock} accentColor={db.color}>
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0' }}>
                        <RingGauge
                            value={Math.floor(hashNorm(`${seed}-g3`) * 20 + 40)}
                            color={db.color}
                            size={80}
                            strokeWidth={6}
                            label="P3"
                        />
                    </div>
                </Panel>
            </div>
            <div style={{ marginTop: 16 }}>
                <Panel
                    title={`${SUB_TAB_DISPLAY_NAMES[subTabId] || subTabId} Trend`}
                    icon={Activity}
                    accentColor={db.color}
                >
                    <ResponsiveContainer width="100%" height={160}>
                        <AreaChart data={trendData}>
                            <CartesianGrid strokeDasharray="3 3" stroke={THEME.gridLine} />
                            <XAxis dataKey="time" tick={{ fontSize: 9, fill: THEME.textDim }} interval={3} />
                            <YAxis tick={{ fontSize: 9, fill: THEME.textDim }} width={30} />
                            <Tooltip contentStyle={TT_STYLE} />
                            <Area
                                type="monotone"
                                dataKey="primary"
                                stroke={db.color}
                                fill={`${db.color}20`}
                                strokeWidth={2}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </Panel>
            </div>
        </>
    );
}

/** Map subTabId to a human-readable tab name for breadcrumb matching */
const SUB_TAB_DISPLAY_NAMES = {
    overview: 'Overview',
    performance: 'Performance',
    resources: 'Resources',
    reliability: 'Reliability',
    alerts: 'Alerts',
    optimizer: 'Query Optimizer',
    indexes: 'Indexes',
    regression: 'Plan Regression',
    bloat: 'Bloat Analysis',
    table: 'Table Analysis',
    pool: 'Connection Pool',
    replication: 'Replication & WAL',
    checkpoint: 'Checkpoint Monitor',
    maintenance: 'Vacuum & Maintenance',
    capacity: 'Capacity Planning',
    backup: 'Backup & Recovery',
    schema: 'Schema & Migrations',
    security: 'Security & Compliance',
    cloudwatch: 'CloudWatch',
    'log-patterns': 'Log Pattern Analysis',
    'alert-correlation': 'Alert Correlation',
    opentelemetry: 'OpenTelemetry',
    kubernetes: 'Kubernetes',
    'status-page': 'Status Page',
    'ai-monitoring': 'AI Monitoring',
    sql: 'SQL Console',
    api: 'API Tracing',
    repository: 'Repository',
    'ai-advisor': 'AI Query Advisor',
    tasks: 'DBA Task Scheduler',
    users: 'User Management',
    'admin-panel': 'Admin',
    retention: 'Data Retention',
    terraform: 'Terraform Export',
    'custom-dashboard': 'Custom Dashboards',
};

/** Find matching tab metrics within a section by display name */
function findTabMetrics(section, subTabId) {
    if (!section || !subTabId) return null;
    const displayName = SUB_TAB_DISPLAY_NAMES[subTabId];
    if (!displayName) return null;
    return section.tabs.find((t) => t.name === displayName) || section.tabs[0] || null;
}

export default function DemoDataTab({ dbKey = 'postgresql', sectionId, subTabId }) {
    const db = DATABASE_STRUCTURE[dbKey];
    const widgets = DETAIL_WIDGETS[dbKey] || DETAIL_WIDGETS.postgresql;
    if (!db) return null;

    const kpiIcons = [Activity, Zap, Database, Clock, HardDrive];

    /* When sectionId is provided, find and render only that section */
    const filteredSection = sectionId ? db.sections.find((s) => s.id === sectionId) : null;

    /* Find the specific tab within the section for tab-specific metrics */
    const activeTab = findTabMetrics(filteredSection, subTabId);
    const tabMetrics = activeTab?.metrics || null;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, padding: '0 0 48px 0' }}>
            <DemoStyles />

            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 22,
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
                    <LiveDot color={db.color} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: THEME.textMuted, letterSpacing: '0.03em' }}>
                        Demo Mode
                    </span>
                    <StatusBadge label={db.name} color={db.color} />
                    {filteredSection ? (
                        <StatusBadge label={filteredSection.name} color={db.color} />
                    ) : (
                        <StatusBadge label={`${db.sections.length} sections`} color={THEME.textMuted} />
                    )}
                </div>
                <StatusBadge label="DEMO" color={db.color} pulse />
            </div>

            {/* ── KPI Cards: show tab-specific metrics when subTab is active, else DB-level KPIs ── */}
            {tabMetrics ? (
                <div
                    className="demo-stagger"
                    style={{ display: 'grid', gridTemplateColumns: `repeat(${tabMetrics.length}, 1fr)`, gap: 18 }}
                >
                    {tabMetrics.map((m, i) => {
                        const Icon = kpiIcons[i] || Activity;
                        const trend = genTrend(m.label);
                        return (
                            <div
                                key={i}
                                className="demo-card-shine"
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 22,
                                    padding: '18px 22px',
                                    borderRadius: 16,
                                    border: `1px solid ${THEME.glassBorder}`,
                                    position: 'relative',
                                    overflow: 'hidden',
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div
                                        style={{
                                            width: 30,
                                            height: 30,
                                            borderRadius: 20,
                                            flexShrink: 0,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            background: `${db.color}10`,
                                            border: `1px solid ${db.color}18`,
                                        }}
                                    >
                                        <Icon size={14} color={db.color} />
                                    </div>
                                    <MiniSparkline
                                        data={genSparkData(m.label)}
                                        color={db.color}
                                        width={48}
                                        height={18}
                                    />
                                </div>
                                <div>
                                    <div
                                        style={{
                                            fontSize: 9.5,
                                            color: THEME.textDim,
                                            fontWeight: 600,
                                            letterSpacing: '0.02em',
                                            lineHeight: 1,
                                            marginBottom: 5,
                                        }}
                                    >
                                        {m.label}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                                        <span
                                            style={{
                                                fontSize: 22,
                                                fontWeight: 700,
                                                color: db.color,
                                                lineHeight: 1,
                                                letterSpacing: '-0.02em',
                                                fontFamily: "'JetBrains Mono',monospace",
                                            }}
                                        >
                                            {m.value}
                                        </span>
                                        <span style={{ fontSize: 10, color: THEME.textDim }}>{m.unit}</span>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                    {trend.up ? (
                                        <ArrowUpRight size={10} color={THEME.success} />
                                    ) : (
                                        <ArrowDownRight size={10} color={THEME.warning} />
                                    )}
                                    <span
                                        style={{
                                            fontSize: 10,
                                            fontWeight: 700,
                                            color: trend.up ? THEME.success : THEME.warning,
                                            fontFamily: "'JetBrains Mono',monospace",
                                        }}
                                    >
                                        {trend.value}
                                    </span>
                                    <span style={{ fontSize: 9.5, color: THEME.textDim, marginLeft: 2 }}>
                                        vs last hr
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div
                    className="demo-stagger"
                    style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 18 }}
                >
                    {db.kpis.map((kpi, i) => {
                        const Icon = kpiIcons[i] || Activity;
                        const trend = genTrend(kpi.label);
                        return (
                            <div
                                key={i}
                                className="demo-card-shine"
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 22,
                                    padding: '18px 22px',
                                    borderRadius: 16,
                                    border: `1px solid ${THEME.glassBorder}`,
                                    position: 'relative',
                                    overflow: 'hidden',
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div
                                        style={{
                                            width: 30,
                                            height: 30,
                                            borderRadius: 20,
                                            flexShrink: 0,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            background: `${db.color}10`,
                                            border: `1px solid ${db.color}18`,
                                        }}
                                    >
                                        <Icon size={14} color={db.color} />
                                    </div>
                                    <MiniSparkline
                                        data={genSparkData(kpi.label)}
                                        color={db.color}
                                        width={48}
                                        height={18}
                                    />
                                </div>
                                <div>
                                    <div
                                        style={{
                                            fontSize: 9.5,
                                            color: THEME.textDim,
                                            fontWeight: 600,
                                            letterSpacing: '0.02em',
                                            lineHeight: 1,
                                            marginBottom: 5,
                                        }}
                                    >
                                        {kpi.label}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                                        <span
                                            style={{
                                                fontSize: 22,
                                                fontWeight: 700,
                                                color: db.color,
                                                lineHeight: 1,
                                                letterSpacing: '-0.02em',
                                                fontFamily: "'JetBrains Mono',monospace",
                                            }}
                                        >
                                            {kpi.value}
                                        </span>
                                        <span style={{ fontSize: 10, color: THEME.textDim }}>{kpi.unit}</span>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                    {trend.up ? (
                                        <ArrowUpRight size={10} color={THEME.success} />
                                    ) : (
                                        <ArrowDownRight size={10} color={THEME.warning} />
                                    )}
                                    <span
                                        style={{
                                            fontSize: 10,
                                            fontWeight: 700,
                                            color: trend.up ? THEME.success : THEME.warning,
                                            fontFamily: "'JetBrains Mono',monospace",
                                        }}
                                    >
                                        {trend.value}
                                    </span>
                                    <span style={{ fontSize: 9.5, color: THEME.textDim, marginLeft: 2 }}>
                                        vs last hr
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ── Tab-specific content area ── */}
            {filteredSection ? (
                <>
                    {/* Show tab-specific widget based on subTabId, falling back to section-level widgets */}
                    <SubTabContent subTabId={subTabId} section={filteredSection} db={db} widgets={widgets} />
                </>
            ) : (
                <>
                    <OverviewPanels widgets={widgets} db={db} />
                    {db.sections.map((section) => (
                        <div key={section.id} style={{ marginTop: 24 }}>
                            <SectionContent section={section} db={db} />
                        </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0' }}>
                        <Panel title="Overall Health" icon={Shield} accentColor={db.color} style={{ maxWidth: 300 }}>
                            <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0' }}>
                                <RingGauge value={92} color={db.color} size={100} strokeWidth={8} label="health" />
                            </div>
                        </Panel>
                    </div>
                </>
            )}
        </div>
    );
}
