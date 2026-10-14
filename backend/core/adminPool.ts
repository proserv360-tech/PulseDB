// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)

// Control-plane (admin) Postgres pool and the shared TLS option builder.
// Extracted from server.ts.

import { Pool } from 'pg';
import { log } from '../services/logger.js';
import { HAS_ADMIN_DB } from './config.js';
import { poolerConnectionString } from './poolerUrl.js';

// ─────────────────────────────────────────────────────────────────────────────
// TLS HELPER — SEC-04 (audit)
// ─────────────────────────────────────────────────────────────────────────────
// In production we default to strict TLS certificate validation.
// Set PULSEDB_TLS_ALLOW_SELF_SIGNED=true to opt back into the permissive
// behavior (needed for some self-hosted DBs with self-signed certs).
// Set PULSEDB_TLS_CA_CERT to a PEM bundle to trust a custom CA.
export function buildSslOption(sslEnabled) {
    if (!sslEnabled) return false;
    const isProd = process.env.NODE_ENV === 'production';

    // Managed Postgres poolers (Supabase, Neon, RDS proxy, etc.) terminate TLS
    // with a cert that isn't in Node's default trust store, so strict
    // verification throws "self-signed certificate in certificate chain".
    // Detect those hosts from the connection target and relax verification for
    // them (the connection is still encrypted — we just don't reject the chain).
    const target = `${process.env.DATABASE_URL || ''} ${process.env.PGHOST || ''}`.toLowerCase();
    const isManagedPooler = /supabase\.(co|com)|pooler\.supabase|neon\.tech|rds\.amazonaws/.test(target);
    const ca = process.env.PULSEDB_TLS_CA_CERT;

    const allowSelfSigned =
        process.env.PULSEDB_TLS_ALLOW_SELF_SIGNED === 'true' ||
        isManagedPooler ||
        // Hosted Postgres (Supabase/Neon/etc.) on a serverless platform presents
        // a cert outside Node's default trust store. When no explicit CA is
        // provided we cannot do strict verification, so relax it rather than
        // hard-fail the whole control plane. Setting PULSEDB_TLS_STRICT=true
        // (with PULSEDB_TLS_CA_CERT) restores strict verification.
        (!ca && process.env.PULSEDB_TLS_STRICT !== 'true') ||
        (!isProd && process.env.PULSEDB_TLS_STRICT !== 'true');
    const opt = { rejectUnauthorized: !allowSelfSigned };
    if (ca) opt.ca = ca;
    return opt;
}

// ─────────────────────────────────────────────────────────────────────────────
// DATABASE POOL — admin pool (env-based, for metadata) + per-connection pool map
// ─────────────────────────────────────────────────────────────────────────────

// Admin pool: used ONLY for pulsedb_connections, users, feedback, etc.
// NOT used for monitoring queries — those must go through user-added connections.
// PRF-05 (audit): admin pool max reduced from 10 to 3 per instance.
// On Vercel each cold-started function instance owns its own pool, so a max
// of 10 fans out to dozens of idle connections against a small Neon free tier
// (default ~100 max). Three is plenty for the metadata workload (control-plane
// reads/writes only), and the per-user query workload runs through dynamic
// pools created by getPool() with their own caps.
//
// On Vercel specifically we default to 1: a single cold-started serverless
// function rarely needs to multiplex control-plane queries, and many cold
// starts × 3 connections each saturates small Neon tiers fast. Long-lived
// hosts (Railway/Fly/Render/Docker) keep the default of 3.
// Override with PULSEDB_ADMIN_POOL_MAX if a deployment genuinely needs more.
// Monitored-connection query cap (audit 2026-06-12). Bounds every query run
// against a user's database through the shared pool, not just the advisor.
// Override with PULSEDB_STATEMENT_TIMEOUT_MS; 0 disables (not recommended).
// NOTE: must be declared BEFORE the pool so the Pool constructor can reference it.
export const STATEMENT_TIMEOUT_MS = Number.isFinite(Number(process.env.PULSEDB_STATEMENT_TIMEOUT_MS))
    ? Number(process.env.PULSEDB_STATEMENT_TIMEOUT_MS)
    : 30_000;

// Vercel MUST stay at 1: each cold-started serverless instance owns its own
// pool, and Supabase's pooler (free tier) caps TOTAL clients at 15. Just 3
// concurrent Vercel instances × 5 connections = 15 → "max clients reached"
// (EMAXCONNSESSION) and every new connection fails. One connection per instance
// keeps many instances within the cap; the dashboard's parallel /overview/*
// calls are served fast from the session/response caches, not 9 live DB hits.
// Long-lived hosts (Railway/Fly/Render/Docker) run a single instance and can
// safely use a larger pool. Override either via PULSEDB_ADMIN_POOL_MAX.
const ADMIN_POOL_DEFAULT = process.env.VERCEL === '1' ? 1 : 5;
const ADMIN_POOL_MAX = Number(process.env.PULSEDB_ADMIN_POOL_MAX) || ADMIN_POOL_DEFAULT;
// Keep admin sockets alive between queries. Short on serverless so idle
// instances hand pooler slots back; generous on a long-lived host, where
// re-handshaking to a remote region is the dominant cost of a "slow" query.
const ADMIN_POOL_IDLE_MS =
    Number(process.env.PULSEDB_ADMIN_POOL_IDLE_MS) || (process.env.VERCEL === '1' ? 5_000 : 60_000);
export const pool = HAS_ADMIN_DB
    ? new Pool(
          process.env.DATABASE_URL
              ? {
                    connectionString: poolerConnectionString(process.env.DATABASE_URL),
                    max: ADMIN_POOL_MAX,
                    // Was 10s. On a long-lived host that meant nearly every
                    // query after a quiet moment paid a fresh TCP + TLS + SCRAM
                    // handshake — ~4-6 round trips, which against a pooler in
                    // another region is most of a second. Serverless still wants
                    // a short timeout so idle instances release pooler slots;
                    // that case is handled by the per-connection pools below.
                    idleTimeoutMillis: ADMIN_POOL_IDLE_MS,
                    connectionTimeoutMillis: 15_000,
                    statement_timeout: STATEMENT_TIMEOUT_MS,
                    // Stop NAT and pooler middleboxes silently dropping an idle
                    // socket, which shows up later as an inexplicably slow query.
                    keepAlive: true,
                    keepAliveInitialDelayMillis: 10_000,
                    ssl: buildSslOption(true),
                }
              : {
                    user: process.env.PGUSER || 'postgres',
                    host: process.env.PGHOST,
                    database: process.env.PGDATABASE || 'postgres',
                    password: process.env.PGPASSWORD,
                    port: Number(process.env.PGPORT) || 5432,
                    max: ADMIN_POOL_MAX,
                    idleTimeoutMillis: ADMIN_POOL_IDLE_MS,
                    connectionTimeoutMillis: 15_000,
                    statement_timeout: STATEMENT_TIMEOUT_MS,
                    keepAlive: true,
                    keepAliveInitialDelayMillis: 10_000,
                    // Managed poolers (Supabase/Neon/RDS) require TLS; force it on for
                    // those hosts even if PGSSL is unset/false, then buildSslOption
                    // relaxes cert verification for them.
                    ssl: buildSslOption(
                        process.env.PGSSL !== 'false' ||
                            /supabase|pooler|neon\.tech|rds\.amazonaws/.test((process.env.PGHOST || '').toLowerCase()),
                    ),
                },
      )
    : null;

if (pool) pool.on('error', (err) => log('ERROR', 'Pool background error', { err: err.message }));
