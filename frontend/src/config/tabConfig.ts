// ==========================================================================
//  FATHOM — Tab Configuration (central registry of all dashboard tabs)
// ==========================================================================
//
//  Each entry is either a section header { section, accent }
//  or a tab definition { id, icon, label, component, badge }.
//  The TAB_CONFIG array drives the sidebar, routing, and access control.
// ==========================================================================

import {
    Activity,
    Zap,
    HardDrive,
    Bell,
    Layers,
    Network,
    Terminal,
    Users,
    Shield,
    GitBranch,
    TrendingUp,
    CalendarCheck,
    FileSearch,
    Link2,
    Cpu,
    BarChart2,
    Lock,
    Radio,
    Cloud,
    Archive,
    RefreshCw,
    Radar,
    Brain,
    Container,
    LayoutDashboard,
    Globe,
    Download,
    Clock,
    CheckCircle,
    Database,
    Gauge,
    Server,
    HardDriveDownload,
    Workflow,
    GitMerge,
    Eye,
    FileText,
    BarChart3,
    AlertOctagon,
    Droplets,
    PanelTop,
    TableProperties,
    ScanSearch,
    FolderGit2,
    ShieldCheck,
    DatabaseZap,
    Blocks,
    Activity as ActivityIcon,
    Search,
    Sparkles,
    Store,
} from 'lucide-react';

import { getDS } from './designTokens';

// These will be set by App.jsx after lazy imports are created
let _components = {};

export function registerComponents(components) {
    _components = components;
}

export function buildTabConfig() {
    const DS = getDS();
    return [
        // ── Connections ─────────────────────────────────────────────
        //    Add/manage database connections
        { section: 'Connections', accent: DS.violet },
        {
            id: 'connections',
            icon: Link2,
            label: 'Manage Connections',
            component: _components.ConnectionPoolTab,
            badge: null,
        },

        // ── Overview & Health ────────────────────────────────────────
        //    Top-level dashboards: fleet-wide health and single-DB overview
        { section: 'Overview', accent: DS.cyan },
        {
            id: 'fleet-overview',
            icon: PanelTop,
            label: 'Fleet Overview',
            component: _components.FleetOverviewTab,
            badge: null,
        },
        { id: 'overview', icon: Activity, label: 'Database Overview', component: _components.OverviewTab, badge: null },
        { id: 'performance', icon: Zap, label: 'Performance', component: _components.PerformanceTab, badge: null },
        { id: 'resources', icon: HardDrive, label: 'Resources', component: _components.ResourcesTab, badge: null },
        {
            id: 'reliability',
            icon: CheckCircle,
            label: 'Reliability',
            component: _components.ReliabilityTab,
            badge: null,
        },

        // ── Alerts & Rules ───────────────────────────────────────────
        //    All alerting in one place: active alerts, rule config, correlation
        { section: 'Alerts & Rules', accent: DS.rose },
        // badge stays null until a real unacknowledged-alert count is wired in —
        // a hardcoded number here reads as live data and is wrong for everyone.
        { id: 'alerts', icon: Bell, label: 'Active Alerts', component: _components.AlertsComponent, badge: null },
        // Incidents sit next to alerts because they are the same event seen
        // differently: an alert is the notification, an incident is the work
        // item — owned, timed against an SLA, and closed by a person.
        {
            id: 'incidents',
            icon: ShieldCheck,
            label: 'Incidents',
            component: _components.IncidentsTab,
            badge: null,
        },
        {
            id: 'alert-rules',
            icon: AlertOctagon,
            label: 'Alert Rules',
            component: _components.AlertRuleEditor,
            badge: null,
        },
        {
            id: 'alert-correlation',
            icon: Link2,
            label: 'Alert Correlation',
            component: _components.AlertCorrelationTab,
            badge: null,
        },

        // ── Query Analysis ───────────────────────────────────────────
        //    Query optimization, plan inspection, index management
        { section: 'Query Analysis', accent: DS.violet },
        {
            id: 'agent-advisor',
            icon: Sparkles,
            label: 'AI Agent & Advisor',
            component: _components.AgentAdvisorTab,
            badge: 'new',
        },
        {
            id: 'optimizer',
            icon: DatabaseZap,
            label: 'Query Optimizer & Plan Viewer',
            component: _components.QueryOptimizerTab,
            badge: null,
        },
        {
            id: 'regression',
            icon: TrendingUp,
            label: 'Plan Regression',
            component: _components.QueryPlanRegressionTab,
            badge: null,
        },
        { id: 'indexes', icon: Layers, label: 'Indexes', component: _components.IndexesTab, badge: null },
        {
            id: 'bloat',
            icon: ScanSearch,
            label: 'Bloat Analysis',
            component: _components.BloatAnalysisTab,
            badge: null,
        },
        {
            id: 'Table',
            icon: TableProperties,
            label: 'Table Analysis',
            component: _components.TableAnalytics,
            badge: null,
        },

        // ── Schema & Data ────────────────────────────────────────────
        //    Schema browsing, visualization, migrations, and charting
        { section: 'Schema & Data', accent: DS.amber },
        {
            id: 'schema',
            icon: FolderGit2,
            label: 'Schema & Migrations',
            component: _components.SchemaVersioningTab,
            badge: null,
        },

        // ── Infrastructure ───────────────────────────────────────────
        //    Replication, maintenance, capacity
        { section: 'Infrastructure', accent: DS.emerald },
        {
            id: 'pool-metrics',
            icon: Droplets,
            label: 'Pool Metrics',
            component: _components.PoolMetricsDashboard,
            badge: null,
        },
        {
            id: 'replication',
            icon: Radio,
            label: 'Replication & WAL',
            component: _components.ReplicationWALTab,
            badge: null,
        },
        {
            id: 'checkpoint',
            icon: CheckCircle,
            label: 'Checkpoint Monitor',
            component: _components.CheckpointMonitorTab,
            badge: null,
        },
        {
            id: 'maintenance',
            icon: RefreshCw,
            label: 'Vacuum & Maintenance',
            component: _components.VacuumMaintenanceTab,
            badge: null,
        },
        {
            id: 'capacity',
            icon: BarChart2,
            label: 'Capacity Planning',
            component: _components.CapacityPlanningTab,
            badge: null,
        },
        {
            id: 'backup',
            icon: Archive,
            label: 'Backup & Recovery',
            component: _components.BackupRecoveryTab,
            badge: null,
        },

        // ── Security ─────────────────────────────────────────────────
        { section: 'Security', accent: DS.rose },
        {
            id: 'security',
            icon: ShieldCheck,
            label: 'Security & Compliance',
            component: _components.SecurityComplianceTab,
            badge: null,
        },

        // ── Observability ────────────────────────────────────────────
        //    Logs, tracing, external integrations, status
        { section: 'Observability', accent: DS.amber },
        {
            id: 'observability-hub',
            icon: Eye,
            label: 'Observability Hub',
            component: _components.ObsHub_all,
            badge: null,
        },
        {
            id: 'obs-overview',
            icon: Gauge,
            label: 'Hub: Overview',
            component: _components.ObsHub_overview,
            badge: null,
        },
        { id: 'obs-api', icon: Cpu, label: 'Hub: API Monitoring', component: _components.ObsHub_api, badge: null },
        {
            id: 'obs-exceptions',
            icon: AlertOctagon,
            label: 'Hub: Exceptions',
            component: _components.ObsHub_exceptions,
            badge: null,
        },
        { id: 'obs-uptime', icon: Globe, label: 'Hub: Uptime', component: _components.ObsHub_uptime, badge: null },
        { id: 'obs-audit', icon: Shield, label: 'Hub: Audit Log', component: _components.ObsHub_audit, badge: null },
        { id: 'obs-jobs', icon: Workflow, label: 'Hub: Job Monitor', component: _components.ObsHub_jobs, badge: null },
        {
            id: 'obs-slo',
            icon: BarChart3,
            label: 'Hub: SLO / Error Budget',
            component: _components.ObsHub_slo,
            badge: null,
        },
        { id: 'obs-alerts', icon: Bell, label: 'Hub: Alerts', component: _components.ObsHub_alerts, badge: null },
        { id: 'obs-logs', icon: FileText, label: 'Hub: Log Explorer', component: _components.ObsHub_logs, badge: null },
        {
            id: 'obs-infra',
            icon: Server,
            label: 'Hub: Infrastructure',
            component: _components.ObsHub_infra,
            badge: null,
        },
        {
            id: 'obs-topology',
            icon: GitBranch,
            label: 'Hub: Service Map',
            component: _components.ObsHub_topology,
            badge: null,
        },
        { id: 'obs-ai', icon: Zap, label: 'Hub: AI Anomalies', component: _components.ObsHub_ai, badge: null },
        {
            id: 'obs-cost',
            icon: TrendingUp,
            label: 'Hub: Cost & Budget',
            component: _components.ObsHub_cost,
            badge: null,
        },
        {
            id: 'obs-traces',
            icon: Activity,
            label: 'Hub: API Tracing',
            component: _components.ObsHub_traces,
            badge: null,
        },
        { id: 'cloudwatch', icon: Cloud, label: 'CloudWatch', component: _components.CloudWatchTab, badge: null },
        {
            id: 'redis-overview',
            icon: Droplets,
            label: 'Redis Overview',
            component: _components.RedisOverview,
            badge: 'ENT',
        },
        {
            id: 'elasticsearch-overview',
            icon: Search,
            label: 'Elasticsearch Overview',
            component: _components.ElasticsearchOverview,
            badge: 'ENT',
        },
        {
            id: 'anomaly-detectors',
            icon: ActivityIcon,
            label: 'Anomaly Detectors',
            component: _components.DetectorPicker,
            badge: 'ENT',
        },
        {
            id: 'log-patterns',
            icon: FileSearch,
            label: 'Log Pattern Analysis',
            component: _components.LogPatternAnalysisTab,
            badge: null,
        },
        {
            id: 'opentelemetry',
            icon: Radar,
            label: 'OpenTelemetry',
            component: _components.OpenTelemetryTab,
            badge: null,
        },
        {
            id: 'wait-events',
            icon: Clock,
            label: 'Wait Events',
            component: _components.WaitEventsTab,
            badge: null,
        },
        {
            id: 'trace-correlation',
            icon: Workflow,
            label: 'Trace Correlation',
            component: _components.TraceCorrelationTab,
            badge: null,
        },
        {
            id: 'cloud-insights',
            icon: Cloud,
            label: 'Cloud Insights',
            component: _components.CloudInsightsTab,
            badge: null,
        },
        { id: 'kubernetes', icon: Container, label: 'Kubernetes', component: _components.KubernetesTab, badge: null },
        { id: 'status-page', icon: Globe, label: 'Status Page', component: _components.StatusPageTab, badge: null },
        {
            id: 'sdk-dashboard',
            icon: Blocks,
            label: 'SDK Integration',
            component: _components.SDKDashboardTab,
            badge: null,
        },
        {
            id: 'ai-monitoring',
            icon: Brain,
            label: 'AI Monitoring',
            component: _components.AIMonitoringTab,
            badge: null,
        },

        // ── Developer Tools ──────────────────────────────────────────
        { section: 'Developer Tools', accent: DS.violet },
        { id: 'sql', icon: Terminal, label: 'SQL Console', component: _components.SqlConsoleTab, badge: null },
        {
            id: 'engine-console',
            icon: Terminal,
            label: 'Engine Console',
            component: _components.EngineConsoleTab,
            badge: 'new',
        },
        { id: 'api', icon: Cpu, label: 'API Tracing', component: _components.ApiQueriesTab, badge: null },
        { id: 'repository', icon: GitBranch, label: 'Repository', component: _components.RepositoryTab, badge: null },
        {
            id: 'ai-advisor',
            icon: Brain,
            label: 'AI Query Advisor',
            component: _components.AIQueryAdvisorTab,
            badge: null,
        },

        // ── MySQL ────────────────────────────────────────────────────
        { section: 'MySQL', accent: DS.amber },
        {
            id: 'mysql-overview',
            icon: Database,
            label: 'MySQL Overview',
            component: _components.MySQLOverviewTab,
            badge: null,
        },
        {
            id: 'mysql-performance',
            icon: Gauge,
            label: 'MySQL Performance',
            component: _components.MySQLPerformanceTab,
            badge: null,
        },
        {
            id: 'mysql-replication',
            icon: GitMerge,
            label: 'MySQL Replication',
            component: _components.MySQLReplicationTab,
            badge: null,
        },

        // ── MongoDB ──────────────────────────────────────────────────
        { section: 'MongoDB', accent: DS.emerald },
        {
            id: 'mongo-overview',
            icon: Database,
            label: 'Mongo Overview',
            component: _components.MongoOverviewTab,
            badge: null,
        },
        {
            id: 'mongo-performance',
            icon: Gauge,
            label: 'Mongo Performance',
            component: _components.MongoPerformanceTab,
            badge: null,
        },
        {
            id: 'mongo-storage',
            icon: HardDriveDownload,
            label: 'Mongo Storage',
            component: _components.MongoStorageTab,
            badge: null,
        },
        {
            id: 'mongo-replication',
            icon: GitMerge,
            label: 'Mongo Replication',
            component: _components.MongoReplicationTab,
            badge: null,
        },
        {
            id: 'mongo-data-tools',
            icon: Workflow,
            label: 'Mongo Data Tools',
            component: _components.MongoDataToolsTab,
            badge: null,
        },
        {
            id: 'mongo-sharding',
            icon: Server,
            label: 'Mongo Sharding',
            component: _components.MongoShardingTab,
            badge: null,
        },

        // ── Admin ────────────────────────────────────────────────────
        { section: 'Admin', accent: DS.rose },
        {
            id: 'tasks',
            icon: CalendarCheck,
            label: 'DBA Task Scheduler',
            component: _components.DBATaskSchedulerTab,
            badge: null,
        },
        { id: 'admin', icon: Shield, label: 'Admin Panel', component: _components.AdminTab, badge: null },
        {
            id: 'notifier-settings',
            icon: Bell,
            label: 'Notifier Settings',
            component: _components.NotifierSettings,
            badge: 'ENT',
        },
        {
            id: 'retention',
            icon: Clock,
            label: 'Data Retention',
            component: _components.RetentionManagementTab,
            badge: null,
        },
        {
            id: 'report-builder',
            icon: FileText,
            label: 'Report Builder',
            component: _components.ReportBuilderTab,
            badge: null,
        },
        {
            id: 'terraform',
            icon: Download,
            label: 'Terraform Export',
            component: _components.TerraformExportTab,
            badge: null,
        },
        {
            id: 'custom-dashboard',
            icon: LayoutDashboard,
            label: 'Custom Dashboards',
            component: _components.CustomDashboardTab,
            badge: null,
        },
        {
            id: 'marketplace',
            icon: Store,
            label: 'Plugin Marketplace',
            component: _components.Marketplace,
            badge: null,
        },

        // ── User Management (rendered in sidebar footer, not in scrollable list) ──
        { section: 'User Management', accent: DS.indigo || DS.violet, hidden: true },
        {
            id: 'UserManagement',
            icon: Users,
            label: 'Users & Roles',
            component: _components.UserManagementTab,
            badge: null,
        },
        {
            id: 'user-audit',
            icon: FileText,
            label: 'Audit & Security',
            component: _components.AuditAndSecurityTab,
            badge: null,
        },

        // ── Demo (rendered in sidebar footer, not in scrollable list) ──
        { section: 'Demo', accent: DS.amber, hidden: true },
        {
            id: 'demo-postgres',
            icon: Database,
            label: 'PostgreSQL Demo',
            component: _components.DemoPostgresTab,
            badge: null,
        },
        { id: 'demo-mysql', icon: Database, label: 'MySQL Demo', component: _components.DemoMySQLTab, badge: null },
        {
            id: 'demo-mongodb',
            icon: Database,
            label: 'MongoDB Demo',
            component: _components.DemoMongoDBTab,
            badge: null,
        },
        // Phase-5 engine demos — generic DemoEngineTab pre-bound to an engine.
        {
            id: 'demo-mssql',
            icon: Database,
            label: 'SQL Server Demo',
            component: _components.DemoMSSQLTab,
            badge: 'full',
        },
        {
            id: 'demo-oracle',
            icon: Database,
            label: 'Oracle Demo',
            component: _components.DemoOracleTab,
            badge: 'full',
        },
        { id: 'demo-redis', icon: Database, label: 'Redis Demo', component: _components.DemoRedisTab, badge: 'full' },
        {
            id: 'demo-elasticsearch',
            icon: Database,
            label: 'Elasticsearch Demo',
            component: _components.DemoElasticTab,
            badge: 'full',
        },
        {
            id: 'demo-snowflake',
            icon: Database,
            label: 'Snowflake Demo',
            component: _components.DemoSnowflakeTab,
            badge: 'full',
        },
        {
            id: 'demo-bigquery',
            icon: Database,
            label: 'BigQuery Demo',
            component: _components.DemoBigQueryTab,
            badge: 'full',
        },
        {
            id: 'demo-redshift',
            icon: Database,
            label: 'Redshift Demo',
            component: _components.DemoRedshiftTab,
            badge: 'full',
        },
        {
            id: 'demo-cassandra',
            icon: Database,
            label: 'Cassandra Demo',
            component: _components.DemoCassandraTab,
            badge: 'full',
        },
        {
            id: 'demo-dynamodb',
            icon: Database,
            label: 'DynamoDB Demo',
            component: _components.DemoDynamoDBTab,
            badge: 'full',
        },
    ];
}

export function getTabsOnly(config) {
    return config.filter((t) => t.id);
}

export function getSectionGroups(config) {
    const groups = [];
    let current = null;
    for (const item of config) {
        if (item.section) {
            current = {
                section: item.section,
                tabs: [],
                accent: item.accent || getDS().cyan,
                hidden: item.hidden || false,
            };
            if (item.group) current.group = item.group;
            groups.push(current);
        } else if (current) {
            current.tabs.push(item);
        }
    }
    // Filter out hidden sections (rendered elsewhere, e.g. sidebar footer)
    return groups.filter((g) => !g.hidden);
}

export function getSectionForTab(groups, tabId) {
    for (const g of groups) {
        if (g.tabs.some((t) => t.id === tabId)) return g.section;
    }
    return null;
}

export function getSectionAccent(groups, tabId) {
    for (const g of groups) {
        if (g.tabs.some((t) => t.id === tabId)) return g.accent;
    }
    return getDS().cyan;
}

export const STORAGE_KEYS = {
    ACTIVE_TAB: 'pg_monitor_active_tab',
    SIDEBAR_COLLAPSED: 'pg_monitor_sidebar_collapsed',
    NOTIFICATIONS_DISMISSED: 'pg_monitor_notifications_dismissed',
    FEEDBACK_PROMPT: 'pg_monitor_feedback_prompt_shown',
};
