import { LEVEL_COLORS, LEVEL_NAMES } from '$lib/levels';
import { READ_CACHE_CONTROL } from '../cache';
import { safeImageFetch } from '../safe-fetch';

// Slate-native trust badges. sRGB of the app's oklch theme tokens — renders
// identically when embedded as <img> through GitHub's camo proxy.

const BG = '#1d2128';
const BORDER = 'rgba(255,255,255,0.09)';
const LABEL = '#c9ccd2';
const ROOT = '#8b8f99';
const DIVIDER = 'rgba(255,255,255,0.12)';

const SANS = '-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif';
const MONO = 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace';

function esc(s: string): string {
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escAttr(s: string): string {
	return esc(s).replace(/"/g, '&quot;');
}

function sansW(s: string): number {
	return s.length * 6.3;
}

function monoW(s: string): number {
	return s.length * 6.8;
}

/** Left panel clip — rounds only the badge's left corners so the emblem is flush with the frame. */
function leftPanelClip(w: number, h: number, r: number): string {
	return `M ${r},0 H ${w} V ${h} H ${r} Q 0,${h} 0,${h - r} V ${r} Q 0,0 ${r},0 Z`;
}

export interface BadgeReadout {
	rootSlug: string;
	level: number;
	avatarUrl: string | null;
}

/** Branded badge input — emblem is inlined so the SVG works inside `<img>` (no cross-origin refs). */
export interface BrandedBadgeReadout extends BadgeReadout {
	avatarDataUri: string | null;
}

const LOGO_CACHE_TTL_MS = 5 * 60 * 1000;
const logoDataUriCache = new Map<string, { dataUri: string; expires: number }>();

/**
 * Fetch a root emblem and return a data URI for embedding in SVG `<image>`.
 * The URL is root-owner-controlled, so the network fetch goes through
 * `safeImageFetch` (https-only, private-IP-blocked at connect, no redirects,
 * size/time capped) — see safe-fetch.ts. Returns null on any disqualifier.
 */
export async function fetchLogoDataUri(avatarUrl: string): Promise<string | null> {
	const cached = logoDataUriCache.get(avatarUrl);
	if (cached && cached.expires > Date.now()) return cached.dataUri;

	const img = await safeImageFetch(avatarUrl);
	if (!img) return null;

	const dataUri = `data:${img.contentType};base64,${img.bytes.toString('base64')}`;
	logoDataUriCache.set(avatarUrl, { dataUri, expires: Date.now() + LOGO_CACHE_TTL_MS });
	return dataUri;
}

/** Compact 22px chip — sits in a README badge row next to CI shields. */
export function renderCompactBadge(readout: BadgeReadout): string {
	const color = LEVEL_COLORS[readout.level];
	const value = LEVEL_NAMES[readout.level];
	const root = esc(readout.rootSlug);
	const labelStr = `trust:${root}`;

	const H = 22;
	const cy = 11;
	const baseline = 15;
	const PAD = 10;
	const GAP = 8;
	const GLYPH = 16;

	const glyphX = PAD;
	const aCx = glyphX + 3;
	const bCx = glyphX + GLYPH - 3;
	const labelX = glyphX + GLYPH + GAP;
	const labelW = sansW(labelStr);
	const dividerX = labelX + labelW + GAP;
	const valueX = dividerX + GAP;
	const valueW = monoW(value);
	const total = Math.round(valueX + valueW + PAD);

	return `<svg xmlns="http://www.w3.org/2000/svg" width="${total}" height="${H}" role="img" aria-label="${labelStr}: ${value}">
  <rect x="0.5" y="0.5" width="${total - 1}" height="${H - 1}" rx="5.5" fill="${BG}" stroke="${BORDER}"/>
  <g stroke="${color}" stroke-width="1.4" fill="none">
    <line x1="${aCx}" y1="${cy}" x2="${bCx}" y2="${cy}"/>
  </g>
  <circle cx="${aCx}" cy="${cy}" r="2.4" fill="${BG}" stroke="${color}" stroke-width="1.4"/>
  <circle cx="${bCx}" cy="${cy}" r="2.6" fill="${color}"/>
  <text x="${labelX}" y="${baseline}" font-family="${SANS}" font-size="11" fill="${LABEL}">trust<tspan fill="${ROOT}">:${root}</tspan></text>
  <line x1="${dividerX}" y1="6" x2="${dividerX}" y2="${H - 6}" stroke="${DIVIDER}" stroke-width="1"/>
  <text x="${valueX}" y="${baseline}" font-family="${MONO}" font-size="11" font-weight="600" fill="${color}">${value}</text>
</svg>`;
}

/** Taller branded chip — root emblem left, trust readout stacked right. */
export function renderBrandedBadge(readout: BrandedBadgeReadout): string {
	const color = LEVEL_COLORS[readout.level];
	const value = esc(LEVEL_NAMES[readout.level]);
	const root = esc(readout.rootSlug);
	const labelStr = `trust:${root}`;

	const H = 32;
	const LOGO = 32;
	const RX = 5.5;
	const PAD = 10;
	const GAP = 8;
	const textX = LOGO + GAP;
	const textW = Math.max(sansW(labelStr), monoW(LEVEL_NAMES[readout.level]));
	const total = Math.round(textX + textW + PAD);
	const logoClip = leftPanelClip(LOGO, H, RX);

	const logoBlock = readout.avatarDataUri
		? `<image href="${escAttr(readout.avatarDataUri)}" x="0" y="0" width="${LOGO}" height="${H}" preserveAspectRatio="xMidYMid slice"/>`
		: `<rect x="0" y="0" width="${LOGO}" height="${H}" fill="${BG}"/>
  <text x="${LOGO / 2}" y="19" text-anchor="middle" font-family="${MONO}" font-size="11" font-weight="600" fill="${ROOT}">${esc(readout.rootSlug.slice(0, 2))}</text>`;

	return `<svg xmlns="http://www.w3.org/2000/svg" width="${total}" height="${H}" role="img" aria-label="${labelStr}: ${LEVEL_NAMES[readout.level]}">
  <defs>
    <clipPath id="logo"><path d="${logoClip}"/></clipPath>
  </defs>
  <rect x="0" y="0" width="${total}" height="${H}" rx="${RX}" fill="${BG}"/>
  <g clip-path="url(#logo)">${logoBlock}</g>
  <line x1="${LOGO}" y1="0" x2="${LOGO}" y2="${H}" stroke="${DIVIDER}" stroke-width="1"/>
  <text x="${textX}" y="13" font-family="${SANS}" font-size="10" fill="${LABEL}">trust<tspan fill="${ROOT}">:${root}</tspan></text>
  <text x="${textX}" y="26" font-family="${MONO}" font-size="11" font-weight="600" fill="${color}">${value}</text>
</svg>`;
}

export const BADGE_HEADERS = {
	'content-type': 'image/svg+xml',
	'cache-control': READ_CACHE_CONTROL
} as const;
