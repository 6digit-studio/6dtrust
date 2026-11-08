import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { getPersonProfile } from '$lib/server/profile';

export const load: PageServerLoad = async ({ params }) => {
	const profile = await getPersonProfile(params.handle);
	if (!profile) throw error(404, 'Not in the trust web');
	return { profile };
};
