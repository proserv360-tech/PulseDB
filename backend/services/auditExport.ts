// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * services/auditExport.js
 * ───────────────────────
 * Immutable audit-log export to an S3-compatible bucket (AWS S3, Cloudflare
 * R2, Backblaze B2, Wasabi, MinIO). Designed to be scheduled from the
 * existing node-cron loop.
 *
 * Export format: newline-delimited JSON (`.ndjson`), one event per line,
 * gzipped. One object per hour:
 *   s3://<bucket>/fathom/audit/<workspace_slug>/yyyy=YYYY/mm=MM/dd=DD/HH.ndjson.gz
 *
 * The <workspace_slug> segment names the object only — audit_log carries no
 * workspace_id, so rows are not partitioned by tenant. See runAuditExport().
 *
 * SQS/EventBridge-compatible objects: if you enable S3 → SQS notifications,
 * your SIEM pipeline can ingest them lossless-ly.
 *
 * Dependency: @aws-sdk/client-s3 (install once, reused). If not present,
 * falls back to logging "would export X events" so local dev still runs.
 */

import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { query } from '../db.js';

const DEFAULTS = {
    bucket:       process.env.AUDIT_EXPORT_BUCKET,
    region:       process.env.AUDIT_EXPORT_REGION || 'us-east-1',
    prefix:       process.env.AUDIT_EXPORT_PREFIX || 'fathom/audit',
    endpoint:     process.env.AUDIT_EXPORT_ENDPOINT, // set for R2/B2/MinIO
    accessKey:    process.env.AUDIT_EXPORT_ACCESS_KEY,
    secretKey:    process.env.AUDIT_EXPORT_SECRET_KEY,
    forcePathStyle: process.env.AUDIT_EXPORT_FORCE_PATH_STYLE === 'true',
};

let _s3Client = null;
async function getS3() {
    if (_s3Client) return _s3Client;

    // No bucket configured is the ordinary local-dev case: the operator never
    // asked for export, so there is nothing to warn about.
    if (!DEFAULTS.bucket) return null;

    try {
        const { S3Client } = await import('@aws-sdk/client-s3');
        _s3Client = new S3Client({
            region: DEFAULTS.region,
            endpoint: DEFAULTS.endpoint,
            forcePathStyle: DEFAULTS.forcePathStyle,
            credentials: DEFAULTS.accessKey
                ? { accessKeyId: DEFAULTS.accessKey, secretAccessKey: DEFAULTS.secretKey }
                : undefined,
        });
        return _s3Client;
    } catch (err) {
        // A configured bucket with no SDK is a misconfiguration, not a
        // fallback. The operator asked for audit export — a compliance
        // control — and silently getting none is the worst outcome: the
        // feature looks enabled and produces nothing, and nobody finds out
        // until an auditor asks for records that were never written.
        //
        // console.warn was too quiet for that. It bypasses the structured
        // logger, so it never reaches log aggregation and cannot be alerted on.
        const detail = err?.code === 'ERR_MODULE_NOT_FOUND' || /Cannot find (module|package)/i.test(err?.message || '')
            ? 'the package is not installed — run: npm i @aws-sdk/client-s3 --workspace=backend'
            : `the package failed to load: ${err?.message}`;

        console.error(
            `[auditExport] AUDIT_EXPORT_BUCKET is set to "${DEFAULTS.bucket}" but ` +
                `@aws-sdk/client-s3 is unavailable, so NO audit events are being exported. ` +
                detail,
        );

        // Surfaced to the caller so runAuditExport() can report a failed run
        // rather than a successful no-op.
        throw new Error(
            'auditExport: @aws-sdk/client-s3 unavailable while AUDIT_EXPORT_BUCKET is configured',
        );
    }
}

// Columns as they actually exist on pgmonitoringtool.audit_log — see
// db/migrations/0027_audit_log_and_api_keys.sql and services/auditService.ts,
// which is the only writer. This module previously selected `ts`, `target`,
// `details` and `workspace_id`, none of which exist on any generation of the
// table, so every scheduled run died with 42703 (`column "ts" does not exist`).
const EVENT_COLUMNS = `id, created_at, actor_id, actor_username, action,
                       resource_type, resource_id, level, detail, metadata,
                       ip_address`;

// Same fallback auditService uses: a legacy deployment may predate
// resource_type, and a hard failure there would silence the export entirely.
const EVENT_COLUMNS_LEGACY = `id, created_at, actor_id, actor_username, action,
                       NULL AS resource_type, resource_id, level, detail,
                       metadata, ip_address`;

// Safety valve. One hour of audit traffic that exceeds this is a signal
// something is wrong; buffering it all into memory to gzip would make it worse.
const MAX_ROWS = Number(process.env.AUDIT_EXPORT_MAX_ROWS) || 100_000;

async function selectEvents(start, end) {
    const sql = cols => `SELECT ${cols}
           FROM pgmonitoringtool.audit_log
          WHERE created_at >= $1 AND created_at < $2
          ORDER BY created_at ASC, id ASC
          LIMIT $3`;
    try {
        const { rows } = await query(sql(EVENT_COLUMNS), [start, end, MAX_ROWS]);
        return rows;
    } catch (err) {
        if (err.message && err.message.includes('resource_type')) {
            const { rows } = await query(sql(EVENT_COLUMNS_LEGACY), [start, end, MAX_ROWS]);
            return rows;
        }
        throw err;
    }
}

/**
 * Export the audit log rows for [fromTs, toTs). Returns a summary
 * { exported: n, workspaces: [...] }.
 *
 * NOTE ON SCOPING: audit_log has no workspace_id column and writeAudit() has no
 * workspace context to give it, so the log is effectively single-tenant and the
 * whole window is exported under one object. `workspaceSlug` is honoured when a
 * caller passes an explicit workspaceId — that only names the object, it does
 * NOT filter rows. Per-workspace exports need audit_log.workspace_id first.
 */
export async function runAuditExport({ fromTs, toTs, workspaceId = 0 } = {}) {
    const end = toTs || new Date();
    const start = fromTs || new Date(end.getTime() - 60 * 60 * 1000); // last hour

    const events = await selectEvents(start, end);
    if (events.length === 0) return { exported: 0, workspaces: [] };
    if (events.length >= MAX_ROWS) {
        console.warn(
            `[auditExport] hit the ${MAX_ROWS}-row cap for ${start.toISOString()}` +
            `–${end.toISOString()}; the tail of this window was not exported`
        );
    }

    const slug = await workspaceSlug(workspaceId);

    const s3 = await getS3();
    if (!s3) {
        console.log(`[auditExport] dry-run: would export ${events.length} events`);
        return { exported: events.length, workspaces: [slug], dryRun: true };
    }

    const { PutObjectCommand } = await import('@aws-sdk/client-s3');
    const ndjson = events.map(e => JSON.stringify(e)).join('\n');
    const gz = gzipSync(Buffer.from(ndjson, 'utf8'));
    // LOW-4: emit a SHA-256 of the decompressed NDJSON payload AND of the
    // on-the-wire gzip body so downstream SIEMs / integrity checkers can
    // detect tampering even if the object is mutated in-bucket. The gzip
    // digest doubles as an idempotency key.
    const plainSha = createHash('sha256').update(ndjson, 'utf8').digest('hex');
    const gzSha    = createHash('sha256').update(gz).digest('hex');
    const d = new Date(start);
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const hh = String(d.getUTCHours()).padStart(2, '0');
    const key = `${DEFAULTS.prefix}/${slug}/yyyy=${yyyy}/mm=${mm}/dd=${dd}/${hh}.ndjson.gz`;
    await s3.send(new PutObjectCommand({
        Bucket: DEFAULTS.bucket,
        Key: key,
        Body: gz,
        ContentType: 'application/x-ndjson',
        ContentEncoding: 'gzip',
        // ChecksumSHA256 is interpreted by S3 itself for integrity; the
        // Metadata entries are retained so non-S3 backends (R2, MinIO,
        // B2) still surface the hashes in the response headers.
        ChecksumSHA256: Buffer.from(gzSha, 'hex').toString('base64'),
        Metadata: {
            'fathom-workspace-id':   String(workspaceId),
            'fathom-event-count':    String(events.length),
            'fathom-content-sha256': plainSha,
            'fathom-gzip-sha256':    gzSha,
            'fathom-schema-version': '1',
        },
    }));

    return {
        exported: events.length,
        workspaces: [{
            workspaceId, slug, key, events: events.length,
            sha256: plainSha, gzipSha256: gzSha,
        }],
    };
}

async function workspaceSlug(wsId) {
    if (!wsId) return 'system';
    const { rows } = await query(
        `SELECT slug FROM pgmonitoringtool.workspaces WHERE id = $1 LIMIT 1`,
        [wsId]
    );
    return rows[0]?.slug || `ws-${wsId}`;
}

/**
 * Schedule hook — call from the existing cron loop once an hour.
 */
export function scheduleAuditExport(intervalMs = 60 * 60 * 1000) {
    const tick = async () => {
        try {
            const summary = await runAuditExport();
            if (summary.exported) {
                console.log('[auditExport]', JSON.stringify(summary));
            }
        } catch (err) {
            console.error('[auditExport] failed:', err.message);
        }
    };
    // Fire once on boot after a short delay, then at the configured cadence.
    setTimeout(tick, 30_000);
    return setInterval(tick, intervalMs);
}
