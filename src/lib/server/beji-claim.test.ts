/// <reference types="bun" />
import { describe, expect, test } from 'bun:test';
import {
	CLAIM_PREFIX,
	MAX_CLAIM_LEVEL,
	b64uDecode,
	b64uEncode,
	encodePayload,
	generateIssuerKeypair,
	importIssuerPrivateKey,
	importIssuerPublicKey,
	mintBejiClaim,
	newJti,
	signingInput,
	verifyBejiClaim
} from './beji-claim';

/**
 * The issuer half of Beji standing claims. The verifier lives in another repo
 * (`ibeji/convex/claim.ts`) and owns the format; these tests pin the bytes this
 * side produces so the two cannot drift apart silently. A codec disagreement
 * between issuer and verifier would surface as "every invitation is rejected",
 * with the fault invisible from either side alone.
 */

const now = 1_800_000_000_000;
const HOUR = 3_600_000;

describe('base64url — must match the verifier byte for byte', () => {
	test('round-trips every byte value at every length remainder', () => {
		for (const len of [0, 1, 2, 3, 4, 5, 31, 32, 33, 64, 255]) {
			const bytes = new Uint8Array(len);
			for (let i = 0; i < len; i++) bytes[i] = (i * 7 + 13) % 256;
			expect(Array.from(b64uDecode(b64uEncode(bytes)))).toEqual(Array.from(bytes));
		}
	});

	test('known vector — the alphabet and grouping are not free choices', () => {
		expect(b64uEncode(new Uint8Array([0, 0, 0]))).toBe('AAAA');
		expect(b64uEncode(new Uint8Array([255, 255, 255]))).toBe('____');
		expect(b64uEncode(new Uint8Array([1]))).toBe('AQ');
		expect(b64uEncode(new Uint8Array([1, 2]))).toBe('AQI');
	});

	test('emits nothing that needs url-escaping, and never pads', () => {
		const bytes = new Uint8Array(256);
		for (let i = 0; i < 256; i++) bytes[i] = i;
		expect(b64uEncode(bytes)).toMatch(/^[A-Za-z0-9_-]+$/);
	});
});

describe('signing input', () => {
	test('covers the version prefix, so a claim cannot be re-labelled', () => {
		const s = new TextDecoder().decode(signingInput('PAYLOAD'));
		expect(s).toBe(`${CLAIM_PREFIX}.PAYLOAD`);
	});
});

describe('mintBejiClaim', () => {
	test('mints an unbound claim that verifies against its own public key', async () => {
		const kp = await generateIssuerKeypair();
		const priv = await importIssuerPrivateKey(kp.privateKey);
		const pub = await importIssuerPublicKey(kp.publicKey);

		const { claim, payload } = await mintBejiClaim(priv, { level: 2, now });
		expect(claim.startsWith(`${CLAIM_PREFIX}.`)).toBe(true);
		expect(claim.split('.')).toHaveLength(3);
		expect(payload.handle).toBeNull(); // unbound is the default — nothing to snipe
		expect(payload.root).toBe('beji');

		const back = await verifyBejiClaim(claim, pub);
		expect(back.jti).toBe(payload.jti);
		expect(back.level).toBe(2);
	});

	test('a bound claim carries its normalized handle', async () => {
		const kp = await generateIssuerKeypair();
		const priv = await importIssuerPrivateKey(kp.privateKey);
		const { payload } = await mintBejiClaim(priv, { level: 1, handle: '  ACME-Scout ', now });
		expect(payload.handle).toBe('acme-scout');
	});

	test('refuses an off-scale level rather than clamping someone’s promise', async () => {
		const kp = await generateIssuerKeypair();
		const priv = await importIssuerPrivateKey(kp.privateKey);
		for (const level of [-1, MAX_CLAIM_LEVEL + 1, 2.5, NaN]) {
			await expect(mintBejiClaim(priv, { level, now })).rejects.toThrow(/level must be/);
		}
	});

	test('refuses a non-positive ttl — a claim born expired is a bug, not a policy', async () => {
		const kp = await generateIssuerKeypair();
		const priv = await importIssuerPrivateKey(kp.privateKey);
		await expect(mintBejiClaim(priv, { level: 1, ttlMs: 0, now })).rejects.toThrow(/ttlMs/);
	});

	test('exp follows iat by exactly the ttl', async () => {
		const kp = await generateIssuerKeypair();
		const priv = await importIssuerPrivateKey(kp.privateKey);
		const { payload } = await mintBejiClaim(priv, { level: 0, ttlMs: 5 * HOUR, now });
		expect(payload.iat).toBe(now);
		expect(payload.exp).toBe(now + 5 * HOUR);
	});

	test('another issuer’s key does not verify — the signature is the whole authority', async () => {
		const a = await generateIssuerKeypair();
		const b = await generateIssuerKeypair();
		const { claim } = await mintBejiClaim(await importIssuerPrivateKey(a.privateKey), {
			level: 3,
			now
		});
		await expect(
			verifyBejiClaim(claim, await importIssuerPublicKey(b.publicKey))
		).rejects.toThrow(/does not verify/);
	});

	test('editing the payload breaks the signature', async () => {
		const kp = await generateIssuerKeypair();
		const priv = await importIssuerPrivateKey(kp.privateKey);
		const pub = await importIssuerPublicKey(kp.publicKey);
		const { claim, payload } = await mintBejiClaim(priv, { level: 0, now });
		const forged = [
			CLAIM_PREFIX,
			encodePayload({ ...payload, level: 3 }),
			claim.split('.')[2]
		].join('.');
		await expect(verifyBejiClaim(forged, pub)).rejects.toThrow(/does not verify/);
	});
});

describe('newJti', () => {
	test('is random, not sequential — a guessable id lets an observer burn an invitation first', () => {
		const seen = new Set(Array.from({ length: 200 }, () => newJti()));
		expect(seen.size).toBe(200);
		for (const j of seen) expect(j).toMatch(/^[0-9a-f]{32}$/);
	});
});
