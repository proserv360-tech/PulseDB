// Lazy-loaded tab components and the tab/section configuration built from them.
// Extracted from App.tsx.
import { DS } from '../config/designTokens';
import { buildTabConfig, getSectionGroups, getTabsOnly, registerComponents } from '../config/tabConfig';
import { lazyRetry } from './lazyRetry';

export const SSOCallback = lazyRetry(() => import('../components/auth/SSOCallback'));

/* ── Lazy-loaded tab components for faster initial load ── */
// Monitoring features
const OverviewTab = lazyRetry(() => import('../components/views/monitoring/OverviewTab'));
const PerformanceTab = lazyRetry(() => import('../components/views/monitoring/PerformanceTab'));
const ResourcesTab = lazyRetry(() => import('../components/views/monitoring/ResourcesTab'));
const CloudWatchTab = lazyRetry(() => import('../components/views/monitoring/CloudWatchTab'));
const CheckpointMonitorTab = lazyRetry(() => import('../components/views/monitoring/CheckpointMonitorTab'));

// Security features
const SecurityComplianceTab = lazyRetry(() => import('../components/views/security/SecurityComplianceTab'));
const AlertsComponent = lazyRetry(() => import('../components/views/security/AlertsTab'));
const IncidentsTab = lazyRetry(() => import('../components/views/security/IncidentsTab'));
const AlertCorrelationTab = lazyRetry(() => import('../components/views/security/AlertCorrelationTab'));

// Database features
const IndexesTab = lazyRetry(() => import('../components/views/database/IndexesTab'));
const SqlConsoleTab = lazyRetry(() => import('../components/views/database/SqlConsoleTab'));
const BloatAnalysisTab = lazyRetry(() => import('../components/views/database/BloatAnalysisTab'));
const TableAnalytics = lazyRetry(() => import('../components/views/database/TableAnalytics'));
const QueryOptimizerTab = lazyRetry(() => import('../components/views/database/QueryOptimizerTab'));
const QueryPlanRegressionTab = lazyRetry(() => import('../components/views/database/QueryPlanRegressionTab'));
const SchemaVersioningTab = lazyRetry(() => import('../components/views/database/SchemaVersioningTab'));
const TableDependencyMindMap = lazyRetry(() => import('../components/views/database/TableDependencyMindMap'));

// Operations features
const BackupRecoveryTab = lazyRetry(() => import('../components/views/operations/BackupRecoveryTab'));
const VacuumMaintenanceTab = lazyRetry(() => import('../components/views/operations/VacuumMaintenanceTab'));
const DBATaskSchedulerTab = lazyRetry(() => import('../components/views/operations/DBATaskSchedulerTab'));
const ReplicationWALTab = lazyRetry(() => import('../components/views/operations/ReplicationWALTab'));
const ConnectionPoolTab = lazyRetry(() => import('../components/views/operations/ConnectionPoolTab'));

// Analytics features
const CapacityPlanningTab = lazyRetry(() => import('../components/views/analytics/CapacityPlanningTab'));
const LogPatternAnalysisTab = lazyRetry(() => import('../components/views/analytics/LogPatternAnalysisTab'));
const CustomDashboardTab = lazyRetry(() => import('../components/views/analytics/CustomDashboardTab'));
/* Demo data components removed — production metrics now served via metricsRegistry.js */

// Admin features
const AdminTab = lazyRetry(() => import('../components/views/admin/AdminTab'));
const RepositoryTab = lazyRetry(() => import('../components/views/admin/RepositoryTab'));
const ApiQueriesTab = lazyRetry(() => import('../components/views/admin/ApiQueriesTab'));
const RetentionManagementTab = lazyRetry(() => import('../components/views/admin/RetentionManagementTab'));
const TerraformExportTab = lazyRetry(() => import('../components/views/admin/TerraformExportTab'));
const ReportBuilderTab = lazyRetry(() => import('../components/views/admin/ReportBuilderTab'));
const Marketplace = lazyRetry(() => import('../pages/Marketplace'));

// Gap features — Monitoring
const OpenTelemetryTab = lazyRetry(() => import('../components/views/monitoring/OpenTelemetryTab'));
const WaitEventsTab = lazyRetry(() => import('../components/views/observability/WaitEventsTab'));
const TraceCorrelationTab = lazyRetry(() => import('../components/views/observability/TraceCorrelationTab'));
const CloudInsightsTab = lazyRetry(() => import('../components/views/observability/CloudInsightsTab'));
const KubernetesTab = lazyRetry(() => import('../components/views/monitoring/KubernetesTab'));
const StatusPageTab = lazyRetry(() => import('../components/views/monitoring/StatusPageTab'));
const AIMonitoringTab = lazyRetry(() => import('../components/views/monitoring/AIMonitoringTab'));
const AgentAdvisorTab = lazyRetry(() => import('../components/views/monitoring/AgentAdvisorTab'));
const ObservabilityHub = lazyRetry(() => import('../components/views/monitoring/ObservabilityHub'));
const SDKDashboardTab = lazyRetry(() => import('../components/views/monitoring/SDKDashboardTab'));

// Gap features — Database
const AIQueryAdvisorTab = lazyRetry(() => import('../components/views/database/AIQueryAdvisorTab'));

// MySQL features
const MySQLOverviewTab = lazyRetry(() => import('../components/views/mysql/MySQLOverviewTab'));
const MySQLPerformanceTab = lazyRetry(() => import('../components/views/mysql/MySQLPerformanceTab'));
const MySQLReplicationTab = lazyRetry(() => import('../components/views/mysql/MySQLReplicationTab'));

// MongoDB features
const MongoOverviewTab = lazyRetry(() => import('../components/views/mongodb/MongoOverviewTab'));
const MongoPerformanceTab = lazyRetry(() => import('../components/views/mongodb/MongoPerformanceTab'));
const MongoStorageTab = lazyRetry(() => import('../components/views/mongodb/MongoStorageTab'));
const MongoReplicationTab = lazyRetry(() => import('../components/views/mongodb/MongoReplicationTab'));
const MongoDataToolsTab = lazyRetry(() => import('../components/views/mongodb/MongoDataToolsTab'));
const MongoShardingTab = lazyRetry(() => import('../components/views/mongodb/MongoShardingTab'));

// Unified engine command console (Redis / Cassandra / DynamoDB / SQL engines)
const EngineConsoleTab = lazyRetry(() => import('../components/views/console/EngineConsoleTab'));

// Demo
const DemoPostgresTab = lazyRetry(() => import('../components/views/demo/DemoPostgresTab'));
const DemoMySQLTab = lazyRetry(() => import('../components/views/demo/DemoMySQLTab'));
const DemoMongoDBTab = lazyRetry(() => import('../components/views/demo/DemoMongoDBTab'));
// Phase-5 engine demos (single component driven by engine key)
const DemoEngineTab = lazyRetry(() => import('../components/views/demo/DemoEngineTab'));
// Per-engine wrappers so each demo tab has its own entry in the sidebar.
// SQL Server gets a dedicated bespoke tab — Query Store, wait stats donut,
// Always-On replica graph, deadlock graph viewer, missing-index advisor.
const DemoMSSQLTab = lazyRetry(() => import('../components/views/demo/DemoMSSQLFullTab'));
// Oracle gets a dedicated bespoke tab — ASH, Top SQL, AWR snapshot browser,
// Data Guard health, v$waits, tablespace usage, v$lock blocking tree.
const DemoOracleTab = lazyRetry(() => import('../components/views/demo/DemoOracleFullTab'));
// Redis gets a dedicated bespoke tab — memory-by-pattern treemap, slowlog
// replayer, keyspace heatmap, LATENCY LATEST events, client list, config.
const DemoRedisTab = lazyRetry(() => import('../components/views/demo/DemoRedisFullTab'));
// Elasticsearch gets a dedicated bespoke tab — shard allocation, hot threads,
// ILM phase visualizer, index rollover, cluster health, search profiler.
const DemoElasticTab = lazyRetry(() => import('../components/views/demo/DemoElasticFullTab'));
// Snowflake gets a dedicated bespoke tab — credits explorer, warehouse
// recommender, clustering depth, query history, storage treemap, replication.
const DemoSnowflakeTab = lazyRetry(() => import('../components/views/demo/DemoSnowflakeFullTab'));
// BigQuery gets a dedicated bespoke tab — slot heatmap, dry-run cost
// estimator, per-stage job drilldown, partition pruning viewer, etc.
const DemoBigQueryTab = lazyRetry(() => import('../components/views/demo/DemoBigQueryFullTab'));
// Redshift gets a dedicated bespoke tab — WLM queue tuner, vacuum scheduler,
// distribution-skew analyzer, per-node resources, STL_QUERY + STV_LOCKS.
const DemoRedshiftTab = lazyRetry(() => import('../components/views/demo/DemoRedshiftFullTab'));
// Cassandra gets a dedicated bespoke tab — ring topology with token ownership,
// compactions, hinted-handoff tracker, keyspace replication, slow queries, MVs.
const DemoCassandraTab = lazyRetry(() => import('../components/views/demo/DemoCassandraFullTab'));
// DynamoDB gets a dedicated bespoke tab — capacity-mode recommender with
// cost analysis, hot-partition heatmap, Global Tables graph, CloudWatch bridge,
// TTL monitor, Streams consumer lag.
const DemoDynamoDBTab = lazyRetry(() => import('../components/views/demo/DemoDynamoDBFullTab'));

// Other
const ReliabilityTab = lazyRetry(() => import('../components/views/ReliabilityTab'));
const UserManagementTab = lazyRetry(() => import('../usermanagement/UserManagementTab'));
const AuditAndSecurityTab = lazyRetry(() => import('../usermanagement/AuditAndSecurityTab'));

// Phase 1 — Connection Onboarding
export const ConnectionWizard = lazyRetry(() => import('../components/views/onboarding/ConnectionWizard'));

// Phase 2 — Multi-DB Fleet Dashboard
const FleetOverviewTab = lazyRetry(() => import('../components/views/monitoring/FleetOverviewTab'));

// Phase 3 — Visualization Layer
const QueryPlanViewer = lazyRetry(() => import('../components/views/database/QueryPlanViewer'));
const ChartBuilder = lazyRetry(() => import('../components/views/database/ChartBuilder'));

// Phase 4 — Monitoring & Reliability
const AlertRuleEditor = lazyRetry(() => import('../components/views/monitoring/AlertRuleEditor'));
const PoolMetricsDashboard = lazyRetry(() => import('../components/views/monitoring/PoolMetricsDashboard'));

// Layout — Enhanced Connection Switcher (replaces inline ConnectionSelector)
export const ConnectionSwitcherLazy = lazyRetry(() => import('../components/layout/ConnectionSwitcher'));
export const DatabaseSwitcherLazy = lazyRetry(() => import('../components/layout/DatabaseSwitcher'));

// Enterprise edition
const LicenseManagement = lazyRetry(() => import('../enterprise/views/LicenseManagement'));
const OrgManagement = lazyRetry(() => import('../enterprise/views/OrgManagement'));

// Enterprise admin surfaces (notifiers, Redis/ES, anomaly detectors, trace detail)
const NotifierSettings = lazyRetry(() => import('../enterprise/views/NotifierSettings'));
const RedisOverview = lazyRetry(() => import('../enterprise/views/RedisOverview'));
const ElasticsearchOverview = lazyRetry(() => import('../enterprise/views/ElasticsearchOverview'));
const DetectorPicker = lazyRetry(() => import('../enterprise/views/DetectorPicker'));
const TraceDetail = lazyRetry(() => import('../enterprise/views/TraceDetail'));

/* ── Observability Hub section wrappers (deep-linked sidebar tabs) ── */
const ObsHub_all = () => <ObservabilityHub initialSection="overview" hideSidebar />;
const ObsHub_overview = () => <ObservabilityHub initialSection="overview" hideSidebar />;
const ObsHub_api = () => <ObservabilityHub initialSection="api" hideSidebar />;
const ObsHub_exceptions = () => <ObservabilityHub initialSection="exceptions" hideSidebar />;
const ObsHub_uptime = () => <ObservabilityHub initialSection="uptime" hideSidebar />;
const ObsHub_audit = () => <ObservabilityHub initialSection="audit" hideSidebar />;
const ObsHub_jobs = () => <ObservabilityHub initialSection="jobs" hideSidebar />;
const ObsHub_slo = () => <ObservabilityHub initialSection="slo" hideSidebar />;
const ObsHub_alerts = () => <ObservabilityHub initialSection="alerts" hideSidebar />;
const ObsHub_logs = () => <ObservabilityHub initialSection="logs" hideSidebar />;
const ObsHub_infra = () => <ObservabilityHub initialSection="infra" hideSidebar />;
const ObsHub_topology = () => <ObservabilityHub initialSection="topology" hideSidebar />;
const ObsHub_ai = () => <ObservabilityHub initialSection="ai" hideSidebar />;
const ObsHub_cost = () => <ObservabilityHub initialSection="cost" hideSidebar />;
const ObsHub_traces = () => <ObservabilityHub initialSection="traces" hideSidebar />;

/* ── Register lazy-loaded components with tabConfig ── */
registerComponents({
    AgentAdvisorTab,
    OverviewTab,
    PerformanceTab,
    ResourcesTab,
    ReliabilityTab,
    AlertsComponent,
    IncidentsTab,
    QueryOptimizerTab,
    IndexesTab,
    QueryPlanRegressionTab,
    BloatAnalysisTab,
    TableAnalytics,
    ConnectionPoolTab,
    ReplicationWALTab,
    CheckpointMonitorTab,
    VacuumMaintenanceTab,
    CapacityPlanningTab,
    BackupRecoveryTab,
    SchemaVersioningTab,
    TableDependencyMindMap,
    SecurityComplianceTab,
    CloudWatchTab,
    LogPatternAnalysisTab,
    AlertCorrelationTab,
    OpenTelemetryTab,
    WaitEventsTab,
    TraceCorrelationTab,
    CloudInsightsTab,
    KubernetesTab,
    StatusPageTab,
    AIMonitoringTab,
    ObservabilityHub,
    ObsHub_all,
    ObsHub_overview,
    ObsHub_api,
    ObsHub_exceptions,
    ObsHub_uptime,
    ObsHub_audit,
    ObsHub_jobs,
    ObsHub_slo,
    ObsHub_alerts,
    ObsHub_logs,
    ObsHub_infra,
    ObsHub_topology,
    ObsHub_ai,
    ObsHub_cost,
    ObsHub_traces,
    SDKDashboardTab,
    SqlConsoleTab,
    ApiQueriesTab,
    RepositoryTab,
    AIQueryAdvisorTab,
    DBATaskSchedulerTab,
    UserManagementTab,
    AuditAndSecurityTab,
    AdminTab,
    RetentionManagementTab,
    TerraformExportTab,
    ReportBuilderTab,
    CustomDashboardTab,
    MySQLOverviewTab,
    MySQLPerformanceTab,
    MySQLReplicationTab,
    MongoOverviewTab,
    MongoPerformanceTab,
    MongoStorageTab,
    MongoReplicationTab,
    MongoDataToolsTab,
    MongoShardingTab,
    DemoPostgresTab,
    DemoMySQLTab,
    DemoMongoDBTab,
    EngineConsoleTab,
    // Phase-5 engine demos
    DemoMSSQLTab,
    DemoOracleTab,
    DemoRedisTab,
    DemoElasticTab,
    DemoSnowflakeTab,
    DemoBigQueryTab,
    DemoRedshiftTab,
    DemoCassandraTab,
    DemoDynamoDBTab,
    // Phase 1–4 new components
    FleetOverviewTab,
    ConnectionWizard,
    QueryPlanViewer,
    ChartBuilder,
    AlertRuleEditor,
    PoolMetricsDashboard,
    // Enterprise admin surfaces
    NotifierSettings,
    RedisOverview,
    ElasticsearchOverview,
    DetectorPicker,
    TraceDetail,
    Marketplace,
    // Enterprise (uncomment when ready): LicenseManagement, OrgManagement,
});

export const TAB_CONFIG = buildTabConfig();
export const TABS_ONLY = getTabsOnly(TAB_CONFIG);
export const SECTION_GROUPS = getSectionGroups(TAB_CONFIG);

// Map each Phase-5 dbType to the bespoke demo tab it should land on when
// a connection of that type becomes active (or is newly created). Classic
// engines (postgresql/mysql/mongodb) have their own overview screens and
// are handled inline in the navigation effects below.
export const PHASE5_DEMO_TABS: Record<string, string> = {
    mssql: 'demo-mssql',
    oracle: 'demo-oracle',
    redis: 'demo-redis',
    elasticsearch: 'demo-elasticsearch',
    snowflake: 'demo-snowflake',
    bigquery: 'demo-bigquery',
    redshift: 'demo-redshift',
    cassandra: 'demo-cassandra',
    dynamodb: 'demo-dynamodb',
};

export const getSectionForTab = (tabId) => {
    for (const g of SECTION_GROUPS) {
        if (g.tabs.some((t) => t.id === tabId)) return g.section;
    }
    return null;
};

export const getGroupForTab = () => null;

export const getSectionAccent = (tabId) => {
    for (const g of SECTION_GROUPS) {
        if (g.tabs.some((t) => t.id === tabId)) return g.accent;
    }
    return DS.cyan;
};
