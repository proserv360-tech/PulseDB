import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PostgresAdapter } from '../services/dbAdapters/PostgresAdapter.js';
import { MySQLAdapter } from '../services/dbAdapters/MySQLAdapter.js';
import { BaseAdapter } from '../services/dbAdapters/BaseAdapter.js';
import { RedshiftAdapter } from '../services/dbAdapters/RedshiftAdapter.js';
import { SnowflakeAdapter } from '../services/dbAdapters/SnowflakeAdapter.js';
import { BigQueryAdapter } from '../services/dbAdapters/BigQueryAdapter.js';
import { CassandraAdapter } from '../services/dbAdapters/CassandraAdapter.js';
import { DynamoDBAdapter } from '../services/dbAdapters/DynamoDBAdapter.js';
import { OracleAdapter } from '../services/dbAdapters/OracleAdapter.js';
import { MSSQLAdapter } from '../services/dbAdapters/MSSQLAdapter.js';

const REQUIRED_KEYS = [
    'replication',
    'schemas',
    'partitioning',
    'sharding',
    'vacuum',
    'wal',
    'queryPlan',
    'explain',
    'indexes',
    'locks',
    'waitEvents',
    'queryHistory',
    'slowQueryLog',
    'storedProcedures',
    'triggers',
    'backup',
    'restore',
];

function assertFullShape(name, caps) {
    for (const k of REQUIRED_KEYS) {
        assert.ok(k in caps, name + ' missing key ' + k);
        assert.equal(typeof caps[k], 'boolean', name + ' key ' + k + ' must be boolean');
    }
}

test('B6: BaseAdapter defaults expose every required key', () => {
    assertFullShape('BaseAdapter', new BaseAdapter({}).getCapabilities());
});

test('B6: PostgresAdapter advertises Postgres features', () => {
    const caps = new PostgresAdapter({}).getCapabilities();
    assertFullShape('PG', caps);
    for (const k of ['vacuum', 'wal', 'queryPlan', 'explain', 'indexes', 'waitEvents', 'queryHistory']) {
        assert.equal(caps[k], true, 'PG should advertise ' + k);
    }
    assert.equal(caps.sharding, false);
});

test('B6: MySQLAdapter advertises MySQL features', () => {
    const caps = new MySQLAdapter({}).getCapabilities();
    assertFullShape('MySQL', caps);
    assert.equal(caps.vacuum, false);
    assert.equal(caps.wal, false);
    assert.equal(caps.replication, true);
    assert.equal(caps.explain, true);
});

const WAREHOUSE_AND_NOSQL = [
    ['RedshiftAdapter', () => new RedshiftAdapter({})],
    ['SnowflakeAdapter', () => new SnowflakeAdapter({})],
    ['BigQueryAdapter', () => new BigQueryAdapter({})],
    ['CassandraAdapter', () => new CassandraAdapter({})],
    ['DynamoDBAdapter', () => new DynamoDBAdapter({})],
];

for (const [name, make] of WAREHOUSE_AND_NOSQL) {
    test('B6: ' + name + ' returns the full capability shape', () => {
        assertFullShape(name, make().getCapabilities());
    });
    test('B6: ' + name + ' overrides the all-false default', () => {
        const caps = make().getCapabilities();
        assert.ok(
            REQUIRED_KEYS.some((k) => caps[k] === true),
            name + ' inherits all-false matrix',
        );
    });
}

test('B6: warehouse engines have no PG VACUUM/WAL', () => {
    for (const make of [() => new RedshiftAdapter({}), () => new SnowflakeAdapter({}), () => new BigQueryAdapter({})]) {
        const caps = make().getCapabilities();
        assert.equal(caps.vacuum, false);
        assert.equal(caps.wal, false);
    }
});

test('B6: Cassandra and DynamoDB advertise partitioning + sharding', () => {
    for (const make of [() => new CassandraAdapter({}), () => new DynamoDBAdapter({})]) {
        const caps = make().getCapabilities();
        assert.equal(caps.partitioning, true);
        assert.equal(caps.sharding, true);
    }
});

test('B6: DynamoDB is schemaless and has no SQL EXPLAIN', () => {
    const caps = new DynamoDBAdapter({}).getCapabilities();
    assert.equal(caps.schemas, false);
    assert.equal(caps.explain, false);
    assert.equal(caps.indexes, true);
});

const ENTERPRISE_TRUE = [
    'replication',
    'indexes',
    'locks',
    'explain',
    'partitioning',
    'storedProcedures',
    'triggers',
    'waitEvents',
    'backup',
    'restore',
];

test('B6: OracleAdapter advertises enterprise capabilities + wait events', () => {
    const o = new OracleAdapter({});
    const caps = o.getCapabilities();
    assertFullShape('Oracle', caps);
    assert.equal(caps.vacuum, false);
    assert.equal(caps.wal, false);
    for (const k of ENTERPRISE_TRUE) assert.equal(caps[k], true, 'Oracle should advertise ' + k);
    assert.equal(typeof o.getWaitEvents, 'function');
});

test('B6: MSSQLAdapter advertises enterprise capabilities + wait events', () => {
    const s = new MSSQLAdapter({});
    const caps = s.getCapabilities();
    assertFullShape('MSSQL', caps);
    assert.equal(caps.vacuum, false);
    assert.equal(caps.wal, false);
    for (const k of ENTERPRISE_TRUE) assert.equal(caps[k], true, 'MSSQL should advertise ' + k);
    assert.equal(typeof s.getWaitEvents, 'function');
});
