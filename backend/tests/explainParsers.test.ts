import test from 'node:test';
import assert from 'node:assert/strict';
import { flattenMysqlPlan, flattenMongoPlan } from '../services/explainParsers.js';

test('MySQL plan flattens nested_loop + tables', () => {
    const plan = {
        query_block: {
            select_id: 1,
            cost_info: { query_cost: '12.50' },
            nested_loop: [
                { table: { table_name: 'orders', access_type: 'range',
                    rows_examined_per_scan: 100, rows_produced_per_join: 100,
                    cost_info: { read_cost: '5.00' },
                    key: 'idx_orders_ts' } },
                { table: { table_name: 'users', access_type: 'eq_ref',
                    rows_examined_per_scan: 1, rows_produced_per_join: 100,
                    cost_info: { read_cost: '2.50' } } },
            ],
        },
    };
    const nodes = flattenMysqlPlan(plan);
    const types = nodes.map(n => n.nodeType);
    assert.ok(types[0].startsWith('Nested Loop'));
    assert.ok(types.some(t => t.includes('range')));
    assert.ok(types.some(t => t.includes('eq_ref')));
    const orders = nodes.find(n => n.relation === 'orders');
    assert.equal(orders.extra.key, 'idx_orders_ts');
});

test('Mongo explain flattens stages + root card', () => {
    const plan = {
        queryPlanner: {
            namespace: 'app.users',
            winningPlan: { stage: 'FETCH', inputStage: { stage: 'IXSCAN', indexName: 'email_1' } },
        },
        executionStats: {
            executionTimeMillis: 12,
            nReturned: 1,
            totalDocsExamined: 1,
            totalKeysExamined: 1,
            executionStages: {
                stage: 'FETCH', nReturned: 1, executionTimeMillisEstimate: 12,
                inputStage: { stage: 'IXSCAN', nReturned: 1, keysExamined: 1, indexName: 'email_1' },
            },
        },
    };
    const nodes = flattenMongoPlan(plan);
    assert.equal(nodes[0].nodeType, 'Query');
    assert.equal(nodes[0].relation, 'app.users');
    assert.ok(nodes.some(n => n.nodeType === 'FETCH'));
    assert.ok(nodes.some(n => n.nodeType === 'IXSCAN' && n.relation === 'email_1'));
});
