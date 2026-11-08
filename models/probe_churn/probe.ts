// Membership churn over the last 24h, from accept_set_events (0004).
// Exit speaks for the instrument (DB reachable?); the numbers speak for the world.
import postgres from 'postgres';
const url = process.env.DATABASE_URL;
if (!url) { console.error('probe_churn: DATABASE_URL not set'); process.exit(1); }
const sql = postgres(url, { max: 1 });
const [r] = await sql<{ total: string; entered: string; exited: string }[]>`
	select count(*) as total,
	       count(*) filter (where event = 'entered') as entered,
	       count(*) filter (where event = 'exited') as exited
	from accept_set_events where at > now() - interval '24 hours'`;
console.log(`signal churn_24h ${r.total}`);
console.log(`signal entered_24h ${r.entered}`);
console.log(`signal exited_24h ${r.exited}`);
await sql.end();
