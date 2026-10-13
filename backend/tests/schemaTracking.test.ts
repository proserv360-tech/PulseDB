/**
 * tests/schemaTracking.test.ts — schema drift detection unit tests.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diffSchemas, hashSchema } from '../services/schemaTrackingService.js';

const base = {
    'public.users': {
        columns: {
            id: { type: 'bigint', nullable: false, default: null },
            email: { type: 'text', nullable: false, default: null },
        },
        indexes: { users_pkey: 'CREATE UNIQUE INDEX users_pkey ON public.users (id)' },
    },
};

test('identical schemas produce no changes and equal hashes', () => {
    const copy = JSON.parse(JSON.stringify(base));
    assert.deepEqual(diffSchemas(base, copy), []);
    assert.equal(hashSchema(base), hashSchema(copy));
});

test('added table detected', () => {
    const after = {
        ...base,
        'public.orders': { columns: { id: { type: 'bigint', nullable: false, default: null } }, indexes: {} },
    };
    const ch = diffSchemas(base, after);
    assert.equal(ch.length, 1);
    assert.deepEqual([ch[0].change_type, ch[0].object_type, ch[0].object_name], ['added', 'table', 'public.orders']);
});

test('column type change detected as modified', () => {
    const after = JSON.parse(JSON.stringify(base));
    after['public.users'].columns.email.type = 'varchar';
    const ch = diffSchemas(base, after);
    assert.equal(ch.length, 1);
    assert.equal(ch[0].change_type, 'modified');
    assert.equal(ch[0].object_name, 'public.users.email');
    assert.equal(ch[0].detail.after.type, 'varchar');
});

test('dropped index detected', () => {
    const after = JSON.parse(JSON.stringify(base));
    delete after['public.users'].indexes.users_pkey;
    const ch = diffSchemas(base, after);
    assert.equal(ch.length, 1);
    assert.deepEqual([ch[0].change_type, ch[0].object_type], ['removed', 'index']);
});

test('removed column detected', () => {
    const after = JSON.parse(JSON.stringify(base));
    delete after['public.users'].columns.email;
    const ch = diffSchemas(base, after);
    assert.equal(ch.length, 1);
    assert.deepEqual(
        [ch[0].change_type, ch[0].object_type, ch[0].object_name],
        ['removed', 'column', 'public.users.email'],
    );
});
