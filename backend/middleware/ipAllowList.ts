/**
 * middleware/ipAllowList.js
 * ─────────────────────────
 * Per-workspace IP allow-listing. Pure JavaScript — no external deps.
 *
 * Runs as a gate BEFORE any workspace route, so it resolves the active
 * workspace ID on its own (from x-workspace-id header, ?workspace query
 * param, or the caller's default). Fail-open when the workspace has no
 * rules, fail-closed the moment a single CIDR is configured.
 *
 * Returns 403 with a stable error code when the client IP does not
 * match. Supports IPv4 and IPv6 CIDRs. Accepts req.ip (Express sets
 * this when `trust proxy` is configured) or socket.remoteAddress.
 */

import { query } from '../db.js';

const cache = new Map(); // workspaceId -> { cidrs: [...], ts }
const CACHE_MS = 30_000;

// Paths that intentionally bypass the allow-list (auth, metadata, SCIM).
// SCIM has its own bearer token; authentication endpoints must remain
// reachable so operators can log in from new offices.
const BYPASS = [
    /^\/api\/login\b/,
    /^\/api\/auth\//,
    /^\/api\/v1\/login\b/,
    /^\/api\/v1\/auth\//,
    /^\/api\/saml\/.+\/(metadata|acs|login)\b/,
    /^\/api\/v1\/saml\/.+\/(metadata|acs|login)\b/,
];

function resolveWorkspaceId(req: any) {
    const header = req.headers['x-workspace-id'];
    const q = req.query?.workspace;
    const n = Number(header || q || req.user?.defaultWorkspaceId || 0);
    return Number.isFinite(n) && n > 0 ? n : 0;
}

export function ipAllowListMiddleware() {
    return async function ipAllowList(req: any, res: any, next: any) {
        try {
            if (BYPASS.some((rx) => rx.test(req.path))) return next();

            const wsId = resolveWorkspaceId(req);
            if (!wsId) return next(); // nothing to check yet — resolveWorkspace will 401/403 later

            const cidrs = await getCidrs(wsId);
            if (cidrs.length === 0) return next(); // no rules → open

            const ip = (req.ip || req.socket?.remoteAddress || '').replace(/^::ffff:/, '');
            if (!ip) return res.status(403).json({ error: 'ip_allowlist_no_address' });

            for (const c of cidrs) {
                if (ipInCidr(ip, c)) return next();
            }
            return res.status(403).json({
                error: 'ip_not_allowed',
                ip,
                workspace: wsId,
            });
        } catch (err) {
            next(err);
        }
    };
}

async function getCidrs(wsId: any) {
    const hit = cache.get(wsId);
    if (hit && Date.now() - hit.ts < CACHE_MS) return hit.cidrs;
    const { rows } = await query(`SELECT cidr FROM pgmonitoringtool.ip_allowlist WHERE workspace_id = $1`, [wsId]);
    const cidrs = rows.map((r: any) => r.cidr);
    cache.set(wsId, { cidrs, ts: Date.now() });
    return cidrs;
}

/**
 * LOW-10 fix: admins can force-expire the cache when rules change so the
 * 30s window does not leak access after a revoke. Call from governance
 * routes whenever a rule is added or removed.
 */
export function invalidateIpAllowListCache(wsId: any) {
    if (wsId === undefined) cache.clear();
    else cache.delete(Number(wsId));
}

// ─────────────────────────────────────────────────────────────────────────────
// CIDR containment
// ─────────────────────────────────────────────────────────────────────────────
export function ipInCidr(ip: any, cidr: any) {
    if (!cidr) return false;
    const [net, bits] = cidr.split('/');
    const maskBits = bits === undefined ? (net.includes(':') ? 128 : 32) : Number(bits);
    try {
        if (ip.includes(':') || net.includes(':')) {
            return v6InCidr(ip, net, maskBits);
        }
        return v4InCidr(ip, net, maskBits);
    } catch {
        return false;
    }
}

function v4ToInt(ip: any) {
    const p = ip.split('.').map(Number);
    if (p.length !== 4 || p.some((n: any) => !Number.isInteger(n) || n < 0 || n > 255)) {
        throw new Error('invalid v4');
    }
    return (((p[0] << 24) >>> 0) + (p[1] << 16) + (p[2] << 8) + p[3]) >>> 0;
}

function v4InCidr(ip: any, net: any, bits: any) {
    const ipi = v4ToInt(ip);
    const neti = v4ToInt(net);
    if (bits === 0) return true;
    const mask = ~((1 << (32 - bits)) - 1) >>> 0;
    return (ipi & mask) === (neti & mask);
}

function v6Expand(ip: any) {
    // Expand :: and zero-fill each group.
    if (ip.includes('::')) {
        const [l, r] = ip.split('::');
        const left = l ? l.split(':') : [];
        const right = r ? r.split(':') : [];
        const missing = 8 - (left.length + right.length);
        ip = [...left, ...new Array(missing).fill('0'), ...right].join(':');
    }
    return ip
        .split(':')
        .map((g: any) => g.padStart(4, '0'))
        .join('');
}

function v6InCidr(ip: any, net: any, bits: any) {
    const ipHex = v6Expand(ip);
    const netHex = v6Expand(net);
    const chars = Math.floor(bits / 4);
    const rem = bits % 4;
    if (ipHex.slice(0, chars) !== netHex.slice(0, chars)) return false;
    if (rem === 0) return true;
    const ipNibble = parseInt(ipHex[chars], 16);
    const netNibble = parseInt(netHex[chars], 16);
    const mask = (0xf << (4 - rem)) & 0xf;
    return (ipNibble & mask) === (netNibble & mask);
}
