// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * services/destinationService.js
 * ───────────────────────────────
 * Per-organization CRUD for alert destinations, plus the bridge to the
 * NotifierManager fan-out.
 *
 * One row in pgmonitoringtool.notification_destinations = one configured
 * integration (Slack channel, PagerDuty service, webhook URL, …). At alert
 * time, buildNotifiersForOrg() loads every enabled destination for the org,
 * instantiates the matching notifier class with its decrypted credentials,
 * and returns an array suitable for `new NotifierManager({ notifiers: [...] })`.
 *
 * Security:
 *   • Credentials (`secret_enc`) are encrypted with AES-256-GCM via
 *     encryptionService.encrypt. Raw secrets never leave this module.
 *   • API responses redact the secret to `***` — the UI can only tell whether
 *     a secret is set, not what it is.
 *   • Provider-specific validation refuses empty secrets where one is required.
 */

import { encrypt, decrypt } from './encryptionService.js';
import {
    SlackNotifier,
    PagerDutyNotifier,
    OpsgenieNotifier,
    TeamsNotifier,
    WebhookNotifier,
} from './notifiers/index.js';

const S = 'pgmonitoringtool';
const TABLE = `${S}.notification_destinations`;

export const SUPPORTED_PROVIDERS = ['slack', 'pagerduty', 'opsgenie', 'teams', 'webhook'];
export const VALID_SEVERITIES = ['debug', 'info', 'warning', 'error', 'critical'];

/* ─── Row normaliser ────────────────────────────────────────────────────── */

export function toClientDestination(row) {
    if (!row) return null;
    return {
        id: row.id,
        orgId: row.org_id,
        name: row.name,
        provider: row.provider,
        minSeverity: row.min_severity,
        enabled: row.enabled,
        config: row.config || {},
        // Never expose the encrypted ciphertext itself; only whether a secret
        // is present.
        hasSecret: !!row.secret_enc,
        createdBy: row.created_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        lastUsedAt: row.last_used_at,
        lastStatus: row.last_status,
        lastError: row.last_error,
    };
}

/* ─── Validation ────────────────────────────────────────────────────────── */

/**
 * Throws a 400-style error if the input isn't a valid destination payload.
 * Secret requirements are provider-specific.
 */
export function validateDestinationInput(input, { forUpdate = false } = {}) {
    const errors = [];

    if (!forUpdate && !input.name) errors.push('name is required');
    if (input.name && input.name.length > 120) errors.push('name too long (max 120)');

    if (!forUpdate && !input.provider) errors.push('provider is required');
    if (input.provider && !SUPPORTED_PROVIDERS.includes(input.provider)) {
        errors.push(`provider must be one of: ${SUPPORTED_PROVIDERS.join(', ')}`);
    }

    if (input.minSeverity && !VALID_SEVERITIES.includes(input.minSeverity)) {
        errors.push(`minSeverity must be one of: ${VALID_SEVERITIES.join(', ')}`);
    }

    if (input.config && typeof input.config !== 'object') {
        errors.push('config must be an object');
    }

    // Provider-specific required fields — only enforced on create or when
    // changing provider.
    const provider = input.provider;
    const cfg = input.config || {};
    if (provider === 'slack') {
        const hasWebhook = !!cfg.webhookUrl;
        const hasBot = !!cfg.channel && !!input.secret; // secret = botToken
        const existingSecretOk = forUpdate && cfg.channel; // existing bot token retained
        if (!hasWebhook && !hasBot && !existingSecretOk) {
            errors.push('slack destinations need either config.webhookUrl OR (config.channel + secret=botToken)');
        }
        if (cfg.webhookUrl && !/^https:\/\/hooks\.slack\.com\//.test(cfg.webhookUrl)) {
            errors.push('slack webhookUrl must start with https://hooks.slack.com/');
        }
    }
    if (provider === 'pagerduty' && !input.secret && !forUpdate) {
        errors.push('pagerduty destinations need secret=routingKey');
    }
    if (provider === 'opsgenie' && !input.secret && !forUpdate) {
        errors.push('opsgenie destinations need secret=apiKey');
    }
    if (provider === 'teams' && !cfg.webhookUrl) {
        errors.push('teams destinations need config.webhookUrl');
    }
    if (provider === 'webhook') {
        if (!cfg.url && !forUpdate) errors.push('webhook destinations need config.url');
        if (!input.secret && !forUpdate) errors.push('webhook destinations need secret=hmacSecret');
        if (cfg.url && !/^https?:\/\//.test(cfg.url)) {
            errors.push('webhook config.url must be http(s)://');
        }
    }

    if (errors.length) {
        const err = new Error(errors.join('; '));
        err.status = 400;
        err.validation = errors;
        throw err;
    }
}

/* ─── CRUD ──────────────────────────────────────────────────────────────── */

/**
 * Create a new destination. Encrypts the supplied secret (if any) before
 * writing it to the DB.
 */
export async function createDestination(pool, orgId, input, actingUserId = null) {
    validateDestinationInput(input);
    const {
        name,
        provider,
        minSeverity = 'warning',
        enabled = true,
        config = {},
        secret = null,
    } = input;

    const secretEnc = secret ? encrypt(String(secret)) : null;

    const { rows } = await pool.query(
        `INSERT INTO ${TABLE}
            (org_id, name, provider, min_severity, enabled, config, secret_enc, created_by)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)
         RETURNING *`,
        [orgId, name, provider, minSeverity, !!enabled, JSON.stringify(config), secretEnc, actingUserId]
    ).catch(err => {
        if (err.code === '23505') {
            const e = new Error(`Destination named "${name}" already exists for this organization`);
            e.status = 409;
            throw e;
        }
        throw err;
    });
    return toClientDestination(rows[0]);
}

/**
 * List destinations for an organization. Secrets are never returned; callers
 * see `hasSecret: boolean` only.
 */
export async function listDestinations(pool, orgId) {
    const { rows } = await pool.query(
        `SELECT * FROM ${TABLE}
          WHERE org_id = $1
          ORDER BY provider, lower(name)`,
        [orgId]
    );
    return rows.map(toClientDestination);
}

export async function getDestination(pool, orgId, destId) {
    const { rows } = await pool.query(
        `SELECT * FROM ${TABLE} WHERE id = $1 AND org_id = $2`,
        [destId, orgId]
    );
    return rows[0] ? toClientDestination(rows[0]) : null;
}

/**
 * Update a destination. Partial update — only provided fields change.
 * Passing `secret: null` clears the stored secret; passing `secret: undefined`
 * (i.e. not providing it) retains the existing one.
 */
export async function updateDestination(pool, orgId, destId, input) {
    validateDestinationInput(input, { forUpdate: true });

    const sets = [];
    const vals = [];
    let i = 1;
    const push = (col, val) => { sets.push(`${col} = $${i++}`); vals.push(val); };

    if (input.name !== undefined) push('name', input.name);
    if (input.provider !== undefined) push('provider', input.provider);
    if (input.minSeverity !== undefined) push('min_severity', input.minSeverity);
    if (input.enabled !== undefined) push('enabled', !!input.enabled);
    if (input.config !== undefined) {
        sets.push(`config = $${i++}::jsonb`);
        vals.push(JSON.stringify(input.config));
    }
    // Secret handling: key present → rotate; key absent → leave alone.
    if (Object.prototype.hasOwnProperty.call(input, 'secret')) {
        const enc = input.secret ? encrypt(String(input.secret)) : null;
        push('secret_enc', enc);
    }

    if (sets.length === 0) {
        // No-op update — return the existing row unchanged.
        return getDestination(pool, orgId, destId);
    }

    vals.push(destId, orgId);
    const { rows } = await pool.query(
        `UPDATE ${TABLE}
            SET ${sets.join(', ')}
          WHERE id = $${i++} AND org_id = $${i}
      RETURNING *`,
        vals
    ).catch(err => {
        if (err.code === '23505') {
            const e = new Error(`Destination named "${input.name}" already exists for this organization`);
            e.status = 409;
            throw e;
        }
        throw err;
    });
    return rows[0] ? toClientDestination(rows[0]) : null;
}

export async function deleteDestination(pool, orgId, destId) {
    const { rowCount } = await pool.query(
        `DELETE FROM ${TABLE} WHERE id = $1 AND org_id = $2`,
        [destId, orgId]
    );
    return rowCount > 0;
}

/**
 * Best-effort metadata update after a dispatch — wall-clock, last status,
 * last error. Never throws; a failure here must never break the alert path.
 */
export async function recordDispatchResult(pool, destId, result) {
    const { ok, status, detail } = result || {};
    const lastStatus = ok ? 'ok' : (status === 0 ? 'error' : `http_${status || 'unknown'}`);
    const lastError = ok ? null : String(detail || '').slice(0, 1000);
    await pool.query(
        `UPDATE ${TABLE}
            SET last_used_at = now(), last_status = $1, last_error = $2
          WHERE id = $3`,
        [lastStatus, lastError, destId]
    ).catch(err => {
        console.warn('[destinationService] recordDispatchResult failed:', err.message);
    });
}

/* ─── Bridge to NotifierManager ─────────────────────────────────────────── */

/**
 * Build a fresh array of notifier instances for every enabled destination
 * belonging to `orgId`. Callers wrap these in a NotifierManager.
 *
 * Returns `{ destId, notifier }[]` so the caller can tie dispatch results
 * back to a destination row (for metric updates).
 */
export async function buildNotifiersForOrg(pool, orgId, opts = {}) {
    const { httpFn = undefined } = opts;
    const { rows } = await pool.query(
        `SELECT * FROM ${TABLE}
          WHERE org_id = $1 AND enabled = true`,
        [orgId]
    );
    const out = [];
    for (const row of rows) {
        try {
            const instance = buildNotifierFromRow(row, { httpFn });
            if (instance) out.push({ destId: row.id, notifier: instance });
        } catch (err) {
            // Bad row (e.g. corrupt secret) must not break the whole dispatch.
            console.warn(
                `[destinationService] skipping destination ${row.id} (${row.provider}): ${err.message}`
            );
        }
    }
    return out;
}

/**
 * Turn one destination row into a configured notifier instance.
 * Exported for unit testing.
 */
export function buildNotifierFromRow(row, { httpFn } = {}) {
    const cfg = row.config || {};
    const common = {
        name: `${row.provider}:${row.name}`,
        minSeverity: row.min_severity || 'warning',
        ...(httpFn ? { http: httpFn } : {}),
    };
    const secret = row.secret_enc ? decrypt(row.secret_enc) : null;

    switch (row.provider) {
        case 'slack': {
            if (cfg.webhookUrl) {
                return new SlackNotifier({ webhookUrl: cfg.webhookUrl, template: cfg.template, ...common });
            }
            if (cfg.channel && secret) {
                return new SlackNotifier({ botToken: secret, channel: cfg.channel, template: cfg.template, ...common });
            }
            throw new Error('slack destination missing webhookUrl or channel+secret');
        }
        case 'pagerduty': {
            if (!secret) throw new Error('pagerduty destination missing routing key secret');
            return new PagerDutyNotifier({
                routingKey: secret,
                source: cfg.source || 'pulsedb',
                ...common,
            });
        }
        case 'opsgenie': {
            if (!secret) throw new Error('opsgenie destination missing api key secret');
            return new OpsgenieNotifier({
                apiKey: secret,
                euRegion: (cfg.region === 'eu'),
                source: cfg.source || 'pulsedb',
                responderTeams: Array.isArray(cfg.responderTeams) ? cfg.responderTeams : [],
                tags: Array.isArray(cfg.tags) ? cfg.tags : [],
                ...common,
            });
        }
        case 'teams': {
            if (!cfg.webhookUrl) throw new Error('teams destination missing config.webhookUrl');
            return new TeamsNotifier({ webhookUrl: cfg.webhookUrl, ...common });
        }
        case 'webhook': {
            if (!cfg.url) throw new Error('webhook destination missing config.url');
            if (!secret) throw new Error('webhook destination missing hmac secret');
            return new WebhookNotifier({
                url: cfg.url,
                secret,
                extraHeaders: cfg.extraHeaders || {},
                ...common,
            });
        }
        default:
            throw new Error(`unsupported provider: ${row.provider}`);
    }
}
