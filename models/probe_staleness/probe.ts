// Worldview staleness: how far the newest vouch outruns the newest recompute.
// 0 = every root's verdicts postdate the graph; growth = verdicts predate it.
import postgres from 'postgres';
const url = process.env.DATABASE_URL;
if (!url) { console.error('probe_staleness: DATABASE_URL not set'); process.exit(1); }
const sql = postgres(url, { max: 1 });
const [r] = await sql<{ lag: string | null }[]>`
	select greatest(0, extract(epoch from
	  (select max(created_at) from vouches) -
	  (select max(computed_at) from accept_sets)))::bigint as lag`;
console.log(`signal staleness_lag_s ${r.lag ?? 0} s`);
await sql.end();
