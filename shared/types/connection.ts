/**
 * Database Connection types
 */

export type ConnectionType = 'postgresql' | 'mongodb';
export type HealthStatus = 'healthy' | 'warning' | 'critical' | 'unreachable' | 'unknown';

// ── Connection (as returned to frontend) ────────────────────────────────────
export interface Connection {
  id: number;
  userId: number;
  name: string;
  host: string;
  port: number;
  dbName: string;
  username: string;
  ssl: boolean;
  color: string;
  isDefault: boolean;
  type: ConnectionType;
  environment: string;
  region: string | null;
  notes: string | null;
  healthStatus: HealthStatus;
  lastHealthCheck: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Connection (raw DB row) ─────────────────────────────────────────────────
export interface ConnectionRow {
  id: number;
  user_id: number;
  name: string;
  host: string;
  port: number;
  db_name: string;
  username: string;
  password_encrypted: string;
  ssl: boolean;
  color: string;
  is_default: boolean;
  connection_type: ConnectionType;
  environment: string;
  region: string | null;
  notes: string | null;
  health_status: HealthStatus;
  last_health_check: string | null;
  created_at: string;
  updated_at: string;
}

// ── Create / Update ─────────────────────────────────────────────────────────
export interface CreateConnectionInput {
  name: string;
  host: string;
  port?: number;
  dbName?: string;
  username: string;
  password: string;
  ssl?: boolean;
  color?: string;
  isDefault?: boolean;
  type?: ConnectionType;
  environment?: string;
  region?: string | null;
  notes?: string | null;
}

export interface UpdateConnectionInput extends Partial<CreateConnectionInput> {
  id: number;
}

// ── Health Check ────────────────────────────────────────────────────────────
export interface ConnectionHealth {
  connectionId: number;
  status: HealthStatus;
  latencyMs: number;
  version: string;
  uptime: string;
  error?: string;
  checkedAt: string;
}

// ── Connection URL Parsing ──────────────────────────────────────────────────
export interface ParsedConnectionUrl {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
  params: Record<string, string>;
}

// ── Fleet Overview ──────────────────────────────────────────────────────────
export interface FleetSummary {
  total: number;
  healthy: number;
  warning: number;
  critical: number;
  unreachable: number;
  connections: (Connection & { health: ConnectionHealth })[];
}
