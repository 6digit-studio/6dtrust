import { env } from '$env/dynamic/private';

// Resolve a GitHub username to its stable account id + canonical login.
// Returns null if the user does not exist (404). Throws (fail loud) on any
// other non-OK response — we never silently fabricate a ghost on rate-limit.
//
// Unauthenticated GitHub is 60 req/hr per IP — fine for local dev. Set
// GITHUB_TOKEN (PAT / GitHub App token) in production for real rate limits.
export async function lookupGithubUser(
	username: string
): Promise<{ id: string; login: string } | null> {
	const headers: Record<string, string> = {
		'User-Agent': '6dtrust',
		Accept: 'application/vnd.github+json'
	};
	if (env.GITHUB_TOKEN) headers.Authorization = `Bearer ${env.GITHUB_TOKEN}`;

	const res = await fetch(`https://api.github.com/users/${encodeURIComponent(username)}`, {
		headers
	});
	if (res.status === 404) return null;
	if (!res.ok) throw new Error(`GitHub lookup failed (${res.status})`);

	const u = await res.json();
	if (!u?.id || !u?.login) throw new Error('GitHub returned an unexpected user payload');
	return { id: String(u.id), login: u.login };
}
