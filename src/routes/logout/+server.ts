import { redirect } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { invalidateSession, deleteSessionCookie } from '$lib/server/session';

export async function POST(event: RequestEvent): Promise<never> {
	if (event.locals.session) {
		await invalidateSession(event.locals.session.id);
	}
	deleteSessionCookie(event);
	redirect(302, '/');
}
