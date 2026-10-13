// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)

// Per-user, per-connection LRU response cache middleware.
// Extracted from server.ts.

import { getUserActiveConnectionId } from './activeSelection.js';

// ─────────────────────────────────────────────────────────────────────────────
// CACHE & RATE LIMITER
// ─────────────────────────────────────────────────────────────────────────────
class LRUCache {
    constructor(maxSize = 256) {
        this.maxSize = maxSize;
        this.cache = new Map();
    }
    get(key) {
        const entry = this.cache.get(key);
        if (!entry) return undefined;
        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            return undefined;
        }
        return entry.value;
    }
    set(key, value, ttlMs) {
        if (this.cache.size >= this.maxSize) this.cache.delete(this.cache.keys().next().value);
        this.cache.set(key, { value, expiresAt: Date.now() + ttlMs });
    }
    clear() {
        this.cache.clear();
    }
    stats() {
        return { size: this.cache.size, maxSize: this.maxSize };
    }
}
export const cache = new LRUCache(256);

export function cached(key, ttl) {
    return (req, res, next) => {
        // Scope cache key by userId AND connectionId so users never share cache entries
        const userId = req.user?.id ?? 'anon';
        const connScope = req.query.connectionId || getUserActiveConnectionId(req.user?.id) || 'default';
        const scopedKey = `${key}:u${userId}:${connScope}`;
        const hit = cache.get(scopedKey);
        if (hit) {
            res.setHeader('X-Cache', 'HIT');
            return res.json(hit);
        }
        res.setHeader('X-Cache', 'MISS');

        // Capture the body on first res.json() call, then restore the original
        // method immediately so any outer middleware that wraps res.json after
        // us isn't fighting our wrapper. We never overwrite the response — the
        // handler's JSON still flows straight through to the client.
        const origJson = res.json.bind(res);
        let captured = false;
        res.json = (body) => {
            if (!captured) {
                captured = true;
                res.json = origJson; // restore before sending
                // Only cache successful responses; never cache an error payload.
                // Handlers can opt out by setting res.locals.noCache = true.
                if (res.statusCode >= 200 && res.statusCode < 300 && !res.locals?.noCache) {
                    try {
                        cache.set(scopedKey, body, ttl);
                    } catch {
                        /* cache full / non-fatal */
                    }
                }
            }
            return origJson(body);
        };
        next();
    };
}
