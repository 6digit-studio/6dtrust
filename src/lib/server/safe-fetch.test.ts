/// <reference types="bun" />
import { test, expect } from 'bun:test';
import { isBlockedAddress } from './safe-fetch';

test('blocks IPv4 private / reserved ranges', () => {
	for (const ip of [
		'0.0.0.0',
		'10.1.2.3',
		'100.64.0.1', // CGNAT
		'127.0.0.1',
		'169.254.169.254', // cloud metadata
		'172.16.5.4',
		'172.31.255.255',
		'192.168.1.1',
		'198.18.0.1',
		'224.0.0.1', // multicast
		'255.255.255.255'
	]) {
		expect(isBlockedAddress(ip)).toBe(true);
	}
});

test('allows public IPv4', () => {
	for (const ip of ['8.8.8.8', '1.1.1.1', '140.82.112.3' /* github */, '172.15.0.1', '172.32.0.1']) {
		expect(isBlockedAddress(ip)).toBe(false);
	}
});

test('blocks IPv6 loopback / ULA / link-local / unspecified', () => {
	for (const ip of ['::1', '::', 'fc00::1', 'fd12:3456::1', 'fe80::1', 'ff02::1']) {
		expect(isBlockedAddress(ip)).toBe(true);
	}
});

test('allows public IPv6', () => {
	expect(isBlockedAddress('2606:4700:4700::1111')).toBe(false); // cloudflare
});

test('unwraps IPv4-mapped IPv6 and blocks internal v4 hiding inside', () => {
	expect(isBlockedAddress('::ffff:127.0.0.1')).toBe(true);
	expect(isBlockedAddress('::ffff:169.254.169.254')).toBe(true);
	expect(isBlockedAddress('::ffff:8.8.8.8')).toBe(false);
});

test('fails closed on non-IP strings', () => {
	expect(isBlockedAddress('not-an-ip')).toBe(true);
	expect(isBlockedAddress('')).toBe(true);
});
