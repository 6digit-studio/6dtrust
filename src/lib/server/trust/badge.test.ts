/// <reference types="bun" />
import { test, expect } from 'bun:test';
import { renderBrandedBadge } from './badge';

const DATA_URI =
	'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

test('branded badge inlines emblem — no external image href', () => {
	const svg = renderBrandedBadge({
		rootSlug: 'osc',
		level: 3,
		avatarUrl: 'https://6dtrust.b-cdn.net/root-emblems/open-source-512.png',
		avatarDataUri: DATA_URI
	});
	expect(svg).toContain(`href="${DATA_URI}"`);
	expect(svg).not.toContain('6dtrust.b-cdn.net');
	expect(svg).toContain('width="32" height="32"');
	expect(svg).toContain('preserveAspectRatio="xMidYMid slice"');
	expect(svg).toContain('y1="0" x2="32" y2="32"');
	expect(svg).toContain('x="0" y="0"');
});

test('branded badge without emblem falls back to initials', () => {
	const svg = renderBrandedBadge({
		rootSlug: 'osc',
		level: 0,
		avatarUrl: null,
		avatarDataUri: null
	});
	expect(svg).toContain('>os<');
	expect(svg).not.toContain('<image');
});
