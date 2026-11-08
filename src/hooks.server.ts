import type { Handle, HandleServerError } from '@sveltejs/kit';
import { validateSessionToken, setSessionCookie, deleteSessionCookie } from '$lib/server/session';
import { notifyError } from '$lib/server/discord';

// Transport/sniffing/clickjacking headers applied to every response (S8). HSTS is
// safe because prod is https-only; CSP is configured separately via kit.csp in
// svelte.config.js so SvelteKit can hash its own inline hydration scripts. These
// don't affect cross-origin <img> embedding of badges (X-Frame-Options governs
// framing, not image loads).
const SECURITY_HEADERS: Record<string, string> = {
	'X-Content-Type-Options': 'nosniff',
	'X-Frame-Options': 'DENY',
	'Referrer-Policy': 'strict-origin-when-cross-origin',
	'Strict-Transport-Security': 'max-age=63072000; includeSubDomains'
};

export const handle: Handle = async ({ event, resolve }) => {
	const token = event.cookies.get('session');
	if (!token) {
		event.locals.user = null;
		event.locals.session = null;
	} else {
		const { session, user } = await validateSessionToken(token);
		if (session) {
			setSessionCookie(event, token, session.expiresAt);
		} else {
			deleteSessionCookie(event);
		}
		event.locals.user = user;
		event.locals.session = session;
	}

	const response = await resolve(event);
	for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
		response.headers.set(name, value);
	}
	return response;
};

// Server errors get mirrored to the ops Discord and logged. Only genuine 5xx
// failures page the channel — 404s (unmatched routes, crawler probes, guessed
// URLs like /some-handle) reach handleError too but are NOISE, not incidents, so they
// pass through quietly. We AWAIT the post so it actually delivers on Vercel's
// serverless runtime (an un-awaited promise can be frozen the instant the response
// is sent); notifyError swallows its own failures, so this never masks the error.
export const handleError: HandleServerError = async ({ error, event, status, message }) => {
	if (status < 500) return { message };
	const err = error instanceof Error ? error : new Error(String(error));
	console.error(err);
	await notifyError({
		method: event.request.method,
		path: event.url.pathname,
		message: err.message,
		stack: err.stack
	});
	return { message };
};
