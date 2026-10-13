/**
 * tests/validate.test.js — B5 validate() middleware.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';

function mk(req = {}, body, query, params) {
    const headers = {};
    return {
        req: { body, query, params, ...req },
        res: {
            statusCode: 200,
            body: undefined,
            headers,
            setHeader(k, v) { headers[k] = String(v); },
            status(code) { this.statusCode = code; return this; },
            json(b) { this.body = b; return this; },
        },
    };
}

async function run(mw, ctx) {
    let called = false;
    await new Promise((resolve) => {
        mw(ctx.req, ctx.res, () => { called = true; resolve(); });
        // If mw returns synchronously without next(), resolve next tick
        setImmediate(() => resolve());
    });
    return called;
}

test('B5 validate: passes through when schema matches; populates validatedBody', async () => {
    const Schema = z.object({ name: z.string(), age: z.coerce.number().int().min(0) });
    const ctx = mk({}, { name: 'Ada', age: '36' });
    const called = await run(validate({ body: Schema }), ctx);
    assert.equal(called, true);
    assert.equal(ctx.res.statusCode, 200);
    assert.deepEqual(ctx.req.validatedBody, { name: 'Ada', age: 36 });
});

test('B5 validate: rejects bad body with 400 + flattened issues', async () => {
    const Schema = z.object({ name: z.string(), age: z.number().int().min(0) });
    const ctx = mk({}, { name: 42, age: -1 });
    const called = await run(validate({ body: Schema }), ctx);
    assert.equal(called, false);
    assert.equal(ctx.res.statusCode, 400);
    assert.equal(ctx.res.body.error, 'Validation failed');
    assert.equal(ctx.res.body.source, 'body');
    assert.ok(Array.isArray(ctx.res.body.issues));
    assert.ok(ctx.res.body.issues.length >= 1);
    assert.ok(ctx.res.body.issues[0].path);
});

test('B5 validate: query coercion (string -> number)', async () => {
    const Schema = z.object({ limit: z.coerce.number().int().min(1) });
    const ctx = mk({}, undefined, { limit: '25' });
    const called = await run(validate({ query: Schema }), ctx);
    assert.equal(called, true);
    assert.deepEqual(ctx.req.validatedQuery, { limit: 25 });
});

test('B5 validate: skipped sections do not block valid requests', async () => {
    const ctx = mk({}, { whatever: true });
    const called = await run(validate({}), ctx);   // no schema
    assert.equal(called, true);
});
