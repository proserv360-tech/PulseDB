/**
 * tests/redisAdapter.test.js
 * ───────────────────────────
 * Unit tests for the Redis adapter's pure parsing helpers.
 *
 * Network / CLIENT-LIST / SLOWLOG paths require a live Redis and are
 * exercised by integration tests, not this suite.
 *
 * Run: node --test tests/redisAdapter.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
    parseRedisInfo,
    parseKeyspaceValue,
} from '../services/dbAdapters/RedisAdapter.js';

describe('parseRedisInfo', () => {
    it('groups fields by # section and normalises section names to lowercase', () => {
        const raw = [
            '# Server',
            'redis_version:7.2.3',
            'os:Linux 6.5.0',
            '',
            '# Clients',
            'connected_clients:12',
            'blocked_clients:0',
            '',
            '# Memory',
            'used_memory:1048576',
            'maxmemory:10485760',
        ].join('\r\n');

        const info = parseRedisInfo(raw);
        assert.equal(info.server.redis_version, '7.2.3');
        assert.equal(info.server.os, 'Linux 6.5.0');
        assert.equal(info.clients.connected_clients, '12');
        assert.equal(info.memory.used_memory, '1048576');
    });

    it('handles empty input safely', () => {
        assert.deepEqual(parseRedisInfo(''), {});
        assert.deepEqual(parseRedisInfo(null), {});
        assert.deepEqual(parseRedisInfo(undefined), {});
    });

    it('keeps values that contain colons intact', () => {
        const raw = '# Persistence\nrdb_last_bgsave_time_sec:-1\nslave0:ip=10.0.0.1,port=6379,state=online';
        const info = parseRedisInfo(raw);
        assert.equal(info.persistence.rdb_last_bgsave_time_sec, '-1');
        assert.equal(info.persistence.slave0, 'ip=10.0.0.1,port=6379,state=online');
    });

    it('ignores malformed lines without a colon', () => {
        const raw = '# Server\nthis line has no colon\nredis_version:7.2.0';
        const info = parseRedisInfo(raw);
        assert.equal(info.server.redis_version, '7.2.0');
        assert.equal(Object.keys(info.server).length, 1);
    });
});

describe('parseKeyspaceValue', () => {
    it('parses standard keyspace-row format with numeric coercion', () => {
        const parsed = parseKeyspaceValue('keys=120,expires=10,avg_ttl=0');
        assert.deepEqual(parsed, { keys: 120, expires: 10, avg_ttl: 0 });
    });

    it('preserves non-numeric values as strings', () => {
        const parsed = parseKeyspaceValue('state=online,keys=42,version=7.2.3-alpha');
        assert.equal(parsed.state, 'online');
        assert.equal(parsed.keys, 42);
        assert.equal(parsed.version, '7.2.3-alpha');
    });

    it('returns an empty object for empty / missing input', () => {
        assert.deepEqual(parseKeyspaceValue(''), {});
        assert.deepEqual(parseKeyspaceValue(null), {});
        assert.deepEqual(parseKeyspaceValue(undefined), {});
    });

    it('trims whitespace in keys', () => {
        const parsed = parseKeyspaceValue(' keys =  7 ,expires=1');
        assert.equal(parsed.keys, 7);
        assert.equal(parsed.expires, 1);
    });
});
