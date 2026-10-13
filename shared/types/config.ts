/**
 * Configuration and UI types
 */

// Use a generic component type to avoid depending on lucide-react in shared types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type IconComponent = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ComponentType = any;

// ── Tab Configuration ───────────────────────────────────────────────────────
export interface TabSection {
  section: string;
  accent: string;
  group?: string;
}

export interface TabDefinition {
  id: string;
  icon: IconComponent;
  label: string;
  component: ComponentType | null;
  badge: string | null;
}

export type TabConfigItem = TabSection | TabDefinition;

export interface SectionGroup {
  section: string;
  tabs: TabDefinition[];
  accent: string;
  group?: string;
}

// ── Storage Keys ────────────────────────────────────────────────────────────
export interface StorageKeys {
  ACTIVE_TAB: string;
  SIDEBAR_COLLAPSED: string;
  NOTIFICATIONS_DISMISSED: string;
  FEEDBACK_PROMPT: string;
}

// ── Theme ───────────────────────────────────────────────────────────────────
export interface ThemeTokens {
  bg: string;
  bgCard: string;
  bgHover: string;
  bgActive: string;
  bgInput: string;
  border: string;
  borderLight: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  cyan: string;
  emerald: string;
  amber: string;
  rose: string;
  violet: string;
  blue: string;
  shadow: string;
  [key: string]: string;
}

// ── Server CONFIG shape ─────────────────────────────────────────────────────
export interface ServerConfig {
  PORT: number;
  FRONTEND_URL: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  CORS_ORIGINS: string[];
  SLOW_QUERY_MIN: number;
  WS_INTERVAL_MS: number;
  REPOSITORY_PATH: string;
  ALERT_MONITORING_INTERVAL: number;
  RATE_LIMIT: {
    WINDOW_MS: number;
    MAX_REQUESTS: number;
  };
  CACHE_TTL: Record<string, number>;
  ALERT_THRESHOLDS: {
    CONNECTION_USAGE_PCT: number;
    LONG_QUERY_SEC: number;
    DEAD_TUPLE_RATIO: number;
    REPLICATION_LAG_MB: number;
    CACHE_HIT_RATIO: number;
    LOCK_COUNT: number;
  };
  EMAIL: EmailConfig;
}

export interface EmailConfig {
  enabled: boolean;
  provider: 'smtp' | 'gmail' | 'sendgrid' | 'ses';
  minSeverity: string;
  recipients: string[];
  from: string;
  dashboardUrl: string;
  databaseName: string;
  gmail: { user?: string; appPassword?: string };
  sendgrid: { apiKey?: string };
  ses: { region: string; accessKeyId?: string; secretAccessKey?: string };
  smtp: {
    host?: string;
    port: number;
    secure: boolean;
    user?: string;
    password?: string;
    rejectUnauthorized: boolean;
  };
}

// ── Environment Variables ───────────────────────────────────────────────────
export interface ServerEnv {
  NODE_ENV: 'production' | 'development' | 'test';
  PORT?: string;
  PGHOST?: string;
  PGUSER?: string;
  PGDATABASE?: string;
  PGPASSWORD?: string;
  PGPORT?: string;
  JWT_SECRET?: string;
  JWT_EXPIRES_IN?: string;
  FRONTEND_URL?: string;
  CORS_ORIGIN?: string;
  ENCRYPTION_KEY?: string;
  VERCEL?: string;
}
