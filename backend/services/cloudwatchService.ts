// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
// services/cloudwatchService.js
// Fetches RDS metrics from AWS CloudWatch using the REST API (no SDK needed)
import crypto from 'crypto';

// Module-level defaults from env (used when no per-request credentials supplied)
const ENV_REGION     = process.env.AWS_REGION            || 'ap-southeast-1';
const ENV_ACCESS_KEY = process.env.AWS_ACCESS_KEY_ID;
const ENV_SECRET_KEY = process.env.AWS_SECRET_ACCESS_KEY;
const ENV_DB_ID      = process.env.CLOUDWATCH_DB_IDENTIFIER;

// Resolve credentials: per-request overrides take priority over env vars
function resolveCredentials(overrides = {}) {
    return {
        REGION:     overrides.region     || ENV_REGION,
        ACCESS_KEY: overrides.accessKey  || ENV_ACCESS_KEY,
        SECRET_KEY: overrides.secretKey  || ENV_SECRET_KEY,
        DB_ID:      overrides.dbId       || ENV_DB_ID,
    };
}

export function isConfigured(overrides = {}) {
    const { REGION, ACCESS_KEY, SECRET_KEY, DB_ID } = resolveCredentials(overrides);
    return !!(ACCESS_KEY && SECRET_KEY && REGION && DB_ID);
}

/* ── AWS Signature V4 ── */
function sign(key, msg) {
    return crypto.createHmac('sha256', key).update(msg).digest();
}
function getSigningKey(secret, date, region, service) {
    const kDate    = sign(`AWS4${secret}`, date);
    const kRegion  = sign(kDate, region);
    const kService = sign(kRegion, service);
    return sign(kService, 'aws4_request');
}
function sha256hex(str) {
    return crypto.createHash('sha256').update(str).digest('hex');
}

async function cloudwatchRequest(params, creds = {}) {
    const { REGION, ACCESS_KEY, SECRET_KEY } = { ...resolveCredentials(creds) };
    const service  = 'monitoring';
    const host     = `monitoring.${REGION}.amazonaws.com`;
    const endpoint = `https://${host}/`;

    const now     = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 15) + 'Z';
    const dateStr = amzDate.slice(0, 8);

    const sessionToken = process.env.AWS_SESSION_TOKEN;

    // Build query string (sorted)
    const query = Object.entries({ Action: 'GetMetricStatistics', Version: '2010-08-01', ...params })
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&');

    const payloadHash = sha256hex('');

    let canonicalHeaders = `host:${host}\nx-amz-date:${amzDate}\n`;
    let signedHeaders    = 'host;x-amz-date';

    if (sessionToken) {
        canonicalHeaders += `x-amz-security-token:${sessionToken}\n`;
        signedHeaders    += ';x-amz-security-token';
    }

    const canonicalReq = `GET\n/\n${query}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
    const credScope    = `${dateStr}/${REGION}/${service}/aws4_request`;
    const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credScope}\n${sha256hex(canonicalReq)}`;
    const signingKey   = getSigningKey(SECRET_KEY, dateStr, REGION, service);
    const signature    = sign(signingKey, stringToSign).toString('hex');
    const authHeader   = `AWS4-HMAC-SHA256 Credential=${ACCESS_KEY}/${credScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const headers = { 'x-amz-date': amzDate, Authorization: authHeader };
    if (sessionToken) headers['x-amz-security-token'] = sessionToken;

    const res  = await fetch(`${endpoint}?${query}`, { headers });
    const text = await res.text();
    if (!res.ok) throw new Error(`CloudWatch error ${res.status}: ${text.slice(0, 300)}`);
    return text; // XML
}

/* ── Parse CloudWatch XML datapoints ── */
function parseDatapoints(xml) {
    const points   = [];
    const memberRx = /<member>([\s\S]*?)<\/member>/g;
    let m;
    while ((m = memberRx.exec(xml)) !== null) {
        const block = m[1];
        const ts    = (/<Timestamp>(.*?)<\/Timestamp>/.exec(block))?.[1];
        const avg   = (/<Average>(.*?)<\/Average>/.exec(block))?.[1];
        const sum   = (/<Sum>(.*?)<\/Sum>/.exec(block))?.[1];
        const val   = avg ?? sum;
        if (ts && val !== undefined) {
            points.push({ timestamp: ts, value: parseFloat(val) });
        }
    }
    return points.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

/* ── Metric stat map ── */
const STAT_MAP = {
    CPUUtilization:           'Average',
    DatabaseConnections:      'Average',
    FreeableMemory:           'Average',
    ReadIOPS:                 'Average',
    WriteIOPS:                'Average',
    ReadLatency:              'Average',
    FreeStorageSpace:         'Average',
    NetworkReceiveThroughput: 'Average',
    DBLoad:                   'Average',
};

/**
 * Fetch a single CloudWatch metric.
 *
 * @param {string} metricName   - e.g. 'CPUUtilization'
 * @param {number} periodSeconds - granularity in seconds (60, 300, 3600 …)
 * @param {object} overrides     - { region, accessKey, secretKey, dbId, startTime, endTime }
 *
 * startTime / endTime (ISO strings) come from the frontend and define the time
 * window to query. If omitted we fall back to "last periodSeconds seconds"
 * which was the old (broken) behaviour.
 */
export async function getMetric(metricName, periodSeconds = 60, overrides = {}) {
    const creds = resolveCredentials(overrides);
    if (!isConfigured(overrides)) {
        throw new Error(
            'CloudWatch not configured. Set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, and CLOUDWATCH_DB_IDENTIFIER.'
        );
    }

    const stat = STAT_MAP[metricName] || 'Average';

    // ── FIX 1: honour startTime / endTime sent by the frontend ──
    const endTime   = overrides.endTime   ? new Date(overrides.endTime)   : new Date();
    const startTime = overrides.startTime ? new Date(overrides.startTime) : new Date(endTime.getTime() - 3600 * 1000);

    // ── FIX 2: period must be >= 60, a multiple of 60, and sensible ──
    // periodSeconds is now the bucket granularity (60 / 300 / 3600),
    // NOT the total window length.
    const cwPeriod = Math.max(60, Math.round(periodSeconds / 60) * 60);

    const xml = await cloudwatchRequest({
        MetricName:                  metricName,
        Namespace:                   'AWS/RDS',
        'Statistics.member.1':       stat,
        'Dimensions.member.1.Name':  'DBInstanceIdentifier',
        'Dimensions.member.1.Value': creds.DB_ID,
        StartTime:                   startTime.toISOString(),
        EndTime:                     endTime.toISOString(),
        Period:                      String(cwPeriod),
    }, creds);

    return parseDatapoints(xml);
}

export function getStatus(overrides = {}) {
    const creds = resolveCredentials(overrides);
    const token = process.env.AWS_SESSION_TOKEN;
    return {
        configured:   isConfigured(overrides),
        region:       creds.REGION     || null,
        dbIdentifier: creds.DB_ID      || null,
        hasKey:       !!creds.ACCESS_KEY,
        hasSecret:    !!creds.SECRET_KEY,
        hasToken:     !!token,
        tokenStart:   token ? token.substring(0, 5) : 'none',
    };
}