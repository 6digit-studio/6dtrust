/// <reference types="bun" />
import { test, expect } from 'bun:test';
import { isBotHandle, suggestionLine, relativeTime } from './inbox-rules';

test('isBotHandle catches [bot]/-bot suffixes and known bots, not humans', () => {
	expect(isBotHandle('dependabot[bot]')).toBe(true);
	expect(isBotHandle('renovate')).toBe(true);
	expect(isBotHandle('some-bot')).toBe(true);
	expect(isBotHandle('GitHub-Actions')).toBe(true);
	expect(isBotHandle('torvalds')).toBe(false);
	expect(isBotHandle('reinink')).toBe(false);
});

test('suggestionLine formats a merge and degrades gracefully', () => {
	expect(
		suggestionLine('github:merge', { repo: 'owner/repo', pr: 412, title: 'Fix badge layout' })
	).toBe('Merged PR #412 in owner/repo — Fix badge layout');
	expect(suggestionLine('github:merge', { repo: 'owner/repo' })).toBe('Merged PR in owner/repo');
	expect(suggestionLine('github:merge', {})).toBe('Merged PR');
	expect(suggestionLine('manual', {})).toBe('manual');
});

test('relativeTime buckets seconds → days, then falls back to a date', () => {
	const now = Date.parse('2026-06-16T12:00:00.000Z');
	expect(relativeTime('2026-06-16T11:59:40.000Z', now)).toBe('just now');
	expect(relativeTime('2026-06-16T11:55:00.000Z', now)).toBe('5m ago');
	expect(relativeTime('2026-06-16T10:00:00.000Z', now)).toBe('2h ago');
	expect(relativeTime('2026-06-13T12:00:00.000Z', now)).toBe('3d ago');
	expect(relativeTime('2026-06-01T12:00:00.000Z', now)).toBe('2026-06-01');
	expect(relativeTime('not-a-date', now)).toBe('');
});
