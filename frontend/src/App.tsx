import React, { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { ConnectionProvider, useConnection } from './context/ConnectionContext';
import { NavigationContext } from './context/NavigationContext';
import { DemoProvider, useDemo, DEMO_USER } from './context/DemoContext';
import { THEME, ChartDefs, useAdaptiveTheme } from './utils/theme';
import { connectWS, postData } from './utils/api';
import { DS_DARK, DS_LIGHT, DS_ACCENTS, setDS, getDS } from './config/designTokens';
import { registerComponents, buildTabConfig, getTabsOnly, getSectionGroups, STORAGE_KEYS } from './config/tabConfig';

import LoginPage from './components/auth/LoginPage';
import LandingPage from './pages/LandingPage';
import ForcePasswordChangeModal from './components/auth/ForcePasswordChangeModal';
import { ToastProvider, useToast, Breadcrumbs, ProgressBar } from './components/ui/SharedComponents';

// Enterprise context providers and components
import { LicenseProvider } from './enterprise/context/LicenseContext';
import { OrgProvider } from './enterprise/context/OrgContext';
import LicenseGate from './enterprise/components/LicenseGate';
import LicenseStatus from './enterprise/components/LicenseStatus';
import OrgSwitcher from './enterprise/components/OrgSwitcher';

/* ── Retry wrapper for lazy imports (handles stale chunk hashes after deploy) ── */
const lazyRetry = (importFn) =>
    lazy(() =>
        importFn().catch((err) => {
            // Chunk fetch failed (likely stale hash after deploy) — force-reload once
            const key = 'fathom_chunk_retry';
            try {
                if (!sessionStorage.getItem(key)) {
                    sessionStorage.setItem(key, '1');
                    window.location.reload();
                    return new Promise(() => {}); // hang while reloading
                }
                sessionStorage.removeItem(key);
            } catch {
                /* sessionStorage unavailable — fall through */
            }
            // second attempt with cache-bust
            return importFn().catch(() => {
                // final fallback: hard reload with cache-bust query
                window.location.href = window.location.pathname + '?cb=' + Date.now();
                return new Promise(() => {});
            });
        }),
    );

const SSOCallback = lazyRetry(() => import('./components/auth/SSOCallback'));

/* ── Lazy-loaded tab components for faster initial load ── */
// Monitoring features
const OverviewTab = lazyRetry(() => import('./components/views/monitoring/OverviewTab'));
const PerformanceTab = lazyRetry(() => import('./components/views/monitoring/PerformanceTab'));
const ResourcesTab = lazyRetry(() => import('./components/views/monitoring/ResourcesTab'));
const CloudWatchTab = lazyRetry(() => import('./components/views/monitoring/CloudWatchTab'));
const CheckpointMonitorTab = lazyRetry(() => import('./components/views/monitoring/CheckpointMonitorTab'));

// Security features
const SecurityComplianceTab = lazyRetry(() => import('./components/views/security/SecurityComplianceTab'));
const AlertsComponent = lazyRetry(() => import('./components/views/security/AlertsTab'));
const IncidentsTab = lazyRetry(() => import('./components/views/security/IncidentsTab'));
const AlertCorrelationTab = lazyRetry(() => import('./components/views/security/AlertCorrelationTab'));

// Database features
const IndexesTab = lazyRetry(() => import('./components/views/database/IndexesTab'));
const SqlConsoleTab = lazyRetry(() => import('./components/views/database/SqlConsoleTab'));
const BloatAnalysisTab = lazyRetry(() => import('./components/views/database/BloatAnalysisTab'));
const TableAnalytics = lazyRetry(() => import('./components/views/database/TableAnalytics'));
const QueryOptimizerTab = lazyRetry(() => import('./components/views/database/QueryOptimizerTab'));
const QueryPlanRegressionTab = lazyRetry(() => import('./components/views/database/QueryPlanRegressionTab'));
const SchemaVersioningTab = lazyRetry(() => import('./components/views/database/SchemaVersioningTab'));
const TableDependencyMindMap = lazyRetry(() => import('./components/views/database/TableDependencyMindMap'));

// Operations features
const BackupRecoveryTab = lazyRetry(() => import('./components/views/operations/BackupRecoveryTab'));
const VacuumMaintenanceTab = lazyRetry(() => import('./components/views/operations/VacuumMaintenanceTab'));
const DBATaskSchedulerTab = lazyRetry(() => import('./components/views/operations/DBATaskSchedulerTab'));
const ReplicationWALTab = lazyRetry(() => import('./components/views/operations/ReplicationWALTab'));
const ConnectionPoolTab = lazyRetry(() => import('./components/views/operations/ConnectionPoolTab'));

// Analytics features
const CapacityPlanningTab = lazyRetry(() => import('./components/views/analytics/CapacityPlanningTab'));
const LogPatternAnalysisTab = lazyRetry(() => import('./components/views/analytics/LogPatternAnalysisTab'));
const CustomDashboardTab = lazyRetry(() => import('./components/views/analytics/CustomDashboardTab'));
/* Demo data components removed — production metrics now served via metricsRegistry.js */

// Admin features
const AdminTab = lazyRetry(() => import('./components/views/admin/AdminTab'));
const RepositoryTab = lazyRetry(() => import('./components/views/admin/RepositoryTab'));
const ApiQueriesTab = lazyRetry(() => import('./components/views/admin/ApiQueriesTab'));
const RetentionManagementTab = lazyRetry(() => import('./components/views/admin/RetentionManagementTab'));
const TerraformExportTab = lazyRetry(() => import('./components/views/admin/TerraformExportTab'));
const ReportBuilderTab = lazyRetry(() => import('./components/views/admin/ReportBuilderTab'));
const Marketplace = lazyRetry(() => import('./pages/Marketplace'));

// Gap features — Monitoring
const OpenTelemetryTab = lazyRetry(() => import('./components/views/monitoring/OpenTelemetryTab'));
const WaitEventsTab = lazyRetry(() => import('./components/views/observability/WaitEventsTab'));
const TraceCorrelationTab = lazyRetry(() => import('./components/views/observability/TraceCorrelationTab'));
const CloudInsightsTab = lazyRetry(() => import('./components/views/observability/CloudInsightsTab'));
const KubernetesTab = lazyRetry(() => import('./components/views/monitoring/KubernetesTab'));
const StatusPageTab = lazyRetry(() => import('./components/views/monitoring/StatusPageTab'));
const AIMonitoringTab = lazyRetry(() => import('./components/views/monitoring/AIMonitoringTab'));
const AgentAdvisorTab = lazyRetry(() => import('./components/views/monitoring/AgentAdvisorTab'));
const ObservabilityHub = lazyRetry(() => import('./components/views/monitoring/ObservabilityHub'));
const SDKDashboardTab = lazyRetry(() => import('./components/views/monitoring/SDKDashboardTab'));

// Gap features — Database
const AIQueryAdvisorTab = lazyRetry(() => import('./components/views/database/AIQueryAdvisorTab'));

// MySQL features
const MySQLOverviewTab = lazyRetry(() => import('./components/views/mysql/MySQLOverviewTab'));
const MySQLPerformanceTab = lazyRetry(() => import('./components/views/mysql/MySQLPerformanceTab'));
const MySQLReplicationTab = lazyRetry(() => import('./components/views/mysql/MySQLReplicationTab'));

// MongoDB features
const MongoOverviewTab = lazyRetry(() => import('./components/views/mongodb/MongoOverviewTab'));
const MongoPerformanceTab = lazyRetry(() => import('./components/views/mongodb/MongoPerformanceTab'));
const MongoStorageTab = lazyRetry(() => import('./components/views/mongodb/MongoStorageTab'));
const MongoReplicationTab = lazyRetry(() => import('./components/views/mongodb/MongoReplicationTab'));
const MongoDataToolsTab = lazyRetry(() => import('./components/views/mongodb/MongoDataToolsTab'));
const MongoShardingTab = lazyRetry(() => import('./components/views/mongodb/MongoShardingTab'));

// Unified engine command console (Redis / Cassandra / DynamoDB / SQL engines)
const EngineConsoleTab = lazyRetry(() => import('./components/views/console/EngineConsoleTab'));

// Demo
const DemoPostgresTab = lazyRetry(() => import('./components/views/demo/DemoPostgresTab'));
const DemoMySQLTab = lazyRetry(() => import('./components/views/demo/DemoMySQLTab'));
const DemoMongoDBTab = lazyRetry(() => import('./components/views/demo/DemoMongoDBTab'));
// Phase-5 engine demos (single component driven by engine key)
const DemoEngineTab = lazyRetry(() => import('./components/views/demo/DemoEngineTab'));
// Per-engine wrappers so each demo tab has its own entry in the sidebar.
// SQL Server gets a dedicated bespoke tab — Query Store, wait stats donut,
// Always-On replica graph, deadlock graph viewer, missing-index advisor.
const DemoMSSQLTab = lazyRetry(() => import('./components/views/demo/DemoMSSQLFullTab'));
// Oracle gets a dedicated bespoke tab — ASH, Top SQL, AWR snapshot browser,
// Data Guard health, v$waits, tablespace usage, v$lock blocking tree.
const DemoOracleTab = lazyRetry(() => import('./components/views/demo/DemoOracleFullTab'));
// Redis gets a dedicated bespoke tab — memory-by-pattern treemap, slowlog
// replayer, keyspace heatmap, LATENCY LATEST events, client list, config.
const DemoRedisTab = lazyRetry(() => import('./components/views/demo/DemoRedisFullTab'));
// Elasticsearch gets a dedicated bespoke tab — shard allocation, hot threads,
// ILM phase visualizer, index rollover, cluster health, search profiler.
const DemoElasticTab = lazyRetry(() => import('./components/views/demo/DemoElasticFullTab'));
// Snowflake gets a dedicated bespoke tab — credits explorer, warehouse
// recommender, clustering depth, query history, storage treemap, replication.
const DemoSnowflakeTab = lazyRetry(() => import('./components/views/demo/DemoSnowflakeFullTab'));
// BigQuery gets a dedicated bespoke tab — slot heatmap, dry-run cost
// estimator, per-stage job drilldown, partition pruning viewer, etc.
const DemoBigQueryTab = lazyRetry(() => import('./components/views/demo/DemoBigQueryFullTab'));
// Redshift gets a dedicated bespoke tab — WLM queue tuner, vacuum scheduler,
// distribution-skew analyzer, per-node resources, STL_QUERY + STV_LOCKS.
const DemoRedshiftTab = lazyRetry(() => import('./components/views/demo/DemoRedshiftFullTab'));
// Cassandra gets a dedicated bespoke tab — ring topology with token ownership,
// compactions, hinted-handoff tracker, keyspace replication, slow queries, MVs.
const DemoCassandraTab = lazyRetry(() => import('./components/views/demo/DemoCassandraFullTab'));
// DynamoDB gets a dedicated bespoke tab — capacity-mode recommender with
// cost analysis, hot-partition heatmap, Global Tables graph, CloudWatch bridge,
// TTL monitor, Streams consumer lag.
const DemoDynamoDBTab = lazyRetry(() => import('./components/views/demo/DemoDynamoDBFullTab'));

// Other
const ReliabilityTab = lazyRetry(() => import('./components/views/ReliabilityTab'));
const UserManagementTab = lazyRetry(() => import('./usermanagement/UserManagementTab'));
const AuditAndSecurityTab = lazyRetry(() => import('./usermanagement/AuditAndSecurityTab'));

// Phase 1 — Connection Onboarding
const ConnectionWizard = lazyRetry(() => import('./components/views/onboarding/ConnectionWizard'));

// Phase 2 — Multi-DB Fleet Dashboard
const FleetOverviewTab = lazyRetry(() => import('./components/views/monitoring/FleetOverviewTab'));

// Phase 3 — Visualization Layer
const QueryPlanViewer = lazyRetry(() => import('./components/views/database/QueryPlanViewer'));
const ChartBuilder = lazyRetry(() => import('./components/views/database/ChartBuilder'));

// Phase 4 — Monitoring & Reliability
const AlertRuleEditor = lazyRetry(() => import('./components/views/monitoring/AlertRuleEditor'));
const PoolMetricsDashboard = lazyRetry(() => import('./components/views/monitoring/PoolMetricsDashboard'));

// Layout — Enhanced Connection Switcher (replaces inline ConnectionSelector)
const ConnectionSwitcherLazy = lazyRetry(() => import('./components/layout/ConnectionSwitcher'));
const DatabaseSwitcherLazy = lazyRetry(() => import('./components/layout/DatabaseSwitcher'));

// Shared — Per-section error boundary for graceful tab-level recovery (eager — must be class component)
import SectionErrorBoundary from './components/shared/SectionErrorBoundary';
import CommandPalette from './components/shared/CommandPalette';
import { FeedbackModal } from './components/layout/FeedbackModal';

// Enterprise edition
const LicenseManagement = lazyRetry(() => import('./enterprise/views/LicenseManagement'));
const OrgManagement = lazyRetry(() => import('./enterprise/views/OrgManagement'));

// Enterprise admin surfaces (notifiers, Redis/ES, anomaly detectors, trace detail)
const NotifierSettings = lazyRetry(() => import('./enterprise/views/NotifierSettings'));
const RedisOverview = lazyRetry(() => import('./enterprise/views/RedisOverview'));
const ElasticsearchOverview = lazyRetry(() => import('./enterprise/views/ElasticsearchOverview'));
const DetectorPicker = lazyRetry(() => import('./enterprise/views/DetectorPicker'));
const TraceDetail = lazyRetry(() => import('./enterprise/views/TraceDetail'));

import {
    Activity,
    Zap,
    CheckCircle,
    HardDrive,
    Layers,
    Shield,
    Terminal,
    Network,
    LogOut,
    Database,
    WifiOff,
    Bell,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    AlertCircle,
    X,
    User,
    GitBranch,
    Users,
    TrendingUp,
    MessageSquarePlus,
    Star,
    Send,
    Archive,
    RefreshCw,
    Radio,
    Cloud,
    CalendarCheck,
    FileSearch,
    Link2,
    Cpu,
    BarChart2,
    Lock,
    ThumbsUp,
    Lightbulb,
    AlertTriangle,
    PlusCircle,
    Sun,
    Moon,
    Save,
    Edit2,
    Radar,
    Brain,
    Container,
    LayoutDashboard,
    Globe,
    Download,
    Clock,
} from 'lucide-react';
import { WebSocketStatus, AlertBanner } from './components/ui/SharedComponents';

/* ── Local DS alias — kept in sync with designTokens module by setDS() ── */
let DS = getDS();

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

const TAB_CONFIG = buildTabConfig();
const TABS_ONLY = getTabsOnly(TAB_CONFIG);
const SECTION_GROUPS = getSectionGroups(TAB_CONFIG);

// Map each Phase-5 dbType to the bespoke demo tab it should land on when
// a connection of that type becomes active (or is newly created). Classic
// engines (postgresql/mysql/mongodb) have their own overview screens and
// are handled inline in the navigation effects below.
const PHASE5_DEMO_TABS: Record<string, string> = {
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

const getSectionForTab = (tabId) => {
    for (const g of SECTION_GROUPS) {
        if (g.tabs.some((t) => t.id === tabId)) return g.section;
    }
    return null;
};

const getGroupForTab = () => null;

const getSectionAccent = (tabId) => {
    for (const g of SECTION_GROUPS) {
        if (g.tabs.some((t) => t.id === tabId)) return g.accent;
    }
    return DS.cyan;
};

const WS_RECONNECT_INTERVAL = 5000;
const ALERT_AUTO_DISMISS_TIME = 5000;
const MAX_NOTIFICATIONS = 50;
const AUTH_TOKEN_KEY = 'fathom_token';
const FEEDBACK_RATE_LIMIT_MS = 5 * 60 * 1000; // 5 minutes

/* ─────────────────────────────────────────────────────────────────
   GLOBAL STYLES
   ───────────────────────────────────────────────────────────────── */
const AppStyles = React.memo(() => (
    <style>{`

        *, *::before, *::after { box-sizing: border-box; }

        @keyframes slideIn         { from { transform: translateX(-100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes slideInRight    { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes fadeIn          { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideDown       { from { transform: translateY(-14px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes slideUp         { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes sectionOpen     { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse           { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes bounce          { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
        @keyframes shimmer         { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
        @keyframes subtlePulse      { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; } }
        @keyframes rotate          { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes tabIn           { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes notifPop        { 0% { transform: scale(0.85); opacity: 0; } 80% { transform: scale(1.02); } 100% { transform: scale(1); opacity: 1; } }
        @keyframes badgePop        { 0% { transform: scale(0); } 70% { transform: scale(1.3); } 100% { transform: scale(1); } }
        @keyframes waveFlow        { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
        @keyframes dotBlink        { 0%,100% { opacity: 1; } 50% { opacity: 0.2; } }

        @media (prefers-reduced-motion: reduce) {
            *, *::before, *::after {
                animation-duration: 0.01ms !important;
                animation-iteration-count: 1 !important;
                transition-duration: 0.01ms !important;
            }
        }

        /* ═══ FATHOM — Clean & Refined ═══ */

        /* ── Sidebar ── */
        aside {
            background: ${DS._dark ? THEME.bgAlt : DS.sidebarBg} !important;
            border-right: 1px solid ${DS.sidebarBorder} !important;
            box-shadow: none !important;
        }
        aside::after { display: none; }

        /* ── Header ── */
        header {
            background: ${DS._dark ? THEME.bgAlt : DS.headerBg} !important;
            box-shadow: ${DS._dark ? '0 1px 0 rgba(255,255,255,0.04)' : '0 1px 0 rgba(0,0,0,0.06)'} !important;
        }
        header::after { display: none; }

        /* ── Nav items ── */
        .nav-item {
            transition: all 0.15s ease !important;
            border-radius: 8px !important;
            margin: 1px 0 !important;
        }
        .nav-item:hover {
            background: ${DS._dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'} !important;
        }
        .nav-item[aria-selected="true"] {
            background: ${DS._dark ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.08)'} !important;
        }
        .section-btn {
            transition: all 0.15s ease !important;
            border-radius: 6px !important;
        }
        .section-btn:hover {
            background: ${DS._dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.025)'} !important;
        }

        /* ── Tab content ── */
        .tab-mount {
            animation: tabIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        /* ═══ CARD SYSTEM — clean elevation ═══ */
        .fathom-card {
            transition: box-shadow 0.2s ease, border-color 0.2s ease !important;
        }
        .fathom-card:hover {
            box-shadow: ${
                DS._dark
                    ? '0 4px 16px rgba(0,0,0,0.3), 0 1px 4px rgba(0,0,0,0.15)'
                    : '0 4px 16px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)'
            } !important;
            border-color: ${DS._dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'} !important;
        }

        /* ── Class-based cards (legacy screens) ── */
        [class*="-card"],
        [class*="_card"],
        [class*="Card"] {
            border-radius: 16px !important;
            box-shadow: ${
                DS._dark
                    ? '0 1px 3px rgba(0,0,0,0.2), 0 1px 2px rgba(0,0,0,0.1)'
                    : '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.03)'
            } !important;
            transition: box-shadow 0.2s ease, border-color 0.2s ease !important;
            border: 1px solid ${DS._dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'} !important;
        }
        [class*="-card"]:hover,
        [class*="_card"]:hover,
        [class*="Card"]:hover {
            box-shadow: ${
                DS._dark
                    ? '0 4px 16px rgba(0,0,0,0.3), 0 2px 6px rgba(0,0,0,0.15)'
                    : '0 4px 16px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.04)'
            } !important;
            border-color: ${DS._dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.09)'} !important;
        }

        /* ── Panels & sections ── */
        [class*="-panel"],
        [class*="_panel"],
        [class*="-section"],
        [class*="_section"] {
            border-radius: 14px !important;
            border: 1px solid ${DS._dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'} !important;
        }

        /* ── Card headers ── */
        [class*="-card-header"],
        [class*="_card_header"],
        [class*="card-header"],
        [class*="CardHeader"] {
            background: ${DS._dark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)'} !important;
            padding: 14px 20px !important;
            border-bottom: 1px solid ${DS._dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'} !important;
            font-weight: 600 !important;
        }

        /* ── Row hover ── */
        [class*="-row"]:not(table tr) {
            transition: background 0.15s ease !important;
            border-radius: 8px !important;
        }
        [class*="-row"]:not(table tr):hover {
            background: ${DS._dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'} !important;
        }

        /* ── Badges ── */
        [class*="-badge"],
        [class*="_badge"],
        [class*="Badge"] {
            border-radius: 20px !important;
            font-weight: 600 !important;
        }

        /* ── Primary buttons ── */
        button[style*="background: linear-gradient"],
        button[style*="background:linear-gradient"],
        button[style*="background: #3b82f6"],
        button[style*="background:#3b82f6"],
        button[style*="background: rgb(99"],
        [class*="-btn-primary"],
        [class*="_btn_primary"] {
            box-shadow: 0 2px 8px rgba(99,102,241,0.25) !important;
            border-radius: 10px !important;
            font-weight: 600 !important;
            transition: all 0.2s ease !important;
        }
        button[style*="background: linear-gradient"]:hover,
        button[style*="background:linear-gradient"]:hover,
        button[style*="background: #3b82f6"]:hover,
        button[style*="background:#3b82f6"]:hover,
        [class*="-btn-primary"]:hover,
        [class*="_btn_primary"]:hover {
            box-shadow: 0 4px 14px rgba(99,102,241,0.35) !important;
            transform: translateY(-1px) !important;
        }
        button[style*="background: linear-gradient"]:active,
        button[style*="background:linear-gradient"]:active,
        [class*="-btn-primary"]:active,
        [class*="_btn_primary"]:active {
            transform: translateY(0) !important;
        }

        /* ── Ghost buttons ── */
        button[style*="background: none"],
        button[style*="background:none"],
        button[style*="background: transparent"],
        button[style*="background:transparent"] {
            border-radius: 8px !important;
            transition: all 0.15s ease !important;
        }
        button[style*="background: none"]:hover,
        button[style*="background:none"]:hover,
        button[style*="background: transparent"]:hover,
        button[style*="background:transparent"]:hover {
            background: ${DS._dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'} !important;
        }

        /* ── Tables ── */
        table { border-collapse: separate !important; border-spacing: 0 !important; }
        table th {
            text-transform: uppercase !important;
            letter-spacing: 0.05em !important;
            font-size: 11px !important;
            font-weight: 600 !important;
            padding: 12px 16px !important;
            background: ${DS._dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'} !important;
            border-bottom: 1px solid ${DS._dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'} !important;
            color: ${DS.textMuted} !important;
        }
        table td {
            padding: 11px 16px !important;
            border-bottom: 1px solid ${DS.border} !important;
            transition: background 0.15s ease !important;
            font-size: 13px !important;
        }
        table tr:hover td {
            background: ${DS._dark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)'} !important;
        }
        table tr:last-child td { border-bottom: none !important; }

        /* ── Global transitions ── */
        button { transition: all 0.15s ease !important; }

        /* ── Inputs ── */
        input, textarea, select {
            transition: all 0.15s ease !important;
            border-radius: 8px !important;
        }
        input:focus, textarea:focus, select:focus {
            border-color: ${DS.cyan}50 !important;
            box-shadow: 0 0 0 3px ${DS.cyan}15 !important;
            outline: none !important;
        }

        /* ── Scrollbar ── */
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${DS._dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}; border-radius: 99px; }
        ::-webkit-scrollbar-thumb:hover { background: ${DS._dark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)'}; }

        /* ── Charts tooltip ── */
        .recharts-default-tooltip {
            background: ${DS._dark ? 'rgba(26,39,54,0.95)' : 'rgba(255,255,255,0.98)'} !important;
            border: 1px solid ${DS._dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'} !important;
            border-radius: 10px !important;
            box-shadow: ${DS._dark ? '0 4px 16px rgba(0,0,0,0.3)' : '0 4px 16px rgba(0,0,0,0.06)'} !important;
            padding: 10px 14px !important;
        }
        .recharts-tooltip-label {
            font-weight: 600 !important;
            margin-bottom: 6px !important;
            font-size: 11px !important;
        }

        /* ── Flex overflow fix ── */
        [style*="flex: 1"], [style*="flex:1"] { min-width: 0; }
        [style*="flexDirection: column"] > [style*="flex: 1"],
        [style*="flex-direction: column"] > [style*="flex:1"] { min-height: 0; }

        /* ── Selection ── */
        ::selection { background: ${DS.cyan}25; color: ${DS.textPrimary}; }
        *:focus-visible { outline: 2px solid ${DS.cyan}40 !important; outline-offset: 2px !important; }

        /* ── Interactive card hover ── */
        [style*="cursor: pointer"][style*="border-radius"],
        [style*="cursor:pointer"][style*="borderRadius"] {
            transition: box-shadow 0.2s ease !important;
        }
        [style*="cursor: pointer"][style*="border-radius"]:hover,
        [style*="cursor:pointer"][style*="borderRadius"]:hover {
            box-shadow: ${DS._dark ? '0 4px 12px rgba(0,0,0,0.25)' : '0 4px 12px rgba(0,0,0,0.06)'} !important;
        }

        @keyframes meshGradient {
            0%, 100% { background-position: 0% 0%; }
            25% { background-position: 100% 0%; }
            50% { background-position: 100% 100%; }
            75% { background-position: 0% 100%; }
        }

        @keyframes subtleFloat {
            0%, 100% { transform: translateY(0) rotate(0deg); }
            50% { transform: translateY(-12px) rotate(1deg); }
        }

        body {
            margin: 0;
            font-family: ${DS.fontUI};
            background: ${DS.bg};
            color: ${DS.textPrimary};
            -webkit-font-smoothing: antialiased;
        }

        /* ═══ ANIMATED MESH BACKGROUND ═══ */
        #root > div > div[style*="flex"] > div:last-child,
        main, [role="main"] {
            position: relative;
        }

        /* ── Scrollbar styling (sidebar + main content) ── */
        .sidebar-nav::-webkit-scrollbar { width: 3px; }
        .sidebar-nav::-webkit-scrollbar-track { background: transparent; }
        .sidebar-nav::-webkit-scrollbar-thumb { background: ${DS.sidebarBorder}; border-radius: 2px; }
        .sidebar-nav::-webkit-scrollbar-thumb:hover { background: rgba(99,102,241,0.6); }

        /* Main content scrollbar — thin overlay style */
        .main-scroll::-webkit-scrollbar { width: 6px; }
        .main-scroll::-webkit-scrollbar-track { background: transparent; }
        .main-scroll::-webkit-scrollbar-thumb { background: ${DS._dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}; border-radius: 3px; }
        .main-scroll::-webkit-scrollbar-thumb:hover { background: ${DS._dark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'}; }
        .main-scroll { scrollbar-width: thin; scrollbar-color: ${DS._dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'} transparent; }

        /* ── Section tab animation ── */
        .section-open { animation: sectionOpen 0.18s ease-out both; }

        /* ── Notification panel ── */
        .notif-panel { animation: slideDown 0.22s cubic-bezier(0.34,1.4,0.64,1) both; }
        .notif-item { transition: background 0.15s ease; }
        .notif-item:hover { background: rgba(99,102,241,0.08) !important; }

        /* ── Feedback overlay ── */
        .feedback-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 2000; display: flex; align-items: center; justify-content: center; animation: fadeIn 0.2s ease-out; }
        .feedback-modal   { animation: slideUp 0.3s cubic-bezier(0.34,1.4,0.64,1) both; }
        .fb-input:focus   { border-color: rgba(99,102,241,0.5) !important; box-shadow: 0 0 0 3px rgba(99,102,241,0.12) !important; }
        .fb-tab:hover     { opacity: 1 !important; }
        .fb-prio:hover    { opacity: 1 !important; }
        .fb-opt:hover     { background: rgba(99,102,241,0.08) !important; }
        .fb-submit:not(:disabled):hover { filter: brightness(1.12); transform: translateY(-1px); }
        .fb-submit:not(:disabled):active { transform: translateY(0); }

        /* ── Tooltip ── */
        [data-tip] { position: relative; }
        [data-tip]::after { content: attr(data-tip); position: absolute; left: calc(100% + 10px); top: 50%; transform: translateY(-50%); background: ${DS.surface}; color: ${DS.textPrimary}; font-size: 11px; padding: 5px 9px; border-radius: 6px; border: 1px solid ${DS.border}; white-space: nowrap; pointer-events: none; opacity: 0; transition: opacity 0.15s; z-index: 999; }
        [data-tip]:hover::after { opacity: 1; }

        /* ── Star button ── */
        .star-btn { transition: transform 0.15s ease; }
        .star-btn:hover { transform: scale(1.2); }

        /* ── Collapse button ── */
        .collapse-btn { transition: all 0.2s ease; }
        .collapse-btn:hover { transform: scale(1.12); }

        /* ── Tag badge ── */
        .badge-new { animation: badgePop 0.35s ease-out both; }

        /* scrollbar: see enhanced version above */

        /* ── Responsive Design Improvements ── */
        @media (max-width: 768px) {
            /* Force sidebar collapse on tablets */
            body { --sidebar-collapsed: true; }

            /* Adjust header padding on smaller screens */
            header { padding: 0 16px !important; }

            /* Stack breadcrumb items on mobile */
            @media (max-width: 640px) {
                header { height: auto; flex-wrap: wrap; gap: 8px; }
            }
        }

        @media (max-width: 480px) {
            /* Reduce padding on very small screens */
            .tab-mount { padding: 16px 12px !important; }

            /* Stack everything on mobile */
            main > div { flex-direction: column !important; }

            /* Make buttons full-width on mobile */
            button { min-width: 100%; }
        }

        /* ── Chart responsiveness ── */
        @media (max-width: 900px) {
            /* Reduce chart container heights */
            [class*="chart"], [class*="graph"] { min-height: 200px !important; }
        }

        /* ── Improved touch targets for mobile ── */
        @media (hover: none) and (pointer: coarse) {
            button, [role="button"], .nav-item, .section-btn {
                min-height: 44px;
                min-width: 44px;
                padding: 12px !important;
            }
        }

    `}</style>
));
AppStyles.displayName = 'AppStyles';

/* ─────────────────────────────────────────────────────────────────
   AMBIENT BACKGROUND ORBS (decorative, pointer-events: none)
   ───────────────────────────────────────────────────────────────── */
/* AmbientOrbs — simplified for clean modern look */
const AmbientOrbs = () => null;

/* ─────────────────────────────────────────────────────────────────
   LIVE MINI-SPARKLINE in header (purely visual / decorative)
   ───────────────────────────────────────────────────────────────── */
const MiniSparkline = ({ color = DS.cyan, width = 80, height = 28 }) => {
    const [pts, setPts] = useState(() => Array.from({ length: 20 }, () => Math.random()));
    useEffect(() => {
        const id = setInterval(() => {
            setPts((prev) => {
                const next = [...prev.slice(1), Math.random()];
                return next;
            });
        }, 600);
        return () => clearInterval(id);
    }, []);

    const toSvg = (values) => {
        const n = values.length;
        return values
            .map((v, i) => {
                const x = (i / (n - 1)) * width;
                const y = height - 2 - v * (height - 4);
                return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
            })
            .join(' ');
    };

    const fillPath = `${toSvg(pts)} L ${width} ${height} L 0 ${height} Z`;

    return (
        <svg width={width} height={height} style={{ display: 'block' }}>
            <defs>
                <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.3" />
                    <stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
            </defs>
            <path d={fillPath} fill="url(#spark-fill)" />
            <path
                d={toSvg(pts)}
                fill="none"
                stroke={color}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
};

/* ─────────────────────────────────────────────────────────────────
   LIVE STATUS PILL
   ───────────────────────────────────────────────────────────────── */
const StatusPill = ({ connected }) => (
    <div
        style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            padding: '5px 12px',
            borderRadius: 20,
            background: connected ? 'rgba(52,211,153,0.1)' : 'rgba(251,113,133,0.1)',
            border: `1px solid ${connected ? 'rgba(52,211,153,0.3)' : 'rgba(251,113,133,0.3)'}`,
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.02em',
            color: connected ? DS.emerald : DS.rose,
            fontFamily: DS.fontMono,
        }}
    >
        <span
            style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: connected ? DS.emerald : DS.rose,
                animation: connected ? 'dotBlink 2s ease-in-out infinite' : 'none',
                flexShrink: 0,
            }}
        />
        {connected ? 'LIVE' : 'OFFLINE'}
    </div>
);

/* ─────────────────────────────────────────────────────────────────
   THEME TOGGLE — uses ThemeContext as single source of truth and
   also keeps the mutable DS object in sync for legacy consumers
   ───────────────────────────────────────────────────────────────── */
/* ─────────────────────────────────────────────────────────────────
   GLOBAL REFRESH BUTTON — dispatches 'fathom-refresh' CustomEvent
   that individual tabs listen for to trigger their own data reload.
   ───────────────────────────────────────────────────────────────── */
const GlobalRefreshButton = () => {
    const [spinning, setSpinning] = React.useState(false);

    const handleRefresh = () => {
        setSpinning(true);
        window.dispatchEvent(new CustomEvent('fathom-refresh'));
        setTimeout(() => setSpinning(false), 900);
    };

    return (
        <button
            onClick={handleRefresh}
            aria-label="Refresh data"
            title="Refresh current view"
            style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: 'rgba(99,102,241,0.08)',
                border: '1px solid rgba(99,102,241,0.18)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.25s ease',
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.1)';
                e.currentTarget.style.background = 'rgba(99,102,241,0.14)';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.background = 'rgba(99,102,241,0.08)';
            }}
        >
            <RefreshCw
                size={15}
                color={DS.cyan}
                style={{
                    transition: 'transform 0.6s cubic-bezier(0.4,0,0.2,1)',
                    transform: spinning ? 'rotate(360deg)' : 'rotate(0deg)',
                }}
            />
        </button>
    );
};

const ThemeToggle = () => {
    // Dark mode removed — the app is light-only, so the theme toggle is gone.
    return null;

    /* eslint-disable no-unreachable */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { isDark, toggleTheme } = useTheme();

    const handleToggle = () => {
        const next = !isDark;
        /* Sync module-level DS so legacy inline styles re-read it on next render */
        DS = next ? DS_DARK : DS_LIGHT;
        setDS(DS);
        toggleTheme();
    };

    return (
        <button
            onClick={handleToggle}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            title={isDark ? 'Light mode' : 'Dark mode'}
            style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: isDark ? 'rgba(251,191,36,0.08)' : 'rgba(99,102,241,0.08)',
                border: `1px solid ${isDark ? 'rgba(251,191,36,0.25)' : 'rgba(99,102,241,0.3)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.25s ease',
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.1)';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
            }}
        >
            {isDark ? <Sun size={16} color="rgba(251,191,36,0.9)" /> : <Moon size={16} color="rgba(99,102,241,0.9)" />}
        </button>
    );
};

/* ─────────────────────────────────────────────────────────────────
   FEEDBACK MODAL — full per-screen feedback, feature requests,
   bug reports. Maps to every column in user_feedback DB table.
   ───────────────────────────────────────────────────────────────── */

/* ── Data ─────────────────────────────────────────────────────── */
const FB_MODES = [
    { id: 'feature', label: 'Feature Request', icon: Lightbulb, color: DS.cyan },
    { id: 'bug', label: 'Bug Report', icon: AlertTriangle, color: DS.rose },
    { id: 'general', label: 'General', icon: MessageSquarePlus, color: DS.violet },
];

const FB_PRIORITY = [
    { val: 'Low', color: DS.emerald },
    { val: 'Medium', color: DS.amber },
    { val: 'High', color: DS.rose },
];

const STAR_LABELS = ['Terrible', 'Poor', 'Okay', 'Good', 'Excellent'];

/* All screens grouped — mirrors TAB_CONFIG exactly */
const FB_GROUPS = (() => {
    const groups = [];
    let cur = null;
    for (const item of TAB_CONFIG) {
        if (item.section) {
            cur = { group: item.section, accent: item.accent, tabs: [] };
            groups.push(cur);
        } else if (cur) cur.tabs.push({ id: item.id, label: item.label });
    }
    return groups;
})();
const FB_ALL_TABS = FB_GROUPS.flatMap((g) => g.tabs);
const emptyRow = () => ({ rating: 0, comment: '', remarks: '' });

/* ── Shared primitives ────────────────────────────────────────── */
const FbLabel = ({ children, color }: { children?: any; color?: any }) => (
    <div
        style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.02em',
            color: color || DS.textMuted,
            marginBottom: 8,
            fontFamily: DS.fontMono,
            display: 'flex',
            alignItems: 'center',
            gap: 5,
        }}
    >
        {children}
    </div>
);

const FbInput = ({
    value,
    onChange,
    placeholder,
    maxLength,
    style: extraStyle,
}: {
    value?: any;
    onChange?: any;
    placeholder?: string;
    maxLength?: number;
    style?: any;
}) => {
    const [focused, setFocused] = useState(false);
    return (
        <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            maxLength={maxLength}
            className="fb-input"
            style={{
                width: '100%',
                boxSizing: 'border-box',
                background: 'rgba(255,255,255,0.03)',
                border: `1px solid ${focused ? DS.borderAccent : DS.border}`,
                borderRadius: 9,
                padding: '10px 13px',
                color: DS.textPrimary,
                fontSize: 13,
                outline: 'none',
                fontFamily: DS.fontUI,
                transition: 'border-color 0.2s, box-shadow 0.2s',
                ...extraStyle,
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
        />
    );
};

const FbTextarea = ({ value, onChange, placeholder, rows = 3, maxLength = 500, showCount = true }) => {
    const [focused, setFocused] = useState(false);
    return (
        <div>
            <textarea
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                rows={rows}
                maxLength={maxLength}
                className="fb-input"
                style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    background: 'rgba(255,255,255,0.03)',
                    border: `1px solid ${focused ? DS.borderAccent : DS.border}`,
                    borderRadius: 9,
                    padding: '10px 13px',
                    color: DS.textPrimary,
                    fontSize: 13,
                    outline: 'none',
                    resize: 'none',
                    fontFamily: DS.fontUI,
                    lineHeight: 1.6,
                    transition: 'border-color 0.2s, box-shadow 0.2s',
                }}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
            />
            {showCount && (
                <div
                    style={{
                        fontSize: 10,
                        color: DS.textMuted,
                        textAlign: 'right',
                        marginTop: 3,
                        fontFamily: DS.fontMono,
                    }}
                >
                    {value.length}/{maxLength}
                </div>
            )}
        </div>
    );
};

const FbStarRow = ({ value, onChange, size = 22 }) => {
    const [hov, setHov] = useState(0);
    const d = hov || value;
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            {[1, 2, 3, 4, 5].map((s) => (
                <button
                    key={s}
                    type="button"
                    className="star-btn"
                    onClick={() => onChange(s)}
                    onMouseEnter={() => setHov(s)}
                    onMouseLeave={() => setHov(0)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 1 }}
                >
                    <Star
                        size={size}
                        fill={s <= d ? DS.amber : 'transparent'}
                        color={s <= d ? DS.amber : DS.textMuted}
                        strokeWidth={1.5}
                        style={{ display: 'block', transition: 'fill 0.12s' }}
                    />
                </button>
            ))}
            {d > 0 && (
                <span
                    style={{
                        fontSize: 10,
                        color: DS.textMuted,
                        fontFamily: DS.fontMono,
                        marginLeft: 4,
                        userSelect: 'none',
                    }}
                >
                    {STAR_LABELS[d - 1]}
                </span>
            )}
        </div>
    );
};

/* Full grouped dropdown for section picker */
const FbSectionDropdown = ({ value, onChange, includeAll = false }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    const label = !value || value === 'all' ? 'All Sections' : FB_ALL_TABS.find((t) => t.id === value)?.label || value;
    const [focused, setFocused] = useState(false);

    useEffect(() => {
        const h = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, []);

    return (
        <div ref={ref} style={{ position: 'relative' }}>
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className="fb-input"
                style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'rgba(255,255,255,0.03)',
                    border: `1px solid ${open ? DS.borderAccent : DS.border}`,
                    borderRadius: 9,
                    padding: '10px 13px',
                    color: DS.textPrimary,
                    fontSize: 13,
                    outline: 'none',
                    cursor: 'pointer',
                    fontFamily: DS.fontUI,
                    transition: 'border-color 0.2s',
                }}
            >
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Layers size={13} color={DS.cyan} /> {label}
                </span>
                <ChevronDown
                    size={13}
                    color={DS.textMuted}
                    style={{ transform: open ? 'rotate(180deg)' : 'none', transition: '0.2s', flexShrink: 0 }}
                />
            </button>
            {open && (
                <div
                    style={{
                        position: 'absolute',
                        top: 'calc(100% + 5px)',
                        left: 0,
                        right: 0,
                        background: DS.surface,
                        border: `1px solid ${DS.borderAccent}`,
                        borderRadius: 10,
                        boxShadow: DS.shadowDeep,
                        zIndex: 30,
                        maxHeight: 260,
                        overflowY: 'auto',
                    }}
                >
                    {includeAll && (
                        <button
                            type="button"
                            className="fb-opt"
                            onClick={() => {
                                onChange('all');
                                setOpen(false);
                            }}
                            style={{
                                width: '100%',
                                textAlign: 'left',
                                padding: '9px 14px',
                                background: !value || value === 'all' ? DS.cyanDim : 'transparent',
                                color: !value || value === 'all' ? DS.cyan : DS.textSub,
                                border: 'none',
                                borderBottom: `1px solid ${DS.border}`,
                                cursor: 'pointer',
                                fontSize: 12,
                                fontWeight: 700,
                                fontFamily: DS.fontUI,
                                transition: 'background 0.15s',
                            }}
                        >
                            All Sections
                        </button>
                    )}
                    {FB_GROUPS.map((g) => (
                        <React.Fragment key={g.group}>
                            <div
                                style={{
                                    padding: '5px 14px 4px',
                                    fontSize: 9,
                                    fontWeight: 700,
                                    color: g.accent,
                                    fontFamily: DS.fontMono,
                                    letterSpacing: '0.02em',
                                    background: `${g.accent}08`,
                                    borderBottom: `1px solid ${DS.border}`,
                                }}
                            >
                                {g.group}
                            </div>
                            {g.tabs.map((tab) => (
                                <button
                                    key={tab.id}
                                    type="button"
                                    className="fb-opt"
                                    onClick={() => {
                                        onChange(tab.id);
                                        setOpen(false);
                                    }}
                                    style={{
                                        width: '100%',
                                        textAlign: 'left',
                                        padding: '8px 14px 8px 22px',
                                        background: value === tab.id ? DS.cyanDim : 'transparent',
                                        color: value === tab.id ? DS.cyan : DS.textSub,
                                        border: 'none',
                                        borderBottom: `1px solid ${DS.border}`,
                                        cursor: 'pointer',
                                        fontSize: 12,
                                        fontWeight: value === tab.id ? 600 : 400,
                                        fontFamily: DS.fontUI,
                                        transition: 'background 0.15s',
                                    }}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </React.Fragment>
                    ))}
                </div>
            )}
        </div>
    );
};

/* Single section card (used in both single + all-sections modes) */
const FbSectionCard = ({ label, data, onChange, compact = false, accent = DS.cyan }) => (
    <div
        style={{
            border: `1px solid ${DS.border}`,
            borderRadius: 10,
            padding: compact ? '12px 14px' : '18px',
            background: 'rgba(255,255,255,0.015)',
            marginBottom: compact ? 8 : 0,
        }}
    >
        {compact && (
            <div
                style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: accent,
                    marginBottom: 12,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontFamily: DS.fontMono,
                    letterSpacing: '0.02em',
                }}
            >
                <Layers size={10} /> {label}
            </div>
        )}
        <div style={{ marginBottom: 12 }}>
            <FbLabel>Rating</FbLabel>
            <FbStarRow value={data.rating} onChange={(v) => onChange('rating', v)} size={compact ? 18 : 22} />
        </div>
        <div style={{ marginBottom: 10 }}>
            <FbLabel>Feedback</FbLabel>
            <FbTextarea
                value={data.comment}
                onChange={(v) => onChange('comment', v)}
                placeholder="What do you love, or what could be better?"
                rows={compact ? 2 : 3}
            />
        </div>
        <div>
            <FbLabel>Suggestions</FbLabel>
            <FbTextarea
                value={data.remarks}
                onChange={(v) => onChange('remarks', v)}
                placeholder="Any specific improvements you'd recommend?"
                rows={compact ? 2 : 2}
                showCount={false}
            />
        </div>
    </div>
);

/* Feature request form */
const FbFeatureForm = ({ data, onChange }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div>
            <FbLabel>Related Section</FbLabel>
            <FbSectionDropdown value={data.section} onChange={(v) => onChange('section', v)} />
        </div>
        <div>
            <FbLabel>
                Feature Title <span style={{ color: DS.rose }}>*</span>
            </FbLabel>
            <FbInput
                value={data.title}
                onChange={(v) => onChange('title', v)}
                placeholder="Give your feature a short, descriptive name"
                maxLength={120}
            />
        </div>
        <div>
            <FbLabel>
                Description / Use Case <span style={{ color: DS.rose }}>*</span>
            </FbLabel>
            <FbTextarea
                value={data.description}
                onChange={(v) => onChange('description', v)}
                placeholder="Describe the feature and why it would be valuable…"
                rows={3}
            />
        </div>
        <div>
            <FbLabel>Additional Remarks</FbLabel>
            <FbTextarea
                value={data.remarks}
                onChange={(v) => onChange('remarks', v)}
                placeholder="Implementation ideas, references, or further context…"
                rows={2}
                showCount={false}
            />
        </div>
        {/* Suggest new tab */}
        <div
            style={{
                padding: '14px 16px',
                border: `1px dashed ${DS.borderAccent}`,
                borderRadius: 10,
                background: DS.cyanDim,
            }}
        >
            <FbLabel color={DS.cyan}>
                <PlusCircle size={10} /> Suggest a New Tab
                <span
                    style={{
                        color: DS.textMuted,
                        textTransform: 'none',
                        fontWeight: 400,
                        letterSpacing: 0,
                        marginLeft: 2,
                    }}
                >
                    (optional)
                </span>
            </FbLabel>
            <FbInput
                value={data.suggestedTab}
                onChange={(v) => onChange('suggestedTab', v)}
                placeholder="e.g. Query History, Cost Estimator, Live Replication…"
                maxLength={80}
            />
        </div>
        {/* Priority */}
        <div>
            <FbLabel>Priority</FbLabel>
            <div style={{ display: 'flex', gap: 8 }}>
                {FB_PRIORITY.map(({ val, color }) => {
                    const active = data.priority === val;
                    return (
                        <button
                            key={val}
                            type="button"
                            className="fb-prio"
                            onClick={() => onChange('priority', val)}
                            style={{
                                flex: 1,
                                padding: '9px 0',
                                borderRadius: 8,
                                fontSize: 12,
                                fontWeight: 600,
                                border: `1px solid ${active ? color : DS.border}`,
                                background: active ? `${color}15` : 'transparent',
                                color: active ? color : DS.textMuted,
                                cursor: 'pointer',
                                fontFamily: DS.fontUI,
                                transition: 'all 0.18s',
                                opacity: active ? 1 : 0.7,
                            }}
                        >
                            {val}
                        </button>
                    );
                })}
            </div>
        </div>
    </div>
);

/* Bug / General form */
const FbBugGeneralForm = ({ section, onSectionChange, forms, onFieldChange }) => {
    const showAll = section === 'all';
    const accentFor = (id) => FB_GROUPS.find((g) => g.tabs.some((t) => t.id === id))?.accent || DS.cyan;
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
                <FbLabel>Screen / Section</FbLabel>
                <FbSectionDropdown value={section} onChange={onSectionChange} includeAll />
            </div>
            {showAll ? (
                <>
                    <div
                        style={{
                            fontSize: 12,
                            color: DS.textSub,
                            padding: '9px 13px',
                            background: DS.cyanDim,
                            border: `1px solid ${DS.borderAccent}`,
                            borderRadius: 8,
                            lineHeight: 1.55,
                        }}
                    >
                        Rate any screens you've used. Leave sections blank to skip them — only filled sections will be
                        submitted.
                    </div>
                    {FB_GROUPS.map((g) => (
                        <div key={g.group}>
                            <div
                                style={{
                                    fontSize: 9,
                                    fontWeight: 700,
                                    color: g.accent,
                                    fontFamily: DS.fontMono,
                                    letterSpacing: '0.02em',
                                    marginBottom: 6,
                                    marginTop: 4,
                                    paddingLeft: 2,
                                }}
                            >
                                {g.group}
                            </div>
                            {g.tabs.map((tab) => (
                                <FbSectionCard
                                    key={tab.id}
                                    label={tab.label}
                                    data={forms[tab.id] || emptyRow()}
                                    onChange={(field, val) => onFieldChange(tab.id, field, val)}
                                    compact
                                    accent={g.accent}
                                />
                            ))}
                        </div>
                    ))}
                </>
            ) : (
                <FbSectionCard
                    label={FB_ALL_TABS.find((t) => t.id === section)?.label || section}
                    data={forms[section] || emptyRow()}
                    onChange={(field, val) => onFieldChange(section, field, val)}
                    accent={accentFor(section)}
                />
            )}
        </div>
    );
};

/* ── Main modal ───────────────────────────────────────────────── */
/* FeedbackModal extracted to components/layout/FeedbackModal.tsx (audit M-4:
   was a duplicated inline copy that had drifted from the extracted version). */

/* ─────────────────────────────────────────────────────────────────
   ERROR BOUNDARY
   ───────────────────────────────────────────────────────────────── */
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, showStackTrace: false, errorInfo: null };
    }
    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }
    componentDidCatch(error, errorInfo) {
        console.error('Error Boundary caught:', error, errorInfo);
        this.setState({ errorInfo });
    }
    render() {
        if (this.state.hasError)
            return (
                <div
                    style={{
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexDirection: 'column',
                        gap: 20,
                        padding: 40,
                        color: DS.textPrimary,
                        background: DS.bg,
                    }}
                >
                    <div
                        style={{
                            width: 72,
                            height: 72,
                            borderRadius: 18,
                            background: 'rgba(251,113,133,0.1)',
                            border: '1px solid rgba(251,113,133,0.3)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <AlertCircle size={36} color={DS.rose} />
                    </div>
                    <div style={{ textAlign: 'center', maxWidth: 520 }}>
                        <h2 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 12px', letterSpacing: '-0.02em' }}>
                            Something went wrong
                        </h2>
                        <p style={{ color: DS.textSub, margin: '0 0 24px', lineHeight: 1.6, fontSize: 14 }}>
                            {this.state.error?.message || 'An unexpected error occurred in this view.'}
                        </p>

                        {/* Stack trace section (collapsible) */}
                        {this.state.errorInfo && (
                            <div
                                style={{
                                    textAlign: 'left',
                                    background: `${DS.surface}dd`,
                                    border: `1px solid ${DS.border}`,
                                    borderRadius: 8,
                                    padding: '12px 16px',
                                    marginBottom: 20,
                                    maxHeight: this.state.showStackTrace ? 200 : 0,
                                    overflow: 'hidden',
                                    transition: 'max-height 0.3s ease',
                                }}
                            >
                                <button
                                    onClick={() => this.setState((s) => ({ showStackTrace: !s.showStackTrace }))}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        color: DS.cyan,
                                        fontWeight: 600,
                                        fontSize: 12,
                                        marginBottom: this.state.showStackTrace ? 12 : 0,
                                        fontFamily: DS.fontMono,
                                        letterSpacing: '0.02em',
                                    }}
                                >
                                    {this.state.showStackTrace ? '▼ Hide' : '▶ Show'} Developer Info
                                </button>
                                {this.state.showStackTrace && (
                                    <pre
                                        style={{
                                            margin: 0,
                                            fontSize: 10,
                                            color: DS.textMuted,
                                            fontFamily: DS.fontMono,
                                            overflow: 'auto',
                                            maxHeight: 160,
                                        }}
                                    >
                                        {this.state.errorInfo.componentStack}
                                    </pre>
                                )}
                            </div>
                        )}

                        {/* Action buttons */}
                        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                            <button
                                onClick={() => {
                                    try {
                                        localStorage.removeItem('fathom_active_tab');
                                        localStorage.removeItem('fathom_sidebar_collapsed');
                                    } catch {}
                                    window.location.href = '/';
                                }}
                                style={{
                                    padding: '11px 24px',
                                    borderRadius: 8,
                                    border: `1px solid ${DS.cyan}`,
                                    cursor: 'pointer',
                                    background: `${DS.cyan}15`,
                                    color: DS.cyan,
                                    fontWeight: 600,
                                    fontSize: 13,
                                    fontFamily: DS.fontUI,
                                    transition: 'all 0.15s',
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = `${DS.cyan}25`;
                                    e.currentTarget.style.boxShadow = 'none';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = `${DS.cyan}15`;
                                    e.currentTarget.style.boxShadow = 'none';
                                }}
                            >
                                Go to Overview
                            </button>
                            <button
                                onClick={() => window.location.reload()}
                                style={{
                                    padding: '11px 24px',
                                    borderRadius: 8,
                                    border: 'none',
                                    cursor: 'pointer',
                                    background: `linear-gradient(135deg, ${DS.rose}, ${DS.violet})`,
                                    color: THEME.textInverse,
                                    fontWeight: 600,
                                    fontSize: 13,
                                    fontFamily: DS.fontUI,
                                    transition: 'all 0.15s',
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
                                onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
                            >
                                Reload Page
                            </button>
                        </div>

                        {/* Help text */}
                        <p style={{ color: DS.textMuted, margin: '20px 0 0', fontSize: 11, lineHeight: 1.5 }}>
                            If this error persists, please{' '}
                            <a
                                href="mailto:support@fathom.io"
                                style={{ color: DS.cyan, textDecoration: 'none', fontWeight: 600 }}
                            >
                                contact support
                            </a>{' '}
                            or check the browser console for more details.
                        </p>
                    </div>
                </div>
            );
        return this.props.children;
    }
}

/* ─────────────────────────────────────────────────────────────────
   PROFILE MODAL
   ───────────────────────────────────────────────────────────────── */
const ProfileModal = ({ user, onClose, onSave }) => {
    const [name, setName] = useState(user?.name || '');
    const [email, setEmail] = useState(user?.email || '');
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const h = (e) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    }, [onClose]);

    const handleSave = async () => {
        if (!name.trim()) {
            setError('Name cannot be empty');
            return;
        }
        setSaving(true);
        setError('');
        try {
            const token = localStorage.getItem('fathom_token');
            const res = await fetch('/api/users/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ name: name.trim(), email: email.trim() }),
            });
            if (!res.ok) {
                const d = await res.json().catch(() => ({}));
                throw new Error(d.error || 'Save failed');
            }
            const updated = await res.json().catch(() => ({}));
            onSave({ ...user, name: name.trim(), email: email.trim(), ...updated });
            setSaved(true);
            setTimeout(onClose, 1500);
        } catch (e) {
            // If backend not available, save locally
            onSave({ ...user, name: name.trim(), email: email.trim() });
            setSaved(true);
            setTimeout(onClose, 1500);
        } finally {
            setSaving(false);
        }
    };

    const initials =
        name
            .split(' ')
            .map((w) => w[0])
            .join('')
            .slice(0, 2)
            .toUpperCase() || '?';

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.75)',
                backdropFilter: 'blur(4px)',
                zIndex: 2000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                animation: 'fadeIn 0.2s ease-out',
            }}
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div
                style={{
                    background: DS.surface,
                    border: `1px solid ${DS.borderAccent}`,
                    borderRadius: 20,
                    width: 420,
                    maxWidth: '94vw',
                    boxShadow: `${DS.shadowDeep}, ${DS.glowCyan}`,
                    overflow: 'hidden',
                    animation: 'slideUp 0.3s cubic-bezier(0.34,1.4,0.64,1) both',
                }}
            >
                {/* Rainbow top bar */}
                <div
                    style={{
                        height: 3,
                        background: `linear-gradient(90deg, ${DS.cyan}, ${DS.violet}, ${DS.emerald})`,
                        backgroundSize: '200% 100%',
                        animation: 'waveFlow 3s ease infinite',
                    }}
                />

                {/* Header */}
                <div
                    style={{
                        padding: '20px 26px 18px',
                        borderBottom: `1px solid ${DS.border}`,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                    }}
                >
                    <h3
                        style={{
                            margin: 0,
                            fontSize: 17,
                            fontWeight: 700,
                            color: DS.textPrimary,
                            letterSpacing: '-0.02em',
                        }}
                    >
                        Profile Settings
                    </h3>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'rgba(255,255,255,0.04)',
                            border: `1px solid ${DS.border}`,
                            color: DS.textSub,
                            cursor: 'pointer',
                            width: 32,
                            height: 32,
                            borderRadius: 8,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.15s',
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(251,113,133,0.12)';
                            e.currentTarget.style.color = DS.rose;
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                            e.currentTarget.style.color = DS.textSub;
                        }}
                    >
                        <X size={15} strokeWidth={2} />
                    </button>
                </div>

                {/* Body */}
                <div style={{ padding: '24px 26px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {/* Avatar */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div
                            style={{
                                width: 60,
                                height: 60,
                                borderRadius: 14,
                                flexShrink: 0,
                                background: `linear-gradient(135deg, ${DS.cyan}40, ${DS.violet}40)`,
                                border: `2px solid ${DS.borderAccent}`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 22,
                                fontWeight: 700,
                                color: DS.cyan,
                                fontFamily: DS.fontUI,
                                boxShadow: DS.glowCyan,
                            }}
                        >
                            {initials}
                        </div>
                        <div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: DS.textPrimary }}>{user?.name}</div>
                            <div
                                style={{
                                    fontSize: 11,
                                    color: DS.cyan,
                                    fontFamily: DS.fontMono,
                                    marginTop: 2,
                                    letterSpacing: '0.02em',
                                }}
                            >
                                {user?.role || 'user'} · {user?.accessLevel || 'read'}
                            </div>
                        </div>
                    </div>

                    {/* Name field */}
                    <div>
                        <label
                            style={{
                                display: 'block',
                                fontSize: 11,
                                fontWeight: 600,
                                color: DS.textMuted,
                                marginBottom: 6,
                                letterSpacing: '0.02em',
                            }}
                        >
                            Display Name
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => {
                                setName(e.target.value);
                                setError('');
                            }}
                            style={{
                                width: '100%',
                                boxSizing: 'border-box',
                                background: 'rgba(255,255,255,0.03)',
                                border: `1px solid ${DS.border}`,
                                borderRadius: 9,
                                padding: '10px 13px',
                                color: DS.textPrimary,
                                fontSize: 14,
                                outline: 'none',
                                fontFamily: DS.fontUI,
                                transition: 'border-color 0.2s',
                            }}
                            onFocus={(e) => (e.target.style.borderColor = DS.borderAccent)}
                            onBlur={(e) => (e.target.style.borderColor = DS.border)}
                        />
                    </div>

                    {/* Email field */}
                    <div>
                        <label
                            style={{
                                display: 'block',
                                fontSize: 11,
                                fontWeight: 600,
                                color: DS.textMuted,
                                marginBottom: 6,
                                letterSpacing: '0.02em',
                            }}
                        >
                            Email
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            style={{
                                width: '100%',
                                boxSizing: 'border-box',
                                background: 'rgba(255,255,255,0.03)',
                                border: `1px solid ${DS.border}`,
                                borderRadius: 9,
                                padding: '10px 13px',
                                color: DS.textPrimary,
                                fontSize: 14,
                                outline: 'none',
                                fontFamily: DS.fontUI,
                                transition: 'border-color 0.2s',
                            }}
                            onFocus={(e) => (e.target.style.borderColor = DS.borderAccent)}
                            onBlur={(e) => (e.target.style.borderColor = DS.border)}
                        />
                    </div>

                    {/* Read-only fields */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        {[
                            ['Role', user?.role || '—'],
                            ['Access', user?.accessLevel || '—'],
                        ].map(([lbl, val]) => (
                            <div key={lbl}>
                                <label
                                    style={{
                                        display: 'block',
                                        fontSize: 11,
                                        fontWeight: 600,
                                        color: DS.textMuted,
                                        marginBottom: 6,
                                        letterSpacing: '0.02em',
                                    }}
                                >
                                    {lbl}
                                </label>
                                <div
                                    style={{
                                        background: 'rgba(255,255,255,0.02)',
                                        border: `1px solid ${DS.border}`,
                                        borderRadius: 9,
                                        padding: '10px 13px',
                                        color: DS.textMuted,
                                        fontSize: 13,
                                        fontFamily: DS.fontMono,
                                        letterSpacing: '0.04em',
                                    }}
                                >
                                    {val}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Error */}
                    {error && (
                        <div
                            style={{
                                padding: '10px 14px',
                                borderRadius: 9,
                                background: 'rgba(251,113,133,0.08)',
                                border: '1px solid rgba(251,113,133,0.25)',
                                color: DS.rose,
                                fontSize: 12,
                            }}
                        >
                            {error}
                        </div>
                    )}

                    {/* Save button */}
                    <button
                        onClick={handleSave}
                        disabled={saving || saved}
                        style={{
                            width: '100%',
                            padding: '13px 0',
                            borderRadius: 10,
                            border: 'none',
                            background: saved
                                ? `linear-gradient(135deg, ${DS.emerald}, ${DS.emerald})`
                                : `linear-gradient(135deg, ${DS.cyan}, ${DS.violet})`,
                            color: THEME.textInverse,
                            fontSize: 13,
                            fontWeight: 700,
                            cursor: saving || saved ? 'default' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 8,
                            letterSpacing: '0.03em',
                            fontFamily: DS.fontUI,
                            transition: 'all 0.2s',
                            opacity: saving ? 0.7 : 1,
                            boxShadow: '0 4px 20px rgba(99,102,241,0.22)',
                        }}
                    >
                        {saved ? (
                            <>
                                <CheckCircle size={15} /> Saved!
                            </>
                        ) : saving ? (
                            <>
                                <Save size={15} /> Saving…
                            </>
                        ) : (
                            <>
                                <Save size={15} /> Save Changes
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

/* ─────────────────────────────────────────────────────────────────
   NOTIFICATION CENTER — redesigned with severity colors + timeline
   ───────────────────────────────────────────────────────────────── */
const SEV_COLORS = {
    critical: DS.rose,
    warning: DS.amber,
    info: DS.cyan,
};

const NotificationCenter = ({ notifications, onDismiss, onClearAll }) => {
    const [isOpen, setIsOpen] = useState(false);
    const unread = notifications.filter((n) => !n.read).length;

    return (
        <div style={{ position: 'relative' }}>
            <button
                onClick={() => setIsOpen((o) => !o)}
                style={{
                    position: 'relative',
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    background: isOpen ? DS.cyanDim : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${isOpen ? DS.cyan + '60' : DS.border}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.18s ease',
                    boxShadow: isOpen ? DS.glowCyan : 'none',
                }}
                aria-label="Notifications"
            >
                <Bell size={17} color={isOpen ? DS.cyan : DS.textSub} />
                {unread > 0 && (
                    <span
                        className="badge-new"
                        style={{
                            position: 'absolute',
                            top: -5,
                            right: -5,
                            minWidth: 18,
                            height: 18,
                            borderRadius: 9,
                            background: DS.rose,
                            color: THEME.textInverse,
                            fontSize: 10,
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '0 4px',
                            border: `2px solid ${DS.bg}`,
                            fontFamily: DS.fontMono,
                        }}
                    >
                        {unread > 9 ? '9+' : unread}
                    </span>
                )}
            </button>

            {isOpen && (
                <>
                    <div onClick={() => setIsOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 999 }} />
                    <div
                        className="notif-panel"
                        style={{
                            position: 'absolute',
                            top: 'calc(100% + 10px)',
                            right: 0,
                            width: 390,
                            maxHeight: 520,
                            background: DS.surface,
                            border: `1px solid ${DS.borderAccent}`,
                            borderRadius: 14,
                            boxShadow: `${DS.shadowDeep}, ${DS.glowCyan}`,
                            zIndex: 1000,
                            display: 'flex',
                            flexDirection: 'column',
                            overflow: 'hidden',
                        }}
                    >
                        {/* Rainbow top bar */}
                        <div
                            style={{
                                height: 2,
                                background: `linear-gradient(90deg, ${DS.cyan}, ${DS.violet})`,
                                flexShrink: 0,
                            }}
                        />

                        <div
                            style={{
                                padding: '14px 18px',
                                borderBottom: `1px solid ${DS.border}`,
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                flexShrink: 0,
                            }}
                        >
                            <div
                                style={{
                                    fontSize: 13,
                                    fontWeight: 700,
                                    color: DS.textPrimary,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                }}
                            >
                                <Bell size={14} color={DS.cyan} />
                                Notifications
                                {notifications.length > 0 && (
                                    <span
                                        style={{
                                            fontSize: 10,
                                            background: DS.cyanDim,
                                            color: DS.cyan,
                                            padding: '2px 7px',
                                            borderRadius: 20,
                                            fontFamily: DS.fontMono,
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }}
                                    >
                                        {notifications.length}
                                    </span>
                                )}
                            </div>
                            {notifications.length > 0 && (
                                <button
                                    onClick={onClearAll}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        color: DS.textMuted,
                                        fontSize: 11,
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        padding: '4px 8px',
                                        borderRadius: 6,
                                        transition: 'color 0.15s',
                                    }}
                                    onMouseEnter={(e) => (e.currentTarget.style.color = DS.rose)}
                                    onMouseLeave={(e) => (e.currentTarget.style.color = DS.textMuted)}
                                >
                                    Clear all
                                </button>
                            )}
                        </div>

                        <div style={{ flex: 1, overflowY: 'auto' }}>
                            {notifications.length === 0 ? (
                                <div style={{ padding: '48px 20px', textAlign: 'center', color: DS.textMuted }}>
                                    <Bell size={28} style={{ opacity: 0.2, marginBottom: 10 }} />
                                    <div style={{ fontSize: 12 }}>All caught up</div>
                                </div>
                            ) : (
                                notifications.map((n, idx) => {
                                    const col = SEV_COLORS[n.severity] || DS.cyan;
                                    return (
                                        <div
                                            key={n.id}
                                            className="notif-item"
                                            style={{
                                                padding: '13px 18px',
                                                borderBottom: `1px solid ${DS.border}`,
                                                display: 'flex',
                                                gap: 12,
                                                alignItems: 'flex-start',
                                                background: !n.read ? `${col}06` : 'transparent',
                                                cursor: 'default',
                                                animation: `notifPop 0.25s ${idx * 0.04}s ease-out both`,
                                            }}
                                        >
                                            {/* Severity dot + icon */}
                                            <div
                                                style={{
                                                    width: 34,
                                                    height: 34,
                                                    borderRadius: 8,
                                                    flexShrink: 0,
                                                    background: `${col}12`,
                                                    border: `1px solid ${col}30`,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                }}
                                            >
                                                <AlertCircle size={15} color={col} />
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div
                                                    style={{
                                                        fontSize: 12,
                                                        fontWeight: 700,
                                                        color: DS.textPrimary,
                                                        marginBottom: 3,
                                                    }}
                                                >
                                                    {n.title}
                                                </div>
                                                <div style={{ fontSize: 11, color: DS.textSub, lineHeight: 1.5 }}>
                                                    {n.message}
                                                </div>
                                                <div
                                                    style={{
                                                        fontSize: 10,
                                                        color: DS.textMuted,
                                                        marginTop: 5,
                                                        fontFamily: DS.fontMono,
                                                    }}
                                                >
                                                    {new Date(n.timestamp).toLocaleTimeString()}
                                                </div>
                                            </div>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onDismiss(n.id);
                                                }}
                                                style={{
                                                    width: 22,
                                                    height: 22,
                                                    borderRadius: 5,
                                                    border: 'none',
                                                    background: 'transparent',
                                                    color: DS.textMuted,
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    flexShrink: 0,
                                                    transition: 'all 0.15s',
                                                }}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.background = 'rgba(251,113,133,0.12)';
                                                    e.currentTarget.style.color = DS.rose;
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.background = 'transparent';
                                                    e.currentTarget.style.color = DS.textMuted;
                                                }}
                                            >
                                                <X size={13} />
                                            </button>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

/* ─────────────────────────────────────────────────────────────────
   SIDEBAR
   ───────────────────────────────────────────────────────────────── */
const Sidebar = ({
    activeTab,
    onTabChange,
    onLogout,
    currentUser,
    collapsed,
    onToggleCollapse,
    onOpenFeedback,
    onOpenProfile,
    allowedTabIds,
}) => {
    const { activeConnection, loading: connectionsLoading } = useConnection();
    const [openSections, setOpenSections] = useState(() => {
        const active = getSectionForTab(activeTab);
        const parentGrp = getGroupForTab(activeTab);
        const s = new Set();
        if (active) s.add(active);
        if (parentGrp) s.add(parentGrp);
        return s;
    });

    // Track which sub-group tabs (those with children[]) are expanded
    const [openSubGroups, setOpenSubGroups] = useState<Set<string>>(() => new Set<string>());

    const toggleSubGroup = useCallback((tabId: string) => {
        setOpenSubGroups((prev) => {
            const next = new Set(prev);
            next.has(tabId) ? next.delete(tabId) : next.add(tabId);
            return next;
        });
    }, []);

    /* Sidebar state */

    useEffect(() => {
        const sec = getSectionForTab(activeTab);
        const parentGrp = getGroupForTab(activeTab);
        setOpenSections((prev) => {
            const needs = [];
            if (sec && !prev.has(sec)) needs.push(sec);
            if (parentGrp && !prev.has(parentGrp)) needs.push(parentGrp);
            if (needs.length === 0) return prev;
            return new Set([...prev, ...needs]);
        });
        // Auto-open sub-group if the active tab is a child
        visibleGroups.forEach((grp: any) => {
            (grp.tabs || []).forEach((tab: any) => {
                if (tab.children?.some((c: any) => c.id === activeTab)) {
                    setOpenSubGroups((prev) => {
                        if (prev.has(tab.id)) return prev;
                        return new Set([...prev, tab.id]);
                    });
                }
            });
        });
    }, [activeTab]);

    const toggleSection = useCallback(
        (sec) => {
            setOpenSections((prev) => {
                const next = new Set(prev);
                next.has(sec) ? next.delete(sec) : next.add(sec);
                return next;
            });
            // Auto-navigate into demo when Demo section is clicked
            if (sec === 'Demo' && onTabChange) {
                onTabChange('demo-postgres');
            }
        },
        [onTabChange],
    );

    // Only show DB-specific sections for real connections (demo has its own inner nav)
    // activeConnection is hydrated from localStorage cache, so dbType is available immediately
    const connDbType = activeConnection?.dbType || null;

    // Sections shown per database type
    const PG_SECTIONS = [
        'Connections',
        'Overview',
        'Alerts & Rules',
        'Query Analysis',
        'Schema & Data',
        'Infrastructure',
        'Security',
        'Observability',
        'Developer Tools',
        'Admin',
    ];
    const MYSQL_SECTIONS = [
        'Connections',
        'MySQL',
        'Overview',
        'Alerts & Rules',
        'Security',
        'Observability',
        'Developer Tools',
        'Admin',
    ];
    const MONGO_SECTIONS = [
        'Connections',
        'MongoDB',
        'Overview',
        'Alerts & Rules',
        'Security',
        'Observability',
        'Admin',
    ];

    // Demo users (username contains "demo_user") see ONLY the Demo section.
    const isDemoUser = (currentUser?.username || '').toLowerCase().includes('demo_user');

    const visibleGroups = useMemo(
        () =>
            SECTION_GROUPS.map((g) => ({ ...g, tabs: g.tabs.filter((t) => allowedTabIds.includes(t.id)) }))
                .filter((g) => g.tabs.length > 0)
                .filter((g) => {
                    // Demo users: nothing but the Demo section.
                    if (isDemoUser) return g.section === 'Demo';
                    // Demo always visible
                    if (g.section === 'Demo') return true;
                    // User Management only for super_admin
                    if (g.section === 'User Management') return currentUser?.role === 'super_admin';
                    // No connection → hide everything else
                    if (!connDbType) return false;
                    // Show sections based on DB type
                    if (connDbType === 'postgresql') return PG_SECTIONS.includes(g.section);
                    if (connDbType === 'mysql' || connDbType === 'mariadb') return MYSQL_SECTIONS.includes(g.section);
                    if (connDbType === 'mongodb') return MONGO_SECTIONS.includes(g.section);
                    return false;
                }),
        [allowedTabIds, connDbType, currentUser, activeTab, isDemoUser],
    );

    /* Build flat nav: each section becomes a { type:'section', ... } entry */
    const groupedNav = useMemo(() => {
        return visibleGroups.map((g) => ({ type: 'section', ...g }));
    }, [visibleGroups]);

    const W = collapsed ? 56 : 256;

    return (
        <aside
            style={{
                width: W,
                minWidth: W,
                background: DS.sidebarBg,
                borderRight: `1px solid ${DS.sidebarBorder}`,
                display: 'flex',
                flexDirection: 'column',
                zIndex: 50,
                flexShrink: 0,
                transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1), min-width 0.25s cubic-bezier(0.4,0,0.2,1)',
                position: 'relative',
                overflow: 'hidden',
            }}
        >
            {/* Right-edge gradient rule — handled by aside::after in CSS */}

            {/* ── LOGO ── */}
            <div
                style={{
                    height: 54,
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    padding: collapsed ? 0 : '0 16px',
                    gap: 10,
                    borderBottom: `1px solid ${DS.sidebarBorder}`,
                }}
            >
                {/* Icon mark */}
                <div
                    style={{
                        width: 34,
                        height: 34,
                        borderRadius: 10,
                        flexShrink: 0,
                        background: `linear-gradient(135deg, ${DS.cyan}, ${DS.violet || THEME.primary})`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                        border: `1px solid ${DS.cyan}40`,
                    }}
                >
                    <Database color={THEME.textInverse} size={16} strokeWidth={2.5} />
                </div>

                {/* Wordmark — hidden when collapsed */}
                {!collapsed && (
                    <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
                        <span
                            style={{
                                fontSize: 15,
                                fontWeight: 800,
                                letterSpacing: '-0.03em',
                                color: DS.logoText,
                            }}
                        >
                            PG <span style={{ color: DS.cyan }}>Monitor</span>
                        </span>
                        <span
                            style={{
                                fontSize: 9,
                                letterSpacing: '0.14em',
                                color: DS.logoSub,
                                fontFamily: DS.fontMono,
                                marginTop: 2,
                            }}
                        >
                            Database Intelligence
                        </span>
                    </div>
                )}
            </div>

            {/* Search bar and recently viewed removed */}

            {/* ── NAV ── */}
            <nav
                className="sidebar-nav"
                role="navigation"
                aria-label="Main navigation"
                style={{
                    flex: 1,
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    padding: '6px 8px',
                }}
            >
                {/* ── Tree-style collapsible navigation ── */}
                {(() => {
                    /* ── Child leaf: indented tab under a sub-group ── */
                    const renderChildTab = (tab, accent) => {
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                id={`${tab.id}-tab`}
                                key={tab.id}
                                className="nav-item"
                                onClick={() => onTabChange(tab.id)}
                                role="tab"
                                aria-selected={isActive}
                                aria-label={tab.label}
                                title={collapsed ? tab.label : undefined}
                                style={{
                                    width: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: collapsed ? 'center' : 'flex-start',
                                    gap: 8,
                                    padding: collapsed ? '6px 0' : '5px 10px 5px 44px',
                                    background: isActive ? `${accent}15` : 'transparent',
                                    border: 'none',
                                    borderRadius: 6,
                                    cursor: 'pointer',
                                    color: isActive ? accent : DS.sidebarText,
                                    fontWeight: isActive ? 600 : 400,
                                    fontSize: 12,
                                    textAlign: 'left',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    fontFamily: DS.fontUI,
                                    transition: 'all 0.15s ease',
                                    position: 'relative',
                                    margin: '1px 0',
                                    opacity: 0.9,
                                }}
                                onMouseEnter={(e) => {
                                    if (!isActive) {
                                        e.currentTarget.style.background = DS.sidebarHover;
                                        e.currentTarget.style.color = DS.sidebarText;
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (!isActive) {
                                        e.currentTarget.style.background = 'transparent';
                                        e.currentTarget.style.color = DS.sidebarText;
                                    }
                                }}
                            >
                                {/* Deeper tree connector */}
                                {!collapsed && (
                                    <span
                                        style={{
                                            position: 'absolute',
                                            left: 28,
                                            top: 0,
                                            bottom: 0,
                                            width: 1,
                                            background: isActive ? `${accent}40` : `${DS.sidebarText}10`,
                                        }}
                                    />
                                )}
                                {!collapsed && (
                                    <span
                                        style={{
                                            position: 'absolute',
                                            left: 28,
                                            top: '50%',
                                            width: 10,
                                            height: 1,
                                            background: isActive ? `${accent}40` : `${DS.sidebarText}10`,
                                        }}
                                    />
                                )}
                                <tab.icon size={12} style={{ flexShrink: 0, opacity: isActive ? 1 : 0.6 }} />
                                {!collapsed && (
                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
                                        {tab.label}
                                    </span>
                                )}
                            </button>
                        );
                    };

                    /* ── Leaf node: single tab item ── */
                    const renderTab = (tab, accent) => {
                        const isActive = activeTab === tab.id;

                        // Sub-group: tab with children — render as inline collapsible branch
                        if (tab.children?.length) {
                            const isSubOpen = collapsed || openSubGroups.has(tab.id);
                            const hasActiveChild = tab.children.some((c) => c.id === activeTab);
                            const isParentActive = activeTab === tab.id;
                            return (
                                <div key={tab.id}>
                                    {/* Parent row — clickable: navigates + toggles children */}
                                    <button
                                        id={`${tab.id}-tab`}
                                        className="nav-item"
                                        onClick={() => {
                                            onTabChange(tab.id);
                                            toggleSubGroup(tab.id);
                                        }}
                                        role="tab"
                                        aria-selected={isParentActive}
                                        aria-expanded={isSubOpen}
                                        aria-label={tab.label}
                                        title={collapsed ? tab.label : undefined}
                                        style={{
                                            width: '100%',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: collapsed ? 'center' : 'flex-start',
                                            gap: 8,
                                            padding: collapsed ? '7px 0' : '6px 10px 6px 28px',
                                            background:
                                                isParentActive || hasActiveChild ? `${accent}15` : 'transparent',
                                            border: 'none',
                                            borderRadius: 6,
                                            cursor: 'pointer',
                                            color: isParentActive || hasActiveChild ? accent : DS.sidebarText,
                                            fontWeight: isParentActive || hasActiveChild ? 600 : 400,
                                            fontSize: 12.5,
                                            textAlign: 'left',
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            fontFamily: DS.fontUI,
                                            transition: 'all 0.15s ease',
                                            position: 'relative',
                                            margin: '1px 0',
                                        }}
                                        onMouseEnter={(e) => {
                                            if (!isParentActive && !hasActiveChild) {
                                                e.currentTarget.style.background = DS.sidebarHover;
                                            }
                                        }}
                                        onMouseLeave={(e) => {
                                            if (!isParentActive && !hasActiveChild) {
                                                e.currentTarget.style.background = 'transparent';
                                            }
                                        }}
                                    >
                                        {/* Tree connectors */}
                                        {!collapsed && (
                                            <span
                                                style={{
                                                    position: 'absolute',
                                                    left: 14,
                                                    top: 0,
                                                    bottom: 0,
                                                    width: 1,
                                                    background:
                                                        isParentActive || hasActiveChild
                                                            ? `${accent}40`
                                                            : `${DS.sidebarText}15`,
                                                }}
                                            />
                                        )}
                                        {!collapsed && (
                                            <span
                                                style={{
                                                    position: 'absolute',
                                                    left: 14,
                                                    top: '50%',
                                                    width: 8,
                                                    height: 1,
                                                    background:
                                                        isParentActive || hasActiveChild
                                                            ? `${accent}40`
                                                            : `${DS.sidebarText}15`,
                                                }}
                                            />
                                        )}
                                        <tab.icon size={14} style={{ flexShrink: 0 }} />
                                        {!collapsed && (
                                            <>
                                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
                                                    {tab.label}
                                                </span>
                                                {/* Chevron indicator */}
                                                <ChevronRight
                                                    size={11}
                                                    style={{
                                                        flexShrink: 0,
                                                        marginRight: 4,
                                                        transition: 'transform 0.2s ease',
                                                        transform: isSubOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                                                        opacity: 0.5,
                                                    }}
                                                />
                                            </>
                                        )}
                                    </button>
                                    {/* Children */}
                                    {isSubOpen && !collapsed && (
                                        <div style={{ overflow: 'hidden' }}>
                                            {tab.children.map((child) => renderChildTab(child, accent))}
                                        </div>
                                    )}
                                    {isSubOpen && collapsed && (
                                        <div>{tab.children.map((child) => renderChildTab(child, accent))}</div>
                                    )}
                                </div>
                            );
                        }
                        return (
                            <button
                                id={`${tab.id}-tab`}
                                key={tab.id}
                                className="nav-item"
                                onClick={() => onTabChange(tab.id)}
                                role="tab"
                                aria-selected={isActive}
                                aria-label={tab.label}
                                title={collapsed ? tab.label : undefined}
                                style={{
                                    width: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: collapsed ? 'center' : 'flex-start',
                                    gap: 8,
                                    padding: collapsed ? '7px 0' : '6px 10px 6px 28px',
                                    background: isActive ? `${accent}15` : 'transparent',
                                    border: 'none',
                                    borderRadius: 6,
                                    cursor: 'pointer',
                                    color: isActive ? accent : DS.sidebarText,
                                    fontWeight: isActive ? 600 : 400,
                                    fontSize: 12.5,
                                    textAlign: 'left',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    fontFamily: DS.fontUI,
                                    transition: 'all 0.15s ease',
                                    position: 'relative',
                                    margin: '1px 0',
                                }}
                                onMouseEnter={(e) => {
                                    if (!isActive) {
                                        e.currentTarget.style.background = DS.sidebarHover;
                                        e.currentTarget.style.color = DS.sidebarText;
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (!isActive) {
                                        e.currentTarget.style.background = 'transparent';
                                        e.currentTarget.style.color = DS.sidebarText;
                                    }
                                }}
                            >
                                {/* Tree connector line */}
                                {!collapsed && (
                                    <span
                                        style={{
                                            position: 'absolute',
                                            left: 14,
                                            top: 0,
                                            bottom: 0,
                                            width: 1,
                                            background: isActive ? `${accent}40` : `${DS.sidebarText}15`,
                                        }}
                                    />
                                )}
                                {!collapsed && (
                                    <span
                                        style={{
                                            position: 'absolute',
                                            left: 14,
                                            top: '50%',
                                            width: 8,
                                            height: 1,
                                            background: isActive ? `${accent}40` : `${DS.sidebarText}15`,
                                        }}
                                    />
                                )}
                                <tab.icon
                                    size={14}
                                    style={{
                                        flexShrink: 0,
                                        opacity: isActive ? 1 : 0.55,
                                        filter: isActive ? `drop-shadow(0 0 3px ${accent}60)` : 'none',
                                    }}
                                />
                                {!collapsed && (
                                    <>
                                        <span
                                            style={{
                                                flex: 1,
                                                minWidth: 0,
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                            }}
                                        >
                                            {tab.label}
                                        </span>
                                        {tab.badge && (
                                            <span
                                                style={{
                                                    fontSize: 9,
                                                    fontWeight: 700,
                                                    padding: '1px 5px',
                                                    borderRadius: 8,
                                                    background: 'rgba(251,113,133,0.15)',
                                                    color: DS.rose,
                                                    border: '1px solid rgba(251,113,133,0.25)',
                                                    fontFamily: DS.fontMono,
                                                    lineHeight: '14px',
                                                    flexShrink: 0,
                                                }}
                                            >
                                                {tab.badge}
                                            </span>
                                        )}
                                    </>
                                )}
                            </button>
                        );
                    };

                    /* ── Branch node: section header ── */
                    const renderBranch = (label, sectionKey, accent, hasActive, isOpen, tabCount) => (
                        <button
                            className="section-btn"
                            onClick={() => toggleSection(sectionKey)}
                            role="group"
                            aria-label={label}
                            aria-expanded={isOpen}
                            style={{
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                padding: '7px 8px',
                                background: hasActive && !isOpen ? `${accent}10` : 'transparent',
                                border: 'none',
                                borderRadius: 6,
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                                marginTop: 2,
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = DS.sidebarHover;
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = hasActive && !isOpen ? `${accent}10` : 'transparent';
                            }}
                        >
                            {/* Chevron */}
                            <ChevronRight
                                size={12}
                                color={hasActive ? accent : DS.sidebarText}
                                style={{
                                    flexShrink: 0,
                                    transition: 'transform 0.2s ease',
                                    transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                                    opacity: 0.7,
                                }}
                            />
                            <span
                                style={{
                                    fontSize: 11.5,
                                    fontWeight: 600,
                                    letterSpacing: '0.03em',
                                    fontFamily: DS.fontUI,
                                    color: hasActive ? accent : DS.sidebarText,
                                    flex: 1,
                                    minWidth: 0,
                                    textAlign: 'left',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                {label}
                            </span>
                        </button>
                    );

                    /* ── Render all nav items ── */
                    return groupedNav.map((item, gi) => {
                        const group = item;
                        const isOpen = collapsed || openSections.has(group.section);
                        const hasActive = group.tabs.some((t) => t.id === activeTab);

                        return (
                            <div key={group.section} style={{ marginBottom: 1 }}>
                                {collapsed
                                    ? gi > 0 && (
                                          <div
                                              style={{
                                                  margin: '4px 12px',
                                                  height: 1,
                                                  background: `linear-gradient(90deg, transparent, ${group.accent}30, transparent)`,
                                              }}
                                          />
                                      )
                                    : renderBranch(
                                          group.section,
                                          group.section,
                                          group.accent,
                                          hasActive,
                                          isOpen,
                                          group.tabs.length,
                                      )}
                                {isOpen && (
                                    <div
                                        style={{
                                            overflow: 'hidden',
                                            transition: 'max-height 0.25s ease',
                                            position: 'relative',
                                        }}
                                    >
                                        {group.tabs.map((tab) => renderTab(tab, group.accent))}
                                    </div>
                                )}
                            </div>
                        );
                    });
                })()}
            </nav>

            {/* ── FOOTER ── */}
            <div
                style={{
                    borderTop: `1px solid ${DS.border}`,
                    padding: collapsed ? '8px 6px' : '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1,
                }}
            >
                {/* ── User profile pill ── */}
                <button
                    onClick={onOpenProfile}
                    title={collapsed ? currentUser?.name || 'Profile' : 'Edit profile'}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: collapsed ? 'center' : 'flex-start',
                        gap: 10,
                        padding: collapsed ? '8px 0' : '8px 10px',
                        marginBottom: 4,
                        background: 'rgba(99,102,241,0.10)',
                        borderRadius: 8,
                        border: '1px solid rgba(99,102,241,0.18)',
                        cursor: 'pointer',
                        width: '100%',
                        textAlign: 'left',
                        transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(99,102,241,0.18)';
                        e.currentTarget.style.borderColor = 'rgba(99,102,241,0.30)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(99,102,241,0.10)';
                        e.currentTarget.style.borderColor = 'rgba(99,102,241,0.18)';
                    }}
                >
                    {/* Avatar */}
                    <div
                        style={{
                            width: 28,
                            height: 28,
                            borderRadius: 7,
                            flexShrink: 0,
                            background: 'linear-gradient(135deg, rgba(99,102,241,0.35), rgba(139,92,246,0.3))',
                            border: '1px solid rgba(99,102,241,0.25)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <User size={13} color={DS.cyan} />
                    </div>
                    {!collapsed && (
                        <>
                            <div style={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
                                <div
                                    style={{
                                        fontSize: 11.5,
                                        fontWeight: 600,
                                        color: 'rgba(255,255,255,0.9)',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                        lineHeight: '15px',
                                    }}
                                >
                                    {currentUser?.name || currentUser?.username || 'User'}
                                </div>
                                <div
                                    style={{
                                        fontSize: 9.5,
                                        color: DS.cyan,
                                        fontFamily: DS.fontMono,
                                        letterSpacing: '0.04em',
                                        lineHeight: '13px',
                                    }}
                                >
                                    Online
                                </div>
                            </div>
                            <div
                                style={{
                                    width: 6,
                                    height: 6,
                                    borderRadius: '50%',
                                    background: DS.cyan,
                                    flexShrink: 0,
                                    boxShadow: 'none',
                                }}
                            />
                        </>
                    )}
                </button>

                {/* ── Quick action row ── */}
                {collapsed ? (
                    /* Collapsed: vertical icon stack */
                    <>
                        {[
                            currentUser?.role === 'super_admin' && {
                                icon: Users,
                                action: () => onTabChange('UserManagement'),
                                tip: 'User Management',
                                active: activeTab === 'UserManagement' || activeTab === 'user-audit',
                            },
                            {
                                icon: Database,
                                action: () => onTabChange('demo-postgres'),
                                tip: 'Demo',
                                active: activeTab?.startsWith('demo-'),
                            },
                            // Feedback is scoped to a connection — hide it when none exists.
                            connDbType && {
                                icon: MessageSquarePlus,
                                action: onOpenFeedback,
                                tip: 'Feedback',
                                active: false,
                            },
                            { icon: LogOut, action: onLogout, tip: 'Sign Out', active: false, danger: true },
                        ]
                            .filter(Boolean)
                            .map(({ icon: Icon, action, tip, active, danger }) => (
                                <button
                                    key={tip}
                                    onClick={action}
                                    title={tip}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        padding: '7px 0',
                                        background: active ? 'rgba(99,102,241,0.15)' : 'transparent',
                                        border: 'none',
                                        borderRadius: 6,
                                        cursor: 'pointer',
                                        width: '100%',
                                        color: active ? DS.cyan : 'rgba(255,255,255,0.6)',
                                        transition: 'all 0.15s ease',
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.color = danger ? DS.rose : DS.cyan;
                                        e.currentTarget.style.background = danger
                                            ? 'rgba(251,113,133,0.12)'
                                            : 'rgba(99,102,241,0.15)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.color = active ? DS.cyan : 'rgba(255,255,255,0.6)';
                                        e.currentTarget.style.background = active
                                            ? 'rgba(99,102,241,0.15)'
                                            : 'transparent';
                                    }}
                                >
                                    <Icon size={14} />
                                </button>
                            ))}
                    </>
                ) : (
                    /* Expanded: compact button rows */
                    <>
                        {/* Nav buttons: User Management (super_admin only) & Demo */}
                        <div style={{ display: 'flex', gap: 4, marginBottom: 2 }}>
                            {[
                                currentUser?.role === 'super_admin' && {
                                    icon: Users,
                                    label: 'Users',
                                    action: () => onTabChange('UserManagement'),
                                    active: activeTab === 'UserManagement' || activeTab === 'user-audit',
                                },
                                {
                                    icon: Database,
                                    label: 'Demo',
                                    action: () => onTabChange('demo-postgres'),
                                    active: activeTab?.startsWith('demo-'),
                                },
                            ]
                                .filter(Boolean)
                                .map(({ icon: Icon, label, action, active }) => (
                                    <button
                                        key={label}
                                        onClick={action}
                                        style={{
                                            flex: 1,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: 6,
                                            padding: '6px 8px',
                                            background: active ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.06)',
                                            border: active
                                                ? '1px solid rgba(99,102,241,0.25)'
                                                : '1px solid rgba(255,255,255,0.08)',
                                            borderRadius: 6,
                                            cursor: 'pointer',
                                            color: active ? DS.cyan : 'rgba(255,255,255,0.7)',
                                            fontSize: 11,
                                            fontWeight: active ? 600 : 500,
                                            fontFamily: DS.fontUI,
                                            transition: 'all 0.15s ease',
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.background = 'rgba(99,102,241,0.18)';
                                            e.currentTarget.style.color = DS.cyan;
                                            e.currentTarget.style.borderColor = 'rgba(99,102,241,0.25)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.background = active
                                                ? 'rgba(99,102,241,0.15)'
                                                : 'rgba(255,255,255,0.06)';
                                            e.currentTarget.style.color = active ? DS.cyan : 'rgba(255,255,255,0.7)';
                                            e.currentTarget.style.borderColor = active
                                                ? 'rgba(99,102,241,0.25)'
                                                : 'rgba(255,255,255,0.08)';
                                        }}
                                    >
                                        <Icon size={12} />
                                        {label}
                                    </button>
                                ))}
                        </div>
                        {/* Utility buttons: Feedback & Sign Out */}
                        <div style={{ display: 'flex', gap: 4 }}>
                            {/* Feedback is scoped to a connection — hidden when none exists. */}
                            {connDbType && (
                                <button
                                    onClick={onOpenFeedback}
                                    style={{
                                        flex: 1,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: 6,
                                        padding: '6px 8px',
                                        background: 'rgba(255,255,255,0.06)',
                                        border: '1px solid rgba(255,255,255,0.08)',
                                        borderRadius: 6,
                                        cursor: 'pointer',
                                        color: 'rgba(255,255,255,0.7)',
                                        fontSize: 11,
                                        fontWeight: 500,
                                        fontFamily: DS.fontUI,
                                        transition: 'all 0.15s ease',
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.background = 'rgba(99,102,241,0.15)';
                                        e.currentTarget.style.color = DS.cyan;
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                                        e.currentTarget.style.color = 'rgba(255,255,255,0.7)';
                                    }}
                                >
                                    <MessageSquarePlus size={12} />
                                    Feedback
                                </button>
                            )}
                            <button
                                onClick={onLogout}
                                style={{
                                    flex: 1,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 6,
                                    padding: '6px 8px',
                                    background: 'rgba(255,255,255,0.06)',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    borderRadius: 6,
                                    cursor: 'pointer',
                                    color: 'rgba(255,255,255,0.7)',
                                    fontSize: 11,
                                    fontWeight: 500,
                                    fontFamily: DS.fontUI,
                                    transition: 'all 0.15s ease',
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = 'rgba(251,113,133,0.12)';
                                    e.currentTarget.style.color = DS.rose;
                                    e.currentTarget.style.borderColor = 'rgba(251,113,133,0.2)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                                    e.currentTarget.style.color = 'rgba(255,255,255,0.7)';
                                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                                }}
                            >
                                <LogOut size={12} />
                                Sign Out
                            </button>
                        </div>
                    </>
                )}
            </div>

            {/* ── COLLAPSE TOGGLE ── */}
            <button
                onClick={onToggleCollapse}
                aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                style={{
                    position: 'absolute',
                    right: -11,
                    top: 76,
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: DS.surface,
                    border: `1px solid ${DS.border}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: DS.sidebarText,
                    zIndex: 51,
                    transition: 'all 0.2s ease',
                    boxShadow: DS.shadowCard,
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.background = DS.cyan;
                    e.currentTarget.style.color = DS._dark ? THEME.deepTeal : THEME.surface;
                    e.currentTarget.style.borderColor = DS.cyan;
                    e.currentTarget.style.boxShadow = DS.glowCyan;
                    e.currentTarget.style.transform = 'scale(1.15)';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.background = DS.surface;
                    e.currentTarget.style.color = DS.sidebarText;
                    e.currentTarget.style.borderColor = DS.border;
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.5)';
                    e.currentTarget.style.transform = 'scale(1)';
                }}
            >
                {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
            </button>
        </aside>
    );
};

/* ─────────────────────────────────────────────────────────────────
   WEBSOCKET HOOK
   ───────────────────────────────────────────────────────────────── */
const useWebSocket = (onMessage) => {
    const [connected, setConnected] = useState(false);
    const [reconnecting] = useState(false); // polling never shows "reconnecting"
    const stopRef = useRef(null);

    useEffect(() => {
        // connectWS now uses HTTP polling — no WebSocket, works on Vercel
        stopRef.current = connectWS((msg) => {
            setConnected(true);
            onMessage(msg);
        });
        return () => {
            if (stopRef.current) stopRef.current();
        };
    }, [onMessage]);

    return { connected, reconnecting };
};

/* ─────────────────────────────────────────────────────────────────
   CONNECTION SELECTOR — dropdown in the header to switch databases
   ───────────────────────────────────────────────────────────────── */
const ConnectionSelector = () => {
    const { connections, activeConnectionId, activeConnection, switchConnection, loading } = useConnection();
    const { goToTab } = useContext(NavigationContext) || {};
    const [open, setOpen] = useState(false);
    const [switching, setSwitching] = useState(false);
    const ref = useRef(null);

    // Close on outside click
    useEffect(() => {
        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleSwitch = async (id) => {
        if (id === activeConnectionId) {
            setOpen(false);
            return;
        }
        setSwitching(true);
        try {
            await switchConnection(id);
            // Auto-navigate to appropriate overview tab based on database type
            const targetConnection = connections.find((c) => c.id === id);
            if (targetConnection && goToTab) {
                const dbType = targetConnection.dbType?.toLowerCase();
                let targetTab = 'overview'; // Default to PostgreSQL overview

                if (dbType === 'mysql' || dbType === 'mariadb') {
                    targetTab = 'mysql-overview';
                } else if (dbType === 'mongodb') {
                    targetTab = 'mongo-overview';
                } else if (dbType && PHASE5_DEMO_TABS[dbType]) {
                    targetTab = PHASE5_DEMO_TABS[dbType];
                }

                // Defer navigation to allow state to settle
                setTimeout(() => {
                    goToTab(targetTab);
                }, 100);
            }
        } catch (err) {
            console.error('Switch failed:', err);
        } finally {
            setSwitching(false);
            setOpen(false);
        }
    };

    if (loading || connections.length === 0) return null;

    const displayName = activeConnection?.name || 'Select DB';
    const connString = activeConnection
        ? `${activeConnection.host}:${activeConnection.port}/${activeConnection.database}`
        : '';
    const statusColor =
        activeConnection?.status === 'success'
            ? DS.emerald
            : activeConnection?.status === 'failed'
              ? DS.rose
              : DS.amber;
    const statusLabel =
        activeConnection?.status === 'success'
            ? 'connected'
            : activeConnection?.status === 'failed'
              ? 'failed'
              : 'untested';

    return (
        <div ref={ref} style={{ position: 'relative' }}>
            {/* ── Trigger button — shows name + connection string ── */}
            <button
                onClick={() => setOpen((p) => !p)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '5px 10px 5px 9px',
                    background: open ? DS.surfaceHover : DS.surface,
                    border: `1px solid ${open ? DS.borderAccent : DS.border}`,
                    borderRadius: 8,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    maxWidth: 280,
                }}
                title={`Active: ${displayName}\n${connString}\nStatus: ${statusLabel}`}
            >
                {/* Status dot / spinner */}
                {switching ? (
                    <div
                        style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            border: `1.5px solid ${DS.border}`,
                            borderTopColor: DS.cyan,
                            animation: 'rotate 0.7s linear infinite',
                            flexShrink: 0,
                        }}
                    />
                ) : (
                    <span
                        style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: statusColor,
                            flexShrink: 0,
                            boxShadow: `0 0 5px ${statusColor}88`,
                        }}
                    />
                )}
                <Database size={12} style={{ color: DS.cyan, flexShrink: 0 }} />
                {/* Two-line label: name on top, connection string below */}
                <div
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 0, flex: 1 }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
                        <span
                            style={{
                                fontSize: 12,
                                fontWeight: 600,
                                color: DS.textPrimary,
                                fontFamily: DS.fontMono,
                                maxWidth: 140,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                lineHeight: 1.2,
                            }}
                        >
                            {displayName}
                        </span>
                        {/* Database type badge */}
                        {activeConnection && (
                            <span
                                style={{
                                    fontSize: 9,
                                    fontWeight: 700,
                                    color: DS.cyan,
                                    background: `${DS.cyan}15`,
                                    border: `1px solid ${DS.cyan}40`,
                                    borderRadius: 3,
                                    padding: '2px 6px',
                                    flexShrink: 0,
                                    letterSpacing: '0.02em',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    lineHeight: 1,
                                }}
                                title={`Database type: ${activeConnection.dbType || 'unknown'}`}
                            >
                                {activeConnection.dbType === 'postgresql'
                                    ? 'PG'
                                    : activeConnection.dbType === 'mysql'
                                      ? 'MySQL'
                                      : activeConnection.dbType === 'mariadb'
                                        ? 'Maria'
                                        : activeConnection.dbType === 'mongodb'
                                          ? 'Mongo'
                                          : 'DB'}
                            </span>
                        )}
                    </div>
                    {connString && (
                        <span
                            style={{
                                fontSize: 10,
                                color: DS.textMuted,
                                fontFamily: DS.fontMono,
                                maxWidth: 160,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                lineHeight: 1.3,
                                letterSpacing: '0.01em',
                            }}
                        >
                            {connString}
                        </span>
                    )}
                </div>
                <ChevronDown
                    size={12}
                    style={{
                        color: DS.textMuted,
                        flexShrink: 0,
                        transform: open ? 'rotate(180deg)' : 'none',
                        transition: 'transform 0.2s ease',
                    }}
                />
            </button>

            {/* ── Dropdown ── */}
            {open && (
                <div
                    style={{
                        position: 'absolute',
                        top: 'calc(100% + 6px)',
                        right: 0,
                        background: DS.surface,
                        border: `1px solid ${DS.border}`,
                        borderRadius: 10,
                        boxShadow: DS.shadowDeep,
                        minWidth: 300,
                        zIndex: 300,
                        overflow: 'hidden',
                        animation: 'slideDown 0.15s ease-out both',
                    }}
                >
                    {/* Header */}
                    <div style={{ padding: '10px 14px 8px', borderBottom: `1px solid ${DS.border}` }}>
                        <div
                            style={{
                                fontSize: 10,
                                color: DS.textMuted,
                                fontFamily: DS.fontMono,
                                letterSpacing: '0.02em',
                                marginBottom: 4,
                            }}
                        >
                            DATABASE CONNECTIONS
                        </div>
                        {/* Active connection string prominently shown */}
                        {activeConnection && (
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    padding: '5px 8px',
                                    background: `${DS.cyan}10`,
                                    border: `1px solid ${DS.cyan}30`,
                                    borderRadius: 6,
                                }}
                            >
                                <span
                                    style={{
                                        width: 6,
                                        height: 6,
                                        borderRadius: '50%',
                                        background: statusColor,
                                        flexShrink: 0,
                                        boxShadow: `0 0 4px ${statusColor}`,
                                    }}
                                />
                                <span
                                    style={{
                                        fontSize: 11,
                                        color: DS.cyan,
                                        fontFamily: DS.fontMono,
                                        letterSpacing: '0.02em',
                                    }}
                                >
                                    {activeConnection.username}@{activeConnection.host}:{activeConnection.port}/
                                    {activeConnection.database}
                                </span>
                                {activeConnection.ssl && (
                                    <span
                                        style={{
                                            fontSize: 9,
                                            color: DS.emerald,
                                            background: `${DS.emerald}18`,
                                            padding: '1px 5px',
                                            borderRadius: 14,
                                            fontFamily: DS.fontMono,
                                            flexShrink: 0,
                                        }}
                                    >
                                        SSL
                                    </span>
                                )}
                                {activeConnection.sshEnabled && (
                                    <span
                                        style={{
                                            fontSize: 9,
                                            color: DS.violet || THEME.primaryLight,
                                            background: `${DS.violet || THEME.primaryLight}18`,
                                            padding: '1px 5px',
                                            borderRadius: 14,
                                            fontFamily: DS.fontMono,
                                            flexShrink: 0,
                                        }}
                                    >
                                        SSH
                                    </span>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Connection list */}
                    <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                        {connections.map((c) => {
                            const isActive = c.id === activeConnectionId;
                            const cs =
                                activeConnection?.status === 'success'
                                    ? DS.emerald
                                    : c.status === 'failed'
                                      ? DS.rose
                                      : DS.amber;
                            return (
                                <button
                                    key={c.id}
                                    onClick={() => handleSwitch(c.id)}
                                    style={{
                                        width: '100%',
                                        textAlign: 'left',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 10,
                                        padding: '10px 14px',
                                        background: isActive ? `${DS.cyan}12` : 'transparent',
                                        border: 'none',
                                        borderBottom: `1px solid ${DS.border}`,
                                        cursor: 'pointer',
                                        transition: 'background 0.12s',
                                    }}
                                    className="nav-item"
                                >
                                    <span
                                        style={{
                                            width: 8,
                                            height: 8,
                                            borderRadius: '50%',
                                            flexShrink: 0,
                                            background:
                                                c.status === 'success'
                                                    ? DS.emerald
                                                    : c.status === 'failed'
                                                      ? DS.rose
                                                      : DS.amber,
                                            boxShadow: isActive ? `0 0 5px ${cs}` : 'none',
                                        }}
                                    />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div
                                            style={{
                                                fontWeight: 600,
                                                fontSize: 13,
                                                color: isActive ? DS.cyan : DS.textPrimary,
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                            }}
                                        >
                                            {c.name}
                                            {isActive && (
                                                <span
                                                    style={{
                                                        marginLeft: 6,
                                                        fontSize: 10,
                                                        color: DS.emerald,
                                                        fontWeight: 400,
                                                    }}
                                                >
                                                    ● active
                                                </span>
                                            )}
                                        </div>
                                        {/* Full connection string on second line */}
                                        <div
                                            style={{
                                                fontSize: 11,
                                                color: DS.textMuted,
                                                fontFamily: DS.fontMono,
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                                marginTop: 2,
                                            }}
                                        >
                                            {c.username}@{c.host}:{c.port}/{c.database}
                                            {c.ssl ? ' 🔒' : ''}
                                            {c.sshEnabled ? ' 🔑' : ''}
                                        </div>
                                    </div>
                                    {isActive ? (
                                        <CheckCircle size={14} style={{ color: DS.cyan, flexShrink: 0 }} />
                                    ) : (
                                        <span
                                            style={{
                                                fontSize: 10,
                                                color: DS.textMuted,
                                                fontFamily: DS.fontMono,
                                                flexShrink: 0,
                                            }}
                                        >
                                            switch
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Footer */}
                    <div
                        style={{
                            padding: '8px 14px',
                            borderTop: `1px solid ${DS.border}`,
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                        }}
                    >
                        <span style={{ fontSize: 11, color: DS.textMuted, fontFamily: DS.fontMono }}>
                            {connections.length} connection{connections.length !== 1 ? 's' : ''} configured
                        </span>
                        <span
                            onClick={() => {
                                goToTab?.('connections');
                                setOpen(false);
                            }}
                            style={{
                                fontSize: 11,
                                color: DS.cyan,
                                fontFamily: DS.fontMono,
                                cursor: 'pointer',
                                textDecoration: 'underline',
                                textDecorationStyle: 'dotted',
                            }}
                        >
                            Manage connections →
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
};

/* ─────────────────────────────────────────────────────────────────
   DASHBOARD
   ───────────────────────────────────────────────────────────────── */
const Dashboard = ({ onLogout }) => (
    <ConnectionProvider>
        {/* Enterprise providers — required by LicenseGate (Redis/Elasticsearch/
            Anomaly Detectors/Trace Detail views) and by useOrg() consumers. */}
        <LicenseProvider>
            <OrgProvider>
                <DashboardInner onLogout={onLogout} />
            </OrgProvider>
        </LicenseProvider>
    </ConnectionProvider>
);

const DashboardInner = ({ onLogout }) => {
    const { logout: authLogout, currentUser: authUser } = useAuth();
    const { isDemo, demoUser } = useDemo();
    const currentUser = authUser || (isDemo ? demoUser : null);
    // Use the parent-provided onLogout (which plays the fade-out) if available,
    // falling back to the raw logout for any edge-cases.
    const logout = onLogout || authLogout;
    const { isDark } = useTheme();
    useAdaptiveTheme(); // also keeps module-level THEME in sync for ChartDefs + GlobalStyles

    /* Keep module-level DS in sync with ThemeContext on every render */
    DS = isDark ? DS_DARK : DS_LIGHT;
    setDS(DS);

    // Default to 'overview' always. The ACTIVE_TAB key is cleared by AuthContext
    // on logout, so every fresh login session starts at the Overview page.
    // Within a session, tab navigation is persisted as before.
    const [activeTab, setActiveTab] = useState(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB);
            // Migrate legacy default: UserManagement → connections
            if (saved === 'UserManagement') return 'connections';
            return saved || 'connections';
        } catch {
            return 'connections';
        }
    });
    const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
        try {
            return localStorage.getItem(STORAGE_KEYS.SIDEBAR_COLLAPSED) === 'true';
        } catch {
            return false;
        }
    });

    // Cross-component tab navigation. Any component can dispatch
    //   window.dispatchEvent(new CustomEvent('fathom:navigate-tab',
    //     { detail: { tab: 'trace-correlation', payload: { traceId } } }))
    // to switch tabs and hand a payload to the target tab (read once from
    // sessionStorage under fathom:tab-payload:<tab>).
    useEffect(() => {
        const onNav = (e) => {
            const tab = e && e.detail && e.detail.tab;
            if (!tab) return;
            if (e.detail.payload !== undefined) {
                try {
                    sessionStorage.setItem('fathom:tab-payload:' + tab, JSON.stringify(e.detail.payload));
                } catch {
                    /* ignore */
                }
            }
            setActiveTab(tab);
            try {
                localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB, tab);
            } catch {
                /* ignore */
            }
        };
        window.addEventListener('fathom:navigate-tab', onNav);
        return () => window.removeEventListener('fathom:navigate-tab', onNav);
    }, []);
    const [notifications, setNotifications] = useState([]);
    const [latestAlert, setLatestAlert] = useState(null);
    const [showFeedback, setShowFeedback] = useState(false);
    const [showProfile, setShowProfile] = useState(false);
    const [profileUser, setProfileUser] = useState(currentUser);
    const prevTabRef = useRef(activeTab);

    // Demo accounts (demo_user1..N) land straight in the demo experience instead
    // of the empty "No connections yet" screen. Runs once per login session.
    const demoRedirectedRef = useRef(false);
    useEffect(() => {
        const uname = (authUser?.username || '').toLowerCase();
        if (!demoRedirectedRef.current && uname.startsWith('demo_user')) {
            demoRedirectedRef.current = true;
            setActiveTab('demo-postgres');
            try {
                localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB, 'demo-postgres');
            } catch {
                /* ignore */
            }
        }
    }, [authUser]);

    const handleWSMessage = useCallback((msg) => {
        if (msg.type === 'alert') {
            const n = {
                id: Date.now(),
                title: msg.payload.title || 'Alert',
                message: msg.payload.message,
                severity: msg.payload.severity || 'info',
                timestamp: Date.now(),
                read: false,
            };
            setNotifications((p) => [n, ...p].slice(0, MAX_NOTIFICATIONS));
            setLatestAlert(msg.payload);
            setTimeout(() => setLatestAlert(null), ALERT_AUTO_DISMISS_TIME);
        }
    }, []);

    const { connected, reconnecting } = useWebSocket(handleWSMessage);
    const { activeConnection, loading: connectionsLoading } = useConnection();

    // Feedback prompt — only when at least one connection exists. Feedback is
    // scoped to a connected database, so with no connection there's nothing to
    // give feedback on and the prompt (and button) are hidden.
    useEffect(() => {
        if (!activeConnection) return;
        if (!localStorage.getItem(STORAGE_KEYS.FEEDBACK_PROMPT)) {
            const t = setTimeout(() => {
                setShowFeedback(true);
                localStorage.setItem(STORAGE_KEYS.FEEDBACK_PROMPT, 'true');
            }, 3000);
            return () => clearTimeout(t);
        }
    }, [activeConnection]);

    // Track whether ConnectionContext has completed its first load.
    // Until that happens, we must NOT redirect — activeConnection is null
    // simply because the API hasn't responded yet, not because there's no connection.
    const connectionsInitialized = useRef(false);
    useEffect(() => {
        if (!connectionsLoading) connectionsInitialized.current = true;
    }, [connectionsLoading]);

    // Track the previous activeConnection id to detect actual connection *changes*
    // (switch/delete), as opposed to first-load resolution.
    const prevConnectionId = useRef(activeConnection?.id ?? '__initial__');

    // Auto-navigate to appropriate overview tab when connection changes
    // This ensures users see the right dashboard after switching databases
    // Also redirects to connections tab when no connection exists and user is on a connection-dependent tab
    useEffect(() => {
        // Don't redirect while connections are still loading from the backend
        if (!connectionsInitialized.current) return;

        // No connection → only demo tabs, connections, and user management are allowed
        if (!activeConnection) {
            if (activeTab?.startsWith('demo-')) return;
            if (activeTab === 'connections') return;
            if (activeTab === 'UserManagement' || activeTab === 'user-audit') return;
            setActiveTab('connections');
            try {
                localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB, 'connections');
            } catch {}
            prevConnectionId.current = null;
            return;
        }

        const dbType = activeConnection.dbType?.toLowerCase();
        let targetTab = 'overview'; // Default to PostgreSQL overview

        if (dbType === 'mysql' || dbType === 'mariadb') {
            targetTab = 'mysql-overview';
        } else if (dbType === 'mongodb') {
            targetTab = 'mongo-overview';
        } else if (dbType && PHASE5_DEMO_TABS[dbType]) {
            targetTab = PHASE5_DEMO_TABS[dbType];
        }

        // Only auto-navigate when the connection actually CHANGES (user switched DBs),
        // NOT on initial page load where we should respect the saved tab.
        const connectionChanged =
            prevConnectionId.current !== '__initial__' && prevConnectionId.current !== activeConnection.id;
        prevConnectionId.current = activeConnection.id;

        if (!connectionChanged) return; // On page load, stay on the saved tab

        // Only navigate if we're not already on a relevant tab for this connection
        // This avoids jarring navigation if user is already viewing a universal tab (like Alerts)
        const isRelevantTab = (tabId) => {
            // Always allow demo tabs and connections
            if (tabId?.startsWith('demo-')) return true;
            if (tabId === 'connections') return true;
            // Always allow universal sections
            const universalSections = [
                'Overview',
                'Alerts & Rules',
                'Security',
                'Observability',
                'Developer Tools',
                'User Management',
                'Admin',
                'Connections',
            ];
            const currentSection = SECTION_GROUPS.find((g) => g.tabs.some((t) => t.id === tabId))?.section;
            if (universalSections.includes(currentSection)) return true;

            // For DB-specific tabs, only allow if they match current connection
            if (
                dbType === 'postgresql' &&
                ['Query Analysis', 'Schema & Data', 'Infrastructure'].includes(currentSection)
            )
                return true;
            if ((dbType === 'mysql' || dbType === 'mariadb') && currentSection === 'MySQL') return true;
            if (dbType === 'mongodb' && currentSection === 'MongoDB') return true;
            return false;
        };

        // Only auto-navigate if current tab is not relevant for this connection
        if (!isRelevantTab(activeTab)) {
            setActiveTab(targetTab);
            try {
                localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB, targetTab);
            } catch {}
        }
    }, [connectionsLoading, activeConnection?.id, activeTab]); // Re-run when loading finishes, connection changes, or tab changes

    // Demo users (username contains "demo_user") are locked to the Demo section
    // only — every other tab is hidden from them across the whole app.
    const isDemoUser = useMemo(() => (currentUser?.username || '').toLowerCase().includes('demo_user'), [currentUser]);

    const allowedTabIds = useMemo(
        () =>
            TABS_ONLY.filter((t) => {
                // Demo users: ONLY demo tabs are ever allowed.
                if (isDemoUser) return t.id.startsWith('demo-');
                // Demo tabs are always visible for any logged-in user
                if (t.id.startsWith('demo-')) return true;
                // If user is logged in, show all tabs
                if (currentUser) return true;
                // Fallback: check allowedScreens
                return (currentUser?.allowedScreens || []).includes(t.id);
            }).map((t) => t.id),
        [currentUser, isDemoUser],
    );

    const ActiveComponent = useMemo(() => {
        const tab = TABS_ONLY.find((t) => t.id === activeTab && allowedTabIds.includes(t.id));
        if (tab) return tab.component;
        return TABS_ONLY.find((t) => allowedTabIds.includes(t.id))?.component;
    }, [activeTab, allowedTabIds]);

    const activeTabMeta = useMemo(() => TABS_ONLY.find((t) => t.id === activeTab), [activeTab]);
    const accent = useMemo(() => getSectionAccent(activeTab), [activeTab]);
    const isDemoFullPage = activeTab?.startsWith('demo-');

    const handleTabChange = useCallback(
        (id) => {
            prevTabRef.current = activeTab;
            setActiveTab(id);
            try {
                localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB, id);
            } catch {}
        },
        [activeTab],
    );

    const handleToggleCollapse = useCallback(() => {
        setSidebarCollapsed((p) => {
            const v = !p;
            try {
                localStorage.setItem(STORAGE_KEYS.SIDEBAR_COLLAPSED, v.toString());
            } catch {}
            return v;
        });
    }, []);

    const handleDismissNotification = useCallback((id) => setNotifications((p) => p.filter((n) => n.id !== id)), []);
    const handleClearAllNotifications = useCallback(() => setNotifications([]), []);

    const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);

    /* Keyboard shortcuts: Ctrl+B (sidebar), Ctrl+K (search), Ctrl+? (help), etc. */
    useEffect(() => {
        const handler = (e) => {
            const isMod = e.ctrlKey || e.metaKey;

            // Escape: Close help dialog if open
            if (e.key === 'Escape' && showKeyboardHelp) {
                e.preventDefault();
                setShowKeyboardHelp(false);
                return;
            }

            // Ctrl+B: Toggle sidebar
            if (isMod && e.key === 'b') {
                e.preventDefault();
                handleToggleCollapse();
            }
            // Ctrl+?: Show keyboard help
            else if (isMod && (e.key === '?' || (e.shiftKey && e.key === '/'))) {
                e.preventDefault();
                setShowKeyboardHelp((prev) => !prev);
            }
            // Ctrl+O: Go to overview
            else if (isMod && e.key === 'o') {
                e.preventDefault();
                handleTabChange('overview');
            }
            // Ctrl+Shift+D: Toggle demo mode
            else if (isMod && e.shiftKey && e.key === 'd') {
                e.preventDefault();
                // Demo mode toggle would be handled by DemoContext
            }
        };

        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [handleToggleCollapse, handleTabChange, showKeyboardHelp]);

    return (
        <NavigationContext.Provider value={{ goToTab: handleTabChange }}>
            <div
                style={{
                    display: 'flex',
                    height: '100vh',
                    width: '100%',
                    background: isDemoFullPage ? THEME.surfaceHover : DS.bg,
                    color: isDemoFullPage ? THEME.bg : DS.textPrimary,
                    overflow: 'hidden',
                    fontFamily: DS.fontUI,
                    position: 'relative',
                    zIndex: 1,
                }}
            >
                <AppStyles />
                <ChartDefs />
                <AmbientOrbs />

                {!isDemoFullPage && (
                    <Sidebar
                        activeTab={activeTab}
                        onTabChange={handleTabChange}
                        onLogout={logout}
                        currentUser={profileUser}
                        collapsed={sidebarCollapsed}
                        onToggleCollapse={handleToggleCollapse}
                        onOpenFeedback={() => setShowFeedback(true)}
                        onOpenProfile={() => setShowProfile(true)}
                        allowedTabIds={allowedTabIds}
                    />
                )}

                <main
                    style={{
                        flex: 1,
                        minWidth: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                        position: 'relative',
                        zIndex: 1,
                    }}
                >
                    {/* ── TOP HEADER ── */}
                    <header
                        style={{
                            height: isDemoFullPage ? 0 : 54,
                            flexShrink: 0,
                            borderBottom: isDemoFullPage ? 'none' : `1px solid ${DS.border}`,
                            display: isDemoFullPage ? 'none' : 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0 24px',
                            background: DS.headerBg,
                            backdropFilter: 'blur(12px)',
                            WebkitBackdropFilter: 'blur(12px)',
                            position: 'sticky',
                            top: 0,
                            zIndex: 40,
                        }}
                    >
                        {/* Clean bottom border — no animation */}

                        {/* Left: breadcrumb + reconnecting */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                            {/* Breadcrumb navigation — shows current section / tab */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span
                                        style={{
                                            fontSize: 11,
                                            color: DS.textMuted,
                                            fontFamily: DS.fontMono,
                                            letterSpacing: '0.02em',
                                        }}
                                    >
                                        {getSectionForTab(activeTab) || 'Core'}
                                    </span>
                                    <span style={{ color: DS.textMuted, fontSize: 13 }}>/</span>
                                    <h2
                                        style={{
                                            fontSize: 15,
                                            fontWeight: 700,
                                            margin: 0,
                                            color: DS.textPrimary,
                                            letterSpacing: '-0.01em',
                                        }}
                                    >
                                        {activeTabMeta?.label || ''}
                                    </h2>
                                </div>
                            </div>

                            {reconnecting && (
                                <div
                                    style={{
                                        fontSize: 11,
                                        color: DS.amber,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 6,
                                        padding: '4px 10px',
                                        background: 'rgba(251,191,36,0.08)',
                                        borderRadius: 20,
                                        border: '1px solid rgba(251,191,36,0.25)',
                                        fontFamily: DS.fontMono,
                                    }}
                                >
                                    <WifiOff size={12} style={{ animation: 'pulse 1.5s infinite' }} />
                                    RECONNECTING…
                                </div>
                            )}
                        </div>

                        {/* Right: connection switcher + status + refresh + bell + theme */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                            <Suspense fallback={<ConnectionSelector />}>
                                <ConnectionSwitcherLazy />
                            </Suspense>
                            <Suspense fallback={null}>
                                <DatabaseSwitcherLazy />
                            </Suspense>
                            <div style={{ width: 1, height: 24, background: DS.border }} />
                            <GlobalRefreshButton />
                            <ThemeToggle />
                            <StatusPill connected={connected} />
                            <NotificationCenter
                                notifications={notifications}
                                onDismiss={handleDismissNotification}
                                onClearAll={handleClearAllNotifications}
                            />
                        </div>
                    </header>

                    {/* Demo mode banner removed — live data only */}

                    {/* ── MAIN CONTENT ── */}
                    <div
                        className="main-scroll"
                        style={{
                            flex: 1,
                            overflowY: 'auto',
                            overflowX: 'hidden',
                            position: 'relative',
                            background: isDemoFullPage ? 'transparent' : DS.bg,
                        }}
                    >
                        {/* Floating alert toast */}
                        {latestAlert && (
                            <div
                                style={{
                                    position: 'fixed',
                                    top: 78,
                                    right: 28,
                                    zIndex: 200,
                                    width: 380,
                                    animation: 'slideInRight 0.3s cubic-bezier(0.34,1.4,0.64,1) both',
                                }}
                            >
                                <div
                                    style={{
                                        background: DS.surface,
                                        borderRadius: 12,
                                        overflow: 'hidden',
                                        border: `1px solid ${SEV_COLORS[latestAlert.severity] || DS.cyan}50`,
                                        boxShadow: DS.shadowCard,
                                    }}
                                >
                                    <div
                                        style={{ height: 2.5, background: SEV_COLORS[latestAlert.severity] || DS.cyan }}
                                    />
                                    <AlertBanner alert={latestAlert} onDismiss={() => setLatestAlert(null)} />
                                </div>
                            </div>
                        )}

                        <div
                            style={{
                                padding: isDemoFullPage ? 0 : '16px 20px',
                                width: '100%',
                                minHeight: '100%',
                                position: 'relative',
                            }}
                        >
                            <ErrorBoundary key={activeTab}>
                                <Suspense
                                    fallback={
                                        <div style={{ animation: 'fadeUp 0.3s ease-out' }}>
                                            {/* Enhanced loading state with skeleton cards */}
                                            <div
                                                style={{
                                                    display: 'grid',
                                                    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                                                    gap: 16,
                                                    marginBottom: 24,
                                                }}
                                            >
                                                {Array.from({ length: 3 }).map((_, i) => (
                                                    <div
                                                        key={i}
                                                        style={{
                                                            height: 160,
                                                            borderRadius: 12,
                                                            background: `linear-gradient(90deg, ${DS.surface} 0%, ${DS.surfaceHover} 50%, ${DS.surface} 100%)`,
                                                            backgroundSize: '200% 100%',
                                                            animation: 'shimmer 2s infinite',
                                                            border: `1px solid ${DS.border}`,
                                                        }}
                                                    />
                                                ))}
                                            </div>
                                            <div
                                                style={{
                                                    height: 300,
                                                    borderRadius: 12,
                                                    background: `linear-gradient(90deg, ${DS.surface} 0%, ${DS.surfaceHover} 50%, ${DS.surface} 100%)`,
                                                    backgroundSize: '200% 100%',
                                                    animation: 'shimmer 2s infinite',
                                                    border: `1px solid ${DS.border}`,
                                                }}
                                            />
                                            <div
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    marginTop: 24,
                                                    gap: 12,
                                                    color: DS.textMuted,
                                                    fontFamily: DS.fontUI,
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        width: 22,
                                                        height: 22,
                                                        borderRadius: '50%',
                                                        border: `2px solid ${DS.border}`,
                                                        borderTopColor: DS.cyan,
                                                        animation: 'rotate 0.9s linear infinite',
                                                    }}
                                                />
                                                <span style={{ fontSize: 13 }}>Loading tab…</span>
                                            </div>
                                        </div>
                                    }
                                >
                                    <div
                                        key={activeTab}
                                        className="tab-mount"
                                        role="tabpanel"
                                        aria-labelledby={`${activeTab}-tab`}
                                    >
                                        <SectionErrorBoundary
                                            sectionName={activeTabMeta?.label || activeTab}
                                            key={activeTab}
                                        >
                                            {ActiveComponent && <ActiveComponent tabId={activeTab} />}
                                        </SectionErrorBoundary>
                                    </div>
                                </Suspense>
                            </ErrorBoundary>
                        </div>
                    </div>
                </main>

                {showFeedback && activeConnection && (
                    <FeedbackModal onClose={() => setShowFeedback(false)} initialSection={activeTab} />
                )}
                {showProfile && (
                    <ProfileModal
                        user={profileUser}
                        onClose={() => setShowProfile(false)}
                        onSave={(u) => setProfileUser(u)}
                    />
                )}

                {/* Keyboard Shortcuts Help Modal */}
                {showKeyboardHelp && (
                    <div
                        style={{
                            position: 'fixed',
                            inset: 0,
                            background: 'rgba(0,0,0,0.75)',
                            backdropFilter: 'blur(4px)',
                            zIndex: 2000,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            animation: 'fadeIn 0.2s ease-out',
                        }}
                        onClick={(e) => e.target === e.currentTarget && setShowKeyboardHelp(false)}
                    >
                        <div
                            style={{
                                background: DS.surface,
                                border: `1px solid ${DS.borderAccent}`,
                                borderRadius: 16,
                                width: 520,
                                maxWidth: '90vw',
                                maxHeight: '80vh',
                                boxShadow: `${DS.shadowDeep}`,
                                overflow: 'hidden',
                                display: 'flex',
                                flexDirection: 'column',
                                animation: 'slideUp 0.3s cubic-bezier(0.34,1.4,0.64,1) both',
                            }}
                        >
                            {/* Header */}
                            <div
                                style={{
                                    padding: '20px 26px 18px',
                                    borderBottom: `1px solid ${DS.border}`,
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                }}
                            >
                                <div>
                                    <h3
                                        style={{
                                            margin: '0 0 4px',
                                            fontSize: 17,
                                            fontWeight: 700,
                                            color: DS.textPrimary,
                                            letterSpacing: '-0.02em',
                                        }}
                                    >
                                        Keyboard Shortcuts
                                    </h3>
                                    <p
                                        style={{
                                            margin: 0,
                                            fontSize: 11,
                                            color: DS.textMuted,
                                            fontFamily: DS.fontMono,
                                            letterSpacing: '0.02em',
                                        }}
                                    >
                                        Press Ctrl+? anytime to toggle this dialog
                                    </p>
                                </div>
                                <button
                                    onClick={() => setShowKeyboardHelp(false)}
                                    style={{
                                        background: 'rgba(255,255,255,0.04)',
                                        border: `1px solid ${DS.border}`,
                                        color: DS.textSub,
                                        cursor: 'pointer',
                                        width: 32,
                                        height: 32,
                                        borderRadius: 8,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        transition: 'all 0.15s',
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.background = 'rgba(251,113,133,0.12)';
                                        e.currentTarget.style.color = DS.rose;
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                                        e.currentTarget.style.color = DS.textSub;
                                    }}
                                >
                                    <X size={15} strokeWidth={2} />
                                </button>
                            </div>

                            {/* Content */}
                            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 26px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                                    {/* Navigation */}
                                    <div>
                                        <div
                                            style={{
                                                fontSize: 11,
                                                fontWeight: 700,
                                                letterSpacing: '0.02em',
                                                color: DS.cyan,
                                                marginBottom: 12,
                                            }}
                                        >
                                            Navigation
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                                                <kbd
                                                    style={{
                                                        fontSize: 11,
                                                        color: DS.textMuted,
                                                        background: 'rgba(255,255,255,0.05)',
                                                        border: `1px solid ${DS.border}`,
                                                        padding: '4px 8px',
                                                        borderRadius: 14,
                                                        fontFamily: DS.fontMono,
                                                    }}
                                                >
                                                    Ctrl+B
                                                </kbd>
                                                <span style={{ fontSize: 12, color: DS.textSub }}>Toggle sidebar</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                                                <kbd
                                                    style={{
                                                        fontSize: 11,
                                                        color: DS.textMuted,
                                                        background: 'rgba(255,255,255,0.05)',
                                                        border: `1px solid ${DS.border}`,
                                                        padding: '4px 8px',
                                                        borderRadius: 14,
                                                        fontFamily: DS.fontMono,
                                                    }}
                                                >
                                                    Ctrl+K
                                                </kbd>
                                                <span style={{ fontSize: 12, color: DS.textSub }}>Focus search</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                                                <kbd
                                                    style={{
                                                        fontSize: 11,
                                                        color: DS.textMuted,
                                                        background: 'rgba(255,255,255,0.05)',
                                                        border: `1px solid ${DS.border}`,
                                                        padding: '4px 8px',
                                                        borderRadius: 14,
                                                        fontFamily: DS.fontMono,
                                                    }}
                                                >
                                                    Ctrl+O
                                                </kbd>
                                                <span style={{ fontSize: 12, color: DS.textSub }}>Go to Overview</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Info */}
                                    <div>
                                        <div
                                            style={{
                                                fontSize: 11,
                                                fontWeight: 700,
                                                letterSpacing: '0.02em',
                                                color: DS.emerald,
                                                marginBottom: 12,
                                            }}
                                        >
                                            Other
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                                                <kbd
                                                    style={{
                                                        fontSize: 11,
                                                        color: DS.textMuted,
                                                        background: 'rgba(255,255,255,0.05)',
                                                        border: `1px solid ${DS.border}`,
                                                        padding: '4px 8px',
                                                        borderRadius: 14,
                                                        fontFamily: DS.fontMono,
                                                    }}
                                                >
                                                    Ctrl+?
                                                </kbd>
                                                <span style={{ fontSize: 12, color: DS.textSub }}>Show this help</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                                                <kbd
                                                    style={{
                                                        fontSize: 11,
                                                        color: DS.textMuted,
                                                        background: 'rgba(255,255,255,0.05)',
                                                        border: `1px solid ${DS.border}`,
                                                        padding: '4px 8px',
                                                        borderRadius: 14,
                                                        fontFamily: DS.fontMono,
                                                    }}
                                                >
                                                    Esc
                                                </kbd>
                                                <span style={{ fontSize: 12, color: DS.textSub }}>
                                                    Close this dialog
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div
                                    style={{
                                        marginTop: 20,
                                        padding: '12px 14px',
                                        background: `${DS.cyan}10`,
                                        border: `1px solid ${DS.cyan}30`,
                                        borderRadius: 8,
                                    }}
                                >
                                    <p style={{ margin: 0, fontSize: 12, color: DS.textSub, lineHeight: 1.5 }}>
                                        Tip: Use the search bar (Ctrl+K) to quickly find tabs by name.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Command Palette (Ctrl+K) */}
                <CommandPalette />
            </div>
        </NavigationContext.Provider>
    );
};

/* ─────────────────────────────────────────────────────────────────
   LOADING SCREEN
   ───────────────────────────────────────────────────────────────── */
const LoadingScreen = () => (
    <div
        style={{
            height: '100vh',
            background: DS.bg,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 20,
            color: DS.textPrimary,
            fontFamily: DS.fontUI,
        }}
    >
        <div style={{ position: 'relative', width: 56, height: 56 }}>
            {/* Spinning ring */}
            <div
                style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: '50%',
                    border: `2px solid ${DS.border}`,
                    borderTopColor: DS.cyan,
                    animation: 'rotate 1.1s linear infinite',
                }}
            />
            {/* Inner logo */}
            <div
                style={{
                    position: 'absolute',
                    inset: 8,
                    borderRadius: '50%',
                    background: `linear-gradient(135deg, ${DS.cyan}30, ${DS.violet}30)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                <Database color={DS.cyan} size={18} />
            </div>
        </div>
        <div>
            <div
                style={{
                    fontSize: 15,
                    fontWeight: 700,
                    color: DS.textPrimary,
                    textAlign: 'center',
                    letterSpacing: '-0.01em',
                }}
            >
                Fathom
            </div>
            <div
                style={{
                    fontSize: 11,
                    color: DS.textMuted,
                    textAlign: 'center',
                    marginTop: 4,
                    fontFamily: DS.fontMono,
                    letterSpacing: '0.02em',
                }}
            >
                INITIALIZING…
            </div>
        </div>
    </div>
);

/* ─────────────────────────────────────────────────────────────────
   AUTH CONSUMER + APP ENTRY
   ─────────────────────────────────────────────────────────────────
   Handles the login→dashboard and logout→login transitions.

   Login flow:
     - LoginPage fires login() → AuthContext sets currentUser
     - We hold the route switch for LOGIN_REDIRECT_DELAY ms so the
       "Authenticated / Redirecting…" success animation has time to
       complete before we unmount the login page.

   Logout flow:
     - Dashboard calls handleLogout() → starts a 400 ms fade-out
       overlay, then calls AuthContext logout() which clears the user
       and triggers the route change to /login.
   ───────────────────────────────────────────────────────────────── */

/**
 * LoginModal — dimmed full-screen overlay hosting the embedded LoginPage card.
 * Clicking the backdrop (or Esc / the card's close button) dismisses it. Keeps
 * sign-in on the SAME page as the landing rather than routing to /login.
 */
const LoginModal = ({ onClose }: { onClose: () => void }) => {
    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = prev;
        };
    }, []);
    return (
        <div
            onClick={onClose}
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 1000,
                background: 'rgba(7, 11, 20, 0.72)',
                backdropFilter: 'blur(6px)',
                WebkitBackdropFilter: 'blur(6px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '24px 16px',
            }}
        >
            <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 940 }}>
                <LoginPage embedded onClose={onClose} />
            </div>
        </div>
    );
};

const AuthConsumer = () => {
    const { currentUser, loading, logout, mustChangePassword, clearMustChangePassword } = useAuth();
    const { isDemo, exitDemo } = useDemo();

    // readyToEnter is true immediately when logged in — no delay needed
    // (the login-success overlay has been removed; we go straight to the dashboard)
    const [readyToEnter, setReadyToEnter] = useState(!!currentUser || isDemo);
    const prevUser = useRef(currentUser);

    // Inline login: open the login form as a modal over the landing page instead
    // of navigating to a separate /login page. On success, AuthContext sets
    // currentUser and the "/" route below redirects straight to /dashboard.
    const [showLogin, setShowLogin] = useState(false);
    useEffect(() => {
        if (currentUser) setShowLogin(false); // close the modal once authenticated
    }, [currentUser]);

    useEffect(() => {
        // User just logged in or demo activated → enter immediately
        if ((!prevUser.current && currentUser) || isDemo) {
            setReadyToEnter(true);
            prevUser.current = currentUser;
            return;
        }
        // User logged out and not demo → reset gate for next login
        if (prevUser.current && !currentUser && !isDemo) {
            setReadyToEnter(false);
        }
        prevUser.current = currentUser;
    }, [currentUser, isDemo]);

    // ── Logout fade-out ──────────────────────────────────────────
    const [loggingOut, setLoggingOut] = useState(false);

    const handleLogout = useCallback(() => {
        setLoggingOut(true);
        // Wait for fade-out animation, then clear auth state
        setTimeout(() => {
            if (isDemo) exitDemo();
            logout();
            setLoggingOut(false);
        }, 400);
    }, [logout, isDemo, exitDemo]);

    if (loading) return <LoadingScreen />;

    return (
        <Router>
            <Suspense fallback={<LoadingScreen />}>
                <Routes>
                    {/* 1. Public Marketing Landing Page — shown to unauthenticated visitors at / */}
                    <Route
                        path="/"
                        element={
                            !currentUser && !isDemo ? (
                                <>
                                    <LandingPage
                                        onEnterDemo={() => setShowLogin(true)}
                                        onLogin={() => setShowLogin(true)}
                                    />
                                    {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
                                </>
                            ) : (
                                <Navigate to="/dashboard" replace />
                            )
                        }
                    />

                    {/* 2. Login Route: redirect immediately to dashboard if already logged in */}
                    <Route
                        path="/login"
                        element={!currentUser && !isDemo ? <LoginPage /> : <Navigate to="/dashboard" replace />}
                    />

                    {/* 3. SSO Callback Route */}
                    <Route path="/auth/callback" element={<SSOCallback />} />

                    {/* 5. Connection Onboarding Wizard */}
                    <Route
                        path="/onboarding"
                        element={
                            currentUser || isDemo ? (
                                <NavigationContext.Provider
                                    value={{ goToTab: () => (window.location.href = '/dashboard') }}
                                >
                                    <ConnectionWizard />
                                </NavigationContext.Provider>
                            ) : (
                                <Navigate to="/login" replace />
                            )
                        }
                    />

                    {/* 6. Protected Dashboard Route */}
                    <Route
                        path="/dashboard/*"
                        element={
                            (currentUser || isDemo) && readyToEnter ? (
                                <ErrorBoundary>
                                    {/* Force password change modal — blocks dashboard access */}
                                    {mustChangePassword && !isDemo && (
                                        <ForcePasswordChangeModal
                                            onSuccess={clearMustChangePassword}
                                            onLogout={handleLogout}
                                        />
                                    )}
                                    {/* Full-screen fade overlay shown during logout */}
                                    {loggingOut && (
                                        <div
                                            style={{
                                                position: 'fixed',
                                                inset: 0,
                                                zIndex: 500,
                                                background: DS.bg,
                                                animation: 'fadeIn 0.4s ease-out both',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                flexDirection: 'column',
                                                gap: 16,
                                            }}
                                        >
                                            <div
                                                style={{
                                                    width: 44,
                                                    height: 44,
                                                    borderRadius: '50%',
                                                    border: `2px solid ${DS.border}`,
                                                    borderTopColor: DS.cyan,
                                                    animation: 'rotate 0.9s linear infinite',
                                                }}
                                            />
                                            <span
                                                style={{
                                                    fontSize: 12,
                                                    color: DS.textMuted,
                                                    fontFamily: DS.fontMono,
                                                    letterSpacing: '0.02em',
                                                }}
                                            >
                                                SIGNING OUT…
                                            </span>
                                        </div>
                                    )}
                                    <Dashboard onLogout={handleLogout} />
                                </ErrorBoundary>
                            ) : (
                                <Navigate to="/login" replace />
                            )
                        }
                    />
                </Routes>
            </Suspense>
        </Router>
    );
};

export default function App() {
    return (
        <ErrorBoundary>
            <DemoProvider>
                <AuthProvider>
                    <ToastProvider>
                        <AuthConsumer />
                    </ToastProvider>
                </AuthProvider>
            </DemoProvider>
        </ErrorBoundary>
    );
}
