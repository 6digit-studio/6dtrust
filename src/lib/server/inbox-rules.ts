// Pure inbox rules — no DB, no $env — so they unit-test in isolation.

const KNOWN_BOTS = new Set([
	'dependabot',
	'renovate',
	'greenkeeper',
	'mergify',
	'codecov',
	'snyk-bot',
	'github-actions'
]);

// GitHub bot accounts carry a [bot] suffix on their login (dependabot[bot], …);
// we never suggest vouching for a bot. Also catch a -bot suffix and a known set.
export function isBotHandle(handle: string): boolean {
	const h = handle.trim().toLowerCase();
	return h.endsWith('[bot]') || h.endsWith('-bot') || KNOWN_BOTS.has(h);
}

// A human-readable context line for a suggestion, from its stored context. Must
// degrade gracefully — the UI always renders something, even with fields missing.
export function suggestionLine(source: string, context: Record<string, unknown>): string {
	if (source === 'github:merge') {
		const repo = typeof context.repo === 'string' ? context.repo : null;
		const pr = typeof context.pr === 'number' ? `#${context.pr}` : null;
		const title = typeof context.title === 'string' ? context.title.trim() : null;
		const head = `Merged PR${pr ? ` ${pr}` : ''}${repo ? ` in ${repo}` : ''}`;
		return title ? `${head} — ${title}` : head;
	}
	return source;
}

// Compact relative time ("just now", "3m ago", "2h ago", "5d ago"); past a week
// it falls back to an ISO date. Pure: caller passes `nowMs` so it's testable.
export function relativeTime(fromIso: string, nowMs: number): string {
	const then = Date.parse(fromIso);
	if (Number.isNaN(then)) return '';
	const sec = Math.max(0, Math.round((nowMs - then) / 1000));
	if (sec < 45) return 'just now';
	const min = Math.round(sec / 60);
	if (min < 60) return `${min}m ago`;
	const hr = Math.round(min / 60);
	if (hr < 24) return `${hr}h ago`;
	const day = Math.round(hr / 24);
	if (day <= 7) return `${day}d ago`;
	return new Date(then).toISOString().slice(0, 10);
}
