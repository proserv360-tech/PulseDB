/**
 * drizzle.config.ts — Drizzle Kit configuration
 * ───────────────────────────────────────────────
 * Used by `npx drizzle-kit generate` and `npx drizzle-kit push`
 */

import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './db/schema.ts',
  out: './db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || `postgresql://${process.env.PGUSER || 'postgres'}:${process.env.PGPASSWORD || ''}@${process.env.PGHOST || 'localhost'}:${process.env.PGPORT || '5432'}/${process.env.PGDATABASE || 'postgres'}`,
  },
  verbose: true,
  strict: true,
});
