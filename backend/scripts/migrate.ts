// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
// ==========================================================================
//  FATHOM — Database Migration  (scripts/migrate.js)
//  Run once: node scripts/migrate.js
// ==========================================================================

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../db.js';

const migrations = [
    // ── Schema (must exist before any table inside it) ──
    `CREATE SCHEMA IF NOT EXISTS pgmonitoringtool`,

    // ── Connection registry ──
    `
    CREATE TABLE IF NOT EXISTS pgmonitoringtool.fathom_connections (
        id              SERIAL      PRIMARY KEY,
        user_id         INTEGER,
        name            TEXT        NOT NULL,
        host            TEXT        NOT NULL DEFAULT '',
        port            INTEGER     NOT NULL DEFAULT 5432,
        db_name         TEXT        NOT NULL DEFAULT 'postgres',
        username        TEXT        NOT NULL DEFAULT 'postgres',
        password        TEXT        NOT NULL DEFAULT '',
        ssl             BOOLEAN     NOT NULL DEFAULT false,
        ssh_enabled     BOOLEAN     NOT NULL DEFAULT false,
        ssh_host        TEXT        NOT NULL DEFAULT '',
        ssh_port        INTEGER     NOT NULL DEFAULT 22,
        ssh_user        TEXT        NOT NULL DEFAULT '',
        ssh_auth_type   TEXT        NOT NULL DEFAULT 'key',
        ssh_private_key TEXT        NOT NULL DEFAULT '',
        ssh_passphrase  TEXT        NOT NULL DEFAULT '',
        ssh_password    TEXT        NOT NULL DEFAULT '',
        is_default      BOOLEAN     NOT NULL DEFAULT false,
        status          TEXT,
        last_tested     TIMESTAMPTZ,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (user_id, name)
    )
    `,

    // ── Metric snapshots (time-series store) ──
    `
    CREATE TABLE IF NOT EXISTS fathom_metric_snapshots (
        time_bucket           TIMESTAMPTZ PRIMARY KEY,
        avg_qps               NUMERIC     DEFAULT 0,
        avg_tps               NUMERIC     DEFAULT 0,
        avg_latency_p50_ms    NUMERIC     DEFAULT 0,
        avg_latency_p95_ms    NUMERIC     DEFAULT 0,
        avg_latency_p99_ms    NUMERIC     DEFAULT 0,
        reads                 NUMERIC     DEFAULT 0,
        writes                NUMERIC     DEFAULT 0,
        commits               NUMERIC     DEFAULT 0,
        created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
    )
    `,

    // ── Backup history ──
    `
    CREATE TABLE IF NOT EXISTS fathom_backup_history (
        id                BIGSERIAL    PRIMARY KEY,
        backup_type       TEXT         NOT NULL DEFAULT 'Full',
        status            TEXT         NOT NULL DEFAULT 'success',
        started_at        TIMESTAMPTZ  NOT NULL,
        finished_at       TIMESTAMPTZ,
        size_bytes        BIGINT       DEFAULT 0,
        label             TEXT,
        next_scheduled_at TIMESTAMPTZ,
        notes             TEXT,
        created_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
    )
    `,

    // ── Alerts ──
    `
    CREATE TABLE IF NOT EXISTS fathom_alerts (
        id          BIGSERIAL    PRIMARY KEY,
        severity    TEXT         NOT NULL DEFAULT 'info',
        title       TEXT         NOT NULL,
        message     TEXT,
        fingerprint TEXT         UNIQUE,
        source      TEXT         DEFAULT 'auto',
        read        BOOLEAN      NOT NULL DEFAULT false,
        dismissed   BOOLEAN      NOT NULL DEFAULT false,
        created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
    )
    `,

    // ── OpenTelemetry metrics store (otelService.js reads/writes this) ──
    `
    CREATE TABLE IF NOT EXISTS pgmonitoringtool.otel_metrics (
        id          BIGSERIAL    PRIMARY KEY,
        name        TEXT         NOT NULL,
        value       DOUBLE PRECISION NOT NULL,
        timestamp   TIMESTAMPTZ  NOT NULL,
        labels      JSONB        NOT NULL DEFAULT '{}',
        resource    JSONB        NOT NULL DEFAULT '{}',
        created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
    )
    `,
    `CREATE INDEX IF NOT EXISTS otel_metrics_name_ts_idx ON pgmonitoringtool.otel_metrics (name, timestamp DESC)`,
    `CREATE INDEX IF NOT EXISTS otel_metrics_ts_idx ON pgmonitoringtool.otel_metrics (timestamp DESC)`,
    `CREATE INDEX IF NOT EXISTS otel_metrics_labels_gin ON pgmonitoringtool.otel_metrics USING GIN (labels)`,
    `CREATE INDEX IF NOT EXISTS otel_metrics_resource_gin ON pgmonitoringtool.otel_metrics USING GIN (resource)`,

    // ── Index on alerts for fast unread lookups ──
    `CREATE INDEX IF NOT EXISTS idx_fathom_alerts_unread ON fathom_alerts (read, dismissed, created_at DESC)`,

    // ── Index on snapshots for time-range queries ──
    `CREATE INDEX IF NOT EXISTS idx_fathom_snapshots_bucket ON fathom_metric_snapshots (time_bucket DESC)`,

    // ── Schema tracking: snapshots + drift timeline (schemaTrackingService.ts) ──
    `
    CREATE TABLE IF NOT EXISTS fathom_schema_snapshots (
        id            BIGSERIAL    PRIMARY KEY,
        connection_id TEXT         NOT NULL,
        hash          TEXT         NOT NULL,
        schema        JSONB        NOT NULL,
        captured_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
    )
    `,
    `CREATE INDEX IF NOT EXISTS idx_schema_snapshots_conn ON fathom_schema_snapshots (connection_id, captured_at DESC)`,
    `
    CREATE TABLE IF NOT EXISTS fathom_schema_changes (
        id            BIGSERIAL    PRIMARY KEY,
        connection_id TEXT         NOT NULL,
        change_type   TEXT         NOT NULL,
        object_type   TEXT         NOT NULL,
        object_name   TEXT         NOT NULL,
        detail        JSONB        NOT NULL DEFAULT '{}',
        detected_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
    )
    `,
    `CREATE INDEX IF NOT EXISTS idx_schema_changes_conn ON fathom_schema_changes (connection_id, detected_at DESC)`,

    // ── Query advisor recommendations (queryAdvisorService.ts) ──
    `
    CREATE TABLE IF NOT EXISTS fathom_query_recommendations (
        id            BIGSERIAL    PRIMARY KEY,
        workspace_id  TEXT         NOT NULL DEFAULT 'default',
        connection_id TEXT,
        query_hash    TEXT         NOT NULL,
        statement     TEXT         NOT NULL,
        issues        JSONB        NOT NULL DEFAULT '[]',
        severity      TEXT         NOT NULL DEFAULT 'info',
        status        TEXT         NOT NULL DEFAULT 'open',
        occurrences   INTEGER      NOT NULL DEFAULT 1,
        first_seen    TIMESTAMPTZ  NOT NULL DEFAULT now(),
        last_seen     TIMESTAMPTZ  NOT NULL DEFAULT now(),
        UNIQUE (workspace_id, query_hash)
    )
    `,
    `CREATE INDEX IF NOT EXISTS idx_query_recs_status ON fathom_query_recommendations (workspace_id, status, severity)`,

    // ── Collector query-stat snapshots (agentIngestRoutes / queryStatsRollup) ──
    `
    CREATE TABLE IF NOT EXISTS pgmonitoringtool.agent_query_stats (
        id            BIGSERIAL    PRIMARY KEY,
        connection_id TEXT         NOT NULL,
        captured_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
        snapshot      JSONB        NOT NULL
    )
    `,
    `CREATE INDEX IF NOT EXISTS idx_agent_query_stats_conn ON pgmonitoringtool.agent_query_stats (connection_id, captured_at DESC)`,

    // ── Autonomous agent findings (agentLoopService.ts) ──
    `
    CREATE TABLE IF NOT EXISTS fathom_agent_findings (
        id          BIGSERIAL    PRIMARY KEY,
        metric      TEXT         NOT NULL,
        severity    TEXT         NOT NULL DEFAULT 'info',
        title       TEXT         NOT NULL,
        summary     TEXT,
        proposal    TEXT,
        context     JSONB        NOT NULL DEFAULT '{}',
        status      TEXT         NOT NULL DEFAULT 'open',
        detected_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
        acked_at    TIMESTAMPTZ,
        resolved_at TIMESTAMPTZ
    )
    `,
    `CREATE INDEX IF NOT EXISTS idx_agent_findings_status ON fathom_agent_findings (status, detected_at DESC)`,

    // ── Auto-prune snapshots older than 48 hours (optional pg rule) ──
    // Uncomment if you want DB-level enforcement:
    // `CREATE RULE fathom_snapshot_ttl AS ON INSERT TO fathom_metric_snapshots
    //  DO ALSO DELETE FROM fathom_metric_snapshots WHERE time_bucket < now() - interval '48 hours'`,
    // ── Cloud provider credentials (per-workspace, encrypted at rest) ──
    // Stores AWS / MongoDB-Atlas credentials so cloud-managed DB insights
    // (RDS/Aurora via CloudWatch, Atlas via the Atlas Admin API) work
    // per-tenant instead of relying on a single set of process env vars.
    // The `secret_enc` column holds an AES-256-GCM blob produced by
    // services/encryptionService.encrypt(); plaintext secrets are never stored.
    `
    CREATE TABLE IF NOT EXISTS pgmonitoringtool.cloud_provider_credentials (
        id            BIGSERIAL    PRIMARY KEY,
        workspace_id  INTEGER,
        provider      TEXT         NOT NULL CHECK (provider IN ('aws','atlas')),
        label         TEXT         NOT NULL DEFAULT '',
        -- AWS: region + DB instance identifier; Atlas: project (group) id + cluster/process
        region        TEXT         NOT NULL DEFAULT '',
        resource_id   TEXT         NOT NULL DEFAULT '',
        -- public identifier (AWS access key id, or Atlas public API key)
        access_id     TEXT         NOT NULL DEFAULT '',
        -- encrypted secret (AWS secret access key, or Atlas private API key)
        secret_enc    TEXT,
        extra         JSONB        NOT NULL DEFAULT '{}',
        created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
        updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
        UNIQUE (workspace_id, provider, label)
    )
    `,
    `CREATE INDEX IF NOT EXISTS idx_cloud_creds_ws_provider
        ON pgmonitoringtool.cloud_provider_credentials (workspace_id, provider)`,
];

// ---------------------------------------------------------------------------
// File-based migrations (db/migrations/*.sql)
// ---------------------------------------------------------------------------
// The inline `migrations` array above is the only thing this script used to
// run. The .sql files under db/migrations — generated by drizzle-kit and
// hand-written since — were applied by NOTHING: no npm script referenced them
// and `drizzle-kit migrate` is not wired up. That is the root cause of the
// schema drift between db/schema.ts and the deployed database (see
// db/migrations/0024_session_schema_reconcile.sql for the specifics).
//
// We now apply them here, in filename order, once each, tracked in a ledger
// table. Each file runs in its own transaction, so a failure leaves the ledger
// and the schema consistent with each other.
const MIGRATIONS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'db', 'migrations');

// Files sorting BEFORE this one are treated as pre-existing history and are
// recorded as applied without being executed, the first time the ledger is
// created.
//
// This is deliberate. Those files were never run by any script, so the deployed
// schema was built by the inline `migrations` array above and by
// migrate-enterprise.ts instead. Several of them (0000 in particular) use bare
// `CREATE SCHEMA` / `CREATE TABLE` with no IF NOT EXISTS, so executing them
// against a live database would simply error. Re-deriving the true historical
// delta is not possible without a live schema to diff against.
//
// The practical consequence: 0024 onward are the migrations this runner
// actually executes, and every new file must be written idempotently.
const BASELINE_BEFORE = '0024_session_schema_reconcile.sql';

async function applyFileMigrations(client) {
    if (!fs.existsSync(MIGRATIONS_DIR)) {
        console.log('[migrate] No db/migrations directory — skipping file migrations.');
        return;
    }

    const ledgerExisted = (
        await client.query(`SELECT to_regclass('pgmonitoringtool.schema_migrations') IS NOT NULL AS present`)
    ).rows[0].present;

    await client.query(`
        CREATE TABLE IF NOT EXISTS pgmonitoringtool.schema_migrations (
            filename    TEXT        PRIMARY KEY,
            applied_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
            baselined   BOOLEAN     NOT NULL DEFAULT false
        )
    `);

    const files = fs
        .readdirSync(MIGRATIONS_DIR)
        .filter((f) => f.endsWith('.sql'))
        .sort();

    if (!ledgerExisted) {
        const baseline = files.filter((f) => f < BASELINE_BEFORE);
        if (baseline.length) {
            await client.query(
                `INSERT INTO pgmonitoringtool.schema_migrations (filename, baselined)
                 SELECT unnest($1::text[]), true
                 ON CONFLICT (filename) DO NOTHING`,
                [baseline],
            );
            console.log(
                `[migrate] Baselined ${baseline.length} pre-existing migration file(s) ` +
                    `(recorded, not executed): ${baseline[0]} … ${baseline[baseline.length - 1]}`,
            );
        }
    }

    const { rows } = await client.query('SELECT filename FROM pgmonitoringtool.schema_migrations');
    const applied = new Set(rows.map((r) => r.filename));

    for (const file of files) {
        if (applied.has(file)) {
            console.log(`[migrate] · ${file} (already applied)`);
            continue;
        }

        const raw = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
        // drizzle-kit separates statements with this marker. Files without it
        // are executed as a single batch.
        const statements = raw
            .split('--> statement-breakpoint')
            .map((s) => s.trim())
            .filter((s) => s.length > 0 && !/^(--[^\n]*\n?)*$/.test(s));

        console.log(`[migrate] Applying ${file} (${statements.length} statement(s))...`);
        try {
            await client.query('BEGIN');
            for (const stmt of statements) {
                await client.query(stmt);
            }
            await client.query('INSERT INTO pgmonitoringtool.schema_migrations (filename) VALUES ($1)', [file]);
            await client.query('COMMIT');
            console.log(`[migrate] ✓ ${file}`);
        } catch (err) {
            await client.query('ROLLBACK').catch(() => {});
            throw new Error(`${file}: ${err.message}`);
        }
    }
}

async function migrate() {
    console.log('[migrate] Connecting to database...');
    const client = await pool.connect();
    try {
        for (let i = 0; i < migrations.length; i++) {
            const sql = migrations[i].trim();
            const preview = sql.split('\n')[0].slice(0, 60);
            console.log(`[migrate] Running migration ${i + 1}/${migrations.length}: ${preview}...`);
            await client.query(sql);
            console.log(`[migrate] ✓ Done`);
        }

        console.log('[migrate] Applying file migrations from db/migrations...');
        await applyFileMigrations(client);

        console.log('[migrate] All migrations applied successfully.');
    } catch (err) {
        console.error('[migrate] ERROR:', err.message);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

migrate();
