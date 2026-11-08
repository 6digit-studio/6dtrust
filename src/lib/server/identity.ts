import { generateKeyPairSync } from 'node:crypto';
import type postgres from 'postgres';
import { env } from '$env/dynamic/private';
import { sql } from './db';
import { sealPrivateKey } from './key-custody-server';
import { recomputeRoot } from './trust/worker';

// postgres.js hands begin() a scoped transaction client.
type Tx = postgres.TransactionSql<Record<string, never>>;

// Bootstrap admins: GitHub logins listed in ADMIN_GITHUB_HANDLES (comma-separated)
// are promoted to is_admin on login. Config is the source of truth — admin status
// survives a DB reset and needs no manual prod-DB write — and it stays in sync:
// in the list => admin, out of it => demoted on next login. Read at call time (not
// module load) so a runtime env change is picked up without a redeploy of code.
function adminHandleSet(): Set<string> {
	return new Set(
		(env.ADMIN_GITHUB_HANDLES ?? '')
			.split(',')
			.map((h) => h.trim().toLowerCase())
			.filter(Boolean)
	);
}

// Latent keypair (ed25519). public_key (spki DER) verifies vouches; private_key
// is server-custodied but SEALED before it ever touches the DB — sealPrivateKey
// envelope-encrypts it under the env master key, so the stored bytea is
// ciphertext, not the raw key (S1). The signing path opens it via
// openStoredPrivateKey.
function newKeypair(): { publicKey: Buffer; privateKey: Buffer } {
	const { publicKey, privateKey } = generateKeyPairSync('ed25519');
	return {
		publicKey: publicKey.export({ type: 'spki', format: 'der' }) as Buffer,
		privateKey: sealPrivateKey(privateKey.export({ type: 'pkcs8', format: 'der' }) as Buffer)
	};
}

async function attachEmail(tx: Tx, identityId: string, email: string | null): Promise<void> {
	if (!email) return;
	const value = email.toLowerCase();
	const existing = await tx`select 1 from handles where kind = 'email' and value = ${value} limit 1`;
	// don't steal an email already bound to another identity (no auto-merge in v1)
	if (existing.length === 0) {
		await tx`insert into handles (identity_id, kind, value, verified, verified_at)
		         values (${identityId}, 'email', ${value}, true, now())`;
	}
}

/**
 * Resolve a GitHub login to an identity id, creating/claiming as needed.
 * - stable match on GitHub numeric account id (survives username renames)
 * - else claim a dangling/unclaimed github handle someone already vouched for
 * - else mint a fresh claimed identity
 */
export async function upsertGithubIdentity(params: {
	githubId: string;
	username: string;
	email: string | null;
}): Promise<{ identityId: string; isNew: boolean }> {
	const username = params.username.toLowerCase();
	const { githubId, email } = params;
	const isAdmin = adminHandleSet().has(username);

	return await sql.begin(async (tx: Tx) => {
		// Sync admin status from the env list on every login, regardless of which
		// resolution path minted/claimed the identity. Runs after claim so it
		// applies to already-claimed identities too (the claim update is guarded to
		// status='unclaimed'; this is not).
		const finalize = async (identityId: string): Promise<string> => {
			await tx`update identities set is_admin = ${isAdmin} where id = ${identityId}`;
			// Auto-claim: the first seed of an unclaimed (owner-less) community root to
			// sign in silently becomes its owner. Guarded to owner_id IS NULL, so it
			// fires exactly once per root — first-seed-wins — and is a no-op on every
			// later login (theirs or another seed's). The seed claimed it by showing
			// up; the change is recorded in root_owner_events (actor = the new owner).
			const claimed = await tx<{ id: string }[]>`
				update roots set owner_id = ${identityId}
				where owner_id is null
				  and id in (select root_id from root_seeds where identity_id = ${identityId})
				returning id`;
			for (const r of claimed) {
				await tx`insert into root_owner_events (root_id, old_owner_id, new_owner_id, actor_id)
				         values (${r.id}, null, ${identityId}, ${identityId})`;
			}
			return identityId;
		};
		// 1. stable match by github account id. The handle may be a dangling one
		//    bound at vouch time (verified=false, identity still 'unclaimed') — in
		//    which case first login claims it and mints the keypair.
		const byAccount = await tx<{ identity_id: string }[]>`
			select identity_id from handles
			where kind = 'github' and provider_account_id = ${githubId}
			limit 1`;
		if (byAccount.length > 0) {
			const identityId = byAccount[0].identity_id;
			await tx`update handles set value = ${username}, verified = true, verified_at = now()
			         where kind = 'github' and provider_account_id = ${githubId}`;
			// claim + key only if still unclaimed (the guarded update is a no-op
			// for an already-claimed identity, preserving its existing keypair).
			// A row affected here means this login just claimed a dangling identity
			// for the first time — a genuine new signup; zero rows is a returning user.
			const kp = newKeypair();
			const claim = await tx`update identities
			         set status = 'claimed', claimed_at = now(),
			             public_key = ${kp.publicKey}, private_key = ${kp.privateKey}
			         where id = ${identityId} and status = 'unclaimed'`;
			await attachEmail(tx, identityId, email);
			return { identityId: await finalize(identityId), isNew: claim.count > 0 };
		}

		// 2. match by username — a dangling handle someone vouched for, or none
		const byName = await tx<
			{ id: string; identity_id: string; provider_account_id: string | null }[]
		>`select id, identity_id, provider_account_id from handles
		  where kind = 'github' and value = ${username}
		  limit 1`;
		if (byName.length > 0) {
			const h = byName[0];
			if (h.provider_account_id && h.provider_account_id !== githubId) {
				// GitHub reassigned this username to a different account.
				// Fail loudly rather than bind a login to the wrong identity.
				throw new Error(
					`github username "${username}" is bound to a different account id; manual resolution required`
				);
			}
			const kp = newKeypair();
			await tx`update handles
			         set provider_account_id = ${githubId}, verified = true, verified_at = now()
			         where id = ${h.id}`;
			await tx`update identities
			         set status = 'claimed', claimed_at = now(),
			             public_key = ${kp.publicKey}, private_key = ${kp.privateKey}
			         where id = ${h.identity_id} and status = 'unclaimed'`;
			await attachEmail(tx, h.identity_id, email);
			// claiming a dangling handle someone vouched for = first sign-in = new.
			return { identityId: await finalize(h.identity_id), isNew: true };
		}

		// 3. brand new identity
		const kp = newKeypair();
		const [{ id: identityId }] = await tx<{ id: string }[]>`
			insert into identities (status, claimed_at, public_key, private_key)
			values ('claimed', now(), ${kp.publicKey}, ${kp.privateKey})
			returning id`;
		await tx`insert into handles (identity_id, kind, value, verified, verified_at, provider_account_id)
		         values (${identityId}, 'github', ${username}, true, now(), ${githubId})`;
		await attachEmail(tx, identityId, email);
		return { identityId: await finalize(identityId), isNew: true };
	});
}

// Hard-delete an account. The FK graph does the heavy lifting: handles, vouches
// (both directions), seed memberships, accept-set rows, sessions, faucets and
// inbox entries CASCADE; owned roots' owner_id and audit actor_ids are SET NULL —
// an owned root reverts to unclaimed (claimable again, consistent with the
// community-root model), and governance history is kept with attribution erased,
// because the person is genuinely gone. The one thing the FKs can't do is fix the
// trust graph: the deleted account's edges and seed slots were inputs to every
// root's max-flow, so accept_sets are stale until recomputed.
export async function deleteAccount(identityId: string): Promise<{ rootsRecomputed: number }> {
	await sql.begin(async (tx: Tx) => {
		const [row] = await tx<{ id: string }[]>`select id from identities where id = ${identityId}`;
		if (!row) throw new Error('account not found');
		await tx`delete from identities where id = ${identityId}`;
	});
	// Recompute every root so accept_sets reflect the removed edges/seeds. Cheap at
	// current scale; belongs in the batch worker once the graph is large (same
	// placeholder posture as the inline owned-root recompute).
	const roots = await sql<{ id: string }[]>`select id from roots`;
	let rootsRecomputed = 0;
	for (const r of roots) {
		try {
			await recomputeRoot(sql, r.id);
			rootsRecomputed++;
		} catch {
			// roots with no resolvable seeds throw — not this operation's concern
		}
	}
	return { rootsRecomputed };
}
