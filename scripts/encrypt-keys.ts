#!/usr/bin/env bun
/**
 * One-time backfill: seal any legacy PLAINTEXT identity private keys (S1).
 *
 * Before this, `identities.private_key` held raw pkcs8 DER. After the key-custody
 * change, new keys are sealed (envelope-encrypted) on write. This script seals the
 * rows that predate that change — idempotent: rows already in `v1:` form are
 * skipped, so re-running is safe.
 *
 * Standalone (does NOT import $lib/server/db — that needs the SvelteKit runtime).
 * Reads DATABASE_URL and KEY_ENCRYPTION_KEY from the environment (bun auto-loads
 * .env). The master key MUST match the one set in the app's runtime env, or the
 * sealed keys won't open.
 *
 *   bun scripts/encrypt-keys.ts          seal all legacy rows
 *   bun scripts/encrypt-keys.ts --dry    report counts, change nothing
 *
 * This mutates production trust data — run it deliberately, with the prod
 * DATABASE_URL and the prod KEY_ENCRYPTION_KEY, after deploying the code.
 */
import postgres from 'postgres';
import { seal, looksEncrypted, masterKeyFromEnv } from '../src/lib/server/key-custody';

const dry = process.argv.includes('--dry');

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');
const master = masterKeyFromEnv(process.env.KEY_ENCRYPTION_KEY);

const sql = postgres(url, { max: 1, prepare: false });

try {
	const rows = await sql<{ id: string; private_key: Buffer | null }[]>`
		select id, private_key from identities where private_key is not null`;

	let sealed = 0;
	let already = 0;
	for (const r of rows) {
		if (!r.private_key) continue;
		const s = r.private_key.toString('utf8');
		if (looksEncrypted(s)) {
			already++;
			continue;
		}
		// legacy raw DER → seal it
		if (!dry) {
			const blob = Buffer.from(seal(master, r.private_key), 'utf8');
			await sql`update identities set private_key = ${blob} where id = ${r.id}`;
		}
		sealed++;
	}

	console.log(
		`${dry ? '[dry] would seal' : 'sealed'} ${sealed} legacy key(s); ${already} already sealed; ${rows.length} total.`
	);
} finally {
	await sql.end();
}
