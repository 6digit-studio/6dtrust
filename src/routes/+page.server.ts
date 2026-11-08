import type { PageServerLoad } from './$types';
import { listPublicRootsWithAcceptSets } from '$lib/server/roots';

// The landing loads featured roots with seeds and accept counts only — never a member roster.
export const load: PageServerLoad = async () => {
	const roots = await listPublicRootsWithAcceptSets();
	return { roots };
};
