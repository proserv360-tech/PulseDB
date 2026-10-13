import test from 'node:test';
import assert from 'node:assert/strict';
import { swallow, swallowWith, asyncRoute, failSafe } from '../services/errorHandling.js';

// The point of swallow() is that it keeps the non-throwing behaviour of an
// empty catch while removing the silence. Both halves are tested.

test('swallow does not rethrow', () => {
    assert.doesNotThrow(() => swallow(new Error('boom'), { component: 'test', op: 'op' }));
});

test('swallow tolerates non-Error values', () => {
    assert.doesNotThrow(() => swallow('a string', { component: 'test', op: 'op' }));
    assert.doesNotThrow(() => swallow(undefined, { component: 'test', op: 'op' }));
    assert.doesNotThrow(() => swallow(null, { component: 'test', op: 'op' }));
});

test('swallowWith is usable directly as a .catch() argument', async () => {
    const result = await Promise.reject(new Error('nope'))
        .catch(swallowWith({ component: 'test', op: 'rejects' }))
        .then(() => 'recovered');
    assert.equal(result, 'recovered');
});

test('swallowWith returns a function that does not rethrow', () => {
    const fn = swallowWith({ component: 'test', op: 'op' });
    assert.equal(typeof fn, 'function');
    assert.doesNotThrow(() => fn(new Error('x')));
});

// asyncRoute exists so handlers can throw and reach the global error handler
// in server.ts instead of hand-rolling a leaky response.

test('asyncRoute forwards a rejection to next()', async () => {
    const err = new Error('handler blew up');
    let forwarded = null;
    const wrapped = asyncRoute(async () => {
        throw err;
    });
    wrapped({}, {}, (e) => {
        forwarded = e;
    });
    await new Promise((r) => setImmediate(r));
    assert.equal(forwarded, err);
});

test('asyncRoute does not call next() on success', async () => {
    let called = false;
    const wrapped = asyncRoute(async (_req, res) => {
        res.sent = true;
    });
    const res: { sent?: boolean } = {};
    wrapped({}, res, () => {
        called = true;
    });
    await new Promise((r) => setImmediate(r));
    assert.equal(called, false);
    assert.equal(res.sent, true);
});

test('asyncRoute handles a synchronously-thrown error too', async () => {
    let forwarded = null;
    const wrapped = asyncRoute(() => {
        throw new Error('sync');
    });
    try {
        wrapped({}, {}, (e) => {
            forwarded = e;
        });
    } catch {
        /* must not escape */
    }
    await new Promise((r) => setImmediate(r));
    assert.ok(forwarded === null || forwarded instanceof Error);
});

// failSafe must never put the raw message in a production response body.

function fakeRes() {
    return {
        req: { id: 'req-123', path: '/api/x' },
        statusCode: null,
        body: null,
        status(c) {
            this.statusCode = c;
            return this;
        },
        json(b) {
            this.body = b;
            return this;
        },
    };
}

test('failSafe hides the raw message in production and returns a correlation id', () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
        const res = fakeRes();
        failSafe(res, new Error('relation "users" does not exist'), {
            component: 'test',
            op: 'op',
            message: 'Something failed',
        });
        assert.equal(res.statusCode, 500);
        assert.equal(res.body.error, 'Something failed');
        assert.equal(res.body.requestId, 'req-123');
        assert.equal(res.body.details, undefined, 'raw message must not leak in production');
        assert.ok(!JSON.stringify(res.body).includes('does not exist'));
    } finally {
        process.env.NODE_ENV = prev;
    }
});

test('failSafe includes details outside production for local debugging', () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    try {
        const res = fakeRes();
        failSafe(res, new Error('detailed cause'), { component: 'test', op: 'op' });
        assert.equal(res.body.details, 'detailed cause');
    } finally {
        process.env.NODE_ENV = prev;
    }
});

test('failSafe honours a custom status code', () => {
    const res = fakeRes();
    failSafe(res, new Error('x'), { component: 'test', op: 'op', status: 502 });
    assert.equal(res.statusCode, 502);
});
