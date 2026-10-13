/**
 * tests/bloatWatcher.test.js
 * ──────────────────────────
 * Unit tests for bloat watcher helpers: computeHeuristicBloat, formatBytes,
 * recommendVacuum, generateVacuumDdl.
 *
 * Run: node --test tests/bloatWatcher.test.js
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
    computeHeuristicBloat,
    formatBytes,
    recommendVacuum,
    generateVacuumDdl,
} from '../services/bloatWatcher.js';

// ─────────────────────────────────────────────────────────────────────────────
// Test: computeHeuristicBloat
// ─────────────────────────────────────────────────────────────────────────────

test('computeHeuristicBloat: zero rows → no bloat', () => {
    const result = computeHeuristicBloat({
        relpages: 100,
        reltuples: 0,
        avgRowWidth: 50,
    });
    assert.equal(result.liveBytes, 0);
    assert.equal(result.bloatBytes, 0);
    assert.equal(result.bloatRatio, 0);
});

test('computeHeuristicBloat: zero pages → no bloat', () => {
    const result = computeHeuristicBloat({
        relpages: 0,
        reltuples: 1000,
        avgRowWidth: 50,
    });
    assert.equal(result.liveBytes, 0);
    assert.equal(result.bloatBytes, 0);
    assert.equal(result.bloatRatio, 0);
});

test('computeHeuristicBloat: well-packed table → low bloat', () => {
    // 1000 rows, 50 bytes each = 50KB live data
    // 10 pages = 81.92 KB total space
    // bloat ≈ 31.92 KB
    const result = computeHeuristicBloat({
        relpages: 10,
        reltuples: 1000,
        avgRowWidth: 50,
        pageSize: 8192,
        headerSize: 24,
    });
    assert.ok(result.liveBytes > 0, 'liveBytes should be > 0');
    assert.ok(result.bloatBytes >= 0, 'bloatBytes should be >= 0');
    assert.ok(result.bloatRatio > 0 && result.bloatRatio < 0.5, 'ratio should be between 0 and 0.5');
});

test('computeHeuristicBloat: sparse table → high bloat', () => {
    // 100 rows, 100 bytes each = 10KB live data
    // 100 pages = 819.2 KB total space
    // bloat ≈ 809.2 KB
    const result = computeHeuristicBloat({
        relpages: 100,
        reltuples: 100,
        avgRowWidth: 100,
    });
    assert.ok(result.bloatRatio > 0.9, 'sparse table should have >90% bloat');
});

test('computeHeuristicBloat: custom pageSize and fillfactor', () => {
    const result = computeHeuristicBloat({
        relpages: 10,
        reltuples: 500,
        avgRowWidth: 50,
        pageSize: 16384,  // PostgreSQL can be configured for larger pages
        headerSize: 32,
    });
    assert.ok(result.liveBytes > 0);
    assert.ok(result.bloatBytes >= 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// Test: formatBytes
// ─────────────────────────────────────────────────────────────────────────────

test('formatBytes: 0 bytes', () => {
    assert.equal(formatBytes(0), '0 B');
});

test('formatBytes: bytes', () => {
    assert.equal(formatBytes(512), '512.00 B');
    assert.equal(formatBytes(1023), '1023.00 B');
});

test('formatBytes: kibibytes', () => {
    const result = formatBytes(1024);
    assert.ok(result.includes('KiB'), `Expected KiB in "${result}"`);
    assert.ok(result.includes('1.00'), `Expected "1.00" in "${result}"`);
});

test('formatBytes: mebibytes', () => {
    const result = formatBytes(1024 * 1024);
    assert.ok(result.includes('MiB'), `Expected MiB in "${result}"`);
    assert.ok(result.includes('1.00'), `Expected "1.00" in "${result}"`);
});

test('formatBytes: gibibytes', () => {
    const result = formatBytes(1024 * 1024 * 1024);
    assert.ok(result.includes('GiB'), `Expected GiB in "${result}"`);
    assert.ok(result.includes('1.00'), `Expected "1.00" in "${result}"`);
});

test('formatBytes: tebibytes', () => {
    const result = formatBytes(1024 * 1024 * 1024 * 1024);
    assert.ok(result.includes('TiB'), `Expected TiB in "${result}"`);
    assert.ok(result.includes('1.00'), `Expected "1.00" in "${result}"`);
});

test('formatBytes: fractional sizes', () => {
    const result = formatBytes(1536);  // 1.5 KiB
    assert.ok(result.includes('KiB'));
    assert.ok(result.includes('1.5'));
});

test('formatBytes: negative bytes', () => {
    const result = formatBytes(-1024);
    assert.ok(result.includes('KiB'));
});

// ─────────────────────────────────────────────────────────────────────────────
// Test: recommendVacuum
// ─────────────────────────────────────────────────────────────────────────────

test('recommendVacuum: no action needed', () => {
    const rec = recommendVacuum({
        nDeadTup: 0,
        nLiveTup: 10000,
        bloatRatio: 0.05,
        sizeBytes: 1024 * 1024,
    });
    assert.equal(rec.action, 'ANALYZE');
    assert.ok(rec.reason.includes('Refresh'));
});

test('recommendVacuum: low dead tuples + low bloat → ANALYZE', () => {
    const rec = recommendVacuum({
        nDeadTup: 0,
        nLiveTup: 10000,
        bloatRatio: 0.05,
        sizeBytes: 1024 * 1024,
    });
    assert.equal(rec.action, 'ANALYZE');
});

test('recommendVacuum: moderate dead tuples → VACUUM ANALYZE', () => {
    const rec = recommendVacuum({
        nDeadTup: 1500,
        nLiveTup: 5000,
        bloatRatio: 0.1,
        sizeBytes: 1024 * 1024,
    });
    assert.equal(rec.action, 'VACUUM ANALYZE');
    assert.ok(rec.reason.includes('1500'));
});

test('recommendVacuum: many dead tuples (high ratio) → VACUUM ANALYZE', () => {
    const rec = recommendVacuum({
        nDeadTup: 2000,
        nLiveTup: 8000,
        bloatRatio: 0.15,
        sizeBytes: 1024 * 1024,
    });
    assert.equal(rec.action, 'VACUUM ANALYZE');
    assert.ok(rec.reason.includes('dead'));
});

test('recommendVacuum: moderate bloat → VACUUM ANALYZE', () => {
    const rec = recommendVacuum({
        nDeadTup: 0,
        nLiveTup: 10000,
        bloatRatio: 0.25,
        sizeBytes: 1024 * 1024,
    });
    assert.equal(rec.action, 'VACUUM ANALYZE');
    assert.ok(rec.reason.includes('bloat'));
});

test('recommendVacuum: severe bloat + large table → VACUUM FULL ANALYZE', () => {
    const rec = recommendVacuum({
        nDeadTup: 0,
        nLiveTup: 1000000,
        bloatRatio: 0.45,
        sizeBytes: 2 * 1024 * 1024 * 1024,  // 2 GB
    });
    assert.equal(rec.action, 'VACUUM (FULL, ANALYZE)');
    assert.ok(rec.reason.includes('Severe'));
});

test('recommendVacuum: severe bloat but small table → VACUUM ANALYZE, not FULL', () => {
    const rec = recommendVacuum({
        nDeadTup: 0,
        nLiveTup: 1000,
        bloatRatio: 0.5,
        sizeBytes: 100 * 1024,  // 100 KB, below 1 GB threshold
    });
    assert.notEqual(rec.action, 'VACUUM (FULL, ANALYZE)');
    assert.ok(['VACUUM ANALYZE', 'ANALYZE'].includes(rec.action));
});

test('recommendVacuum: empty row → ANALYZE', () => {
    const rec = recommendVacuum({});
    assert.equal(rec.action, 'ANALYZE');
});

// ─────────────────────────────────────────────────────────────────────────────
// Test: generateVacuumDdl
// ─────────────────────────────────────────────────────────────────────────────

test('generateVacuumDdl: basic VACUUM', () => {
    const ddl = generateVacuumDdl({
        schema: 'public',
        table: 'users',
        full: false,
        analyze: false,
    });
    assert.ok(ddl.includes('VACUUM'));
    assert.ok(ddl.includes('"public"'));
    assert.ok(ddl.includes('"users"'));
    assert.ok(!ddl.includes('FULL'));
    assert.ok(!ddl.includes('ANALYZE'));
});

test('generateVacuumDdl: VACUUM with ANALYZE', () => {
    const ddl = generateVacuumDdl({
        schema: 'public',
        table: 'orders',
        full: false,
        analyze: true,
    });
    assert.ok(ddl.includes('VACUUM'));
    assert.ok(ddl.includes('ANALYZE'));
    assert.ok(!ddl.includes('FULL'));
});

test('generateVacuumDdl: VACUUM FULL with ANALYZE', () => {
    const ddl = generateVacuumDdl({
        schema: 'public',
        table: 'large_table',
        full: true,
        analyze: true,
    });
    assert.ok(ddl.includes('VACUUM'));
    assert.ok(ddl.includes('FULL'));
    assert.ok(ddl.includes('ANALYZE'));
});

test('generateVacuumDdl: identifier quoting with special chars', () => {
    const ddl = generateVacuumDdl({
        schema: 'my-schema',
        table: 'user"data',
        full: false,
        analyze: true,
    });
    // Should escape double quotes
    assert.ok(ddl.includes('my-schema'));
    assert.ok(ddl.includes('user""data'));
    assert.ok(ddl.includes('ANALYZE'));
});

test('generateVacuumDdl: custom schema', () => {
    const ddl = generateVacuumDdl({
        schema: 'app_v2',
        table: 'products',
        full: false,
        analyze: false,
    });
    assert.ok(ddl.includes('"app_v2"'));
    assert.ok(ddl.includes('"products"'));
});

test('generateVacuumDdl: missing table throws', () => {
    assert.throws(
        () => generateVacuumDdl({ schema: 'public', table: '' }),
        /table name required/
    );
});

test('generateVacuumDdl: VERBOSE flag included', () => {
    const ddl = generateVacuumDdl({
        schema: 'public',
        table: 'test',
        full: false,
        analyze: false,
    });
    assert.ok(ddl.includes('VERBOSE'));
});

// ─────────────────────────────────────────────────────────────────────────────
// Summary: All 24 assertions across 19 tests
// ─────────────────────────────────────────────────────────────────────────────
