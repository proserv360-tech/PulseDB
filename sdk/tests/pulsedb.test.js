/**
 * Unit tests for PulseDB SDK
 * Run with: node --test tests/pulsedb.test.js
 */
import { test } from 'node:test';
import assert from 'node:assert';
import PulseDBSDK from '../src/index.js';

test('SDK initialization', () => {
  assert.throws(
    () => new PulseDBSDK({ endpoint: 'https://pulsedb.app' }),
    /apiKey is required/,
    'Should require apiKey'
  );

  assert.throws(
    () => new PulseDBSDK({ apiKey: 'sk_live_test' }),
    /endpoint is required/,
    'Should require endpoint'
  );

  const sdk = new PulseDBSDK({
    apiKey: 'sk_live_test',
    endpoint: 'https://pulsedb.app',
  });

  assert.equal(sdk.apiKey, 'sk_live_test');
  assert.equal(sdk.endpoint, 'https://pulsedb.app');
  assert.equal(sdk.batchSize, 50);
  assert.equal(sdk.flushInterval, 10000);
});

test('Event queueing', () => {
  const sdk = new PulseDBSDK({
    apiKey: 'sk_live_test',
    endpoint: 'https://pulsedb.app',
  });

  sdk.trackAPI({
    method: 'GET',
    endpoint: '/api/test',
    statusCode: 200,
    durationMs: 100,
  });

  assert.equal(sdk.queue.length, 1);
  assert.equal(sdk.queue[0].type, 'api');
  assert.equal(sdk.queue[0].title, 'GET /api/test');
});

test('Error tracking', () => {
  const sdk = new PulseDBSDK({
    apiKey: 'sk_live_test',
    endpoint: 'https://pulsedb.app',
  });

  const error = new Error('Test error');
  sdk.trackError({ error });

  assert.equal(sdk.queue.length, 1);
  assert.equal(sdk.queue[0].type, 'error');
  assert.match(sdk.queue[0].metadata.message, /Test error/);
});

test('Event listeners', () => {
  const sdk = new PulseDBSDK({
    apiKey: 'sk_live_test',
    endpoint: 'https://pulsedb.app',
  });

  let shutdownCalled = false;
  sdk.on('shutdown', () => {
    shutdownCalled = true;
  });

  sdk.emit('shutdown', {});
  assert.equal(shutdownCalled, true);
});

test('Graceful shutdown', async () => {
  const sdk = new PulseDBSDK({
    apiKey: 'sk_live_test',
    endpoint: 'https://pulsedb.app',
  });

  sdk.start();
  assert.ok(sdk.flushTimer !== null);

  await sdk.shutdown();
  assert.equal(sdk.flushTimer, null);
  assert.equal(sdk.isShuttingDown, true);
});

console.log('✓ All tests passed');
