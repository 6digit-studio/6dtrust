import { generateState } from 'arctic';
import { redirect } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { github } from '$lib/server/oauth';

export function GET(event: RequestEvent): never {
	const state = generateState();
	const url = github.createAuthorizationURL(state, ['read:user', 'user:email']);
	event.cookies.set('github_oauth_state', state, {
		httpOnly: true,
		sameSite: 'lax',
		maxAge: 600,
		path: '/'
	});
	redirect(302, url.toString());
}
