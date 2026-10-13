import test from 'node:test';
import assert from 'node:assert/strict';
import {
    scopeAllowsMethod,
    isValidApiKeyScope,
    isSessionActive,
    createSession,
    invalidateSessionCache,
} from '../services/sessionService.js';

// ─── API key scope enforcement ───────────────────────────────────────────────
// The `scope` column was stored and displayed for a long time but never
// checked, so a key created as read:all could perform every write its owner
// could.

test('read:all permits safe methods only', () => {
    assert.equal(scopeAllowsMethod('read:all', 'GET'), true);
    assert.equal(scopeAllowsMethod('read:all', 'HEAD'), true);
    assert.equal(scopeAllowsMethod('read:all', 'OPTIONS'), true);
    assert.equal(scopeAllowsMethod('read:all', 'POST'), false);
    assert.equal(scopeAllowsMethod('read:all', 'PUT'), false);
    assert.equal(scopeAllowsMethod('read:all', 'PATCH'), false);
    assert.equal(scopeAllowsMethod('read:all', 'DELETE'), false);
});

test('write:all and admin:all permit mutating methods', () => {
    for (const scope of ['write:all', 'admin:all']) {
        assert.equal(scopeAllowsMethod(scope, 'GET'), true);
        assert.equal(scopeAllowsMethod(scope, 'POST'), true);
        assert.equal(scopeAllowsMethod(scope, 'DELETE'), true);
    }
});

test('method matching is case-insensitive', () => {
    assert.equal(scopeAllowsMethod('read:all', 'get'), true);
    assert.equal(scopeAllowsMethod('read:all', 'post'), false);
});

test('unknown/legacy scopes degrade to read-only, not full access', () => {
    // Keys predating scope validation were created from arbitrary body input.
    for (const scope of ['', 'nonsense', 'read', 'writeall', undefined, null]) {
        assert.equal(scopeAllowsMethod(scope, 'GET'), true, `GET should pass for ${scope}`);
        assert.equal(scopeAllowsMethod(scope, 'POST'), false, `POST should fail for ${scope}`);
    }
});

test('isValidApiKeyScope accepts only the canonical set', () => {
    assert.equal(isValidApiKeyScope('read:all'), true);
    assert.equal(isValidApiKeyScope('write:all'), true);
    assert.equal(isValidApiKeyScope('admin:all'), true);
    assert.equal(isValidApiKeyScope('admin'), false);
    assert.equal(isValidApiKeyScope(''), false);
    assert.equal(isValidApiKeyScope(undefined), false);
    assert.equal(isValidApiKeyScope(42), false);
});

// ─── Session revocation must fail closed ─────────────────────────────────────
// isSessionActive() used to swallow DB errors and return `true`, which made the
// fail-closed handling in middleware/authenticate.ts unreachable.

test('isSessionActive propagates DB errors instead of returning true', async () => {
    invalidateSessionCache();
    const pool = {
        query: async () => {
            throw new Error('connection terminated');
        },
    };
    await assert.rejects(() => isSessionActive(pool, 'sid-db-down'), /connection terminated/);
});

test('isSessionActive does not fall back to a stale cached positive on error', async () => {
    invalidateSessionCache();
    let mode = 'ok';
    const pool = {
        query: async () => {
            if (mode === 'fail') throw new Error('pooler saturated');
            return { rows: [{ '?column?': 1 }] };
        },
    };

    // Prime the cache with a positive result.
    assert.equal(await isSessionActive(pool, 'sid-1'), true);

    // A revoke elsewhere busts the cache; the next lookup hits a broken DB.
    invalidateSessionCache('sid-1');
    mode = 'fail';
    await assert.rejects(() => isSessionActive(pool, 'sid-1'), /pooler saturated/);
});

test('isSessionActive returns false for an unknown session', async () => {
    invalidateSessionCache();
    const pool = { query: async () => ({ rows: [] }) };
    assert.equal(await isSessionActive(pool, 'sid-missing'), false);
});

// ─── Session expiry ──────────────────────────────────────────────────────────
// The committed migration defaulted expires_at to now(), so every session was
// born already expired and `expires_at > NOW()` failed on the next request.

test('createSession sets expires_at explicitly rather than relying on the default', async () => {
    let captured = { text: '', values: [] as any[] };
    const pool = {
        query: async (text: string, values: any[]) => {
            captured = { text, values };
            return { rows: [{ id: 'new-sid' }] };
        },
    };

    const id = await createSession(pool, { userId: 7, ip: '10.0.0.1', userAgent: 'ua' });

    assert.equal(id, 'new-sid');
    assert.match(captured.text, /expires_at/, 'INSERT must name expires_at');
    assert.match(captured.text, /NOW\(\) \+ \(\$7::text \|\| ' hours'\)::interval/);
    // 24h default TTL, passed as a bound parameter.
    assert.equal(captured.values[6], '24');
});
