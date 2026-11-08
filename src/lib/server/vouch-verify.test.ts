/// <reference types="bun" />
import { test, expect } from 'bun:test';
import { generateKeyPairSync, sign, type KeyObject } from 'node:crypto';
import { canonicalVouch, verifyVouch } from './vouch-signature';

// A fresh ed25519 keypair, exported the way identity.ts mints them: public key as
// SPKI DER (what we store + what verifyVouch consumes), private key as a KeyObject
// for signing in-test.
function keypair(): { pub: Buffer; priv: KeyObject } {
	const { publicKey, privateKey } = generateKeyPairSync('ed25519');
	return { pub: publicKey.export({ type: 'spki', format: 'der' }) as Buffer, priv: privateKey };
}

test('a correctly signed vouch verifies', () => {
	const { pub, priv } = keypair();
	const sig = sign(null, canonicalVouch('voucher-id', 'subject-id', 3), priv);
	expect(verifyVouch(pub, 'voucher-id', 'subject-id', 3, sig)).toBe(true);
});

test('tampering with level, voucher, or subject breaks verification', () => {
	const { pub, priv } = keypair();
	const sig = sign(null, canonicalVouch('A', 'B', 1), priv);
	expect(verifyVouch(pub, 'A', 'B', 2, sig)).toBe(false); // level bumped
	expect(verifyVouch(pub, 'X', 'B', 1, sig)).toBe(false); // voucher swapped
	expect(verifyVouch(pub, 'A', 'Y', 1, sig)).toBe(false); // subject swapped
});

test('a signature made by a different key is rejected', () => {
	const a = keypair();
	const b = keypair();
	const sig = sign(null, canonicalVouch('A', 'B', 2), a.priv);
	expect(verifyVouch(b.pub, 'A', 'B', 2, sig)).toBe(false);
});

test('missing key, missing signature, or garbage is rejected — never thrown', () => {
	const { pub, priv } = keypair();
	const sig = sign(null, canonicalVouch('A', 'B', 2), priv);
	expect(verifyVouch(null, 'A', 'B', 2, sig)).toBe(false);
	expect(verifyVouch(pub, 'A', 'B', 2, null)).toBe(false);
	expect(verifyVouch(pub, 'A', 'B', 2, Buffer.from('not a signature'))).toBe(false);
	expect(verifyVouch(Buffer.from('not a key'), 'A', 'B', 2, sig)).toBe(false);
});
