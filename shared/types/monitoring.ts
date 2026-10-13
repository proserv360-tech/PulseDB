/**
 * Monitoring, observability, and infrastructure types
 */

// ── Pool Metrics ────────────────────────────────────────────────────────────
export type ConnectionState = 'active' | 'idle' | 'idle in transaction' | 'fastpath function call' | 'disabled';

export interface PoolMetrics {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  maxConnections: number;
  utilizationPercent: number;
  byState: Record<ConnectionState, number>;
  byDatabase: Record<string, number>;
  byUser: Record<string, number>;
  settings: {
    maxConnections: number;
    superuserReserved: number;
    effectiveMax: number;
  };
  timestamp: string;
}

// ── Replication ─────────────────────────────────────────────────────────────
export interface ReplicationSlot {
  slotName: string;
  plugin: string;
  slotType: string;
  database: string;
  active: boolean;
  xmin: string | null;
  catalogXmin: string | null;
  restartLsn: string;
  confirmedFlushLsn: string | null;
  lagBytes: number;
}

// ── Observability ───────────────────────────────────────────────────────────
export interface ObservabilityApiMetric {
  endpoint: string;
  method: string;
  avgDuration: number;
  p95Duration: number;
  totalCalls: number;
  errorRate: number;
}

export interface ObservabilityException {
  id: number;
  message: string;
  stack: string | null;
  count: number;
  lastSeen: string;
  resolved: boolean;
}

export interface AuditLogEntry {
  id: number;
  actorUsername: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  level: 'info' | 'warning' | 'error';
  timestamp: string;
}

// ── Performance ─────────────────────────────────────────────────────────────
export interface PerformanceMetrics {
  cacheHitRatio: number;
  transactionsPerSecond: number;
  activeConnections: number;
  deadlocks: number;
  tuplesReturned: number;
  tuplesInserted: number;
  tuplesUpdated: number;
  tuplesDeleted: number;
  tempFiles: number;
  tempBytes: number;
  conflictsDeadlocks: number;
}

// ── Retention ───────────────────────────────────────────────────────────────
export interface RetentionPolicy {
  table: string;
  retentionDays: number;
  timestampColumn: string;
  enabled: boolean;
  lastCleanup: string | null;
}

export interface RetentionStats {
  table: string;
  totalRows: number;
  oldRows: number;
  sizeBytes: number;
  estimatedSavings: string;
}

// ── Backup ──────────────────────────────────────────────────────────────────
export interface BackupInfo {
  id: string;
  type: 'full' | 'incremental' | 'wal';
  status: 'completed' | 'in_progress' | 'failed';
  size: string;
  startedAt: string;
  completedAt: string | null;
  duration: string | null;
}

// ── Resource Metrics ────────────────────────────────────────────────────────
export interface ResourceMetrics {
  databaseSize: string;
  databaseSizeBytes: number;
  tableCount: number;
  indexCount: number;
  viewCount: number;
  functionCount: number;
  extensionCount: number;
  sequenceCount: number;
  uptime: string;
}
