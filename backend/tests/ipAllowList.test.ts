import test from 'node:test';
import assert from 'node:assert/strict';
import { ipInCidr } from '../middleware/ipAllowList.js';

test('IPv4 matches within /24', () => {
    assert.equal(ipInCidr('10.0.1.50', '10.0.1.0/24'), true);
    assert.equal(ipInCidr('10.0.2.50', '10.0.1.0/24'), false);
});
test('IPv4 /32 exact match', () => {
    assert.equal(ipInCidr('192.168.1.1', '192.168.1.1/32'), true);
    assert.equal(ipInCidr('192.168.1.2', '192.168.1.1/32'), false);
});
test('IPv4 /0 matches all', () => {
    assert.equal(ipInCidr('8.8.8.8', '0.0.0.0/0'), true);
});
test('IPv4 rejects invalid', () => {
    assert.equal(ipInCidr('not-an-ip', '10.0.0.0/8'), false);
});
test('IPv6 matches within /64', () => {
    assert.equal(ipInCidr('2001:db8::1', '2001:db8::/64'), true);
    assert.equal(ipInCidr('2001:db9::1', '2001:db8::/64'), false);
});
test('IPv6 /128 exact', () => {
    assert.equal(ipInCidr('2001:db8::1', '2001:db8::1/128'), true);
});
