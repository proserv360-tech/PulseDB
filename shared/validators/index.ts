/**
 * @pulsedb/validators — Zod validation schemas
 * ─────────────────────────────────────────────
 * One schema = runtime validation + TypeScript type (zero duplication).
 * Import and use on both frontend (form validation) and backend (request validation).
 *
 * Usage:
 *   import { LoginSchema, type LoginInput } from '@pulsedb/validators';
 *   const result = LoginSchema.safeParse(req.body);
 *   if (!result.success) return res.status(400).json({ error: result.error });
 */

import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// Auth Schemas
// ─────────────────────────────────────────────────────────────────────────────

export const LoginSchema = z.object({
  username: z.string().min(1, 'Username is required').max(100),
  password: z.string().min(1, 'Password is required').max(200),
});
export type LoginInput = z.infer<typeof LoginSchema>;

export const CreateUserSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters').max(50)
    .regex(/^[a-zA-Z0-9_.-]+$/, 'Username can only contain letters, numbers, dots, hyphens, and underscores'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(200),
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('Invalid email address'),
  // Must stay in lockstep with the backend's VALID_ROLES in routes/userRoutes.ts
  // ('developer' was missing here, which would have made validate() reject a
  // legitimate developer-role user creation — audit 2026-07-24).
  role: z.enum(['super_admin', 'admin', 'developer', 'analyst', 'viewer']),
  allowedScreens: z.array(z.string()).default([]),
  status: z.enum(['active', 'suspended', 'locked']).default('active'),
  department: z.string().max(100).nullable().optional(),
  location: z.string().max(100).nullable().optional(),
  mfa: z.boolean().default(true),
  apiAccess: z.boolean().default(false),
  dataAccess: z.enum(['internal', 'restricted', 'public']).default('internal'),
});
export type CreateUserInput = z.infer<typeof CreateUserSchema>;

export const UpdateUserSchema = CreateUserSchema.partial().omit({ password: true });
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;

export const ResetPasswordSchema = z.object({
  newPassword: z.string().min(8, 'Password must be at least 8 characters').max(200),
});
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Connection Schemas
// ─────────────────────────────────────────────────────────────────────────────

export const CreateConnectionSchema = z.object({
  name: z.string().min(1, 'Connection name is required').max(100),
  host: z.string().min(1, 'Host is required').max(255),
  port: z.number().int().min(1).max(65535).default(5432),
  dbName: z.string().min(1).max(100).default('postgres'),
  username: z.string().min(1, 'Username is required').max(100),
  password: z.string().min(1, 'Password is required').max(500),
  ssl: z.boolean().default(true),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#06b6d4'),
  isDefault: z.boolean().default(false),
  type: z.enum(['postgresql', 'mongodb']).default('postgresql'),
  environment: z.string().max(50).default('production'),
  region: z.string().max(100).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});
export type CreateConnectionInput = z.infer<typeof CreateConnectionSchema>;

export const UpdateConnectionSchema = CreateConnectionSchema.partial().extend({
  id: z.number().int().positive(),
});
export type UpdateConnectionInput = z.infer<typeof UpdateConnectionSchema>;

export const ConnectionUrlSchema = z.object({
  url: z.string().min(1, 'Connection URL is required')
    .refine(
      (url) => url.startsWith('postgresql://') || url.startsWith('postgres://') || url.startsWith('mongodb://') || url.startsWith('mongodb+srv://'),
      'Must be a valid PostgreSQL or MongoDB connection URL'
    ),
});
export type ConnectionUrlInput = z.infer<typeof ConnectionUrlSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Alert Rule Schemas
// ─────────────────────────────────────────────────────────────────────────────

export const CreateAlertRuleSchema = z.object({
  name: z.string().min(1, 'Rule name is required').max(200),
  description: z.string().max(500).default(''),
  metric: z.string().min(1, 'Metric is required').max(100),
  condition: z.enum(['gt', 'lt', 'eq', 'gte', 'lte', 'ne']),
  threshold: z.number().finite(),
  severity: z.enum(['critical', 'warning', 'info']).default('warning'),
  enabled: z.boolean().default(true),
  cooldownMinutes: z.number().int().min(0).max(1440).default(15),
  notifyEmail: z.boolean().default(false),
  notifySlack: z.boolean().default(false),
  connectionId: z.number().int().positive().nullable().optional(),
});
export type CreateAlertRuleInput = z.infer<typeof CreateAlertRuleSchema>;

export const UpdateAlertRuleSchema = CreateAlertRuleSchema.partial().extend({
  id: z.number().int().positive(),
});
export type UpdateAlertRuleInput = z.infer<typeof UpdateAlertRuleSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Query Schemas
// ─────────────────────────────────────────────────────────────────────────────

export const SqlQuerySchema = z.object({
  query: z.string().min(1, 'Query is required').max(50_000),
  connectionId: z.number().int().positive().optional(),
});
export type SqlQueryInput = z.infer<typeof SqlQuerySchema>;

export const ExplainQuerySchema = z.object({
  query: z.string().min(1, 'Query is required').max(8_000),
});
export type ExplainQueryInput = z.infer<typeof ExplainQuerySchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Feedback Schema
// ─────────────────────────────────────────────────────────────────────────────

export const FeedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  category: z.string().min(1).max(50),
  message: z.string().min(1, 'Message is required').max(2000),
  page: z.string().max(100).optional(),
});
export type FeedbackInput = z.infer<typeof FeedbackSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Retention Schema
// ─────────────────────────────────────────────────────────────────────────────

export const RetentionPolicySchema = z.object({
  table: z.string().min(1).max(100),
  retentionDays: z.number().int().min(1).max(3650),
  timestampColumn: z.string().min(1).max(100),
  enabled: z.boolean().default(true),
});
export type RetentionPolicyInput = z.infer<typeof RetentionPolicySchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Environment Validation Schema
// ─────────────────────────────────────────────────────────────────────────────

export const ServerEnvSchema = z.object({
  NODE_ENV: z.enum(['production', 'development', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),
  PGHOST: z.string().min(1).optional(),
  PGUSER: z.string().default('postgres'),
  PGDATABASE: z.string().default('postgres'),
  PGPASSWORD: z.string().optional(),
  PGPORT: z.coerce.number().int().default(5432),
  JWT_SECRET: z.string().min(1).default('pulsedb-change-me-in-production'),
  JWT_EXPIRES_IN: z.string().default('8h'),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
  CORS_ORIGIN: z.string().optional(),
  ENCRYPTION_KEY: z.string().optional(),
}).refine(
  (env) => {
    // In production, require critical variables
    if (env.NODE_ENV === 'production') {
      return !!env.PGHOST && !!env.PGPASSWORD && env.JWT_SECRET !== 'pulsedb-change-me-in-production';
    }
    return true;
  },
  { message: 'Production requires PGHOST, PGPASSWORD, and a strong JWT_SECRET' }
);
export type ServerEnv = z.infer<typeof ServerEnvSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Wave A/B contracts — added 2026-06-02 (B5)
// One source of truth for the schemas attached to the newer route surface.
// Keep these in sync with backend/routes/*.js handlers via the validate()
// middleware (backend/middleware/validate.js).
// ─────────────────────────────────────────────────────────────────────────────

// A5 — Copilot retention -----------------------------------------------------
export const CopilotRetentionResponseSchema = z.object({
    maxAgeDays: z.number().int().positive(),
});
export type CopilotRetentionResponse = z.infer<typeof CopilotRetentionResponseSchema>;

// A8 — SCIM token rotation ---------------------------------------------------
export const ScimTokenIdParamsSchema = z.object({
    id: z.coerce.number().int().positive(),
});
export const ScimTokenExpiringQuerySchema = z.object({
    withinDays: z.coerce.number().int().min(1).max(365).default(14),
});
export type ScimTokenExpiringQuery = z.infer<typeof ScimTokenExpiringQuerySchema>;

// A3 — Wait events -----------------------------------------------------------
export const WaitEventsQuerySchema = z.object({
    connectionId: z.string().min(1, 'connectionId required'),
    from:   z.string().datetime().optional(),
    to:     z.string().datetime().optional(),
    bucket: z.enum(['5m', 'raw']).default('5m'),
    limit:  z.coerce.number().int().min(1).max(10_000).optional(),
});
export type WaitEventsQuery = z.infer<typeof WaitEventsQuerySchema>;

// B2 — Cluster-aware advisor -------------------------------------------------
export const AdvisorClusterQuerySchema = z.object({
    connectionId: z.coerce.number().int().positive().optional(),
    clusterId:    z.coerce.number().int().positive().optional(),
}).refine((q) => q.connectionId || q.clusterId, {
    message: 'connectionId or clusterId is required',
});
export type AdvisorClusterQuery = z.infer<typeof AdvisorClusterQuerySchema>;

// B3 — Query-rewrite workbench ----------------------------------------------
export const CreateWorkbookSchema = z.object({
    connectionId: z.number().int().positive(),
    baseQuery:    z.string().min(1).max(50_000),
    description:  z.string().max(500).optional(),
});
export type CreateWorkbookInput = z.infer<typeof CreateWorkbookSchema>;

export const AddVariantSchema = z.object({
    workbookId: z.number().int().positive(),
    label:      z.string().min(1).max(80),
    sql:        z.string().min(1).max(50_000),
});
export type AddVariantInput = z.infer<typeof AddVariantSchema>;

export const RunVariantsParamsSchema = z.object({
    workbookId: z.coerce.number().int().positive(),
});

// B7 — Dashboards ------------------------------------------------------------
export const CreateDashboardSchema = z.object({
    name:        z.string().min(1).max(120),
    description: z.string().max(500).optional(),
});
export type CreateDashboardInput = z.infer<typeof CreateDashboardSchema>;

export const PanelSpecSchema = z.object({
    metricId:  z.string().min(1).max(120),
    chartType: z.enum(['line', 'area', 'bar', 'number', 'table']).default('line'),
    rangeMin:  z.number().int().min(5).max(60 * 24 * 7).default(60),
    options:   z.record(z.unknown()).default({}),
});
export const AddPanelSchema = z.object({
    dashboardId: z.number().int().positive(),
    title:       z.string().min(1).max(120),
    position:    z.object({
        x: z.number().int().min(0),
        y: z.number().int().min(0),
        w: z.number().int().min(1).max(12),
        h: z.number().int().min(1).max(24),
    }),
    spec:        PanelSpecSchema,
});
export type AddPanelInput = z.infer<typeof AddPanelSchema>;

// B8 — Backups ---------------------------------------------------------------
export const CreateBackupScheduleSchema = z.object({
    connectionId: z.number().int().positive(),
    cadence:      z.enum(['hourly', 'daily', 'weekly']),
    target:       z.enum(['s3', 'local']).default('s3'),
    targetUri:    z.string().min(1).max(500).optional(),
});
export type CreateBackupScheduleInput = z.infer<typeof CreateBackupScheduleSchema>;

// B10 — Field-level crypto ---------------------------------------------------
// Public helper: clients posting potentially sensitive workbench / copilot
// content can hint at the row that will be encrypted at rest.
export const EncryptedFieldRefSchema = z.object({
    table: z.enum(['workbench_saved_queries', 'copilot_turns']),
    rowId: z.number().int().positive(),
});
export type EncryptedFieldRef = z.infer<typeof EncryptedFieldRefSchema>;
