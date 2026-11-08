import type { PageServerLoad, Actions } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { sql } from '$lib/server/db';
import { listInbox, actOnSuggestion } from '$lib/server/inbox';
import { suggestionLine, relativeTime } from '$lib/server/inbox-rules';
import { normalizeGithub } from '$lib/server/resolve';
import { checkRateLimit, LIMITS } from '$lib/server/rate-limit';

const ACTIONS = ['dismiss', 'known', 'vouch', 'trust'] as const;
type InboxAction = (typeof ACTIONS)[number];

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) throw redirect(302, '/login/github');
	const uid = locals.user.id;

	const suggestions = await listInbox(uid);

	// Your strongest existing vouch per subject handle, so the UI can disable
	// actions that wouldn't change anything (upgrade-only: re-acting at or below
	// your current level is a no-op).
	const existing = await sql<{ github: string; level: number }[]>`
		select lower(h.value) as github, max(v.level)::int as level
		from vouches v
		join handles h on h.identity_id = v.subject_id and h.kind = 'github'
		where v.voucher_id = ${uid} and v.revoked_at is null
		group by lower(h.value)`;
	const byHandle = new Map(existing.map((r) => [r.github, r.level]));

	const now = Date.now();
	const items = suggestions.map((s) => ({
		id: s.id,
		subjectGithub: s.subjectGithub,
		line: suggestionLine(s.source, s.context),
		ago: relativeTime(s.lastSeenAt, now),
		currentLevel: byHandle.get(normalizeGithub(s.subjectGithub)) ?? 0
	}));

	return { items };
};

export const actions: Actions = {
	act: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { message: 'not signed in' });
		const data = await request.formData();
		const suggestionId = String(data.get('suggestionId') ?? '').trim();
		const action = String(data.get('action') ?? '') as InboxAction;
		if (!suggestionId) return fail(400, { message: 'invalid suggestion' });
		if (!ACTIONS.includes(action)) return fail(400, { message: 'invalid action' });

		// A vouch action writes an edge — rate-limit it the same as the dashboard
		// grant path. Dismiss is local bookkeeping, no limit.
		if (action !== 'dismiss') {
			const rl = await checkRateLimit(`vouch:${locals.user.id}`, LIMITS.vouch);
			if (!rl.allowed) {
				return fail(429, { message: `Too many vouches — try again in ${rl.retryAfterSec}s` });
			}
		}

		try {
			const res = await actOnSuggestion({ voucherId: locals.user.id, suggestionId, action });
			return { success: true, message: res.done };
		} catch (e) {
			return fail(400, { message: e instanceof Error ? e.message : 'action failed' });
		}
	}
};
