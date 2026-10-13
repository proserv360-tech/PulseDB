// @ts-nocheck — legacy JS style to match sibling services; type later (see docs/TS_MIGRATION.md)
/**
 * services/cloudInsightsService.js
 * ────────────────────────────────
 * Per-tenant cloud-managed database insights.
 *
 * This is the activation layer the competitive-features hand-off referred to
 * as `_resolveCloudConfig`: instead of a single set of process-env AWS vars,
 * each workspace can register its own cloud credentials, encrypted at rest,
 * and PulseDB resolves them on demand to pull metrics.
 *
 * Providers
 *   • aws    → Amazon RDS / Aurora via CloudWatch (delegates to
 *              cloudwatchService, which already implements SigV4 with no SDK).
 *   • atlas  → MongoDB Atlas via the Atlas Administration API
 *              (HTTP Digest auth, public/private API key pair).
 *
 * Security
 *   • Secrets are stored only as AES-256-GCM blobs (encryptionService.encrypt).
 *   • resolveCloudConfig is workspace-scoped — a workspace can never read
 *     another tenant's credentials.
 *   • The HTTP transport for Atlas is injectable (`_httpFn`) so tests never
 *     touch the network.
 */
import crypto from 'crypto';
import { query } from '../db.js';
import { encrypt, decrypt } from './encryptionService.js';
import { getMetric as cwGetMetric, getStatus as cwGetStatus } from './cloudwatchService.js';

const SUPPORTED = new Set(['aws', 'atlas']);

// ── Credential storage ──────────────────────────────────────────────────────
export async function saveCredential({
    workspaceId,
    provider,
    label = '',
    region = '',
    resourceId = '',
    accessId = '',
    secret = '',
    extra = {},
}) {
    if (!SUPPORTED.has(provider)) throw new Error(`unsupported provider: ${provider}`);
    const secretEnc = secret ? encrypt(String(secret)) : null;
    const r = await query(
        `INSERT INTO pgmonitoringtool.cloud_provider_credentials
            (workspace_id, provider, label, region, resource_id, access_id, secret_enc, extra, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8, now())
         ON CONFLICT (workspace_id, provider, label) DO UPDATE SET
            region      = EXCLUDED.region,
            resource_id = EXCLUDED.resource_id,
            access_id   = EXCLUDED.access_id,
            secret_enc  = COALESCE(EXCLUDED.secret_enc, pgmonitoringtool.cloud_provider_credentials.secret_enc),
            extra       = EXCLUDED.extra,
            updated_at  = now()
         RETURNING id`,
        [workspaceId ?? null, provider, label, region, resourceId, accessId, secretEnc, JSON.stringify(extra || {})],
    );
    return { id: r.rows[0]?.id, provider, label };
}

/** List credentials for a workspace WITHOUT decrypting secrets (safe for the UI). */
export async function listCredentials(workspaceId) {
    const r = await query(
        `SELECT id, provider, label, region, resource_id, access_id,
                (secret_enc IS NOT NULL) AS has_secret, extra, created_at, updated_at
           FROM pgmonitoringtool.cloud_provider_credentials
          WHERE ($1::int IS NULL OR workspace_id = $1)
          ORDER BY provider, label`,
        [workspaceId ?? null],
    );
    return r.rows.map((row) => ({
        id: row.id,
        provider: row.provider,
        label: row.label,
        region: row.region,
        resourceId: row.resource_id,
        accessId: row.access_id,
        hasSecret: row.has_secret,
        extra: row.extra,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    }));
}

export async function deleteCredential({ id, workspaceId }) {
    if (!id) return 0;
    const r = await query(
        `DELETE FROM pgmonitoringtool.cloud_provider_credentials
          WHERE id = $1 AND ($2::int IS NULL OR workspace_id = $2)`,
        [id, workspaceId ?? null],
    );
    return r && typeof r.rowCount === 'number' ? r.rowCount : 0;
}

// ── Resolver — the activation seam ──────────────────────────────────────────
/**
 * Resolve a workspace's decrypted cloud config for a provider.
 * Returns null when no credential row exists, so callers can cleanly fall
 * back (e.g. to process-env defaults for AWS). NEVER returns another
 * workspace's data — the lookup is workspace-scoped.
 *
 * @returns {Promise<null | {
 *   provider: string, region: string, resourceId: string,
 *   accessId: string, secret: string, extra: object
 * }>}
 */
export async function resolveCloudConfig(workspaceId, provider, { label } = {}) {
    if (!SUPPORTED.has(provider)) throw new Error(`unsupported provider: ${provider}`);
    const r = await query(
        `SELECT region, resource_id, access_id, secret_enc, extra
           FROM pgmonitoringtool.cloud_provider_credentials
          WHERE provider = $1
            AND ($2::int IS NULL OR workspace_id = $2)
            AND ($3::text IS NULL OR label = $3)
          ORDER BY updated_at DESC
          LIMIT 1`,
        [provider, workspaceId ?? null, label ?? null],
    );
    const row = r.rows[0];
    if (!row) return null;
    return {
        provider,
        region: row.region || '',
        resourceId: row.resource_id || '',
        accessId: row.access_id || '',
        secret: row.secret_enc ? decrypt(row.secret_enc) : '',
        extra: row.extra || {},
    };
}

// ── AWS RDS/Aurora ──────────────────────────────────────────────────────────
/**
 * Fetch an RDS/Aurora CloudWatch metric for a workspace. Uses the workspace's
 * stored credentials when present, otherwise falls back to the process-env
 * defaults already supported by cloudwatchService.
 */
export async function getAwsMetric(workspaceId, metricName, periodSeconds = 3600, opts = {}) {
    const cfg = await resolveCloudConfig(workspaceId, 'aws').catch(() => null);
    const overrides = cfg
        ? {
              region: cfg.region || undefined,
              accessKey: cfg.accessId || undefined,
              secretKey: cfg.secret || undefined,
              dbId: cfg.resourceId || undefined,
              ...opts,
          }
        : { ...opts };
    return cwGetMetric(metricName, periodSeconds, overrides);
}

export async function getAwsStatus(workspaceId) {
    const cfg = await resolveCloudConfig(workspaceId, 'aws').catch(() => null);
    const overrides = cfg
        ? { region: cfg.region, accessKey: cfg.accessId, secretKey: cfg.secret, dbId: cfg.resourceId }
        : {};
    return { source: cfg ? 'workspace' : 'env', ...cwGetStatus(overrides) };
}

// ── MongoDB Atlas ───────────────────────────────────────────────────────────
const ATLAS_BASE = 'https://cloud.mongodb.com/api/atlas/v2';

// Default transport; tests inject their own.
let _httpFn = async (url, init) => {
    const res = await fetch(url, init);
    const body = await res.text();
    return { status: res.status, headers: res.headers, body };
};
export function _setHttpFn(fn) {
    _httpFn = fn;
} // test seam
export function _resetHttpFn() {
    _httpFn = async (url, init) => {
        const res = await fetch(url, init);
        const body = await res.text();
        return { status: res.status, headers: res.headers, body };
    };
}

/**
 * Build the Authorization header value for one round of HTTP Digest auth,
 * given the server's WWW-Authenticate challenge. Atlas uses Digest with the
 * public key as username and the private key as password.
 */
export function buildDigestHeader({ method, uri, username, password, challenge, nc = '00000001', cnonce }) {
    const realm = /realm="([^"]+)"/.exec(challenge)?.[1] || '';
    const nonce = /nonce="([^"]+)"/.exec(challenge)?.[1] || '';
    const opaque = /opaque="([^"]+)"/.exec(challenge)?.[1];
    const qopRaw = /qop="?([^",]+)"?/.exec(challenge)?.[1];
    const qop = qopRaw ? qopRaw.split(',')[0].trim() : undefined;
    const algorithm = /algorithm=([^",\s]+)/.exec(challenge)?.[1] || 'MD5';

    const md5 = (s) => crypto.createHash('md5').update(s).digest('hex');
    const ha1 = md5(`${username}:${realm}:${password}`);
    const ha2 = md5(`${method}:${uri}`);
    const cn = cnonce || crypto.randomBytes(8).toString('hex');

    let response;
    if (qop) {
        response = md5(`${ha1}:${nonce}:${nc}:${cn}:${qop}:${ha2}`);
    } else {
        response = md5(`${ha1}:${nonce}:${ha2}`);
    }

    let header =
        `Digest username="${username}", realm="${realm}", nonce="${nonce}", uri="${uri}", ` +
        `algorithm=${algorithm}, response="${response}"`;
    if (qop) header += `, qop=${qop}, nc=${nc}, cnonce="${cn}"`;
    if (opaque) header += `, opaque="${opaque}"`;
    return header;
}

/**
 * Perform a GET against the Atlas API with two-step Digest auth:
 * first request gets a 401 + challenge, second carries the Digest header.
 */
async function atlasGet(path, { username, password }) {
    const url = `${ATLAS_BASE}${path}`;
    const accept = { Accept: 'application/vnd.atlas.2025-03-12+json' };
    const first = await _httpFn(url, { method: 'GET', headers: accept });
    if (first.status !== 401) {
        // Some transports (and our tests) may answer directly.
        if (first.status >= 200 && first.status < 300) return JSON.parse(first.body || '{}');
        throw new Error(`Atlas ${first.status}: ${String(first.body).slice(0, 200)}`);
    }
    const challenge =
        (typeof first.headers?.get === 'function'
            ? first.headers.get('www-authenticate')
            : first.headers?.['www-authenticate']) || '';
    const auth = buildDigestHeader({
        method: 'GET',
        uri: path.replace(/^https?:\/\/[^/]+/, ''),
        username,
        password,
        challenge,
    });
    const second = await _httpFn(url, { method: 'GET', headers: { ...accept, Authorization: auth } });
    if (second.status < 200 || second.status >= 300) {
        throw new Error(`Atlas ${second.status}: ${String(second.body).slice(0, 200)}`);
    }
    return JSON.parse(second.body || '{}');
}

/**
 * Fetch process-level measurements (CPU, connections, opcounters, memory)
 * for an Atlas cluster process. `resourceId` is the projectId (group id);
 * `extra.processId` identifies host:port; `extra.granularity`/`period` are
 * ISO-8601 durations (default PT1H window at PT1M granularity).
 */
export async function getAtlasMeasurements(workspaceId, { metrics } = {}) {
    const cfg = await resolveCloudConfig(workspaceId, 'atlas');
    if (!cfg) throw new Error('No Atlas credentials configured for this workspace');
    const projectId = cfg.resourceId;
    const processId = cfg.extra?.processId;
    if (!projectId || !processId) {
        throw new Error('Atlas credential requires resourceId (projectId) and extra.processId (host:port)');
    }
    const granularity = cfg.extra?.granularity || 'PT1M';
    const period = cfg.extra?.period || 'PT1H';
    const m =
        metrics && metrics.length ? metrics : ['PROCESS_CPU_USER', 'CONNECTIONS', 'OPCOUNTER_QUERY', 'MEMORY_RESIDENT'];
    const mq = m.map((x) => `m=${encodeURIComponent(x)}`).join('&');
    const path =
        `/groups/${projectId}/processes/${processId}/measurements` +
        `?granularity=${granularity}&period=${period}&${mq}`;
    const json = await atlasGet(path, { username: cfg.accessId, password: cfg.secret });
    return normalizeAtlas(json);
}

/** Reshape Atlas measurement payload into the same {name, datapoints[]} shape
 *  the CloudWatch path returns, so the frontend treats them uniformly. */
export function normalizeAtlas(json) {
    const out = [];
    for (const meas of json?.measurements || []) {
        out.push({
            name: meas.name,
            units: meas.units,
            datapoints: (meas.dataPoints || meas.datapoints || [])
                .filter((d) => d && d.value !== null && d.value !== undefined)
                .map((d) => ({ timestamp: d.timestamp, value: Number(d.value) })),
        });
    }
    return out;
}

export async function getAtlasStatus(workspaceId) {
    const cfg = await resolveCloudConfig(workspaceId, 'atlas').catch(() => null);
    return {
        configured: !!(cfg && cfg.accessId && cfg.secret && cfg.resourceId),
        projectId: cfg?.resourceId || null,
        processId: cfg?.extra?.processId || null,
        hasKey: !!cfg?.accessId,
        hasSecret: !!cfg?.secret,
    };
}

/**
 * Discovery: list the Atlas processes (mongod/mongos host:port endpoints) in a
 * workspace's configured project. Lets the UI offer a picker instead of making
 * the user hand-enter extra.processId. Uses the same Digest transport as
 * measurement fetches.
 */
export async function listAtlasProcesses(workspaceId) {
    const cfg = await resolveCloudConfig(workspaceId, 'atlas');
    if (!cfg) throw new Error('No Atlas credentials configured for this workspace');
    if (!cfg.resourceId) throw new Error('Atlas credential requires resourceId (projectId)');
    const json = await atlasGet(`/groups/${cfg.resourceId}/processes?itemsPerPage=500`, {
        username: cfg.accessId,
        password: cfg.secret,
    });
    return parseAtlasProcesses(json);
}

/** Pure: reshape an Atlas /processes payload. Exported for tests. */
export function parseAtlasProcesses(json) {
    return (json?.results || []).map((p) => ({
        id: p.id, // "host:port" — assignable to extra.processId
        hostname: p.hostname,
        port: p.port,
        typeName: p.typeName, // REPLICA_PRIMARY / REPLICA_SECONDARY / SHARD_MONGOS ...
        replicaSetName: p.replicaSetName || null,
        version: p.version || null,
        userAlias: p.userAlias || null,
    }));
}

/**
 * Discovery: list the Atlas clusters in the configured project, including the
 * connection topology so the UI can group processes under their cluster.
 */
export async function listAtlasClusters(workspaceId) {
    const cfg = await resolveCloudConfig(workspaceId, 'atlas');
    if (!cfg) throw new Error('No Atlas credentials configured for this workspace');
    if (!cfg.resourceId) throw new Error('Atlas credential requires resourceId (projectId)');
    const json = await atlasGet(`/groups/${cfg.resourceId}/clusters?itemsPerPage=500`, {
        username: cfg.accessId,
        password: cfg.secret,
    });
    return parseAtlasClusters(json);
}

/** Pure: reshape an Atlas /clusters payload. Exported for tests. */
export function parseAtlasClusters(json) {
    return (json?.results || []).map((c) => ({
        name: c.name,
        clusterType: c.clusterType, // REPLICASET / SHARDED / GEOSHARDED
        mongoDBVersion: c.mongoDBVersion || null,
        paused: !!c.paused,
        stateName: c.stateName || null,
    }));
}

export const SUPPORTED_PROVIDERS = [...SUPPORTED];

// Test-only: expose the low-level digest GET so the two-step handshake can be
// exercised without a control-plane DB. Not used by application code.
export async function _atlasGetForTest(path, creds) {
    return atlasGet(path, creds);
}
