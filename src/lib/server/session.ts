import { randomBytes, createHash } from 'node:crypto';
import type { RequestEvent } from '@sveltejs/kit';
import { sql } from './db';
import type { SessionUser } from '$lib/types/user';

export type { SessionUser };
export type Session = { id: string; identityId: string; expiresAt: Date };

const DAY_MS = 86_400_000;
const SESSION_TTL = 30 * DAY_MS;

export function generateSessionToken(): string {
	return randomBytes(24).toString('base64url');
}

function hashToken(token: string): string {
	return createHash('sha256').update(token).digest('hex');
}

export async function createSession(token: string, identityId: string): Promise<Session> {
	const id = hashToken(token);
	const expiresAt = new Date(Date.now() + SESSION_TTL);
	await sql`insert into sessions (id, identity_id, expires_at)
	          values (${id}, ${identityId}, ${expiresAt})`;
	return { id, identityId, expiresAt };
}

export async function validateSessionToken(
	token: string
): Promise<{ session: Session | null; user: SessionUser | null }> {
	const id = hashToken(token);
	const rows = await sql<
		{ id: string; identity_id: string; expires_at: Date; status: string; is_admin: boolean }[]
	>`select s.id, s.identity_id, s.expires_at, i.status, i.is_admin
	  from sessions s join identities i on i.id = s.identity_id
	  where s.id = ${id}`;
	if (rows.length === 0) return { session: null, user: null };
	const r = rows[0];
	const expiresAt = new Date(r.expires_at);
	// expired -> delete and reject
	if (Date.now() >= expiresAt.getTime()) {
		await sql`delete from sessions where id = ${id}`;
		return { session: null, user: null };
	}
	// sliding expiration: extend when inside the last half of the TTL
	let exp = expiresAt;
	if (Date.now() >= expiresAt.getTime() - SESSION_TTL / 2) {
		exp = new Date(Date.now() + SESSION_TTL);
		await sql`update sessions set expires_at = ${exp} where id = ${id}`;
	}
	return {
		session: { id: r.id, identityId: r.identity_id, expiresAt: exp },
		user: { id: r.identity_id, status: r.status, isAdmin: r.is_admin }
	};
}

export async function invalidateSession(id: string): Promise<void> {
	await sql`delete from sessions where id = ${id}`;
}

// Drop every existing session for an identity. Called on fresh OAuth login so a
// stolen/leaked session token can't outlive a re-authentication (S9). Tradeoff:
// logging in establishes a single active session, so other devices are signed
// out — acceptable for a trust-custody app.
export async function invalidateUserSessions(identityId: string): Promise<void> {
	await sql`delete from sessions where identity_id = ${identityId}`;
}

export function setSessionCookie(event: RequestEvent, token: string, expiresAt: Date): void {
	event.cookies.set('session', token, {
		httpOnly: true,
		sameSite: 'lax',
		expires: expiresAt,
		path: '/'
	});
}

export function deleteSessionCookie(event: RequestEvent): void {
	event.cookies.set('session', '', { httpOnly: true, sameSite: 'lax', maxAge: 0, path: '/' });
}
