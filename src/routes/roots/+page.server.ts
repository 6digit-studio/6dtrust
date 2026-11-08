import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import {
	addPoison,
	addSeed,
	listPoison,
	listRootsForOwner,
	listSeeds,
	recomputeOwnedRoot,
	removePoison,
	removeSeed,
	setFeatured,
	updateRootProfile
} from '$lib/server/roots';
import { checkRateLimit, LIMITS } from '$lib/server/rate-limit';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) return { user: null, roots: [] };
	const summaries = await listRootsForOwner(locals.user.id);
	const roots = await Promise.all(
		summaries.map(async (r) => ({
			...r,
			seeds: await listSeeds(r.id),
			poison: await listPoison(r.id)
		}))
	);
	return { user: locals.user, roots };
};

export const actions: Actions = {
	addSeed: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { message: 'not signed in' });
		const data = await request.formData();
		const rootId = String(data.get('rootId') ?? '');
		const github = String(data.get('github') ?? '');
		if (!github.trim()) return fail(400, { message: 'GitHub username required' });
		const rl = await checkRateLimit(`seed:${locals.user.id}`, LIMITS.seed);
		if (!rl.allowed) {
			return fail(429, { message: `Too many seed edits — try again in ${rl.retryAfterSec}s` });
		}
		try {
			const res = await addSeed({ actorId: locals.user.id, rootId, githubUsername: github });
			return { success: true, message: `Added ${res.github} as a seed. Recompute to apply.` };
		} catch (e) {
			return fail(400, { message: e instanceof Error ? e.message : 'add seed failed' });
		}
	},

	removeSeed: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { message: 'not signed in' });
		const data = await request.formData();
		const rootId = String(data.get('rootId') ?? '');
		const identityId = String(data.get('identityId') ?? '');
		try {
			await removeSeed({ actorId: locals.user.id, rootId, identityId });
			return { success: true, message: 'Removed seed. Recompute to apply.' };
		} catch (e) {
			return fail(400, { message: e instanceof Error ? e.message : 'remove seed failed' });
		}
	},

	addPoison: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { message: 'not signed in' });
		const data = await request.formData();
		const rootId = String(data.get('rootId') ?? '');
		const github = String(data.get('github') ?? '');
		const reason = String(data.get('reason') ?? '');
		if (!github.trim()) return fail(400, { message: 'GitHub username required' });
		const rl = await checkRateLimit(`poison:${locals.user.id}`, LIMITS.poison);
		if (!rl.allowed) {
			return fail(429, { message: `Too many poison edits — try again in ${rl.retryAfterSec}s` });
		}
		try {
			const res = await addPoison({ actorId: locals.user.id, rootId, githubUsername: github, reason });
			return { success: true, message: `Poisoned ${res.github}. Recompute to apply.` };
		} catch (e) {
			return fail(400, { message: e instanceof Error ? e.message : 'poison failed' });
		}
	},

	removePoison: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { message: 'not signed in' });
		const data = await request.formData();
		const rootId = String(data.get('rootId') ?? '');
		const identityId = String(data.get('identityId') ?? '');
		try {
			await removePoison({ actorId: locals.user.id, rootId, identityId });
			return { success: true, message: 'Lifted poison. Recompute to apply.' };
		} catch (e) {
			return fail(400, { message: e instanceof Error ? e.message : 'lift poison failed' });
		}
	},

	setFeatured: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { message: 'not signed in' });
		const data = await request.formData();
		const rootId = String(data.get('rootId') ?? '');
		const featured = data.get('featured') === 'true';
		try {
			await setFeatured({ actorId: locals.user.id, rootId, featured });
			return {
				success: true,
				message: featured ? 'Featured on the landing page.' : 'Removed from the landing page.'
			};
		} catch (e) {
			return fail(400, { message: e instanceof Error ? e.message : 'failed' });
		}
	},

	recompute: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { message: 'not signed in' });
		const data = await request.formData();
		const rootId = String(data.get('rootId') ?? '');
		try {
			const res = await recomputeOwnedRoot(locals.user.id, rootId);
			return {
				success: true,
				message: `Recomputed: ${res.acceptedCount} accepted across ${res.nodeCount} identities in ${res.durationMs}ms`
			};
		} catch (e) {
			return fail(400, { message: e instanceof Error ? e.message : 'recompute failed' });
		}
	},

	updateProfile: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { message: 'not signed in' });
		const data = await request.formData();
		const rootId = String(data.get('rootId') ?? '');
		try {
			await updateRootProfile({
				actorId: locals.user.id,
				rootId,
				name: String(data.get('name') ?? ''),
				tagline: String(data.get('tagline') ?? '') || null,
				description: String(data.get('description') ?? '') || null,
				avatarUrl: String(data.get('avatarUrl') ?? '') || null,
				homepageUrl: String(data.get('homepageUrl') ?? '') || null
			});
			return { success: true, message: 'Profile saved.' };
		} catch (e) {
			return fail(400, { message: e instanceof Error ? e.message : 'save failed' });
		}
	}
};
