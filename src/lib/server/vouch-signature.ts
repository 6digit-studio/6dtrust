import { createPrivateKey, createPublicKey, sign, verify } from 'node:crypto';

// Pure ed25519 vouch-signature logic — no DB, no $env — so it's unit-testable and
// shared by the write path (vouch.ts signs) and the read/compute path (worker.ts
// verifies before honoring an edge).
//
// The signed statement is over the stable (voucher, subject, level) tuple, so a
// re-vouch at a new level produces a new signature; storage timestamp and
// revocation state are NOT signed (see the synthesis S2/UNVERIFIED note — moving
// to signed immutable events is the follow-up).

export function canonicalVouch(voucher: string, subject: string, level: number): Buffer {
	return Buffer.from(JSON.stringify({ t: 'vouch', v: 1, voucher, subject, level }));
}

// Sign the canonical tuple with a pkcs8/DER ed25519 private key (as stored in
// identities.private_key). Throws if the key can't be parsed — a signing-time
// failure is a real bug, not a verdict, so it stays loud.
export function signVouchPayload(
	privateKeyDer: Buffer,
	voucher: string,
	subject: string,
	level: number
): Buffer {
	const key = createPrivateKey({ key: Buffer.from(privateKeyDer), format: 'der', type: 'pkcs8' });
	return sign(null, canonicalVouch(voucher, subject, level), key);
}

// Verify a stored signature against the voucher's spki/DER public key. Returns a
// boolean verdict — a null key/sig, a malformed key, or a bad signature are all
// "this edge is not authentic", never an exception. The caller (worker) counts
// and logs rejects loudly; it must NOT honor an edge that fails here.
export function verifyVouch(
	publicKeyDer: Buffer | Uint8Array | null,
	voucher: string,
	subject: string,
	level: number,
	signature: Buffer | Uint8Array | null
): boolean {
	if (!publicKeyDer || !signature) return false;
	try {
		const key = createPublicKey({ key: Buffer.from(publicKeyDer), format: 'der', type: 'spki' });
		return verify(null, canonicalVouch(voucher, subject, level), key, Buffer.from(signature));
	} catch {
		return false;
	}
}
