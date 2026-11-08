import { redirect } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { github } from '$lib/server/oauth';
import { upsertGithubIdentity } from '$lib/server/identity';
import { notifySignup } from '$lib/server/discord';
import {
	createSession,
	generateSessionToken,
	invalidateUserSessions,
	setSessionCookie
} from '$lib/server/session';

export async function GET(event: RequestEvent): Promise<Response> {
	const code = event.url.searchParams.get('code');
	const state = event.url.searchParams.get('state');
	const stored = event.cookies.get('github_oauth_state');
	if (!code || !state || !stored || state !== stored) {
		return new Response('Invalid OAuth state', { status: 400 });
	}
	// Single-use the CSRF nonce: clear it now that it's been checked (S14).
	event.cookies.delete('github_oauth_state', { path: '/' });

	let accessToken: string;
	try {
		const tokens = await github.validateAuthorizationCode(code);
		accessToken = tokens.accessToken();
	} catch {
		return new Response('Invalid authorization code', { status: 400 });
	}

	const ghUser = await fetch('https://api.github.com/user', {
		headers: { Authorization: `Bearer ${accessToken}`, 'User-Agent': '6dtrust' }
	}).then((r) => r.json());
	if (!ghUser?.id || !ghUser?.login) {
		return new Response('Could not read GitHub profile', { status: 502 });
	}

	// primary verified email (best effort; requires user:email scope)
	let email: string | null = null;
	try {
		const emails = await fetch('https://api.github.com/user/emails', {
			headers: { Authorization: `Bearer ${accessToken}`, 'User-Agent': '6dtrust' }
		}).then((r) => r.json());
		if (Array.isArray(emails)) {
			email = emails.find((e) => e.primary && e.verified)?.email ?? null;
		}
	} catch {
		// no email scope / fetch failed — fine, github handle is enough
	}

	const { identityId, isNew } = await upsertGithubIdentity({
		githubId: String(ghUser.id),
		username: ghUser.login,
		email
	});

	// Announce genuine first-time signups (best-effort; never blocks login).
	if (isNew) await notifySignup(ghUser.login);

	// Kill any prior sessions for this identity before minting a fresh one, so a
	// leaked token can't survive re-auth (S9).
	await invalidateUserSessions(identityId);
	const token = generateSessionToken();
	const session = await createSession(token, identityId);
	setSessionCookie(event, token, session.expiresAt);

	redirect(302, '/');
}
