import { GitHub } from 'arctic';
import { env } from '$env/dynamic/private';

if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
	throw new Error('GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET are not set — see .env.example');
}

// The OAuth callback must be an absolute URL that EXACTLY matches the callback
// registered in the GitHub OAuth app. Build it from ORIGIN (the canonical public
// origin, e.g. https://your-domain) so prod and preview deploys never disagree on
// the redirect target — derive-from-request would hand GitHub a different URL per
// preview deployment, which it rejects. Falls back to the local dev origin so
// `bun run dev` works with no extra config.
//
// RELEASE: set ORIGIN in Vercel to your real domain, and register
// `<ORIGIN>/login/github/callback` in the GitHub OAuth app — the two must match
// byte-for-byte. See RELEASE-BATON.md.
const origin = (env.ORIGIN || 'http://localhost:5173').replace(/\/$/, '');

export const github = new GitHub(
	env.GITHUB_CLIENT_ID,
	env.GITHUB_CLIENT_SECRET,
	`${origin}/login/github/callback`
);
