import test from 'node:test';
import assert from 'node:assert/strict';
import { isSafeToRun, redact } from '../services/copilotService.js';

test('isSafeToRun accepts SELECT', () => {
    assert.equal(isSafeToRun('SELECT 1').safe, true);
    assert.equal(isSafeToRun('select * from users limit 1').safe, true);
    assert.equal(isSafeToRun('WITH t AS (SELECT 1) SELECT * FROM t').safe, true);
});

test('isSafeToRun rejects mutations', () => {
    assert.equal(isSafeToRun('DELETE FROM users').safe, false);
    assert.equal(isSafeToRun('UPDATE users SET x=1').safe, false);
    assert.equal(isSafeToRun('DROP TABLE users').safe, false);
});

test('isSafeToRun rejects multi-statement', () => {
    assert.equal(isSafeToRun('SELECT 1; SELECT 2').safe, false);
});

test('isSafeToRun tolerates trailing semicolon', () => {
    assert.equal(isSafeToRun('SELECT 1;').safe, true);
});

test('redact strips connection strings and api keys', () => {
    const text = 'connect to postgres://alice:p@ss@db.example.com/app using sk-abcdefghijklmnopqrstuvwxyz';
    const out = redact(text);
    assert.ok(!/alice:p@ss/.test(out));
    assert.ok(/REDACTED/.test(out));
});

test('redact handles password= forms', () => {
    const out = redact('password="hunter2" and token: abc123xyz');
    assert.ok(/password=REDACTED/.test(out));
});
