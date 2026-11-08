/// <reference types="bun" />
import { test, expect } from 'bun:test';
import { buildReadout } from './readout-shape';

const ORIGIN = 'https://6dtrust.com';

test('no identity → pending payload, status null', () => {
	const r = buildReadout('osc', 'alice', ORIGIN, null);
	expect(r.level).toBe(0);
	expect(r.levelName).toBe('pending');
	expect(r.accepted).toBe(false);
	expect(r.distance).toBeNull();
	expect(r.isSeed).toBe(false);
	expect(r.status).toBeNull();
	expect(r.computedAt).toBeNull();
	expect(r.badgeUrl).toBe('https://6dtrust.com/badge/osc/alice');
	expect(r.brandedBadgeUrl).toBe('https://6dtrust.com/badge/branded/osc/alice');
	expect(r.profileUrl).toBe('https://6dtrust.com/u/alice?root=osc');
});

test('accepted seed → trusted, isSeed true, distance 0', () => {
	const r = buildReadout('osc', 'torvalds', ORIGIN, {
		status: 'unclaimed',
		level: 3,
		distance: 0,
		computedAt: '2026-06-16T12:00:00.000Z',
		isSeed: true
	});
	expect(r.level).toBe(3);
	expect(r.levelName).toBe('trusted');
	expect(r.accepted).toBe(true);
	expect(r.distance).toBe(0);
	expect(r.isSeed).toBe(true);
	expect(r.status).toBe('unclaimed');
	expect(r.computedAt).toBe('2026-06-16T12:00:00.000Z');
});

test('identity exists but not in accept-set → pending, status known', () => {
	const r = buildReadout('osc', 'bob', ORIGIN, {
		status: 'claimed',
		level: null,
		distance: null,
		computedAt: null,
		isSeed: false
	});
	expect(r.level).toBe(0);
	expect(r.accepted).toBe(false);
	expect(r.status).toBe('claimed');
	expect(r.distance).toBeNull();
});
