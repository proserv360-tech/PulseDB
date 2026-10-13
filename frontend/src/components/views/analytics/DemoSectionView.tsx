import React, { Suspense, lazy } from 'react';
import DemoDataTab from './DemoDataTab';

// The per-engine demo tabs are large, mock-data-only view components that are
// imported nowhere else. Loading them eagerly pulled every engine's bundle into
// the main chunk even though a session renders at most one. Lazy-loading them
// (audit 2026-07-24) keeps them out of the initial payload; each engine's chunk
// is fetched on demand the first time its demo tab is opened.
const DemoEngineTab       = lazy(() => import('../demo/DemoEngineTab'));
const DemoBigQueryFullTab  = lazy(() => import('../demo/DemoBigQueryFullTab'));
const DemoSnowflakeFullTab = lazy(() => import('../demo/DemoSnowflakeFullTab'));
const DemoMSSQLFullTab      = lazy(() => import('../demo/DemoMSSQLFullTab'));
const DemoOracleFullTab     = lazy(() => import('../demo/DemoOracleFullTab'));
const DemoRedisFullTab      = lazy(() => import('../demo/DemoRedisFullTab'));
const DemoElasticFullTab    = lazy(() => import('../demo/DemoElasticFullTab'));
const DemoRedshiftFullTab   = lazy(() => import('../demo/DemoRedshiftFullTab'));
const DemoCassandraFullTab  = lazy(() => import('../demo/DemoCassandraFullTab'));
const DemoDynamoDBFullTab   = lazy(() => import('../demo/DemoDynamoDBFullTab'));

/** Lightweight fallback while a lazily-loaded engine demo chunk is fetched. */
function DemoTabLoading() {
  return (
    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted, #9db4dc)', fontSize: 14 }}>
      Loading demo…
    </div>
  );
}

/**
 * DemoSectionView — a single component used for ALL demo subsection tabs.
 * Reads the active tab ID from localStorage to determine which database + section to render.
 *
 * Tab ID format: demo-{dbShort}-{subTabId}
 *   e.g. demo-pg-overview, demo-mysql-optimizer, demo-mongo-overview
 *
 * For SQL databases (pg/mysql), the subTabId is mapped to a section
 * widget ID (core, query, infra, schema, observability, dev, admin) via TAB_TO_SECTION.
 *
 * For MongoDB, the subTabId is passed through as-is because DemoDataTab already
 * handles MongoDB-specific mapping via mapSectionToWidgetId().
 *
 * For the Phase-5 engines (mssql, oracle, redis, elasticsearch, snowflake,
 * bigquery, redshift, cassandra, dynamodb) we delegate to DemoEngineTab which
 * renders a standard 11-panel layout from demoEngineData.ts.
 */

const DB_MAP = {
  pg: 'postgresql',
  mysql: 'mysql',
  mongo: 'mongodb',
};

const ENGINE_MAP = {
  mssql:         'mssql',
  oracle:        'oracle',
  redis:         'redis',
  elasticsearch: 'elasticsearch',
  es:            'elasticsearch',   // short alias
  snowflake:     'snowflake',
  sf:            'snowflake',       // short alias
  bigquery:      'bigquery',
  bq:            'bigquery',        // short alias
  redshift:      'redshift',
  rs:            'redshift',        // short alias
  cassandra:     'cassandra',
  dynamodb:      'dynamodb',
  dynamo:        'dynamodb',        // short alias
};

/** Maps individual SQL-database sub-tab IDs to section widget IDs used by DemoDataTab */
const SQL_TAB_TO_SECTION = {
  // Core Monitoring
  'overview': 'core', 'performance': 'core', 'resources': 'core',
  'reliability': 'core', 'alerts': 'core',
  // Query & Indexes
  'optimizer': 'query', 'indexes': 'query', 'regression': 'query',
  'bloat': 'query', 'table': 'query',
  // Infrastructure
  'pool': 'infra', 'replication': 'infra', 'checkpoint': 'infra',
  'maintenance': 'infra', 'capacity': 'infra', 'backup': 'infra',
  // Schema & Security
  'schema': 'schema', 'schema-viz': 'schema', 'table-deps': 'schema', 'security': 'schema',
  // Observability
  'cloudwatch': 'observability', 'log-patterns': 'observability',
  'alert-correlation': 'observability', 'opentelemetry': 'observability',
  'kubernetes': 'observability', 'status-page': 'observability',
  'ai-monitoring': 'observability',
  // Developer Tools
  'sql': 'dev', 'api': 'dev', 'repository': 'dev', 'ai-advisor': 'dev',
  // Admin
  'tasks': 'admin', 'users': 'admin', 'admin-panel': 'admin',
  'retention': 'admin', 'terraform': 'admin', 'custom-dashboard': 'admin',
  // Legacy single-section IDs (backward compat)
  'core': 'core', 'query': 'query', 'infra': 'infra',
  'observability': 'observability', 'dev': 'dev', 'admin': 'admin',
};

export default function DemoSectionView({ tabId: propTabId }) {
  // Prefer prop-based tabId (passed from App.jsx) over localStorage for reliable re-renders
  const tabId = propTabId || (() => {
    try { return localStorage.getItem('pg_monitor_active_tab') || ''; } catch { return ''; }
  })();

  // Parse: "demo-pg-overview" → dbShort="pg", subTabId="overview"
  // Parse: "demo-mongo-data-tools" → dbShort="mongo", subTabId="data-tools"
  // Parse: "demo-bigquery-waits"  → dbShort="bigquery", subTabId="waits"
  const match = tabId.match(/^demo-(\w+?)-(.+)$/);
  if (!match) {
    return <DemoDataTab dbKey="postgresql" />;
  }

  const dbShort = match[1];
  const subTabId = match[2];

  // Phase-5 engines — every one now has a dedicated bespoke tab. The
  // generic DemoEngineTab is still imported as a fallback but no longer
  // used for any known engine key; it handles only future unmapped
  // engines that get added to ENGINE_MAP before their bespoke tab ships.
  const engineKey = ENGINE_MAP[dbShort];
  if (engineKey) {
    let engineEl = null;
    if (engineKey === 'bigquery')           engineEl = <DemoBigQueryFullTab   key={tabId} subTabId={subTabId} />;
    else if (engineKey === 'snowflake')     engineEl = <DemoSnowflakeFullTab  key={tabId} subTabId={subTabId} />;
    else if (engineKey === 'mssql')         engineEl = <DemoMSSQLFullTab      key={tabId} subTabId={subTabId} />;
    else if (engineKey === 'oracle')        engineEl = <DemoOracleFullTab     key={tabId} subTabId={subTabId} />;
    else if (engineKey === 'redis')         engineEl = <DemoRedisFullTab      key={tabId} subTabId={subTabId} />;
    else if (engineKey === 'elasticsearch') engineEl = <DemoElasticFullTab    key={tabId} subTabId={subTabId} />;
    else if (engineKey === 'redshift')      engineEl = <DemoRedshiftFullTab   key={tabId} subTabId={subTabId} />;
    else if (engineKey === 'cassandra')     engineEl = <DemoCassandraFullTab  key={tabId} subTabId={subTabId} />;
    else if (engineKey === 'dynamodb')      engineEl = <DemoDynamoDBFullTab   key={tabId} subTabId={subTabId} />;
    // Fallback for any future engine mapped before its bespoke tab ships.
    else                                    engineEl = <DemoEngineTab key={tabId} engine={engineKey} subTabId={subTabId} />;
    return <Suspense fallback={<DemoTabLoading />}>{engineEl}</Suspense>;
  }

  const dbKey = DB_MAP[dbShort] || 'postgresql';

  // For MongoDB, pass the subTabId as-is — DemoDataTab's mapSectionToWidgetId handles it.
  // For SQL databases, map individual tabs back to their parent section widget ID.
  const sectionId = dbShort === 'mongo'
    ? subTabId
    : (SQL_TAB_TO_SECTION[subTabId] || subTabId);

  return <DemoDataTab key={tabId} dbKey={dbKey} sectionId={sectionId} subTabId={subTabId} />;
}
