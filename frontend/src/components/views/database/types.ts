/**
 * FATHOM Database Component Types
 * ──────────────────────────────────────────────────────────────────────────
 * Comprehensive TypeScript type definitions for all database visualization
 * and analysis components. These types ensure type safety across the database
 * tool suite.
 */

/* ═══════════════════════════════════════════════════════════════════════════
   COMMON TYPES
   ═══════════════════════════════════════════════════════════════════════════ */

export type SeverityLevel = 'low' | 'medium' | 'high' | 'critical';
export type ConnectionStatus = 'connected' | 'disconnected' | 'error';
export type SortDirection = 'asc' | 'desc';

/* ═══════════════════════════════════════════════════════════════════════════
   QUERY PLAN & EXECUTION TYPES
   ═══════════════════════════════════════════════════════════════════════════ */

export interface PlanNode {
    'Node Type': string;
    'Total Cost'?: number;
    'Startup Cost'?: number;
    'Actual Rows'?: number;
    'Plan Rows'?: number;
    'Planned Rows'?: number;
    'Actual Total Time'?: number;
    'Filter'?: string;
    'Index Name'?: string;
    'Join Type'?: string;
    'Relation Name'?: string;
    'Alias'?: string;
    'Buffer Hits'?: number;
    Plans?: PlanNode[];
}

export interface QueryPlan {
    'Planning Time'?: number;
    'Execution Time'?: number;
    Plan: PlanNode;
}

export interface QueryResult {
    rows: any[][];
    columns: string[];
    rowCount: number;
    executionTime: number;
}

/* ═══════════════════════════════════════════════════════════════════════════
   INDEX TYPES
   ═══════════════════════════════════════════════════════════════════════════ */

export interface IndexInfo {
    id: number;
    indexName: string;
    table: string;
    schema: string;
    size: string;
    sizeBytes: number;
    scans: number;
    lastUsed: string;
    definition: string;
    isUnique: boolean;
    type: 'unused' | 'duplicate' | 'missing' | 'valid';
    hash: string;
}

export interface MissingIndex extends IndexInfo {
    column: string;
    severity: SeverityLevel;
    seq_scan: number;
    idx_scan: number;
    seq_tup_read: number;
    tableSize: string;
    tableSizeBytes: number;
    estSize: string;
    currentLatency?: number | null;
    estLatency?: number | null;
    writes?: number | null;
    reads?: number | null;
}

export interface IndexHealth {
    hitRatio: number;
    totalIndexes: number;
    totalSize: string;
    totalBytes: number;
    criticalCount: number;
    seqScanRate: number;
}

/* ═══════════════════════════════════════════════════════════════════════════
   BLOAT ANALYSIS TYPES
   ═══════════════════════════════════════════════════════════════════════════ */

export interface TableBloat {
    tablename: string;
    schemaname: string;
    total_size: string;
    total_bytes: number;
    n_live_tup: number;
    n_dead_tup: number;
    dead_pct: number;
    estimated_bloat_size: string;
}

export interface IndexBloat {
    indexname: string;
    indexrelname?: string;
    tablename: string;
    relname?: string;
    schemaname: string;
    nspname?: string;
    index_size: string;
    index_bytes: number;
    idx_scan: number;
    inefficiency_pct: number;
}

export interface BloatSummary {
    total_db_size: string;
    total_tables: number;
    high_bloat_tables: number;
    critical_bloat_tables: number;
    avg_dead_pct: number;
    total_dead_tuples: number;
}

/* ═══════════════════════════════════════════════════════════════════════════
   SCHEMA TYPES
   ═══════════════════════════════════════════════════════════════════════════ */

export interface Column {
    name: string;
    type: string;
    nullable: boolean;
    default?: string;
    isPrimaryKey?: boolean;
    isForeignKey?: boolean;
    comment?: string;
}

export interface Table {
    id: string;
    schema: string;
    name: string;
    rowCount?: number;
    sizeBytes?: number;
    columns?: Column[];
    indexes?: IndexInfo[];
    constraints?: Constraint[];
}

export interface SchemaObject {
    name: string;
    schema: string;
    type: 'table' | 'view' | 'function' | 'sequence' | 'type';
}

export interface Constraint {
    name: string;
    type: string;
    definition: string;
}

export interface TableRelationship {
    fromTable: string;
    toTable: string;
    fromColumn: string;
    toColumn: string;
    type: 'foreign_key' | 'reference';
}

export interface SchemaDependency {
    source: string;
    target: string;
    dependencyType: string;
}

/* ═══════════════════════════════════════════════════════════════════════════
   CHART & VISUALIZATION TYPES
   ═══════════════════════════════════════════════════════════════════════════ */

export type ChartType = 'line' | 'bar' | 'area' | 'pie' | 'scatter';
export type ViewMode = 'chart' | 'table' | 'graph' | 'tree';

export interface ChartData {
    [key: string]: string | number | null | undefined;
    _id?: number;
}

export interface ChartConfig {
    type: ChartType;
    xAxisColumn: string;
    yAxisColumn: string;
    title?: string;
}

export interface DataPoint {
    label: string;
    value: number;
    color?: string;
}

/* ═══════════════════════════════════════════════════════════════════════════
   AI ADVISOR TYPES
   ═══════════════════════════════════════════════════════════════════════════ */

export interface QueryAnalysis {
    complexityScore: number;
    suggestions: QuerySuggestion[];
    antiPatterns: AntiPattern[];
    executionPlan?: QueryPlan;
}

export interface QuerySuggestion {
    title: string;
    severity: SeverityLevel;
    description: string;
    recommendation?: string;
    estimatedImpact?: string;
}

export interface AntiPattern {
    pattern: string;
    description: string;
    fix?: string;
}

export interface DiscoveredQuery {
    query: string;
    avgDuration: number;
    calls: number;
    suggestion: string;
    severity: SeverityLevel;
}

export interface IndexRecommendation {
    indexName: string;
    columns: string[];
    expectedImprovementPercent: number;
    estimatedSize?: string;
    reason?: string;
}

/* ═══════════════════════════════════════════════════════════════════════════
   QUERY REGRESSION TYPES
   ═══════════════════════════════════════════════════════════════════════════ */

export interface QueryBaseline {
    id: string;
    query: string;
    createdAt: string;
    executionTime: number;
    rowCount: number;
    bufferHits: number;
    estimatedRows: number;
}

export interface QueryRegression {
    queryId: string;
    baseline: QueryBaseline;
    current: QueryBaseline;
    status: 'ok' | 'regression' | 'improvement' | 'no_baseline';
    changePercent: number;
    severity: SeverityLevel;
}

/* ═══════════════════════════════════════════════════════════════════════════
   TABLE ANALYTICS TYPES
   ═══════════════════════════════════════════════════════════════════════════ */

export interface TableStats {
    name: string;
    schema: string;
    rowCount: number;
    sizeBytes: number;
    lastVacuum?: string;
    lastAnalyze?: string;
    sequentialScans: number;
    indexScans: number;
    insertCount: number;
    updateCount: number;
    deleteCount: number;
}

export interface ColumnStats {
    name: string;
    type: string;
    nullCount: number;
    distinctCount: number;
    avgLength?: number;
    minValue?: any;
    maxValue?: any;
    correlationCoeff?: number;
}

export interface TableHealth {
    score: number;
    issues: HealthIssue[];
    recommendations: string[];
}

export interface HealthIssue {
    type: string;
    severity: SeverityLevel;
    message: string;
}

/* ═══════════════════════════════════════════════════════════════════════════
   SCHEMA VERSIONING TYPES
   ═══════════════════════════════════════════════════════════════════════════ */

export interface SchemaMigration {
    id: string;
    version: string;
    name: string;
    description?: string;
    sql: string;
    status: 'pending' | 'applied' | 'failed' | 'rollback';
    appliedAt?: string;
    createdAt: string;
    createdBy?: string;
    rollbackSql?: string;
}

export interface SchemaVersion {
    version: string;
    appliedAt: string;
    migrations: SchemaMigration[];
}

export interface SchemaChange {
    type: 'table_added' | 'table_dropped' | 'column_added' | 'column_dropped' | 'index_added' | 'index_dropped';
    objectName: string;
    details: string;
    timestamp: string;
    status: 'success' | 'pending' | 'failed';
}

/* ═══════════════════════════════════════════════════════════════════════════
   SQL CONSOLE TYPES
   ═══════════════════════════════════════════════════════════════════════════ */

export interface QueryTab {
    id: string;
    name: string;
    content: string;
    results?: QueryResult;
    executionTime?: number;
    error?: string;
    createdAt: string;
}

export interface QueryHistory {
    id: string;
    query: string;
    executedAt: string;
    duration: number;
    status: 'success' | 'error';
    rowCount?: number;
    error?: string;
}

export interface QuerySnippet {
    id: string;
    name: string;
    content: string;
    category?: string;
    tags?: string[];
    createdAt: string;
    updatedAt: string;
}

/* ═══════════════════════════════════════════════════════════════════════════
   TREE BROWSER TYPES
   ═══════════════════════════════════════════════════════════════════════════ */

export interface TreeNode {
    id: string;
    name: string;
    type: 'database' | 'schema' | 'table' | 'view' | 'function' | 'column' | 'index';
    children?: TreeNode[];
    icon?: string;
    metadata?: Record<string, any>;
    isExpandable?: boolean;
}

/* ═══════════════════════════════════════════════════════════════════════════
   COMPONENT PROP TYPES
   ═══════════════════════════════════════════════════════════════════════════ */

export interface ComponentProps {
    className?: string;
    style?: React.CSSProperties;
}

export interface TabProps extends ComponentProps {
    isActive?: boolean;
    onSelect?: () => void;
}

export interface DataTableProps extends ComponentProps {
    columns: string[];
    rows: any[][];
    loading?: boolean;
    error?: string | null;
    onRowClick?: (rowIndex: number) => void;
    sortable?: boolean;
    searchable?: boolean;
}