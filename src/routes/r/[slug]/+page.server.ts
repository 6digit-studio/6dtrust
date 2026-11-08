import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { getPublicRootProfile } from '$lib/server/roots';

export const load: PageServerLoad = async ({ params }) => {
	const root = await getPublicRootProfile(params.slug);
	if (!root) throw error(404, 'Root not found');
	return { root };
};
