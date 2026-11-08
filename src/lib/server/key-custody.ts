import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';

// App-level envelope encryption for the identity signing keys (S1). The threat
// (per the security brief) is DB read access: with plaintext keys, anyone who can
// read `identities.private_key` forges vouches as anyone. We encrypt each private
// key under a per-row data key (DEK), and wrap that DEK under a master key that
// lives ONLY in the runtime env (Vercel), never in the database. A DB read alone
// then yields ciphertext.
//
// This module is PURE (no $env) so the crypto is unit-tested directly; the
// env-aware wrapper is key-custody-server.ts.
//
// Stored format (utf-8 text, kept in the existing bytea column):
//   v1:<base64(iv|tag|wrappedDEK)>:<base64(iv|tag|ciphertext)>
// Both segments are AES-256-GCM blobs laid out as iv(12) | tag(16) | body.
// The version prefix lets us detect legacy plaintext rows and rotate schemes.

const VERSION = 'v1';
const IV_LEN = 12;
const TAG_LEN = 16;

// Parse + validate the master key from its raw env string (base64, 32 bytes).
// Throws loud if absent or wrong size — sealing/opening a signing key with a bad
// master key is never something to paper over.
export function masterKeyFromEnv(raw: string | undefined): Buffer {
	if (!raw) {
		throw new Error(
			'KEY_ENCRYPTION_KEY is not set — required to seal/open identity signing keys (see .env.example)'
		);
	}
	const key = Buffer.from(raw, 'base64');
	if (key.length !== 32) {
		throw new Error(`KEY_ENCRYPTION_KEY must be 32 bytes base64 — got ${key.length}`);
	}
	return key;
}

function gcmEncrypt(key: Buffer, plaintext: Buffer): Buffer {
	const iv = randomBytes(IV_LEN);
	const cipher = createCipheriv('aes-256-gcm', key, iv);
	const body = Buffer.concat([cipher.update(plaintext), cipher.final()]);
	return Buffer.concat([iv, cipher.getAuthTag(), body]);
}

function gcmDecrypt(key: Buffer, blob: Buffer): Buffer {
	const iv = blob.subarray(0, IV_LEN);
	const tag = blob.subarray(IV_LEN, IV_LEN + TAG_LEN);
	const body = blob.subarray(IV_LEN + TAG_LEN);
	const decipher = createDecipheriv('aes-256-gcm', key, iv);
	decipher.setAuthTag(tag);
	return Buffer.concat([decipher.update(body), decipher.final()]);
}

// Seal a plaintext private key: random DEK encrypts the key, master key wraps the
// DEK. Returns the versioned string for storage.
export function seal(masterKey: Buffer, plaintext: Buffer): string {
	const dek = randomBytes(32);
	const wrapped = gcmEncrypt(masterKey, dek);
	const data = gcmEncrypt(dek, plaintext);
	return `${VERSION}:${wrapped.toString('base64')}:${data.toString('base64')}`;
}

// Open a sealed key. Throws on a bad master key, tampered blob (GCM auth fail), or
// unknown version — an unopenable signing key is a hard error, not a fallback.
export function open(masterKey: Buffer, stored: string): Buffer {
	const parts = stored.split(':');
	if (parts.length !== 3 || parts[0] !== VERSION) {
		throw new Error(`unrecognized sealed-key format (version "${parts[0]}")`);
	}
	const dek = gcmDecrypt(masterKey, Buffer.from(parts[1], 'base64'));
	return gcmDecrypt(dek, Buffer.from(parts[2], 'base64'));
}

// True if a stored value is one of our sealed blobs (vs a legacy plaintext DER key
// from before encryption landed). Used during the backfill transition.
export function looksEncrypted(stored: string): boolean {
	return stored.startsWith(`${VERSION}:`);
}
