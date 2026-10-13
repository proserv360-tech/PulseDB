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
    Bell,
    Eye,
    Server,
    Shield,
    Gauge,
    Terminal,
    Zap,
    Clock,
    TrendingUp,
    HardDrive,
    AlertCircle,
    Lock,
    Users,
    Code,
    CheckCircle,
    Network,
    RefreshCw,
    Settings,
    Cpu,
    BarChart3,
    Layers,
    FileText,
    GitBranch,
    Radio,
    Archive,
    AlertTriangle,
    Info,
    Droplet,
    Anchor,
    ArrowUpRight,
    Cloud,
    Wrench,
    Copy,
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

function DemoMySQLTab({ tabId }) {
    useAdaptiveTheme();

    const demoData = useMemo(() => {
        const base24h = generateChartData(24);
        const base30d = generateChartData(30);

        return {
            innodb: {
                bufferPoolUsage: 78.5,
                bufferPoolSize: 8192,
                bufferPoolPages: 2048000,
                readHits: 99.2,
                writeHits: 87.3,
                pagesRead: 1240,
                pagesWritten: 560,
                dirtyPages: 12400,
            },
            qps: base24h.map((d, i) => ({
                ...d,
                value: Math.floor(850 + Math.sin(i / 6) * 350 + Math.random() * 180),
            })),
            tps: base24h.map((d, i) => ({
                ...d,
                value: Math.floor(620 + Math.cos(i / 6) * 250 + Math.random() * 140),
            })),
            connections: base24h.map((d, i) => ({
                ...d,
                active: Math.floor(38 + Math.sin(i / 8) * 12 + Math.random() * 8),
                idle: Math.floor(28 + Math.cos(i / 8) * 15 + Math.random() * 10),
            })),
            replication: base24h.map((d, i) => ({
                ...d,
                lag: Math.floor(2 + Math.random() * 8),
                relayLog: Math.floor(850 + Math.sin(i / 5) * 400 + Math.random() * 200),
            })),
            databases: [
                { name: 'production', engine: 'InnoDB', size: '52.4 GB', tables: 127, rows: 4230000 },
                { name: 'analytics', engine: 'InnoDB', size: '38.9 GB', tables: 64, rows: 2150000 },
                { name: 'cache_db', engine: 'Memory', size: '2.1 GB', tables: 24, rows: 580000 },
                { name: 'logs', engine: 'InnoDB', size: '14.2 GB', tables: 12, rows: 890000 },
            ],
            alerts: {
                critical: 1,
                warning: 4,
                info: 8,
                resolved: 38,
            },
            alertList: [
                {
                    severity: 'critical',
                    title: 'Buffer Pool Usage Critical',
                    time: '2 min ago',
                    source: 'innodb_monitor',
                    color: THEME.danger,
                },
                {
                    severity: 'warning',
                    title: 'High Replication Lag Detected',
                    time: '5 min ago',
                    source: 'replication',
                    color: THEME.warning,
                },
                {
                    severity: 'warning',
                    title: 'Slow Query Threshold Exceeded',
                    time: '8 min ago',
                    source: 'slow_log',
                    color: THEME.warning,
                },
                {
                    severity: 'info',
                    title: 'Binlog Rotation Scheduled',
                    time: '12 min ago',
                    source: 'binlog_monitor',
                    color: THEME.primary,
                },
            ],
            topQueries: [
                {
                    query: 'SELECT * FROM orders WHERE status = ?',
                    calls: 1840000,
                    avgTime: '1.24ms',
                    maxTime: '45.2ms',
                    rows: 4200000,
                    execTime: '34.2%',
                },
                {
                    query: 'UPDATE inventory SET qty = ? WHERE id = ?',
                    calls: 1200000,
                    avgTime: '2.1ms',
                    maxTime: '78.4ms',
                    rows: 1200000,
                    execTime: '28.5%',
                },
                {
                    query: 'SELECT id, name FROM users WHERE active = 1',
                    calls: 680000,
                    avgTime: '0.85ms',
                    maxTime: '12.3ms',
                    rows: 680000,
                    execTime: '15.1%',
                },
            ],
            indexes: [
                {
                    table: 'orders',
                    name: 'idx_orders_user_id',
                    columns: 'user_id',
                    size: '2.4 MB',
                    cardinality: 15600,
                    efficiency: '92%',
                },
                {
                    table: 'products',
                    name: 'idx_products_category',
                    columns: 'category_id, status',
                    size: '1.8 MB',
                    cardinality: 240,
                    efficiency: '78%',
                },
                {
                    table: 'users',
                    name: 'idx_users_email',
                    columns: 'email',
                    size: '890 KB',
                    cardinality: 54200,
                    efficiency: '96%',
                },
            ],
            binlog: [
                { file: 'mysql-bin.000142', position: 1247890, size: '124 MB', age: '2h 15m' },
                { file: 'mysql-bin.000141', position: 4294967295, size: '256 MB', age: '4h 30m' },
                { file: 'mysql-bin.000140', position: 4294967295, size: '256 MB', age: '6h 45m' },
            ],
            replicationStatus: {
                role: 'Master',
                slaveCount: 2,
                gtidMode: 'ON',
                gtidExecuted: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890:1-8946',
                masterLogFile: 'mysql-bin.000142',
                masterLogPos: 1247890,
                binlogDoDB: 'production',
                binlogIgnoreDB: 'mysql, information_schema',
            },
            poolStatus: {
                maxConnections: 200,
                activeConnections: 38,
                idleConnections: 28,
                totalCreated: 14240,
                connectionErrors: 2,
                connectionWaitTime: '0.8ms',
            },
            schema: [
                {
                    name: 'production',
                    tables: 127,
                    views: 18,
                    procedures: 24,
                    functions: 12,
                    triggers: 8,
                    size: '52.4 GB',
                },
                {
                    name: 'analytics',
                    tables: 64,
                    views: 32,
                    procedures: 8,
                    functions: 4,
                    triggers: 0,
                    size: '38.9 GB',
                },
            ],
        };
    }, []);

    const sections = [
        {
            key: 'overview',
            label: 'Overview',
            icon: Activity,
            accent: THEME.primary,
            items: [
                { key: 'fleet', label: 'Fleet Overview' },
                { key: 'database', label: 'Database Overview' },
                { key: 'performance', label: 'Performance' },
                { key: 'resources', label: 'Resources' },
                { key: 'reliability', label: 'Reliability' },
            ],
        },
        {
            key: 'alerts',
            label: 'Alerts & Rules',
            icon: Bell,
            accent: THEME.danger,
            items: [
                { key: 'activeAlerts', label: 'Active Alerts' },
                { key: 'alertRules', label: 'Alert Rules' },
                { key: 'correlation', label: 'Alert Correlation' },
            ],
        },
        {
            key: 'query',
            label: 'Query Analysis',
            icon: BarChart3,
            accent: THEME.ai,
            items: [
                { key: 'queryOptimizer', label: 'Query Optimizer' },
                { key: 'queryPlan', label: 'Query Plan Viewer' },
                { key: 'planRegression', label: 'Plan Regression' },
                { key: 'indexes', label: 'Indexes' },
                { key: 'bloatAnalysis', label: 'Table Bloat' },
                { key: 'tableAnalysis', label: 'Table Analysis' },
            ],
        },
        {
            key: 'schema',
            label: 'Schema & Data',
            icon: Layers,
            accent: THEME.success,
            items: [
                { key: 'migrations', label: 'Schema & Migrations' },
                { key: 'tableDeps', label: 'Table Dependencies' },
                { key: 'chartBuilder', label: 'Chart Builder' },
            ],
        },
        {
            key: 'infra',
            label: 'Infrastructure',
            icon: Server,
            accent: THEME.primary,
            items: [
                { key: 'connPool', label: 'Connection Pool' },
                { key: 'poolMetrics', label: 'Pool Metrics' },
                { key: 'replication', label: 'Replication & Binlog' },
                { key: 'checkpoints', label: 'Checkpoint Monitor' },
                { key: 'maintenance', label: 'Optimize & Maintenance' },
                { key: 'capacity', label: 'Capacity Planning' },
                { key: 'backup', label: 'Backup & Recovery' },
            ],
        },
        {
            key: 'security',
            label: 'Security',
            icon: Shield,
            accent: THEME.success,
            items: [{ key: 'secCompliance', label: 'Security & Compliance' }],
        },
        {
            key: 'observability',
            label: 'Observability',
            icon: Eye,
            accent: THEME.warning,
            items: [
                { key: 'obsHub', label: 'Observability Hub' },
                { key: 'cloudwatch', label: 'CloudWatch' },
                { key: 'logPatterns', label: 'Log Pattern Analysis' },
                { key: 'otel', label: 'OpenTelemetry' },
                { key: 'k8s', label: 'Kubernetes' },
                { key: 'statusPage', label: 'Status Page' },
                { key: 'aiMonitoring', label: 'AI Monitoring' },
            ],
        },
        {
            key: 'dev',
            label: 'Developer Tools',
            icon: Terminal,
            accent: THEME.primary,
            items: [
                { key: 'sqlConsole', label: 'SQL Console' },
                { key: 'apiTracing', label: 'API Tracing' },
                { key: 'repository', label: 'Repository' },
                { key: 'aiAdvisor', label: 'AI Query Advisor' },
            ],
        },
    ];

    const renderContent = (sectionKey, itemKey) => {
        /* ═══════════════════════════════════════════════════════════════════════════
           OVERVIEW SECTION
           ═══════════════════════════════════════════════════════════════════════════ */
        if (sectionKey === 'overview') {
            if (itemKey === 'fleet') {
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                        <h1 style={{ fontSize: 20, fontWeight: 700, color: THEME.textMain, margin: '0 0 12px' }}>
                            Fleet Overview
                        </h1>
                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                                gap: 18,
                            }}
                            className="dpg-stagger"
                        >
                            <MetricCard
                                icon={Server}
                                label="MySQL Instances"
                                value="12"
                                sub="Prod: 8, Dev: 4"
                                color={THEME.primary}
                                spark={Array.from({ length: 12 }, () => Math.random() * 100)}
                            />
                            <MetricCard
                                icon={Activity}
                                label="Healthy"
                                value="11"
                                sub="1 degraded"
                                color={THEME.success}
                                trend={2.3}
                                trendUp={true}
                            />
                            <MetricCard
                                icon={HardDrive}
                                label="Total Storage"
                                value="487GB"
                                sub="Used: 312GB"
                                color={THEME.primary}
                                spark={Array.from({ length: 12 }, () => Math.random() * 100)}
                            />
                            <MetricCard
                                icon={Cpu}
                                label="Avg CPU"
                                value="42%"
                                sub="Peak: 78%"
                                color={THEME.warning}
                                trend={-1.2}
                                trendUp={false}
                            />
                        </div>
                    </div>
                );
            }

            if (itemKey === 'database') {
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }} className="dpg-stagger">
                        <h1 style={{ fontSize: 20, fontWeight: 700, color: THEME.textMain, margin: '0 0 12px' }}>
                            Database Overview
                        </h1>

                        {/* Status & Key Metrics Row */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 22 }}>
                            <Panel title="STATUS" icon={CheckCircle} accentColor={THEME.success}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                        <StatusBadge label="Operational" color={THEME.success} pulse />
                                        <StatusBadge label="Production" color={THEME.primary} />
                                        <StatusBadge label="MySQL 8.0.36" color={THEME.ai} />
                                    </div>
                                </div>
                            </Panel>

                            <Panel title="QPS" icon={Zap} accentColor={THEME.ai}>
                                <div style={{ textAlign: 'center' }}>
                                    <div
                                        style={{
                                            fontSize: 28,
                                            fontWeight: 800,
                                            color: THEME.primary,
                                            fontFamily: THEME.fontMono,
                                            marginBottom: 8,
                                        }}
                                    >
                                        856
                                    </div>
                                    <div style={{ fontSize: 10, color: THEME.textDim }}>queries per second</div>
                                    <div
                                        style={{
                                            marginTop: 8,
                                            height: 20,
                                        }}
                                    >
                                        <MiniSparkline
                                            data={demoData.qps.slice(-12).map((d) => d.value)}
                                            color={THEME.primary}
                                            width={100}
                                            height={20}
                                        />
                                    </div>
                                </div>
                            </Panel>

                            <Panel title="CONNECTIONS" icon={Network} accentColor={THEME.warning}>
                                <div style={{ textAlign: 'center' }}>
                                    <div
                                        style={{
                                            fontSize: 28,
                                            fontWeight: 800,
                                            color: THEME.warning,
                                            fontFamily: THEME.fontMono,
                                            marginBottom: 4,
                                        }}
                                    >
                                        38
                                    </div>
                                    <div style={{ fontSize: 10, color: THEME.textDim, marginBottom: 8 }}>
                                        of 512 max
                                    </div>
                                    <div
                                        style={{
                                            background: THEME.gridDark,
                                            borderRadius: 20,
                                            height: 4,
                                            overflow: 'hidden',
                                        }}
                                    >
                                        <div
                                            style={{
                                                background: `linear-gradient(90deg, ${THEME.warning}, ${THEME.ai})`,
                                                height: '100%',
                                                width: '7.4%',
                                            }}
                                        />
                                    </div>
                                </div>
                            </Panel>

                            <Panel title="INNODB CACHE HIT" icon={Gauge} accentColor={THEME.success}>
                                <div style={{ textAlign: 'center' }}>
                                    <div
                                        style={{
                                            fontSize: 28,
                                            fontWeight: 800,
                                            color: THEME.success,
                                            fontFamily: THEME.fontMono,
                                            marginBottom: 8,
                                        }}
                                    >
                                        99.1%
                                    </div>
                                    <div style={{ fontSize: 10, color: THEME.textDim }}>buffer pool hit rate</div>
                                </div>
                            </Panel>
                        </div>

                        {/* More KPIs Row */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 22 }}>
                            <MetricCard
                                icon={HardDrive}
                                label="Buffer Pool Usage"
                                value="78.5%"
                                sub="6.4 GB of 8.2 GB"
                                color={THEME.ai}
                                spark={Array.from({ length: 12 }, () => Math.random() * 100)}
                            />
                            <MetricCard
                                icon={AlertTriangle}
                                label="Slow Queries/hr"
                                value="3"
                                sub="1 critical"
                                color={THEME.warning}
                                spark={[2, 5, 3, 1, 2, 8, 3, 5, 2, 1, 4, 3]}
                            />
                            <MetricCard
                                icon={Clock}
                                label="Replication Lag"
                                value="0.2s"
                                sub="Slave-1: 0.18s"
                                color={THEME.success}
                                spark={Array.from({ length: 12 }, () => Math.random() * 1)}
                            />
                        </div>

                        {/* Detailed Info Panels */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 22 }}>
                            <Panel title="LAST BACKUP" icon={Archive} accentColor={THEME.primary}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                    <div>
                                        <div
                                            style={{
                                                fontSize: 11,
                                                color: THEME.textMuted,

                                                fontWeight: 600,
                                                marginBottom: 4,
                                            }}
                                        >
                                            Type
                                        </div>
                                        <div style={{ fontSize: 13, color: THEME.textMain, fontWeight: 500 }}>
                                            mysqldump full backup
                                        </div>
                                    </div>
                                    <div>
                                        <div
                                            style={{
                                                fontSize: 11,
                                                color: THEME.textMuted,

                                                fontWeight: 600,
                                                marginBottom: 4,
                                            }}
                                        >
                                            Status
                                        </div>
                                        <StatusBadge label="Verified" color={THEME.success} />
                                    </div>
                                    <div>
                                        <div
                                            style={{
                                                fontSize: 11,
                                                color: THEME.textMuted,

                                                fontWeight: 600,
                                                marginBottom: 4,
                                            }}
                                        >
                                            Age
                                        </div>
                                        <div style={{ fontSize: 13, color: THEME.textMain, fontWeight: 500 }}>
                                            2h 14m ago
                                        </div>
                                    </div>
                                    <div>
                                        <div
                                            style={{
                                                fontSize: 11,
                                                color: THEME.textMuted,

                                                fontWeight: 600,
                                                marginBottom: 4,
                                            }}
                                        >
                                            Size
                                        </div>
                                        <div style={{ fontSize: 13, color: THEME.textMain, fontWeight: 500 }}>
                                            8.2 GB (compressed)
                                        </div>
                                    </div>
                                </div>
                            </Panel>

                            <Panel title="SLOW QUERIES" icon={AlertTriangle} accentColor={THEME.warning}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                    {[
                                        { query: 'SELECT orders WHERE id=?', duration: '45.2ms', pct: 85 },
                                        { query: 'UPDATE inventory SET qty', duration: '78.4ms', pct: 95 },
                                        { query: 'SELECT FROM products', duration: '12.3ms', pct: 30 },
                                    ].map((q, i) => (
                                        <div key={i} style={{ fontSize: 10 }}>
                                            <div
                                                style={{
                                                    color: THEME.textMuted,
                                                    marginBottom: 2,
                                                    fontFamily: THEME.fontMono,
                                                    whiteSpace: 'nowrap',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                }}
                                            >
                                                {q.query}
                                            </div>
                                            <div
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    marginBottom: 4,
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        background: THEME.gridDark,
                                                        borderRadius: 2,
                                                        height: 3,
                                                        flex: 1,
                                                        marginRight: 8,
                                                    }}
                                                >
                                                    <div
                                                        style={{
                                                            background: THEME.warning,
                                                            height: '100%',
                                                            width: `${q.pct}%`,
                                                        }}
                                                    />
                                                </div>
                                                <span style={{ color: THEME.warning, fontWeight: 600 }}>
                                                    {q.duration}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </Panel>

                            <Panel title="INNODB STATUS" icon={Activity} accentColor={THEME.primary}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 20, fontSize: 11 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: THEME.textDim }}>Hit Rate</span>
                                        <span style={{ color: THEME.success, fontWeight: 600 }}>99.2%</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: THEME.textDim }}>Dirty Pages</span>
                                        <span style={{ color: THEME.warning, fontWeight: 600 }}>12.4K</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: THEME.textDim }}>Pending I/O</span>
                                        <span style={{ color: THEME.primary, fontWeight: 600 }}>28 reads</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: THEME.textDim }}>Read Ahead</span>
                                        <span style={{ color: THEME.success, fontWeight: 600 }}>enabled</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: THEME.textDim }}>Doublewrite</span>
                                        <span style={{ color: THEME.success, fontWeight: 600 }}>enabled</span>
                                    </div>
                                </div>
                            </Panel>
                        </div>

                        {/* Query Throughput Chart */}
                        <Panel title="QUERY THROUGHPUT (24H)" icon={TrendingUp} accentColor={THEME.ai}>
                            <ResponsiveContainer width="100%" height={200}>
                                <AreaChart data={demoData.qps}>
                                    <defs>
                                        <linearGradient id="qpsgradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={THEME.ai} stopOpacity={0.3} />
                                            <stop offset="95%" stopColor={THEME.ai} stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke={`${THEME.grid}40`} />
                                    <XAxis dataKey="time" stroke={THEME.textDim} style={{ fontSize: 10 }} />
                                    <YAxis stroke={THEME.textDim} style={{ fontSize: 10 }} />
                                    <Tooltip
                                        contentStyle={{
                                            background: THEME.surface,
                                            border: `1px solid ${THEME.glassBorder}`,
                                            borderRadius: 20,
                                        }}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="value"
                                        stroke={THEME.ai}
                                        fillOpacity={1}
                                        fill="url(#qpsgradient)"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </Panel>

                        {/* InnoDB Health & Resource Gauges */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 1fr', gap: 22 }}>
                            <Panel
                                title="BUFFER POOL"
                                icon={HardDrive}
                                accentColor={THEME.ai}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                                noPad={true}
                            >
                                <div
                                    style={{
                                        padding: '16px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                    }}
                                >
                                    <RingGauge value={78} color={THEME.ai} size={100} strokeWidth={7} label="Used" />
                                    <div
                                        style={{
                                            fontSize: 10,
                                            color: THEME.textDim,
                                            marginTop: 8,
                                            textAlign: 'center',
                                        }}
                                    >
                                        6.4GB / 8.2GB
                                    </div>
                                </div>
                            </Panel>

                            <Panel
                                title="CACHE HIT"
                                icon={Gauge}
                                accentColor={THEME.success}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                                noPad={true}
                            >
                                <div
                                    style={{
                                        padding: '16px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                    }}
                                >
                                    <RingGauge
                                        value={99}
                                        color={THEME.success}
                                        size={100}
                                        strokeWidth={7}
                                        label="Hit %"
                                    />
                                </div>
                            </Panel>

                            <Panel
                                title="CPU"
                                icon={Cpu}
                                accentColor={THEME.warning}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                                noPad={true}
                            >
                                <div
                                    style={{
                                        padding: '16px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                    }}
                                >
                                    <RingGauge
                                        value={42}
                                        color={THEME.warning}
                                        size={100}
                                        strokeWidth={7}
                                        label="Usage"
                                    />
                                </div>
                            </Panel>

                            <Panel
                                title="MEMORY"
                                icon={Droplet}
                                accentColor={THEME.ai}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                                noPad={true}
                            >
                                <div
                                    style={{
                                        padding: '16px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                    }}
                                >
                                    <RingGauge value={68} color={THEME.ai} size={100} strokeWidth={7} label="Used" />
                                    <div style={{ fontSize: 10, color: THEME.textDim, marginTop: 8 }}>
                                        17.2GB / 25.6GB
                                    </div>
                                </div>
                            </Panel>

                            <Panel
                                title="DISK I/O"
                                icon={HardDrive}
                                accentColor={THEME.primary}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                                noPad={true}
                            >
                                <div
                                    style={{
                                        padding: '16px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                    }}
                                >
                                    <RingGauge
                                        value={34}
                                        color={THEME.primary}
                                        size={100}
                                        strokeWidth={7}
                                        label="I/O %"
                                    />
                                </div>
                            </Panel>

                            <Panel
                                title="CONNECTIONS"
                                icon={Network}
                                accentColor={THEME.warning}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                                noPad={true}
                            >
                                <div
                                    style={{
                                        padding: '16px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                    }}
                                >
                                    <RingGauge
                                        value={19}
                                        color={THEME.warning}
                                        size={100}
                                        strokeWidth={7}
                                        label="Used"
                                    />
                                    <div style={{ fontSize: 10, color: THEME.textDim, marginTop: 8 }}>38 / 200</div>
                                </div>
                            </Panel>
                        </div>

                        {/* Replication Topology */}
                        <Panel title="REPLICATION TOPOLOGY" icon={GitBranch} accentColor={THEME.primary}>
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    fontSize: 12,
                                }}
                            >
                                <div style={{ textAlign: 'center', flex: 1 }}>
                                    <div
                                        style={{
                                            background: THEME.primaryDark,
                                            color: THEME.textInverse,
                                            padding: '20px 24px',
                                            borderRadius: 18,
                                            fontWeight: 700,
                                            marginBottom: 8,
                                        }}
                                    >
                                        MASTER
                                    </div>
                                    <div style={{ fontSize: 10, color: THEME.textDim }}>mysql-bin.000142</div>
                                    <div
                                        style={{
                                            fontSize: 10,
                                            color: THEME.textMuted,
                                            fontFamily: THEME.fontMono,
                                            marginTop: 4,
                                        }}
                                    >
                                        Pos: 1.24M
                                    </div>
                                </div>

                                <div style={{ fontSize: 16, color: THEME.textDim, margin: '0 16px' }}>{'>'}</div>

                                <div style={{ textAlign: 'center', flex: 1 }}>
                                    <div
                                        style={{
                                            background: THEME.success,
                                            color: THEME.textInverse,
                                            padding: '20px 24px',
                                            borderRadius: 18,
                                            fontWeight: 700,
                                            marginBottom: 8,
                                        }}
                                    >
                                        SLAVE-1
                                    </div>
                                    <div style={{ fontSize: 10, color: THEME.textDim }}>Lag: 0.18s</div>
                                    <div
                                        style={{
                                            fontSize: 10,
                                            color: THEME.textMuted,
                                            fontFamily: THEME.fontMono,
                                            marginTop: 4,
                                        }}
                                    >
                                        GTID: 1-8912
                                    </div>
                                </div>

                                <div style={{ fontSize: 16, color: THEME.textDim, margin: '0 16px' }}>{'>'}</div>

                                <div style={{ textAlign: 'center', flex: 1 }}>
                                    <div
                                        style={{
                                            background: THEME.success,
                                            color: THEME.textInverse,
                                            padding: '20px 24px',
                                            borderRadius: 18,
                                            fontWeight: 700,
                                            marginBottom: 8,
                                        }}
                                    >
                                        SLAVE-2
                                    </div>
                                    <div style={{ fontSize: 10, color: THEME.textDim }}>Lag: 0.22s</div>
                                    <div
                                        style={{
                                            fontSize: 10,
                                            color: THEME.textMuted,
                                            fontFamily: THEME.fontMono,
                                            marginTop: 4,
                                        }}
                                    >
                                        GTID: 1-8912
                                    </div>
                                </div>
                            </div>
                        </Panel>

                        {/* Top Tables by Operations */}
                        <Panel title="TOP TABLES BY OPERATIONS" icon={Database} accentColor={THEME.ai}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                                {[
                                    { name: 'orders', reads: 8400000, writes: 2100000, selects: 1840000 },
                                    { name: 'users', reads: 5200000, writes: 800000, selects: 680000 },
                                    { name: 'products', reads: 3100000, writes: 450000, selects: 520000 },
                                ].map((t, i) => {
                                    const total = t.reads + t.writes;
                                    const readPct = (t.reads / total) * 100;
                                    return (
                                        <div key={i}>
                                            <div
                                                style={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    marginBottom: 6,
                                                    fontSize: 11,
                                                }}
                                            >
                                                <span style={{ color: THEME.textMuted, fontWeight: 600 }}>
                                                    {t.name}
                                                </span>
                                                <span style={{ color: THEME.textDim, fontSize: 10 }}>
                                                    {(t.reads / 1000000).toFixed(1)}M R /{' '}
                                                    {(t.writes / 1000000).toFixed(1)}M W
                                                </span>
                                            </div>
                                            <div
                                                style={{
                                                    display: 'flex',
                                                    height: 6,
                                                    borderRadius: 3,
                                                    overflow: 'hidden',
                                                    gap: 1,
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        flex: readPct,
                                                        background: THEME.primary,
                                                    }}
                                                />
                                                <div
                                                    style={{
                                                        flex: 100 - readPct,
                                                        background: THEME.ai,
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </Panel>

                        {/* Binary Log Status */}
                        <Panel title="BINARY LOG STATUS" icon={Radio} accentColor={THEME.primary}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                {demoData.binlog.map((b, i) => (
                                    <div
                                        key={i}
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            fontSize: 11,
                                            borderBottom:
                                                i < demoData.binlog.length - 1 ? `1px solid ${THEME.gridDark}` : 'none',
                                            paddingBottom: 10,
                                        }}
                                    >
                                        <div style={{ flex: 1 }}>
                                            <div
                                                style={{
                                                    color: THEME.textMuted,
                                                    fontFamily: THEME.fontMono,
                                                    marginBottom: 2,
                                                }}
                                            >
                                                {b.file}
                                            </div>
                                            <div style={{ color: THEME.textDim, fontSize: 9 }}>
                                                Position: {b.position.toLocaleString()} {b.age}
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ color: THEME.textMuted, fontWeight: 600 }}>{b.size}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </Panel>
                    </div>
                );
            }

            if (itemKey === 'performance') {
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }} className="dpg-stagger">
                        <h1 style={{ fontSize: 20, fontWeight: 700, color: THEME.textMain, margin: '0 0 12px' }}>
                            Performance
                        </h1>

                        {/* KPIs */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 22 }}>
                            <MetricCard
                                icon={Zap}
                                label="QPS"
                                value="856"
                                sub="Peak: 1240/s"
                                color={THEME.primary}
                                spark={demoData.qps.slice(-12).map((d) => d.value)}
                            />
                            <MetricCard
                                icon={Clock}
                                label="Avg Query Time"
                                value="1.24ms"
                                sub="Max: 78.4ms"
                                color={THEME.warning}
                                spark={[1.2, 1.5, 0.8, 1.1, 1.3, 1.0, 1.4, 0.9, 1.2, 1.1, 1.3, 1.0]}
                            />
                            <MetricCard
                                icon={TrendingUp}
                                label="TPS"
                                value="620"
                                sub="Transactions/s"
                                color={THEME.success}
                                spark={demoData.tps.slice(-12).map((d) => d.value)}
                            />
                            <MetricCard
                                icon={AlertTriangle}
                                label="Lock Wait Time"
                                value="0.2ms"
                                sub="Max: 2.5ms"
                                color={THEME.primary}
                                spark={[0.1, 0.2, 0.15, 0.1, 0.3, 0.2, 0.1, 0.15, 0.2, 0.1, 0.25, 0.15]}
                            />
                        </div>

                        {/* Query Performance Charts */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22 }}>
                            <Panel title="QUERIES PER SECOND (24H)" icon={Zap} accentColor={THEME.primary}>
                                <ResponsiveContainer width="100%" height={220}>
                                    <AreaChart data={demoData.qps}>
                                        <defs>
                                            <linearGradient id="qps24" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor={THEME.primary} stopOpacity={0.3} />
                                                <stop offset="95%" stopColor={THEME.primary} stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke={`${THEME.grid}40`} />
                                        <XAxis dataKey="time" stroke={THEME.textDim} style={{ fontSize: 10 }} />
                                        <YAxis stroke={THEME.textDim} style={{ fontSize: 10 }} />
                                        <Tooltip
                                            contentStyle={{
                                                background: THEME.surface,
                                                border: `1px solid ${THEME.glassBorder}`,
                                                borderRadius: 20,
                                            }}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="value"
                                            stroke={THEME.primary}
                                            fillOpacity={1}
                                            fill="url(#qps24)"
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </Panel>

                            <Panel title="TRANSACTIONS PER SECOND (24H)" icon={TrendingUp} accentColor={THEME.success}>
                                <ResponsiveContainer width="100%" height={220}>
                                    <AreaChart data={demoData.tps}>
                                        <defs>
                                            <linearGradient id="tps24" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor={THEME.success} stopOpacity={0.3} />
                                                <stop offset="95%" stopColor={THEME.success} stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke={`${THEME.grid}40`} />
                                        <XAxis dataKey="time" stroke={THEME.textDim} style={{ fontSize: 10 }} />
                                        <YAxis stroke={THEME.textDim} style={{ fontSize: 10 }} />
                                        <Tooltip
                                            contentStyle={{
                                                background: THEME.surface,
                                                border: `1px solid ${THEME.glassBorder}`,
                                                borderRadius: 20,
                                            }}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="value"
                                            stroke={THEME.success}
                                            fillOpacity={1}
                                            fill="url(#tps24)"
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </Panel>
                        </div>

                        {/* Connection & Lock Stats */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22 }}>
                            <Panel title="ACTIVE CONNECTIONS" icon={Network} accentColor={THEME.warning}>
                                <ResponsiveContainer width="100%" height={220}>
                                    <LineChart data={demoData.connections}>
                                        <CartesianGrid strokeDasharray="3 3" stroke={`${THEME.grid}40`} />
                                        <XAxis dataKey="time" stroke={THEME.textDim} style={{ fontSize: 10 }} />
                                        <YAxis stroke={THEME.textDim} style={{ fontSize: 10 }} />
                                        <Tooltip
                                            contentStyle={{
                                                background: THEME.surface,
                                                border: `1px solid ${THEME.glassBorder}`,
                                                borderRadius: 20,
                                            }}
                                        />
                                        <Legend />
                                        <Line
                                            type="monotone"
                                            dataKey="active"
                                            stroke={THEME.warning}
                                            strokeWidth={2}
                                            dot={false}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="idle"
                                            stroke={THEME.textDim}
                                            strokeWidth={2}
                                            dot={false}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </Panel>

                            <Panel title="TOP QUERIES" icon={Code} accentColor={THEME.ai}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                    {demoData.topQueries.map((q, i) => (
                                        <div
                                            key={i}
                                            style={{
                                                borderBottom:
                                                    i < demoData.topQueries.length - 1
                                                        ? `1px solid ${THEME.gridDark}`
                                                        : 'none',
                                                paddingBottom: 10,
                                            }}
                                        >
                                            <div
                                                style={{
                                                    fontSize: 10,
                                                    color: THEME.textMuted,
                                                    fontFamily: THEME.fontMono,
                                                    marginBottom: 6,
                                                    whiteSpace: 'nowrap',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                }}
                                            >
                                                {q.query}
                                            </div>
                                            <div
                                                style={{
                                                    display: 'grid',
                                                    gridTemplateColumns: '1fr 1fr',
                                                    gap: 6,
                                                    fontSize: 9,
                                                }}
                                            >
                                                <div style={{ color: THEME.textDim }}>
                                                    Calls: {(q.calls / 1000000).toFixed(1)}M
                                                </div>
                                                <div style={{ color: THEME.textDim }}>Avg: {q.avgTime}</div>
                                                <div style={{ color: THEME.textDim }}>Max: {q.maxTime}</div>
                                                <div style={{ color: THEME.textDim }}>{q.execTime}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </Panel>
                        </div>

                        {/* Index Stats & Table Analysis */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22 }}>
                            <Panel title="INDEX STATS" icon={Database} accentColor={THEME.primary}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                    {demoData.indexes.map((idx, i) => (
                                        <div
                                            key={i}
                                            style={{
                                                fontSize: 10,
                                                borderBottom:
                                                    i < demoData.indexes.length - 1
                                                        ? `1px solid ${THEME.gridDark}`
                                                        : 'none',
                                                paddingBottom: 8,
                                            }}
                                        >
                                            <div
                                                style={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    marginBottom: 4,
                                                }}
                                            >
                                                <span style={{ color: THEME.textMuted, fontWeight: 600 }}>
                                                    {idx.table}.{idx.name}
                                                </span>
                                                <span style={{ color: THEME.success, fontWeight: 600 }}>
                                                    {idx.efficiency}
                                                </span>
                                            </div>
                                            <div style={{ color: THEME.textDim, fontSize: 9 }}>
                                                Cardinality: {idx.cardinality} | Size: {idx.size}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </Panel>

                            <Panel title="REPLICATION METRICS" icon={GitBranch} accentColor={THEME.primary}>
                                <ResponsiveContainer width="100%" height={220}>
                                    <LineChart data={demoData.replication}>
                                        <CartesianGrid strokeDasharray="3 3" stroke={`${THEME.grid}40`} />
                                        <XAxis dataKey="time" stroke={THEME.textDim} style={{ fontSize: 10 }} />
                                        <YAxis stroke={THEME.textDim} style={{ fontSize: 10 }} />
                                        <Tooltip
                                            contentStyle={{
                                                background: THEME.surface,
                                                border: `1px solid ${THEME.glassBorder}`,
                                                borderRadius: 20,
                                            }}
                                        />
                                        <Legend />
                                        <Line
                                            type="monotone"
                                            dataKey="lag"
                                            stroke={THEME.warning}
                                            strokeWidth={2}
                                            dot={false}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="relayLog"
                                            stroke={THEME.primary}
                                            strokeWidth={2}
                                            dot={false}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </Panel>
                        </div>

                        {/* Database Stats */}
                        <Panel title="DATABASE STATISTICS" icon={Database} accentColor={THEME.success}>
                            <div
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                                    gap: 18,
                                }}
                            >
                                {demoData.databases.map((db, i) => (
                                    <div
                                        key={i}
                                        style={{ padding: '12px', borderRadius: 20, background: `${THEME.primary}08` }}
                                    >
                                        <div
                                            style={{
                                                fontSize: 12,
                                                fontWeight: 700,
                                                color: THEME.textMain,
                                                marginBottom: 8,
                                            }}
                                        >
                                            {db.name}
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 10 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <span style={{ color: THEME.textDim }}>Tables:</span>
                                                <span style={{ color: THEME.textMain, fontWeight: 600 }}>
                                                    {db.tables}
                                                </span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <span style={{ color: THEME.textDim }}>Size:</span>
                                                <span style={{ color: THEME.textMain, fontWeight: 600 }}>
                                                    {db.size}
                                                </span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <span style={{ color: THEME.textDim }}>Rows:</span>
                                                <span style={{ color: THEME.textMain, fontWeight: 600 }}>
                                                    {(db.rows / 1000000).toFixed(1)}M
                                                </span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <span style={{ color: THEME.textDim }}>Engine:</span>
                                                <span style={{ color: THEME.ai, fontWeight: 600 }}>{db.engine}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </Panel>
                    </div>
                );
            }

            if (itemKey === 'resources') {
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }} className="dpg-stagger">
                        <h1 style={{ fontSize: 20, fontWeight: 700, color: THEME.textMain, margin: '0 0 12px' }}>
                            Resources
                        </h1>

                        {/* Resource Metrics */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 22 }}>
                            <MetricCard
                                icon={Cpu}
                                label="CPU Usage"
                                value="42%"
                                sub="8 cores / 2.4 GHz"
                                color={THEME.warning}
                                spark={Array.from({ length: 12 }, () => 20 + Math.random() * 30)}
                            />
                            <MetricCard
                                icon={Droplet}
                                label="Memory Usage"
                                value="68%"
                                sub="17.2 GB / 25.6 GB"
                                color={THEME.ai}
                                spark={Array.from({ length: 12 }, () => 55 + Math.random() * 20)}
                            />
                            <MetricCard
                                icon={HardDrive}
                                label="Disk I/O"
                                value="34%"
                                sub="Peak: 520 MB/s"
                                color={THEME.primary}
                                spark={Array.from({ length: 12 }, () => Math.random() * 50)}
                            />
                            <MetricCard
                                icon={Network}
                                label="Network I/O"
                                value="245 Mb/s"
                                sub="In: 120 | Out: 125"
                                color={THEME.success}
                                spark={Array.from({ length: 12 }, () => 150 + Math.random() * 150)}
                            />
                        </div>

                        {/* Detailed Resource Gauges */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 22 }}>
                            <Panel
                                title="CPU"
                                icon={Cpu}
                                accentColor={THEME.warning}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                                noPad={true}
                            >
                                <div
                                    style={{
                                        padding: '16px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                    }}
                                >
                                    <RingGauge
                                        value={42}
                                        color={THEME.warning}
                                        size={110}
                                        strokeWidth={8}
                                        label="Usage"
                                    />
                                    <div
                                        style={{
                                            fontSize: 10,
                                            color: THEME.textDim,
                                            marginTop: 10,
                                            textAlign: 'center',
                                        }}
                                    >
                                        Core avg: 42%
                                    </div>
                                </div>
                            </Panel>

                            <Panel
                                title="MEMORY"
                                icon={Droplet}
                                accentColor={THEME.ai}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                                noPad={true}
                            >
                                <div
                                    style={{
                                        padding: '16px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                    }}
                                >
                                    <RingGauge value={68} color={THEME.ai} size={110} strokeWidth={8} label="Used" />
                                    <div
                                        style={{
                                            fontSize: 10,
                                            color: THEME.textDim,
                                            marginTop: 10,
                                            textAlign: 'center',
                                        }}
                                    >
                                        17.2 GB
                                    </div>
                                </div>
                            </Panel>

                            <Panel
                                title="DISK"
                                icon={HardDrive}
                                accentColor={THEME.primary}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                                noPad={true}
                            >
                                <div
                                    style={{
                                        padding: '16px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                    }}
                                >
                                    <RingGauge
                                        value={64}
                                        color={THEME.primary}
                                        size={110}
                                        strokeWidth={8}
                                        label="Used"
                                    />
                                    <div
                                        style={{
                                            fontSize: 10,
                                            color: THEME.textDim,
                                            marginTop: 10,
                                            textAlign: 'center',
                                        }}
                                    >
                                        312 GB
                                    </div>
                                </div>
                            </Panel>

                            <Panel
                                title="NETWORK"
                                icon={Network}
                                accentColor={THEME.success}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                                noPad={true}
                            >
                                <div
                                    style={{
                                        padding: '16px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                    }}
                                >
                                    <RingGauge
                                        value={32}
                                        color={THEME.success}
                                        size={110}
                                        strokeWidth={8}
                                        label="Util"
                                    />
                                    <div
                                        style={{
                                            fontSize: 10,
                                            color: THEME.textDim,
                                            marginTop: 10,
                                            textAlign: 'center',
                                        }}
                                    >
                                        245 Mb/s
                                    </div>
                                </div>
                            </Panel>
                        </div>

                        {/* CPU & Memory Timeline */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22 }}>
                            <Panel title="CPU TIMELINE (24H)" icon={Cpu} accentColor={THEME.warning}>
                                <ResponsiveContainer width="100%" height={220}>
                                    <AreaChart data={demoData.qps.map((d) => ({ ...d, value: Math.random() * 60 }))}>
                                        <defs>
                                            <linearGradient id="cpuGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor={THEME.warning} stopOpacity={0.3} />
                                                <stop offset="95%" stopColor={THEME.warning} stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke={`${THEME.grid}40`} />
                                        <XAxis dataKey="time" stroke={THEME.textDim} style={{ fontSize: 10 }} />
                                        <YAxis stroke={THEME.textDim} style={{ fontSize: 10 }} />
                                        <Tooltip
                                            contentStyle={{
                                                background: THEME.surface,
                                                border: `1px solid ${THEME.glassBorder}`,
                                                borderRadius: 20,
                                            }}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="value"
                                            stroke={THEME.warning}
                                            fillOpacity={1}
                                            fill="url(#cpuGrad)"
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </Panel>

                            <Panel title="MEMORY TIMELINE (24H)" icon={Droplet} accentColor={THEME.ai}>
                                <ResponsiveContainer width="100%" height={220}>
                                    <AreaChart
                                        data={demoData.qps.map((d) => ({ ...d, value: 55 + Math.random() * 20 }))}
                                    >
                                        <defs>
                                            <linearGradient id="memGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor={THEME.ai} stopOpacity={0.3} />
                                                <stop offset="95%" stopColor={THEME.ai} stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke={`${THEME.grid}40`} />
                                        <XAxis dataKey="time" stroke={THEME.textDim} style={{ fontSize: 10 }} />
                                        <YAxis stroke={THEME.textDim} style={{ fontSize: 10 }} />
                                        <Tooltip
                                            contentStyle={{
                                                background: THEME.surface,
                                                border: `1px solid ${THEME.glassBorder}`,
                                                borderRadius: 20,
                                            }}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="value"
                                            stroke={THEME.ai}
                                            fillOpacity={1}
                                            fill="url(#memGrad)"
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </Panel>
                        </div>

                        {/* Disk & Network Stats */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22 }}>
                            <Panel title="DISK I/O TIMELINE (24H)" icon={HardDrive} accentColor={THEME.primary}>
                                <ResponsiveContainer width="100%" height={220}>
                                    <LineChart
                                        data={demoData.qps.map((d) => ({
                                            ...d,
                                            read: Math.random() * 300,
                                            write: Math.random() * 250,
                                        }))}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" stroke={`${THEME.grid}40`} />
                                        <XAxis dataKey="time" stroke={THEME.textDim} style={{ fontSize: 10 }} />
                                        <YAxis stroke={THEME.textDim} style={{ fontSize: 10 }} />
                                        <Tooltip
                                            contentStyle={{
                                                background: THEME.surface,
                                                border: `1px solid ${THEME.glassBorder}`,
                                                borderRadius: 20,
                                            }}
                                        />
                                        <Legend />
                                        <Line
                                            type="monotone"
                                            dataKey="read"
                                            stroke={THEME.primary}
                                            dot={false}
                                            strokeWidth={2}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="write"
                                            stroke={THEME.ai}
                                            dot={false}
                                            strokeWidth={2}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </Panel>

                            <Panel title="NETWORK I/O TIMELINE (24H)" icon={Network} accentColor={THEME.success}>
                                <ResponsiveContainer width="100%" height={220}>
                                    <LineChart
                                        data={demoData.qps.map((d) => ({
                                            ...d,
                                            inbound: 100 + Math.random() * 150,
                                            outbound: 100 + Math.random() * 150,
                                        }))}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" stroke={`${THEME.grid}40`} />
                                        <XAxis dataKey="time" stroke={THEME.textDim} style={{ fontSize: 10 }} />
                                        <YAxis stroke={THEME.textDim} style={{ fontSize: 10 }} />
                                        <Tooltip
                                            contentStyle={{
                                                background: THEME.surface,
                                                border: `1px solid ${THEME.glassBorder}`,
                                                borderRadius: 20,
                                            }}
                                        />
                                        <Legend />
                                        <Line
                                            type="monotone"
                                            dataKey="inbound"
                                            stroke={THEME.success}
                                            dot={false}
                                            strokeWidth={2}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="outbound"
                                            stroke={THEME.primary}
                                            dot={false}
                                            strokeWidth={2}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </Panel>
                        </div>

                        {/* Process & Thread Stats */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 22 }}>
                            <Panel title="PROCESS STATS" icon={Activity} accentColor={THEME.primary}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 20, fontSize: 11 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: THEME.textDim }}>Running Threads</span>
                                        <span style={{ color: THEME.primary, fontWeight: 600 }}>24</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: THEME.textDim }}>Cache Hits</span>
                                        <span style={{ color: THEME.success, fontWeight: 600 }}>96.2%</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: THEME.textDim }}>Open Files</span>
                                        <span style={{ color: THEME.primary, fontWeight: 600 }}>248</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: THEME.textDim }}>Context Switches</span>
                                        <span style={{ color: THEME.warning, fontWeight: 600 }}>8.4K/s</span>
                                    </div>
                                </div>
                            </Panel>

                            <Panel title="MEMORY BREAKDOWN" icon={Droplet} accentColor={THEME.ai}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                    {[
                                        { label: 'Buffer Pool', value: '8.2 GB', pct: 48 },
                                        { label: 'Query Cache', value: '1.6 GB', pct: 9 },
                                        { label: 'Tmp Tables', value: '2.4 GB', pct: 14 },
                                        { label: 'Other', value: '5.0 GB', pct: 29 },
                                    ].map((m, i) => (
                                        <div key={i}>
                                            <div
                                                style={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    marginBottom: 4,
                                                    fontSize: 10,
                                                }}
                                            >
                                                <span style={{ color: THEME.textDim }}>{m.label}</span>
                                                <span style={{ color: THEME.textMain, fontWeight: 600 }}>
                                                    {m.value}
                                                </span>
                                            </div>
                                            <div
                                                style={{
                                                    background: THEME.gridDark,
                                                    borderRadius: 3,
                                                    height: 4,
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        background: [
                                                            THEME.ai,
                                                            THEME.primary,
                                                            THEME.warning,
                                                            THEME.success,
                                                        ][i],
                                                        height: '100%',
                                                        width: `${m.pct}%`,
                                                        borderRadius: 3,
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </Panel>

                            <Panel title="STORAGE BREAKDOWN" icon={HardDrive} accentColor={THEME.primary}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                    {[
                                        { label: 'Data Files', value: '224 GB', pct: 72 },
                                        { label: 'Indexes', value: '56 GB', pct: 18 },
                                        { label: 'Logs', value: '28 GB', pct: 9 },
                                        { label: 'Temp', value: '4 GB', pct: 1 },
                                    ].map((s, i) => (
                                        <div key={i}>
                                            <div
                                                style={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    marginBottom: 4,
                                                    fontSize: 10,
                                                }}
                                            >
                                                <span style={{ color: THEME.textDim }}>{s.label}</span>
                                                <span style={{ color: THEME.textMain, fontWeight: 600 }}>
                                                    {s.value}
                                                </span>
                                            </div>
                                            <div
                                                style={{
                                                    background: THEME.gridDark,
                                                    borderRadius: 3,
                                                    height: 4,
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        background: [
                                                            THEME.primary,
                                                            THEME.ai,
                                                            THEME.warning,
                                                            THEME.success,
                                                        ][i],
                                                        height: '100%',
                                                        width: `${s.pct}%`,
                                                        borderRadius: 3,
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </Panel>
                        </div>
                    </div>
                );
            }

            if (itemKey === 'reliability') {
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }} className="dpg-stagger">
                        <h1 style={{ fontSize: 20, fontWeight: 700, color: THEME.textMain, margin: '0 0 12px' }}>
                            Reliability
                        </h1>

                        {/* Reliability KPIs */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 22 }}>
                            <MetricCard
                                icon={CheckCircle}
                                label="Uptime"
                                value="99.98%"
                                sub="28 days"
                                color={THEME.success}
                                trend={0.02}
                                trendUp={true}
                            />
                            <MetricCard
                                icon={AlertTriangle}
                                label="Errors/min"
                                value="0.3"
                                sub="Avg: 0.2"
                                color={THEME.warning}
                                spark={Array.from({ length: 12 }, () => Math.random() * 1)}
                            />
                            <MetricCard
                                icon={RefreshCw}
                                label="Backups"
                                value="48"
                                sub="Last: 2h ago"
                                color={THEME.primary}
                                spark={Array.from({ length: 12 }, () => Math.random() * 50)}
                            />
                            <MetricCard
                                icon={Shield}
                                label="MTTR"
                                value="4.2m"
                                sub="Avg recovery"
                                color={THEME.success}
                                spark={[5, 4, 3, 4, 5, 4, 3, 4, 5, 4, 3, 4]}
                            />
                        </div>

                        {/* Reliability Panels */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 22 }}>
                            <Panel title="UPTIME HISTORY" icon={CheckCircle} accentColor={THEME.success}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 20, fontSize: 11 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: THEME.textDim }}>24h Uptime</span>
                                        <span style={{ color: THEME.success, fontWeight: 600 }}>100%</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: THEME.textDim }}>7d Uptime</span>
                                        <span style={{ color: THEME.success, fontWeight: 600 }}>99.99%</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: THEME.textDim }}>30d Uptime</span>
                                        <span style={{ color: THEME.success, fontWeight: 600 }}>99.96%</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: THEME.textDim }}>90d Uptime</span>
                                        <span style={{ color: THEME.success, fontWeight: 600 }}>99.98%</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: THEME.textDim }}>Last Downtime</span>
                                        <span style={{ color: THEME.primary, fontWeight: 600 }}>12d 3h</span>
                                    </div>
                                </div>
                            </Panel>

                            <Panel title="ERROR TRENDS" icon={AlertTriangle} accentColor={THEME.warning}>
                                <ResponsiveContainer width="100%" height={180}>
                                    <LineChart
                                        data={demoData.qps.map((d) => ({
                                            ...d,
                                            errors: Math.max(0, Math.random() * 1 - 0.5),
                                        }))}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" stroke={`${THEME.grid}40`} />
                                        <XAxis dataKey="time" stroke={THEME.textDim} style={{ fontSize: 9 }} />
                                        <YAxis stroke={THEME.textDim} style={{ fontSize: 9 }} />
                                        <Tooltip
                                            contentStyle={{
                                                background: THEME.surface,
                                                border: `1px solid ${THEME.glassBorder}`,
                                                borderRadius: 20,
                                            }}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="errors"
                                            stroke={THEME.warning}
                                            dot={false}
                                            strokeWidth={2}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </Panel>

                            <Panel title="REPLICATION STATUS" icon={GitBranch} accentColor={THEME.primary}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 20, fontSize: 11 }}>
                                    <div
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                        }}
                                    >
                                        <span style={{ color: THEME.textDim }}>Master</span>
                                        <StatusBadge label="Healthy" color={THEME.success} />
                                    </div>
                                    <div
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                        }}
                                    >
                                        <span style={{ color: THEME.textDim }}>Slave-1</span>
                                        <StatusBadge label="Synced" color={THEME.success} />
                                    </div>
                                    <div
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                        }}
                                    >
                                        <span style={{ color: THEME.textDim }}>Slave-2</span>
                                        <StatusBadge label="Synced" color={THEME.success} />
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: THEME.textDim }}>Max Lag</span>
                                        <span style={{ color: THEME.success, fontWeight: 600 }}>0.22s</span>
                                    </div>
                                </div>
                            </Panel>
                        </div>

                        {/* Backup & Recovery */}
                        <Panel title="BACKUP STATUS & RECOVERY" icon={Archive} accentColor={THEME.primary}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 22 }}>
                                <div>
                                    <div
                                        style={{
                                            fontSize: 11,
                                            color: THEME.textMuted,
                                            fontWeight: 600,
                                            marginBottom: 8,
                                        }}
                                    >
                                        FULL BACKUPS
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                                            <span style={{ color: THEME.textDim }}>Daily</span>
                                            <span style={{ color: THEME.success }}>4</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                                            <span style={{ color: THEME.textDim }}>Weekly</span>
                                            <span style={{ color: THEME.success }}>8</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                                            <span style={{ color: THEME.textDim }}>Monthly</span>
                                            <span style={{ color: THEME.success }}>12</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                                            <span style={{ color: THEME.textDim }}>Verified</span>
                                            <StatusBadge label="100%" color={THEME.success} />
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <div
                                        style={{
                                            fontSize: 11,
                                            color: THEME.textMuted,
                                            fontWeight: 600,
                                            marginBottom: 8,
                                        }}
                                    >
                                        INCREMENTAL
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                                            <span style={{ color: THEME.textDim }}>Hourly</span>
                                            <span style={{ color: THEME.primary }}>48</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                                            <span style={{ color: THEME.textDim }}>Size</span>
                                            <span style={{ color: THEME.primary }}>2.4 GB</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                                            <span style={{ color: THEME.textDim }}>Retention</span>
                                            <span style={{ color: THEME.primary }}>30 days</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                                            <span style={{ color: THEME.textDim }}>Last Run</span>
                                            <span style={{ color: THEME.primary }}>8m ago</span>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <div
                                        style={{
                                            fontSize: 11,
                                            color: THEME.textMuted,
                                            fontWeight: 600,
                                            marginBottom: 8,
                                        }}
                                    >
                                        RECOVERY
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                                            <span style={{ color: THEME.textDim }}>RTO</span>
                                            <span style={{ color: THEME.success, fontWeight: 600 }}>5 min</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                                            <span style={{ color: THEME.textDim }}>RPO</span>
                                            <span style={{ color: THEME.success, fontWeight: 600 }}>1 min</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                                            <span style={{ color: THEME.textDim }}>Test Pass</span>
                                            <StatusBadge label="100%" color={THEME.success} />
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                                            <span style={{ color: THEME.textDim }}>Last Test</span>
                                            <span style={{ color: THEME.success }}>3d ago</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </Panel>

                        {/* Incident Log */}
                        <Panel title="INCIDENT LOG" icon={AlertCircle} accentColor={THEME.danger}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                {[
                                    {
                                        time: '12d 3h ago',
                                        incident: 'Brief connection timeout',
                                        duration: '4.2m',
                                        severity: 'warning',
                                    },
                                    {
                                        time: '18d 15h ago',
                                        incident: 'Slow query spike detected',
                                        duration: '12.5m',
                                        severity: 'warning',
                                    },
                                    {
                                        time: '26d 8h ago',
                                        incident: 'Replication lag spike',
                                        duration: '2.1m',
                                        severity: 'warning',
                                    },
                                    {
                                        time: '35d 2h ago',
                                        incident: 'Disk space warning',
                                        duration: 'resolved',
                                        severity: 'info',
                                    },
                                ].map((inc, i) => (
                                    <div
                                        key={i}
                                        style={{
                                            fontSize: 10,
                                            paddingBottom: 8,
                                            borderBottom: i < 3 ? `1px solid ${THEME.gridDark}` : 'none',
                                        }}
                                    >
                                        <div
                                            style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                marginBottom: 4,
                                            }}
                                        >
                                            <span style={{ color: THEME.textDim }}>{inc.time}</span>
                                            <span
                                                style={{
                                                    color: inc.severity === 'warning' ? THEME.warning : THEME.primary,
                                                    fontWeight: 600,
                                                }}
                                            >
                                                {inc.duration}
                                            </span>
                                        </div>
                                        <div style={{ color: THEME.textMuted }}>{inc.incident}</div>
                                    </div>
                                ))}
                            </div>
                        </Panel>

                        {/* SLA Compliance */}
                        <Panel title="SLA COMPLIANCE" icon={Shield} accentColor={THEME.success}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 22 }}>
                                {[
                                    { sla: '99.9% Uptime', actual: '99.98%', status: 'success', pct: 100 },
                                    { sla: '5m MTTR', actual: '4.2m', status: 'success', pct: 116 },
                                    { sla: '1 Incident/mo', actual: '2 incidents', status: 'warning', pct: 50 },
                                ].map((s, i) => (
                                    <div
                                        key={i}
                                        style={{
                                            padding: '10px',
                                            borderRadius: 20,
                                            background:
                                                s.status === 'success' ? `${THEME.success}08` : `${THEME.warning}08`,
                                        }}
                                    >
                                        <div style={{ fontSize: 10, color: THEME.textDim, marginBottom: 6 }}>
                                            {s.sla}
                                        </div>
                                        <div
                                            style={{
                                                fontSize: 13,
                                                fontWeight: 700,
                                                color: THEME.textMain,
                                                marginBottom: 6,
                                            }}
                                        >
                                            {s.actual}
                                        </div>
                                        <div
                                            style={{
                                                background: THEME.gridDark,
                                                borderRadius: 3,
                                                height: 4,
                                                overflow: 'hidden',
                                            }}
                                        >
                                            <div
                                                style={{
                                                    background: s.status === 'success' ? THEME.success : THEME.warning,
                                                    height: '100%',
                                                    width: `${Math.min(s.pct, 100)}%`,
                                                }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </Panel>
                    </div>
                );
            }
        }

        /* ═══════════════════════════════════════════════════════════════════════════
           ALERTS & RULES SECTION
           ═══════════════════════════════════════════════════════════════════════════ */
        if (sectionKey === 'alerts') {
            if (itemKey === 'activeAlerts') {
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                        <h1 style={{ fontSize: 20, fontWeight: 700, color: THEME.textMain, margin: '0 0 12px' }}>
                            Active Alerts
                        </h1>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 22 }}>
                            <MetricCard
                                icon={AlertCircle}
                                label="Critical"
                                value={demoData.alerts.critical}
                                color={THEME.danger}
                            />
                            <MetricCard
                                icon={AlertTriangle}
                                label="Warnings"
                                value={demoData.alerts.warning}
                                color={THEME.warning}
                            />
                            <MetricCard icon={Info} label="Info" value={demoData.alerts.info} color={THEME.primary} />
                            <MetricCard
                                icon={CheckCircle}
                                label="Resolved"
                                value={demoData.alerts.resolved}
                                color={THEME.success}
                            />
                        </div>
                        <Panel title="ALERTS" icon={Bell} accentColor={THEME.danger}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                {demoData.alertList.map((alert, i) => (
                                    <AlertRow key={i} {...alert} />
                                ))}
                            </div>
                        </Panel>
                    </div>
                );
            }

            if (itemKey === 'alertRules') {
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                        <h1 style={{ fontSize: 20, fontWeight: 700, color: THEME.textMain, margin: '0 0 12px' }}>
                            Alert Rules
                        </h1>
                        <Panel title="CONFIGURED RULES" icon={Shield} accentColor={THEME.primary}>
                            <div style={{ fontSize: 12, color: THEME.textDim }}>
                                18 active rules configured. Trigger thresholds are customizable.
                            </div>
                        </Panel>
                    </div>
                );
            }

            if (itemKey === 'correlation') {
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                        <h1 style={{ fontSize: 20, fontWeight: 700, color: THEME.textMain, margin: '0 0 12px' }}>
                            Alert Correlation
                        </h1>
                        <Panel title="CORRELATIONS" icon={Network} accentColor={THEME.primary}>
                            <div style={{ fontSize: 12, color: THEME.textDim }}>
                                Analyzing root causes across multiple alert sources.
                            </div>
                        </Panel>
                    </div>
                );
            }
        }

        /* ═══════════════════════════════════════════════════════════════════════════
           QUERY ANALYSIS SECTION
           ═══════════════════════════════════════════════════════════════════════════ */
        if (sectionKey === 'query') {
            if (itemKey === 'queryOptimizer') {
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }} className="dpg-stagger">
                        <h1 style={{ fontSize: 20, fontWeight: 700, color: THEME.textMain, margin: '0 0 12px' }}>
                            Query Optimizer
                        </h1>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 22 }}>
                            <MetricCard
                                icon={Zap}
                                label="Total Queries"
                                value="14.2K"
                                sub="24h period"
                                color={THEME.primary}
                                spark={Array.from({ length: 12 }, () => Math.random() * 100)}
                            />
                            <MetricCard
                                icon={CheckCircle}
                                label="Optimizable"
                                value="2.8K"
                                sub="19.7%"
                                color={THEME.success}
                                trend="+3.2%"
                                trendUp={true}
                            />
                            <MetricCard
                                icon={Clock}
                                label="Avg Time Saved"
                                value="2.4ms"
                                sub="Per query"
                                color={THEME.ai}
                                spark={[2.1, 2.3, 2.4, 2.2, 2.5, 2.3, 2.4, 2.2, 2.1, 2.3, 2.4, 2.2]}
                            />
                            <MetricCard
                                icon={Gauge}
                                label="Cache Hit Rate"
                                value="87.3%"
                                sub="Memory pool"
                                color={THEME.warning}
                                spark={Array.from({ length: 12 }, () => 80 + Math.random() * 15)}
                            />
                        </div>
                        <Panel title="TOP SLOW QUERIES" icon={AlertTriangle} accentColor={THEME.warning}>
                            <DataTable
                                headers={['Query', 'Calls', 'Avg Time', 'Max Time', 'Exec Time']}
                                rows={demoData.topQueries.map((q) => [
                                    q.query.substring(0, 40) + '...',
                                    q.calls.toLocaleString(),
                                    q.avgTime,
                                    q.maxTime,
                                    q.execTime,
                                ])}
                            />
                        </Panel>
                        <Panel title="QUERY TIME DISTRIBUTION (24H)" icon={BarChart3} accentColor={THEME.primary}>
                            <ResponsiveContainer width="100%" height={180}>
                                <BarChart
                                    data={[
                                        { range: '0-1ms', count: 4200 },
                                        { range: '1-5ms', count: 3800 },
                                        { range: '5-10ms', count: 2100 },
                                        { range: '10-50ms', count: 1240 },
                                        { range: '>50ms', count: 340 },
                                    ]}
                                >
                                    <CartesianGrid strokeDasharray="3 3" stroke={`${THEME.grid}40`} />
                                    <XAxis dataKey="range" stroke={THEME.textDim} style={{ fontSize: 10 }} />
                                    <YAxis stroke={THEME.textDim} style={{ fontSize: 10 }} />
                                    <Tooltip
                                        contentStyle={{
                                            background: THEME.surface,
                                            border: `1px solid ${THEME.glassBorder}`,
                                            borderRadius: 20,
                                        }}
                                    />
                                    <Bar dataKey="count" fill={THEME.ai} radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </Panel>
                    </div>
                );
            }

            if (itemKey === 'queryPlan') {
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }} className="dpg-stagger">
                        <h1 style={{ fontSize: 20, fontWeight: 700, color: THEME.textMain, margin: '0 0 12px' }}>
                            Query Plan Viewer
                        </h1>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 22 }}>
                            <MetricCard
                                icon={FileText}
                                label="Plans Analyzed"
                                value="342"
                                sub="Last 7 days"
                                color={THEME.primary}
                            />
                            <MetricCard
                                icon={AlertTriangle}
                                label="Full Scans"
                                value="28"
                                sub="8.2%"
                                color={THEME.warning}
                            />
                            <MetricCard icon={Database} label="Temp Tables" value="12" sub="3.5%" color={THEME.ai} />
                            <MetricCard icon={Zap} label="Filesort Ops" value="6" sub="1.8%" color={THEME.danger} />
                        </div>
                        <Panel title="EXPLAIN OUTPUT" icon={Code} accentColor={THEME.primary}>
                            <div
                                style={{
                                    background: THEME.gridDark,
                                    padding: 12,
                                    borderRadius: 18,
                                    fontFamily: THEME.fontMono,
                                    fontSize: 11,
                                    color: THEME.textMuted,
                                    overflow: 'auto',
                                    maxHeight: 200,
                                }}
                            >
                                id | select_type | table | type | key | rows | filtered | Extra{'\n'}1 | SIMPLE | orders
                                | ref | idx_user_id | 2840 | 100 | -
                            </div>
                        </Panel>
                        <Panel title="EXECUTION COST BREAKDOWN" icon={Gauge} accentColor={THEME.ai}>
                            <ResponsiveContainer width="100%" height={180}>
                                <PieChart>
                                    <Pie
                                        data={[
                                            { name: 'Table Scan', value: 35 },
                                            { name: 'Index Lookup', value: 45 },
                                            { name: 'Sort', value: 15 },
                                            { name: 'Filter', value: 5 },
                                        ]}
                                        cx="50%"
                                        cy="50%"
                                        labelLine={false}
                                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                        outerRadius={60}
                                    >
                                        <Cell fill={THEME.primary} />
                                        <Cell fill={THEME.success} />
                                        <Cell fill={THEME.warning} />
                                        <Cell fill={THEME.ai} />
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                        </Panel>
                    </div>
                );
            }

            if (itemKey === 'planRegression') {
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }} className="dpg-stagger">
                        <h1 style={{ fontSize: 20, fontWeight: 700, color: THEME.textMain, margin: '0 0 12px' }}>
                            Plan Regression
                        </h1>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 22 }}>
                            <MetricCard
                                icon={AlertTriangle}
                                label="Regressions"
                                value="4"
                                sub="Last 30 days"
                                color={THEME.danger}
                            />
                            <MetricCard
                                icon={TrendingUp}
                                label="Avg Impact"
                                value="-28.4%"
                                sub="Performance"
                                color={THEME.warning}
                            />
                            <MetricCard
                                icon={Lock}
                                label="Plans Pinned"
                                value="2"
                                sub="Manual tuning"
                                color={THEME.success}
                            />
                            <MetricCard
                                icon={CheckCircle}
                                label="Recovery Rate"
                                value="92.3%"
                                sub="Auto-fixed"
                                color={THEME.ai}
                            />
                        </div>
                        <Panel title="REGRESSION TIMELINE (30D)" icon={TrendingUp} accentColor={THEME.warning}>
                            <ResponsiveContainer width="100%" height={200}>
                                <LineChart
                                    data={Array.from({ length: 30 }, (_, i) => ({
                                        day: i + 1,
                                        regressions: Math.floor(Math.random() * 3),
                                    }))}
                                >
                                    <defs>
                                        <linearGradient id="reggrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={THEME.danger} stopOpacity={0.3} />
                                            <stop offset="95%" stopColor={THEME.danger} stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke={`${THEME.grid}40`} />
                                    <XAxis dataKey="day" stroke={THEME.textDim} style={{ fontSize: 10 }} />
                                    <YAxis stroke={THEME.textDim} style={{ fontSize: 10 }} />
                                    <Tooltip
                                        contentStyle={{
                                            background: THEME.surface,
                                            border: `1px solid ${THEME.glassBorder}`,
                                            borderRadius: 20,
                                        }}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="regressions"
                                        stroke={THEME.danger}
                                        strokeWidth={2}
                                        dot={false}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </Panel>
                        <Panel title="AFFECTED QUERIES" icon={Database} accentColor={THEME.primary}>
                            <DataTable
                                headers={['Query', 'Before (ms)', 'After (ms)', 'Impact']}
                                rows={[
                                    ['SELECT * FROM orders...', '1.2', '3.8', '-216%'],
                                    ['UPDATE inventory SET...', '0.8', '2.1', '-162%'],
                                    ['SELECT id FROM users...', '0.5', '1.2', '-140%'],
                                ]}
                            />
                        </Panel>
                    </div>
                );
            }

            if (itemKey === 'indexes') {
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }} className="dpg-stagger">
                        <h1 style={{ fontSize: 20, fontWeight: 700, color: THEME.textMain, margin: '0 0 12px' }}>
                            Indexes
                        </h1>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 22 }}>
                            <MetricCard
                                icon={Database}
                                label="Total Indexes"
                                value="342"
                                sub="All tables"
                                color={THEME.primary}
                            />
                            <MetricCard
                                icon={AlertTriangle}
                                label="Unused"
                                value="18"
                                sub="5.3%"
                                color={THEME.warning}
                            />
                            <MetricCard icon={Copy} label="Duplicate" value="7" sub="2.0%" color={THEME.danger} />
                            <MetricCard icon={HardDrive} label="Fragmented" value="24" sub="7.0%" color={THEME.ai} />
                        </div>
                        <Panel title="INDEX USAGE ANALYSIS" icon={Database} accentColor={THEME.primary}>
                            <DataTable
                                headers={['Table', 'Index', 'Size', 'Cardinality', 'Efficiency']}
                                rows={demoData.indexes.map((idx) => [
                                    idx.table,
                                    idx.name,
                                    idx.size,
                                    idx.cardinality.toLocaleString(),
                                    idx.efficiency,
                                ])}
                            />
                        </Panel>
                        <Panel title="INDEX SIZE DISTRIBUTION" icon={BarChart3} accentColor={THEME.ai}>
                            <ResponsiveContainer width="100%" height={180}>
                                <BarChart
                                    data={demoData.databases.map((db) => ({
                                        name: db.name,
                                        indexSize: Math.random() * 50 + 10,
                                    }))}
                                >
                                    <CartesianGrid strokeDasharray="3 3" stroke={`${THEME.grid}40`} />
                                    <XAxis dataKey="name" stroke={THEME.textDim} style={{ fontSize: 10 }} />
                                    <YAxis stroke={THEME.textDim} style={{ fontSize: 10 }} />
                                    <Tooltip
                                        contentStyle={{
                                            background: THEME.surface,
                                            border: `1px solid ${THEME.glassBorder}`,
                                            borderRadius: 20,
                                        }}
                                    />
                                    <Bar dataKey="indexSize" fill={THEME.success} radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </Panel>
                    </div>
                );
            }

            if (itemKey === 'bloatAnalysis') {
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }} className="dpg-stagger">
                        <h1 style={{ fontSize: 20, fontWeight: 700, color: THEME.textMain, margin: '0 0 12px' }}>
                            Table Bloat
                        </h1>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 22 }}>
                            <MetricCard
                                icon={Database}
                                label="Tables Scanned"
                                value="164"
                                sub="Last 7 days"
                                color={THEME.primary}
                            />
                            <MetricCard
                                icon={AlertTriangle}
                                label="Fragmented"
                                value="42"
                                sub="25.6%"
                                color={THEME.warning}
                            />
                            <MetricCard
                                icon={HardDrive}
                                label="Reclaimable"
                                value="12.4GB"
                                sub="12% of total"
                                color={THEME.ai}
                            />
                            <MetricCard icon={Clock} label="Last Optimize" value="3d" sub="ago" color={THEME.success} />
                        </div>
                        <Panel title="BLOAT BY TABLE (TOP 10)" icon={BarChart3} accentColor={THEME.warning}>
                            <ResponsiveContainer width="100%" height={200}>
                                <BarChart
                                    data={[
                                        { table: 'orders', bloat: 3.2 },
                                        { table: 'users', bloat: 2.1 },
                                        { table: 'logs', bloat: 4.8 },
                                        { table: 'products', bloat: 1.5 },
                                        { table: 'inventory', bloat: 2.9 },
                                    ]}
                                >
                                    <CartesianGrid strokeDasharray="3 3" stroke={`${THEME.grid}40`} />
                                    <XAxis dataKey="table" stroke={THEME.textDim} style={{ fontSize: 10 }} />
                                    <YAxis stroke={THEME.textDim} style={{ fontSize: 10 }} />
                                    <Tooltip
                                        contentStyle={{
                                            background: THEME.surface,
                                            border: `1px solid ${THEME.glassBorder}`,
                                            borderRadius: 20,
                                        }}
                                    />
                                    <Bar dataKey="bloat" fill={THEME.warning} radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </Panel>
                        <Panel title="RECOMMENDATIONS" icon={Zap} accentColor={THEME.ai}>
                            <DataTable
                                headers={['Table', 'Action', 'Est. Space', 'Downtime']}
                                rows={[
                                    ['orders', 'OPTIMIZE TABLE', '3.2GB', '2m 30s'],
                                    ['logs', 'OPTIMIZE TABLE', '4.8GB', '5m 15s'],
                                    ['inventory', 'ANALYZE TABLE', '2.9GB', '30s'],
                                ]}
                            />
                        </Panel>
                    </div>
                );
            }

            if (itemKey === 'tableAnalysis') {
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }} className="dpg-stagger">
                        <h1 style={{ fontSize: 20, fontWeight: 700, color: THEME.textMain, margin: '0 0 12px' }}>
                            Table Analysis
                        </h1>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 22 }}>
                            <MetricCard
                                icon={Database}
                                label="Tables"
                                value="267"
                                sub="All schemas"
                                color={THEME.primary}
                            />
                            <MetricCard icon={Zap} label="Total Rows" value="9.2M" sub="Combined" color={THEME.ai} />
                            <MetricCard
                                icon={BarChart3}
                                label="Avg Row Size"
                                value="142B"
                                sub="Mean"
                                color={THEME.success}
                            />
                            <MetricCard
                                icon={HardDrive}
                                label="Data Length"
                                value="107.4GB"
                                sub="Storage used"
                                color={THEME.warning}
                            />
                        </div>
                        <Panel title="TOP TABLES BY SIZE" icon={Database} accentColor={THEME.primary}>
                            <DataTable
                                headers={['Table', 'Rows', 'Data Size', 'Index Size', 'Total']}
                                rows={demoData.databases.map((db) => [
                                    db.name,
                                    db.rows.toLocaleString(),
                                    db.size,
                                    '2.1GB',
                                    '54.5GB',
                                ])}
                            />
                        </Panel>
                        <Panel title="ROW COUNT DISTRIBUTION" icon={BarChart3} accentColor={THEME.ai}>
                            <ResponsiveContainer width="100%" height={180}>
                                <PieChart>
                                    <Pie
                                        data={[
                                            { name: 'production', value: 4230000 },
                                            { name: 'analytics', value: 2150000 },
                                            { name: 'cache_db', value: 580000 },
                                            { name: 'logs', value: 890000 },
                                        ]}
                                        cx="50%"
                                        cy="50%"
                                        labelLine={false}
                                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                        outerRadius={60}
                                    >
                                        <Cell fill={THEME.primary} />
                                        <Cell fill={THEME.success} />
                                        <Cell fill={THEME.warning} />
                                        <Cell fill={THEME.ai} />
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                        </Panel>
                    </div>
                );
            }
        }

        /* ═══════════════════════════════════════════════════════════════════════════
           SCHEMA & DATA SECTION
           ═══════════════════════════════════════════════════════════════════════════ */
        if (sectionKey === 'schema') {
            if (itemKey === 'tableDeps') {
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }} className="dpg-stagger">
                        <h1 style={{ fontSize: 20, fontWeight: 700, color: THEME.textMain, margin: '0 0 12px' }}>
                            Table Dependencies
                        </h1>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 22 }}>
                            <MetricCard
                                icon={Anchor}
                                label="Foreign Keys"
                                value="142"
                                sub="Total"
                                color={THEME.primary}
                            />
                            <MetricCard
                                icon={AlertTriangle}
                                label="Circular Deps"
                                value="0"
                                sub="Detected"
                                color={THEME.success}
                            />
                            <MetricCard
                                icon={Database}
                                label="Orphaned Tables"
                                value="0"
                                sub="Found"
                                color={THEME.ai}
                            />
                            <MetricCard
                                icon={RefreshCw}
                                label="Cascade Deletes"
                                value="28"
                                sub="Defined"
                                color={THEME.warning}
                            />
                        </div>
                        <Panel title="FOREIGN KEY CONSTRAINTS" icon={Anchor} accentColor={THEME.primary}>
                            <DataTable
                                headers={['Table', 'Column', 'References', 'On Delete', 'On Update']}
                                rows={[
                                    ['orders', 'user_id', 'users.id', 'CASCADE', 'CASCADE'],
                                    ['order_items', 'order_id', 'orders.id', 'CASCADE', 'CASCADE'],
                                    ['products', 'category_id', 'categories.id', 'RESTRICT', 'RESTRICT'],
                                ]}
                            />
                        </Panel>
                        <Panel title="DEPENDENCY MAP" icon={Network} accentColor={THEME.ai}>
                            <div style={{ padding: '12px 0', fontSize: 11, color: THEME.textMuted }}>
                                users → orders → order_items → products{'\n'}
                                └─ inventory → stock_locations{'\n'}└ categories → product_categories
                            </div>
                        </Panel>
                    </div>
                );
            }

            if (itemKey === 'chartBuilder') {
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }} className="dpg-stagger">
                        <h1 style={{ fontSize: 20, fontWeight: 700, color: THEME.textMain, margin: '0 0 12px' }}>
                            Chart Builder
                        </h1>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 22 }}>
                            <MetricCard
                                icon={BarChart3}
                                label="Charts Created"
                                value="42"
                                sub="Total"
                                color={THEME.primary}
                            />
                            <MetricCard
                                icon={Eye}
                                label="Dashboards"
                                value="8"
                                sub="Using charts"
                                color={THEME.success}
                            />
                            <MetricCard
                                icon={RefreshCw}
                                label="Refresh Rate"
                                value="5min"
                                sub="Default"
                                color={THEME.ai}
                            />
                            <MetricCard icon={Clock} label="Last Used" value="8m" sub="ago" color={THEME.warning} />
                        </div>
                        <Panel title="CHART CONFIGURATION" icon={Settings} accentColor={THEME.primary}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22, fontSize: 11 }}>
                                <div>
                                    <div style={{ color: THEME.textDim, marginBottom: 4 }}>Chart Type</div>
                                    <div style={{ color: THEME.textMuted }}>Line Chart</div>
                                </div>
                                <div>
                                    <div style={{ color: THEME.textDim, marginBottom: 4 }}>Data Source</div>
                                    <div style={{ color: THEME.textMuted }}>orders</div>
                                </div>
                                <div>
                                    <div style={{ color: THEME.textDim, marginBottom: 4 }}>X-Axis</div>
                                    <div style={{ color: THEME.textMuted }}>created_at</div>
                                </div>
                                <div>
                                    <div style={{ color: THEME.textDim, marginBottom: 4 }}>Y-Axis</div>
                                    <div style={{ color: THEME.textMuted }}>total_amount</div>
                                </div>
                            </div>
                        </Panel>
                        <Panel title="PREVIEW" icon={Eye} accentColor={THEME.ai}>
                            <ResponsiveContainer width="100%" height={180}>
                                <AreaChart data={generateChartData(12)}>
                                    <defs>
                                        <linearGradient id="chartpreview" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={THEME.primary} stopOpacity={0.3} />
                                            <stop offset="95%" stopColor={THEME.primary} stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke={`${THEME.grid}40`} />
                                    <XAxis dataKey="time" stroke={THEME.textDim} style={{ fontSize: 10 }} />
                                    <YAxis stroke={THEME.textDim} style={{ fontSize: 10 }} />
                                    <Tooltip
                                        contentStyle={{
                                            background: THEME.surface,
                                            border: `1px solid ${THEME.glassBorder}`,
                                            borderRadius: 20,
                                        }}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="value"
                                        stroke={THEME.primary}
                                        fillOpacity={1}
                                        fill="url(#chartpreview)"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </Panel>
                    </div>
                );
            }
        }

        /* ═══════════════════════════════════════════════════════════════════════════
           INFRASTRUCTURE SECTION
           ═══════════════════════════════════════════════════════════════════════════ */
        if (sectionKey === 'infra') {
            if (itemKey === 'connPool') {
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }} className="dpg-stagger">
                        <h1 style={{ fontSize: 20, fontWeight: 700, color: THEME.textMain, margin: '0 0 12px' }}>
                            Connection Pool
                        </h1>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 22 }}>
                            <MetricCard
                                icon={Network}
                                label="Max Connections"
                                value="512"
                                sub="Configured"
                                color={THEME.primary}
                            />
                            <MetricCard
                                icon={Activity}
                                label="Active"
                                value="38"
                                sub="7.4% used"
                                color={THEME.warning}
                            />
                            <MetricCard icon={Eye} label="Idle" value="28" sub="Reusable" color={THEME.success} />
                            <MetricCard
                                icon={Clock}
                                label="Avg Wait Time"
                                value="0.8ms"
                                sub="Per request"
                                color={THEME.ai}
                            />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22 }}>
                            <Panel title="POOL USAGE" icon={Gauge} accentColor={THEME.warning} noPad={true}>
                                <div
                                    style={{
                                        padding: '16px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                    }}
                                >
                                    <RingGauge
                                        value={13}
                                        color={THEME.warning}
                                        size={100}
                                        strokeWidth={7}
                                        label="Used"
                                    />
                                    <div style={{ fontSize: 10, color: THEME.textDim, marginTop: 8 }}>66 / 512 max</div>
                                </div>
                            </Panel>
                            <Panel title="THREAD CACHE" icon={Gauge} accentColor={THEME.ai} noPad={true}>
                                <div
                                    style={{
                                        padding: '16px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                    }}
                                >
                                    <RingGauge value={68} color={THEME.ai} size={100} strokeWidth={7} label="Hit %" />
                                    <div style={{ fontSize: 10, color: THEME.textDim, marginTop: 8 }}>
                                        68% efficiency
                                    </div>
                                </div>
                            </Panel>
                        </div>
                        <Panel title="CONNECTION TREND (24H)" icon={TrendingUp} accentColor={THEME.primary}>
                            <ResponsiveContainer width="100%" height={180}>
                                <LineChart
                                    data={demoData.connections.map((d, i) => ({
                                        time: d.time,
                                        total: d.active + d.idle,
                                    }))}
                                >
                                    <CartesianGrid strokeDasharray="3 3" stroke={`${THEME.grid}40`} />
                                    <XAxis dataKey="time" stroke={THEME.textDim} style={{ fontSize: 10 }} />
                                    <YAxis stroke={THEME.textDim} style={{ fontSize: 10 }} />
                                    <Tooltip
                                        contentStyle={{
                                            background: THEME.surface,
                                            border: `1px solid ${THEME.glassBorder}`,
                                            borderRadius: 20,
                                        }}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="total"
                                        stroke={THEME.primary}
                                        strokeWidth={2}
                                        dot={false}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </Panel>
                    </div>
                );
            }

            if (itemKey === 'poolMetrics') {
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }} className="dpg-stagger">
                        <h1 style={{ fontSize: 20, fontWeight: 700, color: THEME.textMain, margin: '0 0 12px' }}>
                            Pool Metrics
                        </h1>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 22 }}>
                            <MetricCard icon={Zap} label="Created" value="14.2K" sub="Total" color={THEME.primary} />
                            <MetricCard
                                icon={AlertTriangle}
                                label="Aborted"
                                value="2"
                                sub="Failed"
                                color={THEME.danger}
                            />
                            <MetricCard
                                icon={TrendingUp}
                                label="Peak"
                                value="124"
                                sub="Max concurrent"
                                color={THEME.warning}
                            />
                            <MetricCard
                                icon={Clock}
                                label="Avg Lifetime"
                                value="2.3m"
                                sub="Per connection"
                                color={THEME.ai}
                            />
                        </div>
                        <Panel title="POOL UTILIZATION (24H)" icon={BarChart3} accentColor={THEME.primary}>
                            <ResponsiveContainer width="100%" height={200}>
                                <AreaChart
                                    data={Array.from({ length: 24 }, (_, i) => ({
                                        hour: `${i}:00`,
                                        utilization: 20 + Math.sin(i / 6) * 30 + Math.random() * 15,
                                    }))}
                                >
                                    <defs>
                                        <linearGradient id="mysql-pool-util" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={THEME.primary} stopOpacity={0.3} />
                                            <stop offset="95%" stopColor={THEME.primary} stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke={`${THEME.grid}40`} />
                                    <XAxis dataKey="hour" stroke={THEME.textDim} style={{ fontSize: 10 }} />
                                    <YAxis stroke={THEME.textDim} style={{ fontSize: 10 }} />
                                    <Tooltip
                                        contentStyle={{
                                            background: THEME.surface,
                                            border: `1px solid ${THEME.glassBorder}`,
                                            borderRadius: 20,
                                        }}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="utilization"
                                        stroke={THEME.primary}
                                        fillOpacity={1}
                                        fill="url(#mysql-pool-util)"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </Panel>
                        <Panel title="WAIT TIME DISTRIBUTION" icon={Clock} accentColor={THEME.ai}>
                            <ResponsiveContainer width="100%" height={180}>
                                <BarChart
                                    data={[
                                        { range: '0-1ms', count: 12400 },
                                        { range: '1-5ms', count: 1800 },
                                        { range: '5-10ms', count: 340 },
                                        { range: '>10ms', count: 60 },
                                    ]}
                                >
                                    <CartesianGrid strokeDasharray="3 3" stroke={`${THEME.grid}40`} />
                                    <XAxis dataKey="range" stroke={THEME.textDim} style={{ fontSize: 10 }} />
                                    <YAxis stroke={THEME.textDim} style={{ fontSize: 10 }} />
                                    <Tooltip
                                        contentStyle={{
                                            background: THEME.surface,
                                            border: `1px solid ${THEME.glassBorder}`,
                                            borderRadius: 20,
                                        }}
                                    />
                                    <Bar dataKey="count" fill={THEME.ai} radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </Panel>
                    </div>
                );
            }

            if (itemKey === 'replication') {
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }} className="dpg-stagger">
                        <h1 style={{ fontSize: 20, fontWeight: 700, color: THEME.textMain, margin: '0 0 12px' }}>
                            Replication & Binlog
                        </h1>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 22 }}>
                            <MetricCard
                                icon={CheckCircle}
                                label="Slave IO"
                                value="Yes"
                                sub="Running"
                                color={THEME.success}
                            />
                            <MetricCard
                                icon={CheckCircle}
                                label="Slave SQL"
                                value="Yes"
                                sub="Running"
                                color={THEME.success}
                            />
                            <MetricCard
                                icon={Clock}
                                label="GTID Lag"
                                value="0.2s"
                                sub="Behind master"
                                color={THEME.ai}
                            />
                            <MetricCard
                                icon={HardDrive}
                                label="Binlog Size"
                                value="1.6GB"
                                sub="Total"
                                color={THEME.warning}
                            />
                        </div>
                        <Panel title="REPLICATION TOPOLOGY" icon={GitBranch} accentColor={THEME.primary}>
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    fontSize: 12,
                                }}
                            >
                                <div style={{ textAlign: 'center', flex: 1 }}>
                                    <div
                                        style={{
                                            background: THEME.primaryDark,
                                            color: THEME.textInverse,
                                            padding: '20px 24px',
                                            borderRadius: 18,
                                            fontWeight: 700,
                                            marginBottom: 8,
                                        }}
                                    >
                                        MASTER
                                    </div>
                                    <div style={{ fontSize: 10, color: THEME.textDim }}>prod-db-01</div>
                                </div>
                                <div style={{ fontSize: 16, color: THEME.textDim, margin: '0 16px' }}>{'>'}</div>
                                <div style={{ textAlign: 'center', flex: 1 }}>
                                    <div
                                        style={{
                                            background: THEME.success,
                                            color: THEME.textInverse,
                                            padding: '20px 24px',
                                            borderRadius: 18,
                                            fontWeight: 700,
                                            marginBottom: 8,
                                        }}
                                    >
                                        SLAVE-1
                                    </div>
                                    <div style={{ fontSize: 10, color: THEME.textDim }}>Lag: 0.18s</div>
                                </div>
                                <div style={{ fontSize: 16, color: THEME.textDim, margin: '0 16px' }}>{'>'}</div>
                                <div style={{ textAlign: 'center', flex: 1 }}>
                                    <div
                                        style={{
                                            background: THEME.success,
                                            color: THEME.textInverse,
                                            padding: '20px 24px',
                                            borderRadius: 18,
                                            fontWeight: 700,
                                            marginBottom: 8,
                                        }}
                                    >
                                        SLAVE-2
                                    </div>
                                    <div style={{ fontSize: 10, color: THEME.textDim }}>Lag: 0.22s</div>
                                </div>
                            </div>
                        </Panel>
                        <Panel title="REPLICATION LAG TIMELINE (24H)" icon={TrendingUp} accentColor={THEME.ai}>
                            <ResponsiveContainer width="100%" height={180}>
                                <LineChart data={demoData.replication.slice(-12)}>
                                    <CartesianGrid strokeDasharray="3 3" stroke={`${THEME.grid}40`} />
                                    <XAxis dataKey="time" stroke={THEME.textDim} style={{ fontSize: 10 }} />
                                    <YAxis stroke={THEME.textDim} style={{ fontSize: 10 }} />
                                    <Tooltip
                                        contentStyle={{
                                            background: THEME.surface,
                                            border: `1px solid ${THEME.glassBorder}`,
                                            borderRadius: 20,
                                        }}
                                    />
                                    <Line type="monotone" dataKey="lag" stroke={THEME.ai} strokeWidth={2} dot={false} />
                                </LineChart>
                            </ResponsiveContainer>
                        </Panel>
                        <Panel title="BINARY LOG" icon={Radio} accentColor={THEME.primary}>
                            <DataTable
                                headers={['File', 'Position', 'Size', 'Age']}
                                rows={demoData.binlog.map((b) => [b.file, b.position.toLocaleString(), b.size, b.age])}
                            />
                        </Panel>
                    </div>
                );
            }

            if (itemKey === 'checkpoints') {
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }} className="dpg-stagger">
                        <h1 style={{ fontSize: 20, fontWeight: 700, color: THEME.textMain, margin: '0 0 12px' }}>
                            Checkpoint Monitor
                        </h1>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 22 }}>
                            <MetricCard
                                icon={Zap}
                                label="Flush Rate"
                                value="2.4K/s"
                                sub="Pages/second"
                                color={THEME.primary}
                            />
                            <MetricCard
                                icon={HardDrive}
                                label="Dirty Pages"
                                value="12.4K"
                                sub="Pending flush"
                                color={THEME.warning}
                            />
                            <MetricCard icon={Radio} label="Log Sequence" value="8.9M" sub="Current" color={THEME.ai} />
                            <MetricCard
                                icon={Clock}
                                label="Checkpoint Age"
                                value="45s"
                                sub="Since last"
                                color={THEME.success}
                            />
                        </div>
                        <Panel title="INNODB FLUSH ACTIVITY (24H)" icon={Zap} accentColor={THEME.primary}>
                            <ResponsiveContainer width="100%" height={200}>
                                <AreaChart
                                    data={Array.from({ length: 24 }, (_, i) => ({
                                        hour: `${i}:00`,
                                        flushes: 2000 + Math.sin(i / 6) * 800 + Math.random() * 400,
                                    }))}
                                >
                                    <defs>
                                        <linearGradient id="mysql-flush" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={THEME.primary} stopOpacity={0.3} />
                                            <stop offset="95%" stopColor={THEME.primary} stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke={`${THEME.grid}40`} />
                                    <XAxis dataKey="hour" stroke={THEME.textDim} style={{ fontSize: 10 }} />
                                    <YAxis stroke={THEME.textDim} style={{ fontSize: 10 }} />
                                    <Tooltip
                                        contentStyle={{
                                            background: THEME.surface,
                                            border: `1px solid ${THEME.glassBorder}`,
                                            borderRadius: 20,
                                        }}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="flushes"
                                        stroke={THEME.primary}
                                        fillOpacity={1}
                                        fill="url(#mysql-flush)"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </Panel>
                        <Panel title="CHECKPOINT STATS" icon={CheckCircle} accentColor={THEME.success}>
                            <DataTable
                                headers={['Metric', 'Value', 'Status']}
                                rows={[
                                    ['LSN', '8,234,567', 'Current'],
                                    ['Last Checkpoint LSN', '8,234,122', 'Healthy'],
                                    ['Pending Pages', '12.4K', 'Normal'],
                                    ['Flush Progress', '98.2%', 'Flushing'],
                                ]}
                            />
                        </Panel>
                    </div>
                );
            }

            if (itemKey === 'maintenance') {
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }} className="dpg-stagger">
                        <h1 style={{ fontSize: 20, fontWeight: 700, color: THEME.textMain, margin: '0 0 12px' }}>
                            Optimize & Maintenance
                        </h1>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 22 }}>
                            <MetricCard
                                icon={CheckCircle}
                                label="Optimized"
                                value="48"
                                sub="Last 30d"
                                color={THEME.success}
                            />
                            <MetricCard
                                icon={AlertTriangle}
                                label="Fragmentation"
                                value="7.2%"
                                sub="Average"
                                color={THEME.warning}
                            />
                            <MetricCard icon={Clock} label="Last Analyze" value="12h" sub="ago" color={THEME.ai} />
                            <MetricCard
                                icon={AlertTriangle}
                                label="Repair Needed"
                                value="1"
                                sub="Table"
                                color={THEME.danger}
                            />
                        </div>
                        <Panel title="MAINTENANCE SCHEDULE" icon={Wrench} accentColor={THEME.primary}>
                            <DataTable
                                headers={['Table', 'Type', 'Schedule', 'Last Run', 'Status']}
                                rows={[
                                    ['orders', 'OPTIMIZE', 'Weekly Sun 2AM', '7d', 'Completed'],
                                    ['users', 'ANALYZE', 'Daily 3AM', '12h', 'Completed'],
                                    ['logs', 'OPTIMIZE', 'Weekly Sun 2AM', '7d', 'Completed'],
                                ]}
                            />
                        </Panel>
                        <Panel title="SPACE RECLAIMED (30D)" icon={BarChart3} accentColor={THEME.ai}>
                            <ResponsiveContainer width="100%" height={180}>
                                <BarChart
                                    data={[
                                        { date: 'Week 1', space: 2.4 },
                                        { date: 'Week 2', space: 1.8 },
                                        { date: 'Week 3', space: 3.2 },
                                        { date: 'Week 4', space: 2.1 },
                                    ]}
                                >
                                    <CartesianGrid strokeDasharray="3 3" stroke={`${THEME.grid}40`} />
                                    <XAxis dataKey="date" stroke={THEME.textDim} style={{ fontSize: 10 }} />
                                    <YAxis stroke={THEME.textDim} style={{ fontSize: 10 }} />
                                    <Tooltip
                                        contentStyle={{
                                            background: THEME.surface,
                                            border: `1px solid ${THEME.glassBorder}`,
                                            borderRadius: 20,
                                        }}
                                    />
                                    <Bar dataKey="space" fill={THEME.success} radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </Panel>
                    </div>
                );
            }

            if (itemKey === 'capacity') {
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }} className="dpg-stagger">
                        <h1 style={{ fontSize: 20, fontWeight: 700, color: THEME.textMain, margin: '0 0 12px' }}>
                            Capacity Planning
                        </h1>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 22 }}>
                            <MetricCard
                                icon={HardDrive}
                                label="Total Storage"
                                value="487GB"
                                sub="All databases"
                                color={THEME.primary}
                            />
                            <MetricCard
                                icon={TrendingUp}
                                label="Growth Rate"
                                value="2.3GB/d"
                                sub="7-day avg"
                                color={THEME.warning}
                            />
                            <MetricCard
                                icon={Clock}
                                label="Days Until Full"
                                value="84d"
                                sub="At current rate"
                                color={THEME.danger}
                            />
                            <MetricCard
                                icon={Database}
                                label="Tablespaces"
                                value="12"
                                sub="Allocated"
                                color={THEME.ai}
                            />
                        </div>
                        <Panel title="STORAGE GROWTH (30D)" icon={TrendingUp} accentColor={THEME.primary}>
                            <ResponsiveContainer width="100%" height={200}>
                                <AreaChart
                                    data={Array.from({ length: 30 }, (_, i) => ({
                                        day: i + 1,
                                        used: 310 + i * 2.3 + Math.random() * 5,
                                    }))}
                                >
                                    <defs>
                                        <linearGradient id="mysql-storage" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={THEME.primary} stopOpacity={0.3} />
                                            <stop offset="95%" stopColor={THEME.primary} stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke={`${THEME.grid}40`} />
                                    <XAxis dataKey="day" stroke={THEME.textDim} style={{ fontSize: 10 }} />
                                    <YAxis stroke={THEME.textDim} style={{ fontSize: 10 }} />
                                    <Tooltip
                                        contentStyle={{
                                            background: THEME.surface,
                                            border: `1px solid ${THEME.glassBorder}`,
                                            borderRadius: 20,
                                        }}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="used"
                                        stroke={THEME.primary}
                                        fillOpacity={1}
                                        fill="url(#mysql-storage)"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </Panel>
                        <Panel title="CAPACITY BY DATABASE" icon={Database} accentColor={THEME.ai}>
                            <DataTable
                                headers={['Database', 'Used', 'Limit', 'Utilization']}
                                rows={demoData.databases.map((db) => [
                                    db.name,
                                    db.size,
                                    '100GB',
                                    Math.floor(Math.random() * 60 + 20) + '%',
                                ])}
                            />
                        </Panel>
                    </div>
                );
            }

            if (itemKey === 'backup') {
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }} className="dpg-stagger">
                        <h1 style={{ fontSize: 20, fontWeight: 700, color: THEME.textMain, margin: '0 0 12px' }}>
                            Backup & Recovery
                        </h1>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 22 }}>
                            <MetricCard icon={Archive} label="Last Backup" value="4h" sub="ago" color={THEME.success} />
                            <MetricCard
                                icon={HardDrive}
                                label="Backup Size"
                                value="127GB"
                                sub="Last full"
                                color={THEME.primary}
                            />
                            <MetricCard icon={Clock} label="Duration" value="2h 18m" sub="Average" color={THEME.ai} />
                            <MetricCard icon={Zap} label="RPO" value="1h" sub="Target" color={THEME.warning} />
                        </div>
                        <Panel title="BACKUP SCHEDULE" icon={Archive} accentColor={THEME.primary}>
                            <DataTable
                                headers={['Type', 'Schedule', 'Last Run', 'Status', 'Retention']}
                                rows={[
                                    ['Full', 'Weekly Sun 1AM', '1d', 'Success', '30d'],
                                    ['Incremental', 'Daily 2AM', '22h', 'Success', '7d'],
                                    ['Differential', 'Every 6h', '2h', 'Running', '2d'],
                                ]}
                            />
                        </Panel>
                        <Panel title="RECOVERY TEST RESULTS" icon={CheckCircle} accentColor={THEME.success}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                                    <span style={{ color: THEME.textMuted }}>Last Test Date</span>
                                    <span style={{ color: THEME.textMain }}>2024-03-20</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                                    <span style={{ color: THEME.textMuted }}>Recovery Time</span>
                                    <span style={{ color: THEME.textMain }}>12m 45s</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                                    <span style={{ color: THEME.textMuted }}>Data Integrity</span>
                                    <span style={{ color: THEME.success }}>Verified</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                                    <span style={{ color: THEME.textMuted }}>Status</span>
                                    <span style={{ color: THEME.success }}>Passed</span>
                                </div>
                            </div>
                        </Panel>
                    </div>
                );
            }
        }

        /* ═══════════════════════════════════════════════════════════════════════════
           SECURITY SECTION
           ═══════════════════════════════════════════════════════════════════════════ */
        if (sectionKey === 'security') {
            if (itemKey === 'secCompliance') {
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }} className="dpg-stagger">
                        <h1 style={{ fontSize: 20, fontWeight: 700, color: THEME.textMain, margin: '0 0 12px' }}>
                            Security & Compliance
                        </h1>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 22 }}>
                            <MetricCard
                                icon={Users}
                                label="Users"
                                value="47"
                                sub="Total accounts"
                                color={THEME.primary}
                            />
                            <MetricCard
                                icon={Lock}
                                label="Privileged"
                                value="8"
                                sub="Admin access"
                                color={THEME.danger}
                            />
                            <MetricCard
                                icon={Shield}
                                label="SSL Connections"
                                value="100%"
                                sub="All encrypted"
                                color={THEME.success}
                            />
                            <MetricCard
                                icon={AlertTriangle}
                                label="Failed Logins"
                                value="2"
                                sub="24h"
                                color={THEME.ai}
                            />
                        </div>
                        <Panel title="USER PRIVILEGES" icon={Users} accentColor={THEME.primary}>
                            <DataTable
                                headers={['User', 'Host', 'Privileges', 'Last Login']}
                                rows={[
                                    ['admin', 'localhost', 'ALL', '2h'],
                                    ['app_user', '%', 'SELECT,INSERT,UPDATE', '5m'],
                                    ['backup_user', '%', 'SELECT,LOCK TABLES', '4h'],
                                ]}
                            />
                        </Panel>
                        <Panel title="SECURITY AUDIT" icon={Shield} accentColor={THEME.success}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                <div>
                                    <StatusBadge label="Password Policy" color={THEME.success} />{' '}
                                    <span style={{ fontSize: 10, color: THEME.textDim, marginLeft: 8 }}>Enforced</span>
                                </div>
                                <div>
                                    <StatusBadge label="TLS/SSL" color={THEME.success} />{' '}
                                    <span style={{ fontSize: 10, color: THEME.textDim, marginLeft: 8 }}>v1.2+</span>
                                </div>
                                <div>
                                    <StatusBadge label="Audit Logging" color={THEME.success} />{' '}
                                    <span style={{ fontSize: 10, color: THEME.textDim, marginLeft: 8 }}>Enabled</span>
                                </div>
                                <div>
                                    <StatusBadge label="Data Masking" color={THEME.warning} />{' '}
                                    <span style={{ fontSize: 10, color: THEME.textDim, marginLeft: 8 }}>Partial</span>
                                </div>
                            </div>
                        </Panel>
                        <Panel title="COMPLIANCE CHECKS" icon={CheckCircle} accentColor={THEME.ai}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                                    <span style={{ color: THEME.textMuted }}>GDPR</span>
                                    <StatusBadge label="Compliant" color={THEME.success} />
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                                    <span style={{ color: THEME.textMuted }}>HIPAA</span>
                                    <StatusBadge label="Compliant" color={THEME.success} />
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                                    <span style={{ color: THEME.textMuted }}>SOC2</span>
                                    <StatusBadge label="In Review" color={THEME.warning} />
                                </div>
                            </div>
                        </Panel>
                    </div>
                );
            }
        }

        /* ═══════════════════════════════════════════════════════════════════════════
           OBSERVABILITY SECTION
           ═══════════════════════════════════════════════════════════════════════════ */
        if (sectionKey === 'observability') {
            if (itemKey === 'obsHub') {
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }} className="dpg-stagger">
                        <h1 style={{ fontSize: 20, fontWeight: 700, color: THEME.textMain, margin: '0 0 12px' }}>
                            Observability Hub
                        </h1>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 22 }}>
                            <MetricCard
                                icon={Network}
                                label="Integrations"
                                value="8"
                                sub="Connected"
                                color={THEME.primary}
                            />
                            <MetricCard
                                icon={Bell}
                                label="Active Alerts"
                                value="5"
                                sub="Monitoring"
                                color={THEME.warning}
                            />
                            <MetricCard
                                icon={Radio}
                                label="Log Rate"
                                value="2.4M/h"
                                sub="Ingest rate"
                                color={THEME.ai}
                            />
                            <MetricCard
                                icon={Eye}
                                label="Trace Coverage"
                                value="94.2%"
                                sub="Instrumented"
                                color={THEME.success}
                            />
                        </div>
                        <Panel title="INTEGRATION STATUS" icon={Network} accentColor={THEME.primary}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22 }}>
                                {[
                                    { name: 'Datadog', status: 'Connected' },
                                    { name: 'Prometheus', status: 'Connected' },
                                    { name: 'ELK Stack', status: 'Connected' },
                                    { name: 'New Relic', status: 'Disconnected' },
                                ].map((int, i) => (
                                    <div
                                        key={i}
                                        style={{
                                            background: THEME.gridDark,
                                            padding: 12,
                                            borderRadius: 18,
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                        }}
                                    >
                                        <span style={{ fontSize: 11, color: THEME.textMuted }}>{int.name}</span>
                                        <StatusBadge
                                            label={int.status}
                                            color={int.status === 'Connected' ? THEME.success : THEME.danger}
                                        />
                                    </div>
                                ))}
                            </div>
                        </Panel>
                        <Panel title="LOG VOLUME (24H)" icon={BarChart3} accentColor={THEME.ai}>
                            <ResponsiveContainer width="100%" height={180}>
                                <AreaChart
                                    data={Array.from({ length: 24 }, (_, i) => ({
                                        hour: `${i}:00`,
                                        logs: 80 + Math.sin(i / 6) * 40 + Math.random() * 20,
                                    }))}
                                >
                                    <defs>
                                        <linearGradient id="mysql-logs" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={THEME.ai} stopOpacity={0.3} />
                                            <stop offset="95%" stopColor={THEME.ai} stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke={`${THEME.grid}40`} />
                                    <XAxis dataKey="hour" stroke={THEME.textDim} style={{ fontSize: 10 }} />
                                    <YAxis stroke={THEME.textDim} style={{ fontSize: 10 }} />
                                    <Tooltip
                                        contentStyle={{
                                            background: THEME.surface,
                                            border: `1px solid ${THEME.glassBorder}`,
                                            borderRadius: 20,
                                        }}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="logs"
                                        stroke={THEME.ai}
                                        fillOpacity={1}
                                        fill="url(#mysql-logs)"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </Panel>
                    </div>
                );
            }

            if (itemKey === 'cloudwatch') {
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }} className="dpg-stagger">
                        <h1 style={{ fontSize: 20, fontWeight: 700, color: THEME.textMain, margin: '0 0 12px' }}>
                            CloudWatch
                        </h1>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 22 }}>
                            <MetricCard icon={Bell} label="Alarms" value="24" sub="Configured" color={THEME.warning} />
                            <MetricCard icon={Zap} label="Metrics" value="340" sub="Custom" color={THEME.primary} />
                            <MetricCard icon={Eye} label="Dashboards" value="12" sub="Created" color={THEME.ai} />
                            <MetricCard
                                icon={AlertTriangle}
                                label="Anomalies"
                                value="3"
                                sub="Detected"
                                color={THEME.danger}
                            />
                        </div>
                        <Panel title="CLOUDWATCH METRICS (24H)" icon={Zap} accentColor={THEME.primary}>
                            <ResponsiveContainer width="100%" height={200}>
                                <LineChart
                                    data={Array.from({ length: 24 }, (_, i) => ({
                                        hour: i,
                                        cpu: 30 + Math.sin(i / 6) * 20 + Math.random() * 10,
                                    }))}
                                >
                                    <CartesianGrid strokeDasharray="3 3" stroke={`${THEME.grid}40`} />
                                    <XAxis dataKey="hour" stroke={THEME.textDim} style={{ fontSize: 10 }} />
                                    <YAxis stroke={THEME.textDim} style={{ fontSize: 10 }} />
                                    <Tooltip
                                        contentStyle={{
                                            background: THEME.surface,
                                            border: `1px solid ${THEME.glassBorder}`,
                                            borderRadius: 20,
                                        }}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="cpu"
                                        stroke={THEME.primary}
                                        strokeWidth={2}
                                        dot={false}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </Panel>
                        <Panel title="ALARM STATUS" icon={Bell} accentColor={THEME.warning}>
                            <DataTable
                                headers={['Name', 'Threshold', 'Current', 'Status']}
                                rows={[
                                    ['High CPU', '>70%', '42%', 'OK'],
                                    ['Low Disk', '<10%', '32%', 'OK'],
                                    ['High Memory', '>80%', '68%', 'OK'],
                                ]}
                            />
                        </Panel>
                    </div>
                );
            }

            if (itemKey === 'logPatterns') {
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }} className="dpg-stagger">
                        <h1 style={{ fontSize: 20, fontWeight: 700, color: THEME.textMain, margin: '0 0 12px' }}>
                            Log Pattern Analysis
                        </h1>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 22 }}>
                            <MetricCard
                                icon={FileText}
                                label="Patterns Found"
                                value="142"
                                sub="Unique"
                                color={THEME.primary}
                            />
                            <MetricCard
                                icon={AlertTriangle}
                                label="Error Rate"
                                value="2.3%"
                                sub="Of all logs"
                                color={THEME.danger}
                            />
                            <MetricCard icon={Zap} label="New Patterns" value="4" sub="Today" color={THEME.warning} />
                            <MetricCard icon={Radio} label="Log Volume" value="2.4M" sub="Daily" color={THEME.ai} />
                        </div>
                        <Panel title="PATTERN DISTRIBUTION" icon={BarChart3} accentColor={THEME.ai}>
                            <ResponsiveContainer width="100%" height={180}>
                                <PieChart>
                                    <Pie
                                        data={[
                                            { name: 'Info', value: 60 },
                                            { name: 'Warn', value: 25 },
                                            { name: 'Error', value: 10 },
                                            { name: 'Debug', value: 5 },
                                        ]}
                                        cx="50%"
                                        cy="50%"
                                        labelLine={false}
                                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                        outerRadius={60}
                                    >
                                        <Cell fill={THEME.ai} />
                                        <Cell fill={THEME.warning} />
                                        <Cell fill={THEME.danger} />
                                        <Cell fill={THEME.primary} />
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                        </Panel>
                        <Panel title="TOP PATTERNS" icon={FileText} accentColor={THEME.primary}>
                            <DataTable
                                headers={['Pattern', 'Frequency', 'Severity', 'Last Seen']}
                                rows={[
                                    ['Connection timeout', '1.2K', 'Warning', '5m'],
                                    ['Slow query', '840', 'Warning', '12m'],
                                    ['Authentication fail', '24', 'Error', '2h'],
                                ]}
                            />
                        </Panel>
                    </div>
                );
            }

            if (itemKey === 'otel') {
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }} className="dpg-stagger">
                        <h1 style={{ fontSize: 20, fontWeight: 700, color: THEME.textMain, margin: '0 0 12px' }}>
                            OpenTelemetry
                        </h1>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 22 }}>
                            <MetricCard
                                icon={Zap}
                                label="Spans/sec"
                                value="12.4K"
                                sub="Current rate"
                                color={THEME.primary}
                            />
                            <MetricCard
                                icon={AlertTriangle}
                                label="Error Rate"
                                value="1.2%"
                                sub="Traced"
                                color={THEME.danger}
                            />
                            <MetricCard icon={Clock} label="Avg Latency" value="48ms" sub="P50" color={THEME.ai} />
                            <MetricCard
                                icon={Network}
                                label="Services"
                                value="18"
                                sub="Instrumented"
                                color={THEME.success}
                            />
                        </div>
                        <Panel title="TRACE WATERFALL" icon={Radio} accentColor={THEME.primary}>
                            <div
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 20,
                                    fontSize: 10,
                                    fontFamily: THEME.fontMono,
                                }}
                            >
                                <div style={{ display: 'flex', gap: 20 }}>
                                    <span style={{ color: THEME.ai }}>├─ query-execution</span>
                                    <span style={{ color: THEME.textDim }}>12.4ms</span>
                                </div>
                                <div style={{ display: 'flex', gap: 20, marginLeft: 16 }}>
                                    <span style={{ color: THEME.primary }}>├─ parse</span>
                                    <span style={{ color: THEME.textDim }}>1.2ms</span>
                                </div>
                                <div style={{ display: 'flex', gap: 20, marginLeft: 16 }}>
                                    <span style={{ color: THEME.primary }}>├─ optimize</span>
                                    <span style={{ color: THEME.textDim }}>2.1ms</span>
                                </div>
                                <div style={{ display: 'flex', gap: 20, marginLeft: 16 }}>
                                    <span style={{ color: THEME.primary }}>└─ execute</span>
                                    <span style={{ color: THEME.textDim }}>9.1ms</span>
                                </div>
                            </div>
                        </Panel>
                        <Panel title="SERVICE MAP" icon={Network} accentColor={THEME.ai}>
                            <div style={{ fontSize: 10, color: THEME.textMuted, padding: '8px 0' }}>
                                api-gateway → database-layer → cache-service → message-queue
                            </div>
                        </Panel>
                    </div>
                );
            }

            if (itemKey === 'k8s') {
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }} className="dpg-stagger">
                        <h1 style={{ fontSize: 20, fontWeight: 700, color: THEME.textMain, margin: '0 0 12px' }}>
                            Kubernetes
                        </h1>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 22 }}>
                            <MetricCard icon={Network} label="Pods" value="24" sub="Running" color={THEME.primary} />
                            <MetricCard
                                icon={CheckCircle}
                                label="Healthy"
                                value="23"
                                sub="95.8%"
                                color={THEME.success}
                            />
                            <MetricCard icon={RefreshCw} label="Restarts" value="1" sub="24h" color={THEME.warning} />
                            <MetricCard icon={Cpu} label="CPU Request" value="8.2" sub="cores" color={THEME.ai} />
                        </div>
                        <Panel title="POD STATUS" icon={Network} accentColor={THEME.primary}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 20 }}>
                                {Array.from({ length: 24 }).map((_, i) => (
                                    <div
                                        key={i}
                                        style={{
                                            background: i < 23 ? THEME.success : THEME.warning,
                                            borderRadius: 20,
                                            height: 24,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: 9,
                                            color: THEME.textInverse,
                                            fontWeight: 700,
                                        }}
                                    >
                                        {i + 1}
                                    </div>
                                ))}
                            </div>
                        </Panel>
                        <Panel title="RESOURCE USAGE" icon={Cpu} accentColor={THEME.ai}>
                            <ResponsiveContainer width="100%" height={180}>
                                <BarChart
                                    data={[
                                        { resource: 'CPU', used: 8.2, limit: 16 },
                                        { resource: 'Memory', used: 22.4, limit: 32 },
                                        { resource: 'Disk', used: 45.6, limit: 100 },
                                    ]}
                                >
                                    <CartesianGrid strokeDasharray="3 3" stroke={`${THEME.grid}40`} />
                                    <XAxis dataKey="resource" stroke={THEME.textDim} style={{ fontSize: 10 }} />
                                    <YAxis stroke={THEME.textDim} style={{ fontSize: 10 }} />
                                    <Tooltip
                                        contentStyle={{
                                            background: THEME.surface,
                                            border: `1px solid ${THEME.glassBorder}`,
                                            borderRadius: 20,
                                        }}
                                    />
                                    <Bar dataKey="used" fill={THEME.primary} radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </Panel>
                    </div>
                );
            }

            if (itemKey === 'statusPage') {
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }} className="dpg-stagger">
                        <h1 style={{ fontSize: 20, fontWeight: 700, color: THEME.textMain, margin: '0 0 12px' }}>
                            Status Page
                        </h1>
                        <Panel title="SYSTEM STATUS" icon={CheckCircle} accentColor={THEME.success}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ color: THEME.textMuted }}>Primary Database</span>
                                    <StatusBadge label="Operational" color={THEME.success} pulse />
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ color: THEME.textMuted }}>Replica Pool</span>
                                    <StatusBadge label="Operational" color={THEME.success} />
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ color: THEME.textMuted }}>Backup Service</span>
                                    <StatusBadge label="Operational" color={THEME.success} />
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ color: THEME.textMuted }}>Monitoring</span>
                                    <StatusBadge label="Operational" color={THEME.success} />
                                </div>
                            </div>
                        </Panel>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 22 }}>
                            <MetricCard
                                icon={Activity}
                                label="Uptime"
                                value="99.98%"
                                sub="30 days"
                                color={THEME.success}
                            />
                            <MetricCard
                                icon={AlertTriangle}
                                label="Incidents"
                                value="1"
                                sub="Last 30d"
                                color={THEME.warning}
                            />
                            <MetricCard icon={Clock} label="MTTR" value="8m" sub="Average" color={THEME.ai} />
                        </div>
                        <Panel title="INCIDENT HISTORY" icon={AlertTriangle} accentColor={THEME.warning}>
                            <DataTable
                                headers={['Date', 'Service', 'Duration', 'Status']}
                                rows={[
                                    ['2024-03-20', 'Replica 1', '8m 30s', 'Resolved'],
                                    ['2024-03-15', 'Backup Job', '15m', 'Resolved'],
                                    ['2024-03-10', 'Network', '2m', 'Resolved'],
                                ]}
                            />
                        </Panel>
                    </div>
                );
            }

            if (itemKey === 'aiMonitoring') {
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }} className="dpg-stagger">
                        <h1 style={{ fontSize: 20, fontWeight: 700, color: THEME.textMain, margin: '0 0 12px' }}>
                            AI Monitoring
                        </h1>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 22 }}>
                            <MetricCard
                                icon={AlertTriangle}
                                label="Anomalies"
                                value="7"
                                sub="Detected"
                                color={THEME.warning}
                            />
                            <MetricCard
                                icon={TrendingUp}
                                label="Predictions"
                                value="94.2%"
                                sub="Accuracy"
                                color={THEME.success}
                            />
                            <MetricCard icon={Zap} label="Models" value="3" sub="Active" color={THEME.ai} />
                            <MetricCard
                                icon={CheckCircle}
                                label="Incidents"
                                value="0"
                                sub="Predicted"
                                color={THEME.success}
                            />
                        </div>
                        <Panel title="ANOMALY DETECTION (7D)" icon={AlertTriangle} accentColor={THEME.warning}>
                            <ResponsiveContainer width="100%" height={200}>
                                <LineChart
                                    data={Array.from({ length: 7 }, (_, i) => ({
                                        day: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i],
                                        anomalies: Math.floor(Math.random() * 3),
                                    }))}
                                >
                                    <CartesianGrid strokeDasharray="3 3" stroke={`${THEME.grid}40`} />
                                    <XAxis dataKey="day" stroke={THEME.textDim} style={{ fontSize: 10 }} />
                                    <YAxis stroke={THEME.textDim} style={{ fontSize: 10 }} />
                                    <Tooltip
                                        contentStyle={{
                                            background: THEME.surface,
                                            border: `1px solid ${THEME.glassBorder}`,
                                            borderRadius: 20,
                                        }}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="anomalies"
                                        stroke={THEME.warning}
                                        strokeWidth={2}
                                        dot={true}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </Panel>
                        <Panel title="PREDICTIONS" icon={TrendingUp} accentColor={THEME.ai}>
                            <DataTable
                                headers={['Metric', 'Forecast', 'Confidence', 'Action']}
                                rows={[
                                    ['QPS Peak', '1.4K/s', '92%', 'Scale ready'],
                                    ['Memory', '82%', '88%', 'Monitor'],
                                    ['Connections', '120', '95%', 'OK'],
                                ]}
                            />
                        </Panel>
                    </div>
                );
            }
        }

        /* ═══════════════════════════════════════════════════════════════════════════
           DEVELOPER TOOLS SECTION
           ═══════════════════════════════════════════════════════════════════════════ */
        if (sectionKey === 'dev') {
            if (itemKey === 'sqlConsole') {
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }} className="dpg-stagger">
                        <h1 style={{ fontSize: 20, fontWeight: 700, color: THEME.textMain, margin: '0 0 12px' }}>
                            SQL Console
                        </h1>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 22 }}>
                            <MetricCard
                                icon={Terminal}
                                label="Queries Run"
                                value="24.2K"
                                sub="Today"
                                color={THEME.primary}
                            />
                            <MetricCard
                                icon={CheckCircle}
                                label="Success Rate"
                                value="99.2%"
                                sub="Last 24h"
                                color={THEME.success}
                            />
                            <MetricCard icon={Clock} label="Avg Time" value="1.8ms" sub="Per query" color={THEME.ai} />
                            <MetricCard icon={Clock} label="Slowest" value="2.4s" sub="Max" color={THEME.warning} />
                        </div>
                        <Panel title="SQL EDITOR" icon={Terminal} accentColor={THEME.primary}>
                            <div
                                style={{
                                    background: THEME.gridDark,
                                    padding: 12,
                                    borderRadius: 18,
                                    fontFamily: THEME.fontMono,
                                    fontSize: 11,
                                    color: THEME.textMuted,
                                    overflow: 'auto',
                                    maxHeight: 150,
                                }}
                            >
                                SELECT o.id, o.amount, c.name{'\n'}
                                FROM orders o{'\n'}
                                JOIN customers c ON o.customer_id = c.id{'\n'}
                                WHERE o.created_at {'>'} NOW() - INTERVAL 7 DAY;
                            </div>
                        </Panel>
                        <Panel title="RESULTS" icon={Database} accentColor={THEME.success}>
                            <DataTable
                                headers={['id', 'amount', 'name']}
                                rows={[
                                    ['10248', '$2,340.50', 'Acme Corp'],
                                    ['10249', '$1,890.25', 'Beta Inc'],
                                    ['10250', '$3,120.75', 'Gamma LLC'],
                                ]}
                            />
                        </Panel>
                        <Panel title="QUERY HISTORY" icon={Clock} accentColor={THEME.ai}>
                            <div
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 6,
                                    fontSize: 10,
                                    color: THEME.textMuted,
                                }}
                            >
                                <div style={{ paddingBottom: 6, borderBottom: `1px solid ${THEME.gridDark}` }}>
                                    SELECT * FROM orders LIMIT 100 -{' '}
                                    <span style={{ color: THEME.textDim }}>12m ago</span>
                                </div>
                                <div style={{ paddingBottom: 6, borderBottom: `1px solid ${THEME.gridDark}` }}>
                                    UPDATE users SET active=1 WHERE id=5 -{' '}
                                    <span style={{ color: THEME.textDim }}>25m ago</span>
                                </div>
                                <div>
                                    EXPLAIN SELECT * FROM orders - <span style={{ color: THEME.textDim }}>1h ago</span>
                                </div>
                            </div>
                        </Panel>
                    </div>
                );
            }

            if (itemKey === 'apiTracing') {
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }} className="dpg-stagger">
                        <h1 style={{ fontSize: 20, fontWeight: 700, color: THEME.textMain, margin: '0 0 12px' }}>
                            API Tracing
                        </h1>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 22 }}>
                            <MetricCard
                                icon={Network}
                                label="Endpoints"
                                value="42"
                                sub="Tracked"
                                color={THEME.primary}
                            />
                            <MetricCard icon={Clock} label="Avg Latency" value="124ms" sub="P50" color={THEME.ai} />
                            <MetricCard
                                icon={AlertTriangle}
                                label="Error Rate"
                                value="0.8%"
                                sub="All APIs"
                                color={THEME.danger}
                            />
                            <MetricCard
                                icon={Zap}
                                label="Throughput"
                                value="4.2K/s"
                                sub="Current"
                                color={THEME.success}
                            />
                        </div>
                        <Panel title="ENDPOINT LATENCY (24H)" icon={BarChart3} accentColor={THEME.primary}>
                            <ResponsiveContainer width="100%" height={200}>
                                <BarChart
                                    data={[
                                        { endpoint: '/api/orders', latency: 85 },
                                        { endpoint: '/api/users', latency: 62 },
                                        { endpoint: '/api/products', latency: 148 },
                                        { endpoint: '/api/search', latency: 256 },
                                        { endpoint: '/api/stats', latency: 342 },
                                    ]}
                                >
                                    <CartesianGrid strokeDasharray="3 3" stroke={`${THEME.grid}40`} />
                                    <XAxis dataKey="endpoint" stroke={THEME.textDim} style={{ fontSize: 10 }} />
                                    <YAxis stroke={THEME.textDim} style={{ fontSize: 10 }} />
                                    <Tooltip
                                        contentStyle={{
                                            background: THEME.surface,
                                            border: `1px solid ${THEME.glassBorder}`,
                                            borderRadius: 20,
                                        }}
                                    />
                                    <Bar dataKey="latency" fill={THEME.primary} radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </Panel>
                        <Panel title="RECENT TRACES" icon={Radio} accentColor={THEME.ai}>
                            <DataTable
                                headers={['Endpoint', 'Status', 'Latency', 'Timestamp']}
                                rows={[
                                    ['GET /api/orders/123', '200', '48ms', 'now'],
                                    ['POST /api/orders', '201', '132ms', '5s'],
                                    ['GET /api/users', '200', '62ms', '12s'],
                                ]}
                            />
                        </Panel>
                    </div>
                );
            }

            if (itemKey === 'repository') {
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }} className="dpg-stagger">
                        <h1 style={{ fontSize: 20, fontWeight: 700, color: THEME.textMain, margin: '0 0 12px' }}>
                            Repository
                        </h1>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 22 }}>
                            <MetricCard icon={Code} label="Stored Procs" value="52" sub="Total" color={THEME.primary} />
                            <MetricCard icon={Code} label="Functions" value="28" sub="User-defined" color={THEME.ai} />
                            <MetricCard icon={Code} label="Triggers" value="18" sub="Active" color={THEME.success} />
                            <MetricCard icon={Code} label="Events" value="6" sub="Scheduled" color={THEME.warning} />
                        </div>
                        <Panel title="DATABASE OBJECTS" icon={Database} accentColor={THEME.primary}>
                            <DataTable
                                headers={['Name', 'Type', 'Created', 'Modified']}
                                rows={[
                                    ['sp_calculate_total', 'Procedure', '2024-01-15', '2024-03-10'],
                                    ['fn_get_status', 'Function', '2024-02-20', '2024-02-20'],
                                    ['tr_audit_log', 'Trigger', '2023-12-01', '2024-01-05'],
                                ]}
                            />
                        </Panel>
                        <Panel title="RECENT CHANGES" icon={GitBranch} accentColor={THEME.ai}>
                            <div
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 20,
                                    fontSize: 10,
                                    color: THEME.textMuted,
                                }}
                            >
                                <div style={{ paddingBottom: 8, borderBottom: `1px solid ${THEME.gridDark}` }}>
                                    <span style={{ color: THEME.success }}>✓ Modified</span> sp_update_inventory -{' '}
                                    <span style={{ color: THEME.textDim }}>2h ago by admin</span>
                                </div>
                                <div style={{ paddingBottom: 8, borderBottom: `1px solid ${THEME.gridDark}` }}>
                                    <span style={{ color: THEME.success }}>✓ Created</span> fn_validate_email -{' '}
                                    <span style={{ color: THEME.textDim }}>5h ago by dev</span>
                                </div>
                                <div>
                                    <span style={{ color: THEME.success }}>✓ Modified</span> tr_log_changes -{' '}
                                    <span style={{ color: THEME.textDim }}>12h ago by admin</span>
                                </div>
                            </div>
                        </Panel>
                    </div>
                );
            }

            if (itemKey === 'aiAdvisor') {
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }} className="dpg-stagger">
                        <h1 style={{ fontSize: 20, fontWeight: 700, color: THEME.textMain, margin: '0 0 12px' }}>
                            AI Query Advisor
                        </h1>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 22 }}>
                            <MetricCard icon={Zap} label="Suggestions" value="48" sub="This month" color={THEME.ai} />
                            <MetricCard
                                icon={CheckCircle}
                                label="Applied"
                                value="32"
                                sub="66.7%"
                                color={THEME.success}
                            />
                            <MetricCard
                                icon={TrendingUp}
                                label="Perf Gain"
                                value="34.2%"
                                sub="Avg improvement"
                                color={THEME.warning}
                            />
                            <MetricCard icon={Eye} label="Coverage" value="87.3%" sub="Queries" color={THEME.primary} />
                        </div>
                        <Panel title="AI RECOMMENDATIONS" icon={Zap} accentColor={THEME.ai}>
                            <DataTable
                                headers={['Suggestion', 'Queries', 'Est. Gain', 'Status']}
                                rows={[
                                    ['Add index user_id', '1.2K', '+28%', 'Applied'],
                                    ['Use JOIN instead', '840', '+15%', 'Applied'],
                                    ['Cache result', '340', '+22%', 'Pending'],
                                ]}
                            />
                        </Panel>
                        <Panel title="OPTIMIZATION IMPACT (30D)" icon={TrendingUp} accentColor={THEME.success}>
                            <ResponsiveContainer width="100%" height={180}>
                                <AreaChart
                                    data={Array.from({ length: 30 }, (_, i) => ({
                                        day: i + 1,
                                        gain: 15 + Math.sin(i / 8) * 10 + Math.random() * 8,
                                    }))}
                                >
                                    <defs>
                                        <linearGradient id="mysql-ai-advisor" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={THEME.success} stopOpacity={0.3} />
                                            <stop offset="95%" stopColor={THEME.success} stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke={`${THEME.grid}40`} />
                                    <XAxis dataKey="day" stroke={THEME.textDim} style={{ fontSize: 10 }} />
                                    <YAxis stroke={THEME.textDim} style={{ fontSize: 10 }} />
                                    <Tooltip
                                        contentStyle={{
                                            background: THEME.surface,
                                            border: `1px solid ${THEME.glassBorder}`,
                                            borderRadius: 20,
                                        }}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="gain"
                                        stroke={THEME.success}
                                        fillOpacity={1}
                                        fill="url(#mysql-ai-advisor)"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </Panel>
                    </div>
                );
            }
        }

        return null;
    };

    return (
        <DemoLayout
            sections={sections}
            renderContent={renderContent}
            title="MySQL Demo"
            accentColor={THEME.primary}
            titleIcon={Database}
            activeDemo="demo-mysql"
        />
    );
}

export default React.memo(DemoMySQLTab);
