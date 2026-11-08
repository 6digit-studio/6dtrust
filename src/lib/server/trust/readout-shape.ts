// Pure shape of the trust readout — no DB, no $env — so the mapping logic
// (level → accepted, null-handling, URL construction) unit-tests in isolation.
// The DB query lives in readout.ts and hands its row to buildReadout().

import { LEVELS } from '$lib/levels';

export interface TrustReadout {
	root: string;
	handle: string;
	level: number;
	levelName: string;
	accepted: boolean;
	distance: number | null;
	isSeed: boolean;
	status: 'claimed' | 'unclaimed' | null;
	computedAt: string | null;
	badgeUrl: string;
	brandedBadgeUrl: string;
	profileUrl: string;
}

// The resolved facts for a (root, handle): null when the handle resolves to no
// identity at all. When present, level/distance/computedAt are still null if the
// identity exists but isn't in this root's accept-set (a claimed-but-pending
// person) — the payload reports pending, not an error.
export interface ReadoutRow {
	status: 'claimed' | 'unclaimed';
	level: number | null;
	distance: number | null;
	computedAt: string | null;
	isSeed: boolean;
}

export function buildReadout(
	rootSlug: string,
	handle: string,
	origin: string,
	row: ReadoutRow | null
): TrustReadout {
	const level = row?.level ?? 0;
	return {
		root: rootSlug,
		handle,
		level,
		levelName: LEVELS[level].name,
		accepted: level > 0,
		distance: row?.distance ?? null,
		isSeed: row?.isSeed ?? false,
		status: row?.status ?? null,
		computedAt: row?.computedAt ?? null,
		badgeUrl: `${origin}/badge/${rootSlug}/${handle}`,
		brandedBadgeUrl: `${origin}/badge/branded/${rootSlug}/${handle}`,
		profileUrl: `${origin}/u/${handle}?root=${rootSlug}`
	};
}
