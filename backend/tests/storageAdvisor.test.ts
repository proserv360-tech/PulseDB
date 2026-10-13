import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeFragmentation, fetchStorageAdvisor } from '../services/storageAdvisorService.js';

const MB = 1024 * 1024;

const rows = [
    {
        schema: 'app',
        name: 'orders',
        dataFreeBytes: 400 * MB,
        dataLengthBytes: 600 * MB,
        indexLengthBytes: 200 * MB,
        rowEstimate: 5_000_000,
    },
    {
        schema: 'app',
        name: 'sessions',
        dataFreeBytes: 60 * MB,
        dataLengthBytes: 200 * MB,
        indexLengthBytes: 40 * MB,
        rowEstimate: 200_000,
    },
    {
        schema: 'app',
        name: 'tiny',
        dataFreeBytes: 2 * MB,
        dataLengthBytes: 5 * MB,
        indexLengthBytes: 1 * MB,
        rowEstimate: 100,
    },
    {
        schema: 'app',
        name: 'logs',
        dataFreeBytes: 15 * MB,
        dataLengthBytes: 900 * MB,
        indexLengthBytes: 100 * MB,
        rowEstimate: 10_000_000,
    },
];

test('analyzeFragmentation drops rows below the reclaim floor', () => {
    const r = analyzeFragmentation(rows);
    assert.equal(r.tables.length, 3);
    assert.ok(!r.tables.some((t) => t.table === 'tiny'));
});

test('analyzeFragmentation ranks by urgency then reclaimable size', () => {
    const r = analyzeFragmentation(rows);
    assert.equal(r.tables[0].table, 'orders');
    assert.equal(r.tables[0].urgency, 'high');
    assert.equal(r.tables[0].fragmentationPct, 33.3);
});

test('analyzeFragmentation summarizes counts and total reclaimable MB', () => {
    const r = analyzeFragmentation(rows);
    assert.deepEqual(
        { high: r.summary.high, medium: r.summary.medium, low: r.summary.low },
        { high: 1, medium: 1, low: 1 },
    );
    assert.equal(r.summary.reclaimableMb, 475);
});

test('analyzeFragmentation default recommender is OPTIMIZE TABLE', () => {
    const r = analyzeFragmentation([
        {
            schema: 's',
            name: 'n',
            dataFreeBytes: 200 * MB,
            dataLengthBytes: 300 * MB,
            indexLengthBytes: 0,
            rowEstimate: 1,
        },
    ]);
    assert.equal(r.tables[0].recommendation, 'OPTIMIZE TABLE `s`.`n`');
});

test('analyzeFragmentation ignores zero-footprint rows without throwing', () => {
    const r = analyzeFragmentation([
        { schema: 'a', name: 'b', dataFreeBytes: 0, dataLengthBytes: 0, indexLengthBytes: 0 },
    ]);
    assert.equal(r.tables.length, 0);
    assert.equal(r.summary.reclaimableMb, 0);
});

test('fetchStorageAdvisor: MySQL is supported and recommends OPTIMIZE TABLE', async () => {
    const adapter = {
        dbType: 'mysql',
        getFragmentation: async () => [
            {
                schema: 'app',
                name: 't',
                dataFreeBytes: 200 * MB,
                dataLengthBytes: 400 * MB,
                indexLengthBytes: 50 * MB,
                rowEstimate: 100_000,
            },
        ],
    };
    const r = await fetchStorageAdvisor(adapter);
    assert.equal(r.supported, true);
    assert.equal(r.engine, 'mysql');
    assert.match(r.tables[0].recommendation, /^OPTIMIZE TABLE/);
});

test('fetchStorageAdvisor: MongoDB is supported and recommends compact', async () => {
    const adapter = {
        dbType: 'mongodb',
        getFragmentation: async () => [
            {
                schema: 'shop',
                name: 'orders',
                dataFreeBytes: 300 * MB,
                dataLengthBytes: 500 * MB,
                indexLengthBytes: 100 * MB,
                rowEstimate: 1_000_000,
            },
        ],
    };
    const r = await fetchStorageAdvisor(adapter);
    assert.equal(r.supported, true);
    assert.equal(r.engine, 'mongodb');
    assert.match(r.tables[0].recommendation, /compact/);
    assert.match(r.tables[0].recommendation, /shop/);
    assert.match(r.tables[0].recommendation, /orders/);
});

test('fetchStorageAdvisor: SQL Server is supported and recommends ALTER INDEX REBUILD', async () => {
    const adapter = {
        dbType: 'mssql',
        getFragmentation: async () => [
            {
                schema: 'dbo',
                name: 'Invoices',
                dataFreeBytes: 250 * MB,
                dataLengthBytes: 500 * MB,
                indexLengthBytes: 0,
                rowEstimate: 800_000,
            },
        ],
    };
    const r = await fetchStorageAdvisor(adapter);
    assert.equal(r.supported, true);
    assert.equal(r.engine, 'mssql');
    assert.match(r.tables[0].recommendation, /ALTER INDEX ALL ON \[dbo\]\.\[Invoices\] REBUILD/);
});

test('fetchStorageAdvisor: Oracle is supported and recommends SHRINK SPACE', async () => {
    const adapter = {
        dbType: 'oracle',
        getFragmentation: async () => [
            {
                schema: 'HR',
                name: 'EMPLOYEES',
                dataFreeBytes: 220 * MB,
                dataLengthBytes: 480 * MB,
                indexLengthBytes: 0,
                rowEstimate: 600_000,
            },
        ],
    };
    const r = await fetchStorageAdvisor(adapter);
    assert.equal(r.supported, true);
    assert.equal(r.engine, 'oracle');
    assert.match(r.tables[0].recommendation, /ALTER TABLE "HR"\."EMPLOYEES" SHRINK SPACE/);
});

test('fetchStorageAdvisor: Redshift is supported and recommends VACUUM', async () => {
    const adapter = {
        dbType: 'redshift',
        getFragmentation: async () => [
            {
                schema: 'public',
                name: 'events',
                dataFreeBytes: 300 * MB,
                dataLengthBytes: 700 * MB,
                indexLengthBytes: 0,
                rowEstimate: 9_000_000,
            },
        ],
    };
    const r = await fetchStorageAdvisor(adapter);
    assert.equal(r.supported, true);
    assert.equal(r.engine, 'redshift');
    assert.match(r.tables[0].recommendation, /VACUUM "public"\."events"/);
});

test('fetchStorageAdvisor: Snowflake returns a managed note (no manual reclaim)', async () => {
    const r = await fetchStorageAdvisor({ dbType: 'snowflake' });
    assert.equal(r.supported, false);
    assert.equal(r.managed, true);
    assert.match(r.note, /Snowflake/);
    assert.match(r.note, /automatically/);
});

test('fetchStorageAdvisor: DynamoDB is flagged managed', async () => {
    const r = await fetchStorageAdvisor({ dbType: 'dynamodb' });
    assert.equal(r.managed, true);
    assert.match(r.note, /DynamoDB/);
});

test('fetchStorageAdvisor: PostgreSQL is unsupported with a helpful note', async () => {
    const r = await fetchStorageAdvisor({ dbType: 'postgres' });
    assert.equal(r.supported, false);
    assert.equal(r.managed, false);
    assert.match(r.note, /VACUUM/);
});

test('fetchStorageAdvisor: engine without getFragmentation is unsupported', async () => {
    const r = await fetchStorageAdvisor({ dbType: 'mysql' });
    assert.equal(r.supported, false);
});
