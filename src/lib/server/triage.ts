import { env } from '$env/dynamic/private';
import { sql } from './db';

// The triage read: a maintainer's open PRs, re-sorted by the author's trust level
// from a chosen root's vantage. This is the PR post-hook rehearsed as a page —
// the same (root, github-handle) -> level read the badge endpoint serves, fanned
// over a whole repo's open pull requests. No GitHub App, no webhook: one (paged)
// list-PRs call to GitHub, then a pure-DB batch resolve against accept_sets.
//
// The author login is already in the PR payload, so there is NO per-author GitHub
// call — trust resolution is one SQL query for the whole repo.

export interface TriagePR {
	number: number;
	title: string;
	url: string;
	author: string; // github login, original case (for display)
	createdAt: string;
	draft: boolean;
	level: number; // 0 pending · 1 known · 2 vouched · 3 trusted
}

export interface TriageResult {
	repo: string; // normalized owner/repo
	rootSlug: string;
	rootName: string;
	computedAt: string | null; // freshness of the root's accept_sets (honest about staleness)
	total: number;
	capped: boolean; // true if the repo has more open PRs than the fetch cap (first N only)
	trusted: TriagePR[]; // level >= 1, brightest trust first, then oldest PR first
	earnIt: TriagePR[]; // level 0 — "no signal from here yet", never a verdict
}

// Accept "owner/repo", "github.com/owner/repo", or a full PR/repo URL. Throws loud
// on anything we can't parse — no silent fallback to a guessed repo.
export function parseRepo(input: string): { owner: string; repo: string } {
	const trimmed = input.trim().replace(/^https?:\/\//, '').replace(/^github\.com\//, '');
	const m = trimmed.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)/);
	if (!m) throw new Error(`couldn't read a repo from "${input}" — use owner/repo`);
	return { owner: m[1], repo: m[2].replace(/\.git$/, '') };
}

interface RawPR {
	number: number;
	title: string;
	html_url: string;
	created_at: string;
	draft: boolean;
	user: { login: string } | null;
}

function ghHeaders(): Record<string, string> {
	const headers: Record<string, string> = {
		'User-Agent': '6dtrust',
		Accept: 'application/vnd.github+json'
	};
	if (env.GITHUB_TOKEN) headers.Authorization = `Bearer ${env.GITHUB_TOKEN}`;
	return headers;
}

// Cap the GitHub fan-out: an attacker pointing triage at a huge repo could
// otherwise drive unbounded sequential list-PRs calls against the shared token.
// 10 pages x 100 = the first 1000 open PRs — past any real maintainer's triage
// need, and a hard ceiling on the burst. If a repo exceeds it we stop at the cap.
const MAX_PR_PAGES = 10;

// Open PRs for a repo, up to MAX_PR_PAGES. Loud on every failure shape: 404 (no
// such repo), 403 (rate limited — the unauthenticated 60/hr is the usual culprit;
// set GITHUB_TOKEN), any other non-OK. Returns { prs, capped } so the caller can
// be honest about a truncated list rather than dressing it as complete.
async function fetchOpenPRs(
	owner: string,
	repo: string
): Promise<{ prs: RawPR[]; capped: boolean }> {
	const out: RawPR[] = [];
	for (let page = 1; page <= MAX_PR_PAGES; page++) {
		const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(
			repo
		)}/pulls?state=open&per_page=100&page=${page}`;
		const res = await fetch(url, { headers: ghHeaders() });
		if (res.status === 404) throw new Error(`repo "${owner}/${repo}" not found (or private to us)`);
		if (res.status === 403) {
			const remaining = res.headers.get('x-ratelimit-remaining');
			throw new Error(
				remaining === '0'
					? 'GitHub rate limit hit — set GITHUB_TOKEN for real limits'
					: 'GitHub refused the request (403)'
			);
		}
		if (!res.ok) throw new Error(`GitHub list-PRs failed (${res.status})`);
		const batch = (await res.json()) as RawPR[];
		out.push(...batch);
		if (batch.length < 100) return { prs: out, capped: false };
	}
	return { prs: out, capped: true };
}

// Batch (root, handle) -> level over accept_sets. Handles not in the accept set are
// simply absent from the result (the caller defaults them to 0 = pending). One
// query for the whole repo. `logins` must be lowercased to match stored handles.
async function resolveLevels(rootId: string, logins: string[]): Promise<Map<string, number>> {
	const levels = new Map<string, number>();
	if (logins.length === 0) return levels;
	const rows = await sql<{ github: string; level: number }[]>`
		select h.value as github, a.level
		from accept_sets a
		join handles h on h.identity_id = a.identity_id and h.kind = 'github'
		where a.root_id = ${rootId} and h.value in ${sql(logins)}`;
	for (const r of rows) levels.set(r.github, r.level);
	return levels;
}

// `viewerId` is the signed-in identity. Triage is allowed on a PUBLIC root (trust
// resolution is public anyway) OR a root the viewer owns — never a foreign private
// root, which would otherwise leak its existence/name and let any logged-in user
// drive GitHub fan-out against it.
export async function triageRepo(
	rootSlug: string,
	repoInput: string,
	viewerId: string
): Promise<TriageResult> {
	const { owner, repo } = parseRepo(repoInput);

	const [root] = await sql<{ id: string; slug: string; name: string; computedAt: string | null }[]>`
		select r.id, r.slug, r.name,
		       (select max(finished_at) from compute_runs cr where cr.root_id = r.id) as "computedAt"
		from roots r
		where r.slug = ${rootSlug} and (r.visibility = 'public' or r.owner_id = ${viewerId})`;
	if (!root) throw new Error(`no root "${rootSlug}"`);

	const { prs, capped } = await fetchOpenPRs(owner, repo);

	// distinct lowercased author logins (skip ghost/null authors)
	const logins = [
		...new Set(prs.map((p) => p.user?.login?.toLowerCase()).filter((l): l is string => !!l))
	];
	const levels = await resolveLevels(root.id, logins);

	const rows: TriagePR[] = prs
		.filter((p) => p.user?.login)
		.map((p) => ({
			number: p.number,
			title: p.title,
			url: p.html_url,
			author: p.user!.login,
			createdAt: p.created_at,
			draft: p.draft,
			level: levels.get(p.user!.login.toLowerCase()) ?? 0
		}));

	const oldestFirst = (a: TriagePR, b: TriagePR) => a.createdAt.localeCompare(b.createdAt);
	const trusted = rows
		.filter((r) => r.level >= 1)
		.sort((a, b) => b.level - a.level || oldestFirst(a, b));
	const earnIt = rows.filter((r) => r.level === 0).sort(oldestFirst);

	// The triage read is the product's relief moment; record its split (0004)
	// so trusted-fraction-over-time exists somewhere other than one page render.
	await sql`insert into triage_reads
	          (root_id, repo, total, trusted_count, earnit_count, computed_at_served)
	          values (${root.id}, ${`${owner}/${repo}`}, ${rows.length}, ${trusted.length},
	                  ${earnIt.length}, ${root.computedAt})`;

	return {
		repo: `${owner}/${repo}`,
		rootSlug: root.slug,
		rootName: root.name,
		computedAt: root.computedAt,
		total: rows.length,
		capped,
		trusted,
		earnIt
	};
}
