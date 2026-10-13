import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import {
    buildDigestHeader,
    normalizeAtlas,
    _atlasGetForTest,
    saveCredential,
    resolveCloudConfig,
    _setHttpFn,
    _resetHttpFn,
    SUPPORTED_PROVIDERS,
    parseAtlasProcesses,
    parseAtlasClusters,
    listAtlasProcesses,
} from '../services/cloudInsightsService.js';

test('SUPPORTED_PROVIDERS is aws + atlas', () => {
    assert.deepEqual([...SUPPORTED_PROVIDERS].sort(), ['atlas', 'aws']);
});

test('saveCredential rejects unsupported providers', async () => {
    await assert.rejects(() => saveCredential({ workspaceId: 1, provider: 'gcp' }), /unsupported provider/);
});

test('resolveCloudConfig rejects unsupported providers', async () => {
    await assert.rejects(() => resolveCloudConfig(1, 'azure'), /unsupported provider/);
});

test('buildDigestHeader computes the correct response for qop=auth', () => {
    const username = 'pubKey',
        password = 'privKey',
        method = 'GET';
    const uri = '/api/atlas/v2/groups/g1/processes/h:27017/measurements';
    const realm = 'MMS Public API',
        nonce = 'abc123nonce',
        cnonce = 'deadbeef',
        nc = '00000001',
        qop = 'auth';
    const challenge = 'Digest realm="' + realm + '", nonce="' + nonce + '", qop="' + qop + '", algorithm=MD5';
    const header = buildDigestHeader({ method, uri, username, password, challenge, nc, cnonce });
    const md5 = (s) => crypto.createHash('md5').update(s).digest('hex');
    const ha1 = md5(username + ':' + realm + ':' + password);
    const ha2 = md5(method + ':' + uri);
    const expected = md5(ha1 + ':' + nonce + ':' + nc + ':' + cnonce + ':' + qop + ':' + ha2);
    assert.ok(header.includes('response="' + expected + '"'));
    assert.ok(header.includes('qop=' + qop));
    assert.ok(header.includes('cnonce="' + cnonce + '"'));
});

test('buildDigestHeader supports legacy (no-qop) challenges', () => {
    const header = buildDigestHeader({
        method: 'GET',
        uri: '/x',
        username: 'u',
        password: 'p',
        challenge: 'Digest realm="r", nonce="n"',
    });
    const md5 = (s) => crypto.createHash('md5').update(s).digest('hex');
    const expected = md5(md5('u:r:p') + ':n:' + md5('GET:/x'));
    assert.ok(header.includes('response="' + expected + '"'));
    assert.ok(!header.includes('qop='));
});

test('normalizeAtlas reshapes measurements and drops null datapoints', () => {
    const out = normalizeAtlas({
        measurements: [
            {
                name: 'CONNECTIONS',
                units: 'SCALAR',
                dataPoints: [
                    { timestamp: 't0', value: 12 },
                    { timestamp: 't1', value: null },
                    { timestamp: 't2', value: 15 },
                ],
            },
        ],
    });
    assert.equal(out.length, 1);
    assert.equal(out[0].datapoints.length, 2);
    assert.deepEqual(
        out[0].datapoints.map((d) => d.value),
        [12, 15],
    );
});

test('atlasGet performs the two-step digest handshake and parses JSON', async () => {
    const seen = [];
    _setHttpFn(async (url, init) => {
        seen.push(init.headers.Authorization ? 'authed' : 'challenge');
        if (!init.headers.Authorization) {
            return {
                status: 401,
                headers: {
                    get: (h) =>
                        h.toLowerCase() === 'www-authenticate'
                            ? 'Digest realm="MMS Public API", nonce="n1", qop="auth", algorithm=MD5'
                            : null,
                },
                body: '',
            };
        }
        assert.ok(/^Digest /.test(init.headers.Authorization));
        return {
            status: 200,
            headers: { get: () => null },
            body: JSON.stringify({
                measurements: [
                    { name: 'PROCESS_CPU_USER', units: 'PERCENT', dataPoints: [{ timestamp: 't', value: 3.5 }] },
                ],
            }),
        };
    });
    const json = await _atlasGetForTest('/groups/g1/processes/h:27017/measurements', {
        username: 'pub',
        password: 'priv',
    });
    _resetHttpFn();
    assert.deepEqual(seen, ['challenge', 'authed']);
    const norm = normalizeAtlas(json);
    assert.equal(norm[0].name, 'PROCESS_CPU_USER');
    assert.equal(norm[0].datapoints[0].value, 3.5);
});

test('atlasGet surfaces non-401 errors without a second request', async () => {
    let count = 0;
    _setHttpFn(async () => {
        count++;
        return { status: 500, headers: { get: () => null }, body: 'boom' };
    });
    await assert.rejects(() => _atlasGetForTest('/x', { username: 'u', password: 'p' }), /Atlas 500/);
    _resetHttpFn();
    assert.equal(count, 1);
});

test('parseAtlasProcesses reshapes the /processes payload', () => {
    const out = parseAtlasProcesses({
        results: [
            {
                id: 'host-a:27017',
                hostname: 'host-a',
                port: 27017,
                typeName: 'REPLICA_PRIMARY',
                replicaSetName: 'rs0',
                version: '7.0.5',
                userAlias: 'shard0-0',
            },
            { id: 'host-b:27017', hostname: 'host-b', port: 27017, typeName: 'REPLICA_SECONDARY' },
        ],
    });
    assert.equal(out.length, 2);
    assert.equal(out[0].id, 'host-a:27017');
    assert.equal(out[0].typeName, 'REPLICA_PRIMARY');
    assert.equal(out[0].replicaSetName, 'rs0');
    assert.equal(out[1].replicaSetName, null);
    assert.equal(out[1].version, null);
});

test('parseAtlasClusters reshapes the /clusters payload', () => {
    const out = parseAtlasClusters({
        results: [
            { name: 'prod', clusterType: 'REPLICASET', mongoDBVersion: '7.0', paused: false, stateName: 'IDLE' },
            { name: 'analytics', clusterType: 'SHARDED' },
        ],
    });
    assert.equal(out.length, 2);
    assert.equal(out[0].name, 'prod');
    assert.equal(out[1].clusterType, 'SHARDED');
    assert.equal(out[1].paused, false);
});

test('discovery parsers tolerate empty / missing results', () => {
    assert.deepEqual(parseAtlasProcesses({}), []);
    assert.deepEqual(parseAtlasClusters(null), []);
});

test('listAtlasProcesses rejects when the workspace has no Atlas credential', async () => {
    await assert.rejects(() => listAtlasProcesses(999999));
});
