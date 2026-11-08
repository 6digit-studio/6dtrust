// Single source of truth for the trust-level vocabulary.
//
// The trust engine computes an integer level 0–3 for every (root, identity)
// pair; this module is its only naming authority. Every surface — the SVG
// badge, the dashboard grant picker, triage, the landing legend — imports from
// here, the way anchor.ts is the single authority for "what is a costly anchor."
//
// Each level has two faces:
//   • READOUT — what a root's vantage says about someone (badge / triage / legend).
//   • GRANT  — the first-person certification you sign when you add someone to
//     your trust graph (the picker). PENDING is readout-only: you never grant
//     it; it is what shows when no path reaches someone yet — an open door, not
//     a verdict.
//
// This replaces Advogato's guild vocabulary (apprentice / journeyer / master),
// which read as a craft-skill rank. Trust here is relationship proximity, named
// in plain words that work in both faces: "I know them" → known, "I vouch for
// them" → vouched, "I trust them" → trusted.

export interface Level {
	level: number;
	/** Readout label — what a root's vantage says about someone. */
	name: string;
	/** First-person certification phrasing; null for the ungrantable PENDING floor. */
	grant: string | null;
	/** One-line description for the landing legend. */
	blurb: string;
	/** sRGB hex of the app's oklch --level-N token, for the camo-proxied SVG badge. */
	color: string;
}

export const LEVELS: Record<number, Level> = {
	0: {
		level: 0,
		name: 'pending',
		grant: null,
		blurb: 'no path reaches them from this root yet — an open door, not a verdict',
		color: '#8b8f99'
	},
	1: {
		level: 1,
		name: 'known',
		grant: 'I know them',
		blurb: 'a real, known person — reachable from this root',
		color: '#5f897a'
	},
	2: {
		level: 2,
		name: 'vouched',
		grant: 'I vouch for them',
		blurb: 'endorsed into the web of trust from this root',
		color: '#46af92'
	},
	3: {
		level: 3,
		name: 'trusted',
		grant: 'I trust them',
		blurb: 'deeply trusted, near the seeds — the strongest signal',
		color: '#38d39c'
	}
};

/** Look up a level, loud on anything outside the engine's 0–3 domain. */
export function levelInfo(n: number): Level {
	const l = LEVELS[n];
	if (!l) throw new Error(`unknown trust level ${n} — the engine emits 0–3`);
	return l;
}

/** The grantable certifications, weakest → strongest, for the trust-graph picker. */
export const GRANTABLE: Level[] = [1, 2, 3].map((n) => LEVELS[n]);

/** Capitalize a readout name for sentence/label use ("vouched" → "Vouched"). */
export const capLevel = (name: string): string => name.charAt(0).toUpperCase() + name.slice(1);

/** Readout names keyed by engine level — badges, pills, triage labels. */
export const LEVEL_NAMES: Record<number, string> = Object.fromEntries(
	Object.values(LEVELS).map((l) => [l.level, l.name])
) as Record<number, string>;

/** Badge SVG colors keyed by engine level (sRGB of the oklch --level-N tokens). */
export const LEVEL_COLORS: Record<number, string> = Object.fromEntries(
	Object.values(LEVELS).map((l) => [l.level, l.color])
) as Record<number, string>;
