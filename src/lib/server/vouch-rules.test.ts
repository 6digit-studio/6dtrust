/// <reference types="bun" />
import { test, expect } from 'bun:test';
import { wouldUpgrade } from './vouch-rules';

test('upgrade writes when there is no active vouch', () => {
	expect(wouldUpgrade(null, 1)).toBe(true);
	expect(wouldUpgrade(null, 3)).toBe(true);
});

test('upgrade writes when the active vouch is below target', () => {
	expect(wouldUpgrade(1, 2)).toBe(true);
	expect(wouldUpgrade(2, 3)).toBe(true);
});

test('upgrade is a no-op at or above target — never a downgrade', () => {
	expect(wouldUpgrade(2, 2)).toBe(false);
	expect(wouldUpgrade(3, 3)).toBe(false);
	expect(wouldUpgrade(3, 1)).toBe(false);
});
