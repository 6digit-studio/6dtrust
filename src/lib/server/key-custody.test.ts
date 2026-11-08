/// <reference types="bun" />
import { test, expect } from 'bun:test';
import { randomBytes } from 'node:crypto';
import { seal, open, looksEncrypted, masterKeyFromEnv } from './key-custody';

const master = randomBytes(32);

test('seal then open round-trips the exact bytes', () => {
	const secret = randomBytes(85); // ~pkcs8 ed25519 DER size
	const stored = seal(master, secret);
	expect(looksEncrypted(stored)).toBe(true);
	expect(open(master, stored).equals(secret)).toBe(true);
});

test('two seals of the same plaintext differ (random DEK + IV)', () => {
	const secret = Buffer.from('the-same-key');
	expect(seal(master, secret)).not.toBe(seal(master, secret));
});

test('opening with the wrong master key throws (GCM auth fail)', () => {
	const stored = seal(master, randomBytes(48));
	expect(() => open(randomBytes(32), stored)).toThrow();
});

test('tampering with the ciphertext throws', () => {
	const stored = seal(master, randomBytes(48));
	const parts = stored.split(':');
	const data = Buffer.from(parts[2], 'base64');
	data[data.length - 1] ^= 0xff; // flip a byte in the body/tag region
	const tampered = `${parts[0]}:${parts[1]}:${data.toString('base64')}`;
	expect(() => open(master, tampered)).toThrow();
});

test('looksEncrypted distinguishes sealed blobs from legacy plaintext', () => {
	expect(looksEncrypted(seal(master, Buffer.from('x')))).toBe(true);
	expect(looksEncrypted('raw-der-bytes-as-string')).toBe(false);
});

test('masterKeyFromEnv validates presence and 32-byte length', () => {
	expect(() => masterKeyFromEnv(undefined)).toThrow();
	expect(() => masterKeyFromEnv(Buffer.alloc(16).toString('base64'))).toThrow();
	expect(masterKeyFromEnv(master.toString('base64')).equals(master)).toBe(true);
});
