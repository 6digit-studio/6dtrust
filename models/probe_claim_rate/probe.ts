// Coverage gauge: claimed identities / all identities (dangling ones were
// minted by vouches for handles with no account yet).
import postgres from 'postgres';
const url = process.env.DATABASE_URL;
if (!url) { console.error('probe_claim_rate: DATABASE_URL not set'); process.exit(1); }
const sql = postgres(url, { max: 1 });
const [r] = await sql<{ total: string; claimed: string }[]>`
	select count(*) as total, count(claimed_at) as claimed from identities`;
const total = Number(r.total);
console.log(`signal identities ${total}`);
console.log(`signal claim_rate ${total ? (Number(r.claimed) / total).toFixed(3) : 0} ratio`);
await sql.end();
