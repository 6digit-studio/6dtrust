import { env } from '$env/dynamic/private';
import { seal, open, looksEncrypted, masterKeyFromEnv } from './key-custody';

// Env-aware wrapper over the pure key-custody core. Reads KEY_ENCRYPTION_KEY at
// call time (so a runtime env change is picked up without a code redeploy, like
// ADMIN_GITHUB_HANDLES). Server-only.

// Seal a freshly-minted private key for storage in the bytea column (as utf-8).
export function sealPrivateKey(der: Buffer): Buffer {
	return Buffer.from(seal(masterKeyFromEnv(env.KEY_ENCRYPTION_KEY), der), 'utf8');
}

// Recover a stored private key's raw DER bytes. Handles the backfill transition:
// a legacy plaintext row (raw DER, not our sealed format) is returned as-is with a
// loud warning so it's visible until `bun scripts/encrypt-keys.ts` seals it.
export function openStoredPrivateKey(stored: Buffer): Buffer {
	const s = stored.toString('utf8');
	if (!looksEncrypted(s)) {
		console.warn(
			'[key-custody] read a LEGACY PLAINTEXT private_key — run `bun scripts/encrypt-keys.ts` to seal it'
		);
		return stored;
	}
	return open(masterKeyFromEnv(env.KEY_ENCRYPTION_KEY), s);
}
