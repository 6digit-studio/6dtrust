import type postgres from 'postgres';
import { sql } from './db';
import {
	GITHUB_USERNAME_RE,
	normalizeGithub,
	prefetchUnknownGithub,
	resolveGithubIdentity
} from './resolve';
import { wouldUpgrade } from './vouch-rules';
import { signVouchPayload } from './vouch-signature';
import { openStoredPrivateKey } from './key-custody-server';

type Tx = postgres.TransactionSql<Record<string, never>>;

// Sign the canonical (voucher, subject, level) tuple with the voucher's
// server-custodied key. Shared by createVouch (set exact level) and upgradeVouch
// (raise-only) so both paths produce identical signatures. The canonical-payload
// and crypto live in vouch-signature.ts (pure, unit-tested); the worker verifies
// these on read before honoring an edge.
async function signVouch(
	tx: Tx,
	voucherId: string,
	subjectId: string,
	level: number
): Promise<Buffer> {
	const [voucher] = await tx<{ private_key: Buffer | null }[]>`
		select private_key from identities where id = ${voucherId}`;
	if (!voucher?.private_key) throw new Error('voucher has no signing key');
	const der = openStoredPrivateKey(voucher.private_key);
	return signVouchPayload(der, voucherId, subjectId, level);
}

export async function createVouch(params: {
	voucherId: string;
	githubUsername: string;
	level: number;
}): Promise<{ subjectId: string; username: string; level: number }> {
	const { voucherId, level } = params;
	if (![1, 2, 3].includes(level)) throw new Error('invalid level');
	const username = normalizeGithub(params.githubUsername);
	if (!GITHUB_USERNAME_RE.test(username)) throw new Error('invalid GitHub username');

	// If we don't already know this handle, verify it exists on GitHub and grab
	// the stable account id — OUTSIDE the transaction (it's a network call).
	const github = await prefetchUnknownGithub(username);

	return await sql.begin(async (tx: Tx) => {
		const subjectId = await resolveGithubIdentity(tx, username, github);
		if (subjectId === voucherId) throw new Error('you cannot vouch for yourself');

		const signature = await signVouch(tx, voucherId, subjectId, level);

		// Changing level = revoke + new row (0001_init.sql's own design comment).
		// The previous in-place UPDATE destroyed level-change history — and the
		// historical record (Advogato, 2000-2012) says 67.5% of re-certifications
		// are demotions: the majority signal of a living web is exactly what an
		// in-place write erases.
		const existing = await tx<{ id: string }[]>`
			select id from vouches
			where voucher_id = ${voucherId} and subject_id = ${subjectId} and revoked_at is null
			limit 1`;
		if (existing.length > 0) {
			await tx`update vouches set revoked_at = now() where id = ${existing[0].id}`;
		}
		await tx`insert into vouches (voucher_id, subject_id, level, signature)
		         values (${voucherId}, ${subjectId}, ${level}, ${signature})`;
		return { subjectId, username, level };
	});
}

// Raise a vouch to AT LEAST `level`, never lower it — the path for inbox actions
// and one-click profile vouches, where re-acting on a suggestion must not
// downgrade someone already certified higher. No-op (changed: false) when the
// active vouch already meets or exceeds the target. A demotion is only ever an
// explicit createVouch (the picker) or revokeVouch.
export async function upgradeVouch(params: {
	voucherId: string;
	githubUsername: string;
	level: number;
}): Promise<{ subjectId: string; username: string; level: number; changed: boolean }> {
	const { voucherId, level } = params;
	if (![1, 2, 3].includes(level)) throw new Error('invalid level');
	const username = normalizeGithub(params.githubUsername);
	if (!GITHUB_USERNAME_RE.test(username)) throw new Error('invalid GitHub username');

	const github = await prefetchUnknownGithub(username);

	return await sql.begin(async (tx: Tx) => {
		const subjectId = await resolveGithubIdentity(tx, username, github);
		if (subjectId === voucherId) throw new Error('you cannot vouch for yourself');

		const [existing] = await tx<{ id: string; level: number }[]>`
			select id, level from vouches
			where voucher_id = ${voucherId} and subject_id = ${subjectId} and revoked_at is null
			limit 1`;
		if (existing && !wouldUpgrade(existing.level, level)) {
			return { subjectId, username, level: existing.level, changed: false };
		}

		const signature = await signVouch(tx, voucherId, subjectId, level);
		// Same revoke+insert as createVouch so level-change history is preserved;
		// we only reach here with no active vouch or a strictly lower one.
		if (existing) {
			await tx`update vouches set revoked_at = now() where id = ${existing.id}`;
		}
		await tx`insert into vouches (voucher_id, subject_id, level, signature)
		         values (${voucherId}, ${subjectId}, ${level}, ${signature})`;
		return { subjectId, username, level, changed: true };
	});
}

// Revoke without replacement — the missing half of the vouch lifecycle
// (revoked_at existed since 0001 but no code path ever wrote it).
export async function revokeVouch(params: {
	voucherId: string;
	subjectId: string;
}): Promise<{ revoked: boolean }> {
	const rows = await sql<{ id: string }[]>`
		update vouches set revoked_at = now()
		where voucher_id = ${params.voucherId} and subject_id = ${params.subjectId}
		  and revoked_at is null
		returning id`;
	return { revoked: rows.length > 0 };
}
