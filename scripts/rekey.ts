#!/usr/bin/env bun
/**
 * Disaster recovery: re-key every identity and re-sign every vouch.
 *
 * Use this if KEY_ENCRYPTION_KEY is ever lost. The sealed identities.private_key
 * columns then become un-openable, so the app can no longer SIGN new vouches for
 * existing identities. But the keys are latent / server-custodial — users never
 * hold them; identity is anchored by GitHub OAuth — so recovery is entirely
 * server-side and lossless for users:
 *
 *   1. Mint a fresh ed25519 keypair for every identity that has one.
 *   2. Re-sign every vouch from its (voucher_id, subject_id, level) tuple — all of
 *      which lives in the vouches table — with the voucher's NEW private key.
 *
 * The edges as DATA (voucher, subject, level) are plaintext and were never at
 * risk; only their cryptographic attestations (signatures) and the keypairs need
 * regenerating. The regenerated public keys differ from the old ones, which only
 * matters if anything external ever pinned/published them.
 *
 * Procedure: set a FRESH KEY_ENCRYPTION_KEY in the app's runtime env first (the
 * old one is lost), redeploy, THEN run this with that same key so the new sealed
 * keys open in the app.
 *
 *   DATABASE_URL=... KEY_ENCRYPTION_KEY=... bun scripts/rekey.ts         re-key + re-sign
 *   DATABASE_URL=... KEY_ENCRYPTION_KEY=... bun scripts/rekey.ts --dry   report, change nothing
 *
 * Mutates production trust data, in ONE transaction: either the whole graph is
 * re-keyed and re-signed, or nothing changes. Standalone (no SvelteKit runtime):
 * mirrors newKeypair() in identity.ts and signVouchPayload() in vouch-signature.ts.
 */
import { generateKeyPairSync } from 'node:crypto';
import postgres from 'postgres';
import { seal, masterKeyFromEnv } from '../src/lib/server/key-custody';
import { signVouchPayload } from '../src/lib/server/vouch-signature';

const dry = process.argv.includes('--dry');

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');
const master = masterKeyFromEnv(process.env.KEY_ENCRYPTION_KEY);

const sql = postgres(url, { max: 1, prepare: false });

// Same shape as identity.ts#newKeypair, but returns the unsealed private DER too
// so we can re-sign this identity's vouches before sealing it for storage.
function freshKeypair(): { publicKey: Buffer; privateDer: Buffer } {
	const { publicKey, privateKey } = generateKeyPairSync('ed25519');
	return {
		publicKey: publicKey.export({ type: 'spki', format: 'der' }) as Buffer,
		privateDer: privateKey.export({ type: 'pkcs8', format: 'der' }) as Buffer
	};
}

try {
	await sql.begin(async (tx) => {
		// Only identities that actually hold a keypair (claimed signers). Unclaimed
		// off-graph stubs have no key and never vouch, so they're untouched.
		const identities = await tx<{ id: string }[]>`
			select id from identities where private_key is not null`;

		// id -> fresh unsealed private DER, kept in memory only to re-sign this run.
		const newPriv = new Map<string, Buffer>();
		for (const { id } of identities) {
			const kp = freshKeypair();
			newPriv.set(id, kp.privateDer);
			if (!dry) {
				await tx`
					update identities
					set public_key = ${kp.publicKey},
					    private_key = ${Buffer.from(seal(master, kp.privateDer), 'utf8')}
					where id = ${id}`;
			}
		}

		// Re-sign every vouch with its voucher's new key. A voucher is always a
		// claimed identity, so it must be in newPriv; an orphan means a vouch whose
		// voucher lost its key — a data-integrity surprise we surface loudly rather
		// than silently skip.
		const vouches = await tx<
			{ id: string; voucher_id: string; subject_id: string; level: number }[]
		>`select id, voucher_id, subject_id, level from vouches`;

		let resigned = 0;
		const orphans: string[] = [];
		for (const v of vouches) {
			const priv = newPriv.get(v.voucher_id);
			if (!priv) {
				orphans.push(v.id);
				continue;
			}
			const sig = signVouchPayload(priv, v.voucher_id, v.subject_id, v.level);
			if (!dry) {
				await tx`update vouches set signature = ${sig} where id = ${v.id}`;
			}
			resigned++;
		}

		const verb = dry ? '[dry] would re-key' : 're-keyed';
		const verb2 = dry ? 'would re-sign' : 're-signed';
		console.log(
			`${verb} ${identities.length} identit${identities.length === 1 ? 'y' : 'ies'}; ` +
				`${verb2} ${resigned} vouch(es) of ${vouches.length} total.`
		);
		if (orphans.length > 0) {
			console.error(
				`WARNING: ${orphans.length} vouch(es) had a voucher with NO signing key — ` +
					`could not re-sign. Investigate these vouch ids:\n  ${orphans.join('\n  ')}`
			);
		}
	});
} finally {
	await sql.end();
}
