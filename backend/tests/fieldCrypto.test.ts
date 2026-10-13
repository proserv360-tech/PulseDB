/**
 * tests/fieldCrypto.test.js — B10 encryptField/decryptField round-trip and
 * AAD tamper-detection.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encryptField, decryptField, isEncryptedField } from '../services/encryptionService.js';

process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'test-encryption-key-must-be-at-least-32-chars-long-12345';

test('B10: round-trip preserves plaintext', () => {
    const ctx = { table: 'workbench_saved_queries', workspaceId: 7, rowId: 42 };
    const blob = encryptField('SELECT 1', ctx);
    assert.ok(isEncryptedField(blob));
    assert.notEqual(blob, 'SELECT 1');
    assert.equal(decryptField(blob, ctx), 'SELECT 1');
});

test('B10: ciphertext differs across calls (random IV)', () => {
    const ctx = { table: 't', workspaceId: 1, rowId: 1 };
    const a = encryptField('hello', ctx);
    const b = encryptField('hello', ctx);
    assert.notEqual(a, b);
});

test('B10: AAD binding — decrypt with wrong workspaceId throws', () => {
    const blob = encryptField('SELECT 1', { table: 'workbench_saved_queries', workspaceId: 7, rowId: 42 });
    assert.throws(() => decryptField(blob, { table: 'workbench_saved_queries', workspaceId: 8, rowId: 42 }));
});

test('B10: AAD binding — decrypt with wrong rowId throws (no cross-row replay)', () => {
    const blob = encryptField('SELECT 1', { table: 'workbench_saved_queries', workspaceId: 7, rowId: 42 });
    assert.throws(() => decryptField(blob, { table: 'workbench_saved_queries', workspaceId: 7, rowId: 43 }));
});

test('B10: AAD binding — decrypt with wrong table name throws (no cross-table replay)', () => {
    const blob = encryptField('SELECT 1', { table: 'workbench_saved_queries', workspaceId: 7, rowId: 42 });
    assert.throws(() => decryptField(blob, { table: 'copilot_turns', workspaceId: 7, rowId: 42 }));
});

test('B10: rejects unsupported wire format', () => {
    assert.throws(() => decryptField('plaintext', { table: 't', workspaceId: 1, rowId: 1 }));
    assert.throws(() => decryptField('v2:abc', { table: 't', workspaceId: 1, rowId: 1 }));
});

test('B10: empty string round-trips', () => {
    const ctx = { table: 't', workspaceId: 1, rowId: 1 };
    const blob = encryptField('', ctx);
    assert.equal(decryptField(blob, ctx), '');
});

test('B10: long UTF-8 input round-trips', () => {
    const ctx = { table: 't', workspaceId: 1, rowId: 1 };
    const text = '日本語 αβγ ' + 'x'.repeat(10000);
    const blob = encryptField(text, ctx);
    assert.equal(decryptField(blob, ctx), text);
});
