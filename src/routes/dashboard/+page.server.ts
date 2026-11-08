import type { PageServerLoad, Actions } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { sql } from '$lib/server/db';
import { createVouch, revokeVouch } from '$lib/server/vouch';
import { deleteAccount } from '$lib/server/identity';
import { deleteSessionCookie } from '$lib/server/session';
import { checkRateLimit, LIMITS } from '$lib/server/rate-limit';
import { notifyVouch } from '$lib/server/discord';
import { levelInfo, capLevel } from '$lib/levels';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) throw redirect(302, '/login/github');
	const uid = locals.user.id;

	const handles = await sql<{ kind: string; value: string; verified: boolean }[]>`
		select kind, value, verified from handles where identity_id = ${uid} order by kind, value`;

	const outgoing = await sql<
		{
			id: string;
			level: number;
			subject_id: string;
			subject_github: string;
			subject_status: string;
		}[]
	>`select v.id, v.level, v.subject_id, i.status as subject_status,
	         coalesce(h.value, '(unknown)') as subject_github
	  from vouches v
	  join identities i on i.id = v.subject_id
	  left join handles h on h.identity_id = v.subject_id and h.kind = 'github'
	  where v.voucher_id = ${uid} and v.revoked_at is null
	  order by v.created_at desc`;

	const incoming = await sql<{ id: string; level: number; voucher_github: string }[]>`
		select v.id, v.level, coalesce(h.value, '(unknown)') as voucher_github
		from vouches v
		left join handles h on h.identity_id = v.voucher_id and h.kind = 'github'
		where v.subject_id = ${uid} and v.revoked_at is null
		order by v.created_at desc`;

	return { user: locals.user, handles, outgoing, incoming };
};

export const actions: Actions = {
	vouch: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { message: 'not signed in' });
		const data = await request.formData();
		const github = String(data.get('github') ?? '');
		const level = Number(data.get('level') ?? 0);
		if (!github.trim()) return fail(400, { message: 'GitHub username required' });
		const rl = await checkRateLimit(`vouch:${locals.user.id}`, LIMITS.vouch);
		if (!rl.allowed) {
			return fail(429, { message: `Too many vouches — try again in ${rl.retryAfterSec}s` });
		}
		try {
			const res = await createVouch({ voucherId: locals.user.id, githubUsername: github, level });
			// Announce to Discord (best-effort; a notify failure must not fail the
			// vouch that already committed). locals.user carries no handle, so resolve
			// the voucher's github login for the message.
			try {
				const [vh] = await sql<{ value: string }[]>`
					select value from handles where identity_id = ${locals.user.id} and kind = 'github' limit 1`;
				await notifyVouch({
					voucher: vh?.value ?? 'someone',
					subject: res.username,
					levelName: capLevel(levelInfo(res.level).name)
				});
			} catch (e) {
				console.error('vouch Discord notify failed:', e);
			}
			return {
				success: true,
				message: `Added @${res.username} to your trust graph — ${capLevel(levelInfo(res.level).name)}`
			};
		} catch (e) {
			return fail(400, { message: e instanceof Error ? e.message : 'vouch failed' });
		}
	},
	revoke: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { message: 'not signed in' });
		const data = await request.formData();
		const subjectId = String(data.get('subjectId') ?? '').trim();
		if (!subjectId) return fail(400, { message: 'invalid vouch' });
		try {
			const res = await revokeVouch({ voucherId: locals.user.id, subjectId });
			if (!res.revoked) return fail(400, { message: 'vouch not found or already removed' });
			const [handle] = await sql<{ value: string }[]>`
				select value from handles where identity_id = ${subjectId} and kind = 'github' limit 1`;
			const who = handle ? `@${handle.value}` : 'that person';
			return {
				success: true,
				message: `Removed ${who} from your trust graph — roots won't reflect this until recomputed`
			};
		} catch (e) {
			return fail(400, { message: e instanceof Error ? e.message : 'revoke failed' });
		}
	},
	deleteAccount: async (event) => {
		const { locals } = event;
		if (!locals.user) return fail(401, { message: 'not signed in' });
		await deleteAccount(locals.user.id);
		// The session row is already gone (cascade); just clear the browser cookie.
		deleteSessionCookie(event);
		redirect(302, '/');
	}
};
