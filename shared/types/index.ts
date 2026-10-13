/**
 * @pulsedb/types — Shared type definitions for PulseDB
 * ──────────────────────────────────────────────────
 * Single source of truth for all data shapes flowing between
 * frontend and backend. Import from '@pulsedb/types' in both.
 */

// Re-export all domain modules
export * from './auth.js';
export * from './connection.js';
export * from './database.js';
export * from './alert.js';
export * from './monitoring.js';
export * from './api.js';
// config.ts is exported separately — it depends on React types (frontend-only)
// Import it directly: import type { ... } from '@pulsedb/types/config';
