import { test } from 'node:test';
import assert from 'node:assert/strict';
import { streamSql, streamExplain, isSafeToRun } from '../services/copilotService.js';
function fakePool() {
    return {
        async query(text) {
            if (/information_schema\.tables/i.test(text)) return { rows: [{ table_name: 'orders' }] };
            if (/information_schema\.columns/i.test(text))
                return { rows: [{ table_name: 'orders', column_name: 'id', data_type: 'integer', is_nullable: 'NO' }] };
            return { rows: [] };
        },
    };
}
async function collect(gen) {
    const e = [];
    for await (const x of gen) e.push(x);
    return e;
}
test('streamSql yields deltas then done with guard', async () => {
    const events = await collect(streamSql(fakePool(), { prompt: 'top 5 orders by total' }));
    const done = events.at(-1);
    assert.ok(events.filter((e) => e.delta !== undefined).length >= 1);
    assert.equal(done.done, true);
    assert.ok('sql' in done);
    assert.deepEqual(done.guard, isSafeToRun(done.sql));
});
test('streamExplain yields deltas then done with review', async () => {
    const events = await collect(streamExplain(null, { plan: { Plan: {} }, sql: 'SELECT 1' }));
    const done = events.at(-1);
    const deltas = events.filter((e) => e.delta !== undefined);
    assert.ok(deltas.length >= 1);
    assert.equal(done.done, true);
    assert.equal(
        done.review,
        deltas
            .map((d) => d.delta)
            .join('')
            .trim(),
    );
});
test('streamSql done.sql equals fence-stripped accumulation', async () => {
    const events = await collect(streamSql(fakePool(), { prompt: 'count rows' }));
    const acc = events
        .filter((e) => e.delta !== undefined)
        .map((d) => d.delta)
        .join('');
    const expected = acc
        .replace(/```sql\s*/gi, '')
        .replace(/```/g, '')
        .trim();
    assert.equal(events.at(-1).sql, expected);
});
