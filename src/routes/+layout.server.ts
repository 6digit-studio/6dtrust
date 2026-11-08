import type { LayoutServerLoad } from './$types';
import { sql } from '$lib/server/db';

// Auth state for the nav, on every page. The primary GitHub handle (if any) is
// the human-readable identity shown in the chrome; the raw identity id is the
// fallback for a just-claimed account that hasn't bound a handle yet.
export const load: LayoutServerLoad = async ({ locals }) => {
	if (!locals.user) return { user: null, github: null };
	const [row] = await sql<{ value: string }[]>`
		select value from handles
		where identity_id = ${locals.user.id} and kind = 'github'
		order by verified desc limit 1`;
	return { user: locals.user, github: row?.value ?? null };
};
