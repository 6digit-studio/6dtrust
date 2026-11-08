// Beji standing claims — the ISSUER half.
//
// A claim is a signed, expiring, single-use invitation that carries a trust LEVEL
// to a party who has not registered on Beji yet. It exists because the obvious
// alternative is unsafe: binding a `kind='beji'` handle onto a vouched identity
// BEFORE that handle is registered leaves the standing attached to a public name
// that anyone may claim first. Beji handles are first-come-first-served and
// `/trust/{root}/{handle}` is an open read, so the intended holder could be
// out-registered and left unable to register at all.
//
// The github anchor does not have this weakness, and the contrast is the design:
// a dangling github vouch is pinned to the stable numeric ACCOUNT id
// (`resolve.ts`), so claiming it later means authenticating as that account. The
// name is never the credential. `beji` has no such external account to check
// against, so a claim supplies the missing anchor directly — holding the signed
// claim IS the proof of control.
//
// VERIFIER: `ibeji/convex/claim.ts`. That file is the SPEC for this wire format,
// deliberately — a credential format with two independent implementations is a
// credential format with two opinions about which bytes were signed, and that
// disagreement is the classic way this class of thing fails. Keep them in step;
// `beji-claim.test.ts` pins the encoding against known vectors.

const enc = new TextEncoder();

export const CLAIM_PREFIX = 'bjc1';
export const MAX_CLAIM_LEVEL = 3;

export type BejiClaimPayload = {
	root: string;
	level: number;
	/** `null` is the SAFE default — an unbound claim names no handle, so there is
	 *  no name for anyone to race for. Bind one only to reserve a specific name
	 *  for a holder who already controls it. */
	handle: string | null;
	jti: string;
	iat: number;
	exp: number;
};

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

export function b64uEncode(bytes: Uint8Array<ArrayBufferLike>): string {
	let out = '';
	for (let i = 0; i < bytes.length; i += 3) {
		const a = bytes[i];
		const b = i + 1 < bytes.length ? bytes[i + 1] : undefined;
		const c = i + 2 < bytes.length ? bytes[i + 2] : undefined;
		out += B64[a >> 2];
		out += B64[((a & 3) << 4) | ((b ?? 0) >> 4)];
		if (b === undefined) break;
		out += B64[((b & 15) << 2) | ((c ?? 0) >> 6)];
		if (c === undefined) break;
		out += B64[c & 63];
	}
	return out;
}

export function b64uDecode(s: string): Uint8Array<ArrayBuffer> {
	const bytes: number[] = [];
	let acc = 0;
	let bits = 0;
	for (let i = 0; i < s.length; i++) {
		const v = B64.indexOf(s[i]);
		if (v < 0) throw new Error(`invalid base64url character at ${i}`);
		acc = (acc << 6) | v;
		bits += 6;
		if (bits >= 8) {
			bits -= 8;
			bytes.push((acc >> bits) & 0xff);
		}
	}
	return new Uint8Array(bytes);
}

/** Accept a key pasted in either alphabet, with or without padding. */
function anyB64ToBytes(s: string): Uint8Array<ArrayBuffer> {
	return b64uDecode(s.trim().replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''));
}

/** The exact bytes the signature covers — prefix included, so a payload cannot be
 *  lifted out of a v1 claim and replayed under a later version. */
export function signingInput(payloadB64: string): Uint8Array<ArrayBuffer> {
	return new Uint8Array(enc.encode(`${CLAIM_PREFIX}.${payloadB64}`));
}

export function encodePayload(payload: BejiClaimPayload): string {
	return b64uEncode(new Uint8Array(enc.encode(JSON.stringify(payload))));
}

/** A fresh claim id. Random, not sequential: a guessable jti would let an observer
 *  burn someone else's invitation by redeeming it first. */
export function newJti(): string {
	const b = crypto.getRandomValues(new Uint8Array(16));
	return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

export async function importIssuerPrivateKey(pkcs8B64: string): Promise<CryptoKey> {
	return crypto.subtle.importKey('pkcs8', anyB64ToBytes(pkcs8B64), { name: 'Ed25519' }, false, [
		'sign'
	]);
}

export async function importIssuerPublicKey(spkiB64: string): Promise<CryptoKey> {
	return crypto.subtle.importKey('spki', anyB64ToBytes(spkiB64), { name: 'Ed25519' }, false, [
		'verify'
	]);
}

/** Generate a fresh issuer keypair, exported for storage. */
export async function generateIssuerKeypair(): Promise<{ privateKey: string; publicKey: string }> {
	const kp = (await crypto.subtle.generateKey({ name: 'Ed25519' }, true, [
		'sign',
		'verify'
	])) as CryptoKeyPair;
	return {
		privateKey: b64uEncode(new Uint8Array(await crypto.subtle.exportKey('pkcs8', kp.privateKey))),
		publicKey: b64uEncode(new Uint8Array(await crypto.subtle.exportKey('spki', kp.publicKey)))
	};
}

export type MintOptions = {
	level: number;
	root?: string;
	/** Leave undefined for the safe unbound form. */
	handle?: string | null;
	ttlMs?: number;
	now?: number;
	jti?: string;
};

/**
 * Mint a claim. Refuses off-scale levels rather than clamping — an issuer that
 * quietly rounds someone's promised standing down has told them a lie they cannot
 * detect until it is spent.
 */
export async function mintBejiClaim(
	privateKey: CryptoKey,
	opts: MintOptions
): Promise<{ claim: string; payload: BejiClaimPayload }> {
	const { level } = opts;
	if (!Number.isInteger(level) || level < 0 || level > MAX_CLAIM_LEVEL) {
		throw new Error(`level must be an integer 0..${MAX_CLAIM_LEVEL} — got ${level}`);
	}
	const now = opts.now ?? Date.now();
	const ttl = opts.ttlMs ?? 14 * 24 * 3_600_000; // a fortnight to act on an invitation
	if (ttl <= 0) throw new Error('ttlMs must be positive — a claim that is born expired is a bug');

	const payload: BejiClaimPayload = {
		root: opts.root ?? 'beji',
		level,
		handle: opts.handle ? opts.handle.trim().toLowerCase() : null,
		jti: opts.jti ?? newJti(),
		iat: now,
		exp: now + ttl
	};
	const payloadB64 = encodePayload(payload);
	const sig = new Uint8Array(
		await crypto.subtle.sign({ name: 'Ed25519' }, privateKey, signingInput(payloadB64))
	);
	return { claim: `${CLAIM_PREFIX}.${payloadB64}.${b64uEncode(sig)}`, payload };
}

/** Self-check: verify a claim we just minted, so a broken issuer key or a codec
 *  drift is caught HERE rather than by the invitee at the door. */
export async function verifyBejiClaim(
	claim: string,
	publicKey: CryptoKey
): Promise<BejiClaimPayload> {
	const parts = claim.trim().split('.');
	if (parts.length !== 3 || parts[0] !== CLAIM_PREFIX) throw new Error('malformed claim');
	const sig = b64uDecode(parts[2]);
	if (sig.length !== 64) throw new Error('malformed signature');
	const ok = await crypto.subtle.verify(
		{ name: 'Ed25519' },
		publicKey,
		sig,
		signingInput(parts[1])
	);
	if (!ok) throw new Error('signature does not verify');
	return JSON.parse(new TextDecoder().decode(b64uDecode(parts[1]))) as BejiClaimPayload;
}
