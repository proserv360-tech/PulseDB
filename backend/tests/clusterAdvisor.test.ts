/**
 * tests/clusterAdvisor.test.js — B2 cluster-aware aggregation logic.
 * Pure function; no DB.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aggregateClusterAdvice } from '../services/indexAdvisor.js';

test('B2: empty input -> empty output', () => {
    assert.deepEqual(aggregateClusterAdvice([]), { unused: [], redundant: [], missing: [] });
});

test('B2: single-member passthrough annotates with connectionId', () => {
    const out = aggregateClusterAdvice([{
        connectionId: 'A',
        unused:    [{ schema: 'public', table: 't', name: 'idx_a', sizeBytes: 100 }],
        redundant: [],
        missing:   [{ table: 't', columns: ['x'], calls: 5, meanTimeMs: 12 }],
    }]);
    assert.deepEqual(out.unused[0].unusedOn, ['A']);
    assert.deepEqual(out.missing[0].suggestedBy, ['A']);
});

test('B2: index unused on primary but used on replica is NOT flagged unused', () => {
    const primary = {
        connectionId: 'primary',
        unused:    [{ schema: 'public', table: 't', name: 'idx_shared', sizeBytes: 100 }],
        redundant: [],
        missing:   [],
    };
    const replica = {
        connectionId: 'replica',
        unused:    [],   // index is in use on the replica
        redundant: [],
        missing:   [],
    };
    const out = aggregateClusterAdvice([primary, replica]);
    assert.equal(out.unused.length, 0, 'intersect must remove indexes used on any member');
});

test('B2: index unused on every member IS flagged unused, with all members listed', () => {
    const a = { connectionId: 'a', unused: [{ schema: 'public', table: 't', name: 'idx_x', sizeBytes: 100 }], redundant: [], missing: [] };
    const b = { connectionId: 'b', unused: [{ schema: 'public', table: 't', name: 'idx_x', sizeBytes: 100 }], redundant: [], missing: [] };
    const out = aggregateClusterAdvice([a, b]);
    assert.equal(out.unused.length, 1);
    assert.deepEqual(out.unused[0].unusedOn.sort(), ['a','b']);
});

test('B2: missing-index union de-dupes by (table, columns) and sums calls', () => {
    const a = { connectionId: 'a', unused: [], redundant: [], missing: [{ table: 't', columns: ['x'], calls: 10, meanTimeMs: 20 }] };
    const b = { connectionId: 'b', unused: [], redundant: [], missing: [{ table: 't', columns: ['x'], calls: 5,  meanTimeMs: 100 }] };
    const c = { connectionId: 'c', unused: [], redundant: [], missing: [{ table: 't', columns: ['y'], calls: 3,  meanTimeMs: 7 }] };
    const out = aggregateClusterAdvice([a,b,c]);
    assert.equal(out.missing.length, 2);
    const xRow = out.missing.find(m => m.columns.join() === 'x');
    assert.equal(xRow.calls, 15, 'calls summed');
    assert.equal(xRow.meanTimeMs, 100, 'meanTimeMs takes max');
    assert.deepEqual(xRow.suggestedBy.sort(), ['a','b']);
});
