// Ad-hoc verifier: checks that stored vouch signatures validate against the
// voucher's ed25519 public key. Run: DATABASE_URL=... bun scripts/verify_vouch.mjs
import postgres from 'postgres';
import { createPublicKey, verify } from 'node:crypto';

const sql = postgres(process.env.DATABASE_URL);
const rows = await sql`
	select v.voucher_id, v.subject_id, v.level, v.signature, i.public_key
	from vouches v join identities i on i.id = v.voucher_id
	where v.signature is not null`;

let allOk = true;
for (const r of rows) {
	const pub = createPublicKey({ key: Buffer.from(r.public_key), format: 'der', type: 'spki' });
	const payload = Buffer.from(
		JSON.stringify({ t: 'vouch', v: 1, voucher: r.voucher_id, subject: r.subject_id, level: r.level })
	);
	const ok = verify(null, payload, pub, Buffer.from(r.signature));
	allOk &&= ok;
	console.log(`subject=${r.subject_id} level=${r.level} sigBytes=${r.signature.length} VERIFIES=${ok}`);
}
console.log(rows.length === 0 ? 'no signed vouches found' : `all signatures valid: ${allOk}`);
await sql.end();
