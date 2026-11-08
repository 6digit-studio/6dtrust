import type { PageServerLoad, Actions } from './$types';
import { error, fail } from '@sveltejs/kit';
import { createRoot, listAllRoots, transferRoot } from '$lib/server/roots';
import { ingestSuggestion } from '$lib/server/inbox';
import { notifyRootMint } from '$lib/server/discord';

// The admin console. Gated on is_admin — non-admins get a 404 (not a 403), so the
// section's existence isn't even advertised. Admin status is bootstrapped from the
// ADMIN_GITHUB_HANDLES env list on login (see identity.ts / session.ts).
function requireAdmin(locals: App.Locals): void {
	if (!locals.user?.isAdmin) throw error(404, 'Not found');
}

export const load: PageServerLoad = async ({ locals }) => {
	requireAdmin(locals);
	return { roots: await listAllRoots() };
};

export const actions: Actions = {
	mint: async ({ request, locals }) => {
		requireAdmin(locals);
		const data = await request.formData();
		const slug = String(data.get('slug') ?? '');
		const name = String(data.get('name') ?? '');
		try {
			// Admin mints the root and owns it — manage seeds/recompute on /roots.
			const r = await createRoot({ ownerId: locals.user!.id, slug, name });
			await notifyRootMint({ slug: r.slug, name: r.name });
			return { success: true, message: `Minted root "${r.slug}". Add seeds and recompute on /roots.` };
		} catch (e) {
			return fail(400, { message: e instanceof Error ? e.message : 'mint failed' });
		}
	},

	// Hand a root to another identity (community takeover) or reclaim it. Resolves
	// the github handle — if they haven't signed up, it reserves the root for the
	// pinned unclaimed identity and activates when they claim it.
	transfer: async ({ request, locals }) => {
		requireAdmin(locals);
		const data = await request.formData();
		const rootId = String(data.get('rootId') ?? '');
		const github = String(data.get('github') ?? '');
		if (!github.trim()) return fail(400, { message: 'new owner GitHub handle required' });
		try {
			const res = await transferRoot({ actorId: locals.user!.id, rootId, newOwnerGithub: github });
			return { success: true, message: `Transferred root to @${res.newOwnerGithub}.` };
		} catch (e) {
			return fail(400, { message: e instanceof Error ? e.message : 'transfer failed' });
		}
	},

	// Test-ingest: stands in for the GitHub merge handler until the App exists, so
	// the inbox loop can be exercised end-to-end. Drops a suggestion into the
	// CURRENT admin's inbox — go to /inbox to act on it.
	testIngest: async ({ request, locals }) => {
		requireAdmin(locals);
		const data = await request.formData();
		const subject = String(data.get('subject') ?? '').trim();
		const repo = String(data.get('repo') ?? '').trim();
		const prRaw = String(data.get('pr') ?? '').trim();
		const title = String(data.get('title') ?? '').trim();
		if (!subject) return fail(400, { message: 'subject GitHub handle required' });
		const pr = prRaw ? Number(prRaw) : undefined;
		if (prRaw && !Number.isInteger(pr)) return fail(400, { message: 'PR must be a whole number' });

		const context: Record<string, unknown> = {};
		if (repo) context.repo = repo;
		if (pr !== undefined) context.pr = pr;
		if (title) context.title = title;

		try {
			const res = await ingestSuggestion({
				voucherId: locals.user!.id,
				subjectGithub: subject,
				source: 'github:merge',
				context
			});
			return res.ingested
				? { success: true, message: `Ingested a suggestion for @${subject} → check your /inbox.` }
				: fail(400, { message: `Skipped @${subject} — bot or malformed handle.` });
		} catch (e) {
			return fail(400, { message: e instanceof Error ? e.message : 'ingest failed' });
		}
	}
};
