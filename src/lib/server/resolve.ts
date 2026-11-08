import type postgres from 'postgres';
import { sql } from './db';
import { lookupGithubUser } from './github';

// Shared handle -> identity resolution. Both vouching and root-seeding need to
// turn a GitHub username into an identity id, creating a pinned dangling
// identity the first time a handle is seen ("vouch-for-handle, resolve-on-claim").
// Keeping it in one place means both paths pin to the REAL account id identically.

type Tx = postgres.TransactionSql<Record<string, never>>;

export function normalizeGithub(input: string): string {
	return input.trim().replace(/^@/, '').toLowerCase();
}

export const GITHUB_USERNAME_RE = /^[a-z0-9-]{1,39}$/;

// Pre-transaction step (a network call, so it must run OUTSIDE sql.begin): if the
// handle isn't already known locally, verify it exists on GitHub and return its
// stable account id. Returns null when the handle is already known (no fetch).
// Throws if GitHub has no such user.
export async function prefetchUnknownGithub(
	username: string
): Promise<{ id: string; login: string } | null> {
	const known = await sql<{ identity_id: string }[]>`
		select identity_id from handles where kind = 'github' and value = ${username} limit 1`;
	if (known.length > 0) return null;
	const github = await lookupGithubUser(username);
	if (!github) throw new Error(`GitHub user "${username}" not found`);
	return github;
}

// In-transaction resolve. If the handle is unknown, `github` carries the
// already-fetched stable account id so the new dangling identity is pinned to the
// REAL account, not a typed string.
export async function resolveGithubIdentity(
	tx: Tx,
	username: string,
	github: { id: string; login: string } | null
): Promise<string> {
	const byName = await tx<{ identity_id: string }[]>`
		select identity_id from handles where kind = 'github' and value = ${username} limit 1`;
	if (byName.length > 0) return byName[0].identity_id;

	// not known locally — must have been resolved against GitHub
	if (!github) throw new Error(`unknown github handle "${username}"`);
	const canonical = github.login.toLowerCase();

	// maybe known under a different (renamed) username — match by stable id
	const byAccount = await tx<{ identity_id: string }[]>`
		select identity_id from handles where kind = 'github' and provider_account_id = ${github.id} limit 1`;
	if (byAccount.length > 0) {
		await tx`update handles set value = ${canonical}
		         where kind = 'github' and provider_account_id = ${github.id}`;
		return byAccount[0].identity_id;
	}

	// brand new dangling/unclaimed identity, pinned to the real account id
	const [{ id }] = await tx<{ id: string }[]>`
		insert into identities (status) values ('unclaimed') returning id`;
	await tx`insert into handles (identity_id, kind, value, verified, provider_account_id)
	         values (${id}, 'github', ${canonical}, false, ${github.id})`;
	return id;
}
