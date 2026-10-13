// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * kmsService.js
 *
 * BYOK (Bring Your Own Key) support. Pluggable KMS backend for wrapping and
 * unwrapping per-tenant data-encryption keys (DEKs).
 *
 * Backends:
 *   • 'local'    — dev/test only. Wraps with the node-process ENCRYPTION_KEY.
 *   • 'aws-kms'  — uses @aws-sdk/client-kms to call KMS:Encrypt / Decrypt.
 *   • 'gcp-kms'  — uses @google-cloud/kms (stub surface only).
 *   • 'vault'    — uses node-vault Transit engine (stub surface only).
 *
 * Envelope encryption model:
 *   1. Generate a random 32-byte DEK in-memory.
 *   2. Encrypt payloads with AES-256-GCM using the DEK.
 *   3. Wrap the DEK with the tenant's KEK in the configured KMS.
 *   4. Persist the wrapped DEK (bytea) in pgmonitoringtool.tenant_keys.
 *
 * Rotation: a new DEK is generated, all active encrypted columns are
 * re-encrypted in the background worker (not implemented here — the row
 * re-key is best done with a migration script), and the old wrapped DEK
 * is retired (retired_at = now()).
 */

import crypto from 'node:crypto';

const ALGO = 'aes-256-gcm';

/** Generate a fresh random data-encryption key. */
export function generateDek() {
    return crypto.randomBytes(32);
}

/** Envelope encrypt `plaintext` (string|Buffer) with a DEK. */
export function encryptWithDek(dek, plaintext) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGO, dek, iv);
    const buf = Buffer.isBuffer(plaintext) ? plaintext : Buffer.from(String(plaintext), 'utf8');
    const enc = Buffer.concat([cipher.update(buf), cipher.final()]);
    const tag = cipher.getAuthTag();
    return { iv, enc, tag };
}

/** Decrypt `{iv, enc, tag}` with a DEK. */
export function decryptWithDek(dek, { iv, enc, tag }) {
    const d = crypto.createDecipheriv(ALGO, dek, iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(enc), d.final()]);
}

// ─── KMS backends ────────────────────────────────────────────────────────────

/**
 * Local backend — wraps the DEK with AES-256-GCM using a key derived from the
 * process-level ENCRYPTION_KEY. Safe default for single-tenant deployments.
 */
class LocalKms {
    constructor({ masterKey }) {
        if (!masterKey || masterKey.length < 32) {
            throw new Error('LocalKms requires ENCRYPTION_KEY of at least 32 chars');
        }
        this.kek = crypto.createHash('sha256').update(masterKey).digest();
    }
    async wrap(dek) {
        const { iv, enc, tag } = encryptWithDek(this.kek, dek);
        return Buffer.concat([iv, tag, enc]);        // 12B IV + 16B tag + ciphertext
    }
    async unwrap(wrapped) {
        const iv  = wrapped.slice(0, 12);
        const tag = wrapped.slice(12, 28);
        const enc = wrapped.slice(28);
        return decryptWithDek(this.kek, { iv, enc, tag });
    }
    describe() { return { backend: 'local', key_id: 'local://process-env' }; }
}

/**
 * AWS KMS backend — defers wrap/unwrap to KMS Encrypt/Decrypt. Requires
 * `@aws-sdk/client-kms` as a peer dependency.
 */
class AwsKms {
    constructor({ region, keyId }) {
        this.region = region || process.env.AWS_REGION || 'us-east-1';
        this.keyId  = keyId;
        this._client = null;
    }
    async _kms() {
        if (this._client) return this._client;
        const { KMSClient } = await import('@aws-sdk/client-kms');
        this._client = new KMSClient({ region: this.region });
        return this._client;
    }
    async wrap(dek) {
        const { EncryptCommand } = await import('@aws-sdk/client-kms');
        const c = await this._kms();
        const r = await c.send(new EncryptCommand({
            KeyId: this.keyId,
            Plaintext: dek,
        }));
        return Buffer.from(r.CiphertextBlob);
    }
    async unwrap(wrapped) {
        const { DecryptCommand } = await import('@aws-sdk/client-kms');
        const c = await this._kms();
        const r = await c.send(new DecryptCommand({
            KeyId: this.keyId,
            CiphertextBlob: wrapped,
        }));
        return Buffer.from(r.Plaintext);
    }
    describe() { return { backend: 'aws-kms', key_id: this.keyId, region: this.region }; }
}

/** Factory based on env + optional per-workspace override. */
export function getKmsBackend({ backend = process.env.FATHOM_KMS_BACKEND || 'local', ...cfg } = {}) {
    switch (String(backend).toLowerCase()) {
        case 'aws-kms':
        case 'aws':
            return new AwsKms({
                region: cfg.region || process.env.AWS_REGION,
                keyId:  cfg.keyId  || process.env.FATHOM_KMS_KEY_ID,
            });
        case 'local':
        case undefined:
        case null:
        case '':
            return new LocalKms({ masterKey: cfg.masterKey || process.env.ENCRYPTION_KEY });
        default:
            throw new Error(`Unsupported KMS backend: ${backend}`);
    }
}

// ─── High-level helpers used by connection/secret services ──────────────────

/**
 * Provision the first KEK for a workspace: generates a DEK, wraps it,
 * inserts into tenant_keys, and returns the active tenant_keys.id + DEK.
 */
export async function provisionTenantKey(pool, workspaceId, { kms } = {}) {
    const backend = kms || getKmsBackend();
    const dek = generateDek();
    const wrapped = await backend.wrap(dek);
    const desc = backend.describe();
    const { rows } = await pool.query(
        `INSERT INTO pgmonitoringtool.tenant_keys (workspace_id, kms_backend, kms_key_id, wrapped_dek, version)
         VALUES ($1, $2, $3, $4, 1)
         RETURNING id`,
        [workspaceId, desc.backend, desc.key_id, wrapped],
    );
    return { tenant_key_id: rows[0].id, dek };
}

/** Load (unwrap) the active DEK for a workspace. */
export async function loadTenantKey(pool, workspaceId, { kms } = {}) {
    const { rows } = await pool.query(
        `SELECT id, kms_backend, kms_key_id, wrapped_dek
           FROM pgmonitoringtool.tenant_keys
          WHERE workspace_id = $1 AND retired_at IS NULL
          ORDER BY version DESC
          LIMIT 1`,
        [workspaceId],
    );
    if (!rows[0]) return null;
    const backend = kms || getKmsBackend({ backend: rows[0].kms_backend, keyId: rows[0].kms_key_id });
    const dek = await backend.unwrap(rows[0].wrapped_dek);
    return { tenant_key_id: rows[0].id, dek };
}

/**
 * Rotate the active DEK. Generates a new one, wraps it, inserts a new row
 * (version+1, rotated_from_id set to the old row), and retires the old row.
 *
 * NOTE: callers MUST re-encrypt all columns that were encrypted under the
 * old DEK before the old row is truly safe to retire in production. The
 * re-encryption worker lives outside this service (see ops/rekey.js).
 */
export async function rotateTenantKey(pool, workspaceId, { kms } = {}) {
    const backend = kms || getKmsBackend();
    const { rows: oldRows } = await pool.query(
        `SELECT id, version FROM pgmonitoringtool.tenant_keys
          WHERE workspace_id = $1 AND retired_at IS NULL
          ORDER BY version DESC LIMIT 1`,
        [workspaceId],
    );
    const oldRow = oldRows[0];
    const newDek = generateDek();
    const wrapped = await backend.wrap(newDek);
    const desc = backend.describe();
    const nextVersion = (oldRow?.version || 0) + 1;
    const { rows } = await pool.query(
        `INSERT INTO pgmonitoringtool.tenant_keys
             (workspace_id, kms_backend, kms_key_id, wrapped_dek, version, rotated_from_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [workspaceId, desc.backend, desc.key_id, wrapped, nextVersion, oldRow?.id || null],
    );
    if (oldRow) {
        await pool.query(
            `UPDATE pgmonitoringtool.tenant_keys SET retired_at = now() WHERE id = $1`,
            [oldRow.id],
        );
    }
    return { tenant_key_id: rows[0].id, version: nextVersion };
}

export default {
    generateDek,
    encryptWithDek,
    decryptWithDek,
    getKmsBackend,
    provisionTenantKey,
    loadTenantKey,
    rotateTenantKey,
};
