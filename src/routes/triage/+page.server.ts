import type { PageServerLoad } from './$types';
import { listRootsForOwner } from '$lib/server/roots';
import { triageRepo, type TriageResult } from '$lib/server/triage';
import { checkRateLimit, LIMITS } from '$lib/server/rate-limit';

// The triage page reads its inputs from the URL (?root=&repo=) so a result is
// shareable and survives a refresh — a GET form, not a POST action. Trust
// resolution itself is public (the badge endpoint exposes the same per-root
// levels without auth); sign-in here is just so the root picker can show "your"
// roots.
export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) {
		return { user: null, roots: [], result: null, error: null, query: { root: '', repo: '' } };
	}
	const roots = await listRootsForOwner(locals.user.id);
	const root = url.searchParams.get('root') ?? '';
	const repo = url.searchParams.get('repo') ?? '';

	let result: TriageResult | null = null;
	let error: string | null = null;
	if (root && repo) {
		const rl = await checkRateLimit(`triage:${locals.user.id}`, LIMITS.triage);
		if (!rl.allowed) {
			error = `Rate limit — too many triage runs, try again in ${rl.retryAfterSec}s`;
		} else {
			try {
				result = await triageRepo(root, repo, locals.user.id);
			} catch (e) {
				error = e instanceof Error ? e.message : 'triage failed';
			}
		}
	}

	return { user: locals.user, roots, result, error, query: { root, repo } };
};
