/**
 * Database schema, query, and analysis types
 */

// ── Schema ──────────────────────────────────────────────────────────────────
export interface SchemaTable {
  id: string;          // "schema.table"
  name: string;
  schema: string;
  rowCount: number;
  size: string;
}

export interface SchemaRelationship {
  id: string;
  from: string;        // "schema.table"
  to: string;
  fromColumn: string;
  toColumn: string;
  type: 'fk';
  onDelete: string;
  onUpdate: string;
  cardinality: '1:1' | '1:N' | 'N:N';
}

export interface SchemaDependency {
  id: string;
  source: string;
  target: string;
  dependencyType: 'view' | 'materialized_view' | 'function';
}

export interface SchemaColumn {
  name: string;
  type: string;
  nullable: boolean;
  default: string | null;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  distinctValues?: number;
  nullFraction?: number;
  avgWidth?: number;
}

// ── Query Analysis ──────────────────────────────────────────────────────────
export type SuggestionPriority = 'high' | 'medium' | 'low';
export type ComplexityLevel = 'simple' | 'moderate' | 'complex';
export type AntiPatternSeverity = 'high' | 'medium' | 'low';

export interface QuerySuggestion {
  priority: SuggestionPriority;
  suggestion: string;
}

export interface QueryAnalysis {
  query: string;
  plan: QueryPlanNode | null;
  suggestions: QuerySuggestion[];
}

export interface QueryPlanNode {
  'Node Type': string;
  'Total Cost': number;
  'Startup Cost'?: number;
  'Plan Rows'?: number;
  'Plan Width'?: number;
  Plans?: QueryPlanNode[];
  [key: string]: unknown;
}

export interface SlowQuerySuggestion {
  query: string;
  meanTime: string;
  totalTime: string;
  calls: number;
  suggestions: QuerySuggestion[];
}

export interface AntiPattern {
  pattern: string;
  severity: AntiPatternSeverity;
  description: string;
}

export interface QueryComplexityScore {
  score: number;
  level: ComplexityLevel;
  factors: string[];
}

export interface IndexSuggestion {
  columnName: string;
  reason: string;
  suggestedIndex: string;
}

export interface OptimizationReport {
  slowQueries: SlowQuerySuggestion[];
  missingIndexes: IndexSuggestion[];
  antiPatterns: AntiPattern[];
  summary: string;
}

// ── SQL Console ─────────────────────────────────────────────────────────────
export interface QueryHistoryEntry {
  id: string;
  ts: string;
  query: string;
  duration?: number;
  rows?: number;
  favourite: boolean;
  connectionId?: number;
}

// ── Chart Builder ───────────────────────────────────────────────────────────
export type ChartType = 'line' | 'bar' | 'area' | 'pie' | 'scatter';

export interface ChartConfig {
  type: ChartType;
  xAxis: string;
  yAxis: string[];
  title?: string;
  colors?: string[];
}
