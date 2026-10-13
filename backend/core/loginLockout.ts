// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)

// In-memory brute-force lockout for password login.
// Extracted from server.ts.

import { trimMapToCap } from '../middleware/httpSecurity.js';

// ─────────────────────────────────────────────────────────────────────────────
// LOGIN LOCKOUT
// ─────────────────────────────────────────────────────────────────────────────
const loginAttempts = new Map();
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

// Cleanup stale login attempt records every 5 minutes (skip on Vercel — stateless)
if (process.env.VERCEL !== '1') {
    setInterval(() => {
        const now = Date.now();
        for (const [key, record] of loginAttempts) {
            if (now - record.windowStart > 30 * 60_000) loginAttempts.delete(key);
        }
    }, 300_000);
}

export function recordLoginAttempt(username, success) {
    const now = Date.now();
    const record = loginAttempts.get(username) || { count: 0, windowStart: now };
    if (now - record.windowStart > LOGIN_WINDOW_MS) {
        record.count = 0;
        record.windowStart = now;
    }
    if (success) {
        loginAttempts.delete(username);
        return;
    }
    record.count++;
    trimMapToCap(loginAttempts, 20_000);
    loginAttempts.set(username, record);
}

export function isLoginLocked(username) {
    const record = loginAttempts.get(username);
    if (!record) return false;
    if (Date.now() - record.windowStart > LOGIN_WINDOW_MS) {
        loginAttempts.delete(username);
        return false;
    }
    return record.count >= LOGIN_MAX_ATTEMPTS;
}
